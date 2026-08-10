import { randomUUID } from 'expo-crypto';

import type { PhotoSeries, TimeOfDay } from '@layerwell/types';
import { PHOTO_SERIES } from '@layerwell/types';

import { supabase } from '@/lib/supabase/client';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import {
  HEALTH_DATA_WRITE_ADMISSION_CLOSED,
  runHealthDataWriteOperation,
  type HealthDataWriteOperationLease,
} from '@/lib/consent/healthDataWriteAdmission';
import { activeHealthProcessingOwnerUserId } from '@/lib/consent/healthProcessingEpoch';
import { getPrivateItem, removePrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

import { trustedProgressCaptureSessionId } from './progressCapturePrivacy';

import {
  decryptPhotoNote,
  clearEncryptedPhotoStorage,
  deleteCapturedPhotoSource,
  deleteQuarantinedPhoto,
  encryptCapturedPhoto,
  encryptPhotoNote,
  isEncryptedPhotoUri,
  photoEncryptionInfo,
  quarantineEncryptedPhoto,
  reconcileEncryptedPhotoStorage,
  restoreQuarantinedPhoto,
  type QuarantinedPhotoFile,
} from './encryptedStorage';
import type { PhotoMeta, PhotoQualitySource } from './timeline';

/**
 * Local-first photo store. Metadata is encrypted before it enters AsyncStorage;
 * image bytes are encrypted into app-private `.layerwellphoto` envelopes and never
 * uploaded or mirrored by local save. Notes are encrypted separately inside the
 * encrypted metadata envelope for legacy migration safety.
 */
const KEY = 'layerwell.photos.v1';
const PHOTO_SERIES_SET = new Set<PhotoSeries>(PHOTO_SERIES);
const TIME_OF_DAY = new Set<TimeOfDay>(['morning', 'evening']);
export const PHOTO_METADATA_INVALID = 'PHOTO_METADATA_INVALID';
export const PHOTO_CAPTURE_SESSION_INVALID = 'PHOTO_CAPTURE_SESSION_INVALID';
export const PHOTO_CAPTURE_SESSION_CONFLICT = 'PHOTO_CAPTURE_SESSION_CONFLICT';
export const PHOTO_CAPTURE_SESSION_DUPLICATE = 'PHOTO_CAPTURE_SESSION_DUPLICATE';

let photoStoreMutationTail: Promise<void> = Promise.resolve();

type PhotoOperationGuard = Readonly<{ assertCurrent: () => void }>;

function runCurrentHealthDataOperation<T>(
  operation: (lease: HealthDataWriteOperationLease) => T | Promise<T>,
): Promise<T> {
  const ownerUserId = activeHealthProcessingOwnerUserId();
  if (!ownerUserId) return Promise.reject(new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED));
  return runHealthDataWriteOperation(ownerUserId, operation);
}

function queuePhotoStoreMutation<T, Guard extends PhotoOperationGuard>(
  guard: Guard,
  operation: (guard: Guard) => Promise<T>,
): Promise<T> {
  const guardedOperation = async () => {
    guard.assertCurrent();
    try {
      const result = await operation(guard);
      guard.assertCurrent();
      return result;
    } catch (error) {
      // Never collapse withdrawal/re-grant or an account transition into a
      // feature/storage error from the authority window that just ended.
      guard.assertCurrent();
      throw error;
    }
  };
  const pending = photoStoreMutationTail.then(guardedOperation, guardedOperation);
  photoStoreMutationTail = pending.then(
    () => undefined,
    () => undefined,
  );
  return pending;
}

function runPhotoStoreMutation<T>(
  operation: (lease: HealthDataWriteOperationLease) => Promise<T>,
): Promise<T> {
  return runCurrentHealthDataOperation((lease) => queuePhotoStoreMutation(lease, operation));
}

