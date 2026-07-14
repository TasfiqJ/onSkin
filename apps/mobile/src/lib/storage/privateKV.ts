import 'react-native-get-random-values';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import {
  bytesToHex,
  bytesToUtf8,
  hexToBytes,
  randomBytes,
  utf8ToBytes,
} from '@noble/ciphers/utils.js';

import {
  PRIVATE_KV_CONTENT_KEY_CONFLICT,
  PRIVATE_KV_CONTENT_KEY_NAME,
  PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE,
  clearStoredPrivateKVContentKey,
  getStoredPrivateKVContentKey,
  migrateStoredPrivateKVContentKey,
  setStoredPrivateKVContentKey,
} from './privateKVContentKey';
import { LOCAL_PRIVATE_BULK_CLEANUP_KEYS } from '@/features/settings/localPrivateDataRegistry';
import { withOperationTiming } from '@/lib/observability/operationTiming';

const ENCRYPTION_VERSION = 'xchacha20poly1305:v1';
const NONCE_BYTES = 24;
const LEGACY_PRIVATE_KV_PREFIX = PRIVATE_KV_CONTENT_KEY_NAME.slice(
  0,
  -'private_kv.content_key.v1'.length,
);
export const PRIVATE_KV_CONTENT_KEY_MISSING = 'PRIVATE_KV_CONTENT_KEY_MISSING';
export const PRIVATE_KV_CONTENT_KEY_INVALID = 'PRIVATE_KV_CONTENT_KEY_INVALID';
export const PRIVATE_KV_DECRYPTION_FAILED = 'PRIVATE_KV_DECRYPTION_FAILED';
export const PRIVATE_KV_ENVELOPE_INVALID = 'PRIVATE_KV_ENVELOPE_INVALID';
export const PRIVATE_KV_ENVELOPE_UNSUPPORTED = 'PRIVATE_KV_ENVELOPE_UNSUPPORTED';
export const PRIVATE_KV_ENVELOPE_FOREIGN = 'PRIVATE_KV_ENVELOPE_FOREIGN';
export const PRIVATE_KV_RESERVED_KEY = 'PRIVATE_KV_RESERVED_KEY';
export const PRIVATE_KV_WRITE_CONFLICT = 'PRIVATE_KV_WRITE_CONFLICT';
export const PRIVATE_KV_WRITE_BLOCKED_AFTER_READ_FAILURE =
  'PRIVATE_KV_WRITE_BLOCKED_AFTER_READ_FAILURE';
export const PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY =
  'PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY';
export const PRIVATE_KV_AUTHORIZED_RESET_REASON_INVALID =
  'PRIVATE_KV_AUTHORIZED_RESET_REASON_INVALID';
export { PRIVATE_KV_CONTENT_KEY_CONFLICT, PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE };

export type PrivateKVReadFailureReason =
  | 'content_key_missing'
  | 'content_key_invalid'
  | 'content_key_conflict'
  | 'content_key_storage_unavailable'
  | 'envelope_invalid'
  | 'decryption_failed'
  | 'account_boundary'
  | 'storage_unavailable';

export type PrivateKVReadResult =
  | { status: 'absent' }
  | { status: 'available'; value: string }
  | { status: 'unavailable'; reason: PrivateKVReadFailureReason }
  | { status: 'corrupt'; reason: 'content_key_invalid' | 'envelope_invalid' | 'decryption_failed' }
  | { status: 'unsupported_version' };

export type PrivateKVAuthorizedResetReason =
  | 'account_isolation'
  | 'device_authenticated_app_lock_repair';

const DEVICE_AUTHENTICATED_APP_LOCK_REPAIR_KEY = 'onskin.appLock.enabled';
const ACCOUNT_ISOLATION_RESET_KEYS = new Set<string>(LOCAL_PRIVATE_BULK_CLEANUP_KEYS);

type PrivateEnvelope = {
  version: typeof ENCRYPTION_VERSION;
  nonceHex: string;
  ciphertextHex: string;
};

