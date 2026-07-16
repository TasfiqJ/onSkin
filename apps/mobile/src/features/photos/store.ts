import { randomUUID } from 'expo-crypto';

import type { PhotoSeries, TimeOfDay } from '@onskin/types';
import { PHOTO_SERIES } from '@onskin/types';

import {
  AccountGenerationLeaseError,
  awaitAccountGenerationLease,
  runAccountGenerationOperation,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { captureAuthenticatedAccountOwner } from '@/lib/auth/authenticatedAccountOwner';
import {
  cleanupPlaintextStagingOperation,
  lookupPlaintextStaging,
} from '@/lib/storage/plaintextStaging';
import {
  getPrivateItem,
  PRIVATE_KV_CONTENT_KEY_CONFLICT,
  PRIVATE_KV_CONTENT_KEY_INVALID,
  PRIVATE_KV_CONTENT_KEY_MISSING,
  PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE,
  PRIVATE_KV_DECRYPTION_FAILED,
  PRIVATE_KV_ENVELOPE_INVALID,
  PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
  readPrivateItem,
  setPrivateItem,
  type PrivateKVReadFailureReason,
} from '@/lib/storage/privateKV';
import { supabase } from '@/lib/supabase/client';

import {
  decryptPhotoNote,
  discardPendingEncryptedPhotoForRetry,
  encryptedPhotoThumbnailUriForId,
  encryptedPhotoUriForId,
  encryptCapturedPhoto,
  encryptPhotoNote,
  finalizeEncryptedPhotoDeletions,
  isEncryptedPhotoUri,
  isOwnedEncryptedPhotoUri,
  PHOTO_CONTENT_KEY_INVALID,
  PHOTO_CONTENT_KEY_MISSING,
  PHOTO_CONTENT_KEY_STORAGE_UNAVAILABLE,
  PHOTO_DECRYPTION_FAILED,
  photoEncryptionInfo,
  PHOTO_RECOVERY_CANDIDATE_UNAUTHENTICATED,
  PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
  recoverPreparedEncryptedPhoto,
  stageEncryptedPhotoDeletions,
  verifyEncryptedPhotoDeletionSources,
} from './encryptedStorage';
import {
  decodePhotoStore,
  encodePhotoStore,
  PHOTO_METADATA_INVALID,
  PHOTO_METADATA_UNSUPPORTED,
  PHOTO_MUTATION_JOURNAL_INCONSISTENT,
  PHOTO_MUTATION_RECOVERY_REQUIRED,
  type DecodedPhotoStore,
  type PhotoMutationJournal,
} from './photoStoreEnvelope';
import type { PhotoMeta, PhotoQualitySource } from './timeline';

export {
  PHOTO_METADATA_INVALID,
  PHOTO_METADATA_UNSUPPORTED,
  PHOTO_MUTATION_JOURNAL_INCONSISTENT,
  PHOTO_MUTATION_RECOVERY_REQUIRED,
} from './photoStoreEnvelope';

/**
 * Local-first photo store. V2 atomically co-persists intended metadata and one
 * content-free mutation journal in the same encrypted private-KV value. While
 * a journal exists, ordinary reads fail closed and explicit recovery owns every
 * file transition before the staged metadata can become visible.
 */
const KEY = 'onskin.photos.v1';
const PHOTO_SERIES_SET = new Set<PhotoSeries>(PHOTO_SERIES);
const TIME_OF_DAY = new Set<TimeOfDay>(['morning', 'evening']);
const CAPTURE_OPERATION_ID = /^[0-9a-f]{32}$/;
const CANONICAL_PHOTO_FILE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_PHOTO_FIELD_CHARS = 1_024;
const MAX_PHOTO_NOTE_PLAINTEXT_CHARS = 262_144;
const MAX_PHOTO_NOTE_CIPHERTEXT_CHARS = 1_048_576;
const STORED_PHOTO_RECORD_KEYS = [
  'alignmentScore',
  'captureSessionId',
  'encryptedLocalUri',
  'encryptionVersion',
  'faceRegionRedacted',
  'headPitch',
  'headRoll',
  'headYaw',
  'id',
  'isEncrypted',
  'isReference',
  'keyId',
  'lightingScore',
  'localOnly',
  'localUri',
  'notes',
  'notesCiphertext',
  'qualitySource',
  'referencePhotoId',
  'series',
  'storagePath',
  'takenAt',
  'takenLocalDate',
  'thumbnailLocalUri',
  'timeOfDay',
] as const;
const PHOTO_MUTATION_CAPTURE_SESSION_REQUIRED = 'PHOTO_MUTATION_CAPTURE_SESSION_REQUIRED';
const PHOTO_MUTATION_SOURCE_MISSING = 'PHOTO_MUTATION_SOURCE_MISSING';
const PHOTO_METADATA_COMMIT_UNCERTAIN = 'PHOTO_METADATA_COMMIT_UNCERTAIN';

let photoStoreMutationTail: Promise<void> = Promise.resolve();

function runPhotoStoreMutation<T>(
  operation: (lease: AccountGenerationLease) => Promise<T>,
): Promise<T> {
  return runAccountGenerationOperation(async (lease) => {
    const guardedOperation = async () => {
      lease.assertCurrent();
      const result = await operation(lease);
      lease.assertCurrent();
      return result;
    };
    const pending = photoStoreMutationTail.then(guardedOperation, guardedOperation);
    photoStoreMutationTail = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  });
}

export type PhotoRecord = PhotoMeta & {
  takenAt: string;
  captureSessionId: string | null;
  headRoll: number | null;
  headYaw: number | null;
  headPitch: number | null;
  qualitySource: PhotoQualitySource | null;
  localOnly: boolean;
  storagePath: string | null;
  faceRegionRedacted: boolean;
  isEncrypted: boolean;
  encryptedLocalUri: string | null;
  thumbnailLocalUri: string | null;
  encryptionVersion: string;
  keyId: string | null;
};

/**
 * The exact owner-local snapshot that was durably committed by a mutation.
 * Query consumers use this to publish cache state without decrypting the
 * private photo store a second time.
 */
export type PhotoMutationCommit<TResult> = Readonly<{
  result: TResult;
  photos: PhotoRecord[];
}>;

function photoMutationCommit<TResult>(
  result: TResult,
  photos: PhotoRecord[],
): PhotoMutationCommit<TResult> {
  return { result, photos };
}

type PhotoStoreFormat = 'legacy' | 'v2';
type PhotoStoreUnavailableReason =
  | PrivateKVReadFailureReason
  | 'photo_content_key_missing'
  | 'photo_content_key_storage_unavailable';
type PhotoStoreCorruptReason =
  | 'content_key_invalid'
  | 'envelope_invalid'
  | 'decryption_failed'
  | 'photo_content_key_invalid'
  | 'photo_decryption_failed'
  | 'journal_inconsistent'
  | 'invalid_payload';

export type PhotoStoreReadResult =
  | { status: 'absent'; photos: PhotoRecord[] }
  | { status: 'available'; photos: PhotoRecord[]; format: PhotoStoreFormat }
  | { status: 'unavailable'; photos: null; reason: PhotoStoreUnavailableReason }
  | { status: 'corrupt'; photos: null; reason: PhotoStoreCorruptReason }
  | { status: 'unsupported_version'; photos: null }
  | { status: 'recovery_required'; photos: null };

type StoredPhotoRecord = Omit<PhotoRecord, 'notes'> & {
  notes: null;
  notesCiphertext: string | null;
};

export type NewPhoto = {
  series?: PhotoSeries;
  takenLocalDate: string;
  timeOfDay?: TimeOfDay | null;
  alignmentScore?: number | null;
  lightingScore?: number | null;
  headRoll?: number | null;
  headYaw?: number | null;
  headPitch?: number | null;
  qualitySource?: PhotoQualitySource | null;
  referencePhotoId?: string | null;
  captureSessionId?: string | null;
  localUri?: string | null;
  notes?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(record: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(record).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

function isBoundedString(value: unknown, maxChars = MAX_PHOTO_FIELD_CHARS): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maxChars &&
    value.trim() === value
  );
}

function isBoundedStringOrNull(value: unknown, maxChars = MAX_PHOTO_FIELD_CHARS): boolean {
  return value === null || isBoundedString(value, maxChars);
}

function isFiniteNumberOrNull(value: unknown): boolean {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function isScoreOrNull(value: unknown): boolean {
  return (
    value === null ||
    (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1)
  );
}

function isCanonicalLocalDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day
  );
}

