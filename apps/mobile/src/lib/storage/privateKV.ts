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
  PRIVATE_KV_CONTENT_KEY_NAME,
  clearStoredPrivateKVContentKey,
  getStoredPrivateKVContentKey,
  setStoredPrivateKVContentKey,
} from './privateKVContentKey';
import {
  assertHealthDataWriteLease,
  captureHealthPurposePrivateDataWriteLease,
  type HealthDataWriteLease,
} from '@/lib/consent/healthDataWriteAdmission';
import {
  runAccountGenerationOperation,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
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

async function getExistingContentKey(): Promise<Uint8Array | null> {
  const stored = await getStoredPrivateKVContentKey();
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
  const existing = await getExistingContentKey();
  if (existing) return existing;

  if (!contentKeyCreation) {
    contentKeyCreation = (async () => {
      const rechecked = await getExistingContentKey();
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

function decryptEnvelopeBytes(envelope: PrivateEnvelope, contentKey: Uint8Array): Uint8Array {
  return xchacha20poly1305(contentKey, hexToBytes(envelope.nonceHex)).decrypt(
    hexToBytes(envelope.ciphertextHex),
  );
}

function decryptEnvelope(envelope: PrivateEnvelope, contentKey: Uint8Array): string {
  const plaintext = decryptEnvelopeBytes(envelope, contentKey);
  try {
    return bytesToUtf8(plaintext);
  } finally {
    plaintext.fill(0);
  }
}

/** Authenticate one envelope without materializing a JavaScript string. */
function validateEnvelopeAuthentication(envelope: PrivateEnvelope, contentKey: Uint8Array): void {
  const plaintext = decryptEnvelopeBytes(envelope, contentKey);
  plaintext.fill(0);
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

export async function getPrivateItem(key: string): Promise<string | null> {
  // Capture before the first await. Classified health-purpose bytes may be
  // returned only to the exact processing lease that began the read.
  const healthReadLease = captureHealthPurposePrivateDataWriteLease(key);
  const assertHealthReadCurrent = () => {
    if (healthReadLease !== null) assertHealthDataWriteLease(healthReadLease);
  };
  return withOperationTiming('private_kv_read', () =>
    runAccountScopedPrivateOperation(async () => {
      assertPrivateDataKey(key);
      const raw = await AsyncStorage.getItem(key);
      assertHealthReadCurrent();
      if (!raw) {
        failedReadSnapshots.delete(key);
        return null;
      }

      const classification = classifyEnvelope(key, raw);
      if (classification.kind === 'legacy') {
        failedReadSnapshots.delete(key);
        assertHealthReadCurrent();
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
      assertHealthReadCurrent();
      if (!contentKey) {
        rememberFailedRead(key, raw);
        throw new Error(PRIVATE_KV_CONTENT_KEY_MISSING);
      }
      let value: string;
      try {
        value = decryptEnvelope(classification.envelope, contentKey);
      } catch {
        rememberFailedRead(key, raw);
        throw new Error(PRIVATE_KV_DECRYPTION_FAILED);
      }
      failedReadSnapshots.delete(key);
      assertHealthReadCurrent();
      return value;
    }),
  );
}

async function readPrivateItems(
  keys: readonly string[],
  enforceHealthPurposeLease: boolean,
  assertPurposeCurrent: () => void = () => undefined,
): Promise<Map<string, string | null>> {
  const healthReadLeases = enforceHealthPurposeLease
    ? keys
        .map((key) => captureHealthPurposePrivateDataWriteLease(key))
        .filter((lease): lease is HealthDataWriteLease => lease !== null)
    : [];
  const assertHealthReadsCurrent = () => {
    assertPurposeCurrent();
    for (const lease of healthReadLeases) assertHealthDataWriteLease(lease);
  };
  assertHealthReadsCurrent();
  return withOperationTiming('private_kv_batch_read', () =>
    runAccountScopedPrivateOperation(async () => {
      assertHealthReadsCurrent();
      for (const key of keys) assertPrivateDataKey(key);
      const entries = await AsyncStorage.multiGet([...keys]);
      assertHealthReadsCurrent();
      const result = new Map<string, string | null>();
      const encryptedEntries: [string, PrivateEnvelope, string][] = [];

      for (const [key, raw] of entries) {
        if (!raw) {
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

      if (encryptedEntries.length === 0) {
        assertHealthReadsCurrent();
        return result;
      }
      let contentKey: Uint8Array | null;
      try {
        contentKey = await getExistingContentKey();
      } catch (error) {
        for (const [key, , raw] of encryptedEntries) rememberFailedRead(key, raw);
        throw error;
      }
      assertHealthReadsCurrent();
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
      assertHealthReadsCurrent();
      return result;
    }),
  );
}

export function getPrivateItems(keys: readonly string[]): Promise<Map<string, string | null>> {
  return readPrivateItems(keys, true);
}

/**
 * Data-rights-only read lane. The caller must already have verified the local
 * data owner inside this exact account-generation operation. It intentionally
 * does not require an active health-processing lease, so export remains
 * available while processing is paused or withdrawn. No feature or cache may
 * use this API for personalization or ordinary reads.
 */
export function getPrivateItemsForPurposeLimitedExport(
  keys: readonly string[],
  accountLease: AccountGenerationLease,
): Promise<Map<string, string | null>> {
  accountLease.assertCurrent();
  return readPrivateItems(keys, false, accountLease.assertCurrent);
}

async function validatePrivateItemsWithoutRetainingPlaintext(
  keys: readonly string[],
  assertCurrent: () => void,
): Promise<void> {
  assertCurrent();
  await withOperationTiming('private_kv_batch_read', () =>
    runAccountScopedPrivateOperation(async () => {
      assertCurrent();
      for (const key of keys) assertPrivateDataKey(key);
      const entries = await AsyncStorage.multiGet([...keys]);
      assertCurrent();
      const encryptedEntries: [string, PrivateEnvelope, string][] = [];

      for (const [key, raw] of entries) {
        assertCurrent();
        if (!raw) {
          failedReadSnapshots.delete(key);
          continue;
        }
        const classification = classifyEnvelope(key, raw);
        if (classification.kind === 'current') {
          encryptedEntries.push([key, classification.envelope, raw]);
        } else if (classification.kind === 'malformed' || classification.kind === 'unsupported') {
          rememberFailedRead(key, raw);
          throw envelopeClassificationError(classification.kind);
        } else {
          // Legacy plaintext needs only structural availability. Do not copy it
          // into a result map or decode/transform it during this startup gate.
          failedReadSnapshots.delete(key);
        }
      }

      if (encryptedEntries.length === 0) return;
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

      try {
        assertCurrent();
        for (const [key, envelope, raw] of encryptedEntries) {
          assertCurrent();
          try {
            validateEnvelopeAuthentication(envelope, contentKey);
            failedReadSnapshots.delete(key);
          } catch {
            rememberFailedRead(key, raw);
            throw new Error(PRIVATE_KV_DECRYPTION_FAILED);
          }
        }
        assertCurrent();
      } finally {
        contentKey.fill(0);
      }
    }),
  );
  assertCurrent();
}

/** Verify every private-KV envelope without creating or retaining plaintext. */
export function assertPrivateKVReadable(): Promise<void> {
  return runAccountGenerationOperation(async (accountLease) => {
    accountLease.assertCurrent();
    const keys = (await AsyncStorage.getAllKeys()).filter(
      (key) => key !== PRIVATE_KV_CONTENT_KEY_NAME && !isKnownForeignStorageKey(key),
    );
    accountLease.assertCurrent();
    if (keys.length === 0) return;
    // This purpose-limited bypass stays private to the availability gate. It
    // authenticates bytes before lifecycle reconciliation opens health reads,
    // never UTF-8 decodes them, and remains account-generation-bound.
    await validatePrivateItemsWithoutRetainingPlaintext(keys, accountLease.assertCurrent);
  });
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
  // Generic read/transform/update may expose plaintext to its callback, so a
  // classified key requires exact health authority up front even if the
  // callback later returns null. Privacy-reducing callers use the explicit
  // remove APIs, which never decrypt or expose the prior value.
  const healthWriteLease = captureHealthPurposePrivateDataWriteLease(key);
  const assertHealthMutationCurrent = () => {
    if (healthWriteLease !== null) assertHealthDataWriteLease(healthWriteLease);
  };

  return withOperationTiming('private_kv_write', () =>
    runAccountScopedPrivateOperation((generation) =>
      runSerializedPrivateMutations([key], async () => {
        assertPrivateDataKey(key);
        assertAccountScopedPrivateOperationAllowed(generation);
        const existingRaw = await assertNoFailedReadRewrite(key);
        assertHealthMutationCurrent();
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
          assertHealthMutationCurrent();
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

        assertHealthMutationCurrent();
        const nextValue = updater(currentValue);
        assertHealthMutationCurrent();
        if (
          nextValue === currentValue &&
          (nextValue === null || existingClassification?.kind === 'current')
        ) {
          return;
        }

        const latestRaw = await AsyncStorage.getItem(key);
        assertHealthMutationCurrent();
        if (latestRaw !== existingRaw) {
          if (latestRaw !== null) rememberFailedRead(key, latestRaw);
          throw new Error(PRIVATE_KV_WRITE_CONFLICT);
        }
        assertAccountScopedPrivateOperationAllowed(generation);

        if (nextValue === null) {
          assertHealthMutationCurrent();
          await AsyncStorage.removeItem(key);
          assertHealthMutationCurrent();
          failedReadSnapshots.delete(key);
          return;
        }

        contentKey ??= await getOrCreateContentKey();
        assertHealthMutationCurrent();
        const nonce = randomBytes(NONCE_BYTES);
        const ciphertext = xchacha20poly1305(contentKey, nonce).encrypt(utf8ToBytes(nextValue));
        const envelope: PrivateEnvelope = {
          version: ENCRYPTION_VERSION,
          nonceHex: bytesToHex(nonce),
          ciphertextHex: bytesToHex(ciphertext),
        };
        await maybeRejectConflictChoiceWrite(key);
        assertHealthMutationCurrent();
        const committedRaw = JSON.stringify(envelope);
        if (healthWriteLease !== null) assertHealthDataWriteLease(healthWriteLease);
        await AsyncStorage.setItem(key, committedRaw);
        if (healthWriteLease !== null) {
          try {
            assertHealthDataWriteLease(healthWriteLease);
          } catch (error) {
            // The write crossed a withdrawal, expiry, owner change, or re-grant.
            // Roll back only while this account generation and serialized key
            // slot still own the exact value just committed. An account cleanup
            // that already invalidated us remains authoritative and must not be
            // followed by restoration of prior-account bytes.
            try {
              assertAccountScopedPrivateOperationAllowed(generation);
              const currentRaw = await AsyncStorage.getItem(key);
              assertAccountScopedPrivateOperationAllowed(generation);
              if (currentRaw === committedRaw) {
                if (existingRaw === null) {
                  await AsyncStorage.removeItem(key);
                } else {
                  await AsyncStorage.setItem(key, existingRaw);
                }
              }
            } catch {
              // Account-boundary cleanup drains this tracked operation and then
              // removes prior-owner state. Never write around that boundary.
            }
            throw error;
          }
        }
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
        await AsyncStorage.removeItem(key);
        failedReadSnapshots.delete(key);
      }),
    ),
  );
}

export async function multiRemovePrivateItems(keys: readonly string[]): Promise<void> {
  return runAccountScopedPrivateOperation((generation) =>
    runSerializedPrivateMutations(keys, async () => {
      for (const key of keys) assertPrivateDataKey(key);
      assertAccountScopedPrivateOperationAllowed(generation);
      await AsyncStorage.multiRemove([...keys]);
      for (const key of keys) failedReadSnapshots.delete(key);
    }),
  );
}

export async function clearPrivateKVContentKey(): Promise<void> {
  await clearStoredPrivateKVContentKey();
  failedReadSnapshots.clear();
}

export const privateKVEncryptionInfo = {
  version: ENCRYPTION_VERSION,
  secureStoreKey: PRIVATE_KV_CONTENT_KEY_NAME,
} as const;
