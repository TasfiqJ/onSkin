import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_GENERATION_CHANGED,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';
import { PLAINTEXT_STAGING_JOURNAL_KEY } from '@/lib/storage/plaintextStagingCore';
import { markPlaintextStagingState, reservePlaintextStaging } from '@/lib/storage/plaintextStaging';

import {
  beginEncryptedPhotoAccountBoundary,
  clearEncryptedPhotoStorage,
  createPhotoShareFile,
  decryptPhotoNote,
  decryptPhotoToDataUri,
  deleteCapturedPhotoSource,
  deleteQuarantinedPhoto,
  deletePhotoShareFile,
  encryptCapturedPhoto,
  encryptPhotoNote,
  endEncryptedPhotoAccountBoundary,
  PHOTO_CONTENT_KEY_INVALID,
  PHOTO_CONTENT_KEY_MISSING,
  PHOTO_CONTENT_KEY_STORAGE_UNAVAILABLE,
  PHOTO_DECRYPTION_FAILED,
  PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
  quarantineEncryptedPhoto,
  reconcileEncryptedPhotoStorage,
  restoreQuarantinedPhoto,
  waitForEncryptedPhotoWritesToSettle,
} from './encryptedStorage';

const CONTENT_KEY_NAME = 'onskin.photo.content_key.v1';
const CONTENT_KEY_MARKER = 'onskin.photo.content_key_created.v1';

const mocks = vi.hoisted(() => ({
  asyncSetThrows: false,
  asyncWriteGate: null as Promise<void> | null,
  asyncWriteStarted: null as ((key: string) => void) | null,
  asyncStorage: new Map<string, string>(),
  files: new Map<string, string>(),
  secureStorage: new Map<string, string>(),
  deleteAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
  getInfoAsync: vi.fn(),
  makeDirectoryAsync: vi.fn(),
  moveAsync: vi.fn(),
  platformOS: 'ios',
  readDirectoryAsync: vi.fn(),
  readAsStringAsync: vi.fn(),
  secureGetThrows: false,
  secureSetThrows: false,
  setItemAsync: vi.fn(),
  writeGate: null as Promise<void> | null,
  writeStarted: null as (() => void) | null,
  writeAsStringAsync: vi.fn(),
}));

vi.mock('react-native-get-random-values', () => ({}));

vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
}));

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mocks.platformOS;
    },
  },
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => mocks.asyncStorage.get(key) ?? null),
    removeItem: vi.fn(async (key: string) => {
      mocks.asyncStorage.delete(key);
    }),
    setItem: vi.fn(async (key: string, value: string) => {
      if (mocks.asyncSetThrows) throw new Error('async write failed');
      mocks.asyncWriteStarted?.(key);
      if (mocks.asyncWriteGate) await mocks.asyncWriteGate;
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
  moveAsync: mocks.moveAsync,
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
    mocks.asyncWriteGate = null;
    mocks.asyncWriteStarted = null;
    mocks.asyncStorage.clear();
    mocks.files.clear();
    mocks.secureStorage.clear();
    mocks.deleteAsync.mockReset();
    mocks.deleteItemAsync.mockReset();
    mocks.getItemAsync.mockReset();
    mocks.getInfoAsync.mockReset();
    mocks.makeDirectoryAsync.mockReset();
    mocks.moveAsync.mockReset();
    mocks.platformOS = 'ios';
    mocks.readDirectoryAsync.mockReset();
    mocks.readAsStringAsync.mockReset();
    mocks.secureGetThrows = false;
    mocks.secureSetThrows = false;
    mocks.setItemAsync.mockReset();
    mocks.writeGate = null;
    mocks.writeStarted = null;
    mocks.writeAsStringAsync.mockReset();
    endEncryptedPhotoAccountBoundary();

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
    mocks.moveAsync.mockImplementation(async ({ from, to }: { from: string; to: string }) => {
      const value = mocks.files.get(from);
      if (value == null) throw new Error(`missing file: ${from}`);
      mocks.files.set(to, value);
      mocks.files.delete(from);
    });
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
      mocks.writeStarted?.();
      if (mocks.writeGate) await mocks.writeGate;
      mocks.files.set(uri, value);
    });
  });

  it('blocks new encrypted photo and note writes during an account boundary', async () => {
    beginEncryptedPhotoAccountBoundary();

    await expect(encryptPhotoNote('account A note')).rejects.toThrow(
      PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
    );
    await expect(encryptCapturedPhoto('file://capture.jpg', 'late-photo')).rejects.toThrow(
      PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
    );
    expect(mocks.writeAsStringAsync).not.toHaveBeenCalled();
  });

  it('drains a photo file write already in progress before account cleanup', async () => {
    mocks.files.set('file://capture.jpg', Buffer.from('image bytes').toString('base64'));
    let releaseWrite!: () => void;
    let markWriteStarted!: () => void;
    mocks.writeGate = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    const writeStarted = new Promise<void>((resolve) => {
      markWriteStarted = resolve;
    });
    mocks.writeStarted = markWriteStarted;

    const write = encryptCapturedPhoto('file://capture.jpg', 'account-a-photo');
    await writeStarted;
    beginEncryptedPhotoAccountBoundary();
    let drainFinished = false;
    const drain = waitForEncryptedPhotoWritesToSettle().then(() => {
      drainFinished = true;
    });
    await Promise.resolve();
    expect(drainFinished).toBe(false);

    releaseWrite();
    await write;
    await drain;
    expect(drainFinished).toBe(true);
    expect(mocks.files.has('file://document/photos/v1/account-a-photo.onskinphoto')).toBe(true);
  });

  it('drains a decrypt marker write before account cleanup', async () => {
    const ciphertext = await encryptPhotoNote('account A note');
    mocks.asyncStorage.delete(CONTENT_KEY_MARKER);
    let releaseMarker!: () => void;
    let markWriteStarted!: () => void;
    mocks.asyncWriteGate = new Promise<void>((resolve) => {
      releaseMarker = resolve;
    });
    const writeStarted = new Promise<void>((resolve) => {
      markWriteStarted = resolve;
    });
    mocks.asyncWriteStarted = markWriteStarted;

    const decrypt = decryptPhotoNote(ciphertext);
    await writeStarted;
    beginEncryptedPhotoAccountBoundary();
    let drainFinished = false;
    const drain = waitForEncryptedPhotoWritesToSettle().then(() => {
      drainFinished = true;
    });
    await Promise.resolve();
    expect(drainFinished).toBe(false);

    releaseMarker();
    await expect(decrypt).resolves.toBe('account A note');
    await drain;
    expect(drainFinished).toBe(true);
    expect(mocks.asyncStorage.get(CONTENT_KEY_MARKER)).toBe('1');
  });

  it('round-trips encrypted notes and fails closed for malformed note envelopes', async () => {
    const ciphertext = await encryptPhotoNote('baseline note');

    await expect(decryptPhotoNote(ciphertext)).resolves.toBe('baseline note');
    await expect(decryptPhotoNote('{not-json')).rejects.toThrow(PHOTO_DECRYPTION_FAILED);

    const envelope = JSON.parse(ciphertext ?? '{}') as Record<string, unknown>;
    envelope.nonceHex = '00';

    await expect(decryptPhotoNote(JSON.stringify(envelope))).rejects.toThrow(
      PHOTO_DECRYPTION_FAILED,
    );
  });

  it('publishes encrypted photos with an atomic move and preserves the source on interruption', async () => {
    const sourceUri = 'file://capture/atomic.jpg';
    const finalUri = 'file://document/photos/v1/atomic-photo.onskinphoto';
    mocks.files.set(sourceUri, Buffer.from('image bytes').toString('base64'));

    const result = await encryptCapturedPhoto(sourceUri, 'atomic-photo');

    expect(result.encryptedLocalUri).toBe(finalUri);
    expect(mocks.moveAsync).toHaveBeenCalledWith({
      from: expect.stringMatching(/atomic-photo\.onskinphoto\.tmp-/),
      to: finalUri,
    });
    expect(mocks.files.has(finalUri)).toBe(true);
    expect(mocks.files.has(sourceUri)).toBe(true);

    mocks.files.set(
      'file://capture/interrupted.jpg',
      Buffer.from('retry bytes').toString('base64'),
    );
    mocks.moveAsync.mockRejectedValueOnce(new Error('interrupted move'));

    await expect(
      encryptCapturedPhoto('file://capture/interrupted.jpg', 'interrupted-photo'),
    ).rejects.toThrow('interrupted move');

    expect(mocks.files.has('file://capture/interrupted.jpg')).toBe(true);
    expect(mocks.files.has('file://document/photos/v1/interrupted-photo.onskinphoto')).toBe(false);
    expect(
      [...mocks.files.keys()].some((uri) => uri.includes('interrupted-photo.onskinphoto.tmp-')),
    ).toBe(false);
  });

  it('restores or removes quarantined files according to committed metadata', async () => {
    const directory = 'file://document/photos/v1/';
    const originalUri = `${directory}photo-1.onskinphoto`;
    mocks.files.set(originalUri, 'encrypted');
    mocks.getInfoAsync.mockImplementation(async (uri: string) => ({
      exists: uri === directory || mocks.files.has(uri),
    }));
    mocks.readDirectoryAsync.mockImplementation(async () =>
      [...mocks.files.keys()]
        .filter((uri) => uri.startsWith(directory))
        .map((uri) => uri.slice(directory.length)),
    );

    const first = await quarantineEncryptedPhoto(originalUri, 'delete-1');
    expect(first).not.toBeNull();
    await reconcileEncryptedPhotoStorage([originalUri]);
    expect(mocks.files.has(originalUri)).toBe(true);

    const second = await quarantineEncryptedPhoto(originalUri, 'delete-2');
    expect(second).not.toBeNull();
    await reconcileEncryptedPhotoStorage([]);
    expect(mocks.files.has(originalUri)).toBe(false);
    expect(mocks.files.has(second!.quarantinedUri)).toBe(false);

    mocks.files.set(originalUri, 'encrypted-again');
    const third = await quarantineEncryptedPhoto(originalUri, 'delete-3');
    await restoreQuarantinedPhoto(third!);
    expect(mocks.files.has(originalUri)).toBe(true);
    const fourth = await quarantineEncryptedPhoto(originalUri, 'delete-4');
    await deleteQuarantinedPhoto(fourth!);
    expect(mocks.files.has(fourth!.quarantinedUri)).toBe(false);

    const orphanUri = `${directory}orphan.onskinphoto`;
    const staleQuarantineUri = `${directory}stale.onskinphoto.pending-delete-delete-5`;
    const incompleteUri = `${directory}unfinished.onskinphoto.tmp-1234`;
    mocks.files.set(orphanUri, 'unreferenced-but-unproven');
    mocks.files.set(staleQuarantineUri, 'committed-delete');
    mocks.files.set(incompleteUri, 'partial-write');
    await reconcileEncryptedPhotoStorage([], { removeUnreferencedFinals: false });
    expect(mocks.files.has(orphanUri)).toBe(true);
    expect(mocks.files.has(staleQuarantineUri)).toBe(false);
    expect(mocks.files.has(incompleteUri)).toBe(false);
  });

  it('aborts and drains stale reconciliation before an account switch can publish', async () => {
    const directory = 'file://document/photos/v1/';
    const staleUri = `${directory}account-a.onskinphoto.pending-delete-delete-1`;
    mocks.files.set(staleUri, 'account-a-encrypted');
    mocks.getInfoAsync.mockResolvedValue({ exists: true });

    let releaseDirectoryRead!: () => void;
    let markDirectoryReadStarted!: () => void;
    const directoryReadGate = new Promise<void>((resolve) => {
      releaseDirectoryRead = resolve;
    });
    const directoryReadStarted = new Promise<void>((resolve) => {
      markDirectoryReadStarted = resolve;
    });
    mocks.readDirectoryAsync.mockImplementationOnce(async () => {
      markDirectoryReadStarted();
      await directoryReadGate;
      return ['account-a.onskinphoto.pending-delete-delete-1'];
    });

    const reconciliation = reconcileEncryptedPhotoStorage([]);
    await directoryReadStarted;
    beginAccountGenerationBoundary();
    beginEncryptedPhotoAccountBoundary();

    try {
      let drainFinished = false;
      const drain = Promise.all([
        waitForAccountGenerationOperationsToSettle(),
        waitForEncryptedPhotoWritesToSettle(),
      ]).then(() => {
        drainFinished = true;
      });
      await Promise.resolve();
      expect(drainFinished).toBe(false);

      releaseDirectoryRead();
      await expect(reconciliation).rejects.toThrow(ACCOUNT_GENERATION_CHANGED);
      await drain;

      expect(drainFinished).toBe(true);
      expect(mocks.files.get(staleUri)).toBe('account-a-encrypted');
    } finally {
      endEncryptedPhotoAccountBoundary();
      endAccountGenerationBoundary();
    }

    mocks.readDirectoryAsync.mockResolvedValue(['account-a.onskinphoto.pending-delete-delete-1']);
    await reconcileEncryptedPhotoStorage([]);
    expect(mocks.files.has(staleUri)).toBe(false);
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

  it('detects interrupted encrypted-photo files before creating a replacement key', async () => {
    mocks.getInfoAsync.mockResolvedValue({ exists: true });
    mocks.readDirectoryAsync.mockResolvedValue([
      'interrupted.onskinphoto.pending-delete-delete-1',
      'unfinished.onskinphoto.tmp-1234',
    ]);

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

  it('does not complete decryption when key-history persistence fails', async () => {
    const ciphertext = await encryptPhotoNote('baseline note');
    mocks.asyncSetThrows = true;

    await expect(decryptPhotoNote(ciphertext)).rejects.toThrow(
      PHOTO_CONTENT_KEY_STORAGE_UNAVAILABLE,
    );
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

    await expect(createPhotoShareFile('file://document/photos/v1/gif.onskinphoto')).rejects.toThrow(
      'PHOTO_ENCRYPTION_ENVELOPE_INVALID',
    );
  });

  it('exports encrypted photos to owned cache files and only deletes those exports', async () => {
    mocks.files.set('file://capture/photo.png', Buffer.from('png bytes').toString('base64'));

    const encrypted = await encryptCapturedPhoto('file://capture/photo.png', 'photo-1');
    const operationOrder: string[] = [];
    mocks.asyncWriteStarted = (key) => {
      if (key === PLAINTEXT_STAGING_JOURNAL_KEY) operationOrder.push('journal');
    };
    mocks.writeStarted = () => operationOrder.push('plaintext');
    const shareUri = await createPhotoShareFile(encrypted.encryptedLocalUri);

    expect(shareUri).toBe(
      'file://cache/private-plaintext-staging-v1/aaaaaaaaaaaa4aaa8aaaaaaaaaaaaaaa.png',
    );
    expect(mocks.files.get(shareUri)).toBe(Buffer.from('png bytes').toString('base64'));
    expect(operationOrder.slice(0, 2)).toEqual(['journal', 'plaintext']);

    mocks.files.set('file://cache/not-owned.png', 'external');
    await deletePhotoShareFile('file://cache/not-owned.png', encrypted.encryptedLocalUri);
    expect(mocks.files.get('file://cache/not-owned.png')).toBe('external');

    await deletePhotoShareFile(shareUri, encrypted.encryptedLocalUri);
    expect(mocks.files.has(shareUri)).toBe(false);
  });

  it('removes a committed capture source through its durable staging journal', async () => {
    const handle = await reservePlaintextStaging('photo_capture_jpeg');
    mocks.files.set(handle.uri, 'camera plaintext');
    await markPlaintextStagingState(handle, 'plaintext_written');

    await deleteCapturedPhotoSource(handle.uri);

    expect(mocks.files.has(handle.uri)).toBe(false);
    expect(mocks.asyncStorage.has(PLAINTEXT_STAGING_JOURNAL_KEY)).toBe(false);
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

  it('reports photo cleanup failure after attempting every destructive store', async () => {
    mocks.secureStorage.set(CONTENT_KEY_NAME, 'a'.repeat(64));
    mocks.asyncStorage.set(CONTENT_KEY_MARKER, '1');
    mocks.deleteAsync.mockRejectedValueOnce(new Error('photo directory unavailable'));

    await expect(clearEncryptedPhotoStorage()).rejects.toThrow('PHOTO_STORAGE_CLEAR_FAILED:1');

    expect(mocks.deleteItemAsync).toHaveBeenCalledWith(CONTENT_KEY_NAME);
    expect(mocks.secureStorage.has(CONTENT_KEY_NAME)).toBe(false);
    expect(mocks.asyncStorage.has(CONTENT_KEY_MARKER)).toBe(false);
  });

  it('clears web photo authorities without calling unavailable SecureStore', async () => {
    mocks.platformOS = 'web';
    mocks.asyncStorage.set(CONTENT_KEY_MARKER, '1');

    await expect(clearEncryptedPhotoStorage()).resolves.toBeUndefined();

    expect(mocks.deleteItemAsync).not.toHaveBeenCalled();
    expect(mocks.asyncStorage.has(CONTENT_KEY_MARKER)).toBe(false);
  });
});
