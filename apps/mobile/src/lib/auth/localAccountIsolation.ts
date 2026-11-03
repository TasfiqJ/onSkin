import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryClient } from '@tanstack/react-query';
import type { HealthDataWriteLease } from '@/lib/consent/healthDataWriteAdmission';

import {
  shouldClearLocalPrivateDataForSessionChange,
  type LocalDataOwnership,
} from './sessionBoundary';
import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from './accountGeneration';
import { LOCAL_DATA_CLEANUP_REQUIRED_KEY } from './sessionOwnerKey';

const CLEANUP_REQUIRED_VALUE = '1';

type HistoryIntentMarker45 = Readonly<{
  v: 1;
  kind: 'routine-plan-history';
  ownerBinding: string;
  nonce: string;
}>;
export type PlanHistoryMutationIntent45 = Readonly<{ kind: 'history-mutation-capability45' }>;
type HistoryIntentClaim45 = { raw: string | null; active: boolean };
const historyIntentClaims45 = new Set<HistoryIntentClaim45>();
const historyIntentTokens45 = new WeakMap<PlanHistoryMutationIntent45, HistoryIntentClaim45>();
export const LOCAL_DATA_HISTORY_RECOVERY_REQUIRED = 'LOCAL_DATA_HISTORY_RECOVERY_REQUIRED';

/** Content-free control state, never a destructive-cleanup authorization. */
export function decodeHistoryIntentMarker45(raw: string): HistoryIntentMarker45 {
  if (typeof raw !== 'string' || raw.length > 256) throw new Error(LOCAL_DATA_HISTORY_RECOVERY_REQUIRED);
  let value: unknown;
  try { value = JSON.parse(raw) as unknown; } catch { throw new Error(LOCAL_DATA_HISTORY_RECOVERY_REQUIRED); }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(LOCAL_DATA_HISTORY_RECOVERY_REQUIRED);
  }
  const row = value as Record<string, unknown>;
  if (Object.keys(row).sort().join(',') !== 'kind,nonce,ownerBinding,v' ||
      row.v !== 1 || row.kind !== 'routine-plan-history' ||
      typeof row.ownerBinding !== 'string' || !/^[a-f0-9]{64}$/u.test(row.ownerBinding) ||
      typeof row.nonce !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(row.nonce)) {
    throw new Error(LOCAL_DATA_HISTORY_RECOVERY_REQUIRED);
  }
  if (raw !== JSON.stringify({ v: 1, kind: row.kind, ownerBinding: row.ownerBinding, nonce: row.nonce })) {
    throw new Error(LOCAL_DATA_HISTORY_RECOVERY_REQUIRED);
  }
  return row as HistoryIntentMarker45;
}

function destructiveClaimPending45(): boolean {
  return cleanupRequiredInMemory || [...cleanupMarkerClaims].some((claim) =>
    claim.active || claim.pendingMark || claim.required);
}

/** Also used on raw reads/export: absence must be freshly confirmed, never cached. */
export async function assertPlanHistoryReadable45(): Promise<void> {
  if (historyIntentClaims45.size > 0 || destructiveClaimPending45()) {
    throw new Error(LOCAL_DATA_HISTORY_RECOVERY_REQUIRED);
  }
  const raw = await AsyncStorage.getItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY);
  if (raw !== null || historyIntentClaims45.size > 0 || destructiveClaimPending45()) {
    throw new Error(LOCAL_DATA_HISTORY_RECOVERY_REQUIRED);
  }
}

/** Called under the history destination reservation, before any native mutation.
 * The marker FIFO never waits for a privateKV/account/photo drain. */
