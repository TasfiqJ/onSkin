import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

import type { PhotoSeries, TimeOfDay } from '@onskin/types';

import { supabase } from '@/lib/supabase/client';

import type { PhotoMeta } from './timeline';

/**
 * Local-first photo store (docs/06 §6, the D-029 shelf pattern). Photo METADATA
 * lives in AsyncStorage; the image BYTES live on-device at `localUri` in the app
 * sandbox, client-side encrypted, and NEVER leave the device while local_only is
 * true. A best-effort Supabase mirror writes METADATA ONLY (never image data,
 * docs/06 §10) so the row is ready once the backend exists (B-SUPABASE) — and it
 * always sets local_only = true / storage_path = null (cloud backup is a separate,
 * off-by-default consent, docs/06 §7). NO faceprint is ever stored; head_* are
 * coarse pose QA only (docs/06 §7).
 *
 * v1 has no native camera (B-CAMERA), so a saved capture has localUri = null and
 * renders as the design's striped placeholder — the timeline/compare flow is fully
 * exercised end-to-end without real imagery (design Next-steps ①).
 */
const KEY = 'onskin.photos.v1';

export type PhotoRecord = PhotoMeta & {
  takenAt: string; // ISO timestamp
  captureSessionId: string | null;
  headRoll: number | null;
  headYaw: number | null;
  headPitch: number | null;
  localOnly: boolean;
  storagePath: string | null;
  faceRegionRedacted: boolean;
  isEncrypted: boolean;
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

export async function loadPhotos(): Promise<PhotoRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PhotoRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function persist(items: PhotoRecord[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

/** Best-effort, metadata-only mirror (B-SUPABASE). Image bytes are never sent. */
async function mirror(rec: PhotoRecord): Promise<void> {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user?.id) return;
    await supabase.from('photos').insert({
      id: rec.id,
      user_id: u.user.id,
      // local-only ALWAYS here — cloud backup is a separate consented path.
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
      notes: rec.notes,
      is_encrypted: rec.isEncrypted,
      // local_uri is intentionally NOT mirrored — it's a device path.
    });
  } catch {
    /* best-effort until the backend is configured (B-SUPABASE) */
  }
}

export async function addPhoto(input: NewPhoto): Promise<PhotoRecord> {
  const items = await loadPhotos();
  const series = input.series ?? 'front';
  // The first photo of a series becomes its reference (docs/06 §3).
  const hasReference = items.some((p) => p.series === series);
  const rec: PhotoRecord = {
    id: randomUUID(),
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
    localUri: input.localUri ?? null,
    notes: input.notes ?? null,
    localOnly: true,
    storagePath: null,
    faceRegionRedacted: false,
    isEncrypted: true,
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
  await persist(items.filter((p) => p.id !== id));
  // Best-effort delete of any mirrored metadata row.
  try {
    await supabase.from('photos').delete().eq('id', id);
  } catch {
    /* best-effort */
  }
}

/** Make `id` the reference for its series (docs/06 §3 — re-set baseline). */
export async function setReference(id: string): Promise<void> {
  const items = await loadPhotos();
  const target = items.find((p) => p.id === id);
  if (!target) return;
  await persist(
    items.map((p) =>
      p.series === target.series ? { ...p, isReference: p.id === id } : p,
    ),
  );
}

/** Test/seed reset. */
export async function clearPhotos(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
