import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

import type { PhotoSeries, TimeOfDay } from '@onskin/types';

import { supabase } from '@/lib/supabase/client';

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
 * Local-first photo store. Metadata stays in AsyncStorage; image bytes are
 * encrypted into app-private `.onskinphoto` envelopes and never mirrored to
 * Supabase while `localOnly` is true. Notes are encrypted before persistence.
 */
const KEY = 'onskin.photos.v1';

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

async function normalizeStoredRecord(item: PhotoRecord & { notesCiphertext?: string | null }): Promise<PhotoRecord> {
  const encryptedLocalUri = item.encryptedLocalUri ?? (isEncryptedPhotoUri(item.localUri) ? item.localUri : null);
  const notes = item.notesCiphertext ? await decryptPhotoNote(item.notesCiphertext).catch(() => null) : item.notes ?? null;
  return {
    ...item,
    notes,
    encryptedLocalUri,
    thumbnailLocalUri: item.thumbnailLocalUri ?? null,
    encryptionVersion: item.encryptionVersion ?? (encryptedLocalUri ? photoEncryptionInfo.version : 'none'),
    keyId: item.keyId ?? (encryptedLocalUri ? photoEncryptionInfo.keyId : null),
    localUri: item.localUri ?? encryptedLocalUri ?? null,
    isEncrypted: item.isEncrypted ?? Boolean(encryptedLocalUri),
  };
}

export async function loadPhotos(): Promise<PhotoRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PhotoRecord[];
    if (!Array.isArray(parsed)) return [];
    return Promise.all(parsed.map(normalizeStoredRecord));
  } catch {
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
  await AsyncStorage.setItem(KEY, JSON.stringify(stored));
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
  await persist(items.map((p) => (p.series === target.series ? { ...p, isReference: p.id === id } : p)));
}

/** Test/seed reset. */
export async function clearPhotos(): Promise<void> {
  const items = await loadPhotos();
  await Promise.all(items.map((p) => deleteEncryptedPhoto(p.encryptedLocalUri ?? p.localUri)));
  await AsyncStorage.removeItem(KEY);
}