export function armPlanHistoryMutation45(lease: HealthDataWriteLease): Promise<PlanHistoryMutationIntent45> {
  if (historyIntentClaims45.size > 0 || destructiveClaimPending45()) {
    return Promise.reject(new Error(LOCAL_DATA_HISTORY_RECOVERY_REQUIRED));
  }
  const claim: HistoryIntentClaim45 = { raw: null, active: true };
  const token = Object.freeze({ kind: 'history-mutation-capability45' } as const);
  historyIntentClaims45.add(claim); // synchronous read quarantine, before native dispatch
  historyIntentTokens45.set(token, claim);
  return serializeCleanupMarker(async () => {
    try {
      const admission = await import('@/lib/consent/healthDataWriteAdmission');
      admission.assertOriginalHealthDataWriteLease(lease);
      const owner = await import('./sessionOwner');
      const Crypto = await import('expo-crypto');
      const proof = await owner.readLocalDataOwnerProof();
      const binding = await owner.localDataOwnerBinding(lease.ownerUserId);
      admission.assertOriginalHealthDataWriteLease(lease);
      if (proof.kind !== 'owned' || proof.ownerBinding !== binding || destructiveClaimPending45() ||
          await AsyncStorage.getItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY) !== null) {
        throw new Error(LOCAL_DATA_HISTORY_RECOVERY_REQUIRED);
      }
      claim.raw = JSON.stringify({ v: 1, kind: 'routine-plan-history', ownerBinding: binding,
        nonce: Crypto.randomUUID() } satisfies HistoryIntentMarker45);
      decodeHistoryIntentMarker45(claim.raw);
      await AsyncStorage.setItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY, claim.raw);
      if (await AsyncStorage.getItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY) !== claim.raw || destructiveClaimPending45()) {
        throw new Error(LOCAL_DATA_HISTORY_RECOVERY_REQUIRED);
      }
      admission.assertOriginalHealthDataWriteLease(lease);
      return token;
    } catch (error) {
      // Nothing in the destination has been dispatched. Proven native absence
      // releases this volatile claim; ambiguous persistence remains blocked.
      try {
        if (await AsyncStorage.getItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY) === null) {
          claim.active = false;
          historyIntentClaims45.delete(claim);
        }
      } catch { /* Lack of readback never proves absence. */ }
      throw error;
    }
  });
}

/** Only the original capability can release its own exact marker. Called only
 * after canonical destination confirmation OR verified exact compensation. */
export function finishPlanHistoryMutation45(token: PlanHistoryMutationIntent45): Promise<void> {
  const claim = historyIntentTokens45.get(token);
  if (!claim?.active || claim.raw === null) return Promise.reject(new Error(LOCAL_DATA_HISTORY_RECOVERY_REQUIRED));
  const expectedRaw = claim.raw;
  return serializeCleanupMarker(async () => {
    if (!claim.active || destructiveClaimPending45() ||
        await AsyncStorage.getItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY) !== expectedRaw) {
      throw new Error(LOCAL_DATA_HISTORY_RECOVERY_REQUIRED);
    }
    try {
      await AsyncStorage.removeItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY);
      if (await AsyncStorage.getItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY) !== null || destructiveClaimPending45()) {
        throw new Error(LOCAL_DATA_HISTORY_RECOVERY_REQUIRED);
      }
    } catch (error) {
      // A synchronous destructive claim may arrive during held native remove.
      // Restore its legacy marker, never replace it with a harmless intent.
      if (destructiveClaimPending45()) await restoreRequiredCleanupMarker();
      else {
        try {
          if (await AsyncStorage.getItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY) === null) {
            await AsyncStorage.setItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY, expectedRaw);
          }
        } catch { /* Confirmed destination is safe; current process stays blocked. */ }
      }
      throw error;
    }
    claim.active = false;
    historyIntentClaims45.delete(claim);
  });
}

let cleanupRequiredInMemory = false;

export type LocalDataCleanupMarkerScope = Readonly<{ abandon: () => void }>;
export type LocalDataCleanupMarkerRequest = {
  preserveExisting?: boolean;
  scope?: LocalDataCleanupMarkerScope;
};

type CleanupMarkerClaim = {
  active: boolean;
  pendingMark: boolean;
  required: boolean;
  adoptable: Set<CleanupMarkerClaim>;
};