function runPhotoStoreCleanup<T>(
  operation: (guard: PhotoOperationGuard) => Promise<T>,
): Promise<T> {
  return runAccountGenerationOperation(async (lease) => {
    const guardedOperation = async () => {
      lease.assertCurrent();
      const result = await operation(lease);
      lease.assertCurrent();
      return result;
    };
    try {
      return await queuePhotoStoreMutation(lease, () => guardedOperation());
    } catch (error) {
      lease.assertCurrent();
      throw error;
    }
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

type StoredPhotoRecord = Omit<PhotoRecord, 'notes'> & {
  notes: null;
  notesCiphertext?: string | null;
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

export type AddPhotoOutcome = Readonly<{
  photo: PhotoRecord;
  createdNow: boolean;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
  return text && !Number.isNaN(Date.parse(text)) ? text : fallback;
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

function captureSessionIdOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const captureSessionId = trustedProgressCaptureSessionId(value);
  if (captureSessionId === null) throw new Error(PHOTO_METADATA_INVALID);
  return captureSessionId;
}

async function normalizeStoredRecord(
  value: unknown,
  guard: PhotoOperationGuard,
): Promise<PhotoRecord | null> {
  if (!isRecord(value)) return null;
  const id = stringOrNull(value.id);
  const takenLocalDate = localDateOrNull(value.takenLocalDate);
  if (!id || !takenLocalDate) return null;
  const captureSessionId = captureSessionIdOrNull(value.captureSessionId);

  const localUri = stringOrNull(value.localUri);
  const explicitEncryptedUri = stringOrNull(value.encryptedLocalUri);
  const encryptedLocalUri =
    explicitEncryptedUri ?? (localUri && isEncryptedPhotoUri(localUri) ? localUri : null);
  const notesCiphertext = stringOrNull(value.notesCiphertext);
  guard.assertCurrent();
  const notes = notesCiphertext
    ? await decryptPhotoNote(notesCiphertext)
    : stringOrNull(value.notes);
  guard.assertCurrent();
  const encrypted = encryptedLocalUri != null;
  const isEncrypted = encrypted || booleanOr(value.isEncrypted, false);

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
    captureSessionId,
    headRoll: finiteNumberOrNull(value.headRoll),
    headYaw: finiteNumberOrNull(value.headYaw),
    headPitch: finiteNumberOrNull(value.headPitch),
    qualitySource:
      value.qualitySource === 'post_capture_measurement' ? 'post_capture_measurement' : null,
    localOnly: booleanOr(value.localOnly, true),
    storagePath: stringOrNull(value.storagePath),
    faceRegionRedacted: booleanOr(value.faceRegionRedacted, false),
    isEncrypted,
    encryptedLocalUri,
    thumbnailLocalUri: stringOrNull(value.thumbnailLocalUri),
    encryptionVersion:
      stringOrNull(value.encryptionVersion) ?? (encrypted ? photoEncryptionInfo.version : 'none'),
    keyId: stringOrNull(value.keyId) ?? (encrypted ? photoEncryptionInfo.keyId : null),
  };
}

async function normalizeStoredRecords(
  value: unknown,
  guard: PhotoOperationGuard,
): Promise<PhotoRecord[] | null> {
  if (!Array.isArray(value)) return null;
  const items: PhotoRecord[] = [];
  const captureSessionIds = new Set<string>();
  for (const row of value) {
    guard.assertCurrent();
    const photo = await normalizeStoredRecord(row, guard);
    guard.assertCurrent();
    if (!photo) return null;
    if (photo.captureSessionId !== null) {
      if (captureSessionIds.has(photo.captureSessionId)) {
        throw new Error(PHOTO_CAPTURE_SESSION_DUPLICATE);
      }
      captureSessionIds.add(photo.captureSessionId);
    }
    items.push(photo);
  }
  return items;
}

async function loadPhotosUnlocked(guard: PhotoOperationGuard): Promise<PhotoRecord[]> {
  guard.assertCurrent();
  const raw = await getPrivateItem(KEY);
  guard.assertCurrent();
  if (raw === null) {
    guard.assertCurrent();
    await reconcileEncryptedPhotoStorage([], { removeUnreferencedFinals: false });
    guard.assertCurrent();
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(PHOTO_METADATA_INVALID);
  }
  const normalized = await normalizeStoredRecords(parsed, guard);
  guard.assertCurrent();
  if (!normalized) throw new Error(PHOTO_METADATA_INVALID);
  guard.assertCurrent();
  await reconcileEncryptedPhotoStorage(
    normalized.flatMap((photo) =>
      [photo.encryptedLocalUri ?? photo.localUri, photo.thumbnailLocalUri].filter(
        (uri): uri is string => Boolean(uri && isEncryptedPhotoUri(uri)),
      ),
    ),
  );
  guard.assertCurrent();
  return normalized;
}

export async function loadPhotos(): Promise<PhotoRecord[]> {
  return runPhotoStoreMutation(loadPhotosUnlocked);
}

async function persist(items: PhotoRecord[], guard: PhotoOperationGuard): Promise<void> {
  guard.assertCurrent();
  const stored: StoredPhotoRecord[] = await Promise.all(
    items.map(async (item) => ({
      ...item,
      notes: null,
      notesCiphertext: await encryptPhotoNote(item.notes),
    })),
  );
  guard.assertCurrent();
  await setPrivateItem(KEY, JSON.stringify(stored));
  guard.assertCurrent();
}

async function quarantineUncommittedEncryptedPhoto(
  uri: string,
  operationId: string,
): Promise<void> {
  // A storage write can reject after committing. Keep the encrypted envelope
  // quarantined until a subsequent metadata read can prove whether to restore
  // or delete it; the camera source also remains available for a retry.
  await quarantineEncryptedPhoto(uri, operationId);
}

async function quarantinePhotoFiles(
  uris: (string | null | undefined)[],
  operationId: string,
  guard: PhotoOperationGuard,
): Promise<QuarantinedPhotoFile[]> {
  const quarantined: QuarantinedPhotoFile[] = [];
  try {
    for (const uri of new Set(uris.filter((value): value is string => Boolean(value)))) {
      guard.assertCurrent();
      const file = await quarantineEncryptedPhoto(uri, operationId);
      guard.assertCurrent();
      if (file) quarantined.push(file);
    }
    return quarantined;
  } catch (error) {
    try {
      guard.assertCurrent();
    } catch (authorityError) {
      // Withdrawal/account cleanup owns the bytes now. Finish deleting any
      // already-quarantined envelopes; never restore health data into a new lease.
      await finishQuarantinedFiles(quarantined);
      throw authorityError;
    }
    const restored = await Promise.allSettled(
      [...quarantined].reverse().map((file) => restoreQuarantinedPhoto(file)),
    );
    try {
      guard.assertCurrent();
    } catch (authorityError) {
      await finishQuarantinedFiles(quarantined);
      throw authorityError;
    }
    if (restored.some((result) => result.status === 'rejected')) {
      throw new Error('PHOTO_DELETE_ROLLBACK_FAILED');
    }
    throw error;
  }
}

async function restoreQuarantinedFiles(files: QuarantinedPhotoFile[]): Promise<void> {
  const restored = await Promise.allSettled(
    [...files].reverse().map((file) => restoreQuarantinedPhoto(file)),
  );
  if (restored.some((result) => result.status === 'rejected')) {
    throw new Error('PHOTO_DELETE_ROLLBACK_FAILED');
  }
}

async function finishQuarantinedFiles(files: QuarantinedPhotoFile[]): Promise<void> {
  await Promise.allSettled(files.map((file) => deleteQuarantinedPhoto(file)));
}

function captureReplayMatches(existing: PhotoRecord, input: NewPhoto): boolean {
  return (
    existing.series === (input.series ?? 'front') &&
    existing.takenLocalDate === input.takenLocalDate &&
    existing.timeOfDay === (input.timeOfDay ?? null)
  );
}

export async function addPhotoWithOutcome(input: NewPhoto): Promise<AddPhotoOutcome> {
  return runPhotoStoreMutation(async (lease) => {
    const items = await loadPhotosUnlocked(lease);
    lease.assertCurrent();
    const requestedCaptureSessionId = input.captureSessionId;
    const captureSessionId =
      requestedCaptureSessionId == null
        ? null
        : trustedProgressCaptureSessionId(requestedCaptureSessionId);
    if (requestedCaptureSessionId != null && captureSessionId === null) {
      throw new Error(PHOTO_CAPTURE_SESSION_INVALID);
    }
    const sourceNeedsCleanup = Boolean(input.localUri && !isEncryptedPhotoUri(input.localUri));

    if (captureSessionId !== null) {
      const replays = items.filter((photo) => photo.captureSessionId === captureSessionId);
      if (replays.length > 1) throw new Error(PHOTO_CAPTURE_SESSION_DUPLICATE);
      const replay = replays[0];
      if (replay !== undefined) {
        if (!captureReplayMatches(replay, input)) {
          throw new Error(PHOTO_CAPTURE_SESSION_CONFLICT);
        }
        if (sourceNeedsCleanup) {
          lease.assertCurrent();
          await deleteCapturedPhotoSource(input.localUri).catch(() => undefined);
          lease.assertCurrent();
        }
        return { photo: replay, createdNow: false };
      }
    }

    const series = input.series ?? 'front';
    const hasReference = items.some((p) => p.series === series);
    const id = randomUUID();
    lease.assertCurrent();
    const encrypted =
      input.localUri && !isEncryptedPhotoUri(input.localUri)
        ? await encryptCapturedPhoto(input.localUri, id)
        : input.localUri && isEncryptedPhotoUri(input.localUri)
          ? {
              encryptedLocalUri: input.localUri,
              keyId: photoEncryptionInfo.keyId,
              encryptionVersion: photoEncryptionInfo.version,
            }
          : null;
    lease.assertCurrent();

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
      isReference: !hasReference,
      referencePhotoId: input.referencePhotoId ?? null,
      captureSessionId,
      localUri: encrypted?.encryptedLocalUri ?? null,
      notes: input.notes ?? null,
      localOnly: true,
      storagePath: null,
      faceRegionRedacted: false,
      isEncrypted: Boolean(encrypted),
      encryptedLocalUri: encrypted?.encryptedLocalUri ?? null,
      thumbnailLocalUri: null,
      encryptionVersion: encrypted?.encryptionVersion ?? 'none',
      keyId: encrypted?.keyId ?? null,
    };
    try {
      await persist([rec, ...items], lease);
    } catch (error) {
      if (encrypted && sourceNeedsCleanup) {
        await quarantineUncommittedEncryptedPhoto(encrypted.encryptedLocalUri, `add-${id}`).catch(
          () => undefined,
        );
      }
      try {
        lease.assertCurrent();
      } catch (authorityError) {
        // A capture cannot remain retryable into a later consent/account lease.
        // Delete the unencrypted camera-cache source without reading it.
        if (sourceNeedsCleanup) {
          await deleteCapturedPhotoSource(input.localUri).catch(() => undefined);
        }
        throw authorityError;
      }
      throw error;
    }
    if (sourceNeedsCleanup) {
      await deleteCapturedPhotoSource(input.localUri).catch(() => undefined);
    }
    lease.assertCurrent();
    return { photo: rec, createdNow: true };
  });
}

export async function addPhoto(input: NewPhoto): Promise<PhotoRecord> {
  return (await addPhotoWithOutcome(input)).photo;
}

export async function updatePhoto(
  id: string,
  patch: Partial<Pick<PhotoRecord, 'notes' | 'timeOfDay' | 'faceRegionRedacted'>>,
): Promise<void> {
  await runPhotoStoreMutation(async (lease) => {
    const items = await loadPhotosUnlocked(lease);
    lease.assertCurrent();
    await persist(
      items.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      lease,
    );
  });
}

export async function removePhoto(id: string): Promise<void> {
  await runPhotoStoreMutation(async (lease) => {
    const items = await loadPhotosUnlocked(lease);
    const target = items.find((p) => p.id === id);
    if (!target) return;
    lease.assertCurrent();
    const quarantined = await quarantinePhotoFiles(
      [target.encryptedLocalUri ?? target.localUri, target.thumbnailLocalUri],
      `delete-${id}-${randomUUID()}`,
      lease,
    );
    try {
      await persist(
        items.filter((p) => p.id !== id),
        lease,
      );
    } catch (error) {
      try {
        lease.assertCurrent();
      } catch (authorityError) {
        await finishQuarantinedFiles(quarantined);
        throw authorityError;
      }
      try {
        await restoreQuarantinedFiles(quarantined);
        lease.assertCurrent();
      } catch (restoreError) {
        try {
          lease.assertCurrent();
        } catch (authorityError) {
          await finishQuarantinedFiles(quarantined);
          throw authorityError;
        }
        throw restoreError;
      }
      throw error;
    }
    lease.assertCurrent();
    await finishQuarantinedFiles(quarantined);
    lease.assertCurrent();
    try {
      await supabase.from('photos').delete().eq('id', id).abortSignal(lease.signal);
      lease.assertCurrent();
    } catch {
      lease.assertCurrent();
      /* best-effort while the exact owner/epoch remains current */
    }
  });
}

/** Make `id` the reference for its series. */
export async function setReference(id: string): Promise<void> {
  await runPhotoStoreMutation(async (lease) => {
    const items = await loadPhotosUnlocked(lease);
    const target = items.find((p) => p.id === id);
    if (!target) return;
    lease.assertCurrent();
    await persist(
      items.map((p) => (p.series === target.series ? { ...p, isReference: p.id === id } : p)),
      lease,
    );
  });
}

/**
 * Explicit privacy-reducing reset. It never decrypts photo metadata and remains
 * available after consent closes so lifecycle/account cleanup can only delete.
 */
export async function clearPhotos(): Promise<void> {
  await runPhotoStoreCleanup(async (guard) => {
    guard.assertCurrent();
    const results = await Promise.allSettled([
      removePrivateItem(KEY),
      clearEncryptedPhotoStorage(),
    ]);
    guard.assertCurrent();
    const failures = results.filter((result) => result.status === 'rejected');
    if (failures.length > 0) throw new Error(`PHOTO_CLEAR_FAILED:${failures.length}`);
  });
}
