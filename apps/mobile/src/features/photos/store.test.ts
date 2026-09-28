import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_GENERATION_CHANGED,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';
import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

import {
  addPhoto,
  addPhotoWithOutcome,
  clearPhotos,
  loadPhotos,
  PHOTO_CAPTURE_SESSION_CONFLICT,
  PHOTO_CAPTURE_SESSION_DUPLICATE,
  PHOTO_CAPTURE_SESSION_INVALID,
  PHOTO_METADATA_INVALID,
  removePhoto,
} from './store';

const mocks = vi.hoisted(() => ({
  decryptPhotoNoteError: null as Error | null,
  clearEncryptedPhotoStorage: vi.fn(),
  storage: new Map<string, string>(),
  deleteCapturedPhotoSource: vi.fn(),
  deleteEncryptedPhoto: vi.fn(),
  deleteQuarantinedPhoto: vi.fn(),
  encryptedFiles: new Set<string>(),
  encryptCapturedPhoto: vi.fn(),
  createEncryptedPhotoThumbnail: vi.fn(),
  from: vi.fn(),
  getPrivateItemError: null as Error | null,
  getPrivateItemGate: null as Promise<void> | null,
  getPrivateItemStarted: null as (() => void) | null,
  quarantineEncryptedPhoto: vi.fn(),
  quarantineError: null as Error | null,
  randomIds: [] as string[],
  reconcileEncryptedPhotoStorage: vi.fn(),
  beginPhotoRenditionPublication: vi.fn(),
  markPhotoRenditionPublication: vi.fn(),
  recoverPhotoRenditionPublication: vi.fn(),
  settlePhotoRenditionPublication: vi.fn(),
  removePrivateItem: vi.fn(),
  restoreQuarantinedPhoto: vi.fn(),
  setPrivateItemCommitThenError: null as Error | null,
  setPrivateItemError: null as Error | null,
  setPrivateItemGate: null as Promise<void> | null,
  setPrivateItemStarted: null as (() => void) | null,
}));

vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => mocks.randomIds.shift() ?? 'photo-id'),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => {
    if (mocks.getPrivateItemError) throw mocks.getPrivateItemError;
    mocks.getPrivateItemStarted?.();
    if (mocks.getPrivateItemGate) await mocks.getPrivateItemGate;
    return mocks.storage.get(key) ?? null;
  }),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    if (mocks.setPrivateItemError) throw mocks.setPrivateItemError;
    mocks.setPrivateItemStarted?.();
    if (mocks.setPrivateItemGate) await mocks.setPrivateItemGate;
    mocks.storage.set(key, value);
    const commitError = mocks.setPrivateItemCommitThenError;
    mocks.setPrivateItemCommitThenError = null;
    if (commitError) throw commitError;
  }),
  removePrivateItem: mocks.removePrivateItem,
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: mocks.from,
  },
}));

vi.mock('./encryptedStorage', () => ({
  beginPhotoRenditionPublication: mocks.beginPhotoRenditionPublication,
  canonicalPhotoRenditionUri: vi.fn(({ photoId, rendition }) =>
    `file:///captured.jpg.${photoId}${rendition === 'thumbnail' ? '-thumbnail' : ''}.layerwellphoto`,
  ),
  clearEncryptedPhotoStorage: mocks.clearEncryptedPhotoStorage,
  decryptPhotoNote: vi.fn(async (ciphertext: string) => {
    if (mocks.decryptPhotoNoteError) throw mocks.decryptPhotoNoteError;
    return `note:${ciphertext}`;
  }),
  deleteCapturedPhotoSource: mocks.deleteCapturedPhotoSource,
  deleteEncryptedPhoto: mocks.deleteEncryptedPhoto,
  deleteQuarantinedPhoto: mocks.deleteQuarantinedPhoto,
  encryptCapturedPhoto: mocks.encryptCapturedPhoto,
  encryptPhotoRendition: mocks.encryptCapturedPhoto,
  encryptPhotoNote: vi.fn(async (note: string | null) => (note ? `enc:${note}` : null)),
  isPhotoEncryptionReadError: vi.fn(
    (error: unknown) => error instanceof Error && error.message.startsWith('PHOTO_'),
  ),
  isEncryptedPhotoUri: vi.fn((uri: string | null | undefined) =>
    Boolean(uri?.endsWith('.layerwellphoto')),
  ),
  quarantineEncryptedPhoto: mocks.quarantineEncryptedPhoto,
  reconcileEncryptedPhotoStorage: mocks.reconcileEncryptedPhotoStorage,
  recoverPhotoRenditionPublication: mocks.recoverPhotoRenditionPublication,
  markPhotoRenditionPublication: mocks.markPhotoRenditionPublication,
  settlePhotoRenditionPublication: mocks.settlePhotoRenditionPublication,
  restoreQuarantinedPhoto: mocks.restoreQuarantinedPhoto,
  photoEncryptionInfo: {
    keyId: 'photo-key',
    version: 'photo-v1',
  },
}));