const cleanupMarkerClaims = new Set<CleanupMarkerClaim>();
const cleanupMarkerScopes = new WeakMap<LocalDataCleanupMarkerScope, CleanupMarkerClaim>();
let cleanupMarkerTail: Promise<void> = Promise.resolve();
export const LOCAL_DATA_CLEANUP_MARKER_SCOPE_INVALID = 'LOCAL_DATA_CLEANUP_MARKER_SCOPE_INVALID';
export const LOCAL_DATA_CLEANUP_MARKER_UNCONFIRMED = 'LOCAL_DATA_CLEANUP_MARKER_UNCONFIRMED';
export const LOCAL_DATA_CLEANUP_MARKER_RESTORE_FAILED = 'LOCAL_DATA_CLEANUP_MARKER_RESTORE_FAILED';

function serializeCleanupMarker<T>(operation: () => Promise<T>): Promise<T> {
  const pending = cleanupMarkerTail.then(operation);
  cleanupMarkerTail = pending.then(() => undefined, () => undefined);
  return pending;
}

function completedCleanupMarkerClaims(): Set<CleanupMarkerClaim> {
  return new Set([...cleanupMarkerClaims].filter((claim) => !claim.active && !claim.pendingMark));
}

function releaseCleanupMarkerClaim(claim: CleanupMarkerClaim, succeeded: boolean): void {
  claim.active = false;
  if (succeeded) claim.required = false;
  if (!claim.required && !claim.pendingMark) cleanupMarkerClaims.delete(claim);
}

function rememberExistingCleanupMarker(
  raw: string | null,
  adoptable: Set<CleanupMarkerClaim>,
  mayAdoptExisting: boolean,
): void {
  if (raw !== null && raw !== CLEANUP_REQUIRED_VALUE) {
    decodeHistoryIntentMarker45(raw);
    return; // explicit cleanup supersedes history maintenance, not another cleanup
  }
  if (raw === null || [...cleanupMarkerClaims].some((claim) => claim.required)) return;
  // A marker present at process entry has no in-memory owner. A whole cleanup
  // may adopt it; a private-only helper must preserve the broader recovery.
  const existing: CleanupMarkerClaim = {
    active: false, pendingMark: false, required: true, adoptable: new Set(),
  };
  cleanupMarkerClaims.add(existing);
  if (mayAdoptExisting) adoptable.add(existing);
}

function otherCleanupMarkerRequired(
  scope: CleanupMarkerClaim | null,
  adoptable: ReadonlySet<CleanupMarkerClaim>,
): boolean {
  return [...cleanupMarkerClaims].some((claim) => claim !== scope &&
    (claim.active || claim.pendingMark || (claim.required && !adoptable.has(claim))));
}

async function restoreRequiredCleanupMarker(): Promise<void> {
  // The prior marker was confirmed or another cleanup still owns it. A failed
  // restoration must retain volatile quarantine and never report a clear.
  cleanupRequiredInMemory = true;
  try {
    try {
      if (await AsyncStorage.getItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY) === CLEANUP_REQUIRED_VALUE) {
        return;
      }
    } catch {
      // An unavailable pre-read must not suppress the restoration attempt.
    }
    try {
      await AsyncStorage.setItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY, CLEANUP_REQUIRED_VALUE);
    } catch {
      // Native mutation may have committed before its Promise rejected. Only
      // exact readback can confirm this compensation; the original clear fails.
    }
    if (await AsyncStorage.getItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY) !== CLEANUP_REQUIRED_VALUE) {
      throw new Error(LOCAL_DATA_CLEANUP_MARKER_RESTORE_FAILED);
    }
  } catch {
    throw new Error(LOCAL_DATA_CLEANUP_MARKER_RESTORE_FAILED);
  }
}

