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
  deleteEncryptedPhoto,
  deleteQuarantinedPhoto,
  deletePhotoShareFile,
  discardPendingEncryptedPhotoForRetry,
  encryptedPhotoUriForId,
  encryptCapturedPhoto,
  encryptPhotoNote,
  endEncryptedPhotoAccountBoundary,
  finalizeEncryptedPhotoDeletions,
  isOwnedEncryptedPhotoUri,
  PHOTO_CONTENT_KEY_INVALID,
  PHOTO_CONTENT_KEY_MARKER_INVALID,
  PHOTO_CONTENT_KEY_MARKER_KEY_MISMATCH,
  PHOTO_CONTENT_KEY_MARKER_UNSUPPORTED_VERSION,
  PHOTO_CONTENT_KEY_MISSING,
  PHOTO_CONTENT_KEY_STORAGE_UNAVAILABLE,
  PHOTO_DECRYPTION_FAILED,
  PHOTO_RECOVERY_CANDIDATE_CHANGED,
  PHOTO_RECOVERY_CANDIDATE_READ_FAILED,
  PHOTO_RECOVERY_CANDIDATE_UNAUTHENTICATED,
  PHOTO_RECOVERY_CONFLICT,
  PHOTO_RECOVERY_KEY_CHANGED,
  PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
  quarantineEncryptedPhoto,
  reconcileEncryptedPhotoStorage,
  recoverPreparedEncryptedPhoto,
  restoreQuarantinedPhoto,
  stageEncryptedPhotoDeletions,
  verifyEncryptedPhotoDeletionSources,
  waitForEncryptedPhotoWritesToSettle,
} from './encryptedStorage';

const CONTENT_KEY_NAME = 'onskin.photo.content_key.v1';
const CONTENT_KEY_MARKER = 'onskin.photo.content_key_created.v1';
const CONTENT_KEY_MARKER_CURRENT = `v1:created:${'a'.repeat(64)}`;
const CONTENT_KEY_MARKER_UNBOUND_LEGACY = 'v1:created';
const CONTENT_KEY_MARKER_LEGACY = '1';
const CONTENT_KEY_MARKER_PENDING = `v1:pending:${'a'.repeat(64)}`;
const PHOTO_DIR = 'file://document/photos/v1/';

const mocks = vi.hoisted(() => ({
  asyncGetThrows: false,
  asyncSetCommitsThenThrows: false,
  asyncSetDrops: false,
  asyncSetThrows: false,
  asyncGetItem: vi.fn(),
  asyncRemoveItem: vi.fn(),
  asyncSetItem: vi.fn(),
  asyncWriteGate: null as Promise<void> | null,
  asyncWriteStarted: null as ((key: string) => void) | null,
  asyncStorage: new Map<string, string>(),
  files: new Map<string, string>(),
  secureStorage: new Map<string, string>(),
  deleteAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
  digestStringAsync: vi.fn(),
  getItemAsync: vi.fn(),
  getInfoAsync: vi.fn(),
  makeDirectoryAsync: vi.fn(),
  moveAsync: vi.fn(),
  platformOS: 'ios',
  readDirectoryAsync: vi.fn(),
  readAsStringAsync: vi.fn(),
  secureGetThrows: false,
  secureSetCommitsThenThrows: false,
  secureSetDrops: false,
  secureSetThrows: false,
  secureSetWrongValue: false,
  setItemAsync: vi.fn(),
  writeGate: null as Promise<void> | null,
  writeStarted: null as (() => void) | null,
  writeAsStringAsync: vi.fn(),
}));

vi.mock('react-native-get-random-values', () => ({}));

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: mocks.digestStringAsync,
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
    getItem: mocks.asyncGetItem,
    removeItem: mocks.asyncRemoveItem,
    setItem: mocks.asyncSetItem,
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
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 7,
  deleteItemAsync: mocks.deleteItemAsync,
  getItemAsync: mocks.getItemAsync,
  setItemAsync: mocks.setItemAsync,
}));

function configureDirectoryBackedFileMocks(): void {
  mocks.getInfoAsync.mockImplementation(async (uri: string) => ({
    exists: uri === PHOTO_DIR || mocks.files.has(uri),
  }));
  mocks.readDirectoryAsync.mockImplementation(async () =>
    [...mocks.files.keys()]
      .filter((uri) => uri.startsWith(PHOTO_DIR))
      .map((uri) => uri.slice(PHOTO_DIR.length)),
  );
}

async function createAuthenticatedPhotoEnvelope(
  photoId: string,
  plaintext = `image-bytes-${photoId}`,
): Promise<{ uri: string; raw: string }> {
  const sourceUri = `file://capture/${photoId}.jpg`;
  mocks.files.set(sourceUri, Buffer.from(plaintext).toString('base64'));
  const encrypted = await encryptCapturedPhoto(sourceUri, photoId);
  const raw = mocks.files.get(encrypted.encryptedLocalUri);
  if (raw == null) throw new Error('test envelope was not persisted');
  return { uri: encrypted.encryptedLocalUri, raw };
}

function encryptedAuthoritySnapshot() {
  const sortedEntries = (entries: Iterable<[string, string]>) =>
    [...entries].sort(([left], [right]) => left.localeCompare(right));
  return {
    files: sortedEntries(mocks.files.entries()),
    secureStorage: sortedEntries(mocks.secureStorage.entries()),
    asyncStorage: sortedEntries(mocks.asyncStorage.entries()),
  };
}

