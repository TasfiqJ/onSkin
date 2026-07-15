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

import { addPhoto, clearPhotos, loadPhotos, PHOTO_METADATA_INVALID, removePhoto } from './store';

const mocks = vi.hoisted(() => ({
  decryptPhotoNoteError: null as Error | null,
  clearEncryptedPhotoStorage: vi.fn(),
  storage: new Map<string, string>(),
  deleteCapturedPhotoSource: vi.fn(),
  deleteQuarantinedPhoto: vi.fn(),
  encryptCapturedPhoto: vi.fn(),
  from: vi.fn(),
  getPrivateItemError: null as Error | null,
  getPrivateItemGate: null as Promise<void> | null,
  getPrivateItemStarted: null as (() => void) | null,
  quarantineEncryptedPhoto: vi.fn(),
  quarantineError: null as Error | null,
  randomIds: [] as string[],
  reconcileEncryptedPhotoStorage: vi.fn(),
  removePrivateItem: vi.fn(),
  restoreQuarantinedPhoto: vi.fn(),
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
  }),
  removePrivateItem: mocks.removePrivateItem,
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: mocks.from,
  },
}));

vi.mock('./encryptedStorage', () => ({
  clearEncryptedPhotoStorage: mocks.clearEncryptedPhotoStorage,
  decryptPhotoNote: vi.fn(async (ciphertext: string) => {
    if (mocks.decryptPhotoNoteError) throw mocks.decryptPhotoNoteError;
    return `note:${ciphertext}`;
  }),
  deleteCapturedPhotoSource: mocks.deleteCapturedPhotoSource,
  deleteQuarantinedPhoto: mocks.deleteQuarantinedPhoto,
  encryptCapturedPhoto: mocks.encryptCapturedPhoto,
  encryptPhotoNote: vi.fn(async (note: string | null) => (note ? `enc:${note}` : null)),
  isPhotoEncryptionReadError: vi.fn(
    (error: unknown) => error instanceof Error && error.message.startsWith('PHOTO_'),
  ),
  isEncryptedPhotoUri: vi.fn((uri: string | null | undefined) =>
    Boolean(uri?.endsWith('.onskinphoto')),
  ),
  quarantineEncryptedPhoto: mocks.quarantineEncryptedPhoto,
  reconcileEncryptedPhotoStorage: mocks.reconcileEncryptedPhotoStorage,
  restoreQuarantinedPhoto: mocks.restoreQuarantinedPhoto,
  photoEncryptionInfo: {
    keyId: 'photo-key',
    version: 'photo-v1',
  },
}));

const KEY = 'onskin.photos.v1';
let testAccountGeneration = 0;

describe('photo local store recovery', () => {
  beforeEach(() => {
    mocks.decryptPhotoNoteError = null;
    mocks.clearEncryptedPhotoStorage.mockReset();
    mocks.storage.clear();
    mocks.deleteCapturedPhotoSource.mockReset();
    mocks.deleteQuarantinedPhoto.mockReset();
    mocks.encryptCapturedPhoto.mockReset();
    mocks.from.mockClear();
    mocks.getPrivateItemError = null;
    mocks.getPrivateItemGate = null;
    mocks.getPrivateItemStarted = null;
    mocks.quarantineEncryptedPhoto.mockReset();
    mocks.quarantineError = null;
    mocks.randomIds = [];
    mocks.reconcileEncryptedPhotoStorage.mockReset();
    mocks.removePrivateItem.mockReset();
    mocks.restoreQuarantinedPhoto.mockReset();
    mocks.setPrivateItemError = null;
    mocks.setPrivateItemGate = null;
    mocks.setPrivateItemStarted = null;

    mocks.deleteCapturedPhotoSource.mockResolvedValue(undefined);
    mocks.clearEncryptedPhotoStorage.mockResolvedValue(undefined);
    mocks.deleteQuarantinedPhoto.mockResolvedValue(undefined);
    mocks.encryptCapturedPhoto.mockImplementation(async (uri: string, id: string) => ({
      encryptedLocalUri: `${uri}.${id}.onskinphoto`,
      keyId: 'photo-key',
      encryptionVersion: 'photo-v1',
    }));
    mocks.quarantineEncryptedPhoto.mockImplementation(
      async (uri: string | null, operationId: string) => {
        if (mocks.quarantineError) throw mocks.quarantineError;
        if (!uri?.endsWith('.onskinphoto')) return null;
        return { originalUri: uri, quarantinedUri: `${uri}.pending-delete-${operationId}` };
      },
    );
    mocks.reconcileEncryptedPhotoStorage.mockResolvedValue(undefined);
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
        localUri: ' file:///photo-1.onskinphoto ',
        notesCiphertext: ' ciphertext ',
        thumbnailLocalUri: ' file:///photo-1-thumb.onskinphoto ',
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

  it('keeps the capture source retryable and compensates the encrypted file when metadata fails', async () => {
    mocks.setPrivateItemError = new Error('metadata unavailable');

    await expect(
      addPhoto({
        takenLocalDate: '2026-07-03',
        localUri: 'file:///captured.jpg',
      }),
    ).rejects.toThrow('metadata unavailable');

    const encryptedUri = 'file:///captured.jpg.photo-id.onskinphoto';
    expect(mocks.quarantineEncryptedPhoto).toHaveBeenCalledWith(encryptedUri, 'add-photo-id');
    expect(mocks.deleteQuarantinedPhoto).not.toHaveBeenCalled();
    expect(mocks.deleteCapturedPhotoSource).not.toHaveBeenCalled();
    expect(mocks.storage.has(KEY)).toBe(false);
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
        localUri: 'file:///photo-1.onskinphoto',
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
        localUri: 'file:///photo-1.onskinphoto',
      },
    ]);
    mocks.storage.set(KEY, stored);
    mocks.setPrivateItemError = new Error('metadata unavailable');

    await expect(removePhoto('photo-1')).rejects.toThrow('metadata unavailable');

    expect(mocks.restoreQuarantinedPhoto).toHaveBeenCalledWith({
      originalUri: 'file:///photo-1.onskinphoto',
      quarantinedUri: expect.stringContaining(
        'file:///photo-1.onskinphoto.pending-delete-delete-photo-1-',
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
          localUri: 'file:///photo-1.onskinphoto',
          thumbnailLocalUri: 'file:///photo-1-thumb.onskinphoto',
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
