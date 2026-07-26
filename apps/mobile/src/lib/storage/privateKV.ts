import 'react-native-get-random-values';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import * as Crypto from 'expo-crypto';
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
import {
  LOCAL_PRIVATE_BULK_CLEANUP_KEYS,
  LOCAL_PRIVATE_READ_ONLY_KEYS,
} from '@/features/settings/localPrivateDataRegistry';
import { withOperationTiming } from '@/lib/observability/operationTiming';
import {
  MAX_PRIVATE_KV_TRANSACTION_TARGETS,
  PRIVATE_KV_TRANSACTION_JOURNAL_KEY,
  PRIVATE_KV_TRANSACTION_LEGACY_SCHEMA_VERSION,
  PRIVATE_KV_TRANSACTION_SCHEMA_VERSION,
  PrivateKVTransactionJournalError,
  decodePrivateKVTransactionJournal,
  encodePrivateKVTransactionJournal,
  type PrivateKVTransactionLegacyTarget,
  type PrivateKVTransactionJournal,
  type PrivateKVTransactionTarget,
} from './privateKVTransactionCore';

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
export const PRIVATE_KV_READ_ONLY_KEY = 'PRIVATE_KV_READ_ONLY_KEY';
export const PRIVATE_KV_WRITE_CONFLICT = 'PRIVATE_KV_WRITE_CONFLICT';
export const PRIVATE_KV_WRITE_BLOCKED_AFTER_READ_FAILURE =
  'PRIVATE_KV_WRITE_BLOCKED_AFTER_READ_FAILURE';
export const PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY =
  'PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY';
export const PRIVATE_KV_AUTHORIZED_RESET_REASON_INVALID =
  'PRIVATE_KV_AUTHORIZED_RESET_REASON_INVALID';
export const PRIVATE_KV_TRANSACTION_JOURNAL_INVALID = 'PRIVATE_KV_TRANSACTION_JOURNAL_INVALID';
export const PRIVATE_KV_TRANSACTION_JOURNAL_UNSUPPORTED =
  'PRIVATE_KV_TRANSACTION_JOURNAL_UNSUPPORTED';
export const PRIVATE_KV_TRANSACTION_CONFLICT = 'PRIVATE_KV_TRANSACTION_CONFLICT';
export { PRIVATE_KV_CONTENT_KEY_CONFLICT, PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE };

export type PrivateKVUnavailableReason =
  | 'content_key_missing'
  | 'content_key_conflict'
  | 'content_key_storage_unavailable'
  | 'account_boundary'
  | 'storage_unavailable';

export type PrivateKVCorruptReason =
  | 'content_key_invalid'
  | 'envelope_invalid'
  | 'decryption_failed';

/** Backwards-compatible name for domain unavailable results. Corrupt reasons
 * belong only to the `corrupt` discriminant. */
export type PrivateKVReadFailureReason = PrivateKVUnavailableReason;

export type PrivateKVReadResult =
  | { status: 'absent' }
  | { status: 'available'; value: string }
  | { status: 'unavailable'; reason: PrivateKVUnavailableReason }
  | { status: 'corrupt'; reason: PrivateKVCorruptReason }
  | { status: 'unsupported_version' };

export type PrivateKVAuthorizedResetReason =
  | 'account_isolation'
  | 'device_authenticated_app_lock_repair';

const DEVICE_AUTHENTICATED_APP_LOCK_REPAIR_KEY = 'onskin.appLock.enabled';
const ACCOUNT_ISOLATION_RESET_KEYS = new Set<string>(LOCAL_PRIVATE_BULK_CLEANUP_KEYS);
const READ_ONLY_PRIVATE_KEYS = new Set<string>(LOCAL_PRIVATE_READ_ONLY_KEYS);

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
type ActivePrivateRead = Readonly<{
  generation: number;
  invalidate: () => void;
}>;