export function markLocalDataCleanupRequired(
  request?: LocalDataCleanupMarkerRequest,
): Promise<void> {
  if (request !== undefined && (
    request === null || typeof request !== 'object' || !Object.isExtensible(request) ||
    request.scope !== undefined ||
    (request.preserveExisting !== undefined && typeof request.preserveExisting !== 'boolean')
  )) {
    return Promise.reject(new Error(LOCAL_DATA_CLEANUP_MARKER_SCOPE_INVALID));
  }
  // Register before any await/native dispatch. A bare AuthProvider mark also
  // becomes a new claim, so an older reset can never clear its same-byte '1'.
  const claim: CleanupMarkerClaim = {
    active: true, pendingMark: true, required: false,
    adoptable: request?.preserveExisting ? new Set() : completedCleanupMarkerClaims(),
  };
  cleanupMarkerClaims.add(claim);
  if (request) {
    const scope = Object.freeze({ abandon: () => releaseCleanupMarkerClaim(claim, false) });
    cleanupMarkerScopes.set(scope, claim);
    request.scope = scope;
  }
  return serializeCleanupMarker(async () => {
    try {
      const previous = await AsyncStorage.getItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY);
      rememberExistingCleanupMarker(previous, claim.adoptable, !request?.preserveExisting);
      await AsyncStorage.setItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY, CLEANUP_REQUIRED_VALUE);
      if (await AsyncStorage.getItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY) !== CLEANUP_REQUIRED_VALUE) {
        throw new Error(LOCAL_DATA_CLEANUP_MARKER_UNCONFIRMED);
      }
      claim.required = true;
      cleanupRequiredInMemory = true;
    } catch (error) {
      // Failure before commitment must not invent volatile cleanup authority.
      // A committed-then-rejected write still has a real durable retry mark.
      try {
        if (await AsyncStorage.getItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY) === CLEANUP_REQUIRED_VALUE) {
          claim.required = true;
          cleanupRequiredInMemory = true;
        }
      } catch {
        // Neither a write rejection nor failed readback proves native absence.
        // Keep the claim and quarantine until a whole retry proves clearance.
        claim.required = true;
        cleanupRequiredInMemory = true;
      }
      throw error;
    } finally {
      claim.pendingMark = false;
      if (!request || !claim.active) releaseCleanupMarkerClaim(claim, false);
    }
  });
}

export function clearLocalDataCleanupRequired(): Promise<void>;
export function clearLocalDataCleanupRequired(scope: LocalDataCleanupMarkerScope): Promise<boolean>;
export function clearLocalDataCleanupRequired(
  scope: LocalDataCleanupMarkerScope | undefined,
): Promise<void | boolean>;
export function clearLocalDataCleanupRequired(
  scope?: LocalDataCleanupMarkerScope,
): Promise<void | boolean> {
  const claim = scope === undefined ? null : cleanupMarkerScopes.get(scope);
  if (scope !== undefined && (!claim || !claim.active)) {
    return Promise.reject(new Error(LOCAL_DATA_CLEANUP_MARKER_SCOPE_INVALID));
  }
  const adoptable = claim?.adoptable ?? completedCleanupMarkerClaims();
  const clearing = serializeCleanupMarker(async () => {
    if (claim && !claim.active) throw new Error(LOCAL_DATA_CLEANUP_MARKER_SCOPE_INVALID);
    const previous = await AsyncStorage.getItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY);
    if (previous !== null && previous !== CLEANUP_REQUIRED_VALUE) {
      // Clearing the destructive marker is not an intent cancellation API.
      // A genuine destructive mark must precede a cleanup's own clear.
      throw new Error(LOCAL_DATA_HISTORY_RECOVERY_REQUIRED);
    }
    rememberExistingCleanupMarker(previous, adoptable, claim === null);
    const retainOtherOwner = async () => {
      await restoreRequiredCleanupMarker();
      for (const prior of adoptable) {
        if (!prior.active && !prior.pendingMark) cleanupMarkerClaims.delete(prior);
      }
      if (claim) releaseCleanupMarkerClaim(claim, true);
      return false;
    };
    if (otherCleanupMarkerRequired(claim ?? null, adoptable)) return retainOtherOwner();
    try {
      await AsyncStorage.removeItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY);
      if (await AsyncStorage.getItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY) !== null) {
        throw new Error(LOCAL_DATA_CLEANUP_MARKER_UNCONFIRMED);
      }
      // Claims register synchronously even while the native remove Promise is
      // held. Restore their marker inside this same FIFO before publishing.
      if (otherCleanupMarkerRequired(claim ?? null, adoptable)) return retainOtherOwner();
    } catch (error) {
      if (previous !== null || cleanupRequiredInMemory || claim?.required) {
        await restoreRequiredCleanupMarker();
      }
      throw error;
    }
    for (const prior of adoptable) {
      if (!prior.active && !prior.pendingMark) cleanupMarkerClaims.delete(prior);
    }
    if (claim) releaseCleanupMarkerClaim(claim, true);
    cleanupRequiredInMemory = false;
    for (const historyClaim of historyIntentClaims45) historyClaim.active = false;
    historyIntentClaims45.clear();
    return true;
  });
  return scope === undefined ? clearing.then(() => undefined) : clearing;
}

