import { randomUUID } from 'expo-crypto';

import type { PhotoSeries, TimeOfDay } from '@onskin/types';
import { PHOTO_SERIES } from '@onskin/types';

import { supabase } from '@/lib/supabase/client';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { captureAuthenticatedAccountOwner } from '@/lib/auth/authenticatedAccountOwner';
import { getPrivateItem, removePrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

import {
  decryptPhotoNote,
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
 * image bytes are encrypted into app-private `.onskinphoto` envelopes and never
 * uploaded or mirrored by local save. Notes are encrypted separately inside the
 * encrypted metadata envelope for legacy migration safety.
 */
const KEY = 'onskin.photos.v1';
const PHOTO_SERIES_SET = new Set<PhotoSeries>(PHOTO_SERIES);
const TIME_OF_DAY = new Set<TimeOfDay>(['morning', 'evening']);
export const PHOTO_METADATA_INVALID = 'PHOTO_METADATA_INVALID';

let photoStoreMutationTail: Promise<void> = Promise.resolve();

function runPhotoStoreMutation<T>(operation: () => Promise<T>): Promise<T> {
  return runAccountGenerationOperation(async (lease) => {
    const guardedOperation = async () => {
      lease.assertCurrent();
      const result = await operation();
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
    captureSessionId: stringOrNull(value.captureSessionId),
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

async function normalizeStoredRecords(value: unknown): Promise<PhotoRecord[] | null> {
  if (!Array.isArray(value)) return null;
  const items: PhotoRecord[] = [];
  for (const row of value) {
    const photo = await normalizeStoredRecord(row);
    if (!photo) return null;
    items.push(photo);
  }
  return items;
}

type PhotoStoreSnapshot = {
  items: PhotoRecord[];
  metadataPresent: boolean;
};

async function readPhotosUnlocked(): Promise<PhotoStoreSnapshot> {
  const raw = await getPrivateItem(KEY);
  if (raw === null) return { items: [], metadataPresent: false };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(PHOTO_METADATA_INVALID);
  }
  const normalized = await normalizeStoredRecords(parsed);
  if (!normalized) throw new Error(PHOTO_METADATA_INVALID);
  return { items: normalized, metadataPresent: true };
}

function referencedEncryptedUris(items: readonly PhotoRecord[]): string[] {
  return items.flatMap((photo) =>
    [photo.encryptedLocalUri ?? photo.localUri, photo.thumbnailLocalUri].filter(
      (uri): uri is string => Boolean(uri && isEncryptedPhotoUri(uri)),
    ),
  );
}

async function loadPhotosForMutationUnlocked(): Promise<PhotoRecord[]> {
  const snapshot = await readPhotosUnlocked();
  const referencedUris = referencedEncryptedUris(snapshot.items);
  if (snapshot.metadataPresent) await reconcileEncryptedPhotoStorage(referencedUris);
  else await reconcileEncryptedPhotoStorage(referencedUris, { removeUnreferencedFinals: false });
  return snapshot.items;
}

export async function loadPhotos(): Promise<PhotoRecord[]> {
  // Join the mutation queue so a read cannot observe metadata while its file is
  // quarantined, but do not run recovery or persist normalized metadata here.
  return runPhotoStoreMutation(async () => (await readPhotosUnlocked()).items);
}

async function persist(items: PhotoRecord[]): Promise<void> {
  const stored: StoredPhotoRecord[] = await Promise.all(
    items.map(async (item) => ({
      ...item,
      notes: null,
      notesCiphertext: await encryptPhotoNote(item.notes),
    })),
  );
  await setPrivateItem(KEY, JSON.stringify(stored));
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
): Promise<QuarantinedPhotoFile[]> {
  const quarantined: QuarantinedPhotoFile[] = [];
  try {
    for (const uri of new Set(uris.filter((value): value is string => Boolean(value)))) {
      const file = await quarantineEncryptedPhoto(uri, operationId);
      if (file) quarantined.push(file);
    }
    return quarantined;
  } catch (error) {
    const restored = await Promise.allSettled(
      [...quarantined].reverse().map((file) => restoreQuarantinedPhoto(file)),
    );
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
  for (const file of files) await deleteQuarantinedPhoto(file);
}

export async function addPhoto(input: NewPhoto): Promise<PhotoRecord> {
  return runPhotoStoreMutation(async () => {
    const items = await loadPhotosForMutationUnlocked();
    const committedCapture = input.captureSessionId
      ? items.find((photo) => photo.captureSessionId === input.captureSessionId)
      : undefined;
    if (committedCapture) {
      // A prior attempt may have committed encrypted metadata before plaintext
      // cleanup failed. Retrying the same opaque capture session must finish
      // cleanup without creating a duplicate photo record.
      if (input.localUri && !isEncryptedPhotoUri(input.localUri)) {
        await deleteCapturedPhotoSource(input.localUri);
      }
      return committedCapture;
    }
    const series = input.series ?? 'front';
    const hasReference = items.some((p) => p.series === series);
    const id = randomUUID();
    const sourceNeedsCleanup = Boolean(input.localUri && !isEncryptedPhotoUri(input.localUri));
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
      captureSessionId: input.captureSessionId ?? null,
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
      await persist([rec, ...items]);
    } catch (error) {
      if (encrypted && sourceNeedsCleanup) {
        await quarantineUncommittedEncryptedPhoto(encrypted.encryptedLocalUri, `add-${id}`);
      }
      throw error;
    }
    if (sourceNeedsCleanup) {
      // Do not report save success while journaled plaintext remains. The
      // captureSessionId branch above makes this post-commit cleanup retryable.
      await deleteCapturedPhotoSource(input.localUri);
    }
    return rec;
  });
}

export async function updatePhoto(
  id: string,
  patch: Partial<Pick<PhotoRecord, 'notes' | 'timeOfDay' | 'faceRegionRedacted'>>,
): Promise<void> {
  await runPhotoStoreMutation(async () => {
    const items = await loadPhotosForMutationUnlocked();
    await persist(items.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  });
}

export async function removePhoto(id: string): Promise<void> {
  await runAccountGenerationOperation(async (lease) => {
    const removed = await runPhotoStoreMutation(async () => {
      const items = await loadPhotosForMutationUnlocked();
      const target = items.find((p) => p.id === id);
      if (!target) return false;
      const quarantined = await quarantinePhotoFiles(
        [target.encryptedLocalUri ?? target.localUri, target.thumbnailLocalUri],
        `delete-${id}-${randomUUID()}`,
      );
      try {
        await persist(items.filter((p) => p.id !== id));
      } catch (error) {
        await restoreQuarantinedFiles(quarantined);
        throw error;
      }
      await finishQuarantinedFiles(quarantined);
      return true;
    });
    lease.assertCurrent();
    if (!removed) return;
    try {
      const owner = await captureAuthenticatedAccountOwner(lease);
      if (!owner) return;
      lease.assertCurrent();
      await supabase
        .from('photos')
        .delete()
        .eq('id', id)
        .eq('user_id', owner.userId)
        .abortSignal(lease.signal);
      lease.assertCurrent();
    } catch {
      lease.assertCurrent();
      /* best-effort */
    }
  });
}

/** Make `id` the reference for its series. */
export async function setReference(id: string): Promise<void> {
  await runPhotoStoreMutation(async () => {
    const items = await loadPhotosForMutationUnlocked();
    const target = items.find((p) => p.id === id);
    if (!target) return;
    await persist(
      items.map((p) => (p.series === target.series ? { ...p, isReference: p.id === id } : p)),
    );
  });
}

/** Test/seed reset. */
export async function clearPhotos(): Promise<void> {
  await runPhotoStoreMutation(async () => {
    const items = await loadPhotosForMutationUnlocked();
    const quarantined = await quarantinePhotoFiles(
      items.flatMap((photo) => [
        photo.encryptedLocalUri ?? photo.localUri,
        photo.thumbnailLocalUri,
      ]),
      `clear-${randomUUID()}`,
    );
    try {
      await removePrivateItem(KEY);
    } catch (error) {
      await restoreQuarantinedFiles(quarantined);
      throw error;
    }
    await finishQuarantinedFiles(quarantined);
  });
}