const activeReadOperations = new Set<ActivePrivateRead>();
const inFlightMutationOperations = new Set<Promise<unknown>>();
const privateMutationTails = new Map<string, Promise<void>>();
let accountBoundaryWriteBlocked = false;
let accountBoundaryWriteBlockDepth = 0;
let accountBoundaryGeneration = 0;
let privateTransactionTail: Promise<void> = Promise.resolve();
let privateTransactionRecovery: Promise<void> | null = null;
let privateTransactionJournalKnownAbsent = false;

function accountBoundaryError(): Error {
  return new Error(PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY);
}

function runAccountScopedPrivateRead<T>(operation: (generation: number) => Promise<T>): Promise<T> {
  if (accountBoundaryWriteBlocked) return Promise.reject(accountBoundaryError());
  const generation = accountBoundaryGeneration;

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let activeRead!: ActivePrivateRead;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      activeReadOperations.delete(activeRead);
      callback();
    };
    activeRead = Object.freeze({
      generation,
      invalidate: () => finish(() => reject(accountBoundaryError())),
    });
    activeReadOperations.add(activeRead);

    let pending: Promise<T>;
    try {
      pending = operation(generation);
    } catch (error) {
      finish(() => reject(error));
      return;
    }

    void Promise.resolve(pending).then(
      (value) => {
        try {
          assertAccountScopedPrivateOperationAllowed(generation);
          finish(() => resolve(value));
        } catch (error) {
          finish(() => reject(error));
        }
      },
      (error: unknown) => finish(() => reject(error)),
    );
  });
}

