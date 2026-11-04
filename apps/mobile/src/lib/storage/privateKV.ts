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
  isHealthPurposePrivateDataKey,
  type HealthDataWriteLease,
} from '@/lib/consent/healthDataWriteAdmission';
import {
  runAccountGenerationOperation,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { withOperationTiming } from '@/lib/observability/operationTiming';
import { clearActiveHealthProcessingEpoch } from '@/lib/consent/healthProcessingEpoch';
import {
  armPlanHistoryMutation45,
  armPrivateMutation46,
  abandonPrivateMutation46,
  waitForPrivateMutationReadWindow46,
  clearPrivateMutationAfterRemoval46,
  assertPrivateMutationReadable46,
  assertPrivateMutationReadGeneration46,
  assertPrivateMutationWritable46,
  finishPrivateMutation46,
  privateMutationReadGeneration46,
  type PrivateMutationIntent46,
  assertPlanHistoryReadable45,
  finishPlanHistoryMutation45,
  type PlanHistoryMutationIntent45,
} from '@/lib/auth/localAccountIsolation';

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
export const PRIVATE_KV_RECOVERY_REQUIRED = 'PRIVATE_KV_RECOVERY_REQUIRED';
export const PRIVATE_KV_WRITE_BLOCKED_AFTER_READ_FAILURE =
  'PRIVATE_KV_WRITE_BLOCKED_AFTER_READ_FAILURE';
export const PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY =
  'PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY';
export const PRIVATE_KV_WRITE_ROLLBACK_FAILED = 'PRIVATE_KV_WRITE_ROLLBACK_FAILED';

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
const quarantinedMutationKeys = new Set<string>();
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
  return key.startsWith(LEGACY_PRIVATE_KV_PREFIX) || key.startsWith('layerwell.');
}

function isKnownForeignStorageKey(key: string): boolean {
  // Photo privacy-cleanup obligations use their own LargeSecureStore key and
  // authenticated envelope. They are not ordinary health/private-KV data and
  // must neither decrypt under this key nor poison startup after sign-out.
  if (/^layerwell\.photoDeleteCleanup\.v1\.[a-f0-9]{64}$/.test(key)) return true;
  return /^sb-[a-z0-9][a-z0-9-]*-auth-token(?:-code-verifier)?$/i.test(key);
}

function assertPrivateDataKey(key: string): void {
  if (key === PRIVATE_KV_CONTENT_KEY_NAME) throw new Error(PRIVATE_KV_RESERVED_KEY);
  if (isKnownForeignStorageKey(key)) throw new Error(PRIVATE_KV_ENVELOPE_FOREIGN);
}

function assertPrivateReadAllowed(key: string): void {
  assertPrivateDataKey(key);
  if (quarantinedMutationKeys.has(key)) throw new Error(PRIVATE_KV_RECOVERY_REQUIRED);
}

async function assertHistoryKeysReadable45(keys: readonly string[]): Promise<void> {
  if (keys.includes('layerwell.routinePlanHistory.v1')) await assertPlanHistoryReadable45();
}

function rejectLegacyHistoryRaw45(key: string, raw: string | null): void {
  // This new key has no plaintext legacy format. In particular, native '' is
  // invalid data, never the null absence used by the strict history decoder.
  if (key === 'layerwell.routinePlanHistory.v1' && raw !== null &&
      classifyEnvelope(key, raw).kind === 'legacy') {
    rememberFailedRead(key, raw);
    throw new Error(PRIVATE_KV_SOURCE_UNAUTHENTICATED);
  }
}