function isCanonicalInstant(value: unknown): value is string {
  if (typeof value !== 'string' || value.length !== 24) return false;
  const timestamp = Date.parse(value);
  return !Number.isNaN(timestamp) && new Date(timestamp).toISOString() === value;
}

function assertStrictStoredRecord(value: unknown): asserts value is Record<string, unknown> {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, STORED_PHOTO_RECORD_KEYS) ||
    !isBoundedString(value.id, 128) ||
    !CANONICAL_PHOTO_FILE_ID.test(value.id) ||
    !PHOTO_SERIES_SET.has(value.series as PhotoSeries) ||
    !isCanonicalLocalDate(value.takenLocalDate) ||
    !isCanonicalInstant(value.takenAt) ||
    !(value.timeOfDay === null || TIME_OF_DAY.has(value.timeOfDay as TimeOfDay)) ||
    !isScoreOrNull(value.alignmentScore) ||
    !isScoreOrNull(value.lightingScore) ||
    typeof value.isReference !== 'boolean' ||
    !isBoundedStringOrNull(value.referencePhotoId, 128) ||
    (typeof value.referencePhotoId === 'string' &&
      !CANONICAL_PHOTO_FILE_ID.test(value.referencePhotoId)) ||
    !isBoundedStringOrNull(value.localUri) ||
    value.notes !== null ||
    !isBoundedStringOrNull(value.notesCiphertext, MAX_PHOTO_NOTE_CIPHERTEXT_CHARS) ||
    !isBoundedStringOrNull(value.captureSessionId, 32) ||
    (typeof value.captureSessionId === 'string' &&
      !CAPTURE_OPERATION_ID.test(value.captureSessionId)) ||
    !isFiniteNumberOrNull(value.headRoll) ||
    !isFiniteNumberOrNull(value.headYaw) ||
    !isFiniteNumberOrNull(value.headPitch) ||
    !(value.qualitySource === null || value.qualitySource === 'post_capture_measurement') ||
    value.localOnly !== true ||
    value.storagePath !== null ||
    typeof value.faceRegionRedacted !== 'boolean' ||
    typeof value.isEncrypted !== 'boolean' ||
    !isBoundedStringOrNull(value.encryptedLocalUri) ||
    !isBoundedStringOrNull(value.thumbnailLocalUri) ||
    !isBoundedString(value.encryptionVersion, 64) ||
    !isBoundedStringOrNull(value.keyId, 128)
  ) {
    throw new Error(PHOTO_METADATA_INVALID);
  }

  const expectedPrimary = encryptedPhotoUriForId(value.id);
  const primary = value.encryptedLocalUri;
  if (primary === null) {
    if (
      value.localUri !== null ||
      value.thumbnailLocalUri !== null ||
      value.captureSessionId !== null ||
      value.isEncrypted ||
      value.encryptionVersion !== 'none' ||
      value.keyId !== null
    ) {
      throw new Error(PHOTO_MUTATION_JOURNAL_INCONSISTENT);
    }
    return;
  }
  if (
    value.localUri !== primary ||
    primary !== expectedPrimary ||
    !isEncryptedPhotoUri(primary) ||
    !value.isEncrypted ||
    value.encryptionVersion !== photoEncryptionInfo.version ||
    value.keyId !== photoEncryptionInfo.keyId ||
    (value.thumbnailLocalUri !== null &&
      (value.thumbnailLocalUri !== encryptedPhotoThumbnailUriForId(value.id) ||
        !isOwnedEncryptedPhotoUri(value.thumbnailLocalUri)))
  ) {
    throw new Error(PHOTO_MUTATION_JOURNAL_INCONSISTENT);
  }
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length > 0 ? text : null;
}

