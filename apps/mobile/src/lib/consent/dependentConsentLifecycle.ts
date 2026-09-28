import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { env, isSupabaseConfigured } from '@/lib/env';

import {
  assertHealthDependentConsentCopyReleaseAllowed,
  consentCopyFor,
  createConsentIdempotencyKey,
  type HealthDependentConsentType,
} from './dependentConsentContract';
import {
  getHealthDependentConsentStatus,
  recordConsent,
  type HealthDependentConsentStatus,
} from './consent';
import {
  assertClosedHealthDependentConsentLease,
  assertHealthDependentConsentLease,
  beginHealthDependentConsentCheck,
  beginHealthDependentConsentGrant,
  closeCheckedHealthDependentConsent,
  closeHealthDependentConsent,
  publishHealthDependentConsentActive,
  type HealthDependentConsentLease,
} from './dependentConsentLease';
import {
  clearDependentConsentWithdrawalTombstone,
  type DependentConsentWithdrawalTombstone,
  readDependentConsentWithdrawalTombstone,
  readLocalDependentConsentReceipt,
  removeLocalDependentConsentReceipt,
  writeDependentConsentWithdrawalTombstone,
  writeLocalDependentConsentReceipt,
} from './dependentConsentLocal';
import {
  HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_PENDING,
  withdrawConsent,
} from './withdrawal';

export { HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_PENDING } from './withdrawal';
export const HEALTH_DEPENDENT_CONSENT_LOCAL_CLEANUP_FAILED =
  'HEALTH_DEPENDENT_CONSENT_LOCAL_CLEANUP_FAILED';
export const HEALTH_DEPENDENT_CONSENT_ACTIVE_WITHDRAWAL_REQUIRED =
  'HEALTH_DEPENDENT_CONSENT_ACTIVE_WITHDRAWAL_REQUIRED';

type LocalOnlyOptions = Readonly<{
  /** Only on-device purposes with no disclosure transport may use this lane. */
  allowExactLocalReceiptWhenUnconfigured?: boolean;
  /** Purpose-specific deletion run after an authoritative remote close. */
  deleteLocalOnAuthoritativeClose?: () => Promise<void>;
}>;

function assertAccountMatches(
  accountLease: { generation: number; assertCurrent: () => void },
  dependentLease: HealthDependentConsentLease,
): void {
  accountLease.assertCurrent();
  if (accountLease.generation !== dependentLease.accountGeneration) {
    throw new Error('HEALTH_DEPENDENT_CONSENT_OWNER_CHANGED');
  }
}

function closeIfStillCurrent(lease: HealthDependentConsentLease): void {
  try {
    closeCheckedHealthDependentConsent(lease);
  } catch {
    // A later grant/withdrawal owns the process slot. Never overwrite it from
    // an older continuation.
  }
}

async function cleanClosedLocalPurpose(
  type: HealthDependentConsentType,
  deleteLocal?: () => Promise<void>,
): Promise<void> {
  const cleanup = await Promise.allSettled([
    removeLocalDependentConsentReceipt(type),
    deleteLocal?.() ?? Promise.resolve(),
  ]);
  if (cleanup.some((result) => result.status === 'rejected')) {
    throw new Error(HEALTH_DEPENDENT_CONSENT_LOCAL_CLEANUP_FAILED);
  }
}

