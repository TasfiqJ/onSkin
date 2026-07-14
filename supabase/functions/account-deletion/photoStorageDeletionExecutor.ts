import type { AccountDeletionClaim } from './durableDeletionWorker.ts';
import { accountDeletionRetryDelaySeconds } from './durableDeletionRuntimeCore.ts';

export const PHOTO_STORAGE_DELETE_BATCH_SIZE = 100;

export type PhotoStorageDeletionExecutorDependencies = {
  listOwnedObjectNames: (userId: string, limit: number) => Promise<string[]>;
  countOwnedObjects: (userId: string) => Promise<number>;
  removeObjectNames: (names: string[]) => Promise<void>;
  markRequestStarted: (claim: AccountDeletionClaim) => Promise<void>;
  record: (
    claim: AccountDeletionClaim,
    outcome: 'succeeded' | 'retryable' | 'ambiguous' | 'action_required',
    resultCode: string,
    retryAt: string | null,
  ) => Promise<void>;
  now: () => number;
};

export class PhotoStorageDeletionExecutorError extends Error {
  constructor(public readonly code: 'PHOTO_STORAGE_EXECUTOR_INPUT_INVALID') {
    super(code);
    this.name = 'PhotoStorageDeletionExecutorError';
  }
}

function nextRetryAt(
  claim: AccountDeletionClaim,
  dependencies: PhotoStorageDeletionExecutorDependencies,
): string {
  return new Date(
    dependencies.now() + accountDeletionRetryDelaySeconds(claim.attemptCount) * 1_000,
  ).toISOString();
}

async function recordRetry(
  claim: AccountDeletionClaim,
  code: string,
  dependencies: PhotoStorageDeletionExecutorDependencies,
): Promise<void> {
  await dependencies.record(
    claim,
    claim.claimMode === 'dispatch' && claim.requestStartedAt !== null ? 'ambiguous' : 'retryable',
    code,
    claim.claimMode === 'dispatch' && claim.requestStartedAt !== null
      ? null
      : nextRetryAt(claim, dependencies),
  );
}

/** Deletes only names attested by the database ownership worklist. */
export async function executePhotoStorageDeletionStep(
  claim: AccountDeletionClaim,
  context: { deadlineAtMs: number },
  dependencies: PhotoStorageDeletionExecutorDependencies,
): Promise<void> {
  if (
    claim.stepName !== 'photo_storage_delete' ||
    !Number.isSafeInteger(context.deadlineAtMs) ||
    context.deadlineAtMs < 0 ||
    typeof dependencies.now !== 'function'
  ) {
    throw new PhotoStorageDeletionExecutorError('PHOTO_STORAGE_EXECUTOR_INPUT_INVALID');
  }

  if (dependencies.now() >= context.deadlineAtMs) {
    await recordRetry(claim, 'PHOTO_STORAGE_RETRY', dependencies);
    return;
  }

  let count: number;
  try {
    count = await dependencies.countOwnedObjects(claim.userId);
  } catch {
    await recordRetry(claim, 'PHOTO_STORAGE_ATTESTATION_RETRY', dependencies);
    return;
  }
  if (count === 0) {
    await dependencies.record(claim, 'succeeded', 'PHOTO_STORAGE_ALREADY_ABSENT', null);
    return;
  }

  let names: string[];
  try {
    names = await dependencies.listOwnedObjectNames(claim.userId, PHOTO_STORAGE_DELETE_BATCH_SIZE);
  } catch {
    await recordRetry(claim, 'PHOTO_STORAGE_ATTESTATION_RETRY', dependencies);
    return;
  }
  if (names.length === 0 || names.length > PHOTO_STORAGE_DELETE_BATCH_SIZE) {
    await dependencies.record(claim, 'action_required', 'PHOTO_STORAGE_WORKLIST_INVALID', null);
    return;
  }
  if (dependencies.now() >= context.deadlineAtMs) {
    await recordRetry(claim, 'PHOTO_STORAGE_RETRY', dependencies);
    return;
  }

  await dependencies.markRequestStarted(claim);
  const startedClaim = {
    ...claim,
    requestStartedAt: new Date(dependencies.now()).toISOString(),
  };
  try {
    await dependencies.removeObjectNames(names);
  } catch {
    await recordRetry(startedClaim, 'PHOTO_STORAGE_REMOVE_RETRY', dependencies);
    return;
  }

  let remaining: number;
  try {
    remaining = await dependencies.countOwnedObjects(claim.userId);
  } catch {
    await recordRetry(startedClaim, 'PHOTO_STORAGE_ATTESTATION_RETRY', dependencies);
    return;
  }
  if (remaining === 0) {
    await dependencies.record(claim, 'succeeded', 'PHOTO_STORAGE_DELETE_ATTESTED', null);
    return;
  }
  await recordRetry(startedClaim, 'PHOTO_STORAGE_RECONCILIATION_REQUIRED', dependencies);
}
