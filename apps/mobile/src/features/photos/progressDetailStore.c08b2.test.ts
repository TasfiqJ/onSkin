import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  runAccountGenerationOperation,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';
import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';
import {
  decodePhotoDeleteJournal,
  PHOTO_DELETE_JOURNAL_KEY,
  type PhotoDeleteCommand,
} from './photoDeleteJournal';
import {
  getPhotoDeleteStatus,
  loadPhotos,
  removePhoto,
  retryPhotoDeletes,
  setReference,
  updatePhoto,
} from './store';


const remoteCleanupPorts = vi.hoisted(() => ({ storage: new Map<string, string>(), secure: new Map<string, string>() }));
vi.mock('react-native-get-random-values', () => ({}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (key: string) => remoteCleanupPorts.storage.get(key) ?? null,
  setItem: async (key: string, value: string) => { remoteCleanupPorts.storage.set(key, value); },
  removeItem: async (key: string) => { remoteCleanupPorts.storage.delete(key); },
} }));
vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'when-unlocked-this-device-only',
  getItemAsync: async (key: string) => remoteCleanupPorts.secure.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => { remoteCleanupPorts.secure.set(key, value); },
  deleteItemAsync: async (key: string) => { remoteCleanupPorts.secure.delete(key); },
}));
vi.mock('@/lib/auth/sessionOwner', () => ({
  localDataOwnerBinding: async (owner: string) => createHash('sha256').update('layerwell:local-data-owner:v1:' + owner).digest('hex'),
}));
beforeEach(() => { remoteCleanupPorts.storage.clear(); remoteCleanupPorts.secure.clear(); });

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  files: new Set<string>(),
  failFiles: new Set<string>(),
  events: [] as string[],
  sequence: 0,
  beforeWrite: null as ((key: string, value: string) => void | Promise<void>) | null,
  afterWrite: null as ((key: string, value: string) => void | Promise<void>) | null,
  readFailure: null as string | null,
  quarantineGate: null as Promise<void> | null,
  quarantineStarted: null as (() => void) | null,
  signals: [] as AbortSignal[],
  remote:
    vi.fn<
      (
        operations: Record<string, unknown>[],
        signal: AbortSignal,
      ) => Promise<{ data: unknown; error: unknown }>
    >(),
  from: vi.fn(),
}));
vi.mock('expo-crypto', () => ({
  randomUUID: () => `aaaaaaaa-aaaa-4aaa-8aaa-${(++mocks.sequence).toString(16).padStart(12, '0')}`,
}));
vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: async (key: string) => {
    if (mocks.readFailure === key) throw new Error('READ_FAILED');
    return mocks.storage.get(key) ?? null;
  },
  setPrivateItem: async (key: string, value: string) => {
    mocks.events.push(`write:${key}`);
    await mocks.beforeWrite?.(key, value);
    mocks.storage.set(key, value);
    await mocks.afterWrite?.(key, value);
  },
  removePrivateItem: async (key: string) => {
    mocks.storage.delete(key);
  },
}));
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: mocks.from,
    rpc: (_name: string, args: { p_operations: Record<string, unknown>[] }) => ({
      abortSignal: (signal: AbortSignal) => {
        mocks.signals.push(signal);
        return mocks.remote(args.p_operations, signal);
      },
    }),
  },
}));
vi.mock('./photoThumbnail', () => ({ createEncryptedPhotoThumbnail: vi.fn() }));
vi.mock('./encryptedStorage', () => ({
  beginPhotoRenditionPublication: vi.fn(),
  canonicalPhotoRenditionUri: vi.fn(),
  clearEncryptedPhotoStorage: vi.fn(),
  deleteCapturedPhotoSource: vi.fn(),
  encryptCapturedPhoto: vi.fn(),
  encryptPhotoRendition: vi.fn(),
  markPhotoRenditionPublication: vi.fn(),
  settlePhotoRenditionPublication: vi.fn(),
  recoverPhotoRenditionPublication: vi.fn(async () => undefined),
  reconcileEncryptedPhotoStorage: vi.fn(async () => undefined),
  encryptPhotoNote: async (value: string | null) =>
    value === null ? null : `cipher:${Buffer.from(value).toString('base64')}`,
  decryptPhotoNote: async (value: string) => Buffer.from(value.slice(7), 'base64').toString(),
  isPhotoEncryptionReadError: () => false,
  isEncryptedPhotoUri: (uri: string | null) => Boolean(uri?.endsWith('.layerwellphoto')),
  deleteEncryptedPhoto: async (uri: string) => {
    mocks.files.delete(uri);
  },
  photoEncryptionInfo: { keyId: 'key', version: 'xchacha20poly1305:v1' },
  quarantineEncryptedPhoto: async (uri: string, operationId: string) => {
    mocks.events.push(`quarantine:${uri}`);
    if (!mocks.files.has(uri)) throw new Error('FILE_MISSING');
    const quarantinedUri = `${uri}.pending-delete-${operationId}`;
    mocks.files.delete(uri);
    mocks.files.add(quarantinedUri);
    mocks.quarantineStarted?.();
    if (mocks.quarantineGate) await mocks.quarantineGate;
    return { originalUri: uri, quarantinedUri };
  },
  settlePhotoDeleteFiles: async (
    uris: string[],
    operationId: string,
    restore: boolean,
    guard: { assertCurrent: () => void },
  ) => {
    guard.assertCurrent();
    for (const uri of uris) {
      guard.assertCurrent();
      mocks.events.push(`${restore ? 'restore' : 'cleanup'}:${uri}`);
      if (mocks.failFiles.has(uri)) throw new Error('CLEANUP_FAILED');
      const quarantinedUri = `${uri}.pending-delete-${operationId}`;
      if (restore) {
        if (!mocks.files.has(uri) && !mocks.files.has(quarantinedUri))
          throw new Error('FILE_MISSING');
        mocks.files.add(uri);
      } else mocks.files.delete(uri);
      mocks.files.delete(quarantinedUri);
      guard.assertCurrent();
    }
  },
}));

