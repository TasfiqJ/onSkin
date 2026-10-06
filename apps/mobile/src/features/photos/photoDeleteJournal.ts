import { getPrivateItem, setPrivateItem } from '@/lib/storage/privateKV';
import type { HealthDataWriteOperationLease } from '@/lib/consent/healthDataWriteAdmission';

/** Photo-only write-ahead journal. Both local recovery and remote intent are
 * committed here before quarantine; the protected photo metadata write is the
 * commit point. No image, note, or path is ever included in the replay payload. */
export const PHOTO_DELETE_JOURNAL_KEY = 'layerwell.photos.deleteJournal.v1';
export const PHOTO_DELETE_JOURNAL_INVALID = 'PHOTO_DELETE_JOURNAL_INVALID';
export const PHOTO_DELETE_JOURNAL_FULL = 'PHOTO_DELETE_JOURNAL_FULL';
export const MAX_PHOTO_DELETE_COMMANDS = 128;
const MAX_JOURNAL_CHARS = 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PhotoDeleteCommand = Readonly<{
  operationId: string;
  photoId: string;
  ownerUserId: string;
  epoch: number;
  phase: 'prepared' | 'metadata_committed';
  remotePending: boolean;
  needsAttention: boolean;
  files: readonly string[];
}>;

const listeners = new Set<() => void>();

export function subscribePhotoDeleteChanges(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Shared photo-only publication signal; never emit from a stale lease. */
export function notifyPhotoDeleteChanges(lease: HealthDataWriteOperationLease): void {
  lease.assertCurrent();
  for (const listener of listeners) {
    try { listener(); } catch { /* subscriber failure cannot change durability */ }
  }
}

export function isRemotePhotoDeleteId(value: string): boolean {
  return UUID.test(value);
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return (
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
  );
}

function boundedText(value: unknown, max: number): value is string {
  return (
    typeof value === 'string' && value.length > 0 && value.length <= max && value.trim() === value
  );
}

export function decodePhotoDeleteJournal(raw: string | null): PhotoDeleteCommand[] {
  if (raw === null) return [];
  const invalid = () => new Error(PHOTO_DELETE_JOURNAL_INVALID);
  if (raw.length > MAX_JOURNAL_CHARS) throw invalid();
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw invalid();
  }
  if (
    !record(value) ||
    !exactKeys(value, ['version', 'commands']) ||
    value.version !== 1 ||
    !Array.isArray(value.commands) ||
    value.commands.length > MAX_PHOTO_DELETE_COMMANDS
  )
    throw invalid();
  const operations = new Set<string>();
  const photos = new Set<string>();
  return value.commands.map((command: unknown) => {
    if (
      !record(command) ||
      !exactKeys(command, [
        'operationId',
        'photoId',
        'ownerUserId',
        'epoch',
        'phase',
        'remotePending',
        'needsAttention',
        'files',
      ]) ||
      !boundedText(command.operationId, 36) ||
      !UUID.test(command.operationId) ||
      !boundedText(command.photoId, 256) ||
      !boundedText(command.ownerUserId, 256) ||
      !Number.isSafeInteger(command.epoch) ||
      (command.epoch as number) < 1 ||
      (command.phase !== 'prepared' && command.phase !== 'metadata_committed') ||
      typeof command.remotePending !== 'boolean' ||
      typeof command.needsAttention !== 'boolean' ||
      !Array.isArray(command.files) ||
      command.files.length > 2 ||
      !command.files.every(
        (file: unknown) => boundedText(file, 2048) && file.endsWith('.layerwellphoto'),
      ) ||
      new Set(command.files).size !== command.files.length ||
      (command.remotePending && !UUID.test(command.photoId))
    )
      throw invalid();
    const operationId = command.operationId.toLowerCase();
    const identity = JSON.stringify([command.ownerUserId, command.photoId]);
    if (operations.has(operationId) || photos.has(identity)) throw invalid();
    operations.add(operationId);
    photos.add(identity);
    return { ...command, operationId } as PhotoDeleteCommand;
  });
}

export async function readPhotoDeleteJournal(
  lease: HealthDataWriteOperationLease,
): Promise<PhotoDeleteCommand[]> {
  lease.assertCurrent();
  const raw = await getPrivateItem(PHOTO_DELETE_JOURNAL_KEY);
  lease.assertCurrent();
  const commands = decodePhotoDeleteJournal(raw);
  // A foreign or withdrawn-purpose journal is never adopted into a new owner.
  // Account/health erasure owns it; feature recovery is not an erasure bypass.
  if (
    commands.some(
      (command) => command.ownerUserId !== lease.ownerUserId || command.epoch !== lease.epoch,
    )
  ) {
    throw new Error('PHOTO_DELETE_JOURNAL_AUTHORITY_MISMATCH');
  }
  return commands;
}

export async function writePhotoDeleteJournal(
  commands: readonly PhotoDeleteCommand[],
  lease: HealthDataWriteOperationLease,
): Promise<void> {
  lease.assertCurrent();
  if (commands.length > MAX_PHOTO_DELETE_COMMANDS) throw new Error(PHOTO_DELETE_JOURNAL_FULL);
  const raw = JSON.stringify({ version: 1, commands });
  decodePhotoDeleteJournal(raw);
  if (
    commands.some(
      (command) => command.ownerUserId !== lease.ownerUserId || command.epoch !== lease.epoch,
    )
  ) {
    throw new Error('PHOTO_DELETE_JOURNAL_AUTHORITY_MISMATCH');
  }
  await setPrivateItem(PHOTO_DELETE_JOURNAL_KEY, raw);
  lease.assertCurrent();
  notifyPhotoDeleteChanges(lease);
}

export function photoDeleteReplayPayload(command: PhotoDeleteCommand) {
  if (
    command.phase !== 'metadata_committed' ||
    !command.remotePending ||
    !UUID.test(command.photoId)
  ) {
    throw new Error('PHOTO_DELETE_NOT_REPLAYABLE');
  }
  return {
    operation_id: command.operationId,
    entity_type: 'photo_delete' as const,
    entity_id: command.photoId,
    operation_kind: 'delete' as const,
    payload: null,
    client_revision: 1,
    idempotency_key: `photo_delete:${command.operationId}`,
  };
}
