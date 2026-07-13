import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addPhoto,
  clearPhotos,
  loadPhotos,
  PHOTO_METADATA_INVALID,
  PHOTO_METADATA_UNSUPPORTED,
  PHOTO_MUTATION_JOURNAL_INCONSISTENT,
  PHOTO_MUTATION_RECOVERY_REQUIRED,
  recoverPhotoStoreMutations,
  removePhoto,
  setReference,
  updatePhoto,
} from './store';

const KEY = 'onskin.photos.v1';
const PHOTO_DIR = 'file://document/photos/v1/';
const CAPTURE_A = 'a'.repeat(32);
const CAPTURE_B = 'b'.repeat(32);

function uuid(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

function photoUri(id: string): string {
  return `${PHOTO_DIR}${id}.onskinphoto`;
}

function thumbnailUri(id: string): string {
  return `${PHOTO_DIR}${id}-thumbnail.onskinphoto`;
}

const mocks = vi.hoisted(() => ({
  cleanupCalls: [] as string[],
  cleanupErrorOnce: null as Error | null,
  decryptPhotoNote: vi.fn(),
  deletePhoto: vi.fn(),
  deletePhotoAbortSignal: vi.fn(),
  discardPendingEncryptedPhotoForRetry: vi.fn(),
  encryptCapturedPhoto: vi.fn(),
  eqPhotoId: vi.fn(),
  eqPhotoOwner: vi.fn(),
  finalFiles: new Set<string>(),
  finalizeErrorAfterDeleteOnce: null as Error | null,
  finalizeEncryptedPhotoDeletions: vi.fn(),
  from: vi.fn(),
  getPrivateItem: vi.fn(),
  getPrivateItemError: null as Error | null,
  getUser: vi.fn(),
  lookupPlaintextStaging: vi.fn(),
  plaintext: new Map<string, string>(),
  quarantines: new Set<string>(),
  randomCounter: 1,
  randomIds: [] as string[],
  recoverPreparedEncryptedPhoto: vi.fn(),
  setFailureAfter: new Set<number>(),
  setFailureBefore: new Set<number>(),
  setPrivateItem: vi.fn(),
  stageErrorAfterMoveOnce: null as Error | null,
  stageEncryptedPhotoDeletions: vi.fn(),
  storage: new Map<string, string>(),
  verifyEncryptedPhotoDeletionSources: vi.fn(),
  writeAttempts: 0,
}));

vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => mocks.randomIds.shift() ?? uuid(mocks.randomCounter++)),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: mocks.getPrivateItem,
  setPrivateItem: mocks.setPrivateItem,
}));

vi.mock('@/lib/storage/plaintextStaging', () => ({
  lookupPlaintextStaging: mocks.lookupPlaintextStaging,
  cleanupPlaintextStagingOperation: vi.fn(async (operationId: string) => {
    mocks.cleanupCalls.push(operationId);
    if (mocks.cleanupErrorOnce) {
      const error = mocks.cleanupErrorOnce;
      mocks.cleanupErrorOnce = null;
      throw error;
    }
    mocks.plaintext.delete(operationId);
  }),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  },
}));

vi.mock('./encryptedStorage', () => ({
  PHOTO_RECOVERY_CANDIDATE_UNAUTHENTICATED: 'PHOTO_RECOVERY_CANDIDATE_UNAUTHENTICATED',
  decryptPhotoNote: mocks.decryptPhotoNote,
  discardPendingEncryptedPhotoForRetry: mocks.discardPendingEncryptedPhotoForRetry,
  encryptedPhotoUriForId: (id: string) => photoUri(id.replace(/[^A-Za-z0-9_-]/g, '') || 'photo'),
  encryptedPhotoThumbnailUriForId: (id: string) =>
    thumbnailUri(id.replace(/[^A-Za-z0-9_-]/g, '') || 'photo'),
  encryptCapturedPhoto: mocks.encryptCapturedPhoto,
  encryptPhotoNote: vi.fn(async (note: string | null) => (note ? `enc:${note}` : null)),
  finalizeEncryptedPhotoDeletions: mocks.finalizeEncryptedPhotoDeletions,
  isEncryptedPhotoUri: (uri?: string | null) => Boolean(uri?.endsWith('.onskinphoto')),
  isOwnedEncryptedPhotoUri: (uri?: string | null) =>
    Boolean(
      uri?.startsWith(PHOTO_DIR) &&
      /^[A-Za-z0-9_-]+\.onskinphoto$/.test(uri.slice(PHOTO_DIR.length)),
    ),
  photoEncryptionInfo: { keyId: 'photo-key', version: 'photo-v1' },
  recoverPreparedEncryptedPhoto: mocks.recoverPreparedEncryptedPhoto,
  stageEncryptedPhotoDeletions: mocks.stageEncryptedPhotoDeletions,
  verifyEncryptedPhotoDeletionSources: mocks.verifyEncryptedPhotoDeletionSources,
}));