function localDateOrNull(value: unknown): string | null {
  const text = stringOrNull(value);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function isoOrFallback(value: unknown, fallback: string): string {
  const text = stringOrNull(value);
  return text && !Number.isNaN(Date.parse(text)) ? new Date(text).toISOString() : fallback;
}

function finiteNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function scoreOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : null;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function seriesOrFront(value: unknown): PhotoSeries {
  const text = stringOrNull(value);
  return text && PHOTO_SERIES_SET.has(text as PhotoSeries) ? (text as PhotoSeries) : 'front';
}

function timeOfDayOrNull(value: unknown): TimeOfDay | null {
  const text = stringOrNull(value);
  return text && TIME_OF_DAY.has(text as TimeOfDay) ? (text as TimeOfDay) : null;
}

async function normalizeStoredRecord(value: unknown): Promise<PhotoRecord | null> {
  if (!isRecord(value)) return null;
  const id = stringOrNull(value.id);
  const takenLocalDate = localDateOrNull(value.takenLocalDate);
  if (!id || !takenLocalDate) return null;

  const localUri = stringOrNull(value.localUri);
  const explicitEncryptedUri = stringOrNull(value.encryptedLocalUri);
  const encryptedLocalUri =
    explicitEncryptedUri ?? (localUri && isEncryptedPhotoUri(localUri) ? localUri : null);
  const notesCiphertext = stringOrNull(value.notesCiphertext);
  const notes = notesCiphertext
    ? await decryptPhotoNote(notesCiphertext)
    : stringOrNull(value.notes);
  const encrypted = encryptedLocalUri != null;

  return {
    id,
    series: seriesOrFront(value.series),
    takenLocalDate,
    takenAt: isoOrFallback(value.takenAt, `${takenLocalDate}T12:00:00.000Z`),
    timeOfDay: timeOfDayOrNull(value.timeOfDay),
    alignmentScore: scoreOrNull(value.alignmentScore),
    lightingScore: scoreOrNull(value.lightingScore),
    isReference: booleanOr(value.isReference, false),
    referencePhotoId: stringOrNull(value.referencePhotoId),
    localUri: localUri ?? encryptedLocalUri,
    notes,
    captureSessionId: stringOrNull(value.captureSessionId),
    headRoll: finiteNumberOrNull(value.headRoll),
    headYaw: finiteNumberOrNull(value.headYaw),
    headPitch: finiteNumberOrNull(value.headPitch),
    qualitySource:
      value.qualitySource === 'post_capture_measurement' ? 'post_capture_measurement' : null,
    // V1 placeholders claimed encryption even when no file existed. Derive
    // these storage facts from recognized local authority during migration.
    localOnly: true,
    storagePath: null,
    faceRegionRedacted: booleanOr(value.faceRegionRedacted, false),
    isEncrypted: encrypted,
    encryptedLocalUri,
    thumbnailLocalUri: stringOrNull(value.thumbnailLocalUri),
    encryptionVersion:
      stringOrNull(value.encryptionVersion) ?? (encrypted ? photoEncryptionInfo.version : 'none'),
    keyId: stringOrNull(value.keyId) ?? (encrypted ? photoEncryptionInfo.keyId : null),
  };
}

async function normalizeStoredRecords(
  value: readonly unknown[],
  strictCurrentFormat = false,
): Promise<PhotoRecord[]> {
  const items: PhotoRecord[] = [];
  for (const row of value) {
    if (strictCurrentFormat) assertStrictStoredRecord(row);
    const photo = await normalizeStoredRecord(row);
    if (!photo) throw new Error(PHOTO_METADATA_INVALID);
    items.push(photo);
  }
  return items;
}

function encryptedUrisForRecord(photo: PhotoRecord): string[] {
  return [...new Set([photo.encryptedLocalUri ?? photo.localUri, photo.thumbnailLocalUri])].filter(
    (uri): uri is string => Boolean(uri && isEncryptedPhotoUri(uri)),
  );
}

function assertUniqueNormalizedAuthority(items: readonly PhotoRecord[]): void {
  const ids = new Set<string>();
  const uris = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(PHOTO_METADATA_INVALID);
    ids.add(item.id);
    for (const uri of encryptedUrisForRecord(item)) {
      if (uris.has(uri)) throw new Error(PHOTO_METADATA_INVALID);
      uris.add(uri);
    }
  }
}