type EnvelopeClassification =
  | { kind: 'legacy' }
  | { kind: 'current'; envelope: PrivateEnvelope }
  | { kind: 'malformed' }
  | { kind: 'unsupported' };

let contentKeyCreation: Promise<Uint8Array> | null = null;
const failedReadSnapshots = new Map<string, string>();
const inFlightOperations = new Set<Promise<unknown>>();
const privateMutationTails = new Map<string, Promise<void>>();
let accountBoundaryWriteBlocked = false;
let accountBoundaryWriteBlockDepth = 0;
let accountBoundaryGeneration = 0;

async function runAccountScopedPrivateOperation<T>(
  operation: (generation: number) => Promise<T>,
): Promise<T> {
  if (accountBoundaryWriteBlocked) {
    throw new Error(PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY);
  }
  const generation = accountBoundaryGeneration;
  const pending = operation(generation);
  inFlightOperations.add(pending);
  try {
    return await pending;
  } finally {
    inFlightOperations.delete(pending);
  }
}

async function runSerializedPrivateMutation<T>(
  key: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = privateMutationTails.get(key) ?? Promise.resolve();
  const ready = previous.catch(() => undefined);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = ready.then(() => gate);
  privateMutationTails.set(key, tail);

  await ready;
  try {
    return await operation();
  } finally {
    release();
    if (privateMutationTails.get(key) === tail) privateMutationTails.delete(key);
  }
}

async function runSerializedPrivateMutations<T>(
  keys: readonly string[],
  operation: () => Promise<T>,
): Promise<T> {
  const orderedKeys = [...new Set(keys)].sort();
  const acquire = (index: number): Promise<T> =>
    index >= orderedKeys.length
      ? operation()
      : runSerializedPrivateMutation(orderedKeys[index]!, () => acquire(index + 1));
  return acquire(0);
}

function assertAccountScopedPrivateOperationAllowed(generation: number): void {
  if (accountBoundaryWriteBlocked || generation !== accountBoundaryGeneration) {
    throw new Error(PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY);
  }
}

async function getExistingContentKey(migrate = false): Promise<Uint8Array | null> {
  const stored = migrate
    ? await migrateStoredPrivateKVContentKey()
    : await getStoredPrivateKVContentKey();
  if (!stored) return null;
  if (!/^[0-9a-f]{64}$/i.test(stored)) {
    throw new Error(PRIVATE_KV_CONTENT_KEY_INVALID);
  }
  try {
    const key = hexToBytes(stored);
    if (key.byteLength !== 32) throw new Error(PRIVATE_KV_CONTENT_KEY_INVALID);
    return key;
  } catch {
    throw new Error(PRIVATE_KV_CONTENT_KEY_INVALID);
  }
}

async function hasOrphanedPrivateCiphertext(): Promise<boolean> {
  const candidateKeys = (await AsyncStorage.getAllKeys()).filter(
    (key) => key !== PRIVATE_KV_CONTENT_KEY_NAME && !isKnownForeignStorageKey(key),
  );
  if (candidateKeys.length === 0) return false;
  const entries = await AsyncStorage.multiGet(candidateKeys);
  return entries.some(([key, raw]) => {
    if (raw === null) return false;
    const classification = classifyEnvelope(key, raw);
    return (
      classification.kind === 'current' ||
      classification.kind === 'malformed' ||
      classification.kind === 'unsupported'
    );
  });
}

async function getOrCreateContentKey(): Promise<Uint8Array> {
  const existing = await getExistingContentKey(true);
  if (existing) return existing;

  if (!contentKeyCreation) {
    contentKeyCreation = (async () => {
      const rechecked = await getExistingContentKey(true);
      if (rechecked) return rechecked;
      if (await hasOrphanedPrivateCiphertext()) {
        throw new Error(PRIVATE_KV_CONTENT_KEY_MISSING);
      }

      const key = randomBytes(32);
      await setStoredPrivateKVContentKey(bytesToHex(key));
      return key;
    })();
  }

  const pending = contentKeyCreation;
  try {
    return await pending;
  } finally {
    if (contentKeyCreation === pending) contentKeyCreation = null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isHex(value: unknown, expectedBytes?: number): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length % 2 !== 0) return false;
  if (expectedBytes !== undefined && value.length !== expectedBytes * 2) return false;
  return /^[0-9a-f]+$/i.test(value);
}