function assertHistoryBatchShape45(keys: readonly string[], entries: unknown): void {
  const historyKey = 'layerwell.routinePlanHistory.v1';
  const requested = keys.filter((key) => key === historyKey).length;
  if (!Array.isArray(entries)) throw new Error(PRIVATE_KV_ENVELOPE_INVALID);
  const rows = entries.filter((entry: unknown): entry is unknown[] => Array.isArray(entry) && entry[0] === historyKey);
  if (rows.length !== requested || rows.some((row) => row.length !== 2 ||
      (row[1] !== null && typeof row[1] !== 'string') || row[1] !== rows[0]?.[1])) {
    throw new Error(PRIVATE_KV_ENVELOPE_INVALID);
  }
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

function cipherForPrivateKey45(key: string, contentKey: Uint8Array, nonce: Uint8Array) {
  // Bind history to its fixed storage purpose. Native ciphertext copied under a
  // non-health key must not bypass history admission or recovery quarantine.
  // Other existing keys retain their original no-AAD encrypted format.
  const associatedData = key === 'layerwell.routinePlanHistory.v1' ? utf8ToBytes(key) : undefined;
  return xchacha20poly1305(contentKey, nonce, associatedData);
}

function decryptEnvelopeBytes(key: string, envelope: PrivateEnvelope, contentKey: Uint8Array): Uint8Array {
  return cipherForPrivateKey45(key, contentKey, hexToBytes(envelope.nonceHex)).decrypt(
    hexToBytes(envelope.ciphertextHex),
  );
}

function decryptEnvelope(key: string, envelope: PrivateEnvelope, contentKey: Uint8Array): string {
  const plaintext = decryptEnvelopeBytes(key, envelope, contentKey);
  try {
    return bytesToUtf8(plaintext);
  } finally {
    plaintext.fill(0);
  }
}

/** Authenticate one envelope without materializing a JavaScript string. */
function validateEnvelopeAuthentication(key: string, envelope: PrivateEnvelope, contentKey: Uint8Array): void {
  const plaintext = decryptEnvelopeBytes(key, envelope, contentKey);
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

function privateKVWriteRollbackFailure(cause: unknown): Error {
  const error = new Error(PRIVATE_KV_WRITE_ROLLBACK_FAILED) as Error & {
    cause?: unknown;
  };
  error.cause = cause;
  return error;
}

/**
 * Resolve a commit-then-reject or stale-authority mutation without guessing.
 *
 * The caller still owns the serialized key slot and remains registered as an
 * in-flight account-scoped operation. Account cleanup therefore waits for this
 * compensation even when the authority assertion that prompted it is stale.
 * A foreign value is never overwritten, and prior preservation is accepted
 * only after an exact raw-byte read-back.
 */
async function restoreExactRawAfterAmbiguousMutation(
  key: string,
  attemptedRaw: string | null,
  existingRaw: string | null,
): Promise<void> {
  let currentRaw: string | null;
  try {
    currentRaw = await AsyncStorage.getItem(key);
  } catch (error) {
    throw privateKVWriteRollbackFailure(error);
  }

  // The storage call rejected before committing, or another compensating
  // continuation already restored the exact prior state.
  if (currentRaw === existingRaw) return;

  // Never overwrite bytes that cannot be attributed to this mutation.
  if (currentRaw !== attemptedRaw) {
    throw privateKVWriteRollbackFailure(new Error(PRIVATE_KV_WRITE_CONFLICT));
  }

  let restoreError: unknown;
  try {
    if (existingRaw === null) {
      await AsyncStorage.removeItem(key);
    } else {
      await AsyncStorage.setItem(key, existingRaw);
    }
  } catch (error) {
    // AsyncStorage restoration can itself commit and then reject. Read back
    // below before deciding whether preservation actually failed.
    restoreError = error;
  }

  let restoredRaw: string | null;
  try {
    restoredRaw = await AsyncStorage.getItem(key);
  } catch (error) {
    throw privateKVWriteRollbackFailure(error);
  }
  if (restoredRaw !== existingRaw) {
    throw privateKVWriteRollbackFailure(restoreError ?? new Error(PRIVATE_KV_WRITE_CONFLICT));
  }
}

/** A read cannot span even a fully settled native mutation and reuse its raw
 * snapshot. The durable fence also survives module reload and prevents native
 * ciphertext relabeling through another public plaintext lane. */
function privateMutationReadGuard46(): () => Promise<void> {
  const generation = privateMutationReadGeneration46();
  return async () => {
    assertPrivateMutationReadGeneration46(generation);
    await assertPrivateMutationReadable46();
    assertPrivateMutationReadGeneration46(generation);
  };
}

export async function getPrivateItem(key: string): Promise<string | null> {
  const mutationReadGeneration46 = privateMutationReadGeneration46();
  const assertMutationReadCurrent46 = privateMutationReadGuard46();
  // Capture before the first await. Classified health-purpose bytes may be
  // returned only to the exact processing lease that began the read.
  const healthReadLease = captureHealthPurposePrivateDataWriteLease(key);
  const assertHealthReadCurrent = () => {
    assertPrivateMutationReadGeneration46(mutationReadGeneration46);
    assertPrivateReadAllowed(key);
    if (healthReadLease !== null) assertHealthDataWriteLease(healthReadLease);
  };
  return withOperationTiming('private_kv_read', () =>
    runAccountScopedPrivateOperation(async (generation) => {
      await assertMutationReadCurrent46();
      await assertHistoryKeysReadable45([key]);
      assertPrivateReadAllowed(key);
      const raw = await AsyncStorage.getItem(key);
      await assertMutationReadCurrent46();
      await assertHistoryKeysReadable45([key]);
      assertAccountScopedPrivateOperationAllowed(generation);
      assertHealthReadCurrent();
      rejectLegacyHistoryRaw45(key, raw);
      if (!raw) {
        failedReadSnapshots.delete(key);
        return null;
      }

      const classification = classifyEnvelope(key, raw);
      if (classification.kind === 'legacy') {
        failedReadSnapshots.delete(key);
        assertHealthReadCurrent();
        await assertMutationReadCurrent46();
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
      assertAccountScopedPrivateOperationAllowed(generation);
      await assertMutationReadCurrent46();
      assertHealthReadCurrent();
      if (!contentKey) {
        rememberFailedRead(key, raw);
        throw new Error(PRIVATE_KV_CONTENT_KEY_MISSING);
      }
      let value: string;
      try {
        value = decryptEnvelope(key, classification.envelope, contentKey);
      } catch {
        rememberFailedRead(key, raw);
        throw new Error(PRIVATE_KV_DECRYPTION_FAILED);
      }
      failedReadSnapshots.delete(key);
      await assertMutationReadCurrent46();
      await assertHistoryKeysReadable45([key]);
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
  const mutationReadGeneration46 = privateMutationReadGeneration46();
  const assertMutationReadCurrent46 = privateMutationReadGuard46();
  const healthReadLeases = enforceHealthPurposeLease
    ? keys
        .map((key) => captureHealthPurposePrivateDataWriteLease(key))
        .filter((lease): lease is HealthDataWriteLease => lease !== null)
    : [];
  const assertHealthReadsCurrent = () => {
    assertPrivateMutationReadGeneration46(mutationReadGeneration46);
    assertPurposeCurrent();
    for (const key of keys) assertPrivateReadAllowed(key);
    for (const lease of healthReadLeases) assertHealthDataWriteLease(lease);
  };
  assertHealthReadsCurrent();
  return withOperationTiming('private_kv_batch_read', () =>
    runAccountScopedPrivateOperation(async (generation) => {
      await assertMutationReadCurrent46();
      await assertHistoryKeysReadable45(keys);
      assertHealthReadsCurrent();
      for (const key of keys) assertPrivateReadAllowed(key);
      const entries = await AsyncStorage.multiGet([...keys]);
      await assertMutationReadCurrent46();
      await assertHistoryKeysReadable45(keys);
      assertAccountScopedPrivateOperationAllowed(generation);
      assertHealthReadsCurrent();
      assertHistoryBatchShape45(keys, entries);
      const result = new Map<string, string | null>();
      const encryptedEntries: [string, PrivateEnvelope, string][] = [];

      for (const [key, raw] of entries) {
        rejectLegacyHistoryRaw45(key, raw);
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
        await assertMutationReadCurrent46();
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
      assertAccountScopedPrivateOperationAllowed(generation);
      await assertMutationReadCurrent46();
      assertHealthReadsCurrent();
      if (!contentKey) {
        for (const [key, , raw] of encryptedEntries) rememberFailedRead(key, raw);
        throw new Error(PRIVATE_KV_CONTENT_KEY_MISSING);
      }
      for (const [key, envelope, raw] of encryptedEntries) {
        try {
          result.set(key, decryptEnvelope(key, envelope, contentKey));
          failedReadSnapshots.delete(key);
        } catch {
          rememberFailedRead(key, raw);
          throw new Error(PRIVATE_KV_DECRYPTION_FAILED);
        }
      }
      await assertMutationReadCurrent46();
      await assertHistoryKeysReadable45(keys);
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
  // An owner export may run without processing consent. Reserve its exact
  // requested keys until the batch is read so an in-flight native write cannot
  // expose tentative facts before confirmation or compensation settles. The
  // shared sorted per-key queue also preserves the history/source lock order;
  // unrelated keys are not reserved.
  return runSerializedPrivateMutations(keys, () =>
    readPrivateItems(keys, false, accountLease.assertCurrent));
}

async function validatePrivateItemsWithoutRetainingPlaintext(
  keys: readonly string[],
  assertCurrent: () => void,
): Promise<void> {
  const assertMutationReadCurrent46 = privateMutationReadGuard46();
  await assertMutationReadCurrent46();
  await assertHistoryKeysReadable45(keys);
  assertCurrent();
  await withOperationTiming('private_kv_batch_read', () =>
    runAccountScopedPrivateOperation(async () => {
      assertCurrent();
      for (const key of keys) assertPrivateReadAllowed(key);
      const entries = await AsyncStorage.multiGet([...keys]);
      await assertMutationReadCurrent46();
      assertCurrent();
      assertHistoryBatchShape45(keys, entries);
      const encryptedEntries: [string, PrivateEnvelope, string][] = [];

      for (const [key, raw] of entries) {
        assertCurrent();
        rejectLegacyHistoryRaw45(key, raw);
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

      if (encryptedEntries.length === 0) {
        await assertMutationReadCurrent46();
        assertCurrent();
        return;
      }
      let contentKey: Uint8Array | null;
      try {
        contentKey = await getExistingContentKey();
      } catch (error) {
        for (const [key, , raw] of encryptedEntries) rememberFailedRead(key, raw);
        throw error;
      }
      await assertMutationReadCurrent46();
      if (!contentKey) {
        for (const [key, , raw] of encryptedEntries) rememberFailedRead(key, raw);
        throw new Error(PRIVATE_KV_CONTENT_KEY_MISSING);
      }

      try {
        assertCurrent();
        for (const [key, envelope, raw] of encryptedEntries) {
          assertCurrent();
          try {
            validateEnvelopeAuthentication(key, envelope, contentKey);
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
      await assertMutationReadCurrent46();
      await assertHistoryKeysReadable45(keys);
    }),
  );
  await assertMutationReadCurrent46();
  assertCurrent();
}

/** Verify every private-KV envelope without creating or retaining plaintext. */
export function assertPrivateKVReadable(): Promise<void> {
  const mutationReadGeneration46 = privateMutationReadGeneration46();
  const assertMutationReadCurrent46 = privateMutationReadGuard46();
  return runAccountGenerationOperation(async (accountLease) => {
    await assertMutationReadCurrent46();
    accountLease.assertCurrent();
    const keys = (await AsyncStorage.getAllKeys()).filter(
      (key) => key !== PRIVATE_KV_CONTENT_KEY_NAME && !isKnownForeignStorageKey(key),
    );
    accountLease.assertCurrent();
    await assertMutationReadCurrent46();
    assertPrivateMutationReadGeneration46(mutationReadGeneration46);
    accountLease.assertCurrent();
    if (keys.length === 0) return;
    // This purpose-limited bypass stays private to the availability gate. It
    // authenticates bytes before lifecycle reconciliation opens health reads,
    // never UTF-8 decodes them, and remains account-generation-bound.
    await validatePrivateItemsWithoutRetainingPlaintext(keys, accountLease.assertCurrent);
    assertPrivateMutationReadGeneration46(mutationReadGeneration46);
    accountLease.assertCurrent();
  });
}

const CONFLICT_CHOICE_STORAGE_KEY = 'layerwell.conflict.overrides';
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

/** Native fulfillment alone cannot clear an intent. Keep its durable fence
 * through exact readback or compensation, including commit-then-reject ports. */
async function commitPrivateMutation46(
  key: string,
  committedRaw: string | null,
  existingRaw: string | null,
  assertPreparationCurrent: () => void,
  assertMutationCurrent: () => void,
  mutate: () => Promise<void>,
  expectedOwnerUserId?: string,
): Promise<void> {
  const intent = isHealthPurposePrivateDataKey(key)
    ? await armPrivateMutation46(key, assertPreparationCurrent, expectedOwnerUserId)
    : undefined;
  let invoked = false;
  try {
    assertPreparationCurrent();
    invoked = true;
    await mutate();
    assertMutationCurrent();
    const observedRaw = await AsyncStorage.getItem(key);
    assertMutationCurrent();
    if (observedRaw !== committedRaw) throw new Error(PRIVATE_KV_WRITE_CONFLICT);
  } catch (error) {
    if (invoked) {
      try {
        await restoreExactRawAfterAmbiguousMutation(key, committedRaw, existingRaw);
      } catch (rollbackError) {
        if (intent) {
          abandonPrivateMutation46(intent);
          quarantinedMutationKeys.add(key);
          clearActiveHealthProcessingEpoch();
        }
        throw rollbackError;
      }
    }
    if (intent) await finishPrivateMutation46(intent);
    throw error;
  }
  if (intent) await finishPrivateMutation46(intent);
}

async function updatePrivateItemWithGuard(
  key: string,
  updater: (current: string | null) => string | null,
  assertMutationCurrent: () => void,
  assertBeforeNativeWrite?: () => void,
  expectedOwnerUserId?: string,
): Promise<void> {
  const assertPreparationCurrent = () => {
    assertMutationCurrent();
    assertBeforeNativeWrite?.();
  };
  return withOperationTiming('private_kv_write', () =>
    runAccountScopedPrivateOperation((generation) =>
      runSerializedPrivateMutations([key], async () => {
        const assertOriginalPreparation46 = () => {
          assertAccountScopedPrivateOperationAllowed(generation);
          assertPreparationCurrent();
        };
        let existingRaw: string | null = null;
        let existingClassification: EnvelopeClassification | null = null;
        let contentKey: Uint8Array | null = null;
        let currentValue: string | null = null;
        // Only read/decrypt preparation can restart. The updater and native
        // mutation each run once, under the original authority and key slot.
        for (;;) {
          await waitForPrivateMutationReadWindow46(assertOriginalPreparation46);
          const readGeneration46 = privateMutationReadGeneration46();
          const assertMutationReadCurrent46 = privateMutationReadGuard46();
          try {
            await assertMutationReadCurrent46();
            if (isHealthPurposePrivateDataKey(key)) await assertPrivateMutationWritable46(key);
            await assertHistoryKeysReadable45([key]);
            assertPrivateReadAllowed(key);
            assertOriginalPreparation46();
            existingRaw = await assertNoFailedReadRewrite(key);
            await assertMutationReadCurrent46();
            assertOriginalPreparation46();
            existingClassification = existingRaw ? classifyEnvelope(key, existingRaw) : null;
            if (existingRaw && existingClassification &&
                (existingClassification.kind === 'malformed' || existingClassification.kind === 'unsupported')) {
              rememberFailedRead(key, existingRaw);
              throw envelopeClassificationError(existingClassification.kind);
            }
            contentKey = null;
            currentValue = null;
            if (existingClassification?.kind === 'current' && existingRaw) {
              try { contentKey = await getExistingContentKey(); }
              catch (error) { rememberFailedRead(key, existingRaw); throw error; }
              await assertMutationReadCurrent46();
              assertOriginalPreparation46();
              if (!contentKey) {
                rememberFailedRead(key, existingRaw);
                throw new Error(PRIVATE_KV_CONTENT_KEY_MISSING);
              }
              try { currentValue = decryptEnvelope(key, existingClassification.envelope, contentKey); }
              catch { rememberFailedRead(key, existingRaw); throw new Error(PRIVATE_KV_DECRYPTION_FAILED); }
            } else if (existingClassification?.kind === 'legacy' && existingRaw) currentValue = existingRaw;
            await assertMutationReadCurrent46();
            assertOriginalPreparation46();
            break;
          } catch (error) {
            if (!(error instanceof Error) || error.message !== 'LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED') throw error;
            await waitForPrivateMutationReadWindow46(assertOriginalPreparation46);
            // A failed/orphan marker refuses above. A stable refusal (such as
            // the original C45 history fence) is never retried into a pass.
            if (privateMutationReadGeneration46() === readGeneration46) throw error;
          }
        }
        const nextValue = updater(currentValue);
        assertPreparationCurrent();
        if (
          nextValue === currentValue &&
          (nextValue === null || existingClassification?.kind === 'current')
        ) {
          return;
        }

        const latestRaw = await AsyncStorage.getItem(key);
        assertPreparationCurrent();
        if (latestRaw !== existingRaw) {
          if (latestRaw !== null) rememberFailedRead(key, latestRaw);
          throw new Error(PRIVATE_KV_WRITE_CONFLICT);
        }
        assertAccountScopedPrivateOperationAllowed(generation);

        if (nextValue === null) {
          assertPreparationCurrent();
          await commitPrivateMutation46(key, null, existingRaw,
            assertPreparationCurrent, () => {
              assertAccountScopedPrivateOperationAllowed(generation);
              assertMutationCurrent();
            }, () => AsyncStorage.removeItem(key), expectedOwnerUserId);
          failedReadSnapshots.delete(key);
          return;
        }

        contentKey ??= await getOrCreateContentKey();
        assertPreparationCurrent();
        const nonce = randomBytes(NONCE_BYTES);
        const ciphertext = cipherForPrivateKey45(key, contentKey, nonce).encrypt(utf8ToBytes(nextValue));
        const envelope: PrivateEnvelope = {
          version: ENCRYPTION_VERSION,
          nonceHex: bytesToHex(nonce),
          ciphertextHex: bytesToHex(ciphertext),
        };
        await maybeRejectConflictChoiceWrite(key);
        assertPreparationCurrent();
        const committedRaw = JSON.stringify(envelope);
        // No await separates this opt-in admission from native invocation.
        // UI retirement after invocation cannot safely cancel that write;
        // the original post-write account/health compensation stays separate.
        assertPreparationCurrent();
        await commitPrivateMutation46(key, committedRaw, existingRaw,
          assertPreparationCurrent, assertMutationCurrent,
          () => AsyncStorage.setItem(key, committedRaw), expectedOwnerUserId);
        failedReadSnapshots.delete(key);
      }),
    ),
  );
}

/** Atomically read, transform, and persist one private value under the same
 * account-generation guard and per-key mutation lock. The updater is
 * synchronous so no untracked work can cross an account boundary. */
export async function updatePrivateItem(
  key: string,
  updater: (current: string | null) => string | null,
  assertAdditionalMutationCurrent?: () => void,
  assertBeforeNativeWrite?: () => void,
): Promise<void> {
  // Historical facts may be appended only through the source-fenced lane.
  if (key === 'layerwell.routinePlanHistory.v1') throw new Error(PRIVATE_KV_SOURCE_TRANSFORM_INVALID);
  // Generic read/transform/update may expose plaintext to its callback, so a
  // classified key requires exact health authority up front even if the
  // callback later returns null. Privacy-reducing callers use the explicit
  // remove APIs, which never decrypt or expose the prior value.
  const healthWriteLease = captureHealthPurposePrivateDataWriteLease(key);
  const assertHealthMutationCurrent = () => {
    if (healthWriteLease !== null) assertHealthDataWriteLease(healthWriteLease);
    // Compose an operation's local authority with the existing health guard.
    // The shared writer checks both around native I/O and restores exact prior
    // ciphertext if either authority is lost during the write.
    assertAdditionalMutationCurrent?.();
  };
  return updatePrivateItemWithGuard(
    key,
    updater,
    assertHealthMutationCurrent,
    assertBeforeNativeWrite,
    healthWriteLease?.ownerUserId,
  );
}

export const PRIVATE_KV_SOURCE_UNAUTHENTICATED = 'PRIVATE_KV_SOURCE_UNAUTHENTICATED';
export const PRIVATE_KV_SOURCE_TRANSFORM_INVALID = 'PRIVATE_KV_SOURCE_TRANSFORM_INVALID';

/**
 * Opt-in source transaction for one JS runtime. Reserve sources and destination
 * in the ordinary sorted per-key queue until native readback/rollback finishes.
 * Non-null sources must already be authenticated encrypted records. Absence is
 * exact source state, not a successful domain default.
 *
 * prepareSources may only read/validate domain stores. It must never invoke or
 * await a mutation of a reserved key. The destination transform is synchronous;
 * callers retain their ORIGINAL authority and expected full-key source bytes.
 */
export async function updatePrivateItemWithSources(
  key: string,
  sourceKeys: readonly string[],
  updater: (values: ReadonlyMap<string, string | null>) => string | null,
  assertCurrent: () => void,
  prepareSources?: (values: ReadonlyMap<string, string | null>) => Promise<void>,
): Promise<void> {
  const keys = [...new Set([...sourceKeys, key])].sort();
  for (const sourceKey of keys) assertPrivateReadAllowed(sourceKey);
  // Capture synchronously, before queuing. A stale callback cannot inherit a
  // lease granted while it waited for a source reservation.
  const healthLeases = keys.map(captureHealthPurposePrivateDataWriteLease);
  const assertAuthority = () => {
    for (const lease of healthLeases) {
      if (lease !== null) assertHealthDataWriteLease(lease);
    }
    assertCurrent();
  };
  assertAuthority();
  return withOperationTiming('private_kv_write', () =>
    runAccountScopedPrivateOperation((generation) =>
      runSerializedPrivateMutations(keys, async () => {
        const assertMutationReadCurrent46 = privateMutationReadGuard46();
        await assertMutationReadCurrent46();
        const assertAllowed = () => {
          assertAccountScopedPrivateOperationAllowed(generation);
          assertAuthority();
        };
        const rawSources = new Map<string, string | null>();
        const values = new Map<string, string | null>();
        let contentKey: Uint8Array | null = null;
        await assertHistoryKeysReadable45(keys);
        assertAllowed();
        for (const sourceKey of keys) {
          const raw = await assertNoFailedReadRewrite(sourceKey);
          await assertMutationReadCurrent46();
          assertAllowed();
          rawSources.set(sourceKey, raw);
          if (raw === null) {
            values.set(sourceKey, null);
            continue;
          }
          const classification = classifyEnvelope(sourceKey, raw);
          if (classification.kind === 'legacy') {
            throw new Error(PRIVATE_KV_SOURCE_UNAUTHENTICATED);
          }
          if (classification.kind !== 'current') {
            rememberFailedRead(sourceKey, raw);
            throw envelopeClassificationError(classification.kind);
          }
          try {
            contentKey ??= await getExistingContentKey();
            await assertMutationReadCurrent46();
            assertAllowed();
            if (!contentKey) throw new Error(PRIVATE_KV_CONTENT_KEY_MISSING);
          } catch (error) {
            rememberFailedRead(sourceKey, raw);
            throw error;
          }
          try {
            values.set(sourceKey, decryptEnvelope(sourceKey, classification.envelope, contentKey));
          } catch {
            rememberFailedRead(sourceKey, raw);
            throw new Error(PRIVATE_KV_DECRYPTION_FAILED);
          }
        }

        await assertMutationReadCurrent46();
        await prepareSources?.(values);
        await assertMutationReadCurrent46();
        assertAllowed();
        const nextValue = updater(values);
        if (nextValue !== null && typeof nextValue !== 'string') {
          throw new Error(PRIVATE_KV_SOURCE_TRANSFORM_INVALID);
        }
        assertAllowed();
        const existingRaw = rawSources.get(key)!;
        const currentValue = values.get(key)!;
        // Recheck every source after asynchronous domain preparation, while all
        // reservations still belong to this operation. No unlocked cache read
        // can certify a source or repair a destination after the fact.
        const assertExactSources = async (destinationRaw: string | null) => {
          for (const sourceKey of keys) {
            const latestRaw = await AsyncStorage.getItem(sourceKey);
            assertAllowed();
            const expected = sourceKey === key ? destinationRaw : rawSources.get(sourceKey);
            if (latestRaw !== expected) throw new Error(PRIVATE_KV_WRITE_CONFLICT);
          }
        };
        await assertExactSources(existingRaw);
        await assertMutationReadCurrent46();
        assertAllowed();
        if (nextValue === currentValue) return;
        if (key === 'layerwell.routinePlanHistory.v1' && [...new Set(sourceKeys)].sort().join('|') !== [
          'layerwell.shelf.v1', 'layerwell.skinprofile.v1', 'layerwell.conflict.overrides',
          'layerwell.healthDataCollectionConsent.v1', 'layerwell.routineOrder.v1',
        ].sort().join('|')) throw new Error(PRIVATE_KV_SOURCE_TRANSFORM_INVALID);

        let committedRaw: string | null = null;
        if (nextValue !== null) {
          contentKey ??= await getOrCreateContentKey();
          assertAllowed();
          const nonce = randomBytes(NONCE_BYTES);
          committedRaw = JSON.stringify({
            version: ENCRYPTION_VERSION,
            nonceHex: bytesToHex(nonce),
            ciphertextHex: bytesToHex(
              cipherForPrivateKey45(key, contentKey, nonce).encrypt(utf8ToBytes(nextValue)),
            ),
          } satisfies PrivateEnvelope);
        }
        await maybeRejectConflictChoiceWrite(key);
        // History also closes the asynchronous content-key/preparation window.
        // Ordinary source writers cannot enter while this union is reserved.
        let historyIntent: PlanHistoryMutationIntent45 | undefined;
        let privateIntent46: PrivateMutationIntent46 | undefined;
        await assertMutationReadCurrent46();
        if (key === 'layerwell.routinePlanHistory.v1') {
          historyIntent = await armPlanHistoryMutation45(healthLeases[keys.indexOf(key)]!);
          try {
            await assertExactSources(existingRaw);
          } catch (error) {
            await finishPlanHistoryMutation45(historyIntent);
            throw error;
          }
        } else if (isHealthPurposePrivateDataKey(key)) {
          privateIntent46 = await armPrivateMutation46(key, assertAllowed,
            healthLeases[keys.indexOf(key)]?.ownerUserId);
        }
        try {
          assertAllowed();
          // No await separates admission from the actual native invocation.
          if (committedRaw === null) await AsyncStorage.removeItem(key);
          else await AsyncStorage.setItem(key, committedRaw);
          assertAllowed();
          await assertExactSources(committedRaw);
          // Exact envelope bytes plus authenticated plaintext readback prevents
          // omitted native writes and noncanonical/ambiguous success claims.
          if (committedRaw !== null) {
            const classification = classifyEnvelope(key, committedRaw);
            if (classification.kind !== 'current' || !contentKey ||
                decryptEnvelope(key, classification.envelope, contentKey) !== nextValue) {
              throw new Error(PRIVATE_KV_WRITE_CONFLICT);
            }
          }
          assertAllowed();
        } catch (error) {
          try {
            await restoreExactRawAfterAmbiguousMutation(key, committedRaw, existingRaw);
          } catch (rollbackError) {
            if (privateIntent46) abandonPrivateMutation46(privateIntent46);
            if (key === 'layerwell.routinePlanHistory.v1' || privateIntent46) {
              // A tentative version is never readable or appendable after failed
              // compensation. Close processing before releasing this reservation.
              // The content-free intent was durably confirmed BEFORE dispatch.
              // Retain it across restart; no fallible post-failure marker write
              // is required, and ordinary recovery cannot authorize deletion.
              quarantinedMutationKeys.add(key);
              clearActiveHealthProcessingEpoch();
            }
            throw rollbackError;
          }
          if (historyIntent) await finishPlanHistoryMutation45(historyIntent);
          if (privateIntent46) await finishPrivateMutation46(privateIntent46);
          throw error;
        }
        if (historyIntent) await finishPlanHistoryMutation45(historyIntent);
        if (privateIntent46) await finishPrivateMutation46(privateIntent46);
        for (const sourceKey of keys) failedReadSnapshots.delete(sourceKey);
      }),
    ),
  );
}

const CATALOG_LOOKUP_QUEUE_STORAGE_KEY = 'layerwell.catalog.lookupQueue.v1';

/**
 * Narrow data-rights maintenance lane for physically removing expired or
 * foreign-owner catalog retry bytes before export. It cannot write any other
 * private-data key and is fenced by the export's exact account-generation
 * lease; the queue layer supplies the separately verified owner filter.
 */
export function updateCatalogLookupQueueForPurposeLimitedExport(
  accountLease: AccountGenerationLease,
  updater: (current: string | null) => string | null,
): Promise<void> {
  accountLease.assertCurrent();
  return updatePrivateItemWithGuard(
    CATALOG_LOOKUP_QUEUE_STORAGE_KEY,
    updater,
    accountLease.assertCurrent,
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
        await clearPrivateMutationAfterRemoval46([key]);
        quarantinedMutationKeys.delete(key);
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
      await clearPrivateMutationAfterRemoval46(keys);
      for (const key of keys) {
        failedReadSnapshots.delete(key);
        quarantinedMutationKeys.delete(key);
      }
    }),
  );
}

/** Revoke only widget bearer capabilities, even after an account boundary closes. */
export async function clearRoutineWidgetActionPrivateItems(): Promise<void> {
  const keys = ['layerwell.widgetActionMap.v1', 'layerwell.widgetActionMap.v2'] as const;
  // Share the ordinary per-key queue so an older write/rollback cannot restore
  // a revoked token after this deletion. This lane cannot read or write data,
  // accepts no caller-selected key and never reopens account admission.
  const pending = runSerializedPrivateMutations(keys, async () => {
    const results = await Promise.allSettled(
      keys.map(async (key) => {
        await AsyncStorage.removeItem(key);
        failedReadSnapshots.delete(key);
      }),
    );
    const failure = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (failure) throw failure.reason;
    await clearPrivateMutationAfterRemoval46(keys);
  });
  inFlightOperations.add(pending);
  try {
    await pending;
  } finally {
    inFlightOperations.delete(pending);
  }
}

export async function clearPrivateKVContentKey(): Promise<void> {
  await clearStoredPrivateKVContentKey();
  failedReadSnapshots.clear();
  quarantinedMutationKeys.clear();
}

export const privateKVEncryptionInfo = {
  version: ENCRYPTION_VERSION,
  secureStoreKey: PRIVATE_KV_CONTENT_KEY_NAME,
} as const;
