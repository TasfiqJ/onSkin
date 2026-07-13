import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_GENERATION_CHANGED,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';

import { addPhoto, clearPhotos, loadPhotos, PHOTO_METADATA_INVALID, removePhoto } from './store';

const mocks = vi.hoisted(() => ({
  decryptPhotoNoteError: null as Error | null,
  storage: new Map<string, string>(),
  deleteCapturedPhotoSource: vi.fn(),
  deletePhoto: vi.fn(),
  deletePhotoAbortSignal: vi.fn(),
  deleteQuarantinedPhoto: vi.fn(),
  encryptCapturedPhoto: vi.fn(),
  eqPhotoId: vi.fn(),
  eqPhotoOwner: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  getPrivateItemError: null as Error | null,
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
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  },
}));

vi.mock('./encryptedStorage', () => ({
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

describe('photo local store recovery', () => {
  beforeEach(() => {
    mocks.decryptPhotoNoteError = null;
    mocks.storage.clear();
    mocks.deleteCapturedPhotoSource.mockReset();
    mocks.deletePhoto.mockReset();
    mocks.deletePhotoAbortSignal.mockReset();
    mocks.deleteQuarantinedPhoto.mockReset();
    mocks.encryptCapturedPhoto.mockReset();
    mocks.eqPhotoId.mockReset();
    mocks.eqPhotoOwner.mockReset();
    mocks.from.mockClear();
    mocks.getUser.mockReset();
    mocks.getPrivateItemError = null;
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
    mocks.deletePhotoAbortSignal.mockResolvedValue({ error: null });
    mocks.eqPhotoOwner.mockReturnValue({ abortSignal: mocks.deletePhotoAbortSignal });
    mocks.eqPhotoId.mockReturnValue({ eq: mocks.eqPhotoOwner });
    mocks.deletePhoto.mockReturnValue({ eq: mocks.eqPhotoId });
    mocks.from.mockReturnValue({ delete: mocks.deletePhoto });
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'owner-a' } },
      error: null,
    });
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

  it('fails closed after a committed save until capture plaintext cleanup succeeds', async () => {
    const cleanupFailure = new Error('capture plaintext cleanup unavailable');
    mocks.deleteCapturedPhotoSource.mockRejectedValueOnce(cleanupFailure);

    const input = {
      takenLocalDate: '2026-07-03',
      captureSessionId: 'capture-session-1',
      localUri: 'file:///captured.jpg',
    };
    await expect(addPhoto(input)).rejects.toThrow(cleanupFailure);

    const committed = JSON.parse(mocks.storage.get(KEY) ?? '[]') as { id: string }[];
    expect(committed).toHaveLength(1);
    expect(mocks.encryptCapturedPhoto).toHaveBeenCalledTimes(1);

    await expect(addPhoto(input)).resolves.toMatchObject({ id: committed[0]!.id });

    const afterRetry = JSON.parse(mocks.storage.get(KEY) ?? '[]') as { id: string }[];
    expect(afterRetry).toEqual(committed);
    expect(mocks.encryptCapturedPhoto).toHaveBeenCalledTimes(1);
    expect(mocks.deleteCapturedPhotoSource).toHaveBeenCalledTimes(2);
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

  it('scopes a photo mirror deletion to the captured authenticated owner', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify([
        {
          id: 'photo-1',
          series: 'front',
          takenLocalDate: '2026-07-01',
          localUri: 'file:///photo-1.onskinphoto',
        },
      ]),
    );

    await removePhoto('photo-1');

    expect(mocks.eqPhotoId).toHaveBeenCalledWith('id', 'photo-1');
    expect(mocks.eqPhotoOwner).toHaveBeenCalledWith('user_id', 'owner-a');
    expect(mocks.deletePhotoAbortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('does not start an owner-B photo delete after a delayed owner-A lookup', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify([
        {
          id: 'photo-1',
          series: 'front',
          takenLocalDate: '2026-07-01',
          localUri: 'file:///photo-1.onskinphoto',
        },
      ]),
    );
    let releaseOwner!: (value: { data: { user: { id: string } }; error: null }) => void;
    let markOwnerLookupStarted!: () => void;
    const ownerLookupStarted = new Promise<void>((resolve) => {
      markOwnerLookupStarted = resolve;
    });
    mocks.getUser.mockImplementationOnce(() => {
      markOwnerLookupStarted();
      return new Promise((resolve) => {
        releaseOwner = resolve;
      });
    });

    const removing = removePhoto('photo-1');
    await ownerLookupStarted;
    beginAccountGenerationBoundary();
    try {
      releaseOwner({ data: { user: { id: 'owner-a' } }, error: null });

      await expect(removing).rejects.toThrow(ACCOUNT_GENERATION_CHANGED);
      expect(mocks.deletePhoto).not.toHaveBeenCalled();
    } finally {
      endAccountGenerationBoundary();
    }
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

  it('clears encrypted photo and thumbnail envelopes', async () => {
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

    await clearPhotos();

    expect(mocks.quarantineEncryptedPhoto).toHaveBeenCalledWith(
      'file:///photo-1.onskinphoto',
      expect.stringMatching(/^clear-/),
    );
    expect(mocks.quarantineEncryptedPhoto).toHaveBeenCalledWith(
      'file:///photo-1-thumb.onskinphoto',
      expect.stringMatching(/^clear-/),
    );
    expect(mocks.deleteQuarantinedPhoto).toHaveBeenCalledTimes(2);
    expect(mocks.storage.has(KEY)).toBe(false);
  });
});