async function reconcilePendingWithdrawalAfterCleanup(params: {
  accountLease: { generation: number; assertCurrent: () => void };
  closed: HealthDependentConsentLease;
  tombstone: DependentConsentWithdrawalTombstone;
  remote: HealthDependentConsentStatus;
}): Promise<void> {
  const { accountLease, closed, remote } = params;
  let { tombstone } = params;
  assertAccountMatches(accountLease, closed);
  assertClosedHealthDependentConsentLease(closed);

  if (tombstone.state === 'withdrawn') {
    // A strictly newer exact active generation is a fresh cross-device grant,
    // not the pre-withdrawal receipt. Clear only the local barrier; the next
    // gate run will establish a new process lease from that server status.
    const terminalGeneration =
      tombstone.expectedConsentGeneration === null
        ? tombstone.observedConsentGeneration
        : tombstone.expectedConsentGeneration + 1;
    if (
      remote.state === 'active' &&
      terminalGeneration !== null &&
      remote.generation > terminalGeneration
    ) {
      await clearDependentConsentWithdrawalTombstone(closed.ownerUserId, closed.type);
    }
    return;
  }

  let expectedGeneration = tombstone.expectedConsentGeneration;
  const persist = async (changes: {
    state?: 'pending' | 'withdrawn';
    resumeMode?: 'local_intent' | 'poll_only';
    expectedConsentGeneration?: number | null;
    observedConsentGeneration?: number | null;
  }): Promise<DependentConsentWithdrawalTombstone> => {
    tombstone = await writeDependentConsentWithdrawalTombstone({
      ownerUserId: closed.ownerUserId,
      type: closed.type,
      state: changes.state ?? tombstone.state,
      authority: tombstone.authority,
      resumeMode: changes.resumeMode ?? tombstone.resumeMode,
      healthEpoch: closed.healthEpoch,
      expectedConsentGeneration:
        changes.expectedConsentGeneration === undefined
          ? tombstone.expectedConsentGeneration
          : changes.expectedConsentGeneration,
      observedConsentGeneration:
        changes.observedConsentGeneration === undefined
          ? tombstone.observedConsentGeneration
          : changes.observedConsentGeneration,
      idempotencyKey: tombstone.idempotencyKey,
      requestedAt: tombstone.requestedAt,
    });
    return tombstone;
  };

  if (remote.state === 'unconsented') {
    // A remote-required withdrawal can never resolve to the never-consented
    // generation-zero state. Preserve the capability and fail closed.
    return;
  }

  if (expectedGeneration !== null) {
    if (remote.state === 'withdrawn') {
      if (remote.generation !== expectedGeneration + 1) return;
      await persist({ state: 'withdrawn', observedConsentGeneration: remote.generation });
      return;
    }
    if (remote.state === 'active') {
      if (remote.generation >= expectedGeneration + 2) {
        // The old withdrawal completed and a fresh exact grant won. Retire the
        // old capability; never apply it to the newer generation.
        await clearDependentConsentWithdrawalTombstone(closed.ownerUserId, closed.type);
        return;
      }
      if (remote.generation !== expectedGeneration) return;
    } else if (remote.generation !== expectedGeneration + 1) {
      return;
    }
  } else if (tombstone.resumeMode === 'poll_only') {
    if (remote.state === 'active') {
      if (
        tombstone.observedConsentGeneration !== null &&
        remote.generation > tombstone.observedConsentGeneration
      ) {
        await clearDependentConsentWithdrawalTombstone(closed.ownerUserId, closed.type);
      }
      return;
    }
    if (remote.state === 'withdrawing') {
      if (tombstone.observedConsentGeneration === null) {
        await persist({ observedConsentGeneration: remote.generation });
      }
      return;
    }
    if (
      tombstone.observedConsentGeneration !== null &&
      remote.generation !== tombstone.observedConsentGeneration
    ) {
      return;
    }
    await persist({ state: 'withdrawn', observedConsentGeneration: remote.generation });
    return;
  } else if (remote.state === 'active') {
    expectedGeneration = remote.generation;
    await persist({
      expectedConsentGeneration: expectedGeneration,
      observedConsentGeneration: remote.generation,
    });
  } else if (remote.state === 'withdrawing') {
    await persist({
      resumeMode: 'poll_only',
      observedConsentGeneration: remote.generation,
    });
    return;
  } else {
    await persist({ state: 'withdrawn', observedConsentGeneration: remote.generation });
    return;
  }

  if (expectedGeneration === null) return;

  try {
    const copy = consentCopyFor(closed.type, 'withdrawal');
    const attestation = await withdrawConsent({
      type: closed.type,
      version: copy.version,
      consentText: copy.text,
      expectedUserId: closed.ownerUserId,
      expectedProcessingEpoch: closed.healthEpoch,
      expectedConsentGeneration: expectedGeneration,
      idempotencyKey: tombstone.idempotencyKey,
    });
    assertAccountMatches(accountLease, closed);
    assertClosedHealthDependentConsentLease(closed);
    if (
      attestation.consentType !== closed.type ||
      attestation.processingEpoch !== closed.healthEpoch ||
      attestation.consentGeneration !== expectedGeneration + 1
    ) {
      return;
    }
    await persist({
      state: 'withdrawn',
      expectedConsentGeneration: expectedGeneration,
      observedConsentGeneration: expectedGeneration + 1,
    });
  } catch {
    // Gate reconciliation is fail-closed. The durable capability remains for a
    // future startup retry; user-initiated withdrawal still surfaces errors.
    assertAccountMatches(accountLease, closed);
    assertClosedHealthDependentConsentLease(closed);
  }
}