/** Confirmed quarantine shared by the cleanup coordinator and owner proof reader. */
export function isLocalDataCleanupRequiredInMemory(): boolean {
  return cleanupRequiredInMemory;
}

type QueryCacheController = Pick<QueryClient, 'cancelQueries' | 'clear'>;

export type LocalAccountIsolationDependencies = {
  claimOwnership: (userId: string) => Promise<void>;
  clearCleanupRequired: (scope?: LocalDataCleanupMarkerScope) => Promise<void | boolean>;
  clearPersistedPrivateData: () => Promise<void>;
  clearPlaintextStaging?: () => Promise<unknown>;
  clearSensitiveImageMemory?: () => Promise<unknown>;
  markCleanupRequired: (request?: LocalDataCleanupMarkerRequest) => Promise<void>;
  queryCache: QueryCacheController;
  readOwnership: (userId: string | null) => Promise<LocalDataOwnership>;
};

// Keep module import safe for the content-free marker protocol. Runtime
// stores and owner proof dependencies load only when their operation is used.
async function clearLocalPrivateData(): Promise<void> {
  const storage = await import('@/features/settings/localPrivateData');
  return storage.clearLocalPrivateData();
}

const defaultDependencies: LocalAccountIsolationDependencies = {
  claimOwnership: async (userId) => {
    const owner = await import('./sessionOwner');
    return owner.claimLocalDataOwnership(userId);
  },
  clearCleanupRequired: clearLocalDataCleanupRequired,
  clearPersistedPrivateData: clearLocalPrivateData,
  clearPlaintextStaging: async () => {
    const { scavengePlaintextStaging } = await import('@/lib/storage/plaintextStaging');
    return scavengePlaintextStaging();
  },
  clearSensitiveImageMemory: async () => {
    const { purgeSensitiveImageMemory } = await import('@/features/photos/sensitiveImageMemory');
    return purgeSensitiveImageMemory();
  },
  markCleanupRequired: markLocalDataCleanupRequired,
  queryCache: {
    cancelQueries: async () => {
      const { queryClient } = await import('@/lib/query/queryClient');
      return queryClient.cancelQueries();
    },
    clear: async () => {
      const { queryClient } = await import('@/lib/query/queryClient');
      queryClient.clear();
    },
  },
  readOwnership: async (userId) => {
    const owner = await import('./sessionOwner');
    return owner.readLocalDataOwnership(userId);
  },
};

