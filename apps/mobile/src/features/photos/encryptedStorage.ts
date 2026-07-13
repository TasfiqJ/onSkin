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
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import {
  cleanupPlaintextStaging,
  cleanupPlaintextStagingUri,
  markPlaintextStagingState,
  reservePlaintextStaging,
} from '@/lib/storage/plaintextStaging';

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
    return await pending;
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

      assertCurrent();
      const result = await operation(assertCurrent);
      assertCurrent();
      return result;
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
    return await SecureStore.getItemAsync(KEY_STORE_NAME);
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
        name.includes('.onskinphoto.tmp-'),
    );
  } catch {
    throw new Error(PHOTO_CONTENT_KEY_STORAGE_UNAVAILABLE);
  }
}

async function getExistingContentKey(generation: number): Promise<Uint8Array> {
  const existing = await readStoredContentKey();
  if (!existing) throw new Error(PHOTO_CONTENT_KEY_MISSING);
  const existingKey = contentKeyFromHex(existing);
  if (!existingKey) throw new Error(PHOTO_CONTENT_KEY_INVALID);
  assertPhotoWriteAllowed(generation);
  await requireContentKeyMarker();
  return existingKey;
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
        await SecureStore.setItemAsync(KEY_STORE_NAME, bytesToHex(key));
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
    const encryptedLocalUri = `${PHOTO_DIR}${photoId}.onskinphoto`;
    const temporaryUri = `${encryptedLocalUri}.tmp-${Date.now()}`;
    assertPhotoWriteAllowed(generation);
    try {
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
  return runAccountScopedPhotoOperation(async (generation) => {
    const raw = await FileSystem.readAsStringAsync(encryptedLocalUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const envelope = photoEnvelopeFromRaw(raw);
    if (!envelope) throw new Error('PHOTO_ENCRYPTION_ENVELOPE_INVALID');
    const key = await getExistingContentKey(generation);
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
    const key = await getExistingContentKey(generation);
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
 * next successful store read after a crash or interrupted delete.
 */
export async function quarantineEncryptedPhoto(
  uri: string | null | undefined,
  operationId: string,
): Promise<QuarantinedPhotoFile | null> {
  if (!uri || !isEncryptedPhotoUri(uri)) return null;
  const quarantinedUri = `${uri}.pending-delete-${safePhotoShareId(operationId)}`;
  return runDestructiveAccountScopedPhotoOperation(async (assertCurrent) => {
    assertCurrent();
    await FileSystem.moveAsync({ from: uri, to: quarantinedUri });
    return { originalUri: uri, quarantinedUri };
  });
}

export async function restoreQuarantinedPhoto(file: QuarantinedPhotoFile): Promise<void> {
  await runDestructiveAccountScopedPhotoOperation(async (assertCurrent) => {
    assertCurrent();
    await FileSystem.moveAsync({ from: file.quarantinedUri, to: file.originalUri });
  });
}

export async function deleteQuarantinedPhoto(file: QuarantinedPhotoFile): Promise<void> {
  await runDestructiveAccountScopedPhotoOperation(async (assertCurrent) => {
    assertCurrent();
    await FileSystem.deleteAsync(file.quarantinedUri, { idempotent: true });
  });
}

/**
 * Reconciles files left by process death. A quarantined file whose metadata row
 * still exists is restored; one whose row committed as deleted is removed.
 * Incomplete temp writes and unreferenced final envelopes are safe to remove
 * only after metadata parsed successfully.
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

    for (const entry of entries) {
      assertCurrent();
      const uri = `${PHOTO_DIR}${entry}`;
      const quarantined = /^(.+\.onskinphoto)\.pending-delete-.+$/.exec(entry);
      if (quarantined) {
        const originalUri = `${PHOTO_DIR}${quarantined[1]}`;
        if (referenced.has(originalUri)) {
          const originalInfo = await FileSystem.getInfoAsync(originalUri);
          assertCurrent();
          if (originalInfo.exists) {
            await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
          } else {
            await FileSystem.moveAsync({ from: uri, to: originalUri });
          }
        } else {
          await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
        }
        continue;
      }

      if (/\.onskinphoto\.tmp-.+$/.test(entry)) {
        await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
        continue;
      }

      if (
        options.removeUnreferencedFinals !== false &&
        entry.endsWith('.onskinphoto') &&
        !referenced.has(uri)
      ) {
        await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
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
  if (Platform.OS !== 'web') operations.push(SecureStore.deleteItemAsync(KEY_STORE_NAME));
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
  return runAccountScopedPhotoOperation(async (generation) => {
    const envelope = encryptedTextEnvelopeFromRaw(ciphertext);
    if (!envelope) throw new Error(PHOTO_DECRYPTION_FAILED);
    const key = await getExistingContentKey(generation);
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