/**
 * Resolve one gate from an exact server status, or from a full local receipt
 * only when the feature is truly on-device and the backend is unconfigured.
 */
export function isHealthDependentConsentActive(
  type: HealthDependentConsentType,
  options: LocalOnlyOptions = {},
): Promise<boolean> {
  const dependentLease = beginHealthDependentConsentCheck(type);
  return runAccountGenerationOperation(async (accountLease) => {
    try {
      assertAccountMatches(accountLease, dependentLease);
      assertHealthDependentConsentLease(dependentLease, 'checking');

      let tombstone;
      try {
        tombstone = await readDependentConsentWithdrawalTombstone(
          dependentLease.ownerUserId,
          type,
        );
      } catch {
        closeIfStillCurrent(dependentLease);
        return false;
      }
      assertAccountMatches(accountLease, dependentLease);
      assertHealthDependentConsentLease(dependentLease, 'checking');
      if (tombstone !== null) {
        const closed = closeCheckedHealthDependentConsent(dependentLease);
        await cleanClosedLocalPurpose(type, options.deleteLocalOnAuthoritativeClose);
        assertAccountMatches(accountLease, closed);
        assertClosedHealthDependentConsentLease(closed);
        if (tombstone.authority === 'local_only') {
          await clearDependentConsentWithdrawalTombstone(closed.ownerUserId, type);
          assertAccountMatches(accountLease, closed);
          assertClosedHealthDependentConsentLease(closed);
          return false;
        }
        // A second device may only learn terminal completion on its next run.
        // Poll after deletion so an old server `active` can never republish.
        if (isSupabaseConfigured) {
          try {
            const remote = await getHealthDependentConsentStatus(type);
            assertAccountMatches(accountLease, closed);
            assertClosedHealthDependentConsentLease(closed);
            await reconcilePendingWithdrawalAfterCleanup({
              accountLease,
              closed,
              tombstone,
              remote,
            });
          } catch {
            assertAccountMatches(accountLease, closed);
            assertClosedHealthDependentConsentLease(closed);
          }
        }
        return false;
      }

      if (isSupabaseConfigured) {
        let status: HealthDependentConsentStatus;
        try {
          status = await getHealthDependentConsentStatus(type);
        } catch {
          assertAccountMatches(accountLease, dependentLease);
          assertHealthDependentConsentLease(dependentLease, 'checking');
          closeIfStillCurrent(dependentLease);
          return false;
        }
        assertAccountMatches(accountLease, dependentLease);
        assertHealthDependentConsentLease(dependentLease, 'checking');
        if (status.state !== 'active') {
          const closed = closeCheckedHealthDependentConsent(dependentLease);
          assertAccountMatches(accountLease, closed);
          assertClosedHealthDependentConsentLease(closed);
          if (status.state !== 'unconsented') {
            const idempotencyKey = await createConsentIdempotencyKey();
            assertAccountMatches(accountLease, closed);
            assertClosedHealthDependentConsentLease(closed);
            await writeDependentConsentWithdrawalTombstone({
              ownerUserId: closed.ownerUserId,
              type,
              state: status.state === 'withdrawn' ? 'withdrawn' : 'pending',
              authority: 'remote_required',
              resumeMode: 'poll_only',
              healthEpoch: closed.healthEpoch,
              // A cross-device in-progress operation cannot be adopted with a
              // new key. Null means poll-only until it reaches terminal state.
              expectedConsentGeneration:
                status.state === 'withdrawing' ? null : Math.max(0, status.generation - 1),
              observedConsentGeneration: status.generation,
              idempotencyKey,
              requestedAt: new Date().toISOString(),
            });
            assertAccountMatches(accountLease, closed);
            assertClosedHealthDependentConsentLease(closed);
          }
          await cleanClosedLocalPurpose(type, options.deleteLocalOnAuthoritativeClose);
          assertAccountMatches(accountLease, closed);
          assertClosedHealthDependentConsentLease(closed);
          return false;
        }
        publishHealthDependentConsentActive({
          lease: dependentLease,
          serverGeneration: status.generation,
        });
        return true;
      }

      if (options.allowExactLocalReceiptWhenUnconfigured === true) {
        try {
          const receipt = await readLocalDependentConsentReceipt(dependentLease);
          assertAccountMatches(accountLease, dependentLease);
          assertHealthDependentConsentLease(dependentLease, 'checking');
          if (receipt !== null && receipt.serverGeneration === null) {
            publishHealthDependentConsentActive({
              lease: dependentLease,
              serverGeneration: null,
              localOnly: true,
            });
            return true;
          }
        } catch {
          assertAccountMatches(accountLease, dependentLease);
        }
      }

      closeIfStillCurrent(dependentLease);
      return false;
    } catch (error) {
      closeIfStillCurrent(dependentLease);
      throw error;
    }
  });
}