export async function clearAccountIsolatedState(
  dependencies: Pick<
    LocalAccountIsolationDependencies,
    | 'clearCleanupRequired'
    | 'clearPersistedPrivateData'
    | 'clearPlaintextStaging'
    | 'markCleanupRequired'
    | 'queryCache'
    | 'clearSensitiveImageMemory'
  > = defaultDependencies,
  clearPrivateData?: (canCommitControls: () => boolean) => Promise<void>,
): Promise<void> {
  let firstFailure: unknown = null;
  const attempt = async (operation: () => void | Promise<unknown>) => {
    try {
      await operation();
    } catch (error) {
      firstFailure ??= error;
    }
  };

  // Capture marker ownership inside the real mark call, before its first
  // native await. Injected cleanup ports retain their original void contract.
  const markerRequest: LocalDataCleanupMarkerRequest = {};
  const markerPorts = dependencies;
  dependencies = {
    ...markerPorts,
    markCleanupRequired: () => markerPorts.markCleanupRequired(markerRequest),
    clearCleanupRequired: () => markerPorts.clearCleanupRequired(markerRequest.scope),
  };
  let privateStorage: typeof import('@/lib/storage/privateKV');
  let photoStorage: typeof import('@/features/photos/encryptedStorage');
  try {
    await dependencies.markCleanupRequired();
    [privateStorage, photoStorage] = await Promise.all([
      import('@/lib/storage/privateKV'),
      import('@/features/photos/encryptedStorage'),
    ]);
  } catch (error) {
    markerRequest.scope?.abandon();
    throw error;
  }
  const {
    beginPrivateKVAccountBoundary,
    endPrivateKVAccountBoundary,
    waitForPrivateKVWritesToSettle,
  } = privateStorage;
  const {
    beginEncryptedPhotoAccountBoundary,
    endEncryptedPhotoAccountBoundary,
    waitForEncryptedPhotoWritesToSettle,
  } = photoStorage;
  beginAccountGenerationBoundary();
  beginPrivateKVAccountBoundary();
  beginEncryptedPhotoAccountBoundary();
  try {
    await attempt(() => waitForAccountGenerationOperationsToSettle());
    await attempt(() => waitForPrivateKVWritesToSettle());
    await attempt(() => waitForEncryptedPhotoWritesToSettle());
    if (dependencies.clearPlaintextStaging) {
      await attempt(() => dependencies.clearPlaintextStaging?.());
    }
    if (dependencies.clearSensitiveImageMemory) {
      await attempt(() => dependencies.clearSensitiveImageMemory?.());
    }
    await attempt(() => dependencies.queryCache.cancelQueries());
    await attempt(() => dependencies.queryCache.clear());
    await attempt(() => clearPrivateData
      ? clearPrivateData(() => firstFailure === null)
      : dependencies.clearPersistedPrivateData());

    // A query that ignored cancellation must not repopulate account A after its
    // persisted records were removed. Clear again after the destructive boundary.
    await attempt(() => dependencies.queryCache.cancelQueries());
    await attempt(() => dependencies.queryCache.clear());
    if (firstFailure === null) {
      await attempt(() => dependencies.clearCleanupRequired());
    }
  } finally {
    if (firstFailure !== null) markerRequest.scope?.abandon();
    endEncryptedPhotoAccountBoundary();
    endPrivateKVAccountBoundary();
    endAccountGenerationBoundary();
  }

  if (firstFailure) throw firstFailure;
}

export async function prepareLocalDataForSession(
  previousUserId: string | null,
  nextUserId: string | null,
  dependencies: LocalAccountIsolationDependencies = defaultDependencies,
  beforeClear?: () => void | Promise<void>,
  options: { clearUnclaimed?: boolean } = {},
): Promise<{ cleared: boolean; resetRoute: boolean }> {
  const ownership = await dependencies.readOwnership(nextUserId);
  const mustClear =
    (options.clearUnclaimed === true && ownership === 'unclaimed') ||
    shouldClearLocalPrivateDataForSessionChange(previousUserId, nextUserId, ownership);

  if (mustClear) {
    await beforeClear?.();
    await clearAccountIsolatedState(dependencies);
  }
  if (nextUserId) await dependencies.claimOwnership(nextUserId);

  return { cleared: mustClear, resetRoute: mustClear };
}
