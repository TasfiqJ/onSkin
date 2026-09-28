import type { AccountDeletionClaim } from './durableDeletionWorker.ts';
import {
  accountDeletionRetryDelaySeconds,
  classifyAuthHardDeleteResult,
  classifyAuthUserLookupResult,
} from './durableDeletionRuntimeCore.ts';

export const AUTH_ABSENCE_SETTLING_MAX_ATTEMPTS = 6;

export type AuthDeletionExecutorDependencies = {
  markRequestStarted: (claim: AccountDeletionClaim) => Promise<void>;
  record: (
    claim: AccountDeletionClaim,
    outcome: 'succeeded' | 'retryable' | 'ambiguous' | 'action_required',
    resultCode: string,
    retryAt: string | null,
  ) => Promise<void>;
  hardDeleteUser: (userId: string) => Promise<unknown>;
  lookupUser: (userId: string) => Promise<unknown>;
  now: () => number;
};

export class AuthDeletionExecutorError extends Error {
  constructor(public readonly code: 'AUTH_EXECUTOR_INPUT_INVALID') {
    super(code);
    this.name = 'AuthDeletionExecutorError';
  }
}

function nextRetryAt(
  claim: AccountDeletionClaim,
  dependencies: AuthDeletionExecutorDependencies,
): string {
  return new Date(
    dependencies.now() + accountDeletionRetryDelaySeconds(claim.attemptCount) * 1_000,
  ).toISOString();
}

async function recordLookupDisposition(
  claim: AccountDeletionClaim,
  result: unknown,
  dependencies: AuthDeletionExecutorDependencies,
): Promise<void> {
  const disposition = classifyAuthUserLookupResult(result, claim.userId);
  if (disposition === 'absent') {
    await dependencies.record(claim, 'succeeded', 'AUTH_USER_ABSENT', null);
    return;
  }
  if (disposition === 'action_required') {
    await dependencies.record(claim, 'action_required', 'AUTH_LOOKUP_REJECTED', null);
    return;
  }
  if (claim.claimMode === 'dispatch') {
    // A destructive request has already crossed the network boundary. Neither
    // a still-present read nor an unreadable result permits another DELETE.
    await dependencies.record(claim, 'ambiguous', 'AUTH_DELETE_OUTCOME_UNKNOWN', null);
    return;
  }
  if (disposition === 'present' && claim.attemptCount >= AUTH_ABSENCE_SETTLING_MAX_ATTEMPTS) {
    await dependencies.record(claim, 'action_required', 'AUTH_USER_STILL_PRESENT', null);
    return;
  }
  await dependencies.record(
    claim,
    'retryable',
    disposition === 'present' ? 'AUTH_ABSENCE_SETTLING' : 'AUTH_LOOKUP_RETRY',
    nextRetryAt(claim, dependencies),
  );
}

/**
 * Executes Supabase Auth hard deletion at most once. Dispatch performs the
 * single DELETE; reconciliation is permanently GET-only, including after a
 * timeout or malformed response.
 */
export async function executeAuthDeletionStep(
  claim: AccountDeletionClaim,
  context: { deadlineAtMs: number },
  dependencies: AuthDeletionExecutorDependencies,
): Promise<void> {
  if (
    claim.stepName !== 'auth_user_delete' ||
    !Number.isSafeInteger(context.deadlineAtMs) ||
    context.deadlineAtMs < 0 ||
    typeof dependencies.now !== 'function'
  ) {
    throw new AuthDeletionExecutorError('AUTH_EXECUTOR_INPUT_INVALID');
  }

  if (dependencies.now() >= context.deadlineAtMs) {
    await dependencies.record(
      claim,
      'retryable',
      claim.claimMode === 'dispatch' ? 'AUTH_DELETE_RETRY' : 'AUTH_LOOKUP_RETRY',
      nextRetryAt(claim, dependencies),
    );
    return;
  }

  await dependencies.markRequestStarted(claim);

  if (claim.claimMode === 'dispatch') {
    let deleteResult: unknown;
    try {
      deleteResult = await dependencies.hardDeleteUser(claim.userId);
    } catch {
      await dependencies.record(claim, 'ambiguous', 'AUTH_DELETE_OUTCOME_UNKNOWN', null);
      return;
    }
    const deleteDisposition = classifyAuthHardDeleteResult(deleteResult);
    if (deleteDisposition === 'ambiguous') {
      await dependencies.record(claim, 'ambiguous', 'AUTH_DELETE_OUTCOME_UNKNOWN', null);
      return;
    }
    if (deleteDisposition === 'action_required') {
      await dependencies.record(claim, 'action_required', 'AUTH_DELETE_REJECTED', null);
      return;
    }
  }

  if (dependencies.now() >= context.deadlineAtMs) {
    await dependencies.record(
      claim,
      claim.claimMode === 'dispatch' ? 'ambiguous' : 'retryable',
      claim.claimMode === 'dispatch' ? 'AUTH_DELETE_OUTCOME_UNKNOWN' : 'AUTH_LOOKUP_RETRY',
      claim.claimMode === 'dispatch' ? null : nextRetryAt(claim, dependencies),
    );
    return;
  }

  let lookupResult: unknown;
  try {
    lookupResult = await dependencies.lookupUser(claim.userId);
  } catch {
    lookupResult = null;
  }
  await recordLookupDisposition(claim, lookupResult, dependencies);
}