function assertCanonicalRecordUris(photo: PhotoRecord): void {
  if (!CANONICAL_PHOTO_FILE_ID.test(photo.id)) {
    throw new Error(PHOTO_MUTATION_JOURNAL_INCONSISTENT);
  }
  if (photo.localUri !== null && !isEncryptedPhotoUri(photo.localUri)) {
    throw new Error(PHOTO_MUTATION_JOURNAL_INCONSISTENT);
  }
  const primary =
    photo.encryptedLocalUri ??
    (photo.localUri && isEncryptedPhotoUri(photo.localUri) ? photo.localUri : null);
  if (photo.isEncrypted && primary === null) {
    throw new Error(PHOTO_MUTATION_JOURNAL_INCONSISTENT);
  }
  if (
    primary === null &&
    (photo.localUri !== null ||
      photo.encryptedLocalUri !== null ||
      photo.thumbnailLocalUri !== null ||
      photo.encryptionVersion !== 'none' ||
      photo.keyId !== null)
  ) {
    throw new Error(PHOTO_MUTATION_JOURNAL_INCONSISTENT);
  }
  if (
    primary !== null &&
    (!photo.isEncrypted ||
      photo.localUri !== primary ||
      photo.encryptedLocalUri !== primary ||
      photo.encryptionVersion !== photoEncryptionInfo.version ||
      photo.keyId !== photoEncryptionInfo.keyId)
  ) {
    throw new Error(PHOTO_MUTATION_JOURNAL_INCONSISTENT);
  }
  if (primary !== null && primary !== encryptedPhotoUriForId(photo.id)) {
    throw new Error(PHOTO_MUTATION_JOURNAL_INCONSISTENT);
  }
  if (photo.localUri && isEncryptedPhotoUri(photo.localUri) && photo.localUri !== primary) {
    throw new Error(PHOTO_MUTATION_JOURNAL_INCONSISTENT);
  }
  if (
    photo.thumbnailLocalUri !== null &&
    (photo.thumbnailLocalUri !== encryptedPhotoThumbnailUriForId(photo.id) ||
      !isOwnedEncryptedPhotoUri(photo.thumbnailLocalUri))
  ) {
    throw new Error(PHOTO_MUTATION_JOURNAL_INCONSISTENT);
  }
}

type PhotoStoreSnapshot = {
  items: PhotoRecord[];
  mutation: PhotoMutationJournal | null;
  retainedItems: PhotoRecord[];
  storedItems: unknown[];
  storedRetainedItems: unknown[];
};

function assertMutationConsistency(snapshot: PhotoStoreSnapshot): void {
  const { items, mutation, retainedItems } = snapshot;
  assertUniqueNormalizedAuthority([...items, ...retainedItems]);
  if (!mutation) return;

  if (mutation.kind === 'add') {
    if (
      retainedItems.length !== 0 ||
      items.filter((item) => item.id === mutation.operationId).length !== 1
    ) {
      throw new Error(PHOTO_MUTATION_JOURNAL_INCONSISTENT);
    }
    const staged = items.find((item) => item.id === mutation.operationId)!;
    assertCanonicalRecordUris(staged);
    const ownsEncryptedFile = staged.encryptedLocalUri !== null;
    if (
      ownsEncryptedFile !== Boolean(staged.captureSessionId) ||
      (staged.captureSessionId !== null && !CAPTURE_OPERATION_ID.test(staged.captureSessionId))
    ) {
      throw new Error(PHOTO_MUTATION_JOURNAL_INCONSISTENT);
    }
    return;
  }
  if (mutation.kind === 'delete') {
    if (retainedItems.length !== 1 || items.some((item) => item.id === retainedItems[0]!.id)) {
      throw new Error(PHOTO_MUTATION_JOURNAL_INCONSISTENT);
    }
    assertCanonicalRecordUris(retainedItems[0]!);
    return;
  }
  if (items.length !== 0 || retainedItems.length === 0) {
    throw new Error(PHOTO_MUTATION_JOURNAL_INCONSISTENT);
  }
  retainedItems.forEach(assertCanonicalRecordUris);
}

async function normalizeDecodedPhotoStore(decoded: DecodedPhotoStore): Promise<PhotoStoreSnapshot> {
  const strictCurrentFormat = decoded.format === 'v2';
  const items = await normalizeStoredRecords(decoded.items, strictCurrentFormat);
  const retainedItems = await normalizeStoredRecords(decoded.retainedItems, strictCurrentFormat);
  const snapshot: PhotoStoreSnapshot = {
    items,
    mutation: decoded.mutation,
    retainedItems,
    storedItems: decoded.items,
    storedRetainedItems: decoded.retainedItems,
  };
  if (strictCurrentFormat) [...items, ...retainedItems].forEach(assertCanonicalRecordUris);
  assertMutationConsistency(snapshot);
  return snapshot;
}

async function readPhotosUnlocked(): Promise<PhotoStoreSnapshot> {
  return normalizeDecodedPhotoStore(decodePhotoStore(await getPrivateItem(KEY)));
}

