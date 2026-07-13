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
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import {
  cleanupPlaintextStaging,
  cleanupPlaintextStagingUri,
  markPlaintextStagingState,
  reservePlaintextStaging,
} from '@/lib/storage/plaintextStaging';
import {
  deletePrivateSecureStoreItemAsync,
  getPrivateSecureStoreItemAsync,
  setPrivateSecureStoreItemAsync,
} from '@/lib/storage/privateSecureStore';

import { stripImageMetadataFromBase64 } from './metadata';

const PHOTO_DIR = `${FileSystem.documentDirectory ?? ''}photos/v1/`;
const KEY_ID = 'photo-content-key-v1';
const KEY_STORE_NAME = 'onskin.photo.content_key.v1';
const KEY_CREATION_MARKER = 'onskin.photo.content_key_created.v1';
const ENCRYPTION_VERSION = 'xchacha20poly1305:v1';
const NONCE_BYTES = 24;
export const PHOTO_CONTENT_KEY_MISSING = 'PHOTO_CONTENT_KEY_MISSING';
export const PHOTO_CONTENT_KEY_INVALID = 'PHOTO_CONTENT_KEY_INVALID';
export const PHOTO_CONTENT_KEY_STORAGE_UNAVAILABLE = 'PHOTO_CONTENT_KEY_STORAGE_UNAVAILABLE';
export const PHOTO_DECRYPTION_FAILED = 'PHOTO_DECRYPTION_FAILED';
export const PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY = 'PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY';
export const PHOTO_RECOVERY_CANDIDATE_UNAUTHENTICATED = 'PHOTO_RECOVERY_CANDIDATE_UNAUTHENTICATED';
export const PHOTO_RECOVERY_CANDIDATE_READ_FAILED = 'PHOTO_RECOVERY_CANDIDATE_READ_FAILED';
export const PHOTO_RECOVERY_CANDIDATE_CHANGED = 'PHOTO_RECOVERY_CANDIDATE_CHANGED';
export const PHOTO_RECOVERY_CONFLICT = 'PHOTO_RECOVERY_CONFLICT';
export const PHOTO_RECOVERY_KEY_CHANGED = 'PHOTO_RECOVERY_KEY_CHANGED';

type EncryptedPhotoEnvelope = {
  version: typeof ENCRYPTION_VERSION;
  keyId: typeof KEY_ID;
  mimeType: 'image/jpeg' | 'image/png';
  nonceHex: string;
  ciphertextHex: string;
};

type EncryptedTextEnvelope = {
  version: typeof ENCRYPTION_VERSION;
  keyId: typeof KEY_ID;
  nonceHex: string;
  ciphertextHex: string;
};

export type EncryptedPhotoWrite = {
  encryptedLocalUri: string;
  keyId: typeof KEY_ID;
  encryptionVersion: typeof ENCRYPTION_VERSION;
};

export type QuarantinedPhotoFile = {
  originalUri: string;
  quarantinedUri: string;
};

let contentKeyCreation: Promise<Uint8Array> | null = null;
const inFlightPhotoOperations = new Set<Promise<unknown>>();
let destructivePhotoOperationTail: Promise<void> = Promise.resolve();
let accountBoundaryWriteBlockDepth = 0;
let accountBoundaryWriteGeneration = 0;

function photoWritesBlocked(): boolean {
  return accountBoundaryWriteBlockDepth > 0;
}

function assertPhotoWriteAllowed(generation: number): void {
  if (photoWritesBlocked() || generation !== accountBoundaryWriteGeneration) {
    throw new Error(PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY);
  }
}

async function runAccountScopedPhotoOperation<T>(
  operation: (generation: number) => Promise<T>,
): Promise<T> {
  if (photoWritesBlocked()) throw new Error(PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY);
  const generation = accountBoundaryWriteGeneration;
  const pending = operation(generation);
  inFlightPhotoOperations.add(pending);
  try {
    const result = await pending;
    // Reads are owner-sensitive too. A boundary that begins while FileSystem or
    // SecureStore is awaited must not let owner A's plaintext resolve into an
    // owner B render, even though the operation performs no write.
    assertPhotoWriteAllowed(generation);
    return result;
  } finally {
    inFlightPhotoOperations.delete(pending);
  }
}

/**
 * Destructive filesystem work must be owned by both the photo-storage boundary
 * and the app-wide account generation. The outer lease is captured when the
 * public API is called, so an account switch can abort and drain the exact
 * operation even when it is waiting on the filesystem.
 */
function runDestructiveAccountScopedPhotoOperation<T>(
  operation: (assertCurrent: () => void) => Promise<T>,
): Promise<T> {
  return runAccountGenerationOperation((lease) =>
    runAccountScopedPhotoOperation(async (generation) => {
      const assertCurrent = () => {
        lease.assertCurrent();
        assertPhotoWriteAllowed(generation);
      };
      const guardedOperation = async () => {
        assertCurrent();
        const result = await operation(assertCurrent);
        assertCurrent();
        return result;
      };
      const pending = destructivePhotoOperationTail.then(guardedOperation, guardedOperation);
      destructivePhotoOperationTail = pending.then(
        () => undefined,
        () => undefined,
      );
      return pending;
    }),
  );
}

