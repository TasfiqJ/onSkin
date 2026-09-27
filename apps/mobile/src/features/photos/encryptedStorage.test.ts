import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_GENERATION_CHANGED,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  runAccountGenerationOperation,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';
import {
  clearActiveHealthProcessingEpoch,
  HEALTH_PROCESSING_STATUS_LEASE_MS,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';
import { PLAINTEXT_STAGING_JOURNAL_KEY } from '@/lib/storage/plaintextStagingCore';

import {
  beginEncryptedPhotoAccountBoundary,
  beginPhotoRenditionPublication,
  clearEncryptedPhotoStorage,
  createPhotoShareFile,
  decryptPhotoNote,
  decryptPhotoNoteForPurposeLimitedExport,
  decryptPhotoToDataUri,
  deleteQuarantinedPhoto,
  deletePhotoShareFile,
  encryptCapturedPhoto,
  encryptPhotoRendition,
  encryptPhotoNote,
  endEncryptedPhotoAccountBoundary,
  PHOTO_CONTENT_KEY_INVALID,
  PHOTO_CONTENT_KEY_MISSING,
  PHOTO_CONTENT_KEY_STORAGE_UNAVAILABLE,
  PHOTO_DECRYPTION_FAILED,
  PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
  quarantineEncryptedPhoto,
  markPhotoRenditionPublication,
  recoverPhotoRenditionPublication,
  reconcileEncryptedPhotoStorage,
  restoreQuarantinedPhoto,
  waitForEncryptedPhotoWritesToSettle,
} from './encryptedStorage';

const CONTENT_KEY_NAME = 'layerwell.photo.content_key.v1';
const CONTENT_KEY_MARKER = 'layerwell.photo.content_key_created.v1';

function activateExpiringHealthLease(epoch: number): void {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-15T16:00:00.000Z'));
  clearActiveHealthProcessingEpoch();
  setActiveHealthProcessingEpoch(epoch, {
    ownerUserId: 'test-owner',
    accountGeneration: 0,
    serverVerifiedAt: new Date(Date.now()).toISOString(),
  });
}

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
  moveGate: null as Promise<void> | null,
  moveStarted: null as (() => void) | null,
  moveAsync: vi.fn(),
  platformOS: 'ios',
  readDirectoryAsync: vi.fn(),
  readAsStringAsync: vi.fn(),
  secureGetThrows: false,
  secureReadGate: null as Promise<void> | null,
  secureReadStarted: null as (() => void) | null,
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
    mocks.moveGate = null;
    mocks.moveStarted = null;
    mocks.moveAsync.mockReset();
    mocks.platformOS = 'ios';
    mocks.readDirectoryAsync.mockReset();
    mocks.readAsStringAsync.mockReset();
    mocks.secureGetThrows = false;
    mocks.secureReadGate = null;
    mocks.secureReadStarted = null;
    mocks.secureSetThrows = false;
    mocks.setItemAsync.mockReset();
    mocks.writeGate = null;
    mocks.writeStarted = null;
    mocks.writeAsStringAsync.mockReset();
    endEncryptedPhotoAccountBoundary();
    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(1, {
      ownerUserId: 'test-owner',
      accountGeneration: 0,
      serverVerifiedAt: null,
    });

    mocks.deleteAsync.mockImplementation(async (uri: string) => {
      mocks.files.delete(uri);
    });
    mocks.deleteItemAsync.mockImplementation(async (key: string) => {
      mocks.secureStorage.delete(key);
    });
    mocks.getItemAsync.mockImplementation(async (key: string) => {
      mocks.secureReadStarted?.();
      if (mocks.secureReadGate) await mocks.secureReadGate;
      if (mocks.secureGetThrows) throw new Error('secure read failed');
      return mocks.secureStorage.get(key) ?? null;
    });
    mocks.getInfoAsync.mockResolvedValue({ exists: false });
    mocks.makeDirectoryAsync.mockResolvedValue(undefined);
    mocks.moveAsync.mockImplementation(async ({ from, to }: { from: string; to: string }) => {
      mocks.moveStarted?.();
      if (mocks.moveGate) await mocks.moveGate;
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

  afterEach(() => {
    vi.useRealTimers();
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

  it('blocks photo and note repopulation after health processing closes', async () => {
    clearActiveHealthProcessingEpoch();
    mocks.files.set('file://capture.jpg', Buffer.from('image bytes').toString('base64'));

    await expect(encryptPhotoNote('stale note')).rejects.toThrow(
      'HEALTH_DATA_WRITE_ADMISSION_CLOSED',
    );
    await expect(encryptCapturedPhoto('file://capture.jpg', 'stale-photo')).rejects.toThrow(
      'HEALTH_DATA_WRITE_ADMISSION_CLOSED',
    );
    expect(mocks.writeAsStringAsync).not.toHaveBeenCalled();
  });

  it('purges a final encrypted photo when its status lease expires during the atomic move', async () => {
    activateExpiringHealthLease(10);
    const sourceUri = 'file://capture/lease-expiry.jpg';
    const finalUri = 'file://document/photos/v1/lease-expiry.layerwellphoto';
    mocks.files.set(sourceUri, Buffer.from('image bytes').toString('base64'));
    let releaseMove!: () => void;
    let markMoveStarted!: () => void;
    mocks.moveGate = new Promise<void>((resolve) => {
      releaseMove = resolve;
    });
    const moveStarted = new Promise<void>((resolve) => {
      markMoveStarted = resolve;
    });
    mocks.moveStarted = markMoveStarted;

    const write = encryptCapturedPhoto(sourceUri, 'lease-expiry');
    await moveStarted;
    const rejection = expect(write).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    vi.advanceTimersByTime(HEALTH_PROCESSING_STATUS_LEASE_MS);
    releaseMove();

    await rejection;
    expect(mocks.files.has(finalUri)).toBe(false);
    expect(
      [...mocks.files.keys()].some((uri) => uri.includes('lease-expiry.layerwellphoto.tmp-')),
    ).toBe(false);
    expect(mocks.files.has(sourceUri)).toBe(true);
  });

  it('does not publish an encrypted note when key persistence outlives its status lease', async () => {
    activateExpiringHealthLease(11);
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
    let publishedNote: string | null | undefined;
    const encryption = encryptPhotoNote('lease-bound note').then((value) => {
      publishedNote = value;
      return value;
    });
    await markerWriteStarted;
    const rejection = expect(encryption).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    vi.advanceTimersByTime(HEALTH_PROCESSING_STATUS_LEASE_MS);
    releaseMarkerWrite();

    await rejection;
    expect(publishedNote).toBeUndefined();
  });

  it('does not return decrypted note or photo plaintext after status expiry during key I/O', async () => {
    const encryptedNote = await encryptPhotoNote('private note');
    const sourceUri = 'file://capture/private-photo.jpg';
    mocks.files.set(sourceUri, Buffer.from('private image').toString('base64'));
    const encryptedPhoto = await encryptCapturedPhoto(sourceUri, 'private-photo');

    activateExpiringHealthLease(12);
    let releaseNoteKeyRead!: () => void;
    let markNoteKeyReadStarted!: () => void;
    mocks.secureReadGate = new Promise<void>((resolve) => {
      releaseNoteKeyRead = resolve;
    });
    const noteKeyReadStarted = new Promise<void>((resolve) => {
      markNoteKeyReadStarted = resolve;
    });
    mocks.secureReadStarted = markNoteKeyReadStarted;
    let notePlaintext: string | null | undefined;
    const noteRead = decryptPhotoNote(encryptedNote).then((value) => {
      notePlaintext = value;
      return value;
    });
    await noteKeyReadStarted;
    const noteRejection = expect(noteRead).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    vi.advanceTimersByTime(HEALTH_PROCESSING_STATUS_LEASE_MS);
    releaseNoteKeyRead();
    await noteRejection;
    expect(notePlaintext).toBeUndefined();

    activateExpiringHealthLease(13);
    let releasePhotoKeyRead!: () => void;
    let markPhotoKeyReadStarted!: () => void;
    mocks.secureReadGate = new Promise<void>((resolve) => {
      releasePhotoKeyRead = resolve;
    });
    const photoKeyReadStarted = new Promise<void>((resolve) => {
      markPhotoKeyReadStarted = resolve;
    });
    mocks.secureReadStarted = markPhotoKeyReadStarted;
    let photoPlaintext: string | undefined;
    const photoRead = decryptPhotoToDataUri(encryptedPhoto.encryptedLocalUri).then((value) => {
      photoPlaintext = value;
      return value;
    });
    await photoKeyReadStarted;
    const photoRejection = expect(photoRead).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    vi.advanceTimersByTime(HEALTH_PROCESSING_STATUS_LEASE_MS);
    releasePhotoKeyRead();

    await photoRejection;
    expect(photoPlaintext).toBeUndefined();
  });

  it('authenticates photo, capture-session, and rendition identity for each distinct envelope', async () => {
    const sourceUri = 'file://capture/identity-bound.jpg';
    mocks.files.set(sourceUri, Buffer.from('private identity-bound image').toString('base64'));

    const original = await encryptPhotoRendition(sourceUri, {
      photoId: 'photo-identity',
      captureSessionId: '123e4567-e89b-42d3-a456-426614174000',
      rendition: 'original',
    });
    const thumbnail = await encryptPhotoRendition(sourceUri, {
      photoId: 'photo-identity',
      captureSessionId: '123e4567-e89b-42d3-a456-426614174000',
      rendition: 'thumbnail',
    });

    expect(original.encryptedLocalUri).toBe(
      'file://document/photos/v1/photo-identity.layerwellphoto',
    );
    expect(thumbnail.encryptedLocalUri).toBe(
      'file://document/photos/v1/photo-identity-thumbnail.layerwellphoto',
    );
    const originalIdentity = {
      photoId: 'photo-identity',
      captureSessionId: '123e4567-e89b-42d3-a456-426614174000',
      rendition: 'original' as const,
    };
    const thumbnailIdentity = { ...originalIdentity, rendition: 'thumbnail' as const };
    await expect(decryptPhotoToDataUri(original.encryptedLocalUri, originalIdentity)).resolves.toContain(
      'data:image/jpeg;base64,',
    );
    await expect(decryptPhotoToDataUri(thumbnail.encryptedLocalUri, thumbnailIdentity)).resolves.toContain(
      'data:image/jpeg;base64,',
    );

    const tampered = JSON.parse(mocks.files.get(thumbnail.encryptedLocalUri)!) as Record<
      string,
      unknown
    >;
    tampered.photoId = 'other-photo';
    mocks.files.set(thumbnail.encryptedLocalUri, JSON.stringify(tampered));
    await expect(decryptPhotoToDataUri(thumbnail.encryptedLocalUri, thumbnailIdentity)).rejects.toThrow(
      'PHOTO_RENDITION_IDENTITY_MISMATCH',
    );
  });

  it('journals both canonical finals before adoption and removes uncommitted finals on restart', async () => {
    const identity = { photoId: 'photo-crash', captureSessionId: null };
    await beginPhotoRenditionPublication(identity, 'file://cache/camera/raw.jpg');
    const journalRaw = mocks.asyncStorage.get('layerwell.photo.publication_journal.v1');
    expect(journalRaw).toContain('photo-crash-thumbnail.layerwellphoto');
    mocks.files.set('file://document/photos/v1/photo-crash.layerwellphoto', 'encrypted');
    mocks.files.set('file://document/photos/v1/photo-crash-thumbnail.layerwellphoto', 'encrypted');
    await markPhotoRenditionPublication(identity, 'pair_adopted');

    await recoverPhotoRenditionPublication(new Set());

    expect(mocks.files.has('file://document/photos/v1/photo-crash.layerwellphoto')).toBe(false);
    expect(mocks.files.has('file://document/photos/v1/photo-crash-thumbnail.layerwellphoto')).toBe(false);
    expect(mocks.asyncStorage.has('layerwell.photo.publication_journal.v1')).toBe(false);
  });

  it('finishes committed raw cleanup on restart and refuses corrupt journal state', async () => {
    const identity = { photoId: 'photo-committed', captureSessionId: null };
    mocks.files.set('file://cache/camera/raw.jpg', 'raw');
    mocks.files.set('file://document/photos/v1/photo-committed.layerwellphoto', 'encrypted');
    mocks.files.set('file://document/photos/v1/photo-committed-thumbnail.layerwellphoto', 'encrypted');
    mocks.getInfoAsync.mockImplementation(async (uri: string) => ({ exists: mocks.files.has(uri) }));
    await beginPhotoRenditionPublication(identity, 'file://cache/camera/raw.jpg');
    await markPhotoRenditionPublication(identity, 'metadata_committed');
    await recoverPhotoRenditionPublication(new Set(['photo-committed']));
    expect(mocks.files.has('file://cache/camera/raw.jpg')).toBe(false);
    expect(mocks.asyncStorage.has('layerwell.photo.publication_journal.v1')).toBe(false);

    mocks.asyncStorage.set('layerwell.photo.publication_journal.v1', '{bad');
    await expect(recoverPhotoRenditionPublication(null)).rejects.toThrow(
      'PHOTO_PUBLICATION_JOURNAL_INVALID',
    );
  });

  it('rejects path-capable photo identity and noncanonical capture-session identity', async () => {
    mocks.files.set('file://capture/untrusted.jpg', Buffer.from('image').toString('base64'));
    await expect(
      encryptPhotoRendition('file://capture/untrusted.jpg', {
        photoId: '../other-account',
        captureSessionId: null,
        rendition: 'original',
      }),
    ).rejects.toThrow('PHOTO_RENDITION_IDENTITY_INVALID');
    await expect(
      encryptPhotoRendition('file://capture/untrusted.jpg', {
        photoId: 'safe-photo',
        captureSessionId: 'not-canonical',
        rendition: 'thumbnail',
      }),
    ).rejects.toThrow('PHOTO_RENDITION_IDENTITY_INVALID');
    expect(mocks.writeAsStringAsync).not.toHaveBeenCalled();
  });

  it('purges plaintext share staging when its status lease expires during the file write', async () => {
    const sourceUri = 'file://capture/share-expiry.jpg';
    mocks.files.set(sourceUri, Buffer.from('private image').toString('base64'));
    const encrypted = await encryptCapturedPhoto(sourceUri, 'share-expiry');
    activateExpiringHealthLease(14);
    let releaseShareWrite!: () => void;
    let markShareWriteStarted!: () => void;
    mocks.writeGate = new Promise<void>((resolve) => {
      releaseShareWrite = resolve;
    });
    const shareWriteStarted = new Promise<void>((resolve) => {
      markShareWriteStarted = resolve;
    });
    mocks.writeStarted = markShareWriteStarted;
    let shareUri: string | undefined;
    const share = createPhotoShareFile(encrypted.encryptedLocalUri).then((value) => {
      shareUri = value;
      return value;
    });
    await shareWriteStarted;
    const rejection = expect(share).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    vi.advanceTimersByTime(HEALTH_PROCESSING_STATUS_LEASE_MS);
    releaseShareWrite();

    await rejection;
    expect(shareUri).toBeUndefined();
    expect(
      [...mocks.files.keys()].some((uri) =>
        uri.startsWith('file://cache/private-plaintext-staging-v1/'),
      ),
    ).toBe(false);
    expect(mocks.asyncStorage.has(PLAINTEXT_STAGING_JOURNAL_KEY)).toBe(false);
  });

  it('purges a restored live photo when its status lease expires during restore', async () => {
    const originalUri = 'file://document/photos/v1/restore-expiry.layerwellphoto';
    const quarantinedUri = `${originalUri}.pending-delete-operation`;
    mocks.files.set(quarantinedUri, 'encrypted');
    activateExpiringHealthLease(15);
    let releaseMove!: () => void;
    let markMoveStarted!: () => void;
    mocks.moveGate = new Promise<void>((resolve) => {
      releaseMove = resolve;
    });
    const moveStarted = new Promise<void>((resolve) => {
      markMoveStarted = resolve;
    });
    mocks.moveStarted = markMoveStarted;

    const restore = restoreQuarantinedPhoto({ originalUri, quarantinedUri });
    await moveStarted;
    const rejection = expect(restore).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    vi.advanceTimersByTime(HEALTH_PROCESSING_STATUS_LEASE_MS);
    releaseMove();

    await rejection;
    expect(mocks.files.has(originalUri)).toBe(false);
    expect(mocks.files.has(quarantinedUri)).toBe(false);
  });

  it('purges a reconciled live photo when its status lease expires during restoration', async () => {
    const directory = 'file://document/photos/v1/';
    const originalUri = `${directory}reconcile-expiry.layerwellphoto`;
    const quarantinedUri = `${originalUri}.pending-delete-operation`;
    mocks.files.set(quarantinedUri, 'encrypted');
    mocks.getInfoAsync.mockImplementation(async (uri: string) => ({
      exists: uri === directory || mocks.files.has(uri),
    }));
    mocks.readDirectoryAsync.mockResolvedValue([
      'reconcile-expiry.layerwellphoto.pending-delete-operation',
    ]);
    activateExpiringHealthLease(16);
    let releaseMove!: () => void;
    let markMoveStarted!: () => void;
    mocks.moveGate = new Promise<void>((resolve) => {
      releaseMove = resolve;
    });
    const moveStarted = new Promise<void>((resolve) => {
      markMoveStarted = resolve;
    });
    mocks.moveStarted = markMoveStarted;

    const reconciliation = reconcileEncryptedPhotoStorage([originalUri]);
    await moveStarted;
    const rejection = expect(reconciliation).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    vi.advanceTimersByTime(HEALTH_PROCESSING_STATUS_LEASE_MS);
    releaseMove();

    await rejection;
    expect(mocks.files.has(originalUri)).toBe(false);
    expect(mocks.files.has(quarantinedUri)).toBe(false);
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
    expect(mocks.files.has('file://document/photos/v1/account-a-photo.layerwellphoto')).toBe(true);
  });

  it('keeps decryption read-only instead of repopulating a cleared marker', async () => {
    const ciphertext = await encryptPhotoNote('account A note');
    mocks.asyncStorage.delete(CONTENT_KEY_MARKER);

    await expect(decryptPhotoNote(ciphertext)).resolves.toBe('account A note');
    expect(mocks.asyncStorage.has(CONTENT_KEY_MARKER)).toBe(false);
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

  it('keeps normal note reads closed while an exact-account data export can decrypt', async () => {
    const ciphertext = await encryptPhotoNote('data-rights note');
    clearActiveHealthProcessingEpoch();

    await expect(decryptPhotoNote(ciphertext)).rejects.toThrow(
      'HEALTH_DATA_WRITE_ADMISSION_CLOSED',
    );
    await expect(
      runAccountGenerationOperation((accountLease) =>
        decryptPhotoNoteForPurposeLimitedExport(ciphertext, accountLease),
      ),
    ).resolves.toBe('data-rights note');
  });

  it('rejects purpose-limited note decryption after an A-to-B-to-A boundary', async () => {
    const ciphertext = await encryptPhotoNote('account A note');
    clearActiveHealthProcessingEpoch();
    let releaseKeyRead!: () => void;
    let markKeyReadStarted!: () => void;
    mocks.secureReadGate = new Promise<void>((resolve) => {
      releaseKeyRead = resolve;
    });
    const keyReadStarted = new Promise<void>((resolve) => {
      markKeyReadStarted = resolve;
    });
    mocks.secureReadStarted = markKeyReadStarted;

    const pending = runAccountGenerationOperation((accountLease) =>
      decryptPhotoNoteForPurposeLimitedExport(ciphertext, accountLease),
    );
    await keyReadStarted;
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    releaseKeyRead();

    await expect(pending).rejects.toThrow(ACCOUNT_GENERATION_CHANGED);
  });

  it('publishes encrypted photos with an atomic move and preserves the source on interruption', async () => {
    const sourceUri = 'file://capture/atomic.jpg';
    const finalUri = 'file://document/photos/v1/atomic-photo.layerwellphoto';
    mocks.files.set(sourceUri, Buffer.from('image bytes').toString('base64'));

    const result = await encryptCapturedPhoto(sourceUri, 'atomic-photo');

    expect(result.encryptedLocalUri).toBe(finalUri);
    expect(mocks.moveAsync).toHaveBeenCalledWith({
      from: expect.stringMatching(/atomic-photo\.layerwellphoto\.tmp-/),
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
    expect(mocks.files.has('file://document/photos/v1/interrupted-photo.layerwellphoto')).toBe(
      false,
    );
    expect(
      [...mocks.files.keys()].some((uri) => uri.includes('interrupted-photo.layerwellphoto.tmp-')),
    ).toBe(false);
  });

  it('preserves a pre-existing final when an atomic move fails before completion', async () => {
    const sourceUri = 'file://capture/existing-final.jpg';
    const finalUri = 'file://document/photos/v1/existing-final.layerwellphoto';
    mocks.files.set(sourceUri, Buffer.from('new image').toString('base64'));
    mocks.files.set(finalUri, 'prior-encrypted-envelope');
    mocks.moveAsync.mockRejectedValueOnce(new Error('target already exists'));

    await expect(encryptCapturedPhoto(sourceUri, 'existing-final')).rejects.toThrow(
      'target already exists',
    );

    expect(mocks.files.get(finalUri)).toBe('prior-encrypted-envelope');
    expect(
      [...mocks.files.keys()].some((uri) => uri.includes('existing-final.layerwellphoto.tmp-')),
    ).toBe(false);
  });

  it('restores or removes quarantined files according to committed metadata', async () => {
    const directory = 'file://document/photos/v1/';
    const originalUri = `${directory}photo-1.layerwellphoto`;
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

    const orphanUri = `${directory}orphan.layerwellphoto`;
    const staleQuarantineUri = `${directory}stale.layerwellphoto.pending-delete-delete-5`;
    const incompleteUri = `${directory}unfinished.layerwellphoto.tmp-1234`;
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
    const staleUri = `${directory}account-a.layerwellphoto.pending-delete-delete-1`;
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
      return ['account-a.layerwellphoto.pending-delete-delete-1'];
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

    mocks.readDirectoryAsync.mockResolvedValue([
      'account-a.layerwellphoto.pending-delete-delete-1',
    ]);
    await runAccountGenerationOperation((accountLease) => {
      setActiveHealthProcessingEpoch(2, {
        ownerUserId: 'test-owner',
        accountGeneration: accountLease.generation,
        serverVerifiedAt: null,
      });
    });
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
    mocks.readDirectoryAsync.mockResolvedValue(['legacy-photo.layerwellphoto']);

    await expect(encryptPhotoNote('new note')).rejects.toThrow(PHOTO_CONTENT_KEY_MISSING);

    expect(mocks.setItemAsync).not.toHaveBeenCalled();
    expect(mocks.secureStorage.has(CONTENT_KEY_NAME)).toBe(false);
  });

  it('detects interrupted encrypted-photo files before creating a replacement key', async () => {
    mocks.getInfoAsync.mockResolvedValue({ exists: true });
    mocks.readDirectoryAsync.mockResolvedValue([
      'interrupted.layerwellphoto.pending-delete-delete-1',
      'unfinished.layerwellphoto.tmp-1234',
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

  it('does not require a marker write to decrypt existing data', async () => {
    const ciphertext = await encryptPhotoNote('baseline note');
    mocks.asyncStorage.delete(CONTENT_KEY_MARKER);
    mocks.asyncSetThrows = true;

    await expect(decryptPhotoNote(ciphertext)).resolves.toBe('baseline note');
    expect(mocks.asyncStorage.has(CONTENT_KEY_MARKER)).toBe(false);
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
    mocks.files.set('file://document/photos/v1/bad.layerwellphoto', '{not-json');

    await expect(
      decryptPhotoToDataUri('file://document/photos/v1/bad.layerwellphoto'),
    ).rejects.toThrow('PHOTO_ENCRYPTION_ENVELOPE_INVALID');

    mocks.files.set(
      'file://document/photos/v1/gif.layerwellphoto',
      JSON.stringify({
        version: 'xchacha20poly1305:v1',
        keyId: 'photo-content-key-v1',
        mimeType: 'image/gif',
        nonceHex: '00'.repeat(24),
        ciphertextHex: '00',
      }),
    );

    await expect(
      createPhotoShareFile('file://document/photos/v1/gif.layerwellphoto'),
    ).rejects.toThrow('PHOTO_ENCRYPTION_ENVELOPE_INVALID');
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