describe('encrypted photo storage', () => {
  beforeEach(() => {
    mocks.asyncGetThrows = false;
    mocks.asyncSetCommitsThenThrows = false;
    mocks.asyncSetDrops = false;
    mocks.asyncSetThrows = false;
    mocks.asyncGetItem.mockReset();
    mocks.asyncRemoveItem.mockReset();
    mocks.asyncSetItem.mockReset();
    mocks.asyncWriteGate = null;
    mocks.asyncWriteStarted = null;
    mocks.asyncStorage.clear();
    mocks.files.clear();
    mocks.secureStorage.clear();
    mocks.deleteAsync.mockReset();
    mocks.deleteItemAsync.mockReset();
    mocks.digestStringAsync.mockReset();
    mocks.getItemAsync.mockReset();
    mocks.getInfoAsync.mockReset();
    mocks.makeDirectoryAsync.mockReset();
    mocks.moveAsync.mockReset();
    mocks.platformOS = 'ios';
    mocks.readDirectoryAsync.mockReset();
    mocks.readAsStringAsync.mockReset();
    mocks.secureGetThrows = false;
    mocks.secureSetCommitsThenThrows = false;
    mocks.secureSetDrops = false;
    mocks.secureSetThrows = false;
    mocks.secureSetWrongValue = false;
    mocks.setItemAsync.mockReset();
    mocks.writeGate = null;
    mocks.writeStarted = null;
    mocks.writeAsStringAsync.mockReset();
    endEncryptedPhotoAccountBoundary();

    mocks.digestStringAsync.mockImplementation(async (_algorithm: string, value: string) =>
      value.endsWith('c'.repeat(64)) ? 'c'.repeat(64) : 'a'.repeat(64),
    );

    mocks.asyncGetItem.mockImplementation(async (key: string) => {
      if (mocks.asyncGetThrows) throw new Error('async read failed');
      return mocks.asyncStorage.get(key) ?? null;
    });
    mocks.asyncRemoveItem.mockImplementation(async (key: string) => {
      mocks.asyncStorage.delete(key);
    });
    mocks.asyncSetItem.mockImplementation(async (key: string, value: string) => {
      if (mocks.asyncSetThrows) throw new Error('async write failed');
      mocks.asyncWriteStarted?.(key);
      if (mocks.asyncWriteGate) await mocks.asyncWriteGate;
      if (mocks.asyncSetDrops) return;
      mocks.asyncStorage.set(key, value);
      if (mocks.asyncSetCommitsThenThrows) throw new Error('async post-commit failure');
    });
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
      if (mocks.secureSetDrops) return;
      mocks.secureStorage.set(key, mocks.secureSetWrongValue ? 'c'.repeat(64) : value);
      if (mocks.secureSetCommitsThenThrows) throw new Error('secure post-commit failure');
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
    await expect(write).rejects.toThrow(PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY);
    await drain;
    expect(drainFinished).toBe(true);
    expect(mocks.files.has('file://document/photos/v1/account-a-photo.onskinphoto')).toBe(true);
    endEncryptedPhotoAccountBoundary();
  });

  it('drains an in-flight key-marker write and rejects owner-A ciphertext publication', async () => {
    mocks.secureStorage.set(CONTENT_KEY_NAME, 'b'.repeat(64));
    let releaseMarkerWrite!: () => void;
    let markMarkerWriteStarted!: () => void;
    mocks.asyncWriteGate = new Promise<void>((resolve) => {
      releaseMarkerWrite = resolve;
    });
    const markerWriteStarted = new Promise<void>((resolve) => {
      markMarkerWriteStarted = resolve;
    });
    mocks.asyncWriteStarted = (key) => {
      if (key === CONTENT_KEY_MARKER) markMarkerWriteStarted();
    };

    const write = encryptPhotoNote('account A note');
    await markerWriteStarted;
    beginEncryptedPhotoAccountBoundary();
    let drainFinished = false;
    const drain = waitForEncryptedPhotoWritesToSettle().then(() => {
      drainFinished = true;
    });
    await Promise.resolve();
    expect(drainFinished).toBe(false);

    releaseMarkerWrite();
    await expect(write).rejects.toThrow(PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY);
    await drain;
    expect(drainFinished).toBe(true);
    expect(mocks.asyncStorage.get(CONTENT_KEY_MARKER)).toBe(CONTENT_KEY_MARKER_CURRENT);
    endEncryptedPhotoAccountBoundary();
  });

  it('keeps a share-file read on the mutation drain because it can publish plaintext', async () => {
    const encrypted = await createAuthenticatedPhotoEnvelope('delayed-share');
    let releaseRead!: () => void;
    let markReadStarted!: () => void;
    const readGate = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const readStarted = new Promise<void>((resolve) => {
      markReadStarted = resolve;
    });
    mocks.readAsStringAsync.mockImplementationOnce(async (uri: string) => {
      markReadStarted();
      await readGate;
      const raw = mocks.files.get(uri);
      if (raw == null) throw new Error(`missing file: ${uri}`);
      return raw;
    });
    mocks.writeAsStringAsync.mockClear();

    const share = createPhotoShareFile(encrypted.uri);
    const outcome = share.then(
      (value) => ({ status: 'resolved' as const, value }),
      (error: unknown) => ({ status: 'rejected' as const, error }),
    );
    await readStarted;
    beginEncryptedPhotoAccountBoundary();
    try {
      let drainFinished = false;
      const drain = waitForEncryptedPhotoWritesToSettle().then(() => {
        drainFinished = true;
      });
      await Promise.resolve();
      expect(drainFinished).toBe(false);

      releaseRead();
      const rejected = await outcome;
      expect(rejected.status).toBe('rejected');
      expect((rejected as { error: Error }).error.message).toBe(
        PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
      );
      await drain;
      expect(drainFinished).toBe(true);
      expect(mocks.writeAsStringAsync).not.toHaveBeenCalled();
    } finally {
      releaseRead();
      endEncryptedPhotoAccountBoundary();
    }
  });

  it('drains an exported encrypted-file delete that crosses an account boundary', async () => {
    const encrypted = await createAuthenticatedPhotoEnvelope('delayed-direct-delete');
    let releaseDelete!: () => void;
    let markDeleteStarted!: () => void;
    const deleteGate = new Promise<void>((resolve) => {
      releaseDelete = resolve;
    });
    const deleteStarted = new Promise<void>((resolve) => {
      markDeleteStarted = resolve;
    });
    mocks.deleteAsync.mockImplementationOnce(async (uri: string) => {
      markDeleteStarted();
      await deleteGate;
      mocks.files.delete(uri);
    });

    const deletion = deleteEncryptedPhoto(encrypted.uri);
    const outcome = deletion.then(
      () => ({ status: 'resolved' as const }),
      (error: unknown) => ({ status: 'rejected' as const, error }),
    );
    await deleteStarted;
    beginEncryptedPhotoAccountBoundary();
    try {
      let drainFinished = false;
      const drain = waitForEncryptedPhotoWritesToSettle().then(() => {
        drainFinished = true;
      });
      await Promise.resolve();
      expect(drainFinished).toBe(false);

      releaseDelete();
      const rejected = await outcome;
      expect(rejected.status).toBe('rejected');
      expect((rejected as { error: Error }).error.message).toBe(
        PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
      );
      await drain;
      expect(drainFinished).toBe(true);
      expect(mocks.files.has(encrypted.uri)).toBe(false);
    } finally {
      releaseDelete();
      endEncryptedPhotoAccountBoundary();
    }
  });

  it('decrypts notes without writing the key-creation marker', async () => {
    const ciphertext = await encryptPhotoNote('account A note');
    mocks.asyncStorage.delete(CONTENT_KEY_MARKER);
    mocks.asyncSetItem.mockClear();

    await expect(decryptPhotoNote(ciphertext)).resolves.toBe('account A note');

    expect(mocks.asyncSetItem).not.toHaveBeenCalled();
    expect(mocks.asyncStorage.has(CONTENT_KEY_MARKER)).toBe(false);
  });

  it('decrypts photo envelopes without writing files, keys, or marker bytes', async () => {
    const encrypted = await createAuthenticatedPhotoEnvelope('read-only-photo');
    mocks.asyncStorage.delete(CONTENT_KEY_MARKER);
    mocks.asyncSetItem.mockClear();
    mocks.setItemAsync.mockClear();
    mocks.writeAsStringAsync.mockClear();
    mocks.moveAsync.mockClear();
    mocks.deleteAsync.mockClear();
    const before = encryptedAuthoritySnapshot();

    await expect(decryptPhotoToDataUri(encrypted.uri)).resolves.toMatch(
      /^data:image\/jpeg;base64,/,
    );

    expect(encryptedAuthoritySnapshot()).toEqual(before);
    expect(mocks.asyncSetItem).not.toHaveBeenCalled();
    expect(mocks.setItemAsync).not.toHaveBeenCalled();
    expect(mocks.writeAsStringAsync).not.toHaveBeenCalled();
    expect(mocks.moveAsync).not.toHaveBeenCalled();
    expect(mocks.deleteAsync).not.toHaveBeenCalled();
  });

  it('detaches a never-resolving decrypt from the write drain and suppresses its late plaintext', async () => {
    const encrypted = await createAuthenticatedPhotoEnvelope('delayed-owner-a-decrypt');
    let releaseRead!: () => void;
    let markReadStarted!: () => void;
    const readGate = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const readStarted = new Promise<void>((resolve) => {
      markReadStarted = resolve;
    });
    mocks.readAsStringAsync.mockImplementationOnce(async (uri: string) => {
      markReadStarted();
      await readGate;
      const raw = mocks.files.get(uri);
      if (raw == null) throw new Error(`missing file: ${uri}`);
      return raw;
    });

    const decrypt = decryptPhotoToDataUri(encrypted.uri);
    let plaintextPublished = false;
    const outcome = decrypt.then(
      (value) => {
        plaintextPublished = true;
        return { status: 'resolved' as const, value };
      },
      (error: unknown) => ({ status: 'rejected' as const, error }),
    );
    await readStarted;
    beginEncryptedPhotoAccountBoundary();
    try {
      // The native read is still unresolved. Pure reads must not pin the
      // mutation drain or the public owner-bound wrapper.
      await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
      await expect(waitForEncryptedPhotoWritesToSettle()).resolves.toBeUndefined();
      const rejected = await outcome;
      expect(rejected.status).toBe('rejected');
      expect((rejected as { error: Error }).error.message).toBe(
        PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
      );
      expect(plaintextPublished).toBe(false);

      // A non-cancellable native completion after invalidation remains
      // rejection-handled and cannot reach the public result.
      releaseRead();
      await Promise.resolve();
      await Promise.resolve();
      expect(plaintextPublished).toBe(false);
    } finally {
      releaseRead();
      endEncryptedPhotoAccountBoundary();
    }
  });

  it('detaches a never-resolving key read from both drains on account-generation change', async () => {
    const ciphertext = await encryptPhotoNote('owner A secret note');
    let rejectKeyRead!: (error: Error) => void;
    let markKeyReadStarted!: () => void;
    const keyReadStarted = new Promise<void>((resolve) => {
      markKeyReadStarted = resolve;
    });
    const keyRead = new Promise<string>((_resolve, reject) => {
      rejectKeyRead = reject;
    });
    mocks.getItemAsync.mockImplementationOnce(() => {
      markKeyReadStarted();
      return keyRead;
    });

    let plaintextPublished = false;
    const decrypt = decryptPhotoNote(ciphertext);
    const outcome = decrypt.then(
      (value) => {
        plaintextPublished = true;
        return { status: 'resolved' as const, value };
      },
      (error: unknown) => ({ status: 'rejected' as const, error }),
    );
    await keyReadStarted;
    beginAccountGenerationBoundary();
    try {
      await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
      await expect(waitForEncryptedPhotoWritesToSettle()).resolves.toBeUndefined();
      const rejected = await outcome;
      expect(rejected.status).toBe('rejected');
      expect((rejected as { error: Error }).error.message).toBe(ACCOUNT_GENERATION_CHANGED);
      expect(plaintextPublished).toBe(false);
      await expect(decryptPhotoNote(ciphertext)).rejects.toThrow(ACCOUNT_GENERATION_CHANGED);

      // The detached SecureStore read can fail much later. The read wrapper
      // retains a rejection handler even though its public promise is settled.
      rejectKeyRead(new Error('late native key-read failure'));
      await Promise.resolve();
      await Promise.resolve();
      expect(plaintextPublished).toBe(false);
    } finally {
      rejectKeyRead(new Error('late native key-read failure'));
      endAccountGenerationBoundary();
    }
  });

  it('keeps reads and write-capable pass-throughs blocked until nested photo boundaries end', async () => {
    const ciphertext = await encryptPhotoNote('baseline note');
    beginEncryptedPhotoAccountBoundary();
    beginEncryptedPhotoAccountBoundary();

    try {
      await expect(decryptPhotoNote(ciphertext)).rejects.toThrow(
        PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
      );
      await expect(decryptPhotoNote(null)).rejects.toThrow(
        PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
      );
      await expect(decryptPhotoToDataUri('file://cache/plaintext.jpg')).rejects.toThrow(
        PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
      );
      await expect(createPhotoShareFile('file://cache/plaintext.jpg')).rejects.toThrow(
        PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
      );

      endEncryptedPhotoAccountBoundary();
      await expect(decryptPhotoNote(ciphertext)).rejects.toThrow(
        PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
      );

      endEncryptedPhotoAccountBoundary();
      await expect(decryptPhotoNote(ciphertext)).resolves.toBe('baseline note');
    } finally {
      endEncryptedPhotoAccountBoundary();
      endEncryptedPhotoAccountBoundary();
    }
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
      from: `${finalUri}.pending-add-atomic-photo`,
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

  it('recovers the exact deterministic pending add and keeps a valid final authoritative', async () => {
    const photoId = 'prepared-photo';
    const prepared = await createAuthenticatedPhotoEnvelope(photoId, 'prepared bytes');
    const pendingUri = `${prepared.uri}.pending-add-${photoId}`;
    mocks.files.delete(prepared.uri);
    mocks.files.set(pendingUri, prepared.raw);
    configureDirectoryBackedFileMocks();

    await expect(recoverPreparedEncryptedPhoto(prepared.uri, photoId)).resolves.toBe(true);
    expect(mocks.files.get(prepared.uri)).toBe(prepared.raw);
    expect(mocks.files.has(pendingUri)).toBe(false);

    mocks.files.set(pendingUri, '{"version":"interrupted"');
    await expect(recoverPreparedEncryptedPhoto(prepared.uri, photoId)).resolves.toBe(true);

    expect(mocks.files.get(prepared.uri)).toBe(prepared.raw);
    expect(mocks.files.has(pendingUri)).toBe(false);
  });

  it('preserves a partial pending add until an exact staged source authorizes retry discard', async () => {
    await createAuthenticatedPhotoEnvelope('partial-key-seed');
    const photoId = 'partial-pending';
    const finalUri = encryptedPhotoUriForId(photoId);
    const pendingUri = `${finalUri}.pending-add-${photoId}`;
    const partialBytes = '{"version":"xchacha20poly1305:v1","ciphertextHex":"00"';
    mocks.files.set(pendingUri, partialBytes);
    configureDirectoryBackedFileMocks();

    await expect(recoverPreparedEncryptedPhoto(finalUri, photoId)).rejects.toThrow(
      PHOTO_RECOVERY_CANDIDATE_UNAUTHENTICATED,
    );
    expect(mocks.files.get(pendingUri)).toBe(partialBytes);

    await expect(discardPendingEncryptedPhotoForRetry(finalUri, photoId)).resolves.toBe(true);
    expect(mocks.files.has(pendingUri)).toBe(false);
    expect(mocks.files.has(finalUri)).toBe(false);
  });

  it('stages and finalizes only exact authenticated canonical deletion targets', async () => {
    const first = await createAuthenticatedPhotoEnvelope('delete-first', 'first bytes');
    const second = await createAuthenticatedPhotoEnvelope('delete-second', 'second bytes');
    const unknown = await createAuthenticatedPhotoEnvelope('leave-unknown', 'unknown bytes');
    const operationId = 'exact-delete';
    const firstQuarantine = `${first.uri}.pending-delete-${operationId}`;
    const secondQuarantine = `${second.uri}.pending-delete-${operationId}`;
    configureDirectoryBackedFileMocks();

    await expect(
      verifyEncryptedPhotoDeletionSources([first.uri, second.uri]),
    ).resolves.toBeUndefined();
    await stageEncryptedPhotoDeletions([first.uri, second.uri], operationId);

    expect(mocks.files.has(first.uri)).toBe(false);
    expect(mocks.files.has(second.uri)).toBe(false);
    expect(mocks.files.get(firstQuarantine)).toBe(first.raw);
    expect(mocks.files.get(secondQuarantine)).toBe(second.raw);
    expect(mocks.files.get(unknown.uri)).toBe(unknown.raw);

    await finalizeEncryptedPhotoDeletions([first.uri, second.uri], operationId);

    expect(mocks.files.has(firstQuarantine)).toBe(false);
    expect(mocks.files.has(secondQuarantine)).toBe(false);
    expect(mocks.files.get(unknown.uri)).toBe(unknown.raw);
  });

  it('rejects unsafe or nonowned encrypted paths without moving or deleting them', async () => {
    const unsafePaths = [
      'file://outside/private.onskinphoto',
      `${PHOTO_DIR}../outside.onskinphoto`,
      `${PHOTO_DIR}nested/photo.onskinphoto`,
      `${PHOTO_DIR}%2e%2e.onskinphoto`,
      `${PHOTO_DIR}back\\slash.onskinphoto`,
    ];
    for (const uri of unsafePaths) mocks.files.set(uri, 'must remain exact');
    configureDirectoryBackedFileMocks();
    mocks.moveAsync.mockClear();
    mocks.deleteAsync.mockClear();

    expect(isOwnedEncryptedPhotoUri(`${PHOTO_DIR}safe-photo_1.onskinphoto`)).toBe(true);
    for (const uri of unsafePaths) {
      expect(isOwnedEncryptedPhotoUri(uri)).toBe(false);
      await expect(verifyEncryptedPhotoDeletionSources([uri])).rejects.toThrow(
        PHOTO_RECOVERY_CONFLICT,
      );
      await expect(stageEncryptedPhotoDeletions([uri], 'unsafe-delete')).rejects.toThrow(
        PHOTO_RECOVERY_CONFLICT,
      );
      await expect(deleteEncryptedPhoto(uri)).rejects.toThrow(PHOTO_RECOVERY_CONFLICT);
    }

    expect(mocks.moveAsync).not.toHaveBeenCalled();
    expect(mocks.deleteAsync).not.toHaveBeenCalled();
    for (const uri of unsafePaths) expect(mocks.files.get(uri)).toBe('must remain exact');
  });

  it('replays file moves and deletes that committed before their promise rejected', async () => {
    const target = await createAuthenticatedPhotoEnvelope('commit-then-reject');
    const operationId = 'replay-delete';
    const quarantineUri = `${target.uri}.pending-delete-${operationId}`;
    configureDirectoryBackedFileMocks();
    mocks.moveAsync.mockImplementationOnce(async ({ from, to }: { from: string; to: string }) => {
      const raw = mocks.files.get(from);
      if (raw == null) throw new Error(`missing file: ${from}`);
      mocks.files.set(to, raw);
      mocks.files.delete(from);
      throw new Error('move reported failure after commit');
    });

    await expect(stageEncryptedPhotoDeletions([target.uri], operationId)).rejects.toThrow(
      'move reported failure after commit',
    );
    expect(mocks.files.get(quarantineUri)).toBe(target.raw);
    await expect(
      stageEncryptedPhotoDeletions([target.uri], operationId),
    ).resolves.toBeUndefined();

    mocks.deleteAsync.mockImplementationOnce(async (uri: string) => {
      mocks.files.delete(uri);
      throw new Error('delete reported failure after commit');
    });
    await expect(finalizeEncryptedPhotoDeletions([target.uri], operationId)).rejects.toThrow(
      'delete reported failure after commit',
    );
    await expect(
      finalizeEncryptedPhotoDeletions([target.uri], operationId),
    ).resolves.toBeUndefined();
    expect(mocks.files.has(target.uri)).toBe(false);
    expect(mocks.files.has(quarantineUri)).toBe(false);
  });

  it('restores or removes quarantined files according to committed metadata', async () => {
    const { uri: originalUri, raw } = await createAuthenticatedPhotoEnvelope('photo-1');
    configureDirectoryBackedFileMocks();

    const first = await quarantineEncryptedPhoto(originalUri, 'delete-1');
    expect(first).not.toBeNull();
    await reconcileEncryptedPhotoStorage([originalUri]);
    expect(mocks.files.get(originalUri)).toBe(raw);

    const second = await quarantineEncryptedPhoto(originalUri, 'delete-2');
    expect(second).not.toBeNull();
    await reconcileEncryptedPhotoStorage([]);
    expect(mocks.files.has(originalUri)).toBe(false);
    expect(mocks.files.has(second!.quarantinedUri)).toBe(false);

    mocks.files.set(originalUri, raw);
    const third = await quarantineEncryptedPhoto(originalUri, 'delete-3');
    await restoreQuarantinedPhoto(third!);
    expect(mocks.files.has(originalUri)).toBe(true);
    const fourth = await quarantineEncryptedPhoto(originalUri, 'delete-4');
    await deleteQuarantinedPhoto(fourth!);
    expect(mocks.files.has(fourth!.quarantinedUri)).toBe(false);

    const orphanUri = `${PHOTO_DIR}orphan.onskinphoto`;
    const staleQuarantineUri = `${PHOTO_DIR}stale.onskinphoto.pending-delete-delete-5`;
    const incompleteUri = `${PHOTO_DIR}unfinished.onskinphoto.tmp-1234`;
    mocks.files.set(orphanUri, raw);
    mocks.files.set(staleQuarantineUri, raw);
    mocks.files.set(incompleteUri, raw);
    await reconcileEncryptedPhotoStorage([], { removeUnreferencedFinals: false });
    expect(mocks.files.get(orphanUri)).toBe(raw);
    expect(mocks.files.has(staleQuarantineUri)).toBe(false);
    expect(mocks.files.has(incompleteUri)).toBe(false);
  });

  it('preserves both files when a quarantine destination already exists', async () => {
    const original = await createAuthenticatedPhotoEnvelope('quarantine-source', 'source bytes');
    const previous = await createAuthenticatedPhotoEnvelope('quarantine-previous', 'prior bytes');
    mocks.files.delete(previous.uri);
    const quarantinedUri = `${original.uri}.pending-delete-duplicate-operation`;
    mocks.files.set(quarantinedUri, previous.raw);
    configureDirectoryBackedFileMocks();
    mocks.moveAsync.mockClear();
    const before = encryptedAuthoritySnapshot();

    await expect(quarantineEncryptedPhoto(original.uri, 'duplicate-operation')).rejects.toThrow(
      PHOTO_RECOVERY_CONFLICT,
    );

    expect(encryptedAuthoritySnapshot()).toEqual(before);
    expect(mocks.moveAsync).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', () => mocks.secureStorage.delete(CONTENT_KEY_NAME), PHOTO_CONTENT_KEY_MISSING],
    [
      'malformed',
      () => mocks.secureStorage.set(CONTENT_KEY_NAME, 'malformed-key-bytes'),
      PHOTO_CONTENT_KEY_INVALID,
    ],
    [
      'temporarily unavailable',
      () => {
        mocks.secureGetThrows = true;
      },
      PHOTO_CONTENT_KEY_STORAGE_UNAVAILABLE,
    ],
    [
      'valid but wrong',
      () => mocks.secureStorage.set(CONTENT_KEY_NAME, 'a'.repeat(64)),
      PHOTO_RECOVERY_CANDIDATE_UNAUTHENTICATED,
    ],
  ])(
    'preserves every candidate and authority byte when the recovery key is %s',
    async (_label, configureKey, expectedError) => {
      const seed = await createAuthenticatedPhotoEnvelope('recovery-key-seed');
      mocks.files.delete(seed.uri);
      const candidateUri = `${PHOTO_DIR}orphan.onskinphoto`;
      mocks.files.set(candidateUri, seed.raw);
      configureDirectoryBackedFileMocks();
      configureKey();
      mocks.deleteAsync.mockClear();
      mocks.moveAsync.mockClear();
      mocks.setItemAsync.mockClear();
      mocks.deleteItemAsync.mockClear();
      mocks.asyncSetItem.mockClear();
      const before = encryptedAuthoritySnapshot();

      await expect(reconcileEncryptedPhotoStorage([])).rejects.toThrow(expectedError);

      expect(encryptedAuthoritySnapshot()).toEqual(before);
      expect(mocks.deleteAsync).not.toHaveBeenCalled();
      expect(mocks.moveAsync).not.toHaveBeenCalled();
      expect(mocks.setItemAsync).not.toHaveBeenCalled();
      expect(mocks.deleteItemAsync).not.toHaveBeenCalled();
      expect(mocks.asyncSetItem).not.toHaveBeenCalled();
    },
  );

  it('preserves all candidates when envelopes require conflicting keys', async () => {
    const first = await createAuthenticatedPhotoEnvelope('first-key-photo', 'first bytes');
    const firstKey = mocks.secureStorage.get(CONTENT_KEY_NAME)!;
    mocks.secureStorage.set(CONTENT_KEY_NAME, 'b'.repeat(64));
    const second = await createAuthenticatedPhotoEnvelope('second-key-photo', 'second bytes');
    mocks.secureStorage.set(CONTENT_KEY_NAME, firstKey);
    const malformedUri = `${PHOTO_DIR}malformed.onskinphoto.tmp-1`;
    mocks.files.set(malformedUri, '{not-json');
    configureDirectoryBackedFileMocks();
    mocks.deleteAsync.mockClear();
    mocks.moveAsync.mockClear();
    const before = encryptedAuthoritySnapshot();

    await expect(reconcileEncryptedPhotoStorage([])).rejects.toThrow(
      PHOTO_RECOVERY_CANDIDATE_UNAUTHENTICATED,
    );

    expect(mocks.files.get(first.uri)).toBe(first.raw);
    expect(mocks.files.get(second.uri)).toBe(second.raw);
    expect(mocks.files.get(malformedUri)).toBe('{not-json');
    expect(encryptedAuthoritySnapshot()).toEqual(before);
    expect(mocks.deleteAsync).not.toHaveBeenCalled();
    expect(mocks.moveAsync).not.toHaveBeenCalled();
  });

  it('preserves a malformed recovery envelope without any destructive attempt', async () => {
    await encryptPhotoNote('establish a valid content key');
    const malformedUri = `${PHOTO_DIR}malformed-only.onskinphoto.tmp-1`;
    mocks.files.set(malformedUri, '{"ciphertextHex":"truncated"');
    configureDirectoryBackedFileMocks();
    mocks.deleteAsync.mockClear();
    mocks.moveAsync.mockClear();
    const before = encryptedAuthoritySnapshot();

    await expect(reconcileEncryptedPhotoStorage([])).rejects.toThrow(
      PHOTO_RECOVERY_CANDIDATE_UNAUTHENTICATED,
    );

    expect(encryptedAuthoritySnapshot()).toEqual(before);
    expect(mocks.deleteAsync).not.toHaveBeenCalled();
    expect(mocks.moveAsync).not.toHaveBeenCalled();
  });

  it('preserves candidates when the readable key changes between authentication and mutation', async () => {
    await createAuthenticatedPhotoEnvelope('key-change-photo');
    const originalKey = mocks.secureStorage.get(CONTENT_KEY_NAME)!;
    const conflictingKey = 'c'.repeat(64);
    configureDirectoryBackedFileMocks();
    let keyReadCount = 0;
    mocks.getItemAsync.mockImplementation(async () => {
      keyReadCount += 1;
      return keyReadCount === 1 ? originalKey : conflictingKey;
    });
    mocks.deleteAsync.mockClear();
    mocks.moveAsync.mockClear();
    const before = encryptedAuthoritySnapshot();

    await expect(reconcileEncryptedPhotoStorage([])).rejects.toThrow(PHOTO_RECOVERY_KEY_CHANGED);

    expect(encryptedAuthoritySnapshot()).toEqual(before);
    expect(mocks.deleteAsync).not.toHaveBeenCalled();
    expect(mocks.moveAsync).not.toHaveBeenCalled();
  });

  it('preserves a candidate that changes after authentication instead of deleting uncertain bytes', async () => {
    const candidate = await createAuthenticatedPhotoEnvelope('candidate-change-photo');
    configureDirectoryBackedFileMocks();
    let candidateReadCount = 0;
    const changedRaw = `${candidate.raw} `;
    mocks.readAsStringAsync.mockImplementation(async (uri: string) => {
      const value = mocks.files.get(uri);
      if (value == null) throw new Error(`missing file: ${uri}`);
      if (uri === candidate.uri) {
        candidateReadCount += 1;
        if (candidateReadCount === 2) {
          mocks.files.set(uri, changedRaw);
          return changedRaw;
        }
      }
      return value;
    });
    mocks.deleteAsync.mockClear();
    mocks.moveAsync.mockClear();

    await expect(reconcileEncryptedPhotoStorage([])).rejects.toThrow(
      PHOTO_RECOVERY_CANDIDATE_CHANGED,
    );

    expect(mocks.files.get(candidate.uri)).toBe(changedRaw);
    expect(mocks.deleteAsync).not.toHaveBeenCalled();
    expect(mocks.moveAsync).not.toHaveBeenCalled();
  });

  it('rechecks later candidates after each awaited destructive action', async () => {
    const first = await createAuthenticatedPhotoEnvelope('action-window-first', 'first bytes');
    const second = await createAuthenticatedPhotoEnvelope('action-window-second', 'second bytes');
    const replacement = await createAuthenticatedPhotoEnvelope(
      'action-window-replacement',
      'replacement bytes',
    );
    mocks.files.delete(replacement.uri);
    configureDirectoryBackedFileMocks();
    let releaseFirstDelete!: () => void;
    let markFirstDeleteStarted!: () => void;
    const firstDeleteGate = new Promise<void>((resolve) => {
      releaseFirstDelete = resolve;
    });
    const firstDeleteStarted = new Promise<void>((resolve) => {
      markFirstDeleteStarted = resolve;
    });
    let deleteCount = 0;
    mocks.deleteAsync.mockImplementation(async (uri: string) => {
      deleteCount += 1;
      if (deleteCount === 1) {
        markFirstDeleteStarted();
        await firstDeleteGate;
      }
      mocks.files.delete(uri);
    });

    const recovery = reconcileEncryptedPhotoStorage([]);
    await firstDeleteStarted;
    mocks.files.set(second.uri, replacement.raw);
    releaseFirstDelete();

    await expect(recovery).rejects.toThrow(PHOTO_RECOVERY_CANDIDATE_CHANGED);
    expect(mocks.files.has(first.uri)).toBe(false);
    expect(mocks.files.get(second.uri)).toBe(replacement.raw);
    expect(mocks.deleteAsync).toHaveBeenCalledTimes(1);
  });

  it('preserves authenticated and conflicting live/quarantine envelopes byte-for-byte', async () => {
    const original = await createAuthenticatedPhotoEnvelope('conflict-live', 'live bytes');
    const other = await createAuthenticatedPhotoEnvelope('conflict-other', 'other bytes');
    const quarantinedUri = `${original.uri}.pending-delete-delete-conflict`;
    mocks.files.set(quarantinedUri, other.raw);
    configureDirectoryBackedFileMocks();
    mocks.deleteAsync.mockClear();
    mocks.moveAsync.mockClear();
    const before = encryptedAuthoritySnapshot();

    await expect(reconcileEncryptedPhotoStorage([original.uri])).rejects.toThrow(
      PHOTO_RECOVERY_CONFLICT,
    );

    expect(encryptedAuthoritySnapshot()).toEqual(before);
    expect(mocks.deleteAsync).not.toHaveBeenCalled();
    expect(mocks.moveAsync).not.toHaveBeenCalled();
  });

  it('preserves duplicate quarantines instead of partially restoring one missing live path', async () => {
    const original = await createAuthenticatedPhotoEnvelope('duplicate-quarantine');
    mocks.files.delete(original.uri);
    const firstQuarantine = `${original.uri}.pending-delete-first`;
    const secondQuarantine = `${original.uri}.pending-delete-second`;
    mocks.files.set(firstQuarantine, original.raw);
    mocks.files.set(secondQuarantine, original.raw);
    configureDirectoryBackedFileMocks();
    mocks.deleteAsync.mockClear();
    mocks.moveAsync.mockClear();
    const before = encryptedAuthoritySnapshot();

    await expect(reconcileEncryptedPhotoStorage([original.uri])).rejects.toThrow(
      PHOTO_RECOVERY_CONFLICT,
    );

    expect(encryptedAuthoritySnapshot()).toEqual(before);
    expect(mocks.deleteAsync).not.toHaveBeenCalled();
    expect(mocks.moveAsync).not.toHaveBeenCalled();
  });

  it('preserves candidates when a recovery read or destructive delete fails', async () => {
    await createAuthenticatedPhotoEnvelope('recovery-read-photo');
    configureDirectoryBackedFileMocks();
    const beforeReadFailure = encryptedAuthoritySnapshot();
    mocks.readAsStringAsync.mockRejectedValueOnce(new Error('filesystem unavailable'));

    await expect(reconcileEncryptedPhotoStorage([])).rejects.toThrow(
      PHOTO_RECOVERY_CANDIDATE_READ_FAILED,
    );
    expect(encryptedAuthoritySnapshot()).toEqual(beforeReadFailure);

    mocks.deleteAsync.mockRejectedValueOnce(new Error('delete unavailable'));
    const beforeDeleteFailure = encryptedAuthoritySnapshot();
    await expect(reconcileEncryptedPhotoStorage([])).rejects.toThrow('delete unavailable');
    expect(encryptedAuthoritySnapshot()).toEqual(beforeDeleteFailure);
  });

  it('aborts and drains stale reconciliation before an account switch can publish', async () => {
    const seed = await createAuthenticatedPhotoEnvelope('account-a-seed');
    mocks.files.delete(seed.uri);
    const staleUri = `${PHOTO_DIR}account-a.onskinphoto.pending-delete-delete-1`;
    mocks.files.set(staleUri, seed.raw);
    configureDirectoryBackedFileMocks();

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
      expect(mocks.files.get(staleUri)).toBe(seed.raw);
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
    expect(mocks.asyncStorage.get(CONTENT_KEY_MARKER)).toBe(CONTENT_KEY_MARKER_CURRENT);
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

  it('shares one content key and marker commit across 100 concurrent first note writes', async () => {
    const notes = Array.from({ length: 100 }, (_, index) => `note ${index}`);
    const ciphertexts = await Promise.all(notes.map((note) => encryptPhotoNote(note)));

    expect(mocks.setItemAsync).toHaveBeenCalledTimes(1);
    expect(mocks.asyncSetItem).toHaveBeenCalledTimes(2);
    expect(mocks.asyncStorage.get(CONTENT_KEY_MARKER)).toBe(CONTENT_KEY_MARKER_CURRENT);
    await expect(Promise.all(ciphertexts.map((value) => decryptPhotoNote(value)))).resolves.toEqual(
      notes,
    );
  });

  it.each([
    ['malformed', 'not-a-marker', PHOTO_CONTENT_KEY_MARKER_INVALID],
    ['current-invalid', 'v1:not-created', PHOTO_CONTENT_KEY_MARKER_INVALID],
    ['future', 'v2:created', PHOTO_CONTENT_KEY_MARKER_UNSUPPORTED_VERSION],
    ['multi-digit future', 'v10:created', PHOTO_CONTENT_KEY_MARKER_UNSUPPORTED_VERSION],
    ['oversized', 'x'.repeat(65), PHOTO_CONTENT_KEY_MARKER_INVALID],
  ])(
    'preserves a %s key-history marker and blocks first-key creation in an empty directory',
    async (_label, marker, expectedError) => {
      mocks.asyncStorage.set(CONTENT_KEY_MARKER, marker);

      await expect(encryptPhotoNote('blocked note')).rejects.toThrow(expectedError);

      expect(mocks.asyncStorage.get(CONTENT_KEY_MARKER)).toBe(marker);
      expect(mocks.asyncSetItem).not.toHaveBeenCalled();
      expect(mocks.setItemAsync).not.toHaveBeenCalled();
      expect(mocks.secureStorage.has(CONTENT_KEY_NAME)).toBe(false);
    },
  );

  it.each([
    ['malformed', 'not-a-marker', PHOTO_CONTENT_KEY_MARKER_INVALID],
    ['current-invalid', 'v1:not-created', PHOTO_CONTENT_KEY_MARKER_INVALID],
    ['future', 'v2:created', PHOTO_CONTENT_KEY_MARKER_UNSUPPORTED_VERSION],
    ['multi-digit future', 'v10:created', PHOTO_CONTENT_KEY_MARKER_UNSUPPORTED_VERSION],
    ['oversized', 'x'.repeat(65), PHOTO_CONTENT_KEY_MARKER_INVALID],
  ])(
    'preserves an existing key and %s marker without overwriting either',
    async (_label, marker, expectedError) => {
      const existingKey = 'b'.repeat(64);
      mocks.secureStorage.set(CONTENT_KEY_NAME, existingKey);
      mocks.asyncStorage.set(CONTENT_KEY_MARKER, marker);

      await expect(encryptPhotoNote('blocked note')).rejects.toThrow(expectedError);

      expect(mocks.secureStorage.get(CONTENT_KEY_NAME)).toBe(existingKey);
      expect(mocks.asyncStorage.get(CONTENT_KEY_MARKER)).toBe(marker);
      expect(mocks.setItemAsync).not.toHaveBeenCalled();
      expect(mocks.asyncSetItem).not.toHaveBeenCalled();
    },
  );

  it('does not create a key when the key-history marker is unavailable', async () => {
    mocks.asyncGetThrows = true;

    await expect(encryptPhotoNote('blocked note')).rejects.toThrow(
      PHOTO_CONTENT_KEY_STORAGE_UNAVAILABLE,
    );

    expect(mocks.setItemAsync).not.toHaveBeenCalled();
    expect(mocks.asyncSetItem).not.toHaveBeenCalled();
    expect(mocks.secureStorage.has(CONTENT_KEY_NAME)).toBe(false);
  });

  it('migrates the read-only legacy marker only when an existing key authorizes mutation', async () => {
    mocks.secureStorage.set(CONTENT_KEY_NAME, 'b'.repeat(64));
    mocks.asyncStorage.set(CONTENT_KEY_MARKER, CONTENT_KEY_MARKER_LEGACY);

    const ciphertext = await encryptPhotoNote('migrated note');

    expect(mocks.asyncStorage.get(CONTENT_KEY_MARKER)).toBe(CONTENT_KEY_MARKER_CURRENT);
    await expect(decryptPhotoNote(ciphertext)).resolves.toBe('migrated note');
  });

  it('binds the transitional unbound v1 marker to the existing key before a new write', async () => {
    mocks.secureStorage.set(CONTENT_KEY_NAME, 'b'.repeat(64));
    mocks.asyncStorage.set(CONTENT_KEY_MARKER, CONTENT_KEY_MARKER_UNBOUND_LEGACY);

    const ciphertext = await encryptPhotoNote('bound migration note');

    expect(mocks.asyncStorage.get(CONTENT_KEY_MARKER)).toBe(CONTENT_KEY_MARKER_CURRENT);
    await expect(decryptPhotoNote(ciphertext)).resolves.toBe('bound migration note');
  });

  it('finishes a pending first-key commit only when its fingerprint matches the stored key', async () => {
    mocks.secureStorage.set(CONTENT_KEY_NAME, 'b'.repeat(64));
    mocks.asyncStorage.set(CONTENT_KEY_MARKER, CONTENT_KEY_MARKER_PENDING);

    const ciphertext = await encryptPhotoNote('recovered pending note');

    expect(mocks.asyncStorage.get(CONTENT_KEY_MARKER)).toBe(CONTENT_KEY_MARKER_CURRENT);
    await expect(decryptPhotoNote(ciphertext)).resolves.toBe('recovered pending note');
  });

  it('preserves a pending marker and blocks creation when its key is missing', async () => {
    mocks.asyncStorage.set(CONTENT_KEY_MARKER, CONTENT_KEY_MARKER_PENDING);

    await expect(encryptPhotoNote('blocked note')).rejects.toThrow(PHOTO_CONTENT_KEY_MISSING);

    expect(mocks.asyncStorage.get(CONTENT_KEY_MARKER)).toBe(CONTENT_KEY_MARKER_PENDING);
    expect(mocks.setItemAsync).not.toHaveBeenCalled();
  });

  it('preserves a legacy marker and blocks replacement when its key is missing', async () => {
    mocks.asyncStorage.set(CONTENT_KEY_MARKER, CONTENT_KEY_MARKER_LEGACY);

    await expect(encryptPhotoNote('blocked note')).rejects.toThrow(PHOTO_CONTENT_KEY_MISSING);

    expect(mocks.asyncStorage.get(CONTENT_KEY_MARKER)).toBe(CONTENT_KEY_MARKER_LEGACY);
    expect(mocks.asyncSetItem).not.toHaveBeenCalled();
    expect(mocks.setItemAsync).not.toHaveBeenCalled();
  });

  it('accepts a marker write rejection only when exact post-write readback proves commit', async () => {
    mocks.asyncSetCommitsThenThrows = true;

    const ciphertext = await encryptPhotoNote('committed note');

    expect(mocks.asyncStorage.get(CONTENT_KEY_MARKER)).toBe(CONTENT_KEY_MARKER_CURRENT);
    expect(mocks.asyncSetItem).toHaveBeenCalledWith(
      CONTENT_KEY_MARKER,
      CONTENT_KEY_MARKER_CURRENT,
    );
    await expect(decryptPhotoNote(ciphertext)).resolves.toBe('committed note');
  });

  it('accepts a content-key write rejection only when exact readback proves commit', async () => {
    mocks.secureSetCommitsThenThrows = true;

    const ciphertext = await encryptPhotoNote('committed key note');

    expect(mocks.secureStorage.get(CONTENT_KEY_NAME)).toMatch(/^[0-9a-f]{64}$/);
    expect(mocks.asyncStorage.get(CONTENT_KEY_MARKER)).toBe(CONTENT_KEY_MARKER_CURRENT);
    await expect(decryptPhotoNote(ciphertext)).resolves.toBe('committed key note');
  });

  it.each([
    ['silently dropped', 'drop'],
    ['wrong value', 'wrong'],
  ])('durably quarantines a %s content-key write before any ciphertext', async (_label, mode) => {
    mocks.secureSetDrops = mode === 'drop';
    mocks.secureSetWrongValue = mode === 'wrong';

    await expect(encryptPhotoNote('unreadable note')).rejects.toThrow(
      PHOTO_CONTENT_KEY_STORAGE_UNAVAILABLE,
    );

    expect(mocks.asyncStorage.get(CONTENT_KEY_MARKER)).toBe(CONTENT_KEY_MARKER_PENDING);
    expect(mocks.asyncSetItem).toHaveBeenCalledWith(
      CONTENT_KEY_MARKER,
      CONTENT_KEY_MARKER_PENDING,
    );
    expect(mocks.secureStorage.get(CONTENT_KEY_NAME)).toBe(
      mode === 'wrong' ? 'c'.repeat(64) : undefined,
    );

    mocks.secureSetDrops = false;
    mocks.secureSetWrongValue = false;
    await expect(encryptPhotoNote('retry must stay blocked')).rejects.toThrow(
      mode === 'wrong' ? PHOTO_CONTENT_KEY_MARKER_KEY_MISMATCH : PHOTO_CONTENT_KEY_MISSING,
    );
    expect(mocks.asyncStorage.get(CONTENT_KEY_MARKER)).toBe(CONTENT_KEY_MARKER_PENDING);
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

  it('does not publish ciphertext when a first-key marker write is silently dropped', async () => {
    mocks.asyncSetDrops = true;

    await expect(encryptPhotoNote('blocked note')).rejects.toThrow(
      PHOTO_CONTENT_KEY_STORAGE_UNAVAILABLE,
    );

    expect(mocks.secureStorage.has(CONTENT_KEY_NAME)).toBe(false);
    expect(mocks.asyncStorage.has(CONTENT_KEY_MARKER)).toBe(false);
  });

  it('keeps decryption independent from key-history marker availability', async () => {
    const ciphertext = await encryptPhotoNote('baseline note');
    mocks.asyncStorage.delete(CONTENT_KEY_MARKER);
    mocks.asyncSetThrows = true;
    mocks.asyncSetItem.mockClear();

    await expect(decryptPhotoNote(ciphertext)).resolves.toBe('baseline note');

    expect(mocks.asyncSetItem).not.toHaveBeenCalled();
    expect(mocks.asyncStorage.has(CONTENT_KEY_MARKER)).toBe(false);
  });

  it('reports authentication failure without replacing a valid but wrong key', async () => {
    const ciphertext = await encryptPhotoNote('baseline note');
    mocks.secureStorage.set(CONTENT_KEY_NAME, 'a'.repeat(64));
    mocks.digestStringAsync.mockResolvedValue('c'.repeat(64));
    mocks.setItemAsync.mockClear();
    mocks.asyncSetItem.mockClear();

    await expect(decryptPhotoNote(ciphertext)).rejects.toThrow(PHOTO_DECRYPTION_FAILED);
    await expect(encryptPhotoNote('must not split key history')).rejects.toThrow(
      PHOTO_CONTENT_KEY_MARKER_KEY_MISMATCH,
    );

    expect(mocks.setItemAsync).not.toHaveBeenCalled();
    expect(mocks.asyncSetItem).not.toHaveBeenCalled();
    expect(mocks.secureStorage.get(CONTENT_KEY_NAME)).toBe('a'.repeat(64));
    expect(mocks.asyncStorage.get(CONTENT_KEY_MARKER)).toBe(CONTENT_KEY_MARKER_CURRENT);
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
    expect(mocks.deleteItemAsync).toHaveBeenCalledWith(
      CONTENT_KEY_NAME,
      expect.objectContaining({ keychainAccessible: 7 }),
    );
    expect(mocks.asyncStorage.has(CONTENT_KEY_MARKER)).toBe(false);
  });

  it('reports photo cleanup failure after attempting every destructive store', async () => {
    mocks.secureStorage.set(CONTENT_KEY_NAME, 'a'.repeat(64));
    mocks.asyncStorage.set(CONTENT_KEY_MARKER, '1');
    mocks.deleteAsync.mockRejectedValueOnce(new Error('photo directory unavailable'));

    await expect(clearEncryptedPhotoStorage()).rejects.toThrow('PHOTO_STORAGE_CLEAR_FAILED:1');

    expect(mocks.deleteItemAsync).toHaveBeenCalledWith(
      CONTENT_KEY_NAME,
      expect.objectContaining({ keychainAccessible: 7 }),
    );
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
