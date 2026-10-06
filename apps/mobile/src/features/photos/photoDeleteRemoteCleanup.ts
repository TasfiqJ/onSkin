import { localDataOwnerBinding } from '@/lib/auth/sessionOwner';
import {
  assertHealthDataWriteLease,
  type HealthDataWriteOperationLease,
} from '@/lib/consent/healthDataWriteAdmission';
import { LargeSecureStore } from '@/lib/supabase/largeSecureStore';

import { notifyPhotoDeleteChanges } from './photoDeleteJournal';

/** Each pseudonymous owner has a separate authenticated ciphertext and a
 * THIS_DEVICE_ONLY SecureStore key, through the existing LargeSecureStore.
 * This is NOT a bearer capability: replay still requires that exact owner's
 * new legitimate account/health lease and current server authentication/RLS.
 * No session, note, timestamp, image bytes, local path, or health epoch is kept.
 * A different owner never reads or decrypts this owner's namespace.
 */
export const PHOTO_DELETE_CLEANUP_VAULT_KEY_PREFIX = 'layerwell.photoDeleteCleanup.v1.';
const MAX_OPERATIONS = 128;
const MAX_CHARS = 65536;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BINDING = /^[a-f0-9]{64}$/;
const storage = new LargeSecureStore();

type StoredObligation = Readonly<{
  ownerBinding: string;
  operationId: string;
  photoId: string;
  needsAttention: boolean;
  phase: 'reserved' | 'committed';
}>;
export type PhotoDeleteRemoteObligation = Omit<StoredObligation, 'ownerBinding'>;
let tail: Promise<void> = Promise.resolve();

// Process-only retirement, not persisted consent or a replacement health lease.
// Only owner bindings and counters are retained here, never photo/operation IDs.
let retirementSequence = 0;
const retirements = new Map<string, { generation: number; pending: boolean }>();
const retirementListeners = new Map<string, Set<() => void>>();

export class PhotoDeleteReplayRetiredError extends Error {
  constructor() { super('PHOTO_DELETE_REPLAY_RETIRED'); }
}

export type PhotoDeleteReplayAuthority = Readonly<{
  assertCurrent: () => void;
  isCurrent: () => boolean;
  subscribeRetirement: (listener: () => void) => () => void;
}>;

function assertLease(lease: HealthDataWriteOperationLease): void {
  lease.assertCurrent();
  assertHealthDataWriteLease(lease);
}

function serial<T>(operation: () => Promise<T>): Promise<T> {
  const pending = tail.then(operation);
  // Never retain a plaintext result in a process-global settled promise.
  tail = pending.then(
    () => undefined,
    () => undefined,
  );
  return pending;
}

function keyForBinding(ownerBinding: string): string {
  if (!BINDING.test(ownerBinding)) throw new Error('PHOTO_DELETE_CLEANUP_OWNER_INVALID');
  return PHOTO_DELETE_CLEANUP_VAULT_KEY_PREFIX + ownerBinding;
}

function decode(raw: string | null, ownerBinding: string): StoredObligation[] {
  if (raw === null) return [];
  const invalid = () => new Error('PHOTO_DELETE_CLEANUP_VAULT_INVALID');
  if (raw.length > MAX_CHARS) throw invalid();
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw invalid();
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  const envelope = value as Record<string, unknown>;
  if (
    Object.keys(envelope).sort().join(',') !== 'operations,version' ||
    envelope.version !== 1 ||
    !Array.isArray(envelope.operations) ||
    envelope.operations.length > MAX_OPERATIONS
  )
    throw invalid();
  const ids = new Set<string>();
  return envelope.operations.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw invalid();
    const item = entry as Record<string, unknown>;
    if (
      Object.keys(item).sort().join(',') !==
        'needsAttention,operationId,ownerBinding,phase,photoId' ||
      item.ownerBinding !== ownerBinding ||
      typeof item.operationId !== 'string' ||
      !UUID.test(item.operationId) ||
      typeof item.photoId !== 'string' ||
      !UUID.test(item.photoId) ||
      typeof item.needsAttention !== 'boolean' ||
      (item.phase !== 'reserved' && item.phase !== 'committed')
    )
      throw invalid();
    if (ids.has(item.operationId)) throw invalid();
    ids.add(item.operationId);
    return item as StoredObligation;
  });
}

async function write(ownerBinding: string, operations: StoredObligation[]): Promise<void> {
  const key = keyForBinding(ownerBinding);
  if (operations.length === 0) {
    await storage.removeItem(key);
    return;
  }
  const raw = JSON.stringify({ version: 1, operations });
  decode(raw, ownerBinding);
  await storage.setItem(key, raw);
}

async function binding(lease: HealthDataWriteOperationLease): Promise<string> {
  assertLease(lease);
  const result = await localDataOwnerBinding(lease.ownerUserId);
  assertLease(lease);
  keyForBinding(result);
  return result;
}

/** Capture before copying obligations. The start stamp also fences the async
 * owner-binding lookup: an erasure during that lookup cannot lend a new era to
 * this invocation. Retirement of another owner does not invalidate this one. */
