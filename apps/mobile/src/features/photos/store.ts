import { randomUUID } from 'expo-crypto';

import type { PhotoSeries, TimeOfDay } from '@onskin/types';
import { PHOTO_SERIES } from '@onskin/types';

import { supabase } from '@/lib/supabase/client';
import { getPrivateItem, removePrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

import {
  decryptPhotoNote,
  deleteEncryptedPhoto,
  encryptCapturedPhoto,
  encryptPhotoNote,
  isEncryptedPhotoUri,
  photoEncryptionInfo,
} from './encryptedStorage';
import type { PhotoMeta } from './timeline';

/**
 * Local-first photo store. Metadata is encrypted before it enters AsyncStorage;
 * image bytes are encrypted into app-private `.onskinphoto` envelopes and never
 * mirrored to Supabase while `localOnly` is true. Notes are encrypted separately
 * inside the encrypted metadata envelope for legacy migration safety.
 */
const KEY = 'onskin.photos.v1';
const PHOTO_SERIES_SET = new Set<PhotoSeries>(PHOTO_SERIES);
const TIME_OF_DAY = new Set<TimeOfDay>(['morning', 'evening']);

export type PhotoRecord = PhotoMeta & {
  takenAt: string;
  captureSessionId: string | null;
  headRoll: number | null;
  headYaw: number | null;
  headPitch: number | null;
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
    ? await decryptPhotoNote(notesCiphertext).catch(() => null)
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
): Promise<{ items: PhotoRecord[]; changed: boolean } | null> {
  if (!Array.isArray(value)) return null;
  const items: PhotoRecord[] = [];
  let changed = false;
  for (const row of value) {
    const photo = await normalizeStoredRecord(row);
    if (!photo) {
      changed = true;
      continue;
    }
    items.push(photo);
    changed ||= JSON.stringify(photo) !== JSON.stringify(row);
  }
  return { items, changed };
}

export async function loadPhotos(): Promise<PhotoRecord[]> {
  let raw: string | null = null;
  try {
    raw = await getPrivateItem(KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const normalized = await normalizeStoredRecords(JSON.parse(raw) as unknown);
    if (!normalized) {
      await removePrivateItem(KEY).catch(() => undefined);
      return [];
    }
    if (normalized.changed) {
      if (normalized.items.length > 0) await persist(normalized.items).catch(() => undefined);
      else await removePrivateItem(KEY).catch(() => undefined);
    }
    return normalized.items;
  } catch {
    await removePrivateItem(KEY).catch(() => undefined);
    return [];
  }
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

/** Best-effort metadata-only mirror. Image paths, notes, and bytes are never sent. */
async function mirror(rec: PhotoRecord): Promise<void> {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user?.id) return;
    await supabase.from('photos').insert({
      id: rec.id,
      user_id: u.user.id,
      local_only: true,
      storage_path: null,
      series: rec.series,
      reference_photo_id: rec.referencePhotoId,
      capture_session_id: rec.captureSessionId,
      taken_at: rec.takenAt,
      taken_local_date: rec.takenLocalDate,
      time_of_day: rec.timeOfDay,
      alignment_score: rec.alignmentScore,
      lighting_score: rec.lightingScore,
      head_roll: rec.headRoll,
      head_yaw: rec.headYaw,
      head_pitch: rec.headPitch,
      notes: null,
      is_encrypted: rec.isEncrypted,
    });
  } catch {
    /* best-effort until the backend is configured */
  }
}

export async function addPhoto(input: NewPhoto): Promise<PhotoRecord> {
  const items = await loadPhotos();
  const series = input.series ?? 'front';
  const hasReference = items.some((p) => p.series === series);
  const id = randomUUID();
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
  await persist([rec, ...items]);
  void mirror(rec);
  return rec;
}

export async function updatePhoto(
  id: string,
  patch: Partial<Pick<PhotoRecord, 'notes' | 'timeOfDay' | 'faceRegionRedacted'>>,
): Promise<void> {
  const items = await loadPhotos();
  await persist(items.map((p) => (p.id === id ? { ...p, ...patch } : p)));
}

export async function removePhoto(id: string): Promise<void> {
  const items = await loadPhotos();
  const target = items.find((p) => p.id === id);
  await persist(items.filter((p) => p.id !== id));
  await deleteEncryptedPhoto(target?.encryptedLocalUri ?? target?.localUri);
  await deleteEncryptedPhoto(target?.thumbnailLocalUri);
  try {
    await supabase.from('photos').delete().eq('id', id);
  } catch {
    /* best-effort */
  }
}

/** Make `id` the reference for its series. */
export async function setReference(id: string): Promise<void> {
  const items = await loadPhotos();
  const target = items.find((p) => p.id === id);
  if (!target) return;
  await persist(
    items.map((p) => (p.series === target.series ? { ...p, isReference: p.id === id } : p)),
  );
}

/** Test/seed reset. */
export async function clearPhotos(): Promise<void> {
  const items = await loadPhotos();
  await Promise.all(
    items.flatMap((p) => [
      deleteEncryptedPhoto(p.encryptedLocalUri ?? p.localUri),
      deleteEncryptedPhoto(p.thumbnailLocalUri),
    ]),
  );
  await removePrivateItem(KEY);
}
