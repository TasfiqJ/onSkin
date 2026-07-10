import { beforeEach, describe, expect, it, vi } from 'vitest';

import { addPhoto, clearPhotos, loadPhotos } from './store';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  deleteEncryptedPhoto: vi.fn(),
  from: vi.fn(),
}));

vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => 'photo-id'),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    mocks.storage.set(key, value);
  }),
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.storage.delete(key);
  }),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: mocks.from,
  },
}));

vi.mock('./encryptedStorage', () => ({
  decryptPhotoNote: vi.fn(async (ciphertext: string) => `note:${ciphertext}`),
  deleteEncryptedPhoto: mocks.deleteEncryptedPhoto,
  encryptCapturedPhoto: vi.fn(async (uri: string, id: string) => ({
    encryptedLocalUri: `${uri}.${id}.onskinphoto`,
    keyId: 'photo-key',
    encryptionVersion: 'photo-v1',
  })),
  encryptPhotoNote: vi.fn(async (note: string | null) => (note ? `enc:${note}` : null)),
  isEncryptedPhotoUri: vi.fn((uri: string | null | undefined) =>
    Boolean(uri?.endsWith('.onskinphoto')),
  ),
  photoEncryptionInfo: {
    keyId: 'photo-key',
    version: 'photo-v1',
  },
}));

const KEY = 'onskin.photos.v1';

describe('photo local store recovery', () => {
  beforeEach(() => {
    mocks.storage.clear();
    mocks.deleteEncryptedPhoto.mockReset();
    mocks.from.mockClear();
  });

  it('removes malformed persisted photo JSON', async () => {
    mocks.storage.set(KEY, '{not-json');

    await expect(loadPhotos()).resolves.toEqual([]);
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('removes wrong-shaped persisted photo state', async () => {
    mocks.storage.set(KEY, JSON.stringify({ id: 'not-an-array' }));

    await expect(loadPhotos()).resolves.toEqual([]);
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('keeps valid legacy photo rows and drops malformed rows', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify([
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
      ]),
    );

    const photos = await loadPhotos();

    expect(photos).toHaveLength(1);
    expect(photos[0]).toMatchObject({
      id: 'photo-1',
      series: 'left',
      takenLocalDate: '2026-07-01',
      takenAt: '2026-07-01T12:00:00.000Z',
      notes: 'note:ciphertext',
      timeOfDay: 'morning',
      localUri: 'file:///photo-1.onskinphoto',
      encryptedLocalUri: 'file:///photo-1.onskinphoto',
      thumbnailLocalUri: 'file:///photo-1-thumb.onskinphoto',
      isEncrypted: true,
      encryptionVersion: 'photo-v1',
      keyId: 'photo-key',
      alignmentScore: null,
      lightingScore: 0.75,
      qualitySource: null,
      isReference: false,
      localOnly: true,
      faceRegionRedacted: false,
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '[]')).toHaveLength(1);
  });

  it('writes a clean photo list after malformed state', async () => {
    mocks.storage.set(KEY, JSON.stringify({ stale: true }));

    await addPhoto({
      takenLocalDate: '2026-07-03',
      localUri: null,
      notes: 'baseline',
    });

    const stored = JSON.parse(mocks.storage.get(KEY) ?? '[]') as { id: string }[];
    expect(stored).toHaveLength(1);
    expect(stored[0]?.id).toBe('photo-id');
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

    expect(mocks.deleteEncryptedPhoto).toHaveBeenCalledWith('file:///photo-1.onskinphoto');
    expect(mocks.deleteEncryptedPhoto).toHaveBeenCalledWith('file:///photo-1-thumb.onskinphoto');
    expect(mocks.storage.has(KEY)).toBe(false);
  });
});