function classifyPhotoStoreReadError(
  error: unknown,
): Exclude<PhotoStoreReadResult, { status: 'absent' | 'available' }> {
  const message = error instanceof Error ? error.message : '';
  if (
    error instanceof AccountGenerationLeaseError ||
    message === PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY
  ) {
    return { status: 'unavailable', photos: null, reason: 'account_boundary' };
  }
  if (message === PHOTO_CONTENT_KEY_MISSING) {
    return { status: 'unavailable', photos: null, reason: 'photo_content_key_missing' };
  }
  if (message === PHOTO_CONTENT_KEY_STORAGE_UNAVAILABLE) {
    return {
      status: 'unavailable',
      photos: null,
      reason: 'photo_content_key_storage_unavailable',
    };
  }
  if (message === PHOTO_CONTENT_KEY_INVALID) {
    return { status: 'corrupt', photos: null, reason: 'photo_content_key_invalid' };
  }
  if (message === PHOTO_DECRYPTION_FAILED) {
    return { status: 'corrupt', photos: null, reason: 'photo_decryption_failed' };
  }
  if (message === PHOTO_METADATA_UNSUPPORTED) {
    return { status: 'unsupported_version', photos: null };
  }
  if (message === PHOTO_MUTATION_RECOVERY_REQUIRED) {
    return { status: 'recovery_required', photos: null };
  }
  if (message === PHOTO_MUTATION_JOURNAL_INCONSISTENT) {
    return { status: 'corrupt', photos: null, reason: 'journal_inconsistent' };
  }
  return { status: 'corrupt', photos: null, reason: 'invalid_payload' };
}

async function readPhotoStoreResultUnlocked(
  lease: AccountGenerationLease,
): Promise<PhotoStoreReadResult> {
  let stored: Awaited<ReturnType<typeof readPrivateItem>>;
  try {
    stored = await awaitAccountGenerationLease(lease, () => readPrivateItem(KEY));
    lease.assertCurrent();
  } catch {
    return { status: 'unavailable', photos: null, reason: 'storage_unavailable' };
  }

  if (stored.status === 'absent') return { status: 'absent', photos: [] };
  if (stored.status === 'unavailable') {
    return { status: 'unavailable', photos: null, reason: stored.reason };
  }
  if (stored.status === 'corrupt') {
    return { status: 'corrupt', photos: null, reason: stored.reason };
  }
  if (stored.status === 'unsupported_version') {
    return { status: 'unsupported_version', photos: null };
  }

  try {
    const decoded = decodePhotoStore(stored.value);
    const snapshot = await normalizeDecodedPhotoStore(decoded);
    if (snapshot.mutation) return { status: 'recovery_required', photos: null };
    return {
      status: 'available',
      photos: snapshot.items,
      format: decoded.format as PhotoStoreFormat,
    };
  } catch (error) {
    return classifyPhotoStoreReadError(error);
  }
}

function photoStoreReadError(
  result: Exclude<PhotoStoreReadResult, { status: 'absent' | 'available' }>,
): Error {
  if (result.status === 'unsupported_version') return new Error(PHOTO_METADATA_UNSUPPORTED);
  if (result.status === 'recovery_required') return new Error(PHOTO_MUTATION_RECOVERY_REQUIRED);
  if (result.status === 'unavailable') {
    const code: Record<PhotoStoreUnavailableReason, string> = {
      account_boundary: PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
      content_key_conflict: PRIVATE_KV_CONTENT_KEY_CONFLICT,
      content_key_missing: PRIVATE_KV_CONTENT_KEY_MISSING,
      content_key_storage_unavailable: PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE,
      photo_content_key_missing: PHOTO_CONTENT_KEY_MISSING,
      photo_content_key_storage_unavailable: PHOTO_CONTENT_KEY_STORAGE_UNAVAILABLE,
      storage_unavailable: 'PHOTO_STORE_UNAVAILABLE',
    };
    return new Error(code[result.reason]);
  }

  const code: Record<PhotoStoreCorruptReason, string> = {
    content_key_invalid: PRIVATE_KV_CONTENT_KEY_INVALID,
    decryption_failed: PRIVATE_KV_DECRYPTION_FAILED,
    envelope_invalid: PRIVATE_KV_ENVELOPE_INVALID,
    invalid_payload: PHOTO_METADATA_INVALID,
    journal_inconsistent: PHOTO_MUTATION_JOURNAL_INCONSISTENT,
    photo_content_key_invalid: PHOTO_CONTENT_KEY_INVALID,
    photo_decryption_failed: PHOTO_DECRYPTION_FAILED,
  };
  return new Error(code[result.reason]);
}

async function encodeStoredRecords(items: readonly PhotoRecord[]): Promise<StoredPhotoRecord[]> {
  for (const item of items) {
    if (
      item.notes !== null &&
      (typeof item.notes !== 'string' || item.notes.length > MAX_PHOTO_NOTE_PLAINTEXT_CHARS)
    ) {
      throw new Error(PHOTO_METADATA_INVALID);
    }
    // Validate every non-note field before encryption can create key material.
    assertStrictStoredRecord({ ...item, notes: null, notesCiphertext: null });
  }
  const stored = await Promise.all(
    items.map(async (item) => ({
      ...item,
      notes: null,
      notesCiphertext: await encryptPhotoNote(item.notes),
    })),
  );
  stored.forEach(assertStrictStoredRecord);
  return stored;
}