/** Exact status-generation CAS before any configured local grant publication. */
export function grantHealthDependentConsent(
  type: HealthDependentConsentType,
  options: LocalOnlyOptions = {},
): Promise<void> {
  assertHealthDependentConsentCopyReleaseAllowed(type, 'grant', env.appEnvironment);
  const dependentLease = beginHealthDependentConsentGrant(type);
  return runAccountGenerationOperation(async (accountLease) => {
    let localReceiptWritten = false;
    try {
      assertAccountMatches(accountLease, dependentLease);
      assertHealthDependentConsentLease(dependentLease, 'granting');
      const tombstone = await readDependentConsentWithdrawalTombstone(
        dependentLease.ownerUserId,
        type,
      );
      assertAccountMatches(accountLease, dependentLease);
      assertHealthDependentConsentLease(dependentLease, 'granting');
      if (tombstone?.state === 'pending') {
        throw new Error(HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_PENDING);
      }

      let serverGeneration: number | null = null;
      if (isSupabaseConfigured) {
        try {
          const before = await getHealthDependentConsentStatus(type);
          assertAccountMatches(accountLease, dependentLease);
          assertHealthDependentConsentLease(dependentLease, 'granting');
          if (before.state === 'withdrawing') {
            throw new Error(HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_PENDING);
          }
          const idempotencyKey = await createConsentIdempotencyKey();
          assertAccountMatches(accountLease, dependentLease);
          assertHealthDependentConsentLease(dependentLease, 'granting');
          const copy = consentCopyFor(type, 'grant');
          const result = await recordConsent({
            type,
            granted: true,
            version: copy.version,
            consentText: copy.text,
            expectedGeneration: before.generation,
            idempotencyKey,
            expectedUserId: dependentLease.ownerUserId,
          });
          assertAccountMatches(accountLease, dependentLease);
          assertHealthDependentConsentLease(dependentLease, 'granting');
          if (!result || result.consentType !== type || result.state !== 'active') {
            throw new Error('HEALTH_DEPENDENT_CONSENT_STATUS_INVALID');
          }
          serverGeneration = result.generation;
        } catch (error) {
          assertAccountMatches(accountLease, dependentLease);
          assertHealthDependentConsentLease(dependentLease, 'granting');
          throw error;
        }
      } else if (options.allowExactLocalReceiptWhenUnconfigured !== true) {
        throw new Error('CONSENT_BACKEND_UNAVAILABLE');
      }

      await writeLocalDependentConsentReceipt({ lease: dependentLease, serverGeneration });
      localReceiptWritten = true;
      assertAccountMatches(accountLease, dependentLease);
      assertHealthDependentConsentLease(dependentLease, 'granting');
      if (tombstone !== null) {
        await clearDependentConsentWithdrawalTombstone(dependentLease.ownerUserId, type);
        assertAccountMatches(accountLease, dependentLease);
        assertHealthDependentConsentLease(dependentLease, 'granting');
      }
      publishHealthDependentConsentActive({
        lease: dependentLease,
        serverGeneration,
        localOnly: serverGeneration === null,
      });
    } catch (error) {
      if (localReceiptWritten) {
        await removeLocalDependentConsentReceipt(type).catch(() => undefined);
      }
      closeIfStillCurrent(dependentLease);
      throw error;
    }
  });
}