export async function capturePhotoDeleteReplayAuthority(
  lease: HealthDataWriteOperationLease,
): Promise<PhotoDeleteReplayAuthority> {
  const startedAt = retirementSequence;
  const ownerBinding = await binding(lease);
  const state = retirements.get(ownerBinding);
  if ((state?.generation ?? 0) > startedAt) throw new PhotoDeleteReplayRetiredError();
  if (state?.pending) throw new Error('PHOTO_DELETE_CLEANUP_PENDING');
  const generation = state?.generation ?? 0;
  const assertCurrent = () => {
    assertLease(lease);
    const current = retirements.get(ownerBinding);
    if ((current?.generation ?? 0) !== generation || current?.pending) {
      throw new PhotoDeleteReplayRetiredError();
    }
  };
  return Object.freeze({
    assertCurrent,
    isCurrent: () => { try { assertCurrent(); return true; } catch { return false; } },
    subscribeRetirement: (listener: () => void) => {
      assertCurrent();
      let listeners = retirementListeners.get(ownerBinding);
      if (!listeners) { listeners = new Set(); retirementListeners.set(ownerBinding, listeners); }
      const subscribed = listeners;
      subscribed.add(listener);
      return () => {
        subscribed.delete(listener);
        if (subscribed.size === 0 && retirementListeners.get(ownerBinding) === subscribed) {
          retirementListeners.delete(ownerBinding);
        }
      };
    },
  });
}

export function readPhotoDeleteRemoteObligations(
  lease: HealthDataWriteOperationLease,
): Promise<PhotoDeleteRemoteObligation[]> {
  return serial(async () => {
    const ownerBinding = await binding(lease);
    const raw = await storage.getItem(keyForBinding(ownerBinding));
    assertLease(lease);
    return decode(raw, ownerBinding).map(({ operationId, photoId, needsAttention, phase }) => ({
      operationId,
      photoId,
      needsAttention,
      phase,
    }));
  });
}

/** Reserve before local removal. After a crash, a remaining authoritative local
 * row aborts the reservation; an absent row (including sign-out erasure) is
 * eligible. A native write crossing sign-out stays in A's isolated namespace;
 * withdrawal drains the operation and then erases that exact namespace.
 */
export function reservePhotoDeleteRemoteObligation(
  operation: Omit<PhotoDeleteRemoteObligation, 'phase'>,
  lease: HealthDataWriteOperationLease,
  committed = false,
): Promise<void> {
  return serial(async () => {
    const ownerBinding = await binding(lease);
    const rows = decode(await storage.getItem(keyForBinding(ownerBinding)), ownerBinding);
    assertLease(lease);
    const existing = rows.find((row) => row.operationId === operation.operationId);
    if (existing) {
      if (existing.photoId !== operation.photoId)
        throw new Error('PHOTO_DELETE_CLEANUP_ID_CONFLICT');
      if (committed && existing.phase === 'reserved') {
        await write(
          ownerBinding,
          rows.map((row) => (row === existing ? { ...row, phase: 'committed' } : row)),
        );
        assertLease(lease);
        notifyPhotoDeleteChanges(lease);
      }
      return;
    }
    if (rows.length >= MAX_OPERATIONS) throw new Error('PHOTO_DELETE_CLEANUP_VAULT_FULL');
    assertLease(lease);
    await write(ownerBinding, [
      ...rows,
      {
        ownerBinding,
        operationId: operation.operationId,
        photoId: operation.photoId,
        needsAttention: operation.needsAttention,
        phase: committed ? 'committed' : 'reserved',
      },
    ]);
    assertLease(lease);
    notifyPhotoDeleteChanges(lease);
  });
}

export function settlePhotoDeleteRemoteObligation(
  operationId: string,
  outcome: 'remove' | 'attention',
  lease: HealthDataWriteOperationLease,
): Promise<void> {
  return serial(async () => {
    const ownerBinding = await binding(lease);
    const rows = decode(await storage.getItem(keyForBinding(ownerBinding)), ownerBinding);
    assertLease(lease);
    const next = rows.flatMap((row) =>
      row.operationId === operationId
        ? outcome === 'remove'
          ? []
          : [{ ...row, needsAttention: true }]
        : [row],
    );
    if (JSON.stringify(next) === JSON.stringify(rows)) return;
    assertLease(lease);
    await write(ownerBinding, next);
    assertLease(lease);
    notifyPhotoDeleteChanges(lease);
  });
}

/** Erasure-only: authoritative photo-purpose closure, existing full-health
 * destructive proof, or terminal account proof authorizes this exact binding. No returned data, no
 * new processing lease, and no decryption (also works when the key was lost).
 * Failures propagate so the established cleanup workflow remains incomplete.
 */
export function erasePhotoDeleteRemoteCleanupForBinding(ownerBinding: string): Promise<void> {
  const key = keyForBinding(ownerBinding);
  if (!Number.isSafeInteger(retirementSequence + 1)) {
    throw new Error('PHOTO_DELETE_RETIREMENT_EXHAUSTED');
  }
  // Linearization point: retire captured work synchronously, before either
  // queueing or awaiting native erasure. Failure never revalidates an old batch.
  const state = { generation: ++retirementSequence, pending: true };
  retirements.set(ownerBinding, state);
  const listeners = retirementListeners.get(ownerBinding);
  retirementListeners.delete(ownerBinding);
  for (const listener of listeners ?? []) {
    try { listener(); } catch { /* A transport listener cannot prevent erasure. */ }
  }
  return serial(async () => {
    await storage.removeItem(key);
    // A new invocation may capture only after exact-owner erasure succeeds.
    // Failed erasure stays pending until the existing explicit cleanup retries.
    if (retirements.get(ownerBinding) === state) state.pending = false;
  });
}

export async function erasePhotoDeleteRemoteCleanupForOwner(ownerUserId: string): Promise<void> {
  if (!ownerUserId || ownerUserId.trim() !== ownerUserId || ownerUserId.length > 128)
    throw new Error('PHOTO_DELETE_CLEANUP_OWNER_INVALID');
  await erasePhotoDeleteRemoteCleanupForBinding(await localDataOwnerBinding(ownerUserId));
}