async function writeExactPhotoStore(raw: string): Promise<void> {
  let writeError: unknown = null;
  try {
    await setPrivateItem(KEY, raw);
  } catch (error) {
    writeError = error;
  }

  let stored: string | null;
  try {
    stored = await getPrivateItem(KEY);
  } catch (readError) {
    throw writeError ?? readError;
  }
  if (stored === raw) return;
  if (writeError) throw writeError;
  throw new Error(PHOTO_METADATA_COMMIT_UNCERTAIN);
}

async function writeStoredEnvelope(params: {
  items: readonly unknown[];
  mutation: PhotoMutationJournal | null;
  retainedItems?: readonly unknown[];
}): Promise<void> {
  const raw =
    params.mutation === null
      ? encodePhotoStore({ items: params.items, mutation: null })
      : encodePhotoStore({
          items: params.items,
          mutation: params.mutation,
          retainedItems: params.retainedItems ?? [],
        });
  await writeExactPhotoStore(raw);
}

async function writeSettledItems(items: readonly PhotoRecord[]): Promise<void> {
  await writeStoredEnvelope({ items: await encodeStoredRecords(items), mutation: null });
}

async function finishCommittedAdd(snapshot: PhotoStoreSnapshot): Promise<void> {
  const mutation = snapshot.mutation;
  if (!mutation || mutation.kind !== 'add') {
    throw new Error(PHOTO_MUTATION_JOURNAL_INCONSISTENT);
  }
  const staged = snapshot.items.find((item) => item.id === mutation.operationId)!;
  if (staged.captureSessionId) {
    await cleanupPlaintextStagingOperation(staged.captureSessionId, 'photo_capture_jpeg');
  }
  await writeStoredEnvelope({ items: snapshot.storedItems, mutation: null });
}

async function ensurePreparedAddFile(snapshot: PhotoStoreSnapshot): Promise<boolean> {
  const mutation = snapshot.mutation!;
  const staged = snapshot.items.find((item) => item.id === mutation.operationId)!;
  const encryptedUri = staged.encryptedLocalUri;
  if (!encryptedUri) return true;

  try {
    if (await recoverPreparedEncryptedPhoto(encryptedUri, mutation.operationId)) return true;
  } catch (error) {
    if (
      !(error instanceof Error) ||
      error.message !== PHOTO_RECOVERY_CANDIDATE_UNAUTHENTICATED ||
      !staged.captureSessionId
    ) {
      throw error;
    }
    const source = await lookupPlaintextStaging(staged.captureSessionId, 'photo_capture_jpeg');
    if (!source) throw error;
    await discardPendingEncryptedPhotoForRetry(encryptedUri, mutation.operationId);
  }

  if (!staged.captureSessionId) return false;
  const source = await lookupPlaintextStaging(staged.captureSessionId, 'photo_capture_jpeg');
  if (!source) return false;
  const encrypted = await encryptCapturedPhoto(source.uri, staged.id, mutation.operationId);
  if (encrypted.encryptedLocalUri !== encryptedUri) {
    throw new Error(PHOTO_MUTATION_JOURNAL_INCONSISTENT);
  }
  return recoverPreparedEncryptedPhoto(encryptedUri, mutation.operationId);
}

async function recoverPendingPhotoStoreUnlocked(
  initial: PhotoStoreSnapshot,
): Promise<PhotoStoreSnapshot> {
  if (!initial.mutation) return initial;
  const mutation = initial.mutation;

  if (mutation.kind === 'add') {
    const finalReady = await ensurePreparedAddFile(initial);
    if (!finalReady) {
      if (mutation.phase === 'metadata_committed') {
        throw new Error(PHOTO_MUTATION_SOURCE_MISSING);
      }
      // No final, pending artifact, or owned plaintext source exists. The add
      // never reached commit and can be rolled back without touching prior rows.
      const stagedIndex = initial.items.findIndex((item) => item.id === mutation.operationId);
      const storedItems = initial.storedItems.filter((_item, index) => index !== stagedIndex);
      await writeStoredEnvelope({ items: storedItems, mutation: null });
      return {
        items: initial.items.filter((item) => item.id !== mutation.operationId),
        mutation: null,
        retainedItems: [],
        storedItems,
        storedRetainedItems: [],
      };
    }

    let committed = initial;
    if (mutation.phase === 'prepared') {
      const committedMutation: PhotoMutationJournal = {
        ...mutation,
        phase: 'metadata_committed',
      };
      await writeStoredEnvelope({
        items: initial.storedItems,
        mutation: committedMutation,
        retainedItems: [],
      });
      committed = { ...initial, mutation: committedMutation };
    }
    await finishCommittedAdd(committed);
    return { ...committed, mutation: null };
  }

  const affectedUris = initial.retainedItems.flatMap(encryptedUrisForRecord);
  if (mutation.phase === 'prepared') {
    await stageEncryptedPhotoDeletions(affectedUris, mutation.operationId);
    const committedMutation: PhotoMutationJournal = {
      ...mutation,
      phase: 'metadata_committed',
    };
    await writeStoredEnvelope({
      items: initial.storedItems,
      mutation: committedMutation,
      retainedItems: initial.storedRetainedItems,
    });
  }
  await finalizeEncryptedPhotoDeletions(affectedUris, mutation.operationId);
  await writeStoredEnvelope({ items: initial.storedItems, mutation: null });
  return {
    items: initial.items,
    mutation: null,
    retainedItems: [],
    storedItems: initial.storedItems,
    storedRetainedItems: [],
  };
}