/**
 * Records no revocation claim. This is only the initial-refusal lane: the
 * exact authority must already be off, and any active grant must use the
 * destructive withdrawal lifecycle instead.
 */
export function refuseHealthDependentConsent(params: {
  type: HealthDependentConsentType;
  deleteLocal?: () => Promise<void>;
}): Promise<void> {
  const dependentLease = closeHealthDependentConsent(params.type);
  return runAccountGenerationOperation(async (accountLease) => {
    assertAccountMatches(accountLease, dependentLease);
    assertClosedHealthDependentConsentLease(dependentLease);
    if (!isSupabaseConfigured) throw new Error('CONSENT_BACKEND_UNAVAILABLE');

    const status = await getHealthDependentConsentStatus(params.type);
    assertAccountMatches(accountLease, dependentLease);
    assertClosedHealthDependentConsentLease(dependentLease);
    if (status.state === 'active') {
      throw new Error(HEALTH_DEPENDENT_CONSENT_ACTIVE_WITHDRAWAL_REQUIRED);
    }

    await cleanClosedLocalPurpose(params.type, params.deleteLocal);
    assertAccountMatches(accountLease, dependentLease);
    assertClosedHealthDependentConsentLease(dependentLease);
    if (status.state === 'unconsented') {
      const tombstone = await readDependentConsentWithdrawalTombstone(
        dependentLease.ownerUserId,
        params.type,
      );
      assertAccountMatches(accountLease, dependentLease);
      assertClosedHealthDependentConsentLease(dependentLease);
      if (tombstone !== null) {
        await clearDependentConsentWithdrawalTombstone(
          dependentLease.ownerUserId,
          params.type,
        );
        assertAccountMatches(accountLease, dependentLease);
        assertClosedHealthDependentConsentLease(dependentLease);
      }
    }
  });
}

/**
 * Synchronously closes the purpose and durably records a tombstone. Local
 * deletion and remote intake then run concurrently; terminal local state is
 * published only after both have completed successfully.
 */
