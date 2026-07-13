import { randomUUID } from 'expo-crypto';

import type { PhotoSeries, TimeOfDay } from '@onskin/types';
import { PHOTO_SERIES } from '@onskin/types';

import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { captureAuthenticatedAccountOwner } from '@/lib/auth/authenticatedAccountOwner';
import {
  cleanupPlaintextStagingOperation,
  lookupPlaintextStaging,
} from '@/lib/storage/plaintextStaging';
import { getPrivateItem, setPrivateItem } from '@/lib/storage/privateKV';
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
  photoEncryptionInfo,
  PHOTO_RECOVERY_CANDIDATE_UNAUTHENTICATED,
  recoverPreparedEncryptedPhoto,
  stageEncryptedPhotoDeletions,
  verifyEncryptedPhotoDeletionSources,
} from './encryptedStorage';
import {
  decodePhotoStore,
  encodePhotoStore,
  PHOTO_METADATA_INVALID,
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
const PHOTO_MUTATION_CAPTURE_SESSION_REQUIRED = 'PHOTO_MUTATION_CAPTURE_SESSION_REQUIRED';
const PHOTO_MUTATION_SOURCE_MISSING = 'PHOTO_MUTATION_SOURCE_MISSING';
const PHOTO_METADATA_COMMIT_UNCERTAIN = 'PHOTO_METADATA_COMMIT_UNCERTAIN';

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
    isEncrypted: encrypted || booleanOr(value.isEncrypted, false),
    encryptedLocalUri,
    thumbnailLocalUri: stringOrNull(value.thumbnailLocalUri),
    encryptionVersion:
      stringOrNull(value.encryptionVersion) ?? (encrypted ? photoEncryptionInfo.version : 'none'),
    keyId: stringOrNull(value.keyId) ?? (encrypted ? photoEncryptionInfo.keyId : null),
  };
}

async function normalizeStoredRecords(value: readonly unknown[]): Promise<PhotoRecord[]> {
  const items: PhotoRecord[] = [];
  for (const row of value) {
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
  const items = await normalizeStoredRecords(decoded.items);
  const retainedItems = await normalizeStoredRecords(decoded.retainedItems);
  const snapshot: PhotoStoreSnapshot = {
    items,
    mutation: decoded.mutation,
    retainedItems,
    storedItems: decoded.items,
    storedRetainedItems: decoded.retainedItems,
  };
  assertMutationConsistency(snapshot);
  return snapshot;
}

async function readPhotosUnlocked(): Promise<PhotoStoreSnapshot> {
  return normalizeDecodedPhotoStore(decodePhotoStore(await getPrivateItem(KEY)));
}

async function encodeStoredRecords(items: readonly PhotoRecord[]): Promise<StoredPhotoRecord[]> {
  return Promise.all(
    items.map(async (item) => ({
      ...item,
      notes: null,
      notesCiphertext: await encryptPhotoNote(item.notes),
    })),
  );
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

export async function loadPhotos(): Promise<PhotoRecord[]> {
  // Queue behind mutations but never recover, rewrite, move, or delete. A V2
  // journal means metadata is intentionally staged and must not be published.
  return runPhotoStoreMutation(async () => {
    const snapshot = await readPhotosUnlocked();
    if (snapshot.mutation) throw new Error(PHOTO_MUTATION_RECOVERY_REQUIRED);
    return snapshot.items;
  });
}

export async function addPhoto(input: NewPhoto): Promise<PhotoRecord> {
  return runPhotoStoreMutation(async () => {
    const items = await loadPhotosForMutationUnlocked();
    const committedCapture = input.captureSessionId
      ? items.find((photo) => photo.captureSessionId === input.captureSessionId)
      : undefined;
    if (committedCapture) {
      if (input.captureSessionId) {
        await cleanupPlaintextStagingOperation(input.captureSessionId, 'photo_capture_jpeg');
      }
      return committedCapture;
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
    return rec;
  });
}

export async function updatePhoto(
  id: string,
  patch: Partial<Pick<PhotoRecord, 'notes' | 'timeOfDay' | 'faceRegionRedacted'>>,
): Promise<void> {
  await runPhotoStoreMutation(async () => {
    const items = await loadPhotosForMutationUnlocked();
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) return;
    const current = items[index]!;
    const next = { ...current, ...patch };
    if (
      current.notes === next.notes &&
      current.timeOfDay === next.timeOfDay &&
      current.faceRegionRedacted === next.faceRegionRedacted
    ) {
      return;
    }
    await writeSettledItems(items.map((item, itemIndex) => (itemIndex === index ? next : item)));
  });
}

export async function removePhoto(id: string): Promise<void> {
  await runAccountGenerationOperation(async (lease) => {
    const removed = await runPhotoStoreMutation(async () => {
      const items = await loadPhotosForMutationUnlocked();
      const targetIndex = items.findIndex((item) => item.id === id);
      if (targetIndex < 0) return false;
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
    const target = items.find((item) => item.id === id);
    if (!target) return;
    if (
      target.isReference &&
      items.every((item) => item.series !== target.series || item.isReference === (item.id === id))
    ) {
      return;
    }
    await writeSettledItems(
      items.map((item) =>
        item.series === target.series ? { ...item, isReference: item.id === id } : item,
      ),
    );
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
