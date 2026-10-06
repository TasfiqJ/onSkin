import { randomUUID } from 'expo-crypto';

import type { PhotoSeries, TimeOfDay } from '@layerwell/types';
import { PHOTO_SERIES } from '@layerwell/types';

import { supabase } from '@/lib/supabase/client';
import {
  captureHealthDataWriteLease,
  assertHealthDataWriteLease,
} from '@/lib/consent/healthDataWriteAdmission';
import {
  isRemotePhotoDeleteId,
  readPhotoDeleteJournal,
  writePhotoDeleteJournal,
  photoDeleteReplayPayload,
  MAX_PHOTO_DELETE_COMMANDS,
  PHOTO_DELETE_JOURNAL_FULL,
  type PhotoDeleteCommand,
} from './photoDeleteJournal';
import { runPhotoDeleteRetrySingleFlight, type PhotoDeleteRetryPromiseRef } from './photoDeleteRetrySingleFlight';
import {
  capturePhotoDeleteReplayAuthority,
  PhotoDeleteReplayRetiredError,
  readPhotoDeleteRemoteObligations,
  reservePhotoDeleteRemoteObligation,
  settlePhotoDeleteRemoteObligation,
  erasePhotoDeleteRemoteCleanupForBinding,
} from './photoDeleteRemoteCleanup';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { readLocalDataOwnerProofBinding } from '@/lib/auth/sessionOwner';
import {
  HEALTH_DATA_WRITE_ADMISSION_CLOSED,
  runHealthDataWriteOperation,
  type HealthDataWriteOperationLease,
} from '@/lib/consent/healthDataWriteAdmission';
import { activeHealthProcessingOwnerUserId, subscribeActiveHealthProcessingLeaseChanges } from '@/lib/consent/healthProcessingEpoch';
import { getPrivateItem, removePrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

import { assertProgressCaptureAuthorityCurrent } from './progressCaptureAuthority';
import { trustedProgressCaptureSessionId } from './progressCapturePrivacy';

import {
  decryptPhotoNote,
  beginPhotoRenditionPublication,
  canonicalPhotoRenditionUri,
  clearEncryptedPhotoStorage,
  deleteCapturedPhotoSource,
  encryptPhotoRendition,
  encryptPhotoNote,
  isEncryptedPhotoUri,
  markPhotoRenditionPublication,
  photoEncryptionInfo,
  quarantineEncryptedPhoto,
  reconcileEncryptedPhotoStorage,
  recoverPhotoRenditionPublication,
  settlePhotoRenditionPublication,
  settlePhotoDeleteFiles,
} from './encryptedStorage';
import { createEncryptedPhotoThumbnail } from './photoThumbnail';
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
export const PHOTO_NOT_FOUND = 'PHOTO_NOT_FOUND';
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
  sourceCleanupPending: boolean;
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
  const encryptionVersion = stringOrNull(value.encryptionVersion);
  const thumbnailLocalUri = stringOrNull(value.thumbnailLocalUri);
  if (encryptionVersion === 'xchacha20poly1305:photo-rendition:v1') {
    let expectedOriginal: string;
    let expectedThumbnail: string;
    try {
      expectedOriginal = canonicalPhotoRenditionUri({ photoId: id, captureSessionId, rendition: 'original' });
      expectedThumbnail = canonicalPhotoRenditionUri({ photoId: id, captureSessionId, rendition: 'thumbnail' });
    } catch {
      throw new Error(PHOTO_METADATA_INVALID);
    }
    if (encryptedLocalUri !== expectedOriginal || localUri !== expectedOriginal ||
        thumbnailLocalUri !== expectedThumbnail) {
      throw new Error(PHOTO_METADATA_INVALID);
    }
  }
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
    thumbnailLocalUri,
    encryptionVersion:
      encryptionVersion ?? (encrypted ? photoEncryptionInfo.version : 'none'),
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

async function loadPhotosUnlocked(guard: HealthDataWriteOperationLease): Promise<PhotoRecord[]> {
  guard.assertCurrent();
  const raw = await getPrivateItem(KEY);
  guard.assertCurrent();
  if (raw === null) {
    await recoverPhotoDeletesUnlocked([], guard);
    guard.assertCurrent();
    await recoverPhotoRenditionPublication(new Set());
    guard.assertCurrent();
    guard.assertCurrent();
    await reconcileEncryptedPhotoStorage([], { removeUnreferencedFinals: false });
    guard.assertCurrent();
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    await recoverPhotoRenditionPublication(null);
    throw new Error(PHOTO_METADATA_INVALID);
  }
  const normalized = await normalizeStoredRecords(parsed, guard);
  guard.assertCurrent();
  if (!normalized) throw new Error(PHOTO_METADATA_INVALID);
  await recoverPhotoDeletesUnlocked(normalized, guard);
  guard.assertCurrent();
  await reconcileEncryptedPhotoStorage(
    normalized.flatMap((photo) =>
      [photo.encryptedLocalUri ?? photo.localUri, photo.thumbnailLocalUri].filter(
        (uri): uri is string => Boolean(uri && isEncryptedPhotoUri(uri)),
      ),
    ),
  );
  guard.assertCurrent();
  await recoverPhotoRenditionPublication(new Set(normalized.map((photo) => photo.id)));
  guard.assertCurrent();
  return normalized;
}

export async function loadPhotos(): Promise<PhotoRecord[]> {
  return runPhotoStoreMutation(loadPhotosUnlocked);
}

export type PhotoDeleteStatus = Readonly<{
  localPending: number;
  remotePending: number;
  needsAttention: boolean;
}>;

export type RemovePhotoOutcome = Readonly<{
  localDeleted: true;
  cleanupPending: boolean;
  remotePending: boolean;
}>;

/** Only called while holding the existing photo mutation queue. A prepared
 * command plus a still-present metadata row rolls back. An absent row is the
 * durable commit point, even if the original write acknowledgement was lost. */
async function recoverPhotoDeletesUnlocked(
  items: PhotoRecord[],
  lease: HealthDataWriteOperationLease,
): Promise<void> {
  let commands = await readPhotoDeleteJournal(lease);
  for (const original of [...commands]) {
    lease.assertCurrent();
    const present = items.some((photo) => photo.id === original.photoId);
    if (present && original.phase === 'metadata_committed') {
      throw new Error('PHOTO_DELETE_JOURNAL_INCONSISTENT');
    }
    if (present) {
      await settlePhotoDeleteFiles(original.files, original.operationId, true, lease);
      lease.assertCurrent();
      if (original.remotePending) await settlePhotoDeleteRemoteObligation(original.operationId, 'remove', lease);
      commands = commands.filter((command) => command.operationId !== original.operationId);
      await writePhotoDeleteJournal(commands, lease);
      continue;
    }
    if (original.remotePending) {
      // Also admits pre-R3 pending journals without discarding their remote intent.
      await reservePhotoDeleteRemoteObligation(original, lease, true);
    }
    let command: PhotoDeleteCommand = { ...original, phase: 'metadata_committed' };
    if (original.phase !== command.phase) {
      commands = commands.map((entry) => entry.operationId === command.operationId ? command : entry);
      await writePhotoDeleteJournal(commands, lease);
    }
    try {
      await settlePhotoDeleteFiles(command.files, command.operationId, false, lease);
      lease.assertCurrent();
      command = { ...command, files: [] };
    } catch {
      // The metadata deletion already committed. Keep exact encrypted paths
      // for explicit/foreground retry, without restoring or hiding the failure.
      lease.assertCurrent();
    }
    const remaining = command.remotePending || command.files.length > 0;
    const next = commands.flatMap((entry) => entry.operationId === command.operationId
      ? remaining ? [command] : [] : [entry]);
    if (JSON.stringify(next) !== JSON.stringify(commands)) {
      await writePhotoDeleteJournal(next, lease);
      commands = next;
    }
  }
}

export function getPhotoDeleteStatus(): Promise<PhotoDeleteStatus> {
  return runPhotoStoreMutation(async (lease) => {
    const commands = await readPhotoDeleteJournal(lease);
    const obligations = await readPhotoDeleteRemoteObligations(lease);
    const remoteIds = new Set([
      ...commands.filter(command => command.remotePending).map(command => command.operationId),
      ...obligations.map(operation => operation.operationId),
    ]);
    return {
      localPending: commands.filter((command) => command.phase === 'prepared' || command.files.length > 0).length +
        obligations.filter(operation => operation.phase === 'reserved' && !commands.some(command => command.operationId === operation.operationId)).length,
      remotePending: remoteIds.size,
      needsAttention: commands.some((command) => command.needsAttention) || obligations.some(operation => operation.needsAttention),
    };
  });
}

let replayFlight: { key: string; ref: PhotoDeleteRetryPromiseRef; isCurrent?: () => boolean } | null = null;

/** Replays only metadata tombstones accepted under the authenticated owner.
 * The network await never holds the local photo queue. Retry preserves the same
 * operation UUID through offline failures, response loss, and process restart. */
export function retryPhotoDeletes(authenticatedOwnerUserId: string | null, manual = true): Promise<void> {
  let captured;
  try { captured = captureHealthDataWriteLease(); } catch (error) { return Promise.reject(error); }
  const key = JSON.stringify([captured.ownerUserId, captured.generation, captured.epoch, captured.accountGeneration]);
  if (replayFlight?.key !== key || replayFlight.isCurrent?.() === false) {
    replayFlight = { key, ref: { current: null } };
  }
  const flight = replayFlight;
  return runPhotoDeleteRetrySingleFlight(flight.ref, () => runCurrentHealthDataOperation(async (healthLease) => {
    assertHealthDataWriteLease(captured);
    const batch = await capturePhotoDeleteReplayAuthority(healthLease);
    flight.isCurrent = batch.isCurrent;
    // Preserve the exact account/health lease and add this batch's retirement
    // check to every existing queue/read/write guard, including late settlement.
    const lease: HealthDataWriteOperationLease = { ...healthLease, assertCurrent: batch.assertCurrent };
    lease.assertCurrent();
    const commands = await queuePhotoStoreMutation(lease, async () => {
      const journal = await readPhotoDeleteJournal(lease);
      const saved = authenticatedOwnerUserId === lease.ownerUserId
        ? await readPhotoDeleteRemoteObligations(lease) : [];
      if (journal.length === 0 && saved.length === 0) return [];
      const items = await loadPhotosUnlocked(lease);
      const obligations = await readPhotoDeleteRemoteObligations(lease);
      const ready = [];
      for (const obligation of obligations) {
        if (items.some(photo => photo.id === obligation.photoId)) {
          // Reservation/crash before local commit: an authoritative remaining
          // row means this deletion never committed. Cancel, do not dispatch.
          await settlePhotoDeleteRemoteObligation(obligation.operationId, 'remove', lease);
        } else {
          await reservePhotoDeleteRemoteObligation(obligation, lease, true);
          ready.push(obligation);
        }
      }
      return ready;
    });
    lease.assertCurrent();
    if (authenticatedOwnerUserId === null) return;
    if (authenticatedOwnerUserId !== lease.ownerUserId) throw new Error('PHOTO_DELETE_OWNER_MISMATCH');
    for (const command of commands) {
      lease.assertCurrent();
      // A copied batch is not durable dispatch authority. Verify exact current
      // membership/phase, then fence the await-to-invocation gap synchronously.
      const live = (await readPhotoDeleteRemoteObligations(lease)).find(operation =>
        operation.operationId === command.operationId && operation.photoId === command.photoId &&
        operation.phase === 'committed');
      lease.assertCurrent();
      if (!live || (live.needsAttention && !manual)) continue;
      // Deletion is a privacy-reducing RPC, not a new global health admission
      // lane. Link dispatch cancellation to this exact existing health lease.
      const controller = new AbortController();
      const abort = () => controller.abort();
      const unsubscribeRetirement = batch.subscribeRetirement(abort);
      const unsubscribe = subscribeActiveHealthProcessingLeaseChanges(() => {
        try { lease.assertCurrent(); } catch { abort(); }
      });
      lease.signal.addEventListener('abort', abort, { once: true });
      const timeout = setTimeout(abort, 15_000);
      let response;
      try {
        lease.assertCurrent();
        response = await supabase.rpc('apply_photo_delete_outbox_batch', {
          p_operations: [photoDeleteReplayPayload({
            ...command, ownerUserId: lease.ownerUserId, epoch: lease.epoch,
            phase: 'metadata_committed', remotePending: true, files: [],
          })],
        }).abortSignal(controller.signal);
      } catch (error) {
        // A late network failure belongs to the retired batch too, not to a
        // fresh same-owner grant that happens to retain the base-health lease.
        lease.assertCurrent();
        throw error;
      } finally {
        clearTimeout(timeout);
        unsubscribe();
        unsubscribeRetirement();
        lease.signal.removeEventListener('abort', abort);
      }
      const { data, error } = response;
      lease.assertCurrent();
      if (error) throw new Error('PHOTO_DELETE_REMOTE_UNAVAILABLE');
      const result: unknown = data;
      if (!Array.isArray(result) || result.length !== 1 || !isRecord(result[0]) ||
          Object.keys(result[0]).sort().join(',') !== 'error_class,operation_id,status' ||
          result[0].operation_id !== command.operationId ||
          !['applied', 'duplicate', 'permanent'].includes(String(result[0].status)) ||
          (result[0].status !== 'permanent' && result[0].error_class !== null)) {
        throw new Error('PHOTO_DELETE_REMOTE_RESULT_INVALID');
      }
      const terminal = result[0].status === 'applied' || result[0].status === 'duplicate';
      await queuePhotoStoreMutation(lease, async () => {
        const current = await readPhotoDeleteJournal(lease);
        lease.assertCurrent();
        const next = current.flatMap((entry) => {
          if (entry.operationId !== command.operationId) return [entry];
          if (terminal && entry.files.length === 0) return [];
          return [{ ...entry, remotePending: !terminal, needsAttention: !terminal }];
        });
        if (JSON.stringify(next) !== JSON.stringify(current)) await writePhotoDeleteJournal(next, lease);
        // A durable local acknowledgement precedes vault removal. Response loss
        // or a failed write retains the same operation for idempotent replay.
        await settlePhotoDeleteRemoteObligation(command.operationId, terminal ? 'remove' : 'attention', lease);
      });
    }
  }).catch(error => {
    // Purpose cleanup superseded this work. It is not a successful remote
    // acknowledgement, and it must not publish an error into a successor era.
    if (!(error instanceof PhotoDeleteReplayRetiredError)) throw error;
  }));
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

async function quarantinePhotoFiles(
  uris: readonly string[],
  operationId: string,
  guard: PhotoOperationGuard,
): Promise<void> {
  for (const uri of new Set(uris)) {
    guard.assertCurrent();
    await quarantineEncryptedPhoto(uri, operationId, guard);
    guard.assertCurrent();
  }
  // The durable delete journal, not a newly captured lease, owns rollback.
  // In particular, no cleanup or restoration runs after authority is lost.
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
    const requestedCaptureSessionId = input.captureSessionId;
    const captureSessionId =
      requestedCaptureSessionId == null
        ? null
        : trustedProgressCaptureSessionId(requestedCaptureSessionId);
    if (requestedCaptureSessionId != null && captureSessionId === null) {
      throw new Error(PHOTO_CAPTURE_SESSION_INVALID);
    }
    if (captureSessionId !== null) assertProgressCaptureAuthorityCurrent(captureSessionId);

    const items = await loadPhotosUnlocked(lease);
    lease.assertCurrent();
    if (captureSessionId !== null) assertProgressCaptureAuthorityCurrent(captureSessionId);
    const sourceNeedsCleanup = Boolean(input.localUri && !isEncryptedPhotoUri(input.localUri));
    const assertCaptureCurrent = () => {
      lease.assertCurrent();
      if (captureSessionId !== null) assertProgressCaptureAuthorityCurrent(captureSessionId);
    };

    if (captureSessionId !== null) {
      const replays = items.filter((photo) => photo.captureSessionId === captureSessionId);
      if (replays.length > 1) throw new Error(PHOTO_CAPTURE_SESSION_DUPLICATE);
      const replay = replays[0];
      if (replay !== undefined) {
        if (!captureReplayMatches(replay, input)) {
          throw new Error(PHOTO_CAPTURE_SESSION_CONFLICT);
        }
        let sourceCleanupPending = false;
        if (sourceNeedsCleanup) {
          try {
            assertCaptureCurrent();
            await deleteCapturedPhotoSource(input.localUri);
            assertCaptureCurrent();
          } catch {
            // A filesystem failure is recoverable under the same capture
            // authority. A changed owner/grant must still reject the replay.
            assertCaptureCurrent();
            sourceCleanupPending = true;
          }
        }
        return { photo: replay, createdNow: false, sourceCleanupPending };
      }
    }

    const series = input.series ?? 'front';
    const hasReference = items.some((p) => p.series === series);
    const id = randomUUID();
    assertCaptureCurrent();
    let thumbnail: Awaited<ReturnType<typeof createEncryptedPhotoThumbnail>> | null = null;
    let encrypted: Awaited<ReturnType<typeof encryptPhotoRendition>> | null = null;
    const publicationIdentity = { photoId: id, captureSessionId };
    if (sourceNeedsCleanup) {
      await beginPhotoRenditionPublication(publicationIdentity, input.localUri!);
      assertCaptureCurrent();
    }
    try {
      encrypted =
        input.localUri && !isEncryptedPhotoUri(input.localUri)
          ? await encryptPhotoRendition(input.localUri, {
              photoId: id,
              captureSessionId,
              rendition: 'original',
            })
          : input.localUri && isEncryptedPhotoUri(input.localUri)
            ? {
                encryptedLocalUri: input.localUri,
                keyId: photoEncryptionInfo.keyId,
                encryptionVersion: photoEncryptionInfo.version,
              }
            : null;
      if (sourceNeedsCleanup) {
        await markPhotoRenditionPublication(publicationIdentity, 'original_adopted');
      }
      if (input.localUri && !isEncryptedPhotoUri(input.localUri)) {
        thumbnail = await createEncryptedPhotoThumbnail({
          sourceUri: input.localUri,
          photoId: id,
          captureSessionId,
        });
        await markPhotoRenditionPublication(publicationIdentity, 'pair_adopted');
      }
    } catch (error) {
      try {
        assertCaptureCurrent();
      } catch (authorityError) {
        // The encrypted publication belongs to the ended authority window.
        // Its journal/account cleanup owns encrypted bytes; remove only the
        // disposable raw camera source without reading it.
        if (sourceNeedsCleanup) {
          await deleteCapturedPhotoSource(input.localUri).catch(() => undefined);
        }
        throw authorityError;
      }
      if (sourceNeedsCleanup) await recoverPhotoRenditionPublication(new Set());
      throw error;
    }
    try {
      assertCaptureCurrent();
    } catch (authorityError) {
      if (sourceNeedsCleanup) {
        await deleteCapturedPhotoSource(input.localUri).catch(() => undefined);
      }
      throw authorityError;
    }

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
      thumbnailLocalUri: thumbnail?.encryptedLocalUri ?? null,
      encryptionVersion: encrypted?.encryptionVersion ?? 'none',
      keyId: encrypted?.keyId ?? null,
    };
    try {
      await persist([rec, ...items], lease);
      if (sourceNeedsCleanup) {
        await markPhotoRenditionPublication(publicationIdentity, 'metadata_committed');
      }
    } catch (error) {
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
    let sourceCleanupPending = false;
    if (sourceNeedsCleanup) {
      try {
        await deleteCapturedPhotoSource(input.localUri);
        await markPhotoRenditionPublication(publicationIdentity, 'raw_cleaned');
        await settlePhotoRenditionPublication(publicationIdentity);
      } catch {
        // Metadata is already committed. Do not turn a post-commit raw/journal
        // cleanup problem into a false "photo not saved" result.
        assertCaptureCurrent();
        sourceCleanupPending = true;
      }
    }
    assertCaptureCurrent();
    return { photo: rec, createdNow: true, sourceCleanupPending };
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
    if (!items.some((photo) => photo.id === id)) throw new Error(PHOTO_NOT_FOUND);
    await persist(
      items.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      lease,
    );
  });
}