export function beginEncryptedPhotoAccountBoundary(): void {
  if (accountBoundaryWriteBlockDepth === 0) accountBoundaryWriteGeneration += 1;
  accountBoundaryWriteBlockDepth += 1;
}

export async function waitForEncryptedPhotoWritesToSettle(): Promise<void> {
  while (inFlightPhotoOperations.size > 0) {
    await Promise.allSettled([...inFlightPhotoOperations]);
  }
}

export function endEncryptedPhotoAccountBoundary(): void {
  accountBoundaryWriteBlockDepth = Math.max(0, accountBoundaryWriteBlockDepth - 1);
}

async function ensureDir(): Promise<void> {
  await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true }).catch(() => {});
}

async function readStoredContentKey(): Promise<string | null> {
  try {
    return await getPrivateSecureStoreItemAsync(KEY_STORE_NAME);
  } catch {
    throw new Error(PHOTO_CONTENT_KEY_STORAGE_UNAVAILABLE);
  }
}

async function markContentKeyCreated(): Promise<void> {
  await AsyncStorage.setItem(KEY_CREATION_MARKER, '1');
}

async function requireContentKeyMarker(): Promise<void> {
  try {
    await markContentKeyCreated();
  } catch {
    throw new Error(PHOTO_CONTENT_KEY_STORAGE_UNAVAILABLE);
  }
}

async function hasPriorEncryptedPhotoData(): Promise<boolean> {
  try {
    if ((await AsyncStorage.getItem(KEY_CREATION_MARKER)) === '1') return true;
    const info = await FileSystem.getInfoAsync(PHOTO_DIR);
    if (!info.exists) return false;
    const entries = await FileSystem.readDirectoryAsync(PHOTO_DIR);
    return entries.some(
      (name) =>
        name.endsWith('.onskinphoto') ||
        name.includes('.onskinphoto.pending-delete-') ||
        name.includes('.onskinphoto.pending-add-') ||
        name.includes('.onskinphoto.tmp-'),
    );
  } catch {
    throw new Error(PHOTO_CONTENT_KEY_STORAGE_UNAVAILABLE);
  }
}

type ContentKeySnapshot = {
  stored: string;
  key: Uint8Array;
};

async function getExistingContentKeySnapshot(): Promise<ContentKeySnapshot> {
  const existing = await readStoredContentKey();
  if (!existing) throw new Error(PHOTO_CONTENT_KEY_MISSING);
  const existingKey = contentKeyFromHex(existing);
  if (!existingKey) throw new Error(PHOTO_CONTENT_KEY_INVALID);
  return { stored: existing, key: existingKey };
}

async function getExistingContentKey(): Promise<Uint8Array> {
  return (await getExistingContentKeySnapshot()).key;
}

