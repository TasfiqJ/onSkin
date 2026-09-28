import type { AccountDeletionClaim } from './durableDeletionWorker.ts';
import { accountDeletionRetryDelaySeconds } from './durableDeletionRuntimeCore.ts';

export type ServiceRowsDeletionExecutorDependencies = {
  scrub: (userId: string) => Promise<void>;
  record: (
    claim: AccountDeletionClaim,
    outcome: 'succeeded' | 'retryable',
    resultCode: string,
    retryAt: string | null,
  ) => Promise<void>;
  now: () => number;
};

export class ServiceRowsDeletionExecutorError extends Error {
  constructor(public readonly code: 'SERVICE_ROWS_EXECUTOR_INPUT_INVALID') {
    super(code);
    this.name = 'ServiceRowsDeletionExecutorError';
  }
}

function nextRetryAt(
  claim: AccountDeletionClaim,
  dependencies: ServiceRowsDeletionExecutorDependencies,
): string {
  return new Date(
    dependencies.now() + accountDeletionRetryDelaySeconds(claim.attemptCount) * 1_000,
  ).toISOString();
}

/** The database scrub RPC is atomic and retry-idempotent under the user lock. */
export async function executeServiceRowsDeletionStep(
  claim: AccountDeletionClaim,
  context: { deadlineAtMs: number },
  dependencies: ServiceRowsDeletionExecutorDependencies,
): Promise<void> {
  if (
    claim.stepName !== 'service_rows_scrub' ||
    !Number.isSafeInteger(context.deadlineAtMs) ||
    context.deadlineAtMs < 0 ||
    typeof dependencies.now !== 'function'
  ) {
    throw new ServiceRowsDeletionExecutorError('SERVICE_ROWS_EXECUTOR_INPUT_INVALID');
  }
  if (dependencies.now() >= context.deadlineAtMs) {
    await dependencies.record(
      claim,
      'retryable',
      'SERVICE_ROWS_SCRUB_RETRY',
      nextRetryAt(claim, dependencies),
    );
    return;
  }
  try {
    await dependencies.scrub(claim.userId);
  } catch {
    await dependencies.record(
      claim,
      'retryable',
      'SERVICE_ROWS_SCRUB_RETRY',
      nextRetryAt(claim, dependencies),
    );
    return;
  }
  await dependencies.record(claim, 'succeeded', 'SERVICE_ROWS_SCRUBBED', null);
}
