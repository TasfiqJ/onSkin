import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearEncryptedPhotoStorage,
  createPhotoShareFile,
  decryptPhotoNote,
  decryptPhotoToDataUri,
  deletePhotoShareFile,
  encryptCapturedPhoto,
  encryptPhotoNote,
  PHOTO_CONTENT_KEY_INVALID,
  PHOTO_CONTENT_KEY_MISSING,
  PHOTO_CONTENT_KEY_STORAGE_UNAVAILABLE,
  PHOTO_DECRYPTION_FAILED,
} from './encryptedStorage';

const CONTENT_KEY_NAME = 'onskin.photo.content_key.v1';
const CONTENT_KEY_MARKER = 'onskin.photo.content_key_created.v1';

const mocks = vi.hoisted(() => ({
  asyncSetThrows: false,
  asyncStorage: new Map<string, string>(),
  files: new Map<string, string>(),
  secureStorage: new Map<string, string>(),
  deleteAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
  getInfoAsync: vi.fn(),
  makeDirectoryAsync: vi.fn(),
  readDirectoryAsync: vi.fn(),
  readAsStringAsync: vi.fn(),
  secureGetThrows: false,
  secureSetThrows: false,
  setItemAsync: vi.fn(),
  writeAsStringAsync: vi.fn(),
}));

vi.mock('react-native-get-random-values', () => ({}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => mocks.asyncStorage.get(key) ?? null),
    removeItem: vi.fn(async (key: string) => {
      mocks.asyncStorage.delete(key);
    }),
    setItem: vi.fn(async (key: string, value: string) => {
      if (mocks.asyncSetThrows) throw new Error('async write failed');
      mocks.asyncStorage.set(key, value);
    }),
  },
}));

vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file://cache/',
  documentDirectory: 'file://document/',
  EncodingType: {
    Base64: 'base64',
    UTF8: 'utf8',
  },
  deleteAsync: mocks.deleteAsync,
  getInfoAsync: mocks.getInfoAsync,
  makeDirectoryAsync: mocks.makeDirectoryAsync,
  readDirectoryAsync: mocks.readDirectoryAsync,
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
    mocks.asyncSetThrows = false;
    mocks.asyncStorage.clear();
    mocks.files.clear();
    mocks.secureStorage.clear();
    mocks.deleteAsync.mockReset();
    mocks.deleteItemAsync.mockReset();
    mocks.getItemAsync.mockReset();
    mocks.getInfoAsync.mockReset();
    mocks.makeDirectoryAsync.mockReset();
    mocks.readDirectoryAsync.mockReset();
    mocks.readAsStringAsync.mockReset();
    mocks.secureGetThrows = false;
    mocks.secureSetThrows = false;
    mocks.setItemAsync.mockReset();
    mocks.writeAsStringAsync.mockReset();

    mocks.deleteAsync.mockImplementation(async (uri: string) => {
      mocks.files.delete(uri);
    });
    mocks.deleteItemAsync.mockImplementation(async (key: string) => {
      mocks.secureStorage.delete(key);
    });
    mocks.getItemAsync.mockImplementation(async (key: string) => {
      if (mocks.secureGetThrows) throw new Error('secure read failed');
      return mocks.secureStorage.get(key) ?? null;
    });
    mocks.getInfoAsync.mockResolvedValue({ exists: false });
    mocks.makeDirectoryAsync.mockResolvedValue(undefined);
    mocks.readDirectoryAsync.mockResolvedValue([]);
    mocks.readAsStringAsync.mockImplementation(async (uri: string) => {
      const value = mocks.files.get(uri);
      if (value == null) throw new Error(`missing file: ${uri}`);
      return value;
    });
    mocks.setItemAsync.mockImplementation(async (key: string, value: string) => {
      if (mocks.secureSetThrows) throw new Error('secure write failed');
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

  it('does not create replacement key material while decrypting a keyless note', async () => {
    const ciphertext = await encryptPhotoNote('baseline note');
    mocks.secureStorage.delete(CONTENT_KEY_NAME);
    mocks.setItemAsync.mockClear();

    await expect(decryptPhotoNote(ciphertext)).rejects.toThrow(PHOTO_CONTENT_KEY_MISSING);

    expect(mocks.setItemAsync).not.toHaveBeenCalled();
    expect(mocks.secureStorage.has(CONTENT_KEY_NAME)).toBe(false);
  });

  it('refuses to rotate a missing key after encrypted photo data has existed', async () => {
    const ciphertext = await encryptPhotoNote('baseline note');
    const originalKey = mocks.secureStorage.get(CONTENT_KEY_NAME);
    mocks.secureStorage.delete(CONTENT_KEY_NAME);
    mocks.setItemAsync.mockClear();

    await expect(encryptPhotoNote('replacement note')).rejects.toThrow(PHOTO_CONTENT_KEY_MISSING);

    expect(mocks.setItemAsync).not.toHaveBeenCalled();
    expect(mocks.asyncStorage.get(CONTENT_KEY_MARKER)).toBe('1');
    mocks.secureStorage.set(CONTENT_KEY_NAME, originalKey!);
    await expect(decryptPhotoNote(ciphertext)).resolves.toBe('baseline note');
  });

  it('detects legacy encrypted photo files before creating an unmarked replacement key', async () => {
    mocks.getInfoAsync.mockResolvedValue({ exists: true });
    mocks.readDirectoryAsync.mockResolvedValue(['legacy-photo.onskinphoto']);

    await expect(encryptPhotoNote('new note')).rejects.toThrow(PHOTO_CONTENT_KEY_MISSING);

    expect(mocks.setItemAsync).not.toHaveBeenCalled();
    expect(mocks.secureStorage.has(CONTENT_KEY_NAME)).toBe(false);
  });

  it('preserves malformed key material during read-only note decryption', async () => {
    const ciphertext = await encryptPhotoNote('baseline note');
    mocks.secureStorage.set(CONTENT_KEY_NAME, 'malformed-key');
    mocks.deleteItemAsync.mockClear();

    await expect(decryptPhotoNote(ciphertext)).rejects.toThrow(PHOTO_CONTENT_KEY_INVALID);

    expect(mocks.deleteItemAsync).not.toHaveBeenCalled();
    expect(mocks.secureStorage.get(CONTENT_KEY_NAME)).toBe('malformed-key');
  });

  it('fails closed without key mutation when SecureStore is temporarily unreadable', async () => {
    const ciphertext = await encryptPhotoNote('baseline note');
    mocks.secureGetThrows = true;
    mocks.setItemAsync.mockClear();
    mocks.deleteItemAsync.mockClear();

    await expect(decryptPhotoNote(ciphertext)).rejects.toThrow(
      PHOTO_CONTENT_KEY_STORAGE_UNAVAILABLE,
    );

    expect(mocks.setItemAsync).not.toHaveBeenCalled();
    expect(mocks.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('preserves malformed SecureStore content keys and refuses new captures', async () => {
    mocks.secureStorage.set(CONTENT_KEY_NAME, 'not-a-hex-key');
    mocks.files.set('file://capture/photo.jpg', Buffer.from('image bytes').toString('base64'));

    await expect(encryptCapturedPhoto('file://capture/photo.jpg', 'photo-1')).rejects.toThrow(
      PHOTO_CONTENT_KEY_INVALID,
    );

    expect(mocks.deleteItemAsync).not.toHaveBeenCalled();
    expect(mocks.setItemAsync).not.toHaveBeenCalled();
    expect(mocks.secureStorage.get(CONTENT_KEY_NAME)).toBe('not-a-hex-key');
    expect(mocks.files.has('file://capture/photo.jpg')).toBe(true);
  });

  it('shares one content key across concurrent first note writes', async () => {
    const [first, second] = await Promise.all([
      encryptPhotoNote('first note'),
      encryptPhotoNote('second note'),
    ]);

    await expect(decryptPhotoNote(first)).resolves.toBe('first note');
    await expect(decryptPhotoNote(second)).resolves.toBe('second note');
  });

  it('does not encrypt new data when the key-history marker cannot persist', async () => {
    mocks.secureStorage.set(CONTENT_KEY_NAME, 'b'.repeat(64));
    mocks.asyncSetThrows = true;

    await expect(encryptPhotoNote('blocked note')).rejects.toThrow(
      PHOTO_CONTENT_KEY_STORAGE_UNAVAILABLE,
    );

    expect(mocks.asyncStorage.has(CONTENT_KEY_MARKER)).toBe(false);
    expect(mocks.secureStorage.get(CONTENT_KEY_NAME)).toBe('b'.repeat(64));
  });

  it('reports authentication failure without replacing a valid but wrong key', async () => {
    const ciphertext = await encryptPhotoNote('baseline note');
    mocks.secureStorage.set(CONTENT_KEY_NAME, 'a'.repeat(64));
    mocks.setItemAsync.mockClear();

    await expect(decryptPhotoNote(ciphertext)).rejects.toThrow(PHOTO_DECRYPTION_FAILED);

    expect(mocks.setItemAsync).not.toHaveBeenCalled();
    expect(mocks.secureStorage.get(CONTENT_KEY_NAME)).toBe('a'.repeat(64));
  });

  it('rejects malformed photo envelopes with a stable storage error', async () => {
    mocks.files.set('file://document/photos/v1/bad.onskinphoto', '{not-json');

    await expect(
      decryptPhotoToDataUri('file://document/photos/v1/bad.onskinphoto'),
    ).rejects.toThrow('PHOTO_ENCRYPTION_ENVELOPE_INVALID');

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

    await expect(
      createPhotoShareFile('file://document/photos/v1/gif.onskinphoto', 'photo-1'),
    ).rejects.toThrow('PHOTO_ENCRYPTION_ENVELOPE_INVALID');
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
    expect(mocks.asyncStorage.has(CONTENT_KEY_MARKER)).toBe(false);
  });
});