export async function removePhoto(
  id: string,
  authenticatedOwnerUserId: string | null = null,
): Promise<RemovePhotoOutcome> {
  return runPhotoStoreMutation(async (lease) => {
    if (authenticatedOwnerUserId !== null && authenticatedOwnerUserId !== lease.ownerUserId) {
      throw new Error('PHOTO_DELETE_OWNER_MISMATCH');
    }
    const items = await loadPhotosUnlocked(lease);
    const target = items.find((photo) => photo.id === id);
    if (target) {
      const commands = await readPhotoDeleteJournal(lease);
      if (commands.length >= MAX_PHOTO_DELETE_COMMANDS) throw new Error(PHOTO_DELETE_JOURNAL_FULL);
      const command: PhotoDeleteCommand = {
        operationId: randomUUID(),
        photoId: id,
        ownerUserId: lease.ownerUserId,
        epoch: lease.epoch,
        phase: 'prepared',
        remotePending: authenticatedOwnerUserId !== null && isRemotePhotoDeleteId(id),
        needsAttention: false,
        files: [...new Set([target.encryptedLocalUri ?? target.localUri, target.thumbnailLocalUri]
          .filter((uri): uri is string => Boolean(uri && isEncryptedPhotoUri(uri))))],
      };
      // Reserve the minimal independent obligation first: sign-out may erase
      // the health journal but must never orphan a committed remote deletion.
      if (command.remotePending) await reservePhotoDeleteRemoteObligation(command, lease);
      // Atomic durable recovery + remote intent precedes every file move.
      await writePhotoDeleteJournal([...commands, command], lease);
      try {
        await quarantinePhotoFiles([...command.files], command.operationId, lease);
        await persist(items.filter((photo) => photo.id !== id), lease);
      } catch (error) {
        lease.assertCurrent();
        // Never restore based on an exception alone: storage may have committed
        // before rejecting. Read the protected metadata commit point first.
        const raw = await getPrivateItem(KEY);
        lease.assertCurrent();
        let parsed: unknown;
        try { parsed = raw === null ? [] : JSON.parse(raw) as unknown; }
        catch { throw new Error(PHOTO_METADATA_INVALID); }
        const persisted = await normalizeStoredRecords(parsed, lease);
        if (persisted === null) throw new Error(PHOTO_METADATA_INVALID);
        await recoverPhotoDeletesUnlocked(persisted, lease);
        if (persisted.some((photo) => photo.id === id)) throw error;
      }
      await recoverPhotoDeletesUnlocked(items.filter((photo) => photo.id !== id), lease);
    }
    const pending = (await readPhotoDeleteJournal(lease)).find((command) => command.photoId === id);
    return { localDeleted: true, cleanupPending: Boolean(pending?.files.length), remotePending: pending?.remotePending ?? false };
  });
}

/** Make `id` the reference for its series. */
export async function setReference(id: string): Promise<void> {
  await runPhotoStoreMutation(async (lease) => {
    const items = await loadPhotosUnlocked(lease);
    const target = items.find((p) => p.id === id);
    if (!target) throw new Error(PHOTO_NOT_FOUND);
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
    // Photo-purpose closure supersedes per-photo server cleanup. Resolve the
    // canonical owner under the existing account/serialized-photo boundary;
    // no active health grant or later owner's lease is needed for erasure.
    const ownerBinding = await readLocalDataOwnerProofBinding();
    guard.assertCurrent();
    const results = await Promise.allSettled([
      removePrivateItem(KEY),
      clearEncryptedPhotoStorage(),
      ownerBinding === null ? Promise.resolve() : erasePhotoDeleteRemoteCleanupForBinding(ownerBinding),
    ]);
    guard.assertCurrent();
    const failures = results.filter((result) => result.status === 'rejected');
    if (failures.length > 0) throw new Error(`PHOTO_CLEAR_FAILED:${failures.length}`);
  });
}
