import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import type { LocalDataOwnership } from './sessionBoundary';
import {
  clearLocalDataCleanupRequired as clearSharedLocalDataCleanupRequired,
  isLocalDataCleanupRequiredInMemory,
  decodeHistoryIntentMarker45,
  decodePrivateMutationMarker46,
  markLocalDataCleanupRequired as markSharedLocalDataCleanupRequired,
  type LocalDataCleanupMarkerRequest,
  type LocalDataCleanupMarkerScope,
} from './localAccountIsolation';

import {
  LOCAL_DATA_CLEANUP_REQUIRED_KEY,
  LOCAL_DATA_OWNER_HASH_KEY,
  LOCAL_DATA_RETAINED_OWNER_HASH_KEY,
  LOCAL_DATA_UNCLAIMED_QUARANTINE_KEY,
} from './sessionOwnerKey';

export {
  LOCAL_DATA_CLEANUP_MARKER_SCOPE_INVALID,
  LOCAL_DATA_CLEANUP_MARKER_UNCONFIRMED,
  LOCAL_DATA_CLEANUP_MARKER_RESTORE_FAILED,
} from './localAccountIsolation';
export type { LocalDataCleanupMarkerRequest, LocalDataCleanupMarkerScope } from './localAccountIsolation';

export {
  LOCAL_DATA_CLEANUP_REQUIRED_KEY,
  LOCAL_DATA_OWNER_HASH_KEY,
  LOCAL_DATA_RETAINED_OWNER_HASH_KEY,
  LOCAL_DATA_UNCLAIMED_QUARANTINE_KEY,
} from './sessionOwnerKey';
const OWNER_HASH_DOMAIN = 'layerwell:local-data-owner:v1:';
const OWNER_HASH_PATTERN = /^[a-f0-9]{64}$/;
const UNCLAIMED_QUARANTINE_VALUE = '1';
const CLEANUP_REQUIRED_VALUE = '1';
const OWNER_PROOF_KEYS = [
  LOCAL_DATA_CLEANUP_REQUIRED_KEY,
  LOCAL_DATA_OWNER_HASH_KEY,
  LOCAL_DATA_RETAINED_OWNER_HASH_KEY,
  LOCAL_DATA_UNCLAIMED_QUARANTINE_KEY,
] as const;
type ForcedSignOutPreservation = 'resume-cleanup' | 'retained-owner' | 'unclaimed-quarantine' | 'mutation-recovery';

export type LocalDataOwnerProof =
  | { kind: 'cleanup_required'; ownerBinding: string | null }
  | { kind: 'history_recovery'; ownerBinding: string }
  | { kind: 'mutation_recovery'; ownerBinding: string | null }
  | { kind: 'owned'; ownerBinding: string; retained: boolean }
  | { kind: 'quarantined' }
  | { kind: 'unclaimed' };

function invalidOwnerProof(): Error {
  return new Error('LOCAL_DATA_OWNER_PROOF_INVALID');
}

/**
 * Read and validate the complete local ownership proof as one storage batch.
 * No caller may authorize cleanup or adoption from the owner key alone: the
 * retained-owner, ownerless-quarantine, and interrupted-cleanup markers are
 * part of the same fail-closed proof.
 */