const KEY = 'layerwell.photos.v1';
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const file = (id: string, thumbnail = false) =>
  `file:///sandbox/photos/v1/${id}${thumbnail ? '-thumbnail' : ''}.layerwellphoto`;
function record(id = A, series = 'front', notes = 'private draft') {
  return {
    id,
    series,
    takenLocalDate: '2026-10-05',
    notes: null,
    notesCiphertext: `cipher:${Buffer.from(notes).toString('base64')}`,
    isReference: true,
    isEncrypted: true,
    encryptedLocalUri: file(id),
    localUri: file(id),
    thumbnailLocalUri: file(id, true),
    encryptionVersion: 'xchacha20poly1305:v1',
  };
}
function seed(records = [record()]) {
  mocks.storage.set(KEY, JSON.stringify(records));
  for (const row of records) {
    mocks.files.add(row.encryptedLocalUri);
    mocks.files.add(row.thumbnailLocalUri);
  }
}
function commands() {
  return decodePhotoDeleteJournal(mocks.storage.get(PHOTO_DELETE_JOURNAL_KEY) ?? null);
}
function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function grant(ownerUserId = 'owner-a', epoch = 1) {
  const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  setActiveHealthProcessingEpoch(epoch, { ownerUserId, accountGeneration });
}
function failMetadataWrite() {
  mocks.beforeWrite = (key) => {
    if (key === KEY) {
      mocks.beforeWrite = null;
      throw new Error('METADATA_FAILED');
    }
  };
}

beforeEach(async () => {
  mocks.storage.clear();
  mocks.files.clear();
  mocks.failFiles.clear();
  mocks.events = [];
  mocks.sequence = 0;
  mocks.beforeWrite = null;
  mocks.afterWrite = null;
  mocks.readFailure = null;
  mocks.quarantineGate = null;
  mocks.quarantineStarted = null;
  mocks.signals = [];
  mocks.from.mockReset();
  mocks.remote
    .mockReset()
    .mockImplementation(async (operations) => ({
      data: operations.map((operation) => ({
        operation_id: operation.operation_id,
        status: 'applied',
        error_class: null,
      })),
      error: null,
    }));
  clearActiveHealthProcessingEpoch();
  await grant();
});
afterEach(async () => {
  clearActiveHealthProcessingEpoch();
  await waitForAccountGenerationOperationsToSettle();
});

