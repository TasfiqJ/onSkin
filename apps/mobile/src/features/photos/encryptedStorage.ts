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

import {
  runAccountGenerationOperation,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import {
  assertHealthDataWriteLease,
  captureHealthDataWriteLease,
  type HealthDataWriteLease,
} from '@/lib/consent/healthDataWriteAdmission';
import {
  cleanupPlaintextStaging,
  cleanupPlaintextStagingUri,
  markPlaintextStagingState,
  reservePlaintextStaging,
} from '@/lib/storage/plaintextStaging';

import { stripImageMetadataFromBase64 } from './metadata';

const PHOTO_DIR = `${FileSystem.documentDirectory ?? ''}photos/v1/`;
const KEY_ID = 'photo-content-key-v1';
const KEY_STORE_NAME = 'layerwell.photo.content_key.v1';
const KEY_CREATION_MARKER = 'layerwell.photo.content_key_created.v1';
const PUBLICATION_JOURNAL_KEY = 'layerwell.photo.publication_journal.v1';
const ENCRYPTION_VERSION = 'xchacha20poly1305:v1';
const PHOTO_RENDITION_ENCRYPTION_VERSION = 'xchacha20poly1305:photo-rendition:v1';
const NONCE_BYTES = 24;
const SAFE_RENDITION_PHOTO_ID = /^(?!.*-thumbnail$)[A-Za-z0-9_-]{1,128}$/u;
const CANONICAL_CAPTURE_SESSION_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
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

type EncryptedPhotoRenditionEnvelope = {
  version: typeof PHOTO_RENDITION_ENCRYPTION_VERSION;
  keyId: typeof KEY_ID;
  mimeType: 'image/jpeg' | 'image/png';
  nonceHex: string;
  ciphertextHex: string;
  photoId: string;
  captureSessionId: string | null;
  rendition: 'original' | 'thumbnail';
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
  encryptionVersion: typeof ENCRYPTION_VERSION | typeof PHOTO_RENDITION_ENCRYPTION_VERSION;
};

export type PhotoRenditionIdentity = Readonly<{
  photoId: string;
  captureSessionId: string | null;
  rendition: 'original' | 'thumbnail';
}>;

export type PhotoRenditionReadExpectation = PhotoRenditionIdentity &
  Readonly<{ allowLegacyEnvelope?: boolean }>;

type PublicationStage =
  | 'prepared'
  | 'original_adopted'
  | 'pair_adopted'
  | 'metadata_committed'
  | 'raw_cleaned';

type PhotoPublicationJournal = Readonly<{
  version: 1;
  photoId: string;
  captureSessionId: string | null;
  originalUri: string;
  thumbnailUri: string;
  rawSourceUri: string;
  stage: PublicationStage;
  ownerUserId: string;
  healthGeneration: number;
  healthEpoch: number;
  accountGeneration: number;
}>;

function publicationJournalFor(
  identity: Omit<PhotoRenditionIdentity, 'rendition'>,
  lease: HealthDataWriteLease,
  rawSourceUri: string,
): PhotoPublicationJournal {
  return {
    version: 1,
    photoId: identity.photoId,
    captureSessionId: identity.captureSessionId,
    originalUri: canonicalPhotoRenditionUri({ ...identity, rendition: 'original' }),
    thumbnailUri: canonicalPhotoRenditionUri({ ...identity, rendition: 'thumbnail' }),
    rawSourceUri,
    stage: 'prepared',
    ownerUserId: lease.ownerUserId,
    healthGeneration: lease.generation,
    healthEpoch: lease.epoch,
    accountGeneration: lease.accountGeneration,
  };
}

function parsePublicationJournal(raw: string | null): PhotoPublicationJournal | null {
  if (raw === null) return null;
  const value = parseJsonRecord(raw);
  if (
    !value ||
    !hasExactKeys(value, [
      'version', 'photoId', 'captureSessionId', 'originalUri', 'thumbnailUri', 'rawSourceUri', 'stage',
      'ownerUserId', 'healthGeneration', 'healthEpoch', 'accountGeneration',
    ]) ||
    value.version !== 1 ||
    typeof value.photoId !== 'string' ||
    !SAFE_RENDITION_PHOTO_ID.test(value.photoId) ||
    (value.captureSessionId !== null &&
      (typeof value.captureSessionId !== 'string' ||
        !CANONICAL_CAPTURE_SESSION_ID.test(value.captureSessionId))) ||
    typeof value.ownerUserId !== 'string' ||
    !isOwnedCaptureSourceUri(value.rawSourceUri) ||
    typeof value.healthGeneration !== 'number' ||
    typeof value.healthEpoch !== 'number' ||
    typeof value.accountGeneration !== 'number' ||
    !['prepared', 'original_adopted', 'pair_adopted', 'metadata_committed', 'raw_cleaned'].includes(
      String(value.stage),
    )
  ) return null;
  const identity = { photoId: value.photoId, captureSessionId: value.captureSessionId };
  const originalUri = canonicalPhotoRenditionUri({ ...identity, rendition: 'original' });
  const thumbnailUri = canonicalPhotoRenditionUri({ ...identity, rendition: 'thumbnail' });
  if (value.originalUri !== originalUri || value.thumbnailUri !== thumbnailUri) return null;
  return value as PhotoPublicationJournal;
}

export async function beginPhotoRenditionPublication(
  identity: Omit<PhotoRenditionIdentity, 'rendition'>,
  rawSourceUri: string,
): Promise<void> {
  if (!isOwnedCaptureSourceUri(rawSourceUri)) throw new Error('PHOTO_CAPTURE_SOURCE_URI_UNTRUSTED');
  const lease = captureHealthDataWriteLease();
  const existing = await AsyncStorage.getItem(PUBLICATION_JOURNAL_KEY);
  assertHealthDataWriteLease(lease);
  if (existing !== null) throw new Error('PHOTO_PUBLICATION_RECOVERY_REQUIRED');
  await AsyncStorage.setItem(PUBLICATION_JOURNAL_KEY, JSON.stringify(publicationJournalFor(identity, lease, rawSourceUri)));
  assertHealthDataWriteLease(lease);
}

export async function markPhotoRenditionPublication(
  identity: Omit<PhotoRenditionIdentity, 'rendition'>,
  stage: Exclude<PublicationStage, 'prepared'>,
): Promise<void> {
  const lease = captureHealthDataWriteLease();
  const current = parsePublicationJournal(await AsyncStorage.getItem(PUBLICATION_JOURNAL_KEY));
  assertHealthDataWriteLease(lease);
  if (
    !current || current.photoId !== identity.photoId ||
    current.captureSessionId !== identity.captureSessionId ||
    current.ownerUserId !== lease.ownerUserId || current.healthGeneration !== lease.generation ||
    current.healthEpoch !== lease.epoch || current.accountGeneration !== lease.accountGeneration
  ) throw new Error('PHOTO_PUBLICATION_RECOVERY_REQUIRED');
  await AsyncStorage.setItem(PUBLICATION_JOURNAL_KEY, JSON.stringify({ ...current, stage }));
  assertHealthDataWriteLease(lease);
}

export async function settlePhotoRenditionPublication(
  identity: Omit<PhotoRenditionIdentity, 'rendition'>,
): Promise<void> {
  const lease = captureHealthDataWriteLease();
  const current = parsePublicationJournal(await AsyncStorage.getItem(PUBLICATION_JOURNAL_KEY));
  assertHealthDataWriteLease(lease);
  if (!current || current.photoId !== identity.photoId || current.captureSessionId !== identity.captureSessionId ||
      current.stage !== 'raw_cleaned' || current.ownerUserId !== lease.ownerUserId ||
      current.healthGeneration !== lease.generation || current.healthEpoch !== lease.epoch ||
      current.accountGeneration !== lease.accountGeneration) {
    throw new Error('PHOTO_PUBLICATION_RECOVERY_REQUIRED');
  }
  await AsyncStorage.removeItem(PUBLICATION_JOURNAL_KEY);
  assertHealthDataWriteLease(lease);
}

export async function recoverPhotoRenditionPublication(
  committedPhotoIds: ReadonlySet<string> | null,
): Promise<void> {
  const lease = captureHealthDataWriteLease();
  const raw = await AsyncStorage.getItem(PUBLICATION_JOURNAL_KEY);
  assertHealthDataWriteLease(lease);
  if (raw === null) return;
  const current = parsePublicationJournal(raw);
  if (!current) throw new Error('PHOTO_PUBLICATION_JOURNAL_INVALID');
  if (current.ownerUserId !== lease.ownerUserId || current.healthGeneration !== lease.generation ||
      current.healthEpoch !== lease.epoch || current.accountGeneration !== lease.accountGeneration) {
    throw new Error('PHOTO_PUBLICATION_AUTHORITY_MISMATCH');
  }
  if (committedPhotoIds === null) return; // corrupt/unknown metadata: preserve, never guess.
  if (!committedPhotoIds.has(current.photoId)) {
    await FileSystem.deleteAsync(current.originalUri, { idempotent: true });
    assertHealthDataWriteLease(lease);
    await FileSystem.deleteAsync(current.thumbnailUri, { idempotent: true });
    assertHealthDataWriteLease(lease);
    await AsyncStorage.removeItem(PUBLICATION_JOURNAL_KEY);
    return;
  }
  const [originalInfo, thumbnailInfo] = await Promise.all([
    FileSystem.getInfoAsync(current.originalUri),
    FileSystem.getInfoAsync(current.thumbnailUri),
  ]);
  assertHealthDataWriteLease(lease);
  if (!originalInfo.exists || !thumbnailInfo.exists) {
    throw new Error('PHOTO_PUBLICATION_COMMITTED_PAIR_INCOMPLETE');
  }
  // A valid committed row proves the pair is live even if process death occurred
  // immediately after metadata persistence. Leave cleanup state durable until the
  // caller has successfully removed its exact raw source.
  if (current.stage !== 'metadata_committed' && current.stage !== 'raw_cleaned') {
    await AsyncStorage.setItem(PUBLICATION_JOURNAL_KEY, JSON.stringify({ ...current, stage: 'metadata_committed' }));
  }
  await FileSystem.deleteAsync(current.rawSourceUri, { idempotent: true });
  assertHealthDataWriteLease(lease);
  await AsyncStorage.removeItem(PUBLICATION_JOURNAL_KEY);
}

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

function assertHealthPhotoOperationCurrent(
  generation: number,
  healthLease: HealthDataWriteLease,
): void {
  assertPhotoWriteAllowed(generation);
  assertHealthDataWriteLease(healthLease);
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
        name.endsWith('.layerwellphoto') ||
        name.includes('.layerwellphoto.pending-delete-') ||
        name.includes('.layerwellphoto.tmp-'),
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

function hasExactKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isOwnedCaptureSourceUri(value: unknown): value is string {
  if (typeof value !== 'string' || !FileSystem.cacheDirectory) return false;
  return value.startsWith(FileSystem.cacheDirectory) && !value.includes('/../') && !value.includes('\\');
}

export function canonicalPhotoRenditionUri(identity: PhotoRenditionIdentity): string {
  if (!SAFE_RENDITION_PHOTO_ID.test(identity.photoId)) {
    throw new Error('PHOTO_RENDITION_IDENTITY_INVALID');
  }
  const suffix = identity.rendition === 'thumbnail' ? '-thumbnail' : '';
  return `${PHOTO_DIR}${identity.photoId}${suffix}.layerwellphoto`;
}

export function ownedEncryptedPhotoUri(uri: unknown): string | null {
  if (typeof uri !== 'string' || !uri.startsWith(PHOTO_DIR)) return null;
  const name = uri.slice(PHOTO_DIR.length);
  if (name.includes('/') || name.includes('\\')) return null;
  const match = /^((?!.*-thumbnail$)[A-Za-z0-9_-]{1,128})(-thumbnail)?\.layerwellphoto$/u.exec(name);
  return match ? uri : null;
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

function renditionAssociatedData(
  value: Pick<
    EncryptedPhotoRenditionEnvelope,
    'version' | 'keyId' | 'mimeType' | 'photoId' | 'captureSessionId' | 'rendition'
  >,
): Uint8Array {
  return utf8ToBytes(
    JSON.stringify({
      version: value.version,
      keyId: value.keyId,
      mimeType: value.mimeType,
      photoId: value.photoId,
      captureSessionId: value.captureSessionId,
      rendition: value.rendition,
    }),
  );
}

function photoEnvelopeFromRaw(
  raw: string,
): EncryptedPhotoEnvelope | EncryptedPhotoRenditionEnvelope | null {
  const record = parseJsonRecord(raw);
  if (!record) return null;
  if (record.version === PHOTO_RENDITION_ENCRYPTION_VERSION) {
    if (
      !hasExactKeys(record, [
        'version', 'keyId', 'mimeType', 'nonceHex', 'ciphertextHex', 'photoId',
        'captureSessionId', 'rendition',
      ]) ||
      record.keyId !== KEY_ID ||
      (record.mimeType !== 'image/jpeg' && record.mimeType !== 'image/png') ||
      !isHex(record.nonceHex, NONCE_BYTES) ||
      !isHex(record.ciphertextHex) ||
      typeof record.photoId !== 'string' || !SAFE_RENDITION_PHOTO_ID.test(record.photoId) ||
      (record.captureSessionId !== null &&
        (typeof record.captureSessionId !== 'string' ||
          !CANONICAL_CAPTURE_SESSION_ID.test(record.captureSessionId))) ||
      (record.rendition !== 'original' && record.rendition !== 'thumbnail')
    ) {
      return null;
    }
    return {
      version: PHOTO_RENDITION_ENCRYPTION_VERSION,
      keyId: KEY_ID,
      mimeType: record.mimeType,
      nonceHex: record.nonceHex,
      ciphertextHex: record.ciphertextHex,
      photoId: record.photoId,
      captureSessionId: record.captureSessionId,
      rendition: record.rendition,
    };
  }
  const textEnvelope = textEnvelopeFromRecord(record);
  if (!textEnvelope) return null;
  if (record.mimeType !== 'image/jpeg' && record.mimeType !== 'image/png') return null;
  return { ...textEnvelope, mimeType: record.mimeType };
}

function decryptPhotoEnvelopeToUtf8(
  envelope: EncryptedPhotoEnvelope | EncryptedPhotoRenditionEnvelope,
  key: Uint8Array,
): string | null {
  try {
    const cipher =
      envelope.version === PHOTO_RENDITION_ENCRYPTION_VERSION
        ? xchacha20poly1305(key, hexToBytes(envelope.nonceHex), renditionAssociatedData(envelope))
        : xchacha20poly1305(key, hexToBytes(envelope.nonceHex));
    return bytesToUtf8(cipher.decrypt(hexToBytes(envelope.ciphertextHex)));
  } catch {
    return null;
  }
}

function encryptedTextEnvelopeFromRaw(raw: string): EncryptedTextEnvelope | null {
  const record = parseJsonRecord(raw);
  return record ? textEnvelopeFromRecord(record) : null;
}

function decryptEnvelopeToUtf8(
  envelope: EncryptedTextEnvelope | EncryptedPhotoEnvelope | EncryptedPhotoRenditionEnvelope,
  key: Uint8Array,
): string | null {
  if ('mimeType' in envelope) return decryptPhotoEnvelopeToUtf8(envelope, key);
  try {
    return bytesToUtf8(decryptBytesWithKey(envelope, key));
  } catch {
    return null;
  }
}

export function isEncryptedPhotoUri(uri?: string | null): boolean {
  return ownedEncryptedPhotoUri(uri) !== null;
}

export async function encryptCapturedPhoto(
  sourceUri: string,
  photoId: string,
): Promise<EncryptedPhotoWrite> {
  if (!sourceUri) throw new Error('Missing captured photo URI.');
  return runAccountScopedPhotoOperation(async (generation) => {
    const healthLease = captureHealthDataWriteLease();
    await ensureDir();
    const key = await getOrCreateContentKey();
    assertHealthDataWriteLease(healthLease);
    const mimeType = mimeForUri(sourceUri);
    const base64 = await FileSystem.readAsStringAsync(sourceUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    assertHealthDataWriteLease(healthLease);
    const strippedBase64 = stripImageMetadataFromBase64(base64, mimeType);
    const encrypted = encryptBytesWithKey(utf8ToBytes(strippedBase64), key);
    const envelope: EncryptedPhotoEnvelope = {
      ...encrypted,
      mimeType,
    };
    const encryptedLocalUri = `${PHOTO_DIR}${photoId}.layerwellphoto`;
    const temporaryUri = `${encryptedLocalUri}.tmp-${Date.now()}`;
    let finalMoveCompleted = false;
    try {
      assertHealthPhotoOperationCurrent(generation, healthLease);
      await FileSystem.writeAsStringAsync(temporaryUri, JSON.stringify(envelope), {
        encoding: FileSystem.EncodingType.UTF8,
      });
      assertHealthDataWriteLease(healthLease);
      await FileSystem.moveAsync({ from: temporaryUri, to: encryptedLocalUri });
      finalMoveCompleted = true;
      assertHealthDataWriteLease(healthLease);
    } catch (error) {
      const cleanup = [FileSystem.deleteAsync(temporaryUri, { idempotent: true })];
      if (finalMoveCompleted) {
        cleanup.push(FileSystem.deleteAsync(encryptedLocalUri, { idempotent: true }));
      }
      await Promise.allSettled(cleanup);
      throw error;
    }
    assertHealthDataWriteLease(healthLease);
    return {
      encryptedLocalUri,
      keyId: KEY_ID,
      encryptionVersion: ENCRYPTION_VERSION,
    };
  });
}

/**
 * Encrypts one rendition with authenticated publication identity. The full-size
 * and thumbnail files use different final paths and their clear envelope
 * identities are authenticated as AEAD associated data.
 */
export async function encryptPhotoRendition(
  sourceUri: string,
  identity: PhotoRenditionIdentity,
): Promise<EncryptedPhotoWrite> {
  if (!sourceUri) throw new Error('Missing captured photo URI.');
  if (
    !SAFE_RENDITION_PHOTO_ID.test(identity.photoId) ||
    (identity.captureSessionId !== null &&
      !CANONICAL_CAPTURE_SESSION_ID.test(identity.captureSessionId))
  ) {
    throw new Error('PHOTO_RENDITION_IDENTITY_INVALID');
  }
  return runAccountScopedPhotoOperation(async (generation) => {
    const healthLease = captureHealthDataWriteLease();
    await ensureDir();
    const key = await getOrCreateContentKey();
    assertHealthDataWriteLease(healthLease);
    const mimeType = mimeForUri(sourceUri);
    const base64 = await FileSystem.readAsStringAsync(sourceUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    assertHealthDataWriteLease(healthLease);
    const plaintext = utf8ToBytes(stripImageMetadataFromBase64(base64, mimeType));
    const nonce = randomBytes(NONCE_BYTES);
    const envelopeIdentity = {
      version: PHOTO_RENDITION_ENCRYPTION_VERSION,
      keyId: KEY_ID,
      mimeType,
      photoId: identity.photoId,
      captureSessionId: identity.captureSessionId,
      rendition: identity.rendition,
    } as const;
    let ciphertext: Uint8Array;
    try {
      ciphertext = xchacha20poly1305(key, nonce, renditionAssociatedData(envelopeIdentity)).encrypt(
        plaintext,
      );
    } finally {
      plaintext.fill(0);
    }
    const envelope: EncryptedPhotoRenditionEnvelope = {
      ...envelopeIdentity,
      nonceHex: bytesToHex(nonce),
      ciphertextHex: bytesToHex(ciphertext),
    };
    const encryptedLocalUri = canonicalPhotoRenditionUri(identity);
    const temporaryUri = `${encryptedLocalUri}.tmp-${Date.now()}`;
    let finalMoveCompleted = false;
    try {
      assertHealthPhotoOperationCurrent(generation, healthLease);
      await FileSystem.writeAsStringAsync(temporaryUri, JSON.stringify(envelope), {
        encoding: FileSystem.EncodingType.UTF8,
      });
      assertHealthPhotoOperationCurrent(generation, healthLease);
      await FileSystem.moveAsync({ from: temporaryUri, to: encryptedLocalUri });
      finalMoveCompleted = true;
      assertHealthPhotoOperationCurrent(generation, healthLease);
    } catch (error) {
      const cleanup = [FileSystem.deleteAsync(temporaryUri, { idempotent: true })];
      if (finalMoveCompleted) {
        cleanup.push(FileSystem.deleteAsync(encryptedLocalUri, { idempotent: true }));
      }
      await Promise.allSettled(cleanup);
      throw error;
    }
    return {
      encryptedLocalUri,
      keyId: KEY_ID,
      encryptionVersion: PHOTO_RENDITION_ENCRYPTION_VERSION,
    };
  });
}

function assertExpectedRendition(
  encryptedLocalUri: string,
  envelope: EncryptedPhotoEnvelope | EncryptedPhotoRenditionEnvelope,
  expected?: PhotoRenditionReadExpectation,
): void {
  if (envelope.version === ENCRYPTION_VERSION) {
    if (expected && !expected.allowLegacyEnvelope) throw new Error('PHOTO_RENDITION_IDENTITY_MISMATCH');
    return;
  }
  if (!expected) throw new Error('PHOTO_RENDITION_IDENTITY_REQUIRED');
  if (
    envelope.photoId !== expected.photoId ||
    envelope.captureSessionId !== expected.captureSessionId ||
    envelope.rendition !== expected.rendition ||
    encryptedLocalUri !== canonicalPhotoRenditionUri(expected)
  ) {
    throw new Error('PHOTO_RENDITION_IDENTITY_MISMATCH');
  }
}

export async function decryptPhotoToDataUri(
  encryptedLocalUri: string,
  expected?: PhotoRenditionReadExpectation,
): Promise<string> {
  if (!isEncryptedPhotoUri(encryptedLocalUri)) {
    const healthLease = captureHealthDataWriteLease();
    assertHealthDataWriteLease(healthLease);
    return encryptedLocalUri;
  }
  return runAccountScopedPhotoOperation(async (generation) => {
    const healthLease = captureHealthDataWriteLease();
    const raw = await FileSystem.readAsStringAsync(encryptedLocalUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    assertHealthDataWriteLease(healthLease);
    const envelope = photoEnvelopeFromRaw(raw);
    if (!envelope) throw new Error('PHOTO_ENCRYPTION_ENVELOPE_INVALID');
    assertExpectedRendition(encryptedLocalUri, envelope, expected);
    const key = await getExistingContentKey(generation);
    assertHealthDataWriteLease(healthLease);
    const base64 = decryptPhotoEnvelopeToUtf8(envelope, key);
    if (!base64) throw new Error('PHOTO_ENCRYPTION_ENVELOPE_INVALID');
    assertHealthDataWriteLease(healthLease);
    return `data:${envelope.mimeType};base64,${base64}`;
  });
}

export async function createPhotoShareFile(
  encryptedLocalUri: string,
  expected?: PhotoRenditionReadExpectation,
): Promise<string> {
  if (!isEncryptedPhotoUri(encryptedLocalUri)) {
    const healthLease = captureHealthDataWriteLease();
    assertHealthDataWriteLease(healthLease);
    return encryptedLocalUri;
  }
  return runAccountScopedPhotoOperation(async (generation) => {
    const healthLease = captureHealthDataWriteLease();
    const raw = await FileSystem.readAsStringAsync(encryptedLocalUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    assertHealthDataWriteLease(healthLease);
    const envelope = photoEnvelopeFromRaw(raw);
    if (!envelope) throw new Error('PHOTO_ENCRYPTION_ENVELOPE_INVALID');
    assertExpectedRendition(encryptedLocalUri, envelope, expected);
    const key = await getExistingContentKey(generation);
    assertHealthPhotoOperationCurrent(generation, healthLease);
    const staging = await reservePlaintextStaging(
      envelope.mimeType === 'image/png' ? 'photo_share_png' : 'photo_share_jpeg',
    );
    try {
      assertHealthDataWriteLease(healthLease);
      const base64 = decryptEnvelopeToUtf8(envelope, key);
      if (!base64) throw new Error('PHOTO_ENCRYPTION_ENVELOPE_INVALID');
      const strippedBase64 = stripImageMetadataFromBase64(base64, envelope.mimeType);
      assertHealthPhotoOperationCurrent(generation, healthLease);
      await FileSystem.writeAsStringAsync(staging.uri, strippedBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      assertHealthPhotoOperationCurrent(generation, healthLease);
      await markPlaintextStagingState(staging, 'plaintext_written');
      assertHealthDataWriteLease(healthLease);
      return staging.uri;
    } catch (error) {
      await cleanupPlaintextStaging(staging).catch(() => undefined);
      // The reservation is an ownership proof for this exact opaque path. If
      // journal cleanup is unavailable, still erase the known plaintext file;
      // the retained journal entry then supports a later idempotent retry.
      await FileSystem.deleteAsync(staging.uri, { idempotent: true }).catch(() => undefined);
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
  guard?: Readonly<{ assertCurrent: () => void }>,
): Promise<QuarantinedPhotoFile | null> {
  if (!uri || !isEncryptedPhotoUri(uri)) return null;
  if (ownedEncryptedPhotoUri(uri) !== uri) throw new Error('PHOTO_DELETE_PATH_INVALID');
  const quarantinedUri = `${uri}.pending-delete-${safePhotoShareId(operationId)}`;
  return runDestructiveAccountScopedPhotoOperation(async (assertAccountCurrent) => {
    const assertCurrent = () => { assertAccountCurrent(); guard?.assertCurrent(); };
    const inspect = async (path: string) => {
      assertCurrent();
      const info = await FileSystem.getInfoAsync(path);
      assertCurrent();
      if (info.exists !== true && info.exists !== false) throw new Error('PHOTO_DELETE_FILE_STATE_UNKNOWN');
      return info.exists;
    };
    // An absent rendition is already clean for this requested deletion. A read
    // error is NOT absence; preserve the journal/metadata for explicit recovery.
    if (!(await inspect(uri))) {
      return (await inspect(quarantinedUri)) ? { originalUri: uri, quarantinedUri } : null;
    }
    try {
      assertCurrent();
      await FileSystem.moveAsync({ from: uri, to: quarantinedUri });
      assertCurrent();
    } catch (error) {
      assertCurrent();
      // A move may commit before rejecting, or the file may disappear after
      // inspection. Resolve only from successful source + destination reads.
      const originalExists = await inspect(uri);
      const quarantineExists = await inspect(quarantinedUri);
      if (!originalExists) return quarantineExists ? { originalUri: uri, quarantinedUri } : null;
      throw error;
    }
    return { originalUri: uri, quarantinedUri };
  });
}

export async function restoreQuarantinedPhoto(file: QuarantinedPhotoFile): Promise<void> {
  await runDestructiveAccountScopedPhotoOperation(async (assertCurrent) => {
    const healthLease = captureHealthDataWriteLease();
    const assertAuthorized = () => {
      assertCurrent();
      assertHealthDataWriteLease(healthLease);
    };
    assertAuthorized();
    let restoreCompleted = false;
    try {
      await FileSystem.moveAsync({ from: file.quarantinedUri, to: file.originalUri });
      restoreCompleted = true;
      assertAuthorized();
    } catch (error) {
      try {
        assertHealthDataWriteLease(healthLease);
      } catch (healthError) {
        if (restoreCompleted) {
          await FileSystem.deleteAsync(file.originalUri, { idempotent: true }).catch(
            () => undefined,
          );
        }
        throw healthError;
      }
      throw error;
    }
  });
}

export async function deleteQuarantinedPhoto(file: QuarantinedPhotoFile): Promise<void> {
  await runDestructiveAccountScopedPhotoOperation(async (assertCurrent) => {
    assertCurrent();
    await FileSystem.deleteAsync(file.quarantinedUri, { idempotent: true });
  });
}

/** Finish or roll back the exact encrypted pair recorded before a delete.
 * All paths stay inside photo storage. The caller's original authority is
 * checked around every await, rather than borrowed from a later health lease. */
export async function settlePhotoDeleteFiles(
  uris: readonly string[],
  operationId: string,
  restore: boolean,
  guard: Readonly<{ assertCurrent: () => void }>,
): Promise<void> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)) {
    throw new Error('PHOTO_DELETE_ID_INVALID');
  }
  await runDestructiveAccountScopedPhotoOperation(async (assertAccountCurrent) => {
    const assertCurrent = () => { assertAccountCurrent(); guard.assertCurrent(); };
    for (const uri of new Set(uris)) {
      assertCurrent();
      if (ownedEncryptedPhotoUri(uri) !== uri) throw new Error('PHOTO_DELETE_PATH_INVALID');
      const file = { originalUri: uri, quarantinedUri: `${uri}.pending-delete-${operationId}` };
      if (restore) {
        const original = await FileSystem.getInfoAsync(uri);
        assertCurrent();
        const quarantined = await FileSystem.getInfoAsync(file.quarantinedUri);
        assertCurrent();
        if (original.exists !== true && original.exists !== false) throw new Error('PHOTO_DELETE_FILE_STATE_UNKNOWN');
        if (quarantined.exists !== true && quarantined.exists !== false) throw new Error('PHOTO_DELETE_FILE_STATE_UNKNOWN');
        // A failed/interrupted delete cannot recreate bytes that were already
        // absent. Successful reads proving both absent permit journal rollback;
        // failed or uncertain reads above remain retryable, never reclassified.
        if (!original.exists && !quarantined.exists) continue;
        if (!original.exists) {
          await restoreQuarantinedPhoto(file);
          assertCurrent();
        }
      } else {
        await FileSystem.deleteAsync(uri, { idempotent: true });
        assertCurrent();
      }
      await FileSystem.deleteAsync(file.quarantinedUri, { idempotent: true });
      assertCurrent();
    }
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
    // Reconciliation may restore a quarantined live photo, so it is not a
    // deletion-only bypass and must remain closed after withdrawal.
    const healthLease = captureHealthDataWriteLease();
    const restorationCandidates = new Set<string>();
    const assertAuthorized = () => {
      assertCurrent();
      assertHealthDataWriteLease(healthLease);
    };
    const referenced = new Set(referencedUris.filter(isEncryptedPhotoUri));
    try {
      assertAuthorized();
      const info = await FileSystem.getInfoAsync(PHOTO_DIR);
      assertAuthorized();
      if (!info.exists) return;
      const entries = await FileSystem.readDirectoryAsync(PHOTO_DIR);
      assertAuthorized();

      for (const entry of entries) {
        assertAuthorized();
        const uri = `${PHOTO_DIR}${entry}`;
        const quarantined = /^(.+\.layerwellphoto)\.pending-delete-.+$/.exec(entry);
        if (quarantined) {
          const originalUri = `${PHOTO_DIR}${quarantined[1]}`;
          if (referenced.has(originalUri)) {
            const originalInfo = await FileSystem.getInfoAsync(originalUri);
            assertAuthorized();
            if (originalInfo.exists) {
              await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
              assertAuthorized();
            } else {
              assertAuthorized();
              await FileSystem.moveAsync({ from: uri, to: originalUri });
              restorationCandidates.add(originalUri);
              assertAuthorized();
            }
          } else {
            await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
            assertAuthorized();
          }
          continue;
        }

        if (/\.layerwellphoto\.tmp-.+$/.test(entry)) {
          await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
          assertAuthorized();
          continue;
        }

        if (
          options.removeUnreferencedFinals !== false &&
          entry.endsWith('.layerwellphoto') &&
          !referenced.has(uri)
        ) {
          await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
          assertAuthorized();
        }
      }
      assertAuthorized();
    } catch (error) {
      try {
        assertAuthorized();
      } catch (healthError) {
        await Promise.allSettled(
          [...restorationCandidates].map((uri) =>
            FileSystem.deleteAsync(uri, { idempotent: true }),
          ),
        );
        throw healthError;
      }
      throw error;
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
    AsyncStorage.removeItem(PUBLICATION_JOURNAL_KEY),
    // Both account erasure and health-purpose withdrawal call this boundary.
    AsyncStorage.removeItem('layerwell.photos.deleteJournal.v1'),
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
    const healthLease = captureHealthDataWriteLease();
    const key = await getOrCreateContentKey();
    assertHealthPhotoOperationCurrent(generation, healthLease);
    const encrypted = JSON.stringify(encryptBytesWithKey(utf8ToBytes(note), key));
    assertHealthDataWriteLease(healthLease);
    return encrypted;
  });
}

export async function decryptPhotoNote(
  ciphertext: string | null | undefined,
): Promise<string | null> {
  if (!ciphertext) return null;
  return runAccountScopedPhotoOperation(async (generation) => {
    const healthLease = captureHealthDataWriteLease();
    const envelope = encryptedTextEnvelopeFromRaw(ciphertext);
    if (!envelope) throw new Error(PHOTO_DECRYPTION_FAILED);
    const key = await getExistingContentKey(generation);
    assertHealthDataWriteLease(healthLease);
    const plaintext = decryptEnvelopeToUtf8(envelope, key);
    if (plaintext === null) throw new Error(PHOTO_DECRYPTION_FAILED);
    assertHealthDataWriteLease(healthLease);
    return plaintext;
  });
}

/**
 * Data-rights-only note decryption. This named lane intentionally works while
 * health processing is closed, but only under the exact account-generation
 * lease whose caller verified the export owner. It must never back an app
 * screen, personalization, cache, or background task.
 */
export async function decryptPhotoNoteForPurposeLimitedExport(
  ciphertext: string | null | undefined,
  accountLease: AccountGenerationLease,
): Promise<string | null> {
  accountLease.assertCurrent();
  if (!ciphertext) return null;

  return runAccountScopedPhotoOperation(async (generation) => {
    const assertCurrent = () => {
      accountLease.assertCurrent();
      assertPhotoWriteAllowed(generation);
    };
    assertCurrent();
    const envelope = encryptedTextEnvelopeFromRaw(ciphertext);
    if (!envelope) throw new Error(PHOTO_DECRYPTION_FAILED);
    const key = await getExistingContentKey(generation);
    try {
      assertCurrent();
      let plaintextBytes: Uint8Array;
      try {
        plaintextBytes = decryptBytesWithKey(envelope, key);
      } catch {
        throw new Error(PHOTO_DECRYPTION_FAILED);
      }
      try {
        const plaintext = bytesToUtf8(plaintextBytes);
        assertCurrent();
        return plaintext;
      } finally {
        plaintextBytes.fill(0);
      }
    } finally {
      key.fill(0);
    }
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