async function getOrCreateContentKey(): Promise<Uint8Array> {
  const existing = await readStoredContentKey();
  const existingKey = contentKeyFromHex(existing);
  if (existingKey) {
    await requireContentKeyMarker();
    return existingKey;
  }
  if (existing) throw new Error(PHOTO_CONTENT_KEY_INVALID);

  if (!contentKeyCreation) {
    contentKeyCreation = (async () => {
      const rechecked = await readStoredContentKey();
      const recheckedKey = contentKeyFromHex(rechecked);
      if (recheckedKey) {
        await requireContentKeyMarker();
        return recheckedKey;
      }
      if (rechecked) throw new Error(PHOTO_CONTENT_KEY_INVALID);
      if (await hasPriorEncryptedPhotoData()) throw new Error(PHOTO_CONTENT_KEY_MISSING);

      const key = randomBytes(32);
      try {
        await setPrivateSecureStoreItemAsync(KEY_STORE_NAME, bytesToHex(key));
        await markContentKeyCreated();
      } catch {
        throw new Error(PHOTO_CONTENT_KEY_STORAGE_UNAVAILABLE);
      }
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

function contentKeyFromHex(value: string | null | undefined): Uint8Array | null {
  if (!value || !/^[0-9a-f]{64}$/i.test(value)) return null;
  try {
    const key = hexToBytes(value);
    return key.byteLength === 32 ? key : null;
  } catch {
    return null;
  }
}

function encryptBytesWithKey(plaintext: Uint8Array, key: Uint8Array): EncryptedTextEnvelope {
  const nonce = randomBytes(NONCE_BYTES);
  const ciphertext = xchacha20poly1305(key, nonce).encrypt(plaintext);
  return {
    version: ENCRYPTION_VERSION,
    keyId: KEY_ID,
    nonceHex: bytesToHex(nonce),
    ciphertextHex: bytesToHex(ciphertext),
  };
}

function decryptBytesWithKey(envelope: EncryptedTextEnvelope, key: Uint8Array): Uint8Array {
  if (envelope.version !== ENCRYPTION_VERSION || envelope.keyId !== KEY_ID) {
    throw new Error('Unsupported photo encryption envelope.');
  }
  return xchacha20poly1305(key, hexToBytes(envelope.nonceHex)).decrypt(
    hexToBytes(envelope.ciphertextHex),
  );
}

function mimeForUri(uri: string): 'image/jpeg' | 'image/png' {
  return uri.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';
}

function safePhotoShareId(photoId: string): string {
  return photoId.replace(/[^A-Za-z0-9_-]/g, '') || 'photo';
}

export function encryptedPhotoUriForId(photoId: string): string {
  return `${PHOTO_DIR}${safePhotoShareId(photoId)}.onskinphoto`;
}

export function encryptedPhotoThumbnailUriForId(photoId: string): string {
  return `${PHOTO_DIR}${safePhotoShareId(photoId)}-thumbnail.onskinphoto`;
}

export function isOwnedEncryptedPhotoUri(uri?: string | null): uri is string {
  if (!uri || !uri.startsWith(PHOTO_DIR) || !uri.endsWith('.onskinphoto')) return false;
  const fileName = uri.slice(PHOTO_DIR.length);
  return /^[A-Za-z0-9_-]+\.onskinphoto$/.test(fileName);
}

function pendingAddPhotoUri(encryptedLocalUri: string, operationId: string): string {
  return `${encryptedLocalUri}.pending-add-${safePhotoShareId(operationId)}`;
}

function quarantinedPhotoUri(encryptedLocalUri: string, operationId: string): string {
  return `${encryptedLocalUri}.pending-delete-${safePhotoShareId(operationId)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJsonRecord(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isHex(value: unknown, expectedBytes?: number): value is string {
  if (typeof value !== 'string' || !/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) {
    return false;
  }
  return expectedBytes == null || value.length === expectedBytes * 2;
}

function textEnvelopeFromRecord(record: Record<string, unknown>): EncryptedTextEnvelope | null {
  if (record.version !== ENCRYPTION_VERSION || record.keyId !== KEY_ID) return null;
  if (!isHex(record.nonceHex, NONCE_BYTES) || !isHex(record.ciphertextHex)) return null;
  return {
    version: ENCRYPTION_VERSION,
    keyId: KEY_ID,
    nonceHex: record.nonceHex,
    ciphertextHex: record.ciphertextHex,
  };
}

function photoEnvelopeFromRaw(raw: string): EncryptedPhotoEnvelope | null {
  const record = parseJsonRecord(raw);
  if (!record) return null;
  const textEnvelope = textEnvelopeFromRecord(record);
  if (!textEnvelope) return null;
  if (record.mimeType !== 'image/jpeg' && record.mimeType !== 'image/png') return null;
  return { ...textEnvelope, mimeType: record.mimeType };
}

function encryptedTextEnvelopeFromRaw(raw: string): EncryptedTextEnvelope | null {
  const record = parseJsonRecord(raw);
  return record ? textEnvelopeFromRecord(record) : null;
}

function decryptEnvelopeToUtf8(envelope: EncryptedTextEnvelope, key: Uint8Array): string | null {
  try {
    return bytesToUtf8(decryptBytesWithKey(envelope, key));
  } catch {
    return null;
  }
}

export function isEncryptedPhotoUri(uri?: string | null): boolean {
  return Boolean(uri?.endsWith('.onskinphoto'));
}

export async function encryptCapturedPhoto(
  sourceUri: string,
  photoId: string,
  operationId = photoId,
): Promise<EncryptedPhotoWrite> {
  if (!sourceUri) throw new Error('Missing captured photo URI.');
  return runAccountScopedPhotoOperation(async (generation) => {
    await ensureDir();
    const key = await getOrCreateContentKey();
    const mimeType = mimeForUri(sourceUri);
    const base64 = await FileSystem.readAsStringAsync(sourceUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const strippedBase64 = stripImageMetadataFromBase64(base64, mimeType);
    const encrypted = encryptBytesWithKey(utf8ToBytes(strippedBase64), key);
    const envelope: EncryptedPhotoEnvelope = {
      ...encrypted,
      mimeType,
    };
    const encryptedLocalUri = encryptedPhotoUriForId(photoId);
    const temporaryUri = pendingAddPhotoUri(encryptedLocalUri, operationId);
    assertPhotoWriteAllowed(generation);
    try {
      if (
        (await recoveryPathExists(encryptedLocalUri)) ||
        (await recoveryPathExists(temporaryUri))
      ) {
        throw new Error(PHOTO_RECOVERY_CONFLICT);
      }
      await FileSystem.writeAsStringAsync(temporaryUri, JSON.stringify(envelope), {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await FileSystem.moveAsync({ from: temporaryUri, to: encryptedLocalUri });
    } catch (error) {
      await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => undefined);
      throw error;
    }
    return {
      encryptedLocalUri,
      keyId: KEY_ID,
      encryptionVersion: ENCRYPTION_VERSION,
    };
  });
}

export async function decryptPhotoToDataUri(encryptedLocalUri: string): Promise<string> {
  if (!isEncryptedPhotoUri(encryptedLocalUri)) return encryptedLocalUri;
  return runAccountScopedPhotoOperation(async () => {
    const raw = await FileSystem.readAsStringAsync(encryptedLocalUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const envelope = photoEnvelopeFromRaw(raw);
    if (!envelope) throw new Error('PHOTO_ENCRYPTION_ENVELOPE_INVALID');
    const key = await getExistingContentKey();
    const base64 = decryptEnvelopeToUtf8(envelope, key);
    if (!base64) throw new Error('PHOTO_ENCRYPTION_ENVELOPE_INVALID');
    return `data:${envelope.mimeType};base64,${base64}`;
  });
}

export async function createPhotoShareFile(encryptedLocalUri: string): Promise<string> {
  if (!isEncryptedPhotoUri(encryptedLocalUri)) return encryptedLocalUri;
  return runAccountScopedPhotoOperation(async (generation) => {
    const raw = await FileSystem.readAsStringAsync(encryptedLocalUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const envelope = photoEnvelopeFromRaw(raw);
    if (!envelope) throw new Error('PHOTO_ENCRYPTION_ENVELOPE_INVALID');
    const key = await getExistingContentKey();
    assertPhotoWriteAllowed(generation);
    const staging = await reservePlaintextStaging(
      envelope.mimeType === 'image/png' ? 'photo_share_png' : 'photo_share_jpeg',
    );
    try {
      const base64 = decryptEnvelopeToUtf8(envelope, key);
      if (!base64) throw new Error('PHOTO_ENCRYPTION_ENVELOPE_INVALID');
      const strippedBase64 = stripImageMetadataFromBase64(base64, envelope.mimeType);
      assertPhotoWriteAllowed(generation);
      await FileSystem.writeAsStringAsync(staging.uri, strippedBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      assertPhotoWriteAllowed(generation);
      await markPlaintextStagingState(staging, 'plaintext_written');
      return staging.uri;
    } catch (error) {
      await cleanupPlaintextStaging(staging).catch(() => undefined);
      throw error;
    }
  });
}

export async function deletePhotoShareFile(
  uri?: string | null,
  sourceUri?: string | null,
): Promise<void> {
  if (!uri || uri === sourceUri) return;
  await cleanupPlaintextStagingUri(uri).catch(() => undefined);
}

export async function deleteEncryptedPhoto(uri?: string | null): Promise<void> {
  if (!uri || !isEncryptedPhotoUri(uri)) return;
  if (!isOwnedEncryptedPhotoUri(uri)) throw new Error(PHOTO_RECOVERY_CONFLICT);
  await FileSystem.deleteAsync(uri, { idempotent: true });
}

/** Removes the camera cache source only after both encrypted file and metadata commit. */
export async function deleteCapturedPhotoSource(uri?: string | null): Promise<void> {
  if (!uri || isEncryptedPhotoUri(uri)) return;
  await cleanupPlaintextStagingUri(uri);
  await FileSystem.deleteAsync(uri, { idempotent: true });
}

/**
 * Moves an encrypted photo out of its live path before metadata is changed. If
 * the move fails, callers know the live file is untouched and must keep the
 * metadata row. The quarantine suffix is reconciled against metadata on the
 * next explicit mutation recovery after a crash or interrupted delete.
 */
export async function quarantineEncryptedPhoto(
  uri: string | null | undefined,
  operationId: string,
): Promise<QuarantinedPhotoFile | null> {
  if (!uri || !isEncryptedPhotoUri(uri)) return null;
  if (!isOwnedEncryptedPhotoUri(uri)) throw new Error(PHOTO_RECOVERY_CONFLICT);
  const quarantinedUri = quarantinedPhotoUri(uri, operationId);
  return runDestructiveAccountScopedPhotoOperation(async (assertCurrent) => {
    assertCurrent();
    if (await recoveryPathExists(quarantinedUri)) {
      throw new Error(PHOTO_RECOVERY_CONFLICT);
    }
    assertCurrent();
    await FileSystem.moveAsync({ from: uri, to: quarantinedUri });
    return { originalUri: uri, quarantinedUri };
  });
}

function assertOwnedQuarantinedPhotoFile(file: QuarantinedPhotoFile): void {
  if (
    !isOwnedEncryptedPhotoUri(file.originalUri) ||
    !file.quarantinedUri.startsWith(`${file.originalUri}.pending-delete-`) ||
    !/^[A-Za-z0-9_-]+$/.test(
      file.quarantinedUri.slice(`${file.originalUri}.pending-delete-`.length),
    )
  ) {
    throw new Error(PHOTO_RECOVERY_CONFLICT);
  }
}

export async function restoreQuarantinedPhoto(file: QuarantinedPhotoFile): Promise<void> {
  assertOwnedQuarantinedPhotoFile(file);
  await runDestructiveAccountScopedPhotoOperation(async (assertCurrent) => {
    assertCurrent();
    await FileSystem.moveAsync({ from: file.quarantinedUri, to: file.originalUri });
  });
}

export async function deleteQuarantinedPhoto(file: QuarantinedPhotoFile): Promise<void> {
  assertOwnedQuarantinedPhotoFile(file);
  await runDestructiveAccountScopedPhotoOperation(async (assertCurrent) => {
    assertCurrent();
    await FileSystem.deleteAsync(file.quarantinedUri, { idempotent: true });
  });
}

type RecoveryAction = { type: 'delete'; uri: string } | { type: 'move'; from: string; to: string };

async function readRecoveryCandidate(uri: string): Promise<string> {
  try {
    return await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch {
    throw new Error(PHOTO_RECOVERY_CANDIDATE_READ_FAILED);
  }
}

function assertRecoveryCandidateAuthenticates(raw: string, key: Uint8Array): void {
  const envelope = photoEnvelopeFromRaw(raw);
  if (!envelope || decryptEnvelopeToUtf8(envelope, key) === null) {
    throw new Error(PHOTO_RECOVERY_CANDIDATE_UNAUTHENTICATED);
  }
}

async function recoveryPathExists(uri: string): Promise<boolean> {
  try {
    return (await FileSystem.getInfoAsync(uri)).exists;
  } catch {
    throw new Error(PHOTO_RECOVERY_CANDIDATE_READ_FAILED);
  }
}

type AuthenticatedRecoverySnapshots = {
  key: ContentKeySnapshot;
  paths: Map<string, string>;
};

async function authenticateRecoveryPaths(
  uris: readonly string[],
): Promise<AuthenticatedRecoverySnapshots | null> {
  const uniqueUris = [...new Set(uris)];
  if (uniqueUris.length === 0) return null;
  const key = await getExistingContentKeySnapshot();
  const paths = new Map<string, string>();
  for (const uri of uniqueUris) {
    const raw = await readRecoveryCandidate(uri);
    assertRecoveryCandidateAuthenticates(raw, key.key);
    paths.set(uri, raw);
  }
  return { key, paths };
}

async function assertRecoverySnapshotsCurrent(
  snapshots: AuthenticatedRecoverySnapshots,
  absentPaths: ReadonlySet<string> = new Set(),
): Promise<void> {
  const recheckedKey = await getExistingContentKeySnapshot();
  if (recheckedKey.stored !== snapshots.key.stored) {
    throw new Error(PHOTO_RECOVERY_KEY_CHANGED);
  }
  for (const [uri, expectedRaw] of snapshots.paths) {
    if ((await readRecoveryCandidate(uri)) !== expectedRaw) {
      throw new Error(PHOTO_RECOVERY_CANDIDATE_CHANGED);
    }
  }
  for (const uri of absentPaths) {
    if (await recoveryPathExists(uri)) throw new Error(PHOTO_RECOVERY_CONFLICT);
  }
}

/**
 * Authenticates and publishes only the deterministic add artifact named by the
 * co-persisted mutation journal. Unknown files are never scanned or removed.
 */
export async function recoverPreparedEncryptedPhoto(
  encryptedLocalUri: string,
  operationId: string,
): Promise<boolean> {
  if (!isOwnedEncryptedPhotoUri(encryptedLocalUri)) {
    throw new Error(PHOTO_RECOVERY_CONFLICT);
  }
  const pendingUri = pendingAddPhotoUri(encryptedLocalUri, operationId);
  return runDestructiveAccountScopedPhotoOperation(async (assertCurrent) => {
    const finalExists = await recoveryPathExists(encryptedLocalUri);
    assertCurrent();
    const pendingExists = await recoveryPathExists(pendingUri);
    assertCurrent();
    if (!finalExists && !pendingExists) return false;

    if (finalExists) {
      const snapshots = await authenticateRecoveryPaths([encryptedLocalUri]);
      if (!snapshots) return false;
      assertCurrent();
      if (pendingExists) {
        const pendingRaw = await readRecoveryCandidate(pendingUri);
        assertCurrent();
        let pendingAuthenticates = false;
        if (photoEnvelopeFromRaw(pendingRaw)) {
          try {
            assertRecoveryCandidateAuthenticates(pendingRaw, snapshots.key.key);
            pendingAuthenticates = true;
          } catch {
            // The authenticated final is authoritative. An interrupted sibling
            // remains exact-journal-owned and cannot be the only photo copy.
          }
        }
        if (
          pendingAuthenticates &&
          snapshots.paths.get(encryptedLocalUri) !== pendingRaw
        ) {
          throw new Error(PHOTO_RECOVERY_CONFLICT);
        }
        snapshots.paths.set(pendingUri, pendingRaw);
        await assertRecoverySnapshotsCurrent(snapshots);
        assertCurrent();
        await FileSystem.deleteAsync(pendingUri, { idempotent: true });
      } else {
        await assertRecoverySnapshotsCurrent(snapshots);
        assertCurrent();
      }
      return true;
    }

    const snapshots = await authenticateRecoveryPaths([pendingUri]);
    if (!snapshots) return false;
    assertCurrent();
    await assertRecoverySnapshotsCurrent(snapshots, new Set([encryptedLocalUri]));
    assertCurrent();
    await FileSystem.moveAsync({ from: pendingUri, to: encryptedLocalUri });
    return true;
  });
}

/**
 * A process may die halfway through writing the exact pending-add file. When
 * the matching protected plaintext source still exists, callers may discard
 * the exact journal-owned pending artifact and retry encryption. Callers MUST
 * prove that exact source handle before invoking this function.
 */
export async function discardPendingEncryptedPhotoForRetry(
  encryptedLocalUri: string,
  operationId: string,
): Promise<boolean> {
  if (!isOwnedEncryptedPhotoUri(encryptedLocalUri)) {
    throw new Error(PHOTO_RECOVERY_CONFLICT);
  }
  const pendingUri = pendingAddPhotoUri(encryptedLocalUri, operationId);
  return runDestructiveAccountScopedPhotoOperation(async (assertCurrent) => {
    if (await recoveryPathExists(encryptedLocalUri)) throw new Error(PHOTO_RECOVERY_CONFLICT);
    assertCurrent();
    if (!(await recoveryPathExists(pendingUri))) return false;
    assertCurrent();
    const raw = await readRecoveryCandidate(pendingUri);
    assertCurrent();
    if ((await readRecoveryCandidate(pendingUri)) !== raw) {
      throw new Error(PHOTO_RECOVERY_CANDIDATE_CHANGED);
    }
    assertCurrent();
    await FileSystem.deleteAsync(pendingUri, { idempotent: true });
    return true;
  });
}

function exactDeletionTargets(uris: readonly string[], operationId: string) {
  const originals = [...new Set(uris)];
  if (originals.some((uri) => !isOwnedEncryptedPhotoUri(uri))) {
    throw new Error(PHOTO_RECOVERY_CONFLICT);
  }
  return originals.map((originalUri) => ({
    originalUri,
    quarantinedUri: quarantinedPhotoUri(originalUri, operationId),
  }));
}

/** Preflight before the atomic prepared journal is written. */
export async function verifyEncryptedPhotoDeletionSources(uris: readonly string[]): Promise<void> {
  const targets = exactDeletionTargets(uris, 'preflight');
  await runDestructiveAccountScopedPhotoOperation(async (assertCurrent) => {
    if (targets.length === 0) return;
    const key = await getExistingContentKeySnapshot();
    assertCurrent();
    for (const target of targets) {
      if (!(await recoveryPathExists(target.originalUri))) {
        throw new Error(PHOTO_RECOVERY_CONFLICT);
      }
      assertCurrent();
      const raw = await readRecoveryCandidate(target.originalUri);
      assertRecoveryCandidateAuthenticates(raw, key.key);
      assertCurrent();
      const recheckedKey = await getExistingContentKeySnapshot();
      if (recheckedKey.stored !== key.stored) throw new Error(PHOTO_RECOVERY_KEY_CHANGED);
      if ((await readRecoveryCandidate(target.originalUri)) !== raw) {
        throw new Error(PHOTO_RECOVERY_CANDIDATE_CHANGED);
      }
      assertCurrent();
    }
  });
}

/** Moves only journal-authorized, authenticated files out of their live paths. */
export async function stageEncryptedPhotoDeletions(
  uris: readonly string[],
  operationId: string,
): Promise<void> {
  const targets = exactDeletionTargets(uris, operationId);
  await runDestructiveAccountScopedPhotoOperation(async (assertCurrent) => {
    if (targets.length === 0) return;
    const key = await getExistingContentKeySnapshot();
    assertCurrent();
    for (const target of targets) {
      const originalExists = await recoveryPathExists(target.originalUri);
      assertCurrent();
      const quarantinedExists = await recoveryPathExists(target.quarantinedUri);
      assertCurrent();
      if (originalExists && quarantinedExists) throw new Error(PHOTO_RECOVERY_CONFLICT);
      if (!originalExists && !quarantinedExists) throw new Error(PHOTO_RECOVERY_CONFLICT);
      const candidateUri = originalExists ? target.originalUri : target.quarantinedUri;
      const raw = await readRecoveryCandidate(candidateUri);
      assertRecoveryCandidateAuthenticates(raw, key.key);
      assertCurrent();
      const recheckedKey = await getExistingContentKeySnapshot();
      if (recheckedKey.stored !== key.stored) throw new Error(PHOTO_RECOVERY_KEY_CHANGED);
      if ((await readRecoveryCandidate(candidateUri)) !== raw) {
        throw new Error(PHOTO_RECOVERY_CANDIDATE_CHANGED);
      }
      if (originalExists) {
        if (await recoveryPathExists(target.quarantinedUri)) {
          throw new Error(PHOTO_RECOVERY_CONFLICT);
        }
        assertCurrent();
        await FileSystem.moveAsync({ from: target.originalUri, to: target.quarantinedUri });
      } else if (await recoveryPathExists(target.originalUri)) {
        throw new Error(PHOTO_RECOVERY_CONFLICT);
      }
      assertCurrent();
    }
  });
}

/** Deletes only exact, authenticated quarantines after metadata reached commit. */
export async function finalizeEncryptedPhotoDeletions(
  uris: readonly string[],
  operationId: string,
): Promise<void> {
  const targets = exactDeletionTargets(uris, operationId);
  await runDestructiveAccountScopedPhotoOperation(async (assertCurrent) => {
    let key: ContentKeySnapshot | null = null;
    for (const target of targets) {
      if (await recoveryPathExists(target.originalUri)) {
        throw new Error(PHOTO_RECOVERY_CONFLICT);
      }
      assertCurrent();
      if (!(await recoveryPathExists(target.quarantinedUri))) continue;
      assertCurrent();
      key ??= await getExistingContentKeySnapshot();
      assertCurrent();
      const raw = await readRecoveryCandidate(target.quarantinedUri);
      assertRecoveryCandidateAuthenticates(raw, key.key);
      const recheckedKey = await getExistingContentKeySnapshot();
      if (recheckedKey.stored !== key.stored) throw new Error(PHOTO_RECOVERY_KEY_CHANGED);
      if ((await readRecoveryCandidate(target.quarantinedUri)) !== raw) {
        throw new Error(PHOTO_RECOVERY_CANDIDATE_CHANGED);
      }
      if (await recoveryPathExists(target.originalUri)) {
        throw new Error(PHOTO_RECOVERY_CONFLICT);
      }
      assertCurrent();
      await FileSystem.deleteAsync(target.quarantinedUri, { idempotent: true });
    }
  });
}

/**
 * Reconciles files left by process death. A quarantined file whose metadata row
 * still exists is restored; one whose row committed as deleted is removed.
 * Incomplete temp writes and unreferenced final envelopes are safe to remove
 * only after metadata parsed successfully and every candidate authenticates
 * under one stable, definitively readable content key.
 */
export async function reconcileEncryptedPhotoStorage(
  referencedUris: readonly string[],
  options: { removeUnreferencedFinals?: boolean } = {},
): Promise<void> {
  await runDestructiveAccountScopedPhotoOperation(async (assertCurrent) => {
    const referenced = new Set(referencedUris.filter(isEncryptedPhotoUri));
    const info = await FileSystem.getInfoAsync(PHOTO_DIR);
    assertCurrent();
    if (!info.exists) return;
    const entries = await FileSystem.readDirectoryAsync(PHOTO_DIR);
    assertCurrent();

    const candidates = entries.filter((entry) => {
      if (/^(.+\.onskinphoto)\.pending-delete-.+$/.test(entry)) return true;
      if (/\.onskinphoto\.tmp-.+$/.test(entry)) return true;
      return (
        options.removeUnreferencedFinals !== false &&
        entry.endsWith('.onskinphoto') &&
        !referenced.has(`${PHOTO_DIR}${entry}`)
      );
    });
    if (candidates.length === 0) return;

    // Recovery is deliberately two-phase. Authenticate and snapshot every path
    // before the first destructive operation so one malformed/wrong-key/read-
    // uncertain candidate preserves the complete directory byte-for-byte.
    const keySnapshot = await getExistingContentKeySnapshot();
    assertCurrent();
    const pathSnapshots = new Map<string, string>();
    const absentMoveTargets = new Set<string>();
    const actions: RecoveryAction[] = [];

    for (const entry of candidates) {
      assertCurrent();
      const uri = `${PHOTO_DIR}${entry}`;
      const raw = await readRecoveryCandidate(uri);
      assertCurrent();
      assertRecoveryCandidateAuthenticates(raw, keySnapshot.key);
      pathSnapshots.set(uri, raw);
      const quarantined = /^(.+\.onskinphoto)\.pending-delete-.+$/.exec(entry);
      if (quarantined) {
        const originalUri = `${PHOTO_DIR}${quarantined[1]}`;
        if (referenced.has(originalUri)) {
          const originalExists = await recoveryPathExists(originalUri);
          assertCurrent();
          if (originalExists) {
            const originalRaw = await readRecoveryCandidate(originalUri);
            assertCurrent();
            if (originalRaw !== raw) throw new Error(PHOTO_RECOVERY_CONFLICT);
            pathSnapshots.set(originalUri, originalRaw);
            actions.push({ type: 'delete', uri });
          } else {
            if (absentMoveTargets.has(originalUri)) throw new Error(PHOTO_RECOVERY_CONFLICT);
            absentMoveTargets.add(originalUri);
            actions.push({ type: 'move', from: uri, to: originalUri });
          }
        } else {
          actions.push({ type: 'delete', uri });
        }
        continue;
      }

      if (/\.onskinphoto\.tmp-.+$/.test(entry)) {
        actions.push({ type: 'delete', uri });
        continue;
      }

      actions.push({ type: 'delete', uri });
    }

    const assertSnapshotsCurrent = async () => {
      const recheckedKey = await getExistingContentKeySnapshot();
      assertCurrent();
      if (recheckedKey.stored !== keySnapshot.stored) {
        throw new Error(PHOTO_RECOVERY_KEY_CHANGED);
      }
      for (const [uri, expectedRaw] of pathSnapshots) {
        const currentRaw = await readRecoveryCandidate(uri);
        assertCurrent();
        if (currentRaw !== expectedRaw) throw new Error(PHOTO_RECOVERY_CANDIDATE_CHANGED);
      }
      for (const target of absentMoveTargets) {
        if (await recoveryPathExists(target)) throw new Error(PHOTO_RECOVERY_CONFLICT);
        assertCurrent();
      }
    };

    for (const action of actions) {
      // A preceding awaited filesystem action gives later candidates time to
      // change. Recheck the stable key and every still-authoritative path
      // immediately before each action; remove only snapshots this action has
      // successfully consumed.
      await assertSnapshotsCurrent();
      assertCurrent();
      if (action.type === 'move') {
        const expectedRaw = pathSnapshots.get(action.from)!;
        await FileSystem.moveAsync({ from: action.from, to: action.to });
        pathSnapshots.delete(action.from);
        absentMoveTargets.delete(action.to);
        pathSnapshots.set(action.to, expectedRaw);
      } else {
        await FileSystem.deleteAsync(action.uri, { idempotent: true });
        pathSnapshots.delete(action.uri);
      }
    }
  });
}

export async function clearEncryptedPhotoStorage(): Promise<void> {
  const clearPhotoDirectory = async () => {
    if (Platform.OS === 'web') {
      // Expo's legacy file API has no web backend, so web cannot own photo files.
      const info = await FileSystem.getInfoAsync(PHOTO_DIR).catch(() => null);
      if (!info?.exists) return;
    }
    await FileSystem.deleteAsync(PHOTO_DIR, { idempotent: true });
  };
  const operations: Promise<unknown>[] = [
    clearPhotoDirectory(),
    AsyncStorage.removeItem(KEY_CREATION_MARKER),
  ];
  if (Platform.OS !== 'web') operations.push(deletePrivateSecureStoreItemAsync(KEY_STORE_NAME));
  const results = await Promise.allSettled(operations);
  const failures = results.filter((result) => result.status === 'rejected');
  if (failures.length > 0) {
    throw new Error(`PHOTO_STORAGE_CLEAR_FAILED:${failures.length}`);
  }
}

export async function encryptPhotoNote(note: string | null | undefined): Promise<string | null> {
  if (!note) return null;
  return runAccountScopedPhotoOperation(async (generation) => {
    const key = await getOrCreateContentKey();
    assertPhotoWriteAllowed(generation);
    return JSON.stringify(encryptBytesWithKey(utf8ToBytes(note), key));
  });
}

export async function decryptPhotoNote(
  ciphertext: string | null | undefined,
): Promise<string | null> {
  if (!ciphertext) return null;
  return runAccountScopedPhotoOperation(async () => {
    const envelope = encryptedTextEnvelopeFromRaw(ciphertext);
    if (!envelope) throw new Error(PHOTO_DECRYPTION_FAILED);
    const key = await getExistingContentKey();
    const plaintext = decryptEnvelopeToUtf8(envelope, key);
    if (plaintext === null) throw new Error(PHOTO_DECRYPTION_FAILED);
    return plaintext;
  });
}

export function isPhotoEncryptionReadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return [
    PHOTO_CONTENT_KEY_MISSING,
    PHOTO_CONTENT_KEY_INVALID,
    PHOTO_CONTENT_KEY_STORAGE_UNAVAILABLE,
    PHOTO_DECRYPTION_FAILED,
  ].includes(error.message);
}

export const photoEncryptionInfo = {
  version: ENCRYPTION_VERSION,
  keyId: KEY_ID,
  directory: PHOTO_DIR,
  keyCreationMarker: KEY_CREATION_MARKER,
} as const;