/** Mutation-only coordinator retained by the destructive account-boundary drain. */
async function runAccountScopedPrivateMutation<T>(
  operation: (generation: number) => Promise<T>,
): Promise<T> {
  if (accountBoundaryWriteBlocked) {
    throw accountBoundaryError();
  }
  const generation = accountBoundaryGeneration;
  const pending = operation(generation);
  inFlightMutationOperations.add(pending);
  try {
    return await pending;
  } finally {
    inFlightMutationOperations.delete(pending);
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

async function runSerializedPrivateTransaction<T>(operation: () => Promise<T>): Promise<T> {
  const ready = privateTransactionTail.catch(() => undefined);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  privateTransactionTail = ready.then(() => gate);
  await ready;
  try {
    return await operation();
  } finally {
    release();
  }
}

function assertAccountScopedPrivateOperationAllowed(generation: number): void {
  if (accountBoundaryWriteBlocked || generation !== accountBoundaryGeneration) {
    throw accountBoundaryError();
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

function assertPrivateDataKeyWritable(key: string): void {
  assertPrivateDataKey(key);
  if (key === PRIVATE_KV_TRANSACTION_JOURNAL_KEY) throw new Error(PRIVATE_KV_RESERVED_KEY);
  if (READ_ONLY_PRIVATE_KEYS.has(key)) throw new Error(PRIVATE_KV_READ_ONLY_KEY);
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

function authenticateEnvelope(envelope: PrivateEnvelope, contentKey: Uint8Array): void {
  void xchacha20poly1305(contentKey, hexToBytes(envelope.nonceHex)).decrypt(
    hexToBytes(envelope.ciphertextHex),
  );
}

function encryptPrivateValue(value: string, contentKey: Uint8Array): string {
  const nonce = randomBytes(NONCE_BYTES);
  const ciphertext = xchacha20poly1305(contentKey, nonce).encrypt(utf8ToBytes(value));
  const envelope: PrivateEnvelope = {
    version: ENCRYPTION_VERSION,
    nonceHex: bytesToHex(nonce),
    ciphertextHex: bytesToHex(ciphertext),
  };
  return JSON.stringify(envelope);
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

async function writeRawExactly(key: string, raw: string | null, generation: number): Promise<void> {
  assertAccountScopedPrivateOperationAllowed(generation);
  try {
    if (raw === null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, raw);
  } catch (error) {
    assertAccountScopedPrivateOperationAllowed(generation);
    if ((await AsyncStorage.getItem(key)) === raw) return;
    throw error;
  }
  assertAccountScopedPrivateOperationAllowed(generation);
  if ((await AsyncStorage.getItem(key)) !== raw) {
    throw new Error(PRIVATE_KV_WRITE_CONFLICT);
  }
}

async function decodeMutablePrivateRaw(
  key: string,
  raw: string | null,
  existingContentKey: Uint8Array | null = null,
): Promise<Readonly<{ contentKey: Uint8Array | null; value: string | null; current: boolean }>> {
  if (raw === null) return { contentKey: existingContentKey, value: null, current: true };
  const classification = classifyEnvelope(key, raw);
  if (classification.kind === 'malformed' || classification.kind === 'unsupported') {
    rememberFailedRead(key, raw);
    throw envelopeClassificationError(classification.kind);
  }
  if (classification.kind === 'legacy') {
    return { contentKey: existingContentKey, value: raw, current: false };
  }

  let contentKey = existingContentKey;
  try {
    contentKey ??= await getExistingContentKey();
  } catch (error) {
    rememberFailedRead(key, raw);
    throw error;
  }
  if (!contentKey) {
    rememberFailedRead(key, raw);
    throw new Error(PRIVATE_KV_CONTENT_KEY_MISSING);
  }
  try {
    return {
      contentKey,
      value: decryptEnvelope(classification.envelope, contentKey),
      current: true,
    };
  } catch {
    rememberFailedRead(key, raw);
    throw new Error(PRIVATE_KV_DECRYPTION_FAILED);
  }
}

async function decodeStoredTransactionJournal(
  raw: string,
): Promise<Readonly<{ contentKey: Uint8Array; journal: PrivateKVTransactionJournal }>> {
  const classification = classifyEnvelope(PRIVATE_KV_TRANSACTION_JOURNAL_KEY, raw);
  if (classification.kind !== 'current') {
    rememberFailedRead(PRIVATE_KV_TRANSACTION_JOURNAL_KEY, raw);
    if (classification.kind === 'unsupported') {
      throw new Error(PRIVATE_KV_TRANSACTION_JOURNAL_UNSUPPORTED);
    }
    throw new Error(PRIVATE_KV_TRANSACTION_JOURNAL_INVALID);
  }
  let contentKey: Uint8Array | null;
  try {
    contentKey = await getExistingContentKey();
  } catch (error) {
    rememberFailedRead(PRIVATE_KV_TRANSACTION_JOURNAL_KEY, raw);
    throw error;
  }
  if (!contentKey) {
    rememberFailedRead(PRIVATE_KV_TRANSACTION_JOURNAL_KEY, raw);
    throw new Error(PRIVATE_KV_CONTENT_KEY_MISSING);
  }

  try {
    const plaintext = decryptEnvelope(classification.envelope, contentKey);
    const journal = decodePrivateKVTransactionJournal(plaintext);
    for (const target of journal.targets) {
      if (
        target.key === PRIVATE_KV_TRANSACTION_JOURNAL_KEY ||
        !ACCOUNT_ISOLATION_RESET_KEYS.has(target.key) ||
        READ_ONLY_PRIVATE_KEYS.has(target.key)
      ) {
        throw new PrivateKVTransactionJournalError('invalid');
      }
    }
    failedReadSnapshots.delete(PRIVATE_KV_TRANSACTION_JOURNAL_KEY);
    return { contentKey, journal };
  } catch (error) {
    rememberFailedRead(PRIVATE_KV_TRANSACTION_JOURNAL_KEY, raw);
    if (error instanceof PrivateKVTransactionJournalError) {
      throw new Error(
        error.kind === 'unsupported_version'
          ? PRIVATE_KV_TRANSACTION_JOURNAL_UNSUPPORTED
          : PRIVATE_KV_TRANSACTION_JOURNAL_INVALID,
      );
    }
    if (
      error instanceof Error &&
      (error.message === PRIVATE_KV_TRANSACTION_JOURNAL_INVALID ||
        error.message === PRIVATE_KV_TRANSACTION_JOURNAL_UNSUPPORTED)
    ) {
      throw error;
    }
    throw new Error(PRIVATE_KV_TRANSACTION_JOURNAL_INVALID);
  }
}

async function applyPrivateKVTransactionJournal(
  journalRaw: string,
  journal: PrivateKVTransactionJournal,
  contentKey: Uint8Array,
  generation: number,
): Promise<void> {
  const beforeMatches = new Map<string, boolean>();
  for (const target of journal.targets) {
    assertAccountScopedPrivateOperationAllowed(generation);
    const currentRaw = await AsyncStorage.getItem(target.key);
    const matchesBefore =
      journal.version === PRIVATE_KV_TRANSACTION_LEGACY_SCHEMA_VERSION
        ? currentRaw === (target as PrivateKVTransactionLegacyTarget).beforeRaw
        : (await privateKVTransactionBeforeRawHash(currentRaw)) ===
          (target as PrivateKVTransactionTarget).beforeRawHash;
    beforeMatches.set(target.key, matchesBefore);
    if (matchesBefore) continue;
    const decoded = await decodeMutablePrivateRaw(target.key, currentRaw, contentKey);
    if (decoded.value !== target.nextValue) {
      throw new Error(PRIVATE_KV_TRANSACTION_CONFLICT);
    }
  }

  for (const target of journal.targets) {
    if (!beforeMatches.get(target.key)) {
      // An earlier attempt already made this exact logical value durable.
      failedReadSnapshots.delete(target.key);
      continue;
    }
    const nextRaw =
      target.nextValue === null ? null : encryptPrivateValue(target.nextValue, contentKey);
    await writeRawExactly(target.key, nextRaw, generation);
    failedReadSnapshots.delete(target.key);
  }

  assertAccountScopedPrivateOperationAllowed(generation);
  if ((await AsyncStorage.getItem(PRIVATE_KV_TRANSACTION_JOURNAL_KEY)) !== journalRaw) {
    throw new Error(PRIVATE_KV_TRANSACTION_CONFLICT);
  }
  await writeRawExactly(PRIVATE_KV_TRANSACTION_JOURNAL_KEY, null, generation);
  failedReadSnapshots.delete(PRIVATE_KV_TRANSACTION_JOURNAL_KEY);
  privateTransactionJournalKnownAbsent = true;
}

async function privateKVTransactionBeforeRawHash(raw: string | null): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    raw === null
      ? 'onskin:private-kv-transaction-before:v2:null'
      : `onskin:private-kv-transaction-before:v2:value:${raw}`,
  );
}

async function recoverPrivateKVTransactionForGeneration(generation: number): Promise<void> {
  return runSerializedPrivateTransaction(async () => {
    assertAccountScopedPrivateOperationAllowed(generation);
    const initialRaw = await AsyncStorage.getItem(PRIVATE_KV_TRANSACTION_JOURNAL_KEY);
    if (initialRaw === null) {
      privateTransactionJournalKnownAbsent = true;
      return;
    }
    const initial = await decodeStoredTransactionJournal(initialRaw);
    const keys = [
      PRIVATE_KV_TRANSACTION_JOURNAL_KEY,
      ...initial.journal.targets.map((target) => target.key),
    ];
    await runSerializedPrivateMutations(keys, async () => {
      assertAccountScopedPrivateOperationAllowed(generation);
      const journalRaw = await AsyncStorage.getItem(PRIVATE_KV_TRANSACTION_JOURNAL_KEY);
      if (journalRaw === null) return;
      const decoded = await decodeStoredTransactionJournal(journalRaw);
      await applyPrivateKVTransactionJournal(
        journalRaw,
        decoded.journal,
        decoded.contentKey,
        generation,
      );
    });
  });
}

async function ensurePrivateKVTransactionRecovered(): Promise<void> {
  if (privateTransactionJournalKnownAbsent) return;
  if (privateTransactionRecovery) return privateTransactionRecovery;
  const pending = runAccountScopedPrivateMutation(recoverPrivateKVTransactionForGeneration);
  privateTransactionRecovery = pending;
  try {
    await pending;
  } finally {
    if (privateTransactionRecovery === pending) privateTransactionRecovery = null;
  }
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
  return withOperationTiming('private_kv_read', async () => {
    await ensurePrivateKVTransactionRecovered();
    return runAccountScopedPrivateRead(async (generation) => {
      assertPrivateDataKey(key);
      const raw = await AsyncStorage.getItem(key);
      assertAccountScopedPrivateOperationAllowed(generation);
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
        assertAccountScopedPrivateOperationAllowed(generation);
        rememberFailedRead(key, raw);
        throw error;
      }
      assertAccountScopedPrivateOperationAllowed(generation);
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
    });
  });
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
  if (message === PRIVATE_KV_TRANSACTION_JOURNAL_INVALID) {
    return { status: 'corrupt', reason: 'envelope_invalid' };
  }
  if (message === PRIVATE_KV_TRANSACTION_JOURNAL_UNSUPPORTED) {
    return { status: 'unsupported_version' };
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

async function getPrivateItemsForGeneration(
  keys: readonly string[],
  generation: number,
): Promise<Map<string, string | null>> {
  for (const key of keys) assertPrivateDataKey(key);
  const entries = await AsyncStorage.multiGet([...keys]);
  assertAccountScopedPrivateOperationAllowed(generation);
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
    assertAccountScopedPrivateOperationAllowed(generation);
    for (const [key, , raw] of encryptedEntries) rememberFailedRead(key, raw);
    throw error;
  }
  assertAccountScopedPrivateOperationAllowed(generation);
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
}

async function verifyPrivateItemsForGeneration(
  keys: readonly string[],
  generation: number,
): Promise<void> {
  for (const key of keys) assertPrivateDataKey(key);
  const entries = await AsyncStorage.multiGet([...keys]);
  assertAccountScopedPrivateOperationAllowed(generation);
  let hasEncryptedEntries = false;

  // Classify the complete snapshot before consulting the content key. This
  // preserves the batch reader's fail-closed malformed/future-envelope
  // precedence without collecting decrypted values in a result Map.
  for (const [key, raw] of entries) {
    if (raw === null) {
      failedReadSnapshots.delete(key);
      continue;
    }
    const classification = classifyEnvelope(key, raw);
    if (classification.kind === 'current') {
      hasEncryptedEntries = true;
    } else if (classification.kind === 'malformed' || classification.kind === 'unsupported') {
      rememberFailedRead(key, raw);
      throw envelopeClassificationError(classification.kind);
    } else {
      failedReadSnapshots.delete(key);
    }
  }

  if (!hasEncryptedEntries) return;
  let contentKey: Uint8Array | null;
  try {
    contentKey = await getExistingContentKey();
  } catch (error) {
    assertAccountScopedPrivateOperationAllowed(generation);
    for (const [key, raw] of entries) {
      if (raw !== null && classifyEnvelope(key, raw).kind === 'current') {
        rememberFailedRead(key, raw);
      }
    }
    throw error;
  }
  assertAccountScopedPrivateOperationAllowed(generation);
  if (!contentKey) {
    for (const [key, raw] of entries) {
      if (raw !== null && classifyEnvelope(key, raw).kind === 'current') {
        rememberFailedRead(key, raw);
      }
    }
    throw new Error(PRIVATE_KV_CONTENT_KEY_MISSING);
  }

  for (const [key, raw] of entries) {
    if (raw === null) continue;
    const classification = classifyEnvelope(key, raw);
    if (classification.kind !== 'current') continue;
    try {
      // Authentication is the only required result. Avoiding UTF-8 conversion
      // prevents the startup verifier from retaining plaintext strings.
      authenticateEnvelope(classification.envelope, contentKey);
      failedReadSnapshots.delete(key);
    } catch {
      rememberFailedRead(key, raw);
      throw new Error(PRIVATE_KV_DECRYPTION_FAILED);
    }
  }
}

export async function getPrivateItems(
  keys: readonly string[],
): Promise<Map<string, string | null>> {
  return withOperationTiming('private_kv_batch_read', async () => {
    await ensurePrivateKVTransactionRecovered();
    return runAccountScopedPrivateRead((generation) =>
      getPrivateItemsForGeneration(keys, generation),
    );
  });
}

/** Verify every private-KV envelope without creating key material or retaining plaintext. */
export async function assertPrivateKVReadable(): Promise<void> {
  return withOperationTiming('private_kv_batch_read', async () => {
    await ensurePrivateKVTransactionRecovered();
    return runAccountScopedPrivateRead(async (generation) => {
      const allKeys = await AsyncStorage.getAllKeys();
      assertAccountScopedPrivateOperationAllowed(generation);
      const keys = allKeys.filter(
        (key) => key !== PRIVATE_KV_CONTENT_KEY_NAME && !isKnownForeignStorageKey(key),
      );
      if (keys.length === 0) return;
      await verifyPrivateItemsForGeneration(keys, generation);
      assertAccountScopedPrivateOperationAllowed(generation);
    });
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
  return withOperationTiming('private_kv_write', async () => {
    await ensurePrivateKVTransactionRecovered();
    return runAccountScopedPrivateMutation((generation) =>
      runSerializedPrivateMutations([key], async () => {
        assertPrivateDataKeyWritable(key);
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
    );
  });
}

export type PrivateKVTransactionValues = ReadonlyMap<string, string | null>;

/**
 * Crash-recoverable multi-key private mutation. The synchronous updater sees
 * one locked snapshot and returns every requested next value. An encrypted
 * intent journal becomes the commit point before target writes; every ordinary
 * private read/write rolls that journal forward first after interruption.
 */
export async function updatePrivateItemsTransactionally(
  keys: readonly string[],
  updater: (current: PrivateKVTransactionValues) => PrivateKVTransactionValues,
): Promise<void> {
  const uniqueKeys = [...new Set(keys)].sort();
  if (
    uniqueKeys.length < 1 ||
    uniqueKeys.length > MAX_PRIVATE_KV_TRANSACTION_TARGETS ||
    uniqueKeys.some((key) => !ACCOUNT_ISOLATION_RESET_KEYS.has(key))
  ) {
    throw new Error(PRIVATE_KV_TRANSACTION_JOURNAL_INVALID);
  }
  for (const key of uniqueKeys) assertPrivateDataKeyWritable(key);

  await ensurePrivateKVTransactionRecovered();
  return withOperationTiming('private_kv_write', () =>
    runAccountScopedPrivateMutation((generation) =>
      runSerializedPrivateTransaction(() =>
        runSerializedPrivateMutations(
          [PRIVATE_KV_TRANSACTION_JOURNAL_KEY, ...uniqueKeys],
          async () => {
            assertAccountScopedPrivateOperationAllowed(generation);
            if ((await AsyncStorage.getItem(PRIVATE_KV_TRANSACTION_JOURNAL_KEY)) !== null) {
              throw new Error(PRIVATE_KV_TRANSACTION_CONFLICT);
            }

            const beforeRaw = new Map<string, string | null>();
            const currentValues = new Map<string, string | null>();
            const currentEncoding = new Map<string, boolean>();
            let contentKey: Uint8Array | null = null;
            for (const key of uniqueKeys) {
              const raw = await assertNoFailedReadRewrite(key);
              beforeRaw.set(key, raw);
              const decoded = await decodeMutablePrivateRaw(key, raw, contentKey);
              contentKey = decoded.contentKey;
              currentValues.set(key, decoded.value);
              currentEncoding.set(key, decoded.current);
            }

            const requested = updater(new Map(currentValues));
            if (
              !(requested instanceof Map) ||
              requested.size !== uniqueKeys.length ||
              uniqueKeys.some(
                (key) =>
                  !requested.has(key) ||
                  (requested.get(key) !== null && typeof requested.get(key) !== 'string'),
              )
            ) {
              throw new Error(PRIVATE_KV_TRANSACTION_JOURNAL_INVALID);
            }

            const targetInputs = uniqueKeys.flatMap((key) => {
              const nextValue = requested.get(key)!;
              if (nextValue === currentValues.get(key) && currentEncoding.get(key)) return [];
              return [{ key, beforeRaw: beforeRaw.get(key) ?? null, nextValue }];
            });
            const targets: PrivateKVTransactionTarget[] = [];
            for (const target of targetInputs) {
              targets.push({
                key: target.key,
                beforeRawHash: await privateKVTransactionBeforeRawHash(target.beforeRaw),
                nextValue: target.nextValue,
              });
            }
            if (targets.length === 0) return;

            assertAccountScopedPrivateOperationAllowed(generation);
            const latest = await AsyncStorage.multiGet(uniqueKeys);
            if (latest.some(([key, raw]) => raw !== beforeRaw.get(key))) {
              throw new Error(PRIVATE_KV_WRITE_CONFLICT);
            }
            contentKey ??= await getOrCreateContentKey();
            const candidate: PrivateKVTransactionJournal = {
              version: PRIVATE_KV_TRANSACTION_SCHEMA_VERSION,
              transactionId: bytesToHex(randomBytes(32)),
              targets,
            };
            // Round-trip through the strict decoder before the commit marker is
            // written, including aggregate target/value bounds.
            const journal = decodePrivateKVTransactionJournal(
              encodePrivateKVTransactionJournal(candidate),
            );
            const journalRaw = encryptPrivateValue(
              encodePrivateKVTransactionJournal(journal),
              contentKey,
            );
            privateTransactionJournalKnownAbsent = false;
            await writeRawExactly(PRIVATE_KV_TRANSACTION_JOURNAL_KEY, journalRaw, generation);
            await applyPrivateKVTransactionJournal(journalRaw, journal, contentKey, generation);
          },
        ),
      ),
    ),
  );
}

/** Explicit startup/test entry; normal private operations invoke the same
 * single-flight recovery automatically before touching domain state. */
export async function recoverPendingPrivateKVTransaction(): Promise<void> {
  await ensurePrivateKVTransactionRecovered();
}

export function beginPrivateKVAccountBoundary(): void {
  if (accountBoundaryWriteBlockDepth === 0) {
    accountBoundaryGeneration += 1;
    for (const read of [...activeReadOperations]) read.invalidate();
  }
  accountBoundaryWriteBlockDepth += 1;
  accountBoundaryWriteBlocked = true;
}

export async function waitForPrivateKVWritesToSettle(): Promise<void> {
  while (inFlightMutationOperations.size > 0) {
    await Promise.allSettled([...inFlightMutationOperations]);
  }
}

export function endPrivateKVAccountBoundary(): void {
  accountBoundaryWriteBlockDepth = Math.max(0, accountBoundaryWriteBlockDepth - 1);
  accountBoundaryWriteBlocked = accountBoundaryWriteBlockDepth > 0;
}

export async function removePrivateItem(key: string): Promise<void> {
  return withOperationTiming('private_kv_remove', async () => {
    await ensurePrivateKVTransactionRecovered();
    return runAccountScopedPrivateMutation((generation) =>
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
    );
  });
}

export async function multiRemovePrivateItems(keys: readonly string[]): Promise<void> {
  await ensurePrivateKVTransactionRecovered();
  return runAccountScopedPrivateMutation((generation) =>
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
      if (uniqueKeys.includes(PRIVATE_KV_TRANSACTION_JOURNAL_KEY)) {
        privateTransactionJournalKnownAbsent = true;
      }
    });
    inFlightMutationOperations.add(pending);
    try {
      await pending;
    } finally {
      inFlightMutationOperations.delete(pending);
    }
  });
}

export async function clearPrivateKVContentKey(): Promise<void> {
  await clearStoredPrivateKVContentKey();
  failedReadSnapshots.clear();
  privateTransactionJournalKnownAbsent = false;
}

export const privateKVEncryptionInfo = {
  version: ENCRYPTION_VERSION,
  secureStoreKey: PRIVATE_KV_CONTENT_KEY_NAME,
} as const;