export function withdrawHealthDependentConsent(params: {
  type: HealthDependentConsentType;
  deleteLocal?: () => Promise<void>;
}): Promise<void> {
  const dependentLease = closeHealthDependentConsent(params.type);
  return runAccountGenerationOperation(async (accountLease) => {
    assertAccountMatches(accountLease, dependentLease);
    assertClosedHealthDependentConsentLease(dependentLease);

    let existing = await readDependentConsentWithdrawalTombstone(
      dependentLease.ownerUserId,
      params.type,
    );
    assertAccountMatches(accountLease, dependentLease);
    assertClosedHealthDependentConsentLease(dependentLease);
    const idempotencyKey = existing?.idempotencyKey ?? (await createConsentIdempotencyKey());
    assertAccountMatches(accountLease, dependentLease);
    assertClosedHealthDependentConsentLease(dependentLease);
    const requestedAt = existing?.requestedAt ?? new Date().toISOString();
    existing = await writeDependentConsentWithdrawalTombstone({
      ownerUserId: dependentLease.ownerUserId,
      type: params.type,
      state: 'pending',
      authority:
        existing?.authority ??
        (dependentLease.authority === 'local_only' ? 'local_only' : 'remote_required'),
      resumeMode: existing?.resumeMode ?? 'local_intent',
      healthEpoch: dependentLease.healthEpoch,
      expectedConsentGeneration:
        existing?.expectedConsentGeneration ?? dependentLease.serverGeneration,
      observedConsentGeneration:
        existing?.observedConsentGeneration ?? dependentLease.serverGeneration,
      idempotencyKey,
      requestedAt,
    });
    assertAccountMatches(accountLease, dependentLease);
    assertClosedHealthDependentConsentLease(dependentLease);

    const localCleanup = cleanClosedLocalPurpose(params.type, params.deleteLocal);
    const remoteCompletion = (async (): Promise<{
      state: 'local_only' | 'unconsented' | 'withdrawn';
      expectedConsentGeneration: number | null;
    }> => {
      if (existing.authority === 'local_only') {
        return { state: 'local_only', expectedConsentGeneration: null };
      }
      if (!isSupabaseConfigured) throw new Error('CONSENT_BACKEND_UNAVAILABLE');
      let expectedConsentGeneration = existing.expectedConsentGeneration;

      // A locally-held generation/idempotency capability can begin or replay
      // immediately. This is intentionally concurrent with local deletion so
      // a process death during slow cleanup still leaves a server operation.
      if (expectedConsentGeneration === null) {
        const status = await getHealthDependentConsentStatus(params.type);
        assertAccountMatches(accountLease, dependentLease);
        assertClosedHealthDependentConsentLease(dependentLease);
        if (status.state === 'unconsented') {
          return { state: 'unconsented', expectedConsentGeneration: null };
        }
        if (status.state === 'withdrawn') {
          return {
            state: 'withdrawn',
            expectedConsentGeneration: Math.max(0, status.generation - 1),
          };
        }
        if (status.state === 'withdrawing') {
          throw new Error(HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_PENDING);
        }
        expectedConsentGeneration = status.generation;
        existing = await writeDependentConsentWithdrawalTombstone({
          ownerUserId: dependentLease.ownerUserId,
          type: params.type,
          state: 'pending',
          authority: existing.authority,
          resumeMode: existing.resumeMode,
          healthEpoch: dependentLease.healthEpoch,
          expectedConsentGeneration,
          observedConsentGeneration: status.generation,
          idempotencyKey,
          requestedAt,
        });
        assertAccountMatches(accountLease, dependentLease);
        assertClosedHealthDependentConsentLease(dependentLease);
      }

      const copy = consentCopyFor(params.type, 'withdrawal');
      const attestation = await withdrawConsent({
        type: params.type,
        version: copy.version,
        consentText: copy.text,
        expectedUserId: dependentLease.ownerUserId,
        expectedProcessingEpoch: dependentLease.healthEpoch,
        expectedConsentGeneration,
        idempotencyKey,
      });
      assertAccountMatches(accountLease, dependentLease);
      assertClosedHealthDependentConsentLease(dependentLease);
      if (
        attestation.consentType !== params.type ||
        attestation.processingEpoch !== dependentLease.healthEpoch ||
        attestation.consentGeneration !== expectedConsentGeneration + 1
      ) {
        throw new Error('HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_ATTESTATION_INVALID');
      }
      return { state: 'withdrawn', expectedConsentGeneration };
    })();

    const [cleanupResult, remoteResult] = await Promise.allSettled([
      localCleanup,
      remoteCompletion,
    ]);
    assertAccountMatches(accountLease, dependentLease);
    assertClosedHealthDependentConsentLease(dependentLease);
    if (cleanupResult.status === 'rejected') throw cleanupResult.reason;
    if (remoteResult.status === 'rejected') throw remoteResult.reason;

    if (
      remoteResult.value.state === 'local_only' ||
      remoteResult.value.state === 'unconsented'
    ) {
      await clearDependentConsentWithdrawalTombstone(
        dependentLease.ownerUserId,
        params.type,
      );
      assertAccountMatches(accountLease, dependentLease);
      assertClosedHealthDependentConsentLease(dependentLease);
      return;
    }
    const expectedConsentGeneration = remoteResult.value.expectedConsentGeneration;
    if (expectedConsentGeneration === null) {
      throw new Error('HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_GENERATION_MISSING');
    }

    await writeDependentConsentWithdrawalTombstone({
      ownerUserId: dependentLease.ownerUserId,
      type: params.type,
      state: 'withdrawn',
      authority: 'remote_required',
      resumeMode: existing.resumeMode,
      healthEpoch: dependentLease.healthEpoch,
      expectedConsentGeneration,
      observedConsentGeneration: expectedConsentGeneration + 1,
      idempotencyKey,
      requestedAt,
    });
    assertAccountMatches(accountLease, dependentLease);
    assertClosedHealthDependentConsentLease(dependentLease);
  });
}