type StoredEnvelope = {
  version: number;
  items: Record<string, unknown>[];
  mutation: null | { kind: 'add' | 'delete' | 'clear'; operationId: string; phase: string };
  retainedItems: Record<string, unknown>[];
};

function envelope(): StoredEnvelope {
  return JSON.parse(mocks.storage.get(KEY) ?? '{}') as StoredEnvelope;
}

function storedPhoto(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const uri = photoUri(id);
  return {
    id,
    series: 'front',
    takenLocalDate: '2026-07-01',
    takenAt: '2026-07-01T12:00:00.000Z',
    timeOfDay: null,
    alignmentScore: null,
    lightingScore: null,
    isReference: true,
    referencePhotoId: null,
    localUri: uri,
    notes: null,
    notesCiphertext: null,
    captureSessionId: null,
    headRoll: null,
    headYaw: null,
    headPitch: null,
    qualitySource: null,
    localOnly: true,
    storagePath: null,
    faceRegionRedacted: false,
    isEncrypted: true,
    encryptedLocalUri: uri,
    thumbnailLocalUri: null,
    encryptionVersion: 'photo-v1',
    keyId: 'photo-key',
    ...overrides,
  };
}

function seedSettled(items: Record<string, unknown>[]): string {
  const raw = JSON.stringify({ version: 2, items, mutation: null, retainedItems: [] });
  mocks.storage.set(KEY, raw);
  return raw;
}

function capture(operationId: string, uri = `file://cache/${operationId}.jpg`): string {
  mocks.plaintext.set(operationId, uri);
  return uri;
}

function quarantineKey(uri: string, operationId: string): string {
  return `${uri}.pending-delete-${operationId}`;
}