vi.mock('./photoThumbnail', () => ({
  createEncryptedPhotoThumbnail: mocks.createEncryptedPhotoThumbnail,
}));

const KEY = 'layerwell.photos.v1';
const CAPTURE_SESSION_ID = '123e4567-e89b-42d3-a456-426614174000';
let testAccountGeneration = 0;

describe('photo local store recovery', () => {
  beforeEach(() => {
    mocks.decryptPhotoNoteError = null;
    mocks.clearEncryptedPhotoStorage.mockReset();
    mocks.storage.clear();
    mocks.deleteCapturedPhotoSource.mockReset();
    mocks.deleteEncryptedPhoto.mockReset();
    mocks.deleteQuarantinedPhoto.mockReset();
    mocks.encryptedFiles.clear();
    mocks.encryptCapturedPhoto.mockReset();
    mocks.createEncryptedPhotoThumbnail.mockReset();
    mocks.from.mockClear();
    mocks.getPrivateItemError = null;
    mocks.getPrivateItemGate = null;
    mocks.getPrivateItemStarted = null;
    mocks.quarantineEncryptedPhoto.mockReset();
    mocks.quarantineError = null;
    mocks.randomIds = [];
    mocks.reconcileEncryptedPhotoStorage.mockReset();
    mocks.beginPhotoRenditionPublication.mockReset().mockResolvedValue(undefined);
    mocks.markPhotoRenditionPublication.mockReset().mockResolvedValue(undefined);
    mocks.recoverPhotoRenditionPublication.mockReset().mockResolvedValue(undefined);
    mocks.settlePhotoRenditionPublication.mockReset().mockResolvedValue(undefined);
    mocks.removePrivateItem.mockReset();
    mocks.restoreQuarantinedPhoto.mockReset();
    mocks.setPrivateItemCommitThenError = null;
    mocks.setPrivateItemError = null;
    mocks.setPrivateItemGate = null;
    mocks.setPrivateItemStarted = null;

    mocks.deleteCapturedPhotoSource.mockResolvedValue(undefined);
    mocks.deleteEncryptedPhoto.mockImplementation(async (uri: string) => {
      mocks.encryptedFiles.delete(uri);
    });
    mocks.clearEncryptedPhotoStorage.mockResolvedValue(undefined);
    mocks.deleteQuarantinedPhoto.mockResolvedValue(undefined);
    mocks.encryptCapturedPhoto.mockImplementation(
      async (uri: string, identity: string | { photoId: string }) => {
        const id = typeof identity === 'string' ? identity : identity.photoId;
        const encryptedLocalUri = `${uri}.${id}.layerwellphoto`;
        mocks.encryptedFiles.add(encryptedLocalUri);
        return {
          encryptedLocalUri,
          keyId: 'photo-key',
          encryptionVersion: 'photo-v1',
        };
      },
    );
    mocks.createEncryptedPhotoThumbnail.mockImplementation(
      async ({ sourceUri, photoId }: { sourceUri: string; photoId: string }) => {
        const encryptedLocalUri = `${sourceUri}.${photoId}-thumbnail.layerwellphoto`;
        mocks.encryptedFiles.add(encryptedLocalUri);
        return {
          encryptedLocalUri,
          keyId: 'photo-key',
          encryptionVersion: 'photo-v1',
        };
      },
    );
    mocks.quarantineEncryptedPhoto.mockImplementation(
      async (uri: string | null, operationId: string) => {
        if (mocks.quarantineError) throw mocks.quarantineError;
        if (!uri?.endsWith('.layerwellphoto')) return null;
        const quarantinedUri = `${uri}.pending-delete-${operationId}`;
        mocks.encryptedFiles.delete(uri);
        mocks.encryptedFiles.add(quarantinedUri);
        return { originalUri: uri, quarantinedUri };
      },
    );
    mocks.reconcileEncryptedPhotoStorage.mockImplementation(async (referencedUris: string[]) => {
      const referenced = new Set(referencedUris);
      for (const uri of [...mocks.encryptedFiles]) {
        const match = /^(.+\.layerwellphoto)\.pending-delete-.+$/u.exec(uri);
        if (!match) continue;
        mocks.encryptedFiles.delete(uri);
        if (referenced.has(match[1])) mocks.encryptedFiles.add(match[1]);
      }
    });
    mocks.removePrivateItem.mockImplementation(async (key: string) => {
      mocks.storage.delete(key);
    });
    mocks.restoreQuarantinedPhoto.mockResolvedValue(undefined);
    setActiveHealthProcessingEpoch(1, {
      ownerUserId: 'user-a',
      accountGeneration: testAccountGeneration,
    });
  });

  it('propagates encrypted private-store failures without replacing photo metadata', async () => {
    const stored = JSON.stringify([{ id: 'photo-1', takenLocalDate: '2026-07-01' }]);
    mocks.storage.set(KEY, stored);
    mocks.getPrivateItemError = new Error('PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE');

    await expect(loadPhotos()).rejects.toThrow('PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE');

    expect(mocks.storage.get(KEY)).toBe(stored);
  });

  it('propagates photo-note key failures without rewriting ciphertext', async () => {
    const stored = JSON.stringify([
      {
        id: 'photo-1',
        takenLocalDate: '2026-07-01',
        notesCiphertext: 'encrypted-note',
      },
    ]);
    mocks.storage.set(KEY, stored);
    mocks.decryptPhotoNoteError = new Error('PHOTO_CONTENT_KEY_STORAGE_UNAVAILABLE');

    await expect(loadPhotos()).rejects.toThrow('PHOTO_CONTENT_KEY_STORAGE_UNAVAILABLE');

    expect(mocks.storage.get(KEY)).toBe(stored);
  });

  it('preserves malformed persisted photo JSON behind a recovery error', async () => {
    const stored = '{not-json';
    mocks.storage.set(KEY, stored);

    await expect(loadPhotos()).rejects.toThrow(PHOTO_METADATA_INVALID);
    expect(mocks.storage.get(KEY)).toBe(stored);
  });

  it('treats an empty persisted payload as malformed instead of an empty library', async () => {
    mocks.storage.set(KEY, '');

    await expect(loadPhotos()).rejects.toThrow(PHOTO_METADATA_INVALID);
    expect(mocks.storage.get(KEY)).toBe('');
  });

  it('preserves wrong-shaped persisted photo state behind a recovery error', async () => {
    const stored = JSON.stringify({ id: 'not-an-array' });
    mocks.storage.set(KEY, stored);

    await expect(loadPhotos()).rejects.toThrow(PHOTO_METADATA_INVALID);
    expect(mocks.storage.get(KEY)).toBe(stored);
  });

  it('preserves a mixed valid and malformed record set instead of dropping rows', async () => {
    const stored = JSON.stringify([
      {
        id: ' photo-1 ',
        series: ' left ',
        takenLocalDate: ' 2026-07-01 ',
        timeOfDay: ' morning ',
        localUri: ' file:///photo-1.layerwellphoto ',
        notesCiphertext: ' ciphertext ',
        thumbnailLocalUri: ' file:///photo-1-thumb.layerwellphoto ',
        alignmentScore: 2,
        lightingScore: 0.75,
        isReference: 'yes',
      },
      { id: '', takenLocalDate: '2026-07-02' },
      'bad-row',
    ]);
    mocks.storage.set(KEY, stored);

    await expect(loadPhotos()).rejects.toThrow(PHOTO_METADATA_INVALID);
    expect(mocks.storage.get(KEY)).toBe(stored);
  });

  it('does not overwrite malformed state when a new photo is attempted', async () => {
    const stored = JSON.stringify({ stale: true });
    mocks.storage.set(KEY, stored);

    await expect(
      addPhoto({
        takenLocalDate: '2026-07-03',
        localUri: null,
        notes: 'baseline',
      }),
    ).rejects.toThrow(PHOTO_METADATA_INVALID);

    expect(mocks.storage.get(KEY)).toBe(stored);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('keeps measured photo metadata off the network during local save', async () => {
    await addPhoto({
      takenLocalDate: '2026-07-03',
      localUri: 'file:///captured.jpg',
      alignmentScore: 0.91,
      lightingScore: 0.88,
      qualitySource: 'post_capture_measurement',
    });

    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.deleteCapturedPhotoSource).toHaveBeenCalledWith('file:///captured.jpg');
  });

  it('keeps durable publication state and the capture source when metadata fails ambiguously', async () => {
    mocks.setPrivateItemError = new Error('metadata unavailable');

    await expect(
      addPhoto({
        takenLocalDate: '2026-07-03',
        localUri: 'file:///captured.jpg',
      }),
    ).rejects.toThrow('metadata unavailable');

    expect(mocks.beginPhotoRenditionPublication).toHaveBeenCalledOnce();
    expect(mocks.markPhotoRenditionPublication).toHaveBeenCalledWith(
      expect.objectContaining({ photoId: 'photo-id' }),
      'pair_adopted',
    );
    expect(mocks.settlePhotoRenditionPublication).not.toHaveBeenCalled();
    expect(mocks.deleteCapturedPhotoSource).not.toHaveBeenCalled();
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('returns one canonical capture replay without re-encrypting or replacing measured metadata', async () => {
    mocks.randomIds = ['photo-canonical', 'unused-photo-id'];

    const created = await addPhotoWithOutcome({
      takenLocalDate: '2026-07-03',
      timeOfDay: 'morning',
      localUri: 'file:///first.jpg',
      captureSessionId: CAPTURE_SESSION_ID.toUpperCase(),
      alignmentScore: 0.7,
      lightingScore: 0.8,
    });
    const replay = await addPhotoWithOutcome({
      takenLocalDate: '2026-07-03',
      timeOfDay: 'morning',
      localUri: 'file:///replayed.jpg',
      captureSessionId: CAPTURE_SESSION_ID,
      alignmentScore: 0.99,
      lightingScore: 0.1,
      headYaw: 12,
    });

    expect(created).toMatchObject({ createdNow: true, photo: { id: 'photo-canonical' } });
    expect(replay).toMatchObject({
      createdNow: false,
      photo: {
        id: 'photo-canonical',
        captureSessionId: CAPTURE_SESSION_ID,
        alignmentScore: 0.7,
        lightingScore: 0.8,
        headYaw: null,
      },
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '[]')).toHaveLength(1);
    expect(mocks.encryptCapturedPhoto).toHaveBeenCalledOnce();
    expect(mocks.deleteCapturedPhotoSource.mock.calls).toEqual([
      ['file:///first.jpg'],
      ['file:///replayed.jpg'],
    ]);
    expect(mocks.randomIds).toEqual(['unused-photo-id']);
  });

  it('publishes an encrypted thumbnail bound to the canonical photo and capture session', async () => {
    mocks.randomIds = ['photo-with-thumbnail'];

    const result = await addPhotoWithOutcome({
      takenLocalDate: '2026-07-03',
      localUri: 'file:///captured.jpg',
      captureSessionId: CAPTURE_SESSION_ID,
    });

    expect(mocks.createEncryptedPhotoThumbnail).toHaveBeenCalledWith({
      sourceUri: 'file:///captured.jpg',
      photoId: 'photo-with-thumbnail',
      captureSessionId: CAPTURE_SESSION_ID,
    });
    expect(result.photo).toMatchObject({
      id: 'photo-with-thumbnail',
      encryptedLocalUri: 'file:///captured.jpg.photo-with-thumbnail.layerwellphoto',
      thumbnailLocalUri: 'file:///captured.jpg.photo-with-thumbnail-thumbnail.layerwellphoto',
      captureSessionId: CAPTURE_SESSION_ID,
    });
    expect(mocks.deleteCapturedPhotoSource).toHaveBeenCalledAfter(
      mocks.createEncryptedPhotoThumbnail,
    );
  });

  it('deletes an uncommitted original and preserves the raw source when thumbnail creation fails', async () => {
    mocks.randomIds = ['photo-thumbnail-failure'];
    mocks.createEncryptedPhotoThumbnail.mockRejectedValueOnce(new Error('thumbnail failed'));

    await expect(
      addPhotoWithOutcome({
        takenLocalDate: '2026-07-03',
        localUri: 'file:///captured.jpg',
        captureSessionId: CAPTURE_SESSION_ID,
      }),
    ).rejects.toThrow('thumbnail failed');

    expect(mocks.recoverPhotoRenditionPublication).toHaveBeenCalledWith(new Set());
    expect(mocks.storage.has(KEY)).toBe(false);
    expect(mocks.deleteCapturedPhotoSource).not.toHaveBeenCalled();
  });

  it('serializes simultaneous retries for one capture session into one encrypted photo', async () => {
    mocks.randomIds = ['photo-concurrent', 'unused-photo-id'];
    let releaseFirstWrite!: () => void;
    let markFirstWriteStarted!: () => void;
    mocks.setPrivateItemGate = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    const firstWriteStarted = new Promise<void>((resolve) => {
      markFirstWriteStarted = resolve;
    });
    mocks.setPrivateItemStarted = markFirstWriteStarted;

    const first = addPhotoWithOutcome({
      takenLocalDate: '2026-07-03',
      timeOfDay: 'evening',
      localUri: 'file:///first.jpg',
      captureSessionId: CAPTURE_SESSION_ID,
    });
    await firstWriteStarted;
    const retry = addPhotoWithOutcome({
      takenLocalDate: '2026-07-03',
      timeOfDay: 'evening',
      localUri: 'file:///retry.jpg',
      captureSessionId: CAPTURE_SESSION_ID,
    });

    await Promise.resolve();
    expect(mocks.encryptCapturedPhoto).toHaveBeenCalledOnce();
    releaseFirstWrite();
    const [created, replayed] = await Promise.all([first, retry]);

    expect(created).toMatchObject({ createdNow: true, photo: { id: 'photo-concurrent' } });
    expect(replayed).toMatchObject({ createdNow: false, photo: { id: 'photo-concurrent' } });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '[]')).toHaveLength(1);
    expect(mocks.encryptCapturedPhoto).toHaveBeenCalledOnce();
    expect(mocks.deleteCapturedPhotoSource.mock.calls).toEqual([
      ['file:///first.jpg'],
      ['file:///retry.jpg'],
    ]);
    expect(mocks.randomIds).toEqual(['unused-photo-id']);
  });

  it('does not return a queued replay or delete its source after health-lease replacement', async () => {
    await addPhotoWithOutcome({
      takenLocalDate: '2026-07-03',
      localUri: 'file:///first.jpg',
      captureSessionId: CAPTURE_SESSION_ID,
    });
    mocks.deleteCapturedPhotoSource.mockClear();
    mocks.encryptCapturedPhoto.mockClear();
    let releaseRead!: () => void;
    let markReadStarted!: () => void;
    mocks.getPrivateItemGate = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const readStarted = new Promise<void>((resolve) => {
      markReadStarted = resolve;
    });
    mocks.getPrivateItemStarted = markReadStarted;

    const blocker = loadPhotos();
    await readStarted;
    const replay = addPhotoWithOutcome({
      takenLocalDate: '2026-07-03',
      localUri: 'file:///retry.jpg',
      captureSessionId: CAPTURE_SESSION_ID,
    });
    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(2, {
      ownerUserId: 'user-a',
      accountGeneration: testAccountGeneration,
    });
    releaseRead();

    await expect(blocker).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    await expect(replay).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    expect(mocks.encryptCapturedPhoto).not.toHaveBeenCalled();
    expect(mocks.deleteCapturedPhotoSource).not.toHaveBeenCalled();
  });

  it('reconciles a metadata write that commits before throwing and returns it on retry', async () => {
    mocks.randomIds = ['photo-ambiguous', 'unused-photo-id'];
    mocks.setPrivateItemCommitThenError = new Error('ambiguous private-store response');
    const input = {
      takenLocalDate: '2026-07-03',
      timeOfDay: 'morning' as const,
      localUri: 'file:///ambiguous.jpg',
      captureSessionId: CAPTURE_SESSION_ID,
    };

    await expect(addPhotoWithOutcome(input)).rejects.toThrow('ambiguous private-store response');
    expect(JSON.parse(mocks.storage.get(KEY) ?? '[]')).toHaveLength(1);
    expect(mocks.beginPhotoRenditionPublication).toHaveBeenCalledOnce();
    expect(mocks.settlePhotoRenditionPublication).not.toHaveBeenCalled();
    expect(mocks.deleteCapturedPhotoSource).not.toHaveBeenCalled();

    const replay = await addPhotoWithOutcome(input);

    expect(replay).toMatchObject({ createdNow: false, photo: { id: 'photo-ambiguous' } });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '[]')).toHaveLength(1);
    expect(mocks.reconcileEncryptedPhotoStorage).toHaveBeenLastCalledWith([
      'file:///ambiguous.jpg.photo-ambiguous.layerwellphoto',
      'file:///ambiguous.jpg.photo-ambiguous-thumbnail.layerwellphoto',
    ]);
    expect(mocks.encryptedFiles).toEqual(new Set([
      'file:///ambiguous.jpg.photo-ambiguous.layerwellphoto',
      'file:///ambiguous.jpg.photo-ambiguous-thumbnail.layerwellphoto',
    ]));
    expect(mocks.encryptCapturedPhoto).toHaveBeenCalledOnce();
    expect(mocks.deleteCapturedPhotoSource).toHaveBeenCalledOnce();
    expect(mocks.randomIds).toEqual(['unused-photo-id']);
  });

  it('keeps a committed replay fail-closed until its raw source deletion succeeds', async () => {
    await addPhotoWithOutcome({
      takenLocalDate: '2026-07-03',
      localUri: 'file:///first.jpg',
      captureSessionId: CAPTURE_SESSION_ID,
    });
    mocks.deleteCapturedPhotoSource.mockClear();
    mocks.deleteCapturedPhotoSource.mockRejectedValueOnce(new Error('source busy'));

    await expect(
      addPhotoWithOutcome({
        takenLocalDate: '2026-07-03',
        localUri: 'file:///retry.jpg',
        captureSessionId: CAPTURE_SESSION_ID,
      }),
    ).rejects.toThrow('source busy');

    expect(JSON.parse(mocks.storage.get(KEY) ?? '[]')).toHaveLength(1);
    expect(mocks.encryptCapturedPhoto).toHaveBeenCalledOnce();
    expect(mocks.deleteCapturedPhotoSource).toHaveBeenCalledWith('file:///retry.jpg');
  });

  it('fails closed when one capture session is replayed with conflicting route metadata', async () => {
    await addPhotoWithOutcome({
      series: 'front',
      takenLocalDate: '2026-07-03',
      timeOfDay: 'morning',
      localUri: 'file:///first.jpg',
      captureSessionId: CAPTURE_SESSION_ID,
    });
    mocks.deleteCapturedPhotoSource.mockClear();

    for (const conflict of [
      { series: 'front' as const, takenLocalDate: '2026-07-04', timeOfDay: 'morning' as const },
      { series: 'front' as const, takenLocalDate: '2026-07-03', timeOfDay: 'evening' as const },
      { series: 'left' as const, takenLocalDate: '2026-07-03', timeOfDay: 'morning' as const },
    ]) {
      await expect(
        addPhotoWithOutcome({
          ...conflict,
          localUri: 'file:///conflict.jpg',
          captureSessionId: CAPTURE_SESSION_ID,
        }),
      ).rejects.toThrow(PHOTO_CAPTURE_SESSION_CONFLICT);
    }

    expect(JSON.parse(mocks.storage.get(KEY) ?? '[]')).toHaveLength(1);
    expect(mocks.encryptCapturedPhoto).toHaveBeenCalledOnce();
    expect(mocks.deleteCapturedPhotoSource).not.toHaveBeenCalled();
  });

  it('rejects malformed capture-session input before creating or deleting photo bytes', async () => {
    mocks.randomIds = ['unused-photo-id'];

    await expect(
      addPhotoWithOutcome({
        takenLocalDate: '2026-07-03',
        localUri: 'file:///untrusted.jpg',
        captureSessionId: 'not-a-canonical-capture-session',
      }),
    ).rejects.toThrow(PHOTO_CAPTURE_SESSION_INVALID);

    expect(mocks.storage.has(KEY)).toBe(false);
    expect(mocks.encryptCapturedPhoto).not.toHaveBeenCalled();
    expect(mocks.deleteCapturedPhotoSource).not.toHaveBeenCalled();
    expect(mocks.randomIds).toEqual(['unused-photo-id']);
  });

  it('rejects malformed persisted session IDs and ambiguous duplicate canonical sessions', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify([
        {
          id: 'legacy-photo',
          series: 'front',
          takenLocalDate: '2026-07-01',
          captureSessionId: 'legacy-unbounded-session',
        },
      ]),
    );
    await expect(loadPhotos()).rejects.toThrow(PHOTO_METADATA_INVALID);
    expect(mocks.storage.get(KEY)).toContain('legacy-unbounded-session');
    expect(mocks.reconcileEncryptedPhotoStorage).not.toHaveBeenCalled();

    mocks.storage.set(
      KEY,
      JSON.stringify([
        {
          id: 'duplicate-a',
          series: 'front',
          takenLocalDate: '2026-07-03',
          captureSessionId: CAPTURE_SESSION_ID,
        },
        {
          id: 'duplicate-b',
          series: 'front',
          takenLocalDate: '2026-07-03',
          captureSessionId: CAPTURE_SESSION_ID.toUpperCase(),
        },
      ]),
    );
    mocks.deleteCapturedPhotoSource.mockClear();
    mocks.encryptCapturedPhoto.mockClear();

    await expect(
      addPhotoWithOutcome({
        takenLocalDate: '2026-07-03',
        localUri: 'file:///duplicate.jpg',
        captureSessionId: CAPTURE_SESSION_ID,
      }),
    ).rejects.toThrow(PHOTO_CAPTURE_SESSION_DUPLICATE);

    expect(mocks.encryptCapturedPhoto).not.toHaveBeenCalled();
    expect(mocks.deleteCapturedPhotoSource).not.toHaveBeenCalled();
  });

  it('retains normal non-capture additions without an idempotency key', async () => {
    mocks.randomIds = ['photo-a', 'photo-b'];

    const first = await addPhotoWithOutcome({
      takenLocalDate: '2026-07-03',
      localUri: null,
    });
    const second = await addPhotoWithOutcome({
      takenLocalDate: '2026-07-03',
      localUri: null,
    });

    expect(first.createdNow).toBe(true);
    expect(second.createdNow).toBe(true);
    expect(JSON.parse(mocks.storage.get(KEY) ?? '[]')).toHaveLength(2);
  });

  it('serializes concurrent photo additions so neither metadata update is lost', async () => {
    mocks.randomIds = ['photo-a', 'photo-b'];
    let releaseFirstWrite!: () => void;
    let markFirstWriteStarted!: () => void;
    mocks.setPrivateItemGate = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    const firstWriteStarted = new Promise<void>((resolve) => {
      markFirstWriteStarted = resolve;
    });
    mocks.setPrivateItemStarted = markFirstWriteStarted;

    const first = addPhoto({
      takenLocalDate: '2026-07-03',
      localUri: 'file:///first.jpg',
    });
    await firstWriteStarted;
    const second = addPhoto({
      takenLocalDate: '2026-07-04',
      localUri: 'file:///second.jpg',
    });

    await Promise.resolve();
    expect(mocks.encryptCapturedPhoto).toHaveBeenCalledTimes(1);
    releaseFirstWrite();
    await Promise.all([first, second]);

    const stored = JSON.parse(mocks.storage.get(KEY) ?? '[]') as {
      id: string;
      takenLocalDate: string;
    }[];
    expect(stored).toHaveLength(2);
    expect(stored.map((photo) => photo.id)).toEqual(['photo-b', 'photo-a']);
    expect(stored.map((photo) => photo.takenLocalDate)).toEqual(['2026-07-04', '2026-07-03']);
  });

  it('rejects an account-A mutation queued before the account generation changes', async () => {
    let releaseFirstWrite!: () => void;
    let markFirstWriteStarted!: () => void;
    mocks.setPrivateItemGate = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    const firstWriteStarted = new Promise<void>((resolve) => {
      markFirstWriteStarted = resolve;
    });
    mocks.setPrivateItemStarted = markFirstWriteStarted;

    const first = addPhoto({ takenLocalDate: '2026-07-03', localUri: null });
    await firstWriteStarted;
    const queuedClear = clearPhotos();
    beginAccountGenerationBoundary();
    testAccountGeneration += 1;

    try {
      let drainFinished = false;
      const drain = waitForAccountGenerationOperationsToSettle().then(() => {
        drainFinished = true;
      });
      await Promise.resolve();
      expect(drainFinished).toBe(false);

      releaseFirstWrite();
      await expect(first).rejects.toThrow(ACCOUNT_GENERATION_CHANGED);
      await expect(queuedClear).rejects.toThrow(ACCOUNT_GENERATION_CHANGED);
      await drain;

      expect(drainFinished).toBe(true);
      expect(mocks.removePrivateItem).not.toHaveBeenCalled();
    } finally {
      endAccountGenerationBoundary();
    }
  });

  it('rejects an epoch-1 photo queued behind a write after withdrawal and epoch-2 re-grant', async () => {
    mocks.randomIds = ['photo-a', 'photo-b'];
    let releaseFirstWrite!: () => void;
    let markFirstWriteStarted!: () => void;
    mocks.setPrivateItemGate = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    const firstWriteStarted = new Promise<void>((resolve) => {
      markFirstWriteStarted = resolve;
    });
    mocks.setPrivateItemStarted = markFirstWriteStarted;

    const first = addPhoto({ takenLocalDate: '2026-07-03', localUri: 'file:///first.jpg' });
    await firstWriteStarted;
    const queued = addPhoto({ takenLocalDate: '2026-07-04', localUri: 'file:///second.jpg' });

    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(2, {
      ownerUserId: 'user-a',
      accountGeneration: testAccountGeneration,
    });
    releaseFirstWrite();

    await expect(first).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    await expect(queued).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    expect(mocks.encryptCapturedPhoto).toHaveBeenCalledTimes(1);
    expect(mocks.encryptCapturedPhoto).not.toHaveBeenCalledWith(
      'file:///second.jpg',
      expect.anything(),
    );
  });

  it('does not return account-A photo plaintext after an A-to-B same-epoch switch', async () => {
    mocks.storage.set(KEY, JSON.stringify([{ id: 'photo-a', takenLocalDate: '2026-07-01' }]));
    let releaseRead!: () => void;
    let markReadStarted!: () => void;
    mocks.getPrivateItemGate = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const readStarted = new Promise<void>((resolve) => {
      markReadStarted = resolve;
    });
    mocks.getPrivateItemStarted = markReadStarted;

    const pending = loadPhotos();
    await readStarted;
    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(1, {
      ownerUserId: 'user-b',
      accountGeneration: testAccountGeneration,
    });
    releaseRead();

    await expect(pending).rejects.toThrow('HEALTH_DATA_WRITE_OWNER_MISMATCH');
    expect(mocks.reconcileEncryptedPhotoStorage).not.toHaveBeenCalled();
  });

  it('keeps metadata intact when a photo cannot be quarantined for deletion', async () => {
    const stored = JSON.stringify([
      {
        id: 'photo-1',
        series: 'front',
        takenLocalDate: '2026-07-01',
        localUri: 'file:///photo-1.layerwellphoto',
      },
    ]);
    mocks.storage.set(KEY, stored);
    mocks.quarantineError = new Error('file busy');

    await expect(removePhoto('photo-1')).rejects.toThrow('file busy');

    expect(mocks.storage.get(KEY)).toBe(stored);
    expect(mocks.restoreQuarantinedPhoto).not.toHaveBeenCalled();
    expect(mocks.deleteQuarantinedPhoto).not.toHaveBeenCalled();
  });

  it('restores quarantined files when delete metadata persistence fails', async () => {
    const stored = JSON.stringify([
      {
        id: 'photo-1',
        series: 'front',
        takenLocalDate: '2026-07-01',
        localUri: 'file:///photo-1.layerwellphoto',
      },
    ]);
    mocks.storage.set(KEY, stored);
    mocks.setPrivateItemError = new Error('metadata unavailable');

    await expect(removePhoto('photo-1')).rejects.toThrow('metadata unavailable');

    expect(mocks.restoreQuarantinedPhoto).toHaveBeenCalledWith({
      originalUri: 'file:///photo-1.layerwellphoto',
      quarantinedUri: expect.stringContaining(
        'file:///photo-1.layerwellphoto.pending-delete-delete-photo-1-',
      ),
    });
    expect(mocks.storage.get(KEY)).toBe(stored);
    expect(mocks.deleteQuarantinedPhoto).not.toHaveBeenCalled();
  });

  it('does not issue a remote delete when the local record does not exist', async () => {
    await removePhoto('missing-photo');

    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.reconcileEncryptedPhotoStorage).toHaveBeenCalledWith([], {
      removeUnreferencedFinals: false,
    });
  });

  it('keeps measured pose and provenance inside the encrypted local record', async () => {
    await addPhoto({
      takenLocalDate: '2026-07-03',
      localUri: 'file:///captured.jpg',
      alignmentScore: 0.91,
      lightingScore: 0.88,
      headRoll: 1,
      headYaw: 2,
      headPitch: -1,
      qualitySource: 'post_capture_measurement',
    });

    const [stored] = JSON.parse(mocks.storage.get(KEY) ?? '[]') as Record<string, unknown>[];
    expect(stored).toMatchObject({
      alignmentScore: 0.91,
      lightingScore: 0.88,
      headRoll: 1,
      headYaw: 2,
      headPitch: -1,
      qualitySource: 'post_capture_measurement',
      localOnly: true,
      storagePath: null,
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('keeps unproven legacy-style quality values local and untrusted', async () => {
    await addPhoto({
      takenLocalDate: '2026-07-03',
      localUri: null,
      alignmentScore: 0.99,
      lightingScore: 0.99,
      headRoll: 1,
      headYaw: 2,
      headPitch: 3,
    });

    const [stored] = JSON.parse(mocks.storage.get(KEY) ?? '[]') as Record<string, unknown>[];
    expect(stored?.qualitySource).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('persists measured provenance without trusting legacy quality scores', async () => {
    await addPhoto({
      takenLocalDate: '2026-07-03',
      localUri: null,
      alignmentScore: 0.91,
      lightingScore: 0.88,
      qualitySource: 'post_capture_measurement',
    });

    const [stored] = JSON.parse(mocks.storage.get(KEY) ?? '[]') as {
      qualitySource?: string;
    }[];
    expect(stored?.qualitySource).toBe('post_capture_measurement');
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('clears photo metadata and encrypted envelopes without decrypting the metadata log', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify([
        {
          id: 'photo-1',
          series: 'front',
          takenLocalDate: '2026-07-01',
          localUri: 'file:///photo-1.layerwellphoto',
          thumbnailLocalUri: 'file:///photo-1-thumb.layerwellphoto',
        },
      ]),
    );

    clearActiveHealthProcessingEpoch();
    await clearPhotos();

    expect(mocks.getPrivateItemStarted).toBeNull();
    expect(mocks.clearEncryptedPhotoStorage).toHaveBeenCalledOnce();
    expect(mocks.quarantineEncryptedPhoto).not.toHaveBeenCalled();
    expect(mocks.storage.has(KEY)).toBe(false);
  });
});
