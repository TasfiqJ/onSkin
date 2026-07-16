import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';
import type { PrivateKVReadResult } from '@/lib/storage/privateKV';

import {
  addPhoto,
  clearPhotos,
  loadPhotos,
  PHOTO_METADATA_INVALID,
  PHOTO_METADATA_UNSUPPORTED,
  PHOTO_MUTATION_JOURNAL_INCONSISTENT,
  PHOTO_MUTATION_RECOVERY_REQUIRED,
  readPhotos,
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
  encryptPhotoNote: vi.fn(),
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
  readPrivateItem: vi.fn(),
  readPrivateItemOverride: null as PrivateKVReadResult | null,
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
  PRIVATE_KV_CONTENT_KEY_CONFLICT: 'PRIVATE_KV_CONTENT_KEY_CONFLICT',
  PRIVATE_KV_CONTENT_KEY_INVALID: 'PRIVATE_KV_CONTENT_KEY_INVALID',
  PRIVATE_KV_CONTENT_KEY_MISSING: 'PRIVATE_KV_CONTENT_KEY_MISSING',
  PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE: 'PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE',
  PRIVATE_KV_DECRYPTION_FAILED: 'PRIVATE_KV_DECRYPTION_FAILED',
  PRIVATE_KV_ENVELOPE_INVALID: 'PRIVATE_KV_ENVELOPE_INVALID',
  PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY: 'PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY',
  readPrivateItem: mocks.readPrivateItem,
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
  PHOTO_CONTENT_KEY_INVALID: 'PHOTO_CONTENT_KEY_INVALID',
  PHOTO_CONTENT_KEY_MISSING: 'PHOTO_CONTENT_KEY_MISSING',
  PHOTO_CONTENT_KEY_STORAGE_UNAVAILABLE: 'PHOTO_CONTENT_KEY_STORAGE_UNAVAILABLE',
  PHOTO_DECRYPTION_FAILED: 'PHOTO_DECRYPTION_FAILED',
  PHOTO_RECOVERY_CANDIDATE_UNAUTHENTICATED: 'PHOTO_RECOVERY_CANDIDATE_UNAUTHENTICATED',
  PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY: 'PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY',
  decryptPhotoNote: mocks.decryptPhotoNote,
  discardPendingEncryptedPhotoForRetry: mocks.discardPendingEncryptedPhotoForRetry,
  encryptedPhotoUriForId: (id: string) => photoUri(id.replace(/[^A-Za-z0-9_-]/g, '') || 'photo'),
  encryptedPhotoThumbnailUriForId: (id: string) =>
    thumbnailUri(id.replace(/[^A-Za-z0-9_-]/g, '') || 'photo'),
  encryptCapturedPhoto: mocks.encryptCapturedPhoto,
  encryptPhotoNote: mocks.encryptPhotoNote,
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
    mocks.encryptPhotoNote
      .mockReset()
      .mockImplementation(async (note: string | null) => (note ? `enc:${note}` : null));
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
    mocks.readPrivateItemOverride = null;
    mocks.readPrivateItem.mockReset().mockImplementation(async (key: string) => {
      if (mocks.readPrivateItemOverride) return mocks.readPrivateItemOverride;
      try {
        const value = await mocks.getPrivateItem(key);
        return value === null
          ? ({ status: 'absent' } as const)
          : ({ status: 'available', value } as const);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (message === 'PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE') {
          return {
            status: 'unavailable',
            reason: 'content_key_storage_unavailable',
          } as const;
        }
        return { status: 'unavailable', reason: 'storage_unavailable' } as const;
      }
    });
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

    await expect(readPhotos()).resolves.toEqual({
      status: 'unavailable',
      photos: null,
      reason: 'content_key_storage_unavailable',
    });
    await expect(loadPhotos()).rejects.toThrow('PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE');
    expect(mocks.storage.get(KEY)).toBe(stored);
    expect(mocks.setPrivateItem).not.toHaveBeenCalled();
  });

  it('returns typed private-envelope failures without decoding or changing bytes', async () => {
    const original = JSON.stringify([{ id: 'photo-1', takenLocalDate: '2026-07-01' }]);
    mocks.storage.set(KEY, original);

    for (const [stored, expected] of [
      [
        { status: 'corrupt', reason: 'decryption_failed' } as const,
        { status: 'corrupt', photos: null, reason: 'decryption_failed' } as const,
      ],
      [
        { status: 'unsupported_version' } as const,
        { status: 'unsupported_version', photos: null } as const,
      ],
      [
        { status: 'unavailable', reason: 'content_key_missing' } as const,
        { status: 'unavailable', photos: null, reason: 'content_key_missing' } as const,
      ],
    ] satisfies readonly (readonly [PrivateKVReadResult, object])[]) {
      mocks.readPrivateItemOverride = stored;
      await expect(readPhotos()).resolves.toEqual(expected);
      expect(mocks.storage.get(KEY)).toBe(original);
      expect(mocks.decryptPhotoNote).not.toHaveBeenCalled();
      expect(mocks.setPrivateItem).not.toHaveBeenCalled();
    }
  });

  it('distinguishes a valid absent timeline from typed read failures', async () => {
    await expect(readPhotos()).resolves.toEqual({ status: 'absent', photos: [] });
  });

  it('classifies photo-note key and decryption failures without publishing metadata', async () => {
    const raw = seedSettled([storedPhoto(uuid(1), { notesCiphertext: 'encrypted-note' })]);

    for (const [code, expected] of [
      [
        'PHOTO_CONTENT_KEY_MISSING',
        {
          status: 'unavailable',
          photos: null,
          reason: 'photo_content_key_missing',
        } as const,
      ],
      [
        'PHOTO_CONTENT_KEY_STORAGE_UNAVAILABLE',
        {
          status: 'unavailable',
          photos: null,
          reason: 'photo_content_key_storage_unavailable',
        } as const,
      ],
      [
        'PHOTO_CONTENT_KEY_INVALID',
        { status: 'corrupt', photos: null, reason: 'photo_content_key_invalid' } as const,
      ],
      [
        'PHOTO_DECRYPTION_FAILED',
        { status: 'corrupt', photos: null, reason: 'photo_decryption_failed' } as const,
      ],
    ] as const) {
      mocks.decryptPhotoNote.mockRejectedValueOnce(new Error(code));
      await expect(readPhotos()).resolves.toEqual(expected);
      expect(mocks.storage.get(KEY)).toBe(raw);
      expect(mocks.setPrivateItem).not.toHaveBeenCalled();
    }
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

    await expect(readPhotos()).resolves.toEqual({ status: 'recovery_required', photos: null });
    await expect(loadPhotos()).rejects.toThrow(PHOTO_MUTATION_RECOVERY_REQUIRED);
    expect(mocks.setPrivateItem).not.toHaveBeenCalled();
    expect(mocks.recoverPreparedEncryptedPhoto).not.toHaveBeenCalled();
  });

  it.each([
    [
      '{not-json',
      PHOTO_METADATA_INVALID,
      { status: 'corrupt', photos: null, reason: 'invalid_payload' },
    ],
    [
      JSON.stringify({ version: 3, items: [] }),
      PHOTO_METADATA_UNSUPPORTED,
      { status: 'unsupported_version', photos: null },
    ],
    [
      JSON.stringify({ id: 'wrong-shape' }),
      PHOTO_METADATA_INVALID,
      { status: 'corrupt', photos: null, reason: 'invalid_payload' },
    ],
  ])('preserves invalid/future metadata %s', async (stored, code, expected) => {
    mocks.storage.set(KEY, stored);
    await expect(readPhotos()).resolves.toEqual(expected);
    await expect(loadPhotos()).rejects.toThrow(code);
    expect(mocks.storage.get(KEY)).toBe(stored);
    expect(mocks.setPrivateItem).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid series', { ...storedPhoto(uuid(1)), series: 'diagonal' }],
    ['non-canonical timestamp', { ...storedPhoto(uuid(1)), takenAt: '2026-07-01T08:00:00-04:00' }],
    ['invalid local date', { ...storedPhoto(uuid(1)), takenLocalDate: '2026-02-30' }],
    ['wrong boolean type', { ...storedPhoto(uuid(1)), localOnly: 1 }],
    ['non-local current row', { ...storedPhoto(uuid(1)), localOnly: false }],
    ['cloud storage path', { ...storedPhoto(uuid(1)), storagePath: 'owner/photo.jpg' }],
    ['plaintext URI', { ...storedPhoto(uuid(1)), localUri: 'file://private/plaintext.jpg' }],
    [
      'capture marker without encrypted authority',
      {
        ...storedPhoto(uuid(1)),
        captureSessionId: CAPTURE_A,
        localUri: null,
        encryptedLocalUri: null,
        isEncrypted: false,
        encryptionVersion: 'none',
        keyId: null,
      },
    ],
    [
      'mismatched encrypted authority',
      { ...storedPhoto(uuid(1)), encryptedLocalUri: photoUri(uuid(2)) },
    ],
    ['extra field', { ...storedPhoto(uuid(1)), unexpected: true }],
    [
      'missing field',
      (() => {
        const { series: _series, ...record } = storedPhoto(uuid(1));
        return record;
      })(),
    ],
  ])('preserves a malformed current V2 row: %s', async (_label, row) => {
    const raw = seedSettled([row]);

    await expect(readPhotos()).resolves.toMatchObject({ status: 'corrupt', photos: null });
    await expect(loadPhotos()).rejects.toThrow();
    expect(mocks.storage.get(KEY)).toBe(raw);
    expect(mocks.setPrivateItem).not.toHaveBeenCalled();
  });

  it('never consumes plaintext staging for a malformed V2 capture marker', async () => {
    const id = uuid(1);
    seedSettled([
      storedPhoto(id, {
        captureSessionId: CAPTURE_A,
        localUri: null,
        encryptedLocalUri: null,
        isEncrypted: false,
        encryptionVersion: 'none',
        keyId: null,
      }),
    ]);
    const source = capture(CAPTURE_A);

    await expect(
      addPhoto({
        takenLocalDate: '2026-07-03',
        captureSessionId: CAPTURE_A,
        localUri: source,
      }),
    ).rejects.toThrow(PHOTO_MUTATION_JOURNAL_INCONSISTENT);

    expect(mocks.plaintext.get(CAPTURE_A)).toBe(source);
    expect(mocks.cleanupCalls).toEqual([]);
    expect(mocks.encryptCapturedPhoto).not.toHaveBeenCalled();
    expect(mocks.setPrivateItem).not.toHaveBeenCalled();
  });

  it('migrates the complete historical V1 placeholder without inventing file authority', async () => {
    const id = uuid(1);
    const legacy = JSON.stringify([
      {
        id,
        series: 'front',
        takenLocalDate: '2026-06-13',
        takenAt: '2026-06-13T12:00:00.000Z',
        timeOfDay: 'morning',
        alignmentScore: 0.9,
        lightingScore: 0.8,
        headRoll: 0,
        headYaw: 0,
        headPitch: 0,
        isReference: true,
        referencePhotoId: null,
        captureSessionId: null,
        localUri: null,
        notes: 'legacy note',
        localOnly: true,
        storagePath: null,
        faceRegionRedacted: false,
        isEncrypted: true,
      },
    ]);
    mocks.storage.set(KEY, legacy);

    await expect(readPhotos()).resolves.toMatchObject({
      status: 'available',
      format: 'legacy',
      photos: [{ id, isEncrypted: false, localUri: null, localOnly: true, storagePath: null }],
    });
    expect(mocks.storage.get(KEY)).toBe(legacy);
    expect(mocks.setPrivateItem).not.toHaveBeenCalled();

    await updatePhoto(id, { timeOfDay: 'evening' });

    expect(envelope()).toMatchObject({
      version: 2,
      mutation: null,
      retainedItems: [],
      items: [
        {
          id,
          timeOfDay: 'evening',
          localUri: null,
          isEncrypted: false,
          encryptedLocalUri: null,
          encryptionVersion: 'none',
          keyId: null,
          localOnly: true,
          storagePath: null,
          notes: null,
          notesCiphertext: 'enc:legacy note',
        },
      ],
    });
  });

  it('preserves a legacy plaintext file row when no owner-bound migration exists', async () => {
    const id = uuid(1);
    const legacy = JSON.stringify([
      {
        ...storedPhoto(id),
        localUri: 'file://document/legacy-photo.jpg',
        notes: 'must remain plaintext until a real migration owns the file',
        encryptedLocalUri: null,
        encryptionVersion: 'none',
        keyId: null,
      },
    ]);
    mocks.storage.set(KEY, legacy);

    await expect(readPhotos()).resolves.toMatchObject({ status: 'available', format: 'legacy' });
    await expect(updatePhoto(id, { timeOfDay: 'evening' })).rejects.toThrow(
      PHOTO_MUTATION_JOURNAL_INCONSISTENT,
    );

    expect(mocks.storage.get(KEY)).toBe(legacy);
    expect(mocks.setPrivateItem).not.toHaveBeenCalled();
    expect(mocks.encryptPhotoNote).not.toHaveBeenCalled();
  });

  it('drops a delayed stale read at an account boundary before note decryption or publication', async () => {
    const raw = JSON.stringify({
      version: 2,
      items: [storedPhoto(uuid(1), { notesCiphertext: 'owner-a-note' })],
      mutation: null,
      retainedItems: [],
    });
    let releaseRead!: (result: PrivateKVReadResult) => void;
    mocks.readPrivateItem.mockImplementationOnce(
      () =>
        new Promise<PrivateKVReadResult>((resolve) => {
          releaseRead = resolve;
        }),
    );

    const read = readPhotos();
    await vi.waitFor(() => expect(mocks.readPrivateItem).toHaveBeenCalledOnce());
    beginAccountGenerationBoundary();
    try {
      releaseRead({ status: 'available', value: raw });
      await expect(read).resolves.toEqual({
        status: 'unavailable',
        photos: null,
        reason: 'account_boundary',
      });
    } finally {
      endAccountGenerationBoundary();
    }

    expect(mocks.decryptPhotoNote).not.toHaveBeenCalled();
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
    ).resolves.toMatchObject({
      result: { id, localUri: photoUri(id), localOnly: true },
      photos: [{ id, localUri: photoUri(id), localOnly: true }],
    });

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

  it('returns the exact post-commit snapshot for update, reference, and remove', async () => {
    const firstId = uuid(1);
    const secondId = uuid(2);
    seedSettled([
      storedPhoto(firstId, { isReference: true }),
      storedPhoto(secondId, { isReference: false }),
    ]);
    mocks.finalFiles.add(photoUri(firstId));

    await expect(updatePhoto(secondId, { timeOfDay: 'evening' })).resolves.toMatchObject({
      result: undefined,
      photos: [
        { id: firstId, isReference: true, notes: null },
        { id: secondId, isReference: false, notes: null, timeOfDay: 'evening' },
      ],
    });
    const referenceCommit = await setReference(secondId);
    expect(referenceCommit).toMatchObject({
      result: undefined,
      photos: [
        { id: firstId, isReference: false },
        { id: secondId, isReference: true },
      ],
    });
    const removeCommit = await removePhoto(firstId);
    expect(removeCommit).toMatchObject({
      result: undefined,
      photos: [{ id: secondId, isReference: true }],
    });

    await expect(loadPhotos()).resolves.toEqual(removeCommit.photos);
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
    const raw = JSON.stringify([
      storedPhoto(unsafeId, {
        localUri: photoUri('photoother'),
        encryptedLocalUri: photoUri('photoother'),
      }),
    ]);
    mocks.storage.set(KEY, raw);
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
      result: {
        localUri: null,
        captureSessionId: null,
      },
      photos: [
        {
          localUri: null,
          captureSessionId: null,
        },
      ],
    });

    capture(CAPTURE_B);
    await expect(
      addPhoto({ takenLocalDate: '2026-07-04', captureSessionId: CAPTURE_B }),
    ).rejects.toThrow('PHOTO_MUTATION_CAPTURE_SESSION_REQUIRED');
  });
});