describe.sequential('C-08B2 real store and durable photo-only outbox', () => {
  it('persists private note ciphertext and restores the intended note on a fresh read', async () => {
    seed();
    await updatePhoto(A, { notes: 'latest intended note' });
    const raw = mocks.storage.get(KEY)!;
    expect(raw).not.toContain('latest intended note');
    expect(JSON.parse(raw)[0].notes).toBeNull();
    expect((await loadPhotos())[0]?.notes).toBe('latest intended note');
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.remote).not.toHaveBeenCalled();
  });

  it('keeps failed note persistence intact and does not treat a missing target as saved', async () => {
    seed();
    const before = mocks.storage.get(KEY);
    failMetadataWrite();
    await expect(updatePhoto(A, { notes: 'unsaved' })).rejects.toThrow('METADATA_FAILED');
    expect(mocks.storage.get(KEY)).toBe(before);
    await expect(updatePhoto(B, { notes: 'not a photo' })).rejects.toThrow('PHOTO_NOT_FOUND');
  });

  it('sets exactly one reference in the current series and leaves other series unchanged', async () => {
    const C = '33333333-3333-4333-8333-333333333333';
    seed([record(A), record(B), record(C, 'left')]);
    await setReference(B);
    await setReference(B);
    const rows = await loadPhotos();
    expect(
      rows.filter((row) => row.series === 'front' && row.isReference).map((row) => row.id),
    ).toEqual([B]);
    expect(rows.find((row) => row.id === C)?.isReference).toBe(true);
    await expect(setReference('absent')).rejects.toThrow('PHOTO_NOT_FOUND');
  });

  it('does not claim a failed reference commit succeeded', async () => {
    seed([record(A), { ...record(B), isReference: false }]);
    const before = mocks.storage.get(KEY);
    failMetadataWrite();
    await expect(setReference(B)).rejects.toThrow('METADATA_FAILED');
    expect(mocks.storage.get(KEY)).toBe(before);
  });

  it('commits recovery intent before quarantine and removes the original plus thumbnail locally', async () => {
    seed();
    const result = await removePhoto(A);
    expect(result).toEqual({ localDeleted: true, cleanupPending: false, remotePending: false });
    expect(mocks.events[0]).toBe(`write:${PHOTO_DELETE_JOURNAL_KEY}`);
    expect(mocks.events.indexOf(`write:${KEY}`)).toBeGreaterThan(
      mocks.events.indexOf(`quarantine:${file(A, true)}`),
    );
    expect(await loadPhotos()).toEqual([]);
    expect(mocks.files.size).toBe(0);
    expect(commands()).toEqual([]);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.remote).not.toHaveBeenCalled();
  });

  it('restores both quarantined files after a verified failed metadata commit', async () => {
    seed();
    const before = mocks.storage.get(KEY);
    failMetadataWrite();
    await expect(removePhoto(A, 'owner-a')).rejects.toThrow('METADATA_FAILED');
    expect(mocks.storage.get(KEY)).toBe(before);
    expect([...mocks.files].sort()).toEqual([file(A), file(A, true)].sort());
    expect(commands()).toEqual([]);
    expect(mocks.remote).not.toHaveBeenCalled();
    await removePhoto(A, 'owner-a');
    expect((await loadPhotos()).length).toBe(0);
  });

  it('does not restore a metadata deletion that committed before its acknowledgement failed', async () => {
    seed();
    mocks.afterWrite = (key) => {
      if (key === KEY) {
        mocks.afterWrite = null;
        throw new Error('ACK_LOST');
      }
    };
    await expect(removePhoto(A, 'owner-a')).resolves.toMatchObject({
      localDeleted: true,
      remotePending: true,
    });
    expect(mocks.events.some((event) => event.startsWith('restore:'))).toBe(false);
    expect(await loadPhotos()).toEqual([]);
    expect(commands()[0]?.phase).toBe('metadata_committed');
  });

  it('quarantines rather than guessing when the failed metadata commit cannot be read back', async () => {
    seed();
    mocks.beforeWrite = (key) => {
      if (key === KEY) {
        mocks.beforeWrite = null;
        mocks.readFailure = KEY;
        throw new Error('METADATA_FAILED');
      }
    };
    await expect(removePhoto(A, 'owner-a')).rejects.toThrow('READ_FAILED');
    expect(mocks.events.some((event) => event.startsWith('restore:'))).toBe(false);
    expect(commands()[0]?.phase).toBe('prepared');
    mocks.readFailure = null;
    expect((await loadPhotos())[0]?.id).toBe(A);
    expect([...mocks.files].sort()).toEqual([file(A), file(A, true)].sort());
    expect(commands()).toEqual([]);
  });

  it('keeps encrypted cleanup failure visible and recoverable without republishing the photo', async () => {
    seed();
    mocks.failFiles.add(file(A, true));
    await expect(removePhoto(A)).resolves.toMatchObject({ cleanupPending: true });
    expect(await loadPhotos()).toEqual([]);
    expect(await getPhotoDeleteStatus()).toMatchObject({ localPending: 1, remotePending: 0 });
    expect(commands()[0]?.files).toEqual([file(A), file(A, true)]);
    mocks.failFiles.clear();
    await retryPhotoDeletes(null);
    expect(commands()).toEqual([]);
    expect(mocks.files.size).toBe(0);
  });

  it('serializes double delete into one durable operation', async () => {
    seed();
    await Promise.all([removePhoto(A, 'owner-a'), removePhoto(A, 'owner-a')]);
    expect(mocks.sequence).toBe(1);
    expect(commands()).toHaveLength(1);
    expect(mocks.events.filter((event) => event === `write:${KEY}`)).toHaveLength(1);
  });

  it('retains authenticated offline intent and retries only the exact content-free payload', async () => {
    seed();
    await removePhoto(A, 'owner-a');
    mocks.remote.mockRejectedValueOnce(new Error('OFFLINE'));
    await expect(retryPhotoDeletes('owner-a')).rejects.toThrow('OFFLINE');
    const operationId = commands()[0]!.operationId;
    expect(await loadPhotos()).toEqual([]);
    await retryPhotoDeletes('owner-a');
    const first = mocks.remote.mock.calls[0]![0][0]!;
    expect(first).toEqual({
      operation_id: operationId,
      entity_type: 'photo_delete',
      entity_id: A,
      operation_kind: 'delete',
      payload: null,
      client_revision: 1,
      idempotency_key: `photo_delete:${operationId}`,
    });
    expect(mocks.remote.mock.calls[1]![0]).toEqual([first]);
    expect(commands()).toEqual([]);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('response-loss replay is idempotent and cannot resurrect local metadata', async () => {
    seed();
    await removePhoto(A, 'owner-a');
    const applied = new Set<unknown>();
    mocks.remote.mockImplementation(async (operations) => {
      const id = operations[0]!.operation_id;
      if (!applied.has(id)) {
        applied.add(id);
        throw new Error('RESPONSE_LOST');
      }
      return { data: [{ operation_id: id, status: 'duplicate', error_class: null }], error: null };
    });
    await expect(retryPhotoDeletes('owner-a')).rejects.toThrow('RESPONSE_LOST');
    await retryPhotoDeletes('owner-a');
    expect(applied.size).toBe(1);
    expect(commands()).toEqual([]);
    expect(await loadPhotos()).toEqual([]);
  });

  it('joins explicit replay retries and does not hold the photo queue during a network await', async () => {
    seed([record(A), record(B)]);
    await removePhoto(A, 'owner-a');
    const gate = deferred<{ data: unknown; error: unknown }>();
    const started = deferred();
    mocks.remote.mockImplementation(() => {
      started.resolve();
      return gate.promise;
    });
    const first = retryPhotoDeletes('owner-a');
    const second = retryPhotoDeletes('owner-a');
    expect(second).toBe(first);
    await started.promise;
    await updatePhoto(B, { notes: 'not blocked by offline replay' });
    expect((await loadPhotos())[0]?.notes).toBe('not blocked by offline replay');
    const operationId = commands()[0]!.operationId;
    gate.resolve({
      data: [{ operation_id: operationId, status: 'applied', error_class: null }],
      error: null,
    });
    await first;
    expect(mocks.remote).toHaveBeenCalledTimes(1);
  });

  it('never promotes signed-out deletion into remote work after later sign-in', async () => {
    seed();
    mocks.failFiles.add(file(A));
    await removePhoto(A);
    expect(commands()[0]?.remotePending).toBe(false);
    mocks.failFiles.clear();
    await retryPhotoDeletes('owner-a');
    expect(mocks.remote).not.toHaveBeenCalled();
    expect(commands()).toEqual([]);
  });

  it('keeps authenticated legacy non-UUID deletion local-only', async () => {
    seed([record('legacy-local-photo')]);
    await removePhoto('legacy-local-photo', 'owner-a');
    await retryPhotoDeletes('owner-a');
    expect(mocks.remote).not.toHaveBeenCalled();
  });

  it('does not restore or continue old-owner deletion across an account boundary', async () => {
    seed();
    const gate = deferred();
    const started = deferred();
    mocks.quarantineGate = gate.promise;
    mocks.quarantineStarted = () => started.resolve();
    const pending = removePhoto(A, 'owner-a');
    const rejection = expect(pending).rejects.toThrow();
    await started.promise;
    beginAccountGenerationBoundary();
    gate.resolve();
    await rejection;
    await waitForAccountGenerationOperationsToSettle();
    expect(mocks.events.some((event) => event.startsWith('restore:'))).toBe(false);
    mocks.storage.clear();
    mocks.files.clear();
    endAccountGenerationBoundary();
    await grant('owner-b', 2);
    seed([record(B)]);
    const before = mocks.storage.get(KEY);
    await expect(removePhoto(A, 'owner-a')).rejects.toThrow('PHOTO_DELETE_OWNER_MISMATCH');
    expect(mocks.storage.get(KEY)).toBe(before);
    expect(mocks.remote).not.toHaveBeenCalled();
  });

  it('does not borrow a close-and-regrant health lease while deleting', async () => {
    seed();
    const gate = deferred();
    const started = deferred();
    mocks.quarantineGate = gate.promise;
    mocks.quarantineStarted = () => started.resolve();
    const pending = removePhoto(A);
    const rejection = expect(pending).rejects.toThrow();
    await started.promise;
    clearActiveHealthProcessingEpoch();
    await grant();
    gate.resolve();
    await rejection;
    expect(mocks.events.some((event) => event === `write:${KEY}`)).toBe(false);
    expect(mocks.events.some((event) => event.startsWith('restore:'))).toBe(false);
  });

  it('aborts an in-flight remote dispatch on health loss and never acknowledges into the later lease', async () => {
    seed();
    await removePhoto(A, 'owner-a');
    const gate = deferred<{ data: unknown; error: unknown }>();
    const started = deferred();
    mocks.remote.mockImplementation(() => {
      started.resolve();
      return gate.promise;
    });
    const pending = retryPhotoDeletes('owner-a');
    const rejection = expect(pending).rejects.toThrow();
    await started.promise;
    const operationId = commands()[0]!.operationId;
    clearActiveHealthProcessingEpoch();
    await grant();
    expect(mocks.signals[0]?.aborted).toBe(true);
    gate.resolve({
      data: [{ operation_id: operationId, status: 'applied', error_class: null }],
      error: null,
    });
    await rejection;
    expect(commands()).toHaveLength(1);
    expect(await loadPhotos()).toEqual([]);
  });

  it('retains permanent dispositions for visible manual recovery rather than dropping them', async () => {
    seed();
    await removePhoto(A, 'owner-a');
    mocks.remote.mockImplementation(async (operations) => ({
      data: [
        {
          operation_id: operations[0]!.operation_id,
          status: 'permanent',
          error_class: 'validation',
        },
      ],
      error: null,
    }));
    await retryPhotoDeletes('owner-a');
    expect(await getPhotoDeleteStatus()).toMatchObject({ remotePending: 1, needsAttention: true });
    await retryPhotoDeletes('owner-a', false);
    expect(mocks.remote).toHaveBeenCalledTimes(1);
    await retryPhotoDeletes('owner-a');
    expect(mocks.remote).toHaveBeenCalledTimes(2);
  });

  it.each(['foreign-id', 'malformed-success'])(
    'does not acknowledge an invalid %s RPC disposition',
    async (kind) => {
      seed();
      await removePhoto(A, 'owner-a');
      const operationId = commands()[0]!.operationId;
      mocks.remote.mockResolvedValue({
        data: [
          {
            operation_id: kind === 'foreign-id' ? B : operationId,
            status: 'applied',
            error_class: kind === 'malformed-success' ? 'validation' : null,
          },
        ],
        error: null,
      });
      await expect(retryPhotoDeletes('owner-a')).rejects.toThrow(
        'PHOTO_DELETE_REMOTE_RESULT_INVALID',
      );
      expect(commands()).toHaveLength(1);
    },
  );

  it('fails closed instead of publishing a committed deletion reinserted through stale metadata', async () => {
    seed();
    await removePhoto(A, 'owner-a');
    seed();
    await expect(loadPhotos()).rejects.toThrow('PHOTO_DELETE_JOURNAL_INCONSISTENT');
  });

  it('preserves malformed and foreign journals without metadata/file/remote mutations', async () => {
    seed();
    const before = mocks.storage.get(KEY);
    mocks.storage.set(PHOTO_DELETE_JOURNAL_KEY, '{"version":99,"commands":[]}');
    await expect(removePhoto(A, 'owner-a')).rejects.toThrow('PHOTO_DELETE_JOURNAL_INVALID');
    expect(mocks.storage.get(KEY)).toBe(before);
    expect(mocks.events).toEqual([]);
    mocks.storage.delete(PHOTO_DELETE_JOURNAL_KEY);
    await removePhoto(A, 'owner-a');
    const saved = mocks.storage.get(PHOTO_DELETE_JOURNAL_KEY);
    await grant('owner-b', 2);
    await expect(retryPhotoDeletes('owner-b')).rejects.toThrow(
      'PHOTO_DELETE_JOURNAL_AUTHORITY_MISMATCH',
    );
    expect(mocks.storage.get(PHOTO_DELETE_JOURNAL_KEY)).toBe(saved);
    expect(mocks.remote).not.toHaveBeenCalled();
  });

  it('fails before quarantine when bounded durable remote capacity is exhausted', async () => {
    seed();
    const queued: PhotoDeleteCommand[] = Array.from({ length: 128 }, (_, index) => ({
      operationId: `bbbbbbbb-bbbb-4bbb-8bbb-${index.toString(16).padStart(12, '0')}`,
      photoId: `cccccccc-cccc-4ccc-8ccc-${index.toString(16).padStart(12, '0')}`,
      ownerUserId: 'owner-a',
      epoch: 1,
      phase: 'metadata_committed',
      remotePending: true,
      needsAttention: false,
      files: [],
    }));
    mocks.storage.set(PHOTO_DELETE_JOURNAL_KEY, JSON.stringify({ version: 1, commands: queued }));
    await expect(removePhoto(A, 'owner-a')).rejects.toThrow('PHOTO_DELETE_JOURNAL_FULL');
    expect(mocks.events.some((event) => event.startsWith('quarantine:'))).toBe(false);
    expect(mocks.files.has(file(A))).toBe(true);
  });

  it('replays the same persisted tombstone through a fresh module instance', async () => {
    seed();
    await removePhoto(A, 'owner-a');
    const operationId = commands()[0]!.operationId;
    vi.resetModules();
    const freshAccount = await import('@/lib/auth/accountGeneration');
    const freshHealth = await import('@/lib/consent/healthProcessingEpoch');
    const generation = await freshAccount.runAccountGenerationOperation(
      (lease) => lease.generation,
    );
    freshHealth.setActiveHealthProcessingEpoch(1, {
      ownerUserId: 'owner-a',
      accountGeneration: generation,
    });
    const freshStore = await import('./store');
    await freshStore.retryPhotoDeletes('owner-a');
    expect(mocks.remote.mock.calls[0]![0][0]?.operation_id).toBe(operationId);
    expect(commands()).toEqual([]);
    expect(await freshStore.loadPhotos()).toEqual([]);
    freshHealth.clearActiveHealthProcessingEpoch();
  });
});
