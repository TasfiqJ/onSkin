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
  if (existing) return hexToBytes(existing);

  const key = randomBytes(32);
  await SecureStore.setItemAsync(KEY_STORE_NAME, bytesToHex(key));
  return key;
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
  const envelope = JSON.parse(raw) as EncryptedPhotoEnvelope;
  const base64 = bytesToUtf8(decryptBytesWithKey(envelope, key));
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
  const envelope = JSON.parse(raw) as EncryptedPhotoEnvelope;
  const base64 = bytesToUtf8(decryptBytesWithKey(envelope, key));
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
  const envelope = JSON.parse(ciphertext) as EncryptedTextEnvelope;
  return bytesToUtf8(decryptBytesWithKey(envelope, key));
}

export const photoEncryptionInfo = {
  version: ENCRYPTION_VERSION,
  keyId: KEY_ID,
  directory: PHOTO_DIR,
} as const;
