import 'react-native-get-random-values';

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

import { stripImageMetadataFromBase64 } from './metadata';

const PHOTO_DIR = `${FileSystem.documentDirectory ?? ''}photos/v1/`;
const KEY_ID = 'photo-content-key-v1';
const KEY_STORE_NAME = 'onskin.photo.content_key.v1';
const ENCRYPTION_VERSION = 'xchacha20poly1305:v1';
const NONCE_BYTES = 24;

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

async function ensureDir(): Promise<void> {
  await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true }).catch(() => {});
}

async function getContentKey(): Promise<Uint8Array> {
  const existing = await SecureStore.getItemAsync(KEY_STORE_NAME);
  const existingKey = contentKeyFromHex(existing);
  if (existingKey) return existingKey;
  if (existing) await SecureStore.deleteItemAsync(KEY_STORE_NAME).catch(() => {});

  const key = randomBytes(32);
  await SecureStore.setItemAsync(KEY_STORE_NAME, bytesToHex(key));
  return key;
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
  await ensureDir();
  const key = await getContentKey();
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
  await FileSystem.writeAsStringAsync(encryptedLocalUri, JSON.stringify(envelope), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await FileSystem.deleteAsync(sourceUri, { idempotent: true }).catch(() => {});
  return {
    encryptedLocalUri,
    keyId: KEY_ID,
    encryptionVersion: ENCRYPTION_VERSION,
  };
}

export async function decryptPhotoToDataUri(encryptedLocalUri: string): Promise<string> {
  if (!isEncryptedPhotoUri(encryptedLocalUri)) return encryptedLocalUri;
  const key = await getContentKey();
  const raw = await FileSystem.readAsStringAsync(encryptedLocalUri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  const envelope = photoEnvelopeFromRaw(raw);
  if (!envelope) throw new Error('PHOTO_ENCRYPTION_ENVELOPE_INVALID');
  const base64 = decryptEnvelopeToUtf8(envelope, key);
  if (!base64) throw new Error('PHOTO_ENCRYPTION_ENVELOPE_INVALID');
  return `data:${envelope.mimeType};base64,${base64}`;
}

export async function createPhotoShareFile(
  encryptedLocalUri: string,
  photoId: string,
): Promise<string> {
  if (!isEncryptedPhotoUri(encryptedLocalUri)) return encryptedLocalUri;
  const key = await getContentKey();
  const raw = await FileSystem.readAsStringAsync(encryptedLocalUri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  const envelope = photoEnvelopeFromRaw(raw);
  if (!envelope) throw new Error('PHOTO_ENCRYPTION_ENVELOPE_INVALID');
  const base64 = decryptEnvelopeToUtf8(envelope, key);
  if (!base64) throw new Error('PHOTO_ENCRYPTION_ENVELOPE_INVALID');
  const strippedBase64 = stripImageMetadataFromBase64(base64, envelope.mimeType);
  const extension = envelope.mimeType === 'image/png' ? 'png' : 'jpg';
  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory) throw new Error('PHOTO_SHARE_CACHE_UNAVAILABLE');
  const exportUri = `${cacheDirectory}onskin-share-${safePhotoShareId(photoId)}-${Date.now()}.${extension}`;
  await FileSystem.writeAsStringAsync(exportUri, strippedBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return exportUri;
}

export async function deletePhotoShareFile(
  uri?: string | null,
  sourceUri?: string | null,
): Promise<void> {
  if (!uri || uri === sourceUri) return;
  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory || !uri.startsWith(`${cacheDirectory}onskin-share-`)) return;
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
}

export async function deleteEncryptedPhoto(uri?: string | null): Promise<void> {
  if (!uri || !isEncryptedPhotoUri(uri)) return;
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
}

export async function clearEncryptedPhotoStorage(): Promise<void> {
  await FileSystem.deleteAsync(PHOTO_DIR, { idempotent: true }).catch(() => {});
  await SecureStore.deleteItemAsync(KEY_STORE_NAME).catch(() => {});
}

export async function encryptPhotoNote(note: string | null | undefined): Promise<string | null> {
  if (!note) return null;
  const key = await getContentKey();
  return JSON.stringify(encryptBytesWithKey(utf8ToBytes(note), key));
}

export async function decryptPhotoNote(
  ciphertext: string | null | undefined,
): Promise<string | null> {
  if (!ciphertext) return null;
  const key = await getContentKey();
  const envelope = encryptedTextEnvelopeFromRaw(ciphertext);
  return envelope ? decryptEnvelopeToUtf8(envelope, key) : null;
}

export const photoEncryptionInfo = {
  version: ENCRYPTION_VERSION,
  keyId: KEY_ID,
  directory: PHOTO_DIR,
} as const;