async function loadPhotosForMutationUnlocked(): Promise<PhotoRecord[]> {
  return (await recoverPendingPhotoStoreUnlocked(await readPhotosUnlocked())).items;
}

/** Explicit owner-bound recovery; callers must run this before plaintext scavenging. */
export async function recoverPhotoStoreMutations(): Promise<void> {
  await runPhotoStoreMutation(async () => {
    const decoded = decodePhotoStore(await getPrivateItem(KEY));
    if (!decoded.mutation) return;
    await recoverPendingPhotoStoreUnlocked(await normalizeDecodedPhotoStore(decoded));
  });
}

/** Classify photo metadata without repairing, migrating, deleting, or
 * rewriting bytes. Absence alone is a valid empty timeline. */
export async function readPhotos(): Promise<PhotoStoreReadResult> {
  // Queue behind mutations but never recover, rewrite, move, or delete. A V2
  // journal means metadata is intentionally staged and must not be published.
  try {
    return await runPhotoStoreMutation(readPhotoStoreResultUnlocked);
  } catch (error) {
    return classifyPhotoStoreReadError(error);
  }
}

/** Compatibility boundary for query consumers that use rejection as their
 * recovery signal. New storage-aware consumers should use `readPhotos`. */
export async function loadPhotos(): Promise<PhotoRecord[]> {
  const result = await readPhotos();
  if (result.status === 'absent' || result.status === 'available') return result.photos;
  throw photoStoreReadError(result);
}

export async function addPhoto(input: NewPhoto): Promise<PhotoMutationCommit<PhotoRecord>> {
  return runPhotoStoreMutation(async () => {
    const items = await loadPhotosForMutationUnlocked();
    const committedCapture = input.captureSessionId
      ? items.find((photo) => photo.captureSessionId === input.captureSessionId)
      : undefined;
    if (committedCapture) {
      if (input.captureSessionId) {
        await cleanupPlaintextStagingOperation(input.captureSessionId, 'photo_capture_jpeg');
      }
      return photoMutationCommit(committedCapture, items);
    }

    const sourceNeedsEncryption = Boolean(input.localUri && !isEncryptedPhotoUri(input.localUri));
    if (sourceNeedsEncryption !== Boolean(input.captureSessionId)) {
      throw new Error(PHOTO_MUTATION_CAPTURE_SESSION_REQUIRED);
    }
    let capturedSourceUri: string | null = null;
    if (sourceNeedsEncryption) {
      if (!CAPTURE_OPERATION_ID.test(input.captureSessionId!)) {
        throw new Error(PHOTO_MUTATION_CAPTURE_SESSION_REQUIRED);
      }
      const source = await lookupPlaintextStaging(input.captureSessionId!, 'photo_capture_jpeg');
      if (!source || source.uri !== input.localUri) {
        throw new Error(PHOTO_MUTATION_CAPTURE_SESSION_REQUIRED);
      }
      capturedSourceUri = source.uri;
    }

    const id = randomUUID().toLowerCase();
    if (items.some((item) => item.id === id)) throw new Error(PHOTO_METADATA_INVALID);
    const encryptedLocalUri = sourceNeedsEncryption
      ? encryptedPhotoUriForId(id)
      : input.localUri && isEncryptedPhotoUri(input.localUri)
        ? input.localUri
        : null;
    if (encryptedLocalUri && encryptedLocalUri !== encryptedPhotoUriForId(id)) {
      throw new Error(PHOTO_MUTATION_JOURNAL_INCONSISTENT);
    }
    const series = input.series ?? 'front';
    const rec: PhotoRecord = {
      id,
      series,
      takenLocalDate: input.takenLocalDate,
      takenAt: new Date().toISOString(),
      timeOfDay: input.timeOfDay ?? null,
      alignmentScore: input.alignmentScore ?? null,
      lightingScore: input.lightingScore ?? null,
      headRoll: input.headRoll ?? null,
      headYaw: input.headYaw ?? null,
      headPitch: input.headPitch ?? null,
      qualitySource: input.qualitySource ?? null,
      isReference: !items.some((item) => item.series === series),
      referencePhotoId: input.referencePhotoId ?? null,
      captureSessionId: input.captureSessionId ?? null,
      localUri: encryptedLocalUri,
      notes: input.notes ?? null,
      localOnly: true,
      storagePath: null,
      faceRegionRedacted: false,
      isEncrypted: encryptedLocalUri !== null,
      encryptedLocalUri,
      thumbnailLocalUri: null,
      encryptionVersion: encryptedLocalUri ? photoEncryptionInfo.version : 'none',
      keyId: encryptedLocalUri ? photoEncryptionInfo.keyId : null,
    };
    const storedItems = await encodeStoredRecords([rec, ...items]);
    const prepared: PhotoMutationJournal = { kind: 'add', operationId: id, phase: 'prepared' };
    await writeStoredEnvelope({ items: storedItems, mutation: prepared, retainedItems: [] });

    if (sourceNeedsEncryption) {
      try {
        const encrypted = await encryptCapturedPhoto(capturedSourceUri!, id, id);
        if (encrypted.encryptedLocalUri !== encryptedLocalUri) {
          throw new Error(PHOTO_MUTATION_JOURNAL_INCONSISTENT);
        }
      } catch (error) {
        if (!(await recoverPreparedEncryptedPhoto(encryptedLocalUri!, id))) throw error;
      }
    }
    if (encryptedLocalUri && !(await recoverPreparedEncryptedPhoto(encryptedLocalUri, id))) {
      throw new Error(PHOTO_MUTATION_SOURCE_MISSING);
    }

    const committed: PhotoMutationJournal = { ...prepared, phase: 'metadata_committed' };
    await writeStoredEnvelope({ items: storedItems, mutation: committed, retainedItems: [] });
    if (rec.captureSessionId) {
      await cleanupPlaintextStagingOperation(rec.captureSessionId, 'photo_capture_jpeg');
    }
    await writeStoredEnvelope({ items: storedItems, mutation: null });
    return photoMutationCommit(rec, [rec, ...items]);
  });
}

