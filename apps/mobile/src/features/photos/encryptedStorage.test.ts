import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearEncryptedPhotoStorage,
  createPhotoShareFile,
  decryptPhotoNote,
  decryptPhotoToDataUri,
  deletePhotoShareFile,
  encryptCapturedPhoto,
  encryptPhotoNote,
} from './encryptedStorage';

const CONTENT_KEY_NAME = 'onskin.photo.content_key.v1';

const mocks = vi.hoisted(() => ({
  files: new Map<string, string>(),
  secureStorage: new Map<string, string>(),
  deleteAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
  makeDirectoryAsync: vi.fn(),
  readAsStringAsync: vi.fn(),
  setItemAsync: vi.fn(),
  writeAsStringAsync: vi.fn(),
}));

vi.mock('react-native-get-random-values', () => ({}));

vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file://cache/',
  documentDirectory: 'file://document/',
  EncodingType: {
    Base64: 'base64',
    UTF8: 'utf8',
  },
  deleteAsync: mocks.deleteAsync,
  makeDirectoryAsync: mocks.makeDirectoryAsync,
  readAsStringAsync: mocks.readAsStringAsync,
  writeAsStringAsync: mocks.writeAsStringAsync,
}));

vi.mock('expo-secure-store', () => ({
  deleteItemAsync: mocks.deleteItemAsync,
  getItemAsync: mocks.getItemAsync,
  setItemAsync: mocks.setItemAsync,
}));

describe('encrypted photo storage', () => {
  beforeEach(() => {
    mocks.files.clear();
    mocks.secureStorage.clear();
    mocks.deleteAsync.mockReset();
    mocks.deleteItemAsync.mockReset();
    mocks.getItemAsync.mockReset();
    mocks.makeDirectoryAsync.mockReset();
    mocks.readAsStringAsync.mockReset();
    mocks.setItemAsync.mockReset();
    mocks.writeAsStringAsync.mockReset();

    mocks.deleteAsync.mockImplementation(async (uri: string) => {
      mocks.files.delete(uri);
    });
    mocks.deleteItemAsync.mockImplementation(async (key: string) => {
      mocks.secureStorage.delete(key);
    });
    mocks.getItemAsync.mockImplementation(async (key: string) => mocks.secureStorage.get(key) ?? null);
    mocks.makeDirectoryAsync.mockResolvedValue(undefined);
    mocks.readAsStringAsync.mockImplementation(async (uri: string) => {
      const value = mocks.files.get(uri);
      if (value == null) throw new Error(`missing file: ${uri}`);
      return value;
    });
    mocks.setItemAsync.mockImplementation(async (key: string, value: string) => {
      mocks.secureStorage.set(key, value);
    });
    mocks.writeAsStringAsync.mockImplementation(async (uri: string, value: string) => {
      mocks.files.set(uri, value);
    });
  });

  it('round-trips encrypted notes and returns null for malformed note envelopes', async () => {
    const ciphertext = await encryptPhotoNote('baseline note');

    await expect(decryptPhotoNote(ciphertext)).resolves.toBe('baseline note');
    await expect(decryptPhotoNote('{not-json')).resolves.toBeNull();

    const envelope = JSON.parse(ciphertext ?? '{}') as Record<string, unknown>;
    envelope.nonceHex = '00';

    await expect(decryptPhotoNote(JSON.stringify(envelope))).resolves.toBeNull();
  });

  it('rotates malformed SecureStore content keys so new captures remain usable', async () => {
    mocks.secureStorage.set(CONTENT_KEY_NAME, 'not-a-hex-key');
    mocks.files.set('file://capture/photo.jpg', Buffer.from('image bytes').toString('base64'));

    const encrypted = await encryptCapturedPhoto('file://capture/photo.jpg', 'photo-1');

    expect(mocks.deleteItemAsync).toHaveBeenCalledWith(CONTENT_KEY_NAME);
    expect(mocks.secureStorage.get(CONTENT_KEY_NAME)).toMatch(/^[0-9a-f]{64}$/);
    expect(encrypted.encryptedLocalUri).toBe('file://document/photos/v1/photo-1.onskinphoto');
    expect(mocks.files.has('file://capture/photo.jpg')).toBe(false);
    await expect(decryptPhotoToDataUri(encrypted.encryptedLocalUri)).resolves.toBe(
      `data:image/jpeg;base64,${Buffer.from('image bytes').toString('base64')}`,
    );
  });

  it('rejects malformed photo envelopes with a stable storage error', async () => {
    mocks.files.set('file://document/photos/v1/bad.onskinphoto', '{not-json');

    await expect(decryptPhotoToDataUri('file://document/photos/v1/bad.onskinphoto')).rejects.toThrow(
      'PHOTO_ENCRYPTION_ENVELOPE_INVALID',
    );

    mocks.files.set(
      'file://document/photos/v1/gif.onskinphoto',
      JSON.stringify({
        version: 'xchacha20poly1305:v1',
        keyId: 'photo-content-key-v1',
        mimeType: 'image/gif',
        nonceHex: '00'.repeat(24),
        ciphertextHex: '00',
      }),
    );

    await expect(createPhotoShareFile('file://document/photos/v1/gif.onskinphoto', 'photo-1')).rejects.toThrow(
      'PHOTO_ENCRYPTION_ENVELOPE_INVALID',
    );
  });

  it('exports encrypted photos to owned cache files and only deletes those exports', async () => {
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(1234);
    mocks.files.set('file://capture/photo.png', Buffer.from('png bytes').toString('base64'));

    const encrypted = await encryptCapturedPhoto('file://capture/photo.png', 'photo-1');
    const shareUri = await createPhotoShareFile(encrypted.encryptedLocalUri, 'photo:1/../');

    expect(shareUri).toBe('file://cache/routinekind-share-photo1-1234.png');
    expect(mocks.files.get(shareUri)).toBe(Buffer.from('png bytes').toString('base64'));

    mocks.files.set('file://cache/not-owned.png', 'external');
    await deletePhotoShareFile('file://cache/not-owned.png', encrypted.encryptedLocalUri);
    expect(mocks.files.get('file://cache/not-owned.png')).toBe('external');

    await deletePhotoShareFile(shareUri, encrypted.encryptedLocalUri);
    expect(mocks.files.has(shareUri)).toBe(false);

    dateNow.mockRestore();
  });

  it('clears the encrypted photo directory and content key together', async () => {
    mocks.secureStorage.set(CONTENT_KEY_NAME, 'a'.repeat(64));

    await clearEncryptedPhotoStorage();

    expect(mocks.deleteAsync).toHaveBeenCalledWith('file://document/photos/v1/', {
      idempotent: true,
    });
    expect(mocks.deleteItemAsync).toHaveBeenCalledWith(CONTENT_KEY_NAME);
  });
});
