import {
  assertHealthDataConsentCopyReleaseAllowed,
  HEALTH_DATA_CONSENT,
  HEALTH_DATA_WITHDRAWAL,
} from '@/features/onboarding/consentCopy';
import {
  hasCurrentHealthDataCollectionConsent,
  setHealthDataCollectionConsentLocal,
  synchronizeAuthoritativeHealthDataCollectionConsent,
} from '@/features/onboarding/healthConsentStore';
import {
  assertAccountIdentityGeneration,
  AccountGenerationLeaseError,
  captureAccountIdentityGeneration,
  isAccountGenerationLeaseError,
  runAccountGenerationOperation,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { localDataOwnerBinding, readLocalDataOwnership } from '@/lib/auth/sessionOwner';
import {
  activeHealthProcessingLeaseSnapshot,
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';
import { clearAllDependentConsentWithdrawalTombstones } from '@/lib/consent/dependentConsentLocal';
import { env, isSupabaseConfigured } from '@/lib/env';

import {
  readHealthDataLifecycle,
  verificationCanResumeActiveEpoch,
  verificationRequiredRecord,
  verificationRequiresLocalCleanup,
  publishImmediateHealthDataWithdrawalInterlock,
  writeHealthDataLifecycle,
  type HealthDataLifecycleRecord,
  type HealthDataVerificationReason,
  type HealthDataVerificationResumeState,
} from './lifecycleStore';
import {
  clearPendingHealthWithdrawalIntent,
  preparePendingHealthWithdrawalIntent,
  preparePendingHealthWithdrawalIntentByOwnerBinding,
  readPendingHealthWithdrawalIntent,
  updatePendingHealthWithdrawalIntent,
  type PendingHealthWithdrawalIntent,
} from './pendingIntent';
import {
  beginRemoteHealthDataWithdrawal,
  createHealthWithdrawalIdempotencyKey,
  declineRemoteInitialHealthDataConsent,
  fetchRemoteHealthDataLifecycle,
  grantRemoteHealthDataConsent,
  remoteHealthDataConsentMatchesCurrentContract,
  retryRemoteHealthDataWithdrawal,
  type RemoteHealthDataLifecycle,
} from './remote';
import { clearHealthPurposeLocalData } from './selectiveCleanup';

export const LOCAL_UNCONFIGURED_HEALTH_DATA_OWNER = 'local-device-unclaimed';
export const HEALTH_DATA_LIFECYCLE_LOCAL_OWNER_UNAVAILABLE =
  'HEALTH_DATA_LIFECYCLE_LOCAL_OWNER_UNAVAILABLE';

const NO_VERIFICATION = Object.freeze({
  verificationReason: null,
  verificationResumeState: null,
} as const);

function assertOwner(ownerUserId: string): void {
  if (!ownerUserId || ownerUserId !== ownerUserId.trim() || ownerUserId.length > 128) {
    throw new Error('HEALTH_DATA_LIFECYCLE_OWNER_INVALID');
  }
}

type OwnerWorkflowFence = Readonly<{
  ownerUserId: string;
  identityGeneration: number;
  workflowGeneration: number;
}>;

type OwnerWorkflowState = {
  identityGeneration: number;
  generation: number;
  closedIntentGeneration: number | null;
};

const ownerWorkflowStates = new Map<string, OwnerWorkflowState>();

function ownerWorkflowState(ownerUserId: string): OwnerWorkflowState {
  const identityGeneration = captureAccountIdentityGeneration();
  let state = ownerWorkflowStates.get(ownerUserId);
  if (!state || state.identityGeneration !== identityGeneration) {
    state = { identityGeneration, generation: 0, closedIntentGeneration: null };
    ownerWorkflowStates.set(ownerUserId, state);
  }
  return state;
}

function captureOwnerWorkflowFence(
  ownerUserId: string,
  closesProcessing = false,
): OwnerWorkflowFence {
  assertOwner(ownerUserId);
  const state = ownerWorkflowState(ownerUserId);
  if (!closesProcessing && state.closedIntentGeneration !== null) {
    throw new AccountGenerationLeaseError();
  }
  state.generation += 1;
  if (closesProcessing) state.closedIntentGeneration = state.generation;
  return Object.freeze({
    ownerUserId,
    identityGeneration: captureAccountIdentityGeneration(),
    workflowGeneration: state.generation,
  });
}

function assertOwnerWorkflowFence(fence: OwnerWorkflowFence): void {
  assertAccountIdentityGeneration(fence.identityGeneration);
  const state = ownerWorkflowState(fence.ownerUserId);
  if (
    fence.workflowGeneration !== state.generation ||
    (state.closedIntentGeneration !== null &&
      state.closedIntentGeneration !== fence.workflowGeneration)
  ) {
    throw new AccountGenerationLeaseError();
  }
}

function promoteWorkflowToClosedIntent(fence: OwnerWorkflowFence): void {
  assertOwnerWorkflowFence(fence);
  ownerWorkflowState(fence.ownerUserId).closedIntentGeneration = fence.workflowGeneration;
}

function workflowOwnsClosedIntent(fence: OwnerWorkflowFence): boolean {
  return ownerWorkflowState(fence.ownerUserId).closedIntentGeneration === fence.workflowGeneration;
}

function releaseClosedIntent(fence: OwnerWorkflowFence): void {
  assertOwnerWorkflowFence(fence);
  const state = ownerWorkflowState(fence.ownerUserId);
  if (state.closedIntentGeneration === fence.workflowGeneration) {
    state.closedIntentGeneration = null;
  }
}

function rethrowStaleWorkflow(error: unknown, fence: OwnerWorkflowFence): void {
  if (isAccountGenerationLeaseError(error)) throw error;
  assertOwnerWorkflowFence(fence);
}

/**
 * Every private-store continuation is both account-generation fenced and, in
 * configured builds, authorized by the durable local-owner proof. If Auth
 * moves from A to B, the account boundary waits for an already-started A write
 * and then clears it; a late A continuation can never write into B's store.
 */
async function runOwnerBoundLocalOperation<T>(
  fence: OwnerWorkflowFence,
  operation: (lease: AccountGenerationLease, ownerBinding: string) => T | Promise<T>,
): Promise<T> {
  assertOwnerWorkflowFence(fence);
  return runAccountGenerationOperation(async (lease) => {
    assertOwnerWorkflowFence(fence);
    if (isSupabaseConfigured) {
      const ownership = await readLocalDataOwnership(fence.ownerUserId);
      lease.assertCurrent();
      assertOwnerWorkflowFence(fence);
      if (ownership !== 'match') {
        throw new Error(HEALTH_DATA_LIFECYCLE_LOCAL_OWNER_UNAVAILABLE);
      }
    }
    const ownerBinding = await localDataOwnerBinding(fence.ownerUserId);
    lease.assertCurrent();
    assertOwnerWorkflowFence(fence);
    const result = await operation(lease, ownerBinding);
    lease.assertCurrent();
    assertOwnerWorkflowFence(fence);
    return result;
  });
}

const readLocal = (fence: OwnerWorkflowFence) =>
  runOwnerBoundLocalOperation(fence, () => readHealthDataLifecycle(fence.ownerUserId));

function applyProcessingEpochWithinLease(
  fence: OwnerWorkflowFence,
  lease: AccountGenerationLease,
  ownerBinding: string,
  record: HealthDataLifecycleRecord,
): void {
  lease.assertCurrent();
  assertOwnerWorkflowFence(fence);
  if (
    record.state !== 'active' ||
    record.activationRoutePending ||
    workflowOwnsClosedIntent(fence)
  ) {
    clearActiveHealthProcessingEpoch({
      ownerUserId: fence.ownerUserId,
      accountGeneration: lease.generation,
    });
    lease.assertCurrent();
    assertOwnerWorkflowFence(fence);
    return;
  }

  const published = setActiveHealthProcessingEpoch(record.processingEpoch, {
    ownerUserId: fence.ownerUserId,
    ownerBinding,
    accountGeneration: lease.generation,
    identityGeneration: fence.identityGeneration,
    serverVerifiedAt: isSupabaseConfigured ? record.serverVerifiedAt : null,
  });
  try {
    lease.assertCurrent();
    assertOwnerWorkflowFence(fence);
  } catch (error) {
    clearActiveHealthProcessingEpoch({
      ownerUserId: fence.ownerUserId,
      generation: published.generation,
      accountGeneration: lease.generation,
    });
    throw error;
  }
}

const writeLocal = (
  fence: OwnerWorkflowFence,
  input: Omit<HealthDataLifecycleRecord, 'schemaVersion' | 'updatedAt'>,
) =>
  runOwnerBoundLocalOperation(fence, async (lease, ownerBinding) => {
    const record = await writeHealthDataLifecycle(input);
    lease.assertCurrent();
    assertOwnerWorkflowFence(fence);
    applyProcessingEpochWithinLease(fence, lease, ownerBinding, record);
    if (
      workflowOwnsClosedIntent(fence) &&
      record.localCleanupComplete &&
      (record.state === 'withdrawn' || record.state === 'unconsented')
    ) {
      releaseClosedIntent(fence);
    }
    return record;
  });

const applyProcessingEpoch = (fence: OwnerWorkflowFence, record: HealthDataLifecycleRecord) =>
  runOwnerBoundLocalOperation(fence, (lease, ownerBinding) => {
    applyProcessingEpochWithinLease(fence, lease, ownerBinding, record);
  });

function closeProcessingEpochImmediately(fence: OwnerWorkflowFence): Promise<void> {
  assertOwnerWorkflowFence(fence);
  return runAccountGenerationOperation((lease) => {
    // This callback executes synchronously before the returned promise can be
    // awaited. Withdrawal therefore closes the exact owner/generation lease
    // immediately after input validation, before any private read or Crypto
    // operation can suspend.
    assertOwnerWorkflowFence(fence);
    clearActiveHealthProcessingEpoch({
      ownerUserId: fence.ownerUserId,
      accountGeneration: lease.generation,
    });
    lease.assertCurrent();
    assertOwnerWorkflowFence(fence);
  });
}

function beginConfirmedWithdrawalInterlock(ownerUserId: string): {
  fence: OwnerWorkflowFence;
  ownerBinding: string;
  processingEpoch: number;
} {
  const active = activeHealthProcessingLeaseSnapshot(ownerUserId);
  if (
    active === null ||
    active.ownerUserId !== ownerUserId ||
    active.accountGeneration === null ||
    active.ownerBinding === null
  ) {
    throw new Error('HEALTH_DATA_WITHDRAWAL_NOT_ACTIVE');
  }
  const fence = captureOwnerWorkflowFence(ownerUserId, true);
  if (active.identityGeneration !== fence.identityGeneration) {
    throw new AccountGenerationLeaseError();
  }
  const cleared = clearActiveHealthProcessingEpoch({
    ownerUserId,
    generation: active.generation,
    accountGeneration: active.accountGeneration,
  });
  if (!cleared) throw new AccountGenerationLeaseError();

  // This subscription notification is synchronous. React's currently mounted
  // health tree observes `withdrawing` before the first storage promise is
  // created, while the durable owner-bound pre-intake record below supplies
  // process-death recovery.
  publishImmediateHealthDataWithdrawalInterlock({
    ownerUserId,
    processingEpoch: active.epoch,
  });
  return { fence, ownerBinding: active.ownerBinding, processingEpoch: active.epoch };
}

const readPending = (fence: OwnerWorkflowFence) =>
  runOwnerBoundLocalOperation(fence, () => readPendingHealthWithdrawalIntent(fence.ownerUserId));

function preparePending(params: {
  fence: OwnerWorkflowFence;
  processingEpoch: number;
  idempotencyKey: string | null;
}) {
  return runOwnerBoundLocalOperation(params.fence, () =>
    preparePendingHealthWithdrawalIntent({
      ownerUserId: params.fence.ownerUserId,
      processingEpoch: params.processingEpoch,
      idempotencyKey: params.idempotencyKey,
    }),
  );
}

function updatePending(
  fence: OwnerWorkflowFence,
  intent: PendingHealthWithdrawalIntent,
  update: {
    idempotencyKey?: string;
    operationId?: string | null;
    localCleanupComplete?: boolean;
  },
) {
  return runOwnerBoundLocalOperation(fence, () =>
    updatePendingHealthWithdrawalIntent({
      ownerUserId: fence.ownerUserId,
      expectedProcessingEpoch: intent.processingEpoch,
      expectedIdempotencyKey: intent.idempotencyKey,
      ...update,
    }),
  );
}

function clearPending(fence: OwnerWorkflowFence, intent: PendingHealthWithdrawalIntent) {
  return runOwnerBoundLocalOperation(fence, () =>
    clearPendingHealthWithdrawalIntent(fence.ownerUserId, {
      processingEpoch: intent.processingEpoch,
      idempotencyKey: intent.idempotencyKey,
    }),
  );
}

function sameLocalWithdrawal(
  remote: RemoteHealthDataLifecycle,
  previous: HealthDataLifecycleRecord | null,
): boolean {
  return Boolean(
    previous &&
    (previous.state === 'withdrawing' ||
      previous.state === 'withdrawn' ||
      (previous.state === 'verification_required' &&
        (previous.verificationResumeState === 'withdrawing' ||
          previous.verificationResumeState === 'withdrawn'))) &&
    previous.processingEpoch === remote.processingEpoch &&
    previous.localCleanupComplete &&
    (previous.operationId === null || previous.operationId === remote.operationId),
  );
}

function activationRoutePendingForActive(
  previous: HealthDataLifecycleRecord | null,
  processingEpoch: number,
): boolean {
  if (previous?.state === 'active' && previous.processingEpoch === processingEpoch) {
    return previous.activationRoutePending;
  }
  if (
    previous?.state === 'verification_required' &&
    previous.verificationReason === 'status_unavailable' &&
    previous.verificationResumeState === 'active' &&
    previous.processingEpoch === processingEpoch
  ) {
    return previous.activationRoutePending;
  }
  return true;
}

function remoteRecord(
  remote: RemoteHealthDataLifecycle,
  previous: HealthDataLifecycleRecord | null,
): Omit<HealthDataLifecycleRecord, 'schemaVersion' | 'updatedAt'> {
  const sameWithdrawal = sameLocalWithdrawal(remote, previous);
  const canReuseKey =
    remote.state === 'withdrawing' &&
    previous?.state === 'withdrawing' &&
    previous.processingEpoch === remote.processingEpoch &&
    (previous.operationId === null || previous.operationId === remote.operationId);
  return {
    ownerUserId: remote.ownerUserId,
    state: remote.state,
    processingEpoch: remote.processingEpoch,
    operationId: remote.operationId,
    idempotencyKey: canReuseKey ? previous.idempotencyKey : null,
    // Active must never donate its old `true` flag to a withdrawal observed on
    // another device. Only the same locally fenced withdrawal may carry proof.
    localCleanupComplete:
      remote.state === 'active' || remote.state === 'unconsented' ? true : sameWithdrawal,
    activationRoutePending:
      remote.state === 'active'
        ? activationRoutePendingForActive(previous, remote.processingEpoch)
        : false,
    ...NO_VERIFICATION,
    serverVerifiedAt: remote.serverVerifiedAt,
  };
}

async function adoptRemote(
  fence: OwnerWorkflowFence,
  remote: RemoteHealthDataLifecycle,
  previous: HealthDataLifecycleRecord | null,
): Promise<HealthDataLifecycleRecord> {
  assertOwnerWorkflowFence(fence);
  if (remote.ownerUserId !== fence.ownerUserId) {
    throw new Error('HEALTH_DATA_LIFECYCLE_OWNER_MISMATCH');
  }
  return writeLocal(fence, remoteRecord(remote, previous));
}

function verificationInput(params: {
  ownerUserId: string;
  previous?: HealthDataLifecycleRecord | null;
  processingEpoch?: number;
  localCleanupComplete?: boolean;
  reason?: HealthDataVerificationReason;
  resumeState?: HealthDataVerificationResumeState | null;
}): Omit<HealthDataLifecycleRecord, 'schemaVersion' | 'updatedAt'> {
  const record = verificationRequiredRecord(params);
  return {
    ownerUserId: record.ownerUserId,
    state: record.state,
    processingEpoch: params.processingEpoch ?? record.processingEpoch,
    operationId: record.operationId,
    idempotencyKey: null,
    localCleanupComplete: record.localCleanupComplete,
    activationRoutePending: record.activationRoutePending,
    verificationReason: record.verificationReason,
    verificationResumeState: record.verificationResumeState,
    serverVerifiedAt: record.serverVerifiedAt,
  };
}

async function pauseForVerification(params: {
  fence: OwnerWorkflowFence;
  previous?: HealthDataLifecycleRecord | null;
  processingEpoch?: number;
  localCleanupComplete?: boolean;
  reason?: HealthDataVerificationReason;
  resumeState?: HealthDataVerificationResumeState | null;
}): Promise<HealthDataLifecycleRecord> {
  return writeLocal(
    params.fence,
    verificationInput({ ...params, ownerUserId: params.fence.ownerUserId }),
  );
}

async function hydratePendingWithdrawal(
  fence: OwnerWorkflowFence,
  previous: HealthDataLifecycleRecord | null,
  pending: PendingHealthWithdrawalIntent,
): Promise<HealthDataLifecycleRecord> {
  if (
    previous?.state === 'withdrawn' &&
    previous.localCleanupComplete &&
    previous.processingEpoch === pending.processingEpoch &&
    (pending.operationId === null || previous.operationId === pending.operationId)
  ) {
    await clearDependentWithdrawalRecoveryAfterTerminal(fence, previous);
    await clearPending(fence, pending);
    await applyProcessingEpoch(fence, previous);
    if (workflowOwnsClosedIntent(fence)) releaseClosedIntent(fence);
    return previous;
  }
  if (
    previous !== null &&
    previous.processingEpoch !== pending.processingEpoch &&
    previous.state !== 'unconsented' &&
    previous.state !== 'verification_required'
  ) {
    throw new Error('HEALTH_DATA_WITHDRAWAL_PENDING_EPOCH_MISMATCH');
  }
  return writeLocal(fence, {
    ownerUserId: fence.ownerUserId,
    state: 'withdrawing',
    processingEpoch: pending.processingEpoch,
    operationId: pending.operationId,
    idempotencyKey: pending.idempotencyKey,
    localCleanupComplete: pending.localCleanupComplete,
    activationRoutePending: false,
    ...NO_VERIFICATION,
    serverVerifiedAt: previous?.serverVerifiedAt ?? null,
  });
}

async function reconcileUnconfigured(
  fence: OwnerWorkflowFence,
  previous: HealthDataLifecycleRecord | null,
): Promise<HealthDataLifecycleRecord> {
  const ownerUserId = fence.ownerUserId;
  if (previous?.state === 'withdrawing' || previous?.state === 'withdrawn') {
    await applyProcessingEpoch(fence, previous);
    if (previous.localCleanupComplete) {
      if (previous.state === 'withdrawn') {
        await clearDependentWithdrawalRecoveryAfterTerminal(fence, previous);
      }
      return previous;
    }
    try {
      await recordLocalWithdrawalChoice(fence);
      await clearHealthPurposeLocalDataForFence(fence);
      const cleaned = await writeLocal(fence, {
        ownerUserId,
        state: previous.state,
        processingEpoch: previous.processingEpoch,
        operationId: previous.operationId,
        idempotencyKey: previous.idempotencyKey,
        localCleanupComplete: true,
        activationRoutePending: false,
        ...NO_VERIFICATION,
        serverVerifiedAt: previous.serverVerifiedAt,
      });
      if (cleaned.state === 'withdrawn') {
        await clearDependentWithdrawalRecoveryAfterTerminal(fence, cleaned);
      }
      return cleaned;
    } catch (error) {
      rethrowStaleWorkflow(error, fence);
      return previous;
    }
  }
  if (previous?.state === 'verification_required') {
    await applyProcessingEpoch(fence, previous);
    const consented = await runOwnerBoundLocalOperation(fence, () =>
      hasCurrentHealthDataCollectionConsent(),
    );
    if (previous.verificationReason === 'status_unavailable') {
      if (
        consented &&
        (previous.verificationResumeState === 'active' || previous.verificationResumeState === null)
      ) {
        const resumed = await writeLocal(fence, {
          ownerUserId,
          state: 'active',
          processingEpoch: Math.max(previous.processingEpoch, 1),
          operationId: null,
          idempotencyKey: null,
          localCleanupComplete: true,
          activationRoutePending: activationRoutePendingForActive(
            previous,
            Math.max(previous.processingEpoch, 1),
          ),
          ...NO_VERIFICATION,
          serverVerifiedAt: null,
        });
        return resumed;
      }
      if (
        !consented &&
        previous.verificationResumeState === 'unconsented' &&
        previous.localCleanupComplete
      ) {
        return writeLocal(fence, {
          ownerUserId,
          state: 'unconsented',
          processingEpoch: 0,
          operationId: null,
          idempotencyKey: null,
          localCleanupComplete: true,
          activationRoutePending: false,
          ...NO_VERIFICATION,
          serverVerifiedAt: null,
        });
      }
      previous = await pauseForVerification({
        fence,
        previous,
        reason: consented ? 'processing_epoch_changed' : 'local_consent_unavailable',
        localCleanupComplete: false,
      });
    }
    if (!verificationRequiresLocalCleanup(previous) || previous.localCleanupComplete) {
      return previous;
    }
    try {
      await clearHealthPurposeLocalDataForFence(fence);
      return await writeLocal(fence, {
        ...verificationInput({ ownerUserId, previous }),
        localCleanupComplete: true,
      });
    } catch (error) {
      rethrowStaleWorkflow(error, fence);
      return previous;
    }
  }

  const consented = await runOwnerBoundLocalOperation(fence, () =>
    hasCurrentHealthDataCollectionConsent(),
  );
  if (previous?.state === 'active' && !consented) {
    // A missing/changed local grant cannot retain the prior health profile.
    // Commit the closed cleanup marker before clearing, and expose reconsent
    // only after the idempotent purpose cleanup is durably complete.
    const paused = await pauseForVerification({
      fence,
      previous,
      localCleanupComplete: false,
      reason: 'local_consent_unavailable',
    });
    try {
      await clearHealthPurposeLocalDataForFence(fence);
      return await writeLocal(fence, {
        ...verificationInput({ ownerUserId, previous: paused }),
        localCleanupComplete: true,
      });
    } catch (error) {
      rethrowStaleWorkflow(error, fence);
      return paused;
    }
  }

  if (!consented && (previous === null || !previous.localCleanupComplete)) {
    // Installed builds can predate the lifecycle marker while still carrying
    // health-purpose private keys. Commit a closed marker first; only publish
    // `unconsented + cleanup complete` after the purpose-limited clear succeeds.
    let paused = await pauseForVerification({
      fence,
      previous,
      processingEpoch: 0,
      localCleanupComplete: false,
      reason: 'authoritative_unconsented',
      resumeState: previous?.state ?? null,
    });
    try {
      await clearHealthPurposeLocalDataForFence(fence);
      paused = await writeLocal(fence, {
        ownerUserId,
        state: 'unconsented',
        processingEpoch: 0,
        operationId: null,
        idempotencyKey: null,
        localCleanupComplete: true,
        activationRoutePending: false,
        ...NO_VERIFICATION,
        serverVerifiedAt: null,
      });
      return paused;
    } catch (error) {
      rethrowStaleWorkflow(error, fence);
      return paused;
    }
  }

  return writeLocal(fence, {
    ownerUserId,
    state: consented ? 'active' : 'unconsented',
    processingEpoch: consented ? Math.max(previous?.processingEpoch ?? 1, 1) : 0,
    operationId: null,
    idempotencyKey: null,
    localCleanupComplete: true,
    activationRoutePending: consented
      ? activationRoutePendingForActive(previous, Math.max(previous?.processingEpoch ?? 1, 1))
      : false,
    ...NO_VERIFICATION,
    serverVerifiedAt: null,
  });
}

async function runRemoteForFence<T>(
  fence: OwnerWorkflowFence,
  operation: () => Promise<T>,
): Promise<T> {
  assertOwnerWorkflowFence(fence);
  const result = await operation();
  assertOwnerWorkflowFence(fence);
  return result;
}

async function clearHealthPurposeLocalDataForFence(fence: OwnerWorkflowFence): Promise<void> {
  assertOwnerWorkflowFence(fence);
  await clearHealthPurposeLocalData(fence.ownerUserId);
  assertOwnerWorkflowFence(fence);
}

async function clearDependentWithdrawalRecoveryAfterTerminal(
  fence: OwnerWorkflowFence,
  terminal: HealthDataLifecycleRecord,
): Promise<void> {
  if (terminal.state !== 'withdrawn' || !terminal.localCleanupComplete) {
    throw new Error('HEALTH_DATA_WITHDRAWAL_NOT_TERMINAL');
  }
  await runOwnerBoundLocalOperation(fence, () =>
    clearAllDependentConsentWithdrawalTombstones(fence.ownerUserId),
  );
}

async function reconcileHealthDataLifecycleForFence(
  fence: OwnerWorkflowFence,
): Promise<HealthDataLifecycleRecord> {
  const ownerUserId = fence.ownerUserId;
  let previous: HealthDataLifecycleRecord | null = null;
  try {
    previous = await readLocal(fence);
    const pending = await readPending(fence);
    if (
      pending !== null ||
      previous?.state === 'withdrawing' ||
      (previous?.state === 'withdrawn' && !previous.localCleanupComplete) ||
      (previous?.state === 'verification_required' &&
        (previous.verificationResumeState === 'withdrawing' ||
          previous.verificationResumeState === 'withdrawn'))
    ) {
      promoteWorkflowToClosedIntent(fence);
    }
    if (pending) return await hydratePendingWithdrawal(fence, previous, pending);

    if (!isSupabaseConfigured) return await reconcileUnconfigured(fence, previous);

    const remote = await runRemoteForFence(fence, () =>
      fetchRemoteHealthDataLifecycle(ownerUserId),
    );
    if (remote.ownerUserId !== ownerUserId) {
      throw new Error('HEALTH_DATA_LIFECYCLE_OWNER_MISMATCH');
    }

    // A legacy locally durable withdrawal must not be undone by an active
    // status that proves only that its original intake response was lost.
    if (
      (previous?.state === 'withdrawing' ||
        (previous?.state === 'verification_required' &&
          previous.verificationResumeState === 'withdrawing')) &&
      remote.state !== 'withdrawing' &&
      remote.state !== 'withdrawn'
    ) {
      await applyProcessingEpoch(fence, previous);
      return previous;
    }

    if (remote.state === 'active') {
      const contractMatches = await runOwnerBoundLocalOperation(fence, () =>
        remoteHealthDataConsentMatchesCurrentContract(remote),
      );
      if (!contractMatches) {
        const mismatchEpoch = Math.max(previous?.processingEpoch ?? 0, remote.processingEpoch);
        let paused =
          previous?.state === 'verification_required' &&
          previous.verificationReason === 'consent_contract_mismatch' &&
          previous.processingEpoch === mismatchEpoch
            ? previous
            : await pauseForVerification({
                fence,
                previous,
                processingEpoch: mismatchEpoch,
                localCleanupComplete: false,
                reason: 'consent_contract_mismatch',
              });
        previous = paused;
        if (!paused.localCleanupComplete) {
          await clearHealthPurposeLocalDataForFence(fence);
          paused = await writeLocal(fence, {
            ...verificationInput({ ownerUserId, previous: paused }),
            localCleanupComplete: true,
          });
        }
        return paused;
      }

      if (previous !== null && remote.processingEpoch < previous.processingEpoch) {
        let paused = await pauseForVerification({
          fence,
          previous,
          processingEpoch: previous.processingEpoch,
          localCleanupComplete: false,
          reason: 'processing_epoch_changed',
        });
        previous = paused;
        await clearHealthPurposeLocalDataForFence(fence);
        paused = await writeLocal(fence, {
          ...verificationInput({ ownerUserId, previous: paused }),
          localCleanupComplete: true,
        });
        return paused;
      }

      const resumesSameActiveEpoch =
        previous !== null && verificationCanResumeActiveEpoch(previous, remote.processingEpoch);
      const mustClearPriorEpoch =
        previous === null ||
        remote.processingEpoch > previous.processingEpoch ||
        (previous.state === 'verification_required' &&
          ((verificationRequiresLocalCleanup(previous) && !previous.localCleanupComplete) ||
            (previous.verificationReason === 'status_unavailable' && !resumesSameActiveEpoch)));
      if (mustClearPriorEpoch) {
        const paused = await pauseForVerification({
          fence,
          previous,
          processingEpoch: remote.processingEpoch,
          localCleanupComplete: false,
          reason: 'processing_epoch_changed',
        });
        previous = paused;
        await clearHealthPurposeLocalDataForFence(fence);
        await synchronizeCurrentConsentCache(fence, remote);
        return adoptRemote(fence, remote, paused);
      }
      // A bounded status outage is a read/write fence, not a deletion signal.
      // The branch above clears only when the returning authority is not the
      // exact same active epoch. Same-epoch proof resumes preserved data here.
      await synchronizeCurrentConsentCache(fence, remote);
      return adoptRemote(fence, remote, previous);
    }

    if (
      (remote.state === 'withdrawing' || remote.state === 'withdrawn') &&
      previous !== null &&
      remote.processingEpoch !== previous.processingEpoch
    ) {
      // A non-active authority at another epoch is never an ordinary status
      // outage. Fence and clear the local profile first. A newer withdrawal
      // can then be adopted from the verification state; a lower server epoch
      // remains locked at the monotonic local epoch for operator recovery.
      const conflictEpoch = Math.max(previous.processingEpoch, remote.processingEpoch);
      let paused =
        previous.state === 'verification_required' &&
        previous.verificationReason === 'processing_epoch_changed' &&
        previous.processingEpoch === conflictEpoch &&
        previous.verificationResumeState === remote.state
          ? previous
          : await pauseForVerification({
              fence,
              previous,
              processingEpoch: conflictEpoch,
              localCleanupComplete: false,
              reason: 'processing_epoch_changed',
              resumeState: remote.state,
            });
      previous = paused;
      if (!paused.localCleanupComplete) {
        await clearHealthPurposeLocalDataForFence(fence);
        paused = await writeLocal(fence, {
          ...verificationInput({ ownerUserId, previous: paused }),
          localCleanupComplete: true,
        });
      }
      previous = paused;
      if (remote.processingEpoch < conflictEpoch) return paused;
      return adoptRemote(fence, remote, paused);
    }

    if (
      remote.state === 'unconsented' &&
      previous !== null &&
      previous.processingEpoch > remote.processingEpoch
    ) {
      // A server-side revocation or inconsistent downgrade can never leave the
      // old local profile live. Keep the monotonic local epoch as a locked
      // recovery record after cleanup instead of manufacturing epoch zero.
      let paused =
        previous.state === 'verification_required' &&
        previous.verificationReason === 'authoritative_unconsented'
          ? previous
          : await pauseForVerification({
              fence,
              previous,
              localCleanupComplete: false,
              reason: 'authoritative_unconsented',
            });
      previous = paused;
      if (!paused.localCleanupComplete) {
        await clearHealthPurposeLocalDataForFence(fence);
        paused = await writeLocal(fence, {
          ...verificationInput({ ownerUserId, previous: paused }),
          localCleanupComplete: true,
        });
      }
      previous = paused;
      return paused;
    }

    if (
      remote.state === 'unconsented' &&
      (previous === null ||
        (previous.state === 'verification_required' && !previous.localCleanupComplete))
    ) {
      // A missing lifecycle record is not an absence proof. Legacy installs
      // may still contain a profile, shelf, routines, photos, or deferred
      // writes even though the authoritative ledger is epoch-zero. Fence and
      // clear them before the consent route or an epoch-one grant can mount.
      let paused = await pauseForVerification({
        fence,
        previous,
        processingEpoch: 0,
        localCleanupComplete: false,
        reason: 'authoritative_unconsented',
      });
      previous = paused;
      await clearHealthPurposeLocalDataForFence(fence);
      return adoptRemote(fence, remote, paused);
    }

    return adoptRemote(fence, remote, previous);
  } catch (error) {
    if (isAccountGenerationLeaseError(error)) throw error;
    assertOwnerWorkflowFence(fence);
    const code = error instanceof Error ? error.message : '';
    const reason: HealthDataVerificationReason | undefined =
      code === HEALTH_DATA_LIFECYCLE_LOCAL_OWNER_UNAVAILABLE ||
      code === 'HEALTH_DATA_LIFECYCLE_OWNER_MISMATCH'
        ? 'owner_unavailable'
        : undefined;
    try {
      return await pauseForVerification({ fence, previous, reason });
    } catch (pauseError) {
      if (isAccountGenerationLeaseError(pauseError)) throw pauseError;
      assertOwnerWorkflowFence(fence);
      return verificationRequiredRecord({ ownerUserId, previous, reason });
    }
  }
}

export function reconcileHealthDataLifecycle(
  ownerUserId: string,
): Promise<HealthDataLifecycleRecord> {
  const fence = captureOwnerWorkflowFence(ownerUserId);
  return reconcileHealthDataLifecycleForFence(fence).then(async (result) => {
    if (result.state === 'withdrawn' && result.localCleanupComplete) {
      await clearDependentWithdrawalRecoveryAfterTerminal(fence, result);
    }
    return result;
  });
}

/**
 * The server ledger is the consent authority. Once status proves the exact
 * current version/hash, mirror that proof into the encrypted local cache used
 * by onboarding persistence; never create it before authoritative proof.
 */
async function synchronizeCurrentConsentCache(
  fence: OwnerWorkflowFence,
  remote: RemoteHealthDataLifecycle,
): Promise<void> {
  await runOwnerBoundLocalOperation(fence, () =>
    synchronizeAuthoritativeHealthDataCollectionConsent({
      version: remote.consentVersion,
      consentTextHash: remote.consentTextHash,
    }),
  );
}

async function recordLocalWithdrawalChoice(fence: OwnerWorkflowFence): Promise<void> {
  await runOwnerBoundLocalOperation(fence, () =>
    setHealthDataCollectionConsentLocal({
      granted: false,
      version: HEALTH_DATA_WITHDRAWAL.version,
      consentText: HEALTH_DATA_WITHDRAWAL.fullText,
    }),
  );
}

type KeyedPendingHealthWithdrawalIntent = PendingHealthWithdrawalIntent &
  Readonly<{ idempotencyKey: string }>;

function pendingIdempotencyKey(intent: PendingHealthWithdrawalIntent): string {
  if (intent.idempotencyKey === null) {
    throw new Error('HEALTH_DATA_WITHDRAWAL_PENDING_MISSING');
  }
  return intent.idempotencyKey;
}

async function ensureWithdrawalIdempotencyKey(params: {
  fence: OwnerWorkflowFence;
  current: HealthDataLifecycleRecord;
  pending: PendingHealthWithdrawalIntent | null;
}): Promise<{
  current: HealthDataLifecycleRecord;
  pending: KeyedPendingHealthWithdrawalIntent;
}> {
  let pending = params.pending;
  if (pending === null) {
    pending = await preparePending({
      fence: params.fence,
      processingEpoch: params.current.processingEpoch,
      idempotencyKey: params.current.idempotencyKey,
    });
  }
  if (pending.processingEpoch !== params.current.processingEpoch) {
    throw new Error('HEALTH_DATA_WITHDRAWAL_PENDING_MISMATCH');
  }
  if (pending.idempotencyKey === null) {
    const generatedKey = await runOwnerBoundLocalOperation(params.fence, () =>
      createHealthWithdrawalIdempotencyKey(),
    );
    pending = await updatePending(params.fence, pending, {
      idempotencyKey: generatedKey,
    });
  }
  if (pending.idempotencyKey === null) {
    throw new Error('HEALTH_DATA_WITHDRAWAL_PENDING_MISSING');
  }
  const keyedPending = pending as KeyedPendingHealthWithdrawalIntent;
  let current = params.current;
  if (
    current.state !== 'withdrawing' ||
    current.idempotencyKey !== keyedPending.idempotencyKey ||
    current.operationId !== keyedPending.operationId ||
    current.localCleanupComplete !== keyedPending.localCleanupComplete
  ) {
    current = await writeLocal(params.fence, {
      ownerUserId: params.fence.ownerUserId,
      state: 'withdrawing',
      processingEpoch: keyedPending.processingEpoch,
      operationId: keyedPending.operationId,
      idempotencyKey: keyedPending.idempotencyKey,
      localCleanupComplete: keyedPending.localCleanupComplete,
      activationRoutePending: false,
      ...NO_VERIFICATION,
      serverVerifiedAt: current.serverVerifiedAt,
    });
  }
  return { current, pending: keyedPending };
}

async function completePurposeLimitedLocalCleanup(params: {
  fence: OwnerWorkflowFence;
  current: HealthDataLifecycleRecord;
  pending: PendingHealthWithdrawalIntent | null;
}): Promise<{
  current: HealthDataLifecycleRecord;
  pending: PendingHealthWithdrawalIntent | null;
}> {
  await recordLocalWithdrawalChoice(params.fence);
  await clearHealthPurposeLocalDataForFence(params.fence);
  const pending = params.pending
    ? await updatePending(params.fence, params.pending, { localCleanupComplete: true })
    : null;
  const current = await writeLocal(params.fence, {
    ownerUserId: params.fence.ownerUserId,
    state: params.current.state,
    processingEpoch: params.current.processingEpoch,
    operationId: params.current.operationId,
    idempotencyKey: params.current.idempotencyKey,
    localCleanupComplete: true,
    activationRoutePending: false,
    ...NO_VERIFICATION,
    serverVerifiedAt: params.current.serverVerifiedAt,
  });
  return { current, pending };
}

export async function beginHealthDataConsentWithdrawal(
  ownerUserId: string,
): Promise<HealthDataLifecycleRecord> {
  const { fence, ownerBinding, processingEpoch } = beginConfirmedWithdrawalInterlock(ownerUserId);

  // This is intentionally the first fallible/awaited operation. The active
  // lease carries the already-validated pseudonymous owner binding, so no
  // private read, digest, random-key request, cleanup, or transport can precede
  // the process-death recovery marker.
  let pending = await preparePendingHealthWithdrawalIntentByOwnerBinding({
    ownerBinding,
    processingEpoch,
  });
  assertOwnerWorkflowFence(fence);

  let current = await readLocal(fence);
  if (
    current?.state !== 'active' ||
    current.processingEpoch !== processingEpoch ||
    current.processingEpoch < 1
  ) {
    throw new Error('HEALTH_DATA_WITHDRAWAL_NOT_ACTIVE');
  }
  current = await writeLocal(fence, {
    ownerUserId,
    state: 'withdrawing',
    processingEpoch: current.processingEpoch,
    operationId: pending.operationId,
    idempotencyKey: pending.idempotencyKey,
    localCleanupComplete: pending.localCleanupComplete,
    activationRoutePending: false,
    ...NO_VERIFICATION,
    serverVerifiedAt: current.serverVerifiedAt,
  });
  ({ current, pending } = await ensureWithdrawalIdempotencyKey({
    fence,
    current,
    pending,
  }));

  if (!current.localCleanupComplete) {
    const cleaned = await completePurposeLimitedLocalCleanup({
      fence,
      current,
      pending,
    });
    if (!cleaned.pending) throw new Error('HEALTH_DATA_WITHDRAWAL_PENDING_MISSING');
    current = cleaned.current;
    pending = cleaned.pending;
  }

  // Intake is deliberately after bounded local cleanup. A hung or ambiguous
  // network request can therefore never keep health-purpose bytes live.
  if (!isSupabaseConfigured) {
    const terminal = await writeLocal(fence, {
      ownerUserId,
      state: 'withdrawn',
      processingEpoch: current.processingEpoch,
      operationId: current.operationId,
      idempotencyKey: null,
      localCleanupComplete: true,
      activationRoutePending: false,
      ...NO_VERIFICATION,
      serverVerifiedAt: null,
    });
    await clearDependentWithdrawalRecoveryAfterTerminal(fence, terminal);
    if (pending) await clearPending(fence, pending);
    return terminal;
  }

  const remote = await runRemoteForFence(fence, () =>
    beginRemoteHealthDataWithdrawal({
      ownerUserId,
      expectedProcessingEpoch: current.processingEpoch,
      idempotencyKey: pendingIdempotencyKey(pending),
    }),
  );
  if (remote.operationId !== null) {
    pending = await updatePending(fence, pending, { operationId: remote.operationId });
  }
  const adopted = await adoptRemote(fence, remote, current);
  if (adopted.state === 'withdrawn' && adopted.localCleanupComplete) {
    await clearDependentWithdrawalRecoveryAfterTerminal(fence, adopted);
    await clearPending(fence, pending);
  }
  return adopted;
}

export async function resumeHealthDataConsentWithdrawal(
  ownerUserId: string,
  options: { expectedInterruptedProcessingEpoch?: number } = {},
): Promise<HealthDataLifecycleRecord> {
  const fence = captureOwnerWorkflowFence(ownerUserId, true);
  await closeProcessingEpochImmediately(fence);
  let pending = await readPending(fence);
  let current = await readLocal(fence);
  if (!current || current.state === 'verification_required' || pending) {
    current = await reconcileHealthDataLifecycleForFence(fence);
    pending = await readPending(fence);
  }

  if (
    current.state === 'active' &&
    pending === null &&
    options.expectedInterruptedProcessingEpoch === current.processingEpoch
  ) {
    // The mounted shell can outlive a failed first journal write. Preserve its
    // explicit, exact-epoch user action and retry the durable boundary before
    // any random, cleanup, or remote work. Ordinary reconciliation never
    // supplies this capability and therefore cannot turn an active grant into
    // a withdrawal by itself.
    pending = await preparePending({
      fence,
      processingEpoch: current.processingEpoch,
      idempotencyKey: null,
    });
    current = await writeLocal(fence, {
      ownerUserId,
      state: 'withdrawing',
      processingEpoch: current.processingEpoch,
      operationId: pending.operationId,
      idempotencyKey: pending.idempotencyKey,
      localCleanupComplete: pending.localCleanupComplete,
      activationRoutePending: false,
      ...NO_VERIFICATION,
      serverVerifiedAt: current.serverVerifiedAt,
    });
  }

  if (current.state === 'withdrawn' && current.localCleanupComplete) {
    await clearDependentWithdrawalRecoveryAfterTerminal(fence, current);
    if (pending) await clearPending(fence, pending);
    releaseClosedIntent(fence);
    return current;
  }
  if (current.state === 'withdrawn') {
    await recordLocalWithdrawalChoice(fence);
    await clearHealthPurposeLocalDataForFence(fence);
    const terminal = await writeLocal(fence, {
      ownerUserId,
      state: 'withdrawn',
      processingEpoch: current.processingEpoch,
      operationId: current.operationId,
      idempotencyKey: null,
      localCleanupComplete: true,
      activationRoutePending: false,
      ...NO_VERIFICATION,
      serverVerifiedAt: current.serverVerifiedAt,
    });
    await clearDependentWithdrawalRecoveryAfterTerminal(fence, terminal);
    if (pending) await clearPending(fence, pending);
    return terminal;
  }
  if (current.state !== 'withdrawing') throw new Error('HEALTH_DATA_WITHDRAWAL_NOT_ACTIVE');
  ({ current, pending } = await ensureWithdrawalIdempotencyKey({
    fence,
    current,
    pending,
  }));
  if (
    pending &&
    (pending.processingEpoch !== current.processingEpoch ||
      pending.idempotencyKey !== current.idempotencyKey)
  ) {
    throw new Error('HEALTH_DATA_WITHDRAWAL_PENDING_MISMATCH');
  }

  if (!current.localCleanupComplete) {
    ({ current, pending } = await completePurposeLimitedLocalCleanup({
      fence,
      current,
      pending,
    }));
  } else {
    await recordLocalWithdrawalChoice(fence);
  }

  if (!isSupabaseConfigured) {
    const terminal = await writeLocal(fence, {
      ownerUserId,
      state: 'withdrawn',
      processingEpoch: current.processingEpoch,
      operationId: current.operationId,
      idempotencyKey: null,
      localCleanupComplete: true,
      activationRoutePending: false,
      ...NO_VERIFICATION,
      serverVerifiedAt: null,
    });
    await clearDependentWithdrawalRecoveryAfterTerminal(fence, terminal);
    if (pending) await clearPending(fence, pending);
    return terminal;
  }

  const remote = await runRemoteForFence(fence, () =>
    current.idempotencyKey
      ? beginRemoteHealthDataWithdrawal({
          ownerUserId,
          expectedProcessingEpoch: current.processingEpoch,
          idempotencyKey: current.idempotencyKey,
        })
      : retryRemoteHealthDataWithdrawal(ownerUserId),
  );
  if (pending && remote.operationId !== null) {
    pending = await updatePending(fence, pending, { operationId: remote.operationId });
  }
  const adopted = await adoptRemote(fence, remote, current);
  if (pending && adopted.state === 'withdrawn' && adopted.localCleanupComplete) {
    await clearDependentWithdrawalRecoveryAfterTerminal(fence, adopted);
    await clearPending(fence, pending);
  }
  return adopted;
}

export async function grantAuthoritativeHealthDataConsent(params: {
  ownerUserId: string;
  expectedProcessingEpoch: number;
}): Promise<HealthDataLifecycleRecord> {
  assertHealthDataConsentCopyReleaseAllowed('grant', env.appEnvironment);
  const fence = captureOwnerWorkflowFence(params.ownerUserId);
  const local = await readLocal(fence);
  if (
    local === null ||
    local.processingEpoch !== params.expectedProcessingEpoch ||
    !local.localCleanupComplete
  ) {
    throw new Error('HEALTH_DATA_RECONSENT_LOCAL_STATE_INCOMPATIBLE');
  }
  const configuredGrantable =
    local.state === 'unconsented' || local.state === 'withdrawn' || local.state === 'active';
  const localOnlyGrantable =
    configuredGrantable ||
    (local.state === 'verification_required' && verificationRequiresLocalCleanup(local));
  if (isSupabaseConfigured ? !configuredGrantable : !localOnlyGrantable) {
    // A configured verification record may preserve an active epoch, describe
    // a server downgrade, or carry a consent contract the grant RPC rejects.
    // Only authoritative unconsented/terminal-withdrawn (or an already-active
    // exact-contract refresh) is compatible with the server grant transition.
    throw new Error('HEALTH_DATA_RECONSENT_SERVER_STATE_INCOMPATIBLE');
  }
  let epoch: number;
  let serverVerifiedAt: string | null = null;
  if (isSupabaseConfigured) {
    const remote = await runRemoteForFence(fence, () =>
      grantRemoteHealthDataConsent(params.ownerUserId, params.expectedProcessingEpoch),
    );
    const contractMatches = await runOwnerBoundLocalOperation(fence, () =>
      remoteHealthDataConsentMatchesCurrentContract(remote),
    );
    if (
      remote.ownerUserId !== params.ownerUserId ||
      remote.state !== 'active' ||
      !contractMatches
    ) {
      throw new Error('HEALTH_DATA_RECONSENT_REJECTED');
    }
    epoch = remote.processingEpoch;
    serverVerifiedAt = remote.serverVerifiedAt;
  } else {
    epoch = params.expectedProcessingEpoch + 1;
  }

  await runOwnerBoundLocalOperation(fence, () =>
    setHealthDataCollectionConsentLocal({
      granted: true,
      version: HEALTH_DATA_CONSENT.version,
      consentText: HEALTH_DATA_CONSENT.fullText,
    }),
  );
  return writeLocal(fence, {
    ownerUserId: params.ownerUserId,
    state: 'active',
    processingEpoch: epoch,
    operationId: null,
    idempotencyKey: null,
    localCleanupComplete: true,
    activationRoutePending: activationRoutePendingForActive(local, epoch),
    ...NO_VERIFICATION,
    serverVerifiedAt,
  });
}

/**
 * Durably acknowledges that the empty goals route has committed. The active
 * process lease is deliberately published only after the pending bit is
 * cleared, so a crash or failed private-store write leaves every health read
 * and write fenced on the next launch as well as in the current process.
 */
export async function completeHealthDataActivationRoute(params: {
  ownerUserId: string;
  expectedProcessingEpoch: number;
}): Promise<HealthDataLifecycleRecord> {
  const fence = captureOwnerWorkflowFence(params.ownerUserId);
  let current = await readLocal(fence);
  if (
    current === null ||
    current.state !== 'active' ||
    current.processingEpoch !== params.expectedProcessingEpoch
  ) {
    await closeProcessingEpochImmediately(fence);
    throw new Error('HEALTH_DATA_ACTIVATION_ROUTE_STATE_INCOMPATIBLE');
  }
  if (current.activationRoutePending) {
    current = await writeLocal(fence, {
      ownerUserId: current.ownerUserId,
      state: current.state,
      processingEpoch: current.processingEpoch,
      operationId: current.operationId,
      idempotencyKey: current.idempotencyKey,
      localCleanupComplete: current.localCleanupComplete,
      activationRoutePending: false,
      ...NO_VERIFICATION,
      serverVerifiedAt: current.serverVerifiedAt,
    });
  } else {
    await applyProcessingEpoch(fence, current);
  }
  return current;
}

export async function declineAuthoritativeInitialHealthDataConsent(
  ownerUserId: string,
): Promise<HealthDataLifecycleRecord> {
  const fence = captureOwnerWorkflowFence(ownerUserId, true);
  await closeProcessingEpochImmediately(fence);
  let serverVerifiedAt: string | null = null;
  if (isSupabaseConfigured) {
    const remote = await runRemoteForFence(fence, () =>
      declineRemoteInitialHealthDataConsent(ownerUserId),
    );
    if (remote.ownerUserId !== ownerUserId || remote.state !== 'unconsented') {
      throw new Error('HEALTH_DATA_DECLINE_REJECTED');
    }
    serverVerifiedAt = remote.serverVerifiedAt;
  }
  await runOwnerBoundLocalOperation(fence, () =>
    setHealthDataCollectionConsentLocal({
      granted: false,
      version: HEALTH_DATA_CONSENT.version,
      consentText: HEALTH_DATA_CONSENT.declineText,
    }),
  );
  return writeLocal(fence, {
    ownerUserId,
    state: 'unconsented',
    processingEpoch: 0,
    operationId: null,
    idempotencyKey: null,
    localCleanupComplete: true,
    activationRoutePending: false,
    ...NO_VERIFICATION,
    serverVerifiedAt,
  });
}