export async function readLocalDataOwnerProof(): Promise<LocalDataOwnerProof> {
  const entries = await AsyncStorage.multiGet([...OWNER_PROOF_KEYS]);
  if (
    !Array.isArray(entries) ||
    entries.length !== OWNER_PROOF_KEYS.length ||
    entries.some(
      (entry, index) =>
        !Array.isArray(entry) ||
        entry.length !== 2 ||
        entry[0] !== OWNER_PROOF_KEYS[index] ||
        (entry[1] !== null && typeof entry[1] !== 'string'),
    )
  ) {
    throw invalidOwnerProof();
  }
  const cleanupValue = entries[0]?.[1] ?? null;
  const storedHash = entries[1]?.[1] ?? null;
  const retainedHash = entries[2]?.[1] ?? null;
  const unclaimedQuarantine = entries[3]?.[1] ?? null;

  if (
    (unclaimedQuarantine !== null && unclaimedQuarantine !== UNCLAIMED_QUARANTINE_VALUE)
  ) {
    throw invalidOwnerProof();
  }
  if (storedHash !== null && !OWNER_HASH_PATTERN.test(storedHash)) {
    throw invalidOwnerProof();
  }
  if (retainedHash !== null && !OWNER_HASH_PATTERN.test(retainedHash)) {
    throw invalidOwnerProof();
  }
  if (
    (unclaimedQuarantine !== null && (storedHash !== null || retainedHash !== null)) ||
    (retainedHash !== null && retainedHash !== storedHash)
  ) {
    throw invalidOwnerProof();
  }

  if (cleanupValue !== null && cleanupValue !== CLEANUP_REQUIRED_VALUE) {
    try {
      const mutation = decodePrivateMutationMarker46(cleanupValue);
      if (mutation.ownerBinding !== storedHash || unclaimedQuarantine !== null) throw invalidOwnerProof();
      return { kind: 'mutation_recovery', ownerBinding: mutation.ownerBinding };
    } catch {
      // Preserve the exact accepted C45 v1 format and its owner binding.
    }
    let intent: ReturnType<typeof decodeHistoryIntentMarker45>;
    try { intent = decodeHistoryIntentMarker45(cleanupValue); } catch { throw invalidOwnerProof(); }
    if (intent.ownerBinding !== storedHash || unclaimedQuarantine !== null) throw invalidOwnerProof();
    // No automatic cleanup/adoption from an interrupted ordinary save. Retain
    // confirmed bytes and independent photo keys until explicit data rights.
    return { kind: 'history_recovery', ownerBinding: intent.ownerBinding };
  }

  const cleanupRequired = isLocalDataCleanupRequiredInMemory() || cleanupValue === CLEANUP_REQUIRED_VALUE;
  if (cleanupRequired) {
    return { kind: 'cleanup_required', ownerBinding: storedHash };
  }
  if (unclaimedQuarantine !== null) return { kind: 'quarantined' };
  if (storedHash === null) return { kind: 'unclaimed' };
  return { kind: 'owned', ownerBinding: storedHash, retained: retainedHash !== null };
}

/** Canonical validated binding used by owner-bound recovery decisions. */
export async function readLocalDataOwnerProofBinding(): Promise<string | null> {
  const proof = await readLocalDataOwnerProof();
  return proof.kind === 'owned' || proof.kind === 'cleanup_required' || proof.kind === 'history_recovery' || proof.kind === 'mutation_recovery'
    ? proof.ownerBinding : null;
}