export async function updatePhoto(
  id: string,
  patch: Partial<Pick<PhotoRecord, 'notes' | 'timeOfDay' | 'faceRegionRedacted'>>,
): Promise<PhotoMutationCommit<void>> {
  return runPhotoStoreMutation(async () => {
    const items = await loadPhotosForMutationUnlocked();
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) return photoMutationCommit(undefined, items);
    const current = items[index]!;
    const next = { ...current, ...patch };
    if (
      current.notes === next.notes &&
      current.timeOfDay === next.timeOfDay &&
      current.faceRegionRedacted === next.faceRegionRedacted
    ) {
      return photoMutationCommit(undefined, items);
    }
    const nextItems = items.map((item, itemIndex) => (itemIndex === index ? next : item));
    await writeSettledItems(nextItems);
    return photoMutationCommit(undefined, nextItems);
  });
}

export async function removePhoto(id: string): Promise<PhotoMutationCommit<void>> {
  return runAccountGenerationOperation(async (lease) => {
    const localCommit = await runPhotoStoreMutation(async () => {
      const items = await loadPhotosForMutationUnlocked();
      const targetIndex = items.findIndex((item) => item.id === id);
      if (targetIndex < 0) return photoMutationCommit(false, items);
      const target = items[targetIndex]!;
      const affectedUris = encryptedUrisForRecord(target);
      target && assertCanonicalRecordUris(target);
      await verifyEncryptedPhotoDeletionSources(affectedUris);

      const storedItems = await encodeStoredRecords(items);
      const nextStoredItems = storedItems.filter((_item, index) => index !== targetIndex);
      const retainedItems = [storedItems[targetIndex]!];
      const operationId = randomUUID().toLowerCase();
      const prepared: PhotoMutationJournal = {
        kind: 'delete',
        operationId,
        phase: 'prepared',
      };
      await writeStoredEnvelope({
        items: nextStoredItems,
        mutation: prepared,
        retainedItems,
      });
      await stageEncryptedPhotoDeletions(affectedUris, operationId);
      await writeStoredEnvelope({
        items: nextStoredItems,
        mutation: { ...prepared, phase: 'metadata_committed' },
        retainedItems,
      });
      await finalizeEncryptedPhotoDeletions(affectedUris, operationId);
      await writeStoredEnvelope({ items: nextStoredItems, mutation: null });
      return photoMutationCommit(true, items.filter((_item, index) => index !== targetIndex));
    });
    lease.assertCurrent();
    if (localCommit.result) {
      try {
        const owner = await captureAuthenticatedAccountOwner(lease);
        if (owner) {
          lease.assertCurrent();
          await supabase
            .from('photos')
            .delete()
            .eq('id', id)
            .eq('user_id', owner.userId)
            .abortSignal(lease.signal);
          lease.assertCurrent();
        }
      } catch {
        lease.assertCurrent();
        /* best-effort */
      }
    }
    return photoMutationCommit(undefined, localCommit.photos);
  });
}

/** Make `id` the reference for its series. */
export async function setReference(id: string): Promise<PhotoMutationCommit<void>> {
  return runPhotoStoreMutation(async () => {
    const items = await loadPhotosForMutationUnlocked();
    const target = items.find((item) => item.id === id);
    if (!target) return photoMutationCommit(undefined, items);
    if (
      target.isReference &&
      items.every((item) => item.series !== target.series || item.isReference === (item.id === id))
    ) {
      return photoMutationCommit(undefined, items);
    }
    const nextItems = items.map((item) =>
      item.series === target.series ? { ...item, isReference: item.id === id } : item,
    );
    await writeSettledItems(nextItems);
    return photoMutationCommit(undefined, nextItems);
  });
}

/** Test/seed reset. */
export async function clearPhotos(): Promise<void> {
  await runPhotoStoreMutation(async () => {
    const items = await loadPhotosForMutationUnlocked();
    if (items.length === 0) return;
    items.forEach(assertCanonicalRecordUris);
    const affectedUris = items.flatMap(encryptedUrisForRecord);
    await verifyEncryptedPhotoDeletionSources(affectedUris);
    const retainedItems = await encodeStoredRecords(items);
    const operationId = randomUUID().toLowerCase();
    const prepared: PhotoMutationJournal = {
      kind: 'clear',
      operationId,
      phase: 'prepared',
    };
    await writeStoredEnvelope({ items: [], mutation: prepared, retainedItems });
    await stageEncryptedPhotoDeletions(affectedUris, operationId);
    await writeStoredEnvelope({
      items: [],
      mutation: { ...prepared, phase: 'metadata_committed' },
      retainedItems,
    });
    await finalizeEncryptedPhotoDeletions(affectedUris, operationId);
    await writeStoredEnvelope({ items: [], mutation: null });
  });
}