describe('photo local store journal', () => {
  beforeEach(() => {
    mocks.cleanupCalls = [];
    mocks.cleanupErrorOnce = null;
    mocks.decryptPhotoNote.mockReset().mockImplementation(async (value: string) => `note:${value}`);
    mocks.deletePhoto.mockReset();
    mocks.deletePhotoAbortSignal.mockReset().mockResolvedValue({ error: null });
    mocks.discardPendingEncryptedPhotoForRetry.mockReset().mockResolvedValue(true);
    mocks.encryptCapturedPhoto
      .mockReset()
      .mockImplementation(async (_source: string, id: string) => {
        const uri = photoUri(id);
        mocks.finalFiles.add(uri);
        return { encryptedLocalUri: uri, keyId: 'photo-key', encryptionVersion: 'photo-v1' };
      });
    mocks.eqPhotoId.mockReset();
    mocks.eqPhotoOwner.mockReset();
    mocks.finalFiles.clear();
    mocks.finalizeErrorAfterDeleteOnce = null;
    mocks.finalizeEncryptedPhotoDeletions
      .mockReset()
      .mockImplementation(async (uris: readonly string[], operationId: string) => {
        for (const uri of uris) {
          if (mocks.finalFiles.has(uri)) throw new Error('PHOTO_RECOVERY_CONFLICT');
          mocks.quarantines.delete(quarantineKey(uri, operationId));
        }
        if (mocks.finalizeErrorAfterDeleteOnce) {
          const error = mocks.finalizeErrorAfterDeleteOnce;
          mocks.finalizeErrorAfterDeleteOnce = null;
          throw error;
        }
      });
    mocks.from.mockReset();
    mocks.getPrivateItem.mockReset().mockImplementation(async (key: string) => {
      if (mocks.getPrivateItemError) throw mocks.getPrivateItemError;
      return mocks.storage.get(key) ?? null;
    });
    mocks.getPrivateItemError = null;
    mocks.getUser.mockReset().mockResolvedValue({
      data: { user: { id: 'owner-a' } },
      error: null,
    });
    mocks.lookupPlaintextStaging.mockReset().mockImplementation(async (operationId: string) => {
      const uri = mocks.plaintext.get(operationId);
      return uri ? { operationId, purpose: 'photo_capture_jpeg', uri } : null;
    });
    mocks.plaintext.clear();
    mocks.quarantines.clear();
    mocks.randomCounter = 1;
    mocks.randomIds = [];
    mocks.recoverPreparedEncryptedPhoto
      .mockReset()
      .mockImplementation(async (uri: string) => mocks.finalFiles.has(uri));
    mocks.setFailureAfter.clear();
    mocks.setFailureBefore.clear();
    mocks.setPrivateItem.mockReset().mockImplementation(async (key: string, value: string) => {
      const attempt = ++mocks.writeAttempts;
      if (mocks.setFailureBefore.delete(attempt)) throw new Error(`WRITE_BEFORE_${attempt}`);
      mocks.storage.set(key, value);
      if (mocks.setFailureAfter.delete(attempt)) throw new Error(`WRITE_AFTER_${attempt}`);
    });
    mocks.stageErrorAfterMoveOnce = null;
    mocks.stageEncryptedPhotoDeletions
      .mockReset()
      .mockImplementation(async (uris: readonly string[], operationId: string) => {
        for (const uri of uris) {
          const key = quarantineKey(uri, operationId);
          if (mocks.finalFiles.has(uri) && mocks.quarantines.has(key)) {
            throw new Error('PHOTO_RECOVERY_CONFLICT');
          }
          if (mocks.finalFiles.delete(uri)) mocks.quarantines.add(key);
          else if (!mocks.quarantines.has(key)) throw new Error('PHOTO_RECOVERY_CONFLICT');
        }
        if (mocks.stageErrorAfterMoveOnce) {
          const error = mocks.stageErrorAfterMoveOnce;
          mocks.stageErrorAfterMoveOnce = null;
          throw error;
        }
      });
    mocks.storage.clear();
    mocks.verifyEncryptedPhotoDeletionSources
      .mockReset()
      .mockImplementation(async (uris: readonly string[]) => {
        if (uris.some((uri) => !mocks.finalFiles.has(uri))) {
          throw new Error('PHOTO_RECOVERY_CONFLICT');
        }
      });
    mocks.writeAttempts = 0;

    mocks.eqPhotoOwner.mockReturnValue({ abortSignal: mocks.deletePhotoAbortSignal });
    mocks.eqPhotoId.mockReturnValue({ eq: mocks.eqPhotoOwner });
    mocks.deletePhoto.mockReturnValue({ eq: mocks.eqPhotoId });
    mocks.from.mockReturnValue({ delete: mocks.deletePhoto });
  });

  it('propagates private-store failures without replacing metadata', async () => {
    const stored = JSON.stringify([{ id: 'photo-1', takenLocalDate: '2026-07-01' }]);
    mocks.storage.set(KEY, stored);
    mocks.getPrivateItemError = new Error('PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE');

    await expect(loadPhotos()).rejects.toThrow('PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE');
    expect(mocks.storage.get(KEY)).toBe(stored);
    expect(mocks.setPrivateItem).not.toHaveBeenCalled();
  });

  it('loads legacy photos with zero writes or file recovery', async () => {
    const stored = JSON.stringify([
      {
        id: 'photo-1',
        takenLocalDate: '2026-07-01',
        localUri: 'file:///legacy/photo-1.onskinphoto',
        notesCiphertext: 'ciphertext',
      },
    ]);
    mocks.storage.set(KEY, stored);

    await expect(loadPhotos()).resolves.toMatchObject([
      { id: 'photo-1', notes: 'note:ciphertext' },
    ]);
    expect(mocks.storage.get(KEY)).toBe(stored);
    expect(mocks.setPrivateItem).not.toHaveBeenCalled();
    expect(mocks.recoverPreparedEncryptedPhoto).not.toHaveBeenCalled();
    expect(mocks.stageEncryptedPhotoDeletions).not.toHaveBeenCalled();
  });

  it('uses a one-read settled startup fast path without notes, files, or writes', async () => {
    seedSettled([storedPhoto(uuid(1), { notesCiphertext: 'secret-note' })]);

    await recoverPhotoStoreMutations();

    expect(mocks.getPrivateItem).toHaveBeenCalledTimes(1);
    expect(mocks.decryptPhotoNote).not.toHaveBeenCalled();
    expect(mocks.recoverPreparedEncryptedPhoto).not.toHaveBeenCalled();
    expect(mocks.setPrivateItem).not.toHaveBeenCalled();
  });

  it('keeps ordinary reads side-effect-free and rejects staged metadata publication', async () => {
    const id = uuid(1);
    mocks.storage.set(
      KEY,
      JSON.stringify({
        version: 2,
        items: [
          storedPhoto(id, {
            captureSessionId: CAPTURE_A,
            localUri: photoUri(id),
            encryptedLocalUri: photoUri(id),
          }),
        ],
        mutation: { kind: 'add', operationId: id, phase: 'prepared' },
        retainedItems: [],
      }),
    );

    await expect(loadPhotos()).rejects.toThrow(PHOTO_MUTATION_RECOVERY_REQUIRED);
    expect(mocks.setPrivateItem).not.toHaveBeenCalled();
    expect(mocks.recoverPreparedEncryptedPhoto).not.toHaveBeenCalled();
  });

  it.each([
    ['{not-json', PHOTO_METADATA_INVALID],
    [JSON.stringify({ version: 3, items: [] }), PHOTO_METADATA_UNSUPPORTED],
    [JSON.stringify({ id: 'wrong-shape' }), PHOTO_METADATA_INVALID],
  ])('preserves invalid/future metadata %s', async (stored, code) => {
    mocks.storage.set(KEY, stored);
    await expect(loadPhotos()).rejects.toThrow(code);
    expect(mocks.storage.get(KEY)).toBe(stored);
    expect(mocks.setPrivateItem).not.toHaveBeenCalled();
  });

  it('rejects a plaintext capture unless its opaque handle resolves to the exact URI', async () => {
    const actual = capture(CAPTURE_A);

    await expect(
      addPhoto({
        takenLocalDate: '2026-07-03',
        captureSessionId: CAPTURE_A,
        localUri: `${actual}.x`,
      }),
    ).rejects.toThrow('PHOTO_MUTATION_CAPTURE_SESSION_REQUIRED');
    await expect(addPhoto({ takenLocalDate: '2026-07-03', localUri: actual })).rejects.toThrow(
      'PHOTO_MUTATION_CAPTURE_SESSION_REQUIRED',
    );

    expect(mocks.setPrivateItem).not.toHaveBeenCalled();
    expect(mocks.encryptCapturedPhoto).not.toHaveBeenCalled();
  });

  it('commits an encrypted capture then removes its plaintext authority', async () => {
    const source = capture(CAPTURE_A);
    const id = uuid(1);
    mocks.randomIds = [id];

    await expect(
      addPhoto({
        takenLocalDate: '2026-07-03',
        captureSessionId: CAPTURE_A,
        localUri: source,
        alignmentScore: 0.91,
        lightingScore: 0.88,
        qualitySource: 'post_capture_measurement',
      }),
    ).resolves.toMatchObject({ id, localUri: photoUri(id), localOnly: true });

    expect(envelope()).toMatchObject({ version: 2, mutation: null });
    expect(envelope().items).toHaveLength(1);
    expect(mocks.finalFiles.has(photoUri(id))).toBe(true);
    expect(mocks.plaintext.has(CAPTURE_A)).toBe(false);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('recovers a prepared add after final encryption but before metadata commit', async () => {
    const source = capture(CAPTURE_A);
    const id = uuid(1);
    mocks.randomIds = [id];
    mocks.setFailureBefore.add(2);

    await expect(
      addPhoto({ takenLocalDate: '2026-07-03', captureSessionId: CAPTURE_A, localUri: source }),
    ).rejects.toThrow('WRITE_BEFORE_2');

    expect(envelope().mutation).toEqual({ kind: 'add', operationId: id, phase: 'prepared' });
    expect(mocks.finalFiles.has(photoUri(id))).toBe(true);
    expect(mocks.plaintext.has(CAPTURE_A)).toBe(true);

    await recoverPhotoStoreMutations();
    expect(envelope().mutation).toBeNull();
    expect(envelope().items).toHaveLength(1);
    expect(mocks.plaintext.has(CAPTURE_A)).toBe(false);
  });

  it('retries committed-add plaintext cleanup without duplicating metadata', async () => {
    const source = capture(CAPTURE_A);
    const id = uuid(1);
    mocks.randomIds = [id];
    mocks.cleanupErrorOnce = new Error('PLAINTEXT_CLEANUP_FAILED');

    await expect(
      addPhoto({ takenLocalDate: '2026-07-03', captureSessionId: CAPTURE_A, localUri: source }),
    ).rejects.toThrow('PLAINTEXT_CLEANUP_FAILED');
    expect(envelope().mutation?.phase).toBe('metadata_committed');

    await recoverPhotoStoreMutations();
    expect(envelope().mutation).toBeNull();
    expect(envelope().items).toHaveLength(1);
    expect(mocks.encryptCapturedPhoto).toHaveBeenCalledTimes(1);
    expect(mocks.cleanupCalls).toEqual([CAPTURE_A, CAPTURE_A]);
  });

  it('resolves private-KV commit-then-reject by exact readback', async () => {
    const source = capture(CAPTURE_A);
    mocks.setFailureAfter.add(1);
    mocks.setFailureAfter.add(2);
    mocks.setFailureAfter.add(3);

    await expect(
      addPhoto({ takenLocalDate: '2026-07-03', captureSessionId: CAPTURE_A, localUri: source }),
    ).resolves.toBeDefined();
    expect(envelope().mutation).toBeNull();
  });

  it('serializes 100 simultaneous metadata-only additions without dropping a row', async () => {
    mocks.randomIds = Array.from({ length: 100 }, (_, index) => uuid(index + 1));

    await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        addPhoto({ takenLocalDate: `2026-07-${String((index % 28) + 1).padStart(2, '0')}` }),
      ),
    );

    expect(envelope().items).toHaveLength(100);
    expect(new Set(envelope().items.map((item) => item.id))).toHaveLength(100);
  });

  it('does zero writes for missing and identical updates or an already-exclusive reference', async () => {
    const id = uuid(1);
    seedSettled([storedPhoto(id, { notes: null, isReference: true })]);
    const before = mocks.writeAttempts;

    await updatePhoto('missing', { notes: 'x' });
    await updatePhoto(id, { notes: null });
    await setReference(id);

    expect(mocks.writeAttempts).toBe(before);
  });

  it('recovers delete after a crash midway through exact quarantine staging', async () => {
    const id = uuid(1);
    const uri = photoUri(id);
    seedSettled([storedPhoto(id)]);
    mocks.finalFiles.add(uri);
    mocks.stageErrorAfterMoveOnce = new Error('PROCESS_DIED_AFTER_MOVE');

    await expect(removePhoto(id)).rejects.toThrow('PROCESS_DIED_AFTER_MOVE');
    const prepared = envelope().mutation!;
    expect(prepared).toMatchObject({ kind: 'delete', phase: 'prepared' });
    expect(mocks.finalFiles.has(uri)).toBe(false);
    expect(mocks.quarantines.has(quarantineKey(uri, prepared.operationId))).toBe(true);

    await recoverPhotoStoreMutations();
    expect(envelope().items).toEqual([]);
    expect(envelope().mutation).toBeNull();
    expect(mocks.quarantines.size).toBe(0);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('recovers delete after irreversible cleanup commits then rejects', async () => {
    const id = uuid(1);
    const uri = photoUri(id);
    seedSettled([storedPhoto(id)]);
    mocks.finalFiles.add(uri);
    mocks.finalizeErrorAfterDeleteOnce = new Error('DELETE_RESPONSE_LOST');

    await expect(removePhoto(id)).rejects.toThrow('DELETE_RESPONSE_LOST');
    expect(envelope().mutation?.phase).toBe('metadata_committed');
    expect(mocks.finalFiles.has(uri)).toBe(false);
    expect(mocks.quarantines.size).toBe(0);

    await recoverPhotoStoreMutations();
    expect(envelope().items).toEqual([]);
    expect(envelope().mutation).toBeNull();
  });

  it('deletes the server mirror only after local journal completion and scopes the owner', async () => {
    const id = uuid(1);
    seedSettled([storedPhoto(id)]);
    mocks.finalFiles.add(photoUri(id));

    await removePhoto(id);

    expect(envelope().mutation).toBeNull();
    expect(mocks.eqPhotoId).toHaveBeenCalledWith('id', id);
    expect(mocks.eqPhotoOwner).toHaveBeenCalledWith('user_id', 'owner-a');
    expect(mocks.deletePhotoAbortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('fails before destructive authority for an unsafe legacy ID', async () => {
    const unsafeId = 'photo/../other';
    const raw = seedSettled([
      storedPhoto(unsafeId, {
        localUri: photoUri('photoother'),
        encryptedLocalUri: photoUri('photoother'),
      }),
    ]);
    mocks.finalFiles.add(photoUri('photoother'));

    await expect(removePhoto(unsafeId)).rejects.toThrow(PHOTO_MUTATION_JOURNAL_INCONSISTENT);
    expect(mocks.storage.get(KEY)).toBe(raw);
    expect(mocks.verifyEncryptedPhotoDeletionSources).not.toHaveBeenCalled();
    expect(mocks.stageEncryptedPhotoDeletions).not.toHaveBeenCalled();
  });

  it('clears canonical primary and thumbnail files through one replayable journal', async () => {
    const id = uuid(1);
    const primary = photoUri(id);
    const thumbnail = thumbnailUri(id);
    seedSettled([
      storedPhoto(id, {
        thumbnailLocalUri: thumbnail,
      }),
    ]);
    mocks.finalFiles.add(primary);
    mocks.finalFiles.add(thumbnail);

    await clearPhotos();

    expect(envelope().items).toEqual([]);
    expect(envelope().mutation).toBeNull();
    expect(mocks.finalFiles.size).toBe(0);
    expect(mocks.quarantines.size).toBe(0);
  });

  it('preserves duplicate or malformed settled authority without mutation', async () => {
    const id = uuid(1);
    const raw = seedSettled([storedPhoto(id), storedPhoto(id)]);

    await expect(clearPhotos()).rejects.toThrow(PHOTO_METADATA_INVALID);
    expect(mocks.storage.get(KEY)).toBe(raw);
    expect(mocks.setPrivateItem).not.toHaveBeenCalled();
  });

  it('keeps an absent delete a local and remote no-op', async () => {
    await removePhoto('missing');
    expect(mocks.setPrivateItem).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('requires the capture session only when plaintext encryption is requested', async () => {
    await expect(addPhoto({ takenLocalDate: '2026-07-03' })).resolves.toMatchObject({
      localUri: null,
      captureSessionId: null,
    });

    capture(CAPTURE_B);
    await expect(
      addPhoto({ takenLocalDate: '2026-07-04', captureSessionId: CAPTURE_B }),
    ).rejects.toThrow('PHOTO_MUTATION_CAPTURE_SESSION_REQUIRED');
  });
});