function rawLooksLikeEncryptedEnvelope(raw: string): boolean {
  return (
    /["']version["']\s*:\s*["']xchacha/i.test(raw) ||
    (/["']nonceHex["']\s*:/i.test(raw) && /["']ciphertextHex["']\s*:/i.test(raw))
  );
}

function isPrivateKVOwnedKey(key: string): boolean {
  return key.startsWith(LEGACY_PRIVATE_KV_PREFIX) || key.startsWith('routinekind.');
}

function isKnownForeignStorageKey(key: string): boolean {
  return /^sb-[a-z0-9][a-z0-9-]*-auth-token(?:-code-verifier)?$/i.test(key);
}

function assertPrivateDataKey(key: string): void {
  if (key === PRIVATE_KV_CONTENT_KEY_NAME) throw new Error(PRIVATE_KV_RESERVED_KEY);
  if (isKnownForeignStorageKey(key)) throw new Error(PRIVATE_KV_ENVELOPE_FOREIGN);
}

function classifyEnvelope(key: string, raw: string): EnvelopeClassification {
  const appOwned = isPrivateKVOwnedKey(key);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return appOwned && rawLooksLikeEncryptedEnvelope(raw)
      ? { kind: 'malformed' }
      : { kind: 'legacy' };
  }

  if (!isRecord(parsed)) return { kind: 'legacy' };

  const versionLooksEncrypted =
    typeof parsed.version === 'string' && parsed.version.startsWith('xchacha20poly1305:');
  const hasCipherFields = hasOwn(parsed, 'nonceHex') && hasOwn(parsed, 'ciphertextHex');
  if (!versionLooksEncrypted && !hasCipherFields) return { kind: 'legacy' };

  // Unmarked legacy or third-party payloads remain outside this authority. A
  // complete current private-KV envelope is still recognized at an older or
  // custom key, but only app-owned keys can claim malformed/future envelopes.
  if (!appOwned) {
    if (
      parsed.version !== ENCRYPTION_VERSION ||
      (hasOwn(parsed, 'keyId') && parsed.keyId !== undefined) ||
      !isHex(parsed.nonceHex, NONCE_BYTES) ||
      !isHex(parsed.ciphertextHex) ||
      parsed.ciphertextHex.length < 32
    ) {
      return { kind: 'legacy' };
    }
  }

  if (hasOwn(parsed, 'keyId') && parsed.keyId !== undefined) return { kind: 'malformed' };
  if (parsed.version !== ENCRYPTION_VERSION) {
    return versionLooksEncrypted ? { kind: 'unsupported' } : { kind: 'malformed' };
  }
  if (!isHex(parsed.nonceHex, NONCE_BYTES) || !isHex(parsed.ciphertextHex)) {
    return { kind: 'malformed' };
  }
  // XChaCha20-Poly1305 always carries a 16-byte authentication tag.
  if (parsed.ciphertextHex.length < 32) return { kind: 'malformed' };

  return {
    kind: 'current',
    envelope: {
      version: ENCRYPTION_VERSION,
      nonceHex: parsed.nonceHex,
      ciphertextHex: parsed.ciphertextHex,
    },
  };
}

function envelopeClassificationError(kind: 'malformed' | 'unsupported'): Error {
  if (kind === 'unsupported') return new Error(PRIVATE_KV_ENVELOPE_UNSUPPORTED);
  return new Error(PRIVATE_KV_ENVELOPE_INVALID);
}

function decryptEnvelope(envelope: PrivateEnvelope, contentKey: Uint8Array): string {
  const plaintext = xchacha20poly1305(contentKey, hexToBytes(envelope.nonceHex)).decrypt(
    hexToBytes(envelope.ciphertextHex),
  );
  return bytesToUtf8(plaintext);
}

function rememberFailedRead(key: string, raw: string): void {
  failedReadSnapshots.set(key, raw);
}

async function assertNoFailedReadRewrite(key: string): Promise<string | null> {
  const failedSnapshot = failedReadSnapshots.get(key);
  const current = await AsyncStorage.getItem(key);
  if (failedSnapshot !== undefined && current === failedSnapshot) {
    throw new Error(PRIVATE_KV_WRITE_BLOCKED_AFTER_READ_FAILURE);
  }
  if (failedSnapshot !== undefined) failedReadSnapshots.delete(key);
  return current;
}

async function assertRoutineRemovalReadable(key: string, raw: string | null): Promise<void> {
  if (raw === null) return;

  const classification = classifyEnvelope(key, raw);
  if (classification.kind === 'legacy') return;
  if (classification.kind === 'malformed' || classification.kind === 'unsupported') {
    rememberFailedRead(key, raw);
    throw envelopeClassificationError(classification.kind);
  }

  let contentKey: Uint8Array | null;
  try {
    contentKey = await getExistingContentKey();
  } catch (error) {
    rememberFailedRead(key, raw);
    throw error;
  }
  if (!contentKey) {
    rememberFailedRead(key, raw);
    throw new Error(PRIVATE_KV_CONTENT_KEY_MISSING);
  }
  try {
    decryptEnvelope(classification.envelope, contentKey);
  } catch {
    rememberFailedRead(key, raw);
    throw new Error(PRIVATE_KV_DECRYPTION_FAILED);
  }
}

export async function getPrivateItem(key: string): Promise<string | null> {
  return withOperationTiming('private_kv_read', () =>
    runAccountScopedPrivateOperation(async () => {
      assertPrivateDataKey(key);
      const raw = await AsyncStorage.getItem(key);
      if (raw === null) {
        failedReadSnapshots.delete(key);
        return null;
      }

      const classification = classifyEnvelope(key, raw);
      if (classification.kind === 'legacy') {
        failedReadSnapshots.delete(key);
        return raw;
      }
      if (classification.kind === 'malformed' || classification.kind === 'unsupported') {
        rememberFailedRead(key, raw);
        throw envelopeClassificationError(classification.kind);
      }

      let contentKey: Uint8Array | null;
      try {
        contentKey = await getExistingContentKey();
      } catch (error) {
        rememberFailedRead(key, raw);
        throw error;
      }
      if (!contentKey) {
        rememberFailedRead(key, raw);
        throw new Error(PRIVATE_KV_CONTENT_KEY_MISSING);
      }
      try {
        const value = decryptEnvelope(classification.envelope, contentKey);
        failedReadSnapshots.delete(key);
        return value;
      } catch {
        rememberFailedRead(key, raw);
        throw new Error(PRIVATE_KV_DECRYPTION_FAILED);
      }
    }),
  );
}

function classifyPrivateKVReadFailure(
  error: unknown,
): Exclude<PrivateKVReadResult, { status: 'absent' } | { status: 'available'; value: string }> {
  const message = error instanceof Error ? error.message : '';
  if (message === PRIVATE_KV_ENVELOPE_UNSUPPORTED) return { status: 'unsupported_version' };
  if (message === PRIVATE_KV_CONTENT_KEY_INVALID) {
    return { status: 'corrupt', reason: 'content_key_invalid' };
  }
  if (message === PRIVATE_KV_ENVELOPE_INVALID) {
    return { status: 'corrupt', reason: 'envelope_invalid' };
  }
  if (message === PRIVATE_KV_DECRYPTION_FAILED) {
    return { status: 'corrupt', reason: 'decryption_failed' };
  }
  if (message === PRIVATE_KV_CONTENT_KEY_MISSING) {
    return { status: 'unavailable', reason: 'content_key_missing' };
  }
  if (message === PRIVATE_KV_CONTENT_KEY_CONFLICT) {
    return { status: 'unavailable', reason: 'content_key_conflict' };
  }
  if (message === PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE) {
    return { status: 'unavailable', reason: 'content_key_storage_unavailable' };
  }
  if (message === PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY) {
    return { status: 'unavailable', reason: 'account_boundary' };
  }
  return { status: 'unavailable', reason: 'storage_unavailable' };
}

/**
 * Typed read boundary for domain stores. Unlike boolean/default convenience
 * APIs, this never turns unavailable, corrupt, or future private state into an
 * ordinary absence or valid empty value.
 */
export async function readPrivateItem(key: string): Promise<PrivateKVReadResult> {
  try {
    const value = await getPrivateItem(key);
    return value === null ? { status: 'absent' } : { status: 'available', value };
  } catch (error) {
    return classifyPrivateKVReadFailure(error);
  }
}

export async function getPrivateItems(
  keys: readonly string[],
): Promise<Map<string, string | null>> {
  return withOperationTiming('private_kv_batch_read', () =>
    runAccountScopedPrivateOperation(async () => {
      for (const key of keys) assertPrivateDataKey(key);
      const entries = await AsyncStorage.multiGet([...keys]);
      const result = new Map<string, string | null>();
      const encryptedEntries: [string, PrivateEnvelope, string][] = [];

      for (const [key, raw] of entries) {
        if (raw === null) {
          failedReadSnapshots.delete(key);
          result.set(key, null);
          continue;
        }
        const classification = classifyEnvelope(key, raw);
        if (classification.kind === 'current') {
          encryptedEntries.push([key, classification.envelope, raw]);
        } else if (classification.kind === 'malformed' || classification.kind === 'unsupported') {
          rememberFailedRead(key, raw);
          throw envelopeClassificationError(classification.kind);
        } else {
          failedReadSnapshots.delete(key);
          result.set(key, raw);
        }
      }

      if (encryptedEntries.length === 0) return result;
      let contentKey: Uint8Array | null;
      try {
        contentKey = await getExistingContentKey();
      } catch (error) {
        for (const [key, , raw] of encryptedEntries) rememberFailedRead(key, raw);
        throw error;
      }
      if (!contentKey) {
        for (const [key, , raw] of encryptedEntries) rememberFailedRead(key, raw);
        throw new Error(PRIVATE_KV_CONTENT_KEY_MISSING);
      }
      for (const [key, envelope, raw] of encryptedEntries) {
        try {
          result.set(key, decryptEnvelope(envelope, contentKey));
          failedReadSnapshots.delete(key);
        } catch {
          rememberFailedRead(key, raw);
          throw new Error(PRIVATE_KV_DECRYPTION_FAILED);
        }
      }
      return result;
    }),
  );
}

/** Verify every private-KV envelope without creating key material or retaining plaintext. */
export async function assertPrivateKVReadable(): Promise<void> {
  const keys = (await AsyncStorage.getAllKeys()).filter(
    (key) => key !== PRIVATE_KV_CONTENT_KEY_NAME && !isKnownForeignStorageKey(key),
  );
  if (keys.length === 0) return;
  await getPrivateItems(keys);
}

const CONFLICT_CHOICE_STORAGE_KEY = 'onskin.conflict.overrides';
let devConflictChoiceWriteFailureUsed = false;

async function maybeRejectConflictChoiceWrite(key: string): Promise<void> {
  const enabled =
    typeof __DEV__ !== 'undefined' &&
    __DEV__ &&
    process.env.EXPO_PUBLIC_E2E_CONFLICT_CHOICE_SAVE_FAILURE === 'once';
  if (!enabled || key !== CONFLICT_CHOICE_STORAGE_KEY || devConflictChoiceWriteFailureUsed) return;
  devConflictChoiceWriteFailureUsed = true;
  await new Promise((resolve) => setTimeout(resolve, 600));
  throw new Error('E2E_CONFLICT_CHOICE_PRIVATE_WRITE_FAILURE');
}

export async function setPrivateItem(key: string, value: string): Promise<void> {
  return updatePrivateItem(key, () => value);
}

/** Atomically read, transform, and persist one private value under the same
 * account-generation guard and per-key mutation lock. The updater is
 * synchronous so no untracked work can cross an account boundary. */
export async function updatePrivateItem(
  key: string,
  updater: (current: string | null) => string | null,
): Promise<void> {
  return withOperationTiming('private_kv_write', () =>
    runAccountScopedPrivateOperation((generation) =>
      runSerializedPrivateMutations([key], async () => {
        assertPrivateDataKey(key);
        assertAccountScopedPrivateOperationAllowed(generation);
        const existingRaw = await assertNoFailedReadRewrite(key);
        const existingClassification = existingRaw ? classifyEnvelope(key, existingRaw) : null;
        if (
          existingRaw &&
          existingClassification &&
          (existingClassification.kind === 'malformed' ||
            existingClassification.kind === 'unsupported')
        ) {
          rememberFailedRead(key, existingRaw);
          throw envelopeClassificationError(existingClassification.kind);
        }
        let contentKey: Uint8Array | null = null;
        let currentValue: string | null = null;
        if (existingClassification?.kind === 'current' && existingRaw) {
          try {
            contentKey = await getExistingContentKey();
          } catch (error) {
            rememberFailedRead(key, existingRaw);
            throw error;
          }
          if (!contentKey) {
            rememberFailedRead(key, existingRaw);
            throw new Error(PRIVATE_KV_CONTENT_KEY_MISSING);
          }
          try {
            currentValue = decryptEnvelope(existingClassification.envelope, contentKey);
          } catch {
            rememberFailedRead(key, existingRaw);
            throw new Error(PRIVATE_KV_DECRYPTION_FAILED);
          }
        } else if (existingClassification?.kind === 'legacy' && existingRaw) {
          currentValue = existingRaw;
        }

        const nextValue = updater(currentValue);
        if (
          nextValue === currentValue &&
          (nextValue === null || existingClassification?.kind === 'current')
        ) {
          return;
        }

        const latestRaw = await AsyncStorage.getItem(key);
        if (latestRaw !== existingRaw) {
          if (latestRaw !== null) rememberFailedRead(key, latestRaw);
          throw new Error(PRIVATE_KV_WRITE_CONFLICT);
        }
        assertAccountScopedPrivateOperationAllowed(generation);

        if (nextValue === null) {
          await AsyncStorage.removeItem(key);
          failedReadSnapshots.delete(key);
          return;
        }

        contentKey ??= await getOrCreateContentKey();
        const nonce = randomBytes(NONCE_BYTES);
        const ciphertext = xchacha20poly1305(contentKey, nonce).encrypt(utf8ToBytes(nextValue));
        const envelope: PrivateEnvelope = {
          version: ENCRYPTION_VERSION,
          nonceHex: bytesToHex(nonce),
          ciphertextHex: bytesToHex(ciphertext),
        };
        await maybeRejectConflictChoiceWrite(key);
        await AsyncStorage.setItem(key, JSON.stringify(envelope));
        failedReadSnapshots.delete(key);
      }),
    ),
  );
}

export function beginPrivateKVAccountBoundary(): void {
  if (accountBoundaryWriteBlockDepth === 0) accountBoundaryGeneration += 1;
  accountBoundaryWriteBlockDepth += 1;
  accountBoundaryWriteBlocked = true;
}

export async function waitForPrivateKVWritesToSettle(): Promise<void> {
  while (inFlightOperations.size > 0) {
    await Promise.allSettled([...inFlightOperations]);
  }
}

export function endPrivateKVAccountBoundary(): void {
  accountBoundaryWriteBlockDepth = Math.max(0, accountBoundaryWriteBlockDepth - 1);
  accountBoundaryWriteBlocked = accountBoundaryWriteBlockDepth > 0;
}

export async function removePrivateItem(key: string): Promise<void> {
  return withOperationTiming('private_kv_remove', () =>
    runAccountScopedPrivateOperation((generation) =>
      runSerializedPrivateMutations([key], async () => {
        assertPrivateDataKey(key);
        assertAccountScopedPrivateOperationAllowed(generation);
        const snapshot = await assertNoFailedReadRewrite(key);
        await assertRoutineRemovalReadable(key, snapshot);
        assertAccountScopedPrivateOperationAllowed(generation);
        const current = await AsyncStorage.getItem(key);
        if (current !== snapshot) throw new Error(PRIVATE_KV_WRITE_CONFLICT);
        if (snapshot === null) return;
        assertAccountScopedPrivateOperationAllowed(generation);
        await AsyncStorage.removeItem(key);
        failedReadSnapshots.delete(key);
      }),
    ),
  );
}

export async function multiRemovePrivateItems(keys: readonly string[]): Promise<void> {
  return runAccountScopedPrivateOperation((generation) =>
    runSerializedPrivateMutations(keys, async () => {
      const uniqueKeys = [...new Set(keys)];
      for (const key of uniqueKeys) assertPrivateDataKey(key);
      assertAccountScopedPrivateOperationAllowed(generation);
      const snapshots = new Map<string, string | null>();
      for (const key of uniqueKeys) {
        const snapshot = await assertNoFailedReadRewrite(key);
        await assertRoutineRemovalReadable(key, snapshot);
        snapshots.set(key, snapshot);
      }
      assertAccountScopedPrivateOperationAllowed(generation);
      const currentEntries = await AsyncStorage.multiGet(uniqueKeys);
      if (currentEntries.some(([key, current]) => current !== snapshots.get(key))) {
        throw new Error(PRIVATE_KV_WRITE_CONFLICT);
      }
      const presentKeys = uniqueKeys.filter((key) => snapshots.get(key) !== null);
      if (presentKeys.length === 0) return;
      assertAccountScopedPrivateOperationAllowed(generation);
      await AsyncStorage.multiRemove(presentKeys);
      for (const key of presentKeys) failedReadSnapshots.delete(key);
    }),
  );
}

/**
 * Bypasses ciphertext authentication only for a caller that has already
 * established destructive authority, such as drained account isolation or a
 * device-authenticated, user-approved recovery. Routine feature deletion must
 * use removePrivateItem/multiRemovePrivateItems instead.
 */
export async function removePrivateItemsForAuthorizedReset(
  keys: readonly string[],
  reason: PrivateKVAuthorizedResetReason,
): Promise<void> {
  return withOperationTiming('private_kv_remove', async () => {
    if (reason !== 'account_isolation' && reason !== 'device_authenticated_app_lock_repair') {
      throw new Error(PRIVATE_KV_AUTHORIZED_RESET_REASON_INVALID);
    }
    if (
      (reason === 'account_isolation' && !accountBoundaryWriteBlocked) ||
      (reason === 'device_authenticated_app_lock_repair' && accountBoundaryWriteBlocked)
    ) {
      throw new Error(PRIVATE_KV_AUTHORIZED_RESET_REASON_INVALID);
    }
    const uniqueKeys = [...new Set(keys)];
    if (
      (reason === 'account_isolation' &&
        uniqueKeys.some((key) => !ACCOUNT_ISOLATION_RESET_KEYS.has(key))) ||
      (reason === 'device_authenticated_app_lock_repair' &&
        (uniqueKeys.length !== 1 || uniqueKeys[0] !== DEVICE_AUTHENTICATED_APP_LOCK_REPAIR_KEY))
    ) {
      throw new Error(PRIVATE_KV_AUTHORIZED_RESET_REASON_INVALID);
    }
    const pending = runSerializedPrivateMutations(uniqueKeys, async () => {
      for (const key of uniqueKeys) assertPrivateDataKey(key);
      await AsyncStorage.multiRemove(uniqueKeys);
      for (const key of uniqueKeys) failedReadSnapshots.delete(key);
    });
    inFlightOperations.add(pending);
    try {
      await pending;
    } finally {
      inFlightOperations.delete(pending);
    }
  });
}

export async function clearPrivateKVContentKey(): Promise<void> {
  await clearStoredPrivateKVContentKey();
  failedReadSnapshots.clear();
}

export const privateKVEncryptionInfo = {
  version: ENCRYPTION_VERSION,
  secureStoreKey: PRIVATE_KV_CONTENT_KEY_NAME,
} as const;
