import { describe, expect, it, vi } from 'vitest';

import {
  createEncryptedPhotoThumbnailPipeline,
  trustedThumbnailManipulatorUri,
} from './photoThumbnail';

vi.mock('react-native-get-random-values', () => ({}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(), removeItem: vi.fn(), setItem: vi.fn() },
}));
vi.mock('expo-secure-store', () => ({
  deleteItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
}));
vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file://cache/',
  documentDirectory: 'file://document/',
  deleteAsync: vi.fn(),
  getInfoAsync: vi.fn(),
  makeDirectoryAsync: vi.fn(),
  moveAsync: vi.fn(),
  readDirectoryAsync: vi.fn(),
  readAsStringAsync: vi.fn(),
  writeAsStringAsync: vi.fn(),
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
}));
vi.mock('expo-image-manipulator', () => ({
  manipulateAsync: vi.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));
vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
}));

const CACHE = 'file://cache/';
const GENERATED = `${CACHE}ImageManipulator/00000000-0000-4000-8000-000000000001.jpg`;

function dependencies() {
  const events: string[] = [];
  const handle = {
    operationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    purpose: 'photo_thumbnail_jpeg' as const,
    uri: `${CACHE}private-plaintext-staging-v1/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg`,
  };
  const deps = {
    cacheDirectory: CACHE,
    cleanup: vi.fn(async () => {
      events.push('cleanup');
    }),
    deleteEncrypted: vi.fn(async () => {
      events.push('delete-encrypted');
    }),
    encrypt: vi.fn(async () => {
      events.push('encrypt');
      return {
        encryptedLocalUri: 'file://document/photos/v1/photo-thumbnail.layerwellphoto',
        keyId: 'photo-content-key-v1' as const,
        encryptionVersion: 'xchacha20poly1305:photo-rendition:v1' as const,
      };
    }),
    manipulate: vi.fn(async () => {
      events.push('manipulate');
      return { uri: GENERATED };
    }),
    markWritten: vi.fn(async () => {
      events.push('mark-written');
    }),
    move: vi.fn(async () => {
      events.push('move');
    }),
    reserve: vi.fn(async () => {
      events.push('reserve');
      return handle;
    }),
    retryRecovery: vi.fn(async () => 0),
    runGenerated: async <T>(operation: () => Promise<T>) => operation(),
  };
  return { deps, events, handle };
}

describe('encrypted photo thumbnail pipeline', () => {
  it('accepts only canonical ImageManipulator JPEG children', () => {
    expect(trustedThumbnailManipulatorUri(GENERATED, CACHE)).toBe(GENERATED);
    expect(trustedThumbnailManipulatorUri(`${GENERATED}?query=1`, CACHE)).toBeNull();
    expect(trustedThumbnailManipulatorUri(`${CACHE}Camera/photo.jpg`, CACHE)).toBeNull();
    expect(
      trustedThumbnailManipulatorUri(`${CACHE}ImageManipulator/../photo.jpg`, CACHE),
    ).toBeNull();
  });

  it('journals before manipulation, adopts the output, encrypts, then cleans plaintext', async () => {
    const { deps, events, handle } = dependencies();
    const create = createEncryptedPhotoThumbnailPipeline(deps);

    await expect(
      create({
        sourceUri: 'file://camera/raw.jpg',
        photoId: 'photo-1',
        captureSessionId: '123e4567-e89b-42d3-a456-426614174000',
      }),
    ).resolves.toMatchObject({
      encryptedLocalUri: 'file://document/photos/v1/photo-thumbnail.layerwellphoto',
    });

    expect(events).toEqual(['reserve', 'manipulate', 'move', 'mark-written', 'encrypt', 'cleanup']);
    expect(deps.move).toHaveBeenCalledWith({ from: GENERATED, to: handle.uri });
    expect(deps.encrypt).toHaveBeenCalledWith(handle.uri, {
      photoId: 'photo-1',
      captureSessionId: '123e4567-e89b-42d3-a456-426614174000',
      rendition: 'thumbnail',
    });
  });

  it('never manipulates when the durable reservation fails', async () => {
    const { deps } = dependencies();
    deps.reserve.mockRejectedValueOnce(new Error('journal unavailable'));
    const create = createEncryptedPhotoThumbnailPipeline(deps);

    await expect(
      create({ sourceUri: 'file://camera/raw.jpg', photoId: 'photo-1', captureSessionId: null }),
    ).rejects.toThrow('journal unavailable');
    expect(deps.manipulate).not.toHaveBeenCalled();
    expect(deps.retryRecovery).toHaveBeenCalledOnce();
  });

  it('refuses an untrusted native output and cleans its reserved path', async () => {
    const { deps, events } = dependencies();
    deps.manipulate.mockResolvedValueOnce({ uri: 'file://outside/private.jpg' });
    const create = createEncryptedPhotoThumbnailPipeline(deps);

    await expect(
      create({ sourceUri: 'file://camera/raw.jpg', photoId: 'photo-1', captureSessionId: null }),
    ).rejects.toThrow('PHOTO_THUMBNAIL_URI_UNTRUSTED');
    expect(events).toEqual(['reserve', 'cleanup']);
    expect(deps.encrypt).not.toHaveBeenCalled();
  });

  it('synchronously completes durable recovery when direct plaintext cleanup fails', async () => {
    const { deps } = dependencies();
    deps.cleanup.mockRejectedValueOnce(new Error('plaintext busy'));
    const create = createEncryptedPhotoThumbnailPipeline(deps);

    await expect(
      create({ sourceUri: 'file://camera/raw.jpg', photoId: 'photo-1', captureSessionId: null }),
    ).resolves.toMatchObject({ encryptedLocalUri: expect.any(String) });
    expect(deps.retryRecovery).toHaveBeenCalledOnce();
    expect(deps.deleteEncrypted).not.toHaveBeenCalled();
  });

  it('cleans the staged plaintext when rendition encryption rejects', async () => {
    const { deps } = dependencies();
    deps.encrypt.mockRejectedValueOnce(new Error('key unavailable'));
    const create = createEncryptedPhotoThumbnailPipeline(deps);

    await expect(
      create({ sourceUri: 'file://camera/raw.jpg', photoId: 'photo-1', captureSessionId: null }),
    ).rejects.toThrow('key unavailable');
    expect(deps.cleanup).toHaveBeenCalledOnce();
    expect(deps.deleteEncrypted).not.toHaveBeenCalled();
  });
});