/** Domain-separated pseudonymous owner binding shared by account boundaries. */
export async function localDataOwnerBinding(userId: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${OWNER_HASH_DOMAIN}${userId}`,
  );
}

export async function readLocalDataOwnership(userId: string | null): Promise<LocalDataOwnership> {
  const proof = await readLocalDataOwnerProof();
  if (proof.kind === 'cleanup_required') return 'cleanup_required';
  if (proof.kind === 'quarantined') return userId === null ? 'retained' : 'mismatch';
  if (proof.kind === 'unclaimed') return 'unclaimed';
  if (proof.kind === 'mutation_recovery') {
    // An interrupted unclaimed bootstrap never becomes ownership, adoption or
    // automatic destructive cleanup. Explicit local cleanup remains available.
    if (proof.ownerBinding === null) throw new Error('LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED');
    if (userId === null) return 'retained';
    return proof.ownerBinding === await localDataOwnerBinding(userId) ? 'match' : 'mismatch';
  }
  if (proof.kind === 'history_recovery') {
    // Owner-scoped privacy deletion/withdrawal may still proceed. Session
    // admission below and every history read independently refuse the intent.
    if (userId === null) return 'retained';
    return proof.ownerBinding === await localDataOwnerBinding(userId) ? 'match' : 'mismatch';
  }
  if (!userId) return proof.retained ? 'retained' : 'mismatch';
  return proof.ownerBinding === (await localDataOwnerBinding(userId)) ? 'match' : 'mismatch';
}

export async function claimLocalDataOwnership(userId: string): Promise<void> {
  const proof = await readLocalDataOwnerProof();
  if (proof.kind === 'history_recovery') throw new Error('LOCAL_DATA_HISTORY_RECOVERY_REQUIRED');
  if (proof.kind === 'mutation_recovery') throw new Error('LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED');
  if (proof.kind === 'cleanup_required') {
    throw new Error('LOCAL_DATA_CLEANUP_REQUIRED');
  }
  if (proof.kind === 'quarantined') {
    throw new Error('LOCAL_DATA_UNCLAIMED_QUARANTINED');
  }
  const ownerBinding = await localDataOwnerBinding(userId);
  if (proof.kind === 'owned' && proof.ownerBinding !== ownerBinding) {
    throw new Error('LOCAL_DATA_OWNER_MISMATCH');
  }
  await AsyncStorage.setItem(LOCAL_DATA_OWNER_HASH_KEY, ownerBinding);
  if (proof.kind === 'owned' && proof.retained) {
    // Consume the preservation proof only when the exact owner boundary is
    // committed, after ownership was checked and before the session can mount.
    await AsyncStorage.removeItem(LOCAL_DATA_RETAINED_OWNER_HASH_KEY);
  }
}

/**
 * Durably preserve the current owner across a recovery-forced local sign-out.
 * The marker contains only the existing pseudonymous owner binding and must be
 * committed before Auth storage is cleared.
 */
export async function retainLocalDataOwnerForSignedOutRestore(): Promise<void> {
  const proof = await readLocalDataOwnerProof();
  const ownerBinding =
    proof.kind === 'owned' || proof.kind === 'cleanup_required' || proof.kind === 'history_recovery' || proof.kind === 'mutation_recovery'
      ? proof.ownerBinding : null;
  if (ownerBinding === null) {
    throw new Error('LOCAL_DATA_RETAINED_OWNER_INVALID');
  }
  await AsyncStorage.setItem(LOCAL_DATA_RETAINED_OWNER_HASH_KEY, ownerBinding);
}

/**
 * Durably quarantine ownerless local data before a recovery-forced sign-out.
 * No future account, including the same cached Auth subject, may adopt this
 * data without first completing the destructive account boundary.
 */
export async function quarantineUnclaimedLocalDataForSignedOutRestore(): Promise<void> {
  const proof = await readLocalDataOwnerProof();
  if (proof.kind === 'mutation_recovery' && proof.ownerBinding === null) return;
  if (
    proof.kind === 'owned' || proof.kind === 'history_recovery' || proof.kind === 'mutation_recovery' ||
    (proof.kind === 'cleanup_required' && proof.ownerBinding !== null)
  ) {
    throw new Error('LOCAL_DATA_UNCLAIMED_QUARANTINE_INVALID');
  }
  await AsyncStorage.setItem(LOCAL_DATA_UNCLAIMED_QUARANTINE_KEY, UNCLAIMED_QUARANTINE_VALUE);
}

/**
 * Resolve the only valid durable local-data action before Auth is forcibly
 * cleared: resume a previously authorized destructive boundary, retain an
 * exact canonical owner, or quarantine ownerless data. Storage uncertainty or
 * inconsistent proof fails closed.
 */
export async function preserveLocalDataForForcedSignOut(): Promise<ForcedSignOutPreservation> {
  const proof = await readLocalDataOwnerProof();
  if (proof.kind === 'cleanup_required') return 'resume-cleanup';
  if (proof.kind === 'mutation_recovery' && proof.ownerBinding === null) return 'mutation-recovery';
  const ownerBinding = proof.kind === 'owned' || proof.kind === 'history_recovery' || proof.kind === 'mutation_recovery' ? proof.ownerBinding : null;
  if (ownerBinding === null) {
    await AsyncStorage.setItem(LOCAL_DATA_UNCLAIMED_QUARANTINE_KEY, UNCLAIMED_QUARANTINE_VALUE);
    return 'unclaimed-quarantine';
  }
  await AsyncStorage.setItem(LOCAL_DATA_RETAINED_OWNER_HASH_KEY, ownerBinding);
  return 'retained-owner';
}

export function markLocalDataCleanupRequired(
  request?: LocalDataCleanupMarkerRequest,
): Promise<void> {
  return markSharedLocalDataCleanupRequired(request);
}

export function clearLocalDataCleanupRequired(): Promise<void>;
export function clearLocalDataCleanupRequired(scope: LocalDataCleanupMarkerScope): Promise<boolean>;
export function clearLocalDataCleanupRequired(
  scope: LocalDataCleanupMarkerScope | undefined,
): Promise<void | boolean>;
export function clearLocalDataCleanupRequired(
  scope?: LocalDataCleanupMarkerScope,
): Promise<void | boolean> {
  return scope === undefined
    ? clearSharedLocalDataCleanupRequired()
    : clearSharedLocalDataCleanupRequired(scope);
}
