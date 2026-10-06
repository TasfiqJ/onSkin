import * as React from 'react';
import { randomUUID, createHash } from 'node:crypto';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearHealthPurposeLocalData } from '@/features/healthConsent/selectiveCleanup';
import { clearLocalPrivateData } from '@/features/settings/localPrivateData';
import { LOCAL_PRIVATE_DATA_KEYS } from '@/features/settings/localPrivateDataKeys';
import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  runAccountGenerationOperation,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';
import { runCurrentHealthDataOperation } from '@/lib/consent/healthDataWriteAdmission';
import {
  activeHealthProcessingLeaseSnapshot,
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';
import { queryClient } from '@/lib/query/queryClient';
import {
  beginPrivateKVAccountBoundary,
  endPrivateKVAccountBoundary,
  getPrivateItem,
  setPrivateItem,
  waitForPrivateKVWritesToSettle,
} from '@/lib/storage/privateKV';

import {
  beginEncryptedPhotoAccountBoundary,
  endEncryptedPhotoAccountBoundary,
  encryptPhotoNote,
  encryptPhotoRendition,
  quarantineEncryptedPhoto,
  waitForEncryptedPhotoWritesToSettle,
} from './encryptedStorage';
import {
  PHOTO_DELETE_JOURNAL_KEY,
  readPhotoDeleteJournal,
  writePhotoDeleteJournal,
  type PhotoDeleteCommand,
} from './photoDeleteJournal';
import { getPhotoDeleteStatus, loadPhotos, removePhoto, retryPhotoDeletes } from './store';
import { usePhotos } from './usePhotos';

// Only platform/service ports are mocked. The actual cleanup functions, photo
// store/journal, encryption/private KV, account/health boundaries, and read hook
// run together. In particular neither cleanup function nor its key list is mocked.
const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  secure: new Map<string, string>(),
  files: new Map<string, string>(),
  directories: new Set<string>(),
  owner: 'owner-a',
  offline: true,
  blockEncryptedFileDelete: false,
  failSingleJournalRemoval: false,
  failBatchJournalRemoval: false,
  multiRemoveCalls: [] as string[][],
  journalAtMediaCleanup: [] as (string | null)[],
  writes: [] as string[],
  outgoing: [] as { name: string; operations: Record<string, unknown>[] }[],
  holdJournalWrite: null as Promise<void> | null,
  journalWriteStarted: null as (() => void) | null,
}));
vi.mock('react-native-get-random-values', () => ({}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-crypto', () => ({ randomUUID: () => randomUUID() }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => mocks.storage.get(key) ?? null,
    getAllKeys: async () => [...mocks.storage.keys()],
    multiGet: async (keys: string[]) => keys.map((key) => [key, mocks.storage.get(key) ?? null]),
    setItem: async (key: string, value: string) => {
      mocks.writes.push(key);
      if (key === 'layerwell.photos.deleteJournal.v1') {
        mocks.journalWriteStarted?.();
        if (mocks.holdJournalWrite) await mocks.holdJournalWrite;
      }
      mocks.storage.set(key, value);
    },
    removeItem: async (key: string) => {
      if (key === 'layerwell.photos.deleteJournal.v1') {
        mocks.journalAtMediaCleanup.push(mocks.storage.get(key) ?? null);
        if (mocks.failSingleJournalRemoval) throw new Error('SINGLE_JOURNAL_REMOVE_FAILED');
      }
      mocks.storage.delete(key);
    },
    multiRemove: async (keys: string[]) => {
      mocks.multiRemoveCalls.push([...keys]);
      for (const key of keys) {
        if (key === 'layerwell.photos.deleteJournal.v1' && mocks.failBatchJournalRemoval) {
          throw new Error('BATCH_JOURNAL_REMOVE_FAILED');
        }
        mocks.storage.delete(key);
      }
    },
  },
}));
vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'when-unlocked-this-device-only',
  isAvailableAsync: async () => true,
  getItemAsync: async (key: string) => mocks.secure.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mocks.secure.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mocks.secure.delete(key);
  },
}));
vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file://document/',
  cacheDirectory: 'file://cache/',
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
  getInfoAsync: async (uri: string) => ({
    exists: mocks.files.has(uri) || mocks.directories.has(uri),
  }),
  makeDirectoryAsync: async (uri: string) => {
    mocks.directories.add(uri);
  },
  readDirectoryAsync: async (uri: string) =>
    [...mocks.files.keys()]
      .filter((file) => file.startsWith(uri))
      .map((file) => file.slice(uri.length)),
  readAsStringAsync: async (uri: string) => {
    const value = mocks.files.get(uri);
    if (value === undefined) throw new Error('FILE_MISSING');
    return value;
  },
  writeAsStringAsync: async (uri: string, value: string) => {
    mocks.files.set(uri, value);
  },
  moveAsync: async ({ from, to }: { from: string; to: string }) => {
    const value = mocks.files.get(from);
    if (value === undefined) throw new Error('FILE_MISSING');
    mocks.files.set(to, value);
    mocks.files.delete(from);
  },
  deleteAsync: async (uri: string) => {
    if (mocks.blockEncryptedFileDelete && uri.includes('.layerwellphoto')) {
      throw new Error('ENCRYPTED_FILE_DELETE_FAILED');
    }
    for (const key of [...mocks.files.keys()]) {
      if (key === uri || (uri.endsWith('/') && key.startsWith(uri))) mocks.files.delete(key);
    }
    mocks.directories.delete(uri);
  },
}));
vi.mock('@/features/notifications/deliver', () => ({
  scheduleTrialReminder: async () => undefined,
  waitForHealthNotificationOperationsToSettle: async () => undefined,
}));
vi.mock('@/features/notifications/nativeMutation', () => ({
  clearNativeNotificationsForAccountIsolation: async () => undefined,
}));
vi.mock('@/features/widgets/lifecycleCoordinator', () => ({
  clearRoutineWidgetLifecycleForPrivacy: async () => undefined,
}));
vi.mock('@/features/photos/sensitiveImageMemory', () => ({
  purgeSensitiveImageMemory: async () => true,
}));
vi.mock('@/features/photos/photoThumbnail', () => ({ createEncryptedPhotoThumbnail: vi.fn() }));
vi.mock('@/lib/analytics/track', () => ({ resetAnalyticsIdentity: async () => undefined }));
vi.mock('@/lib/iap/revenuecat', () => ({ resetRevenueCatIdentity: async () => undefined }));
vi.mock('@/lib/auth/sessionOwner', () => ({
  localDataOwnerBinding: async (owner: string) => createHash('sha256').update('layerwell:local-data-owner:v1:' + owner).digest('hex'),
  readLocalDataOwnership: async (owner: string) => (owner === mocks.owner ? 'match' : 'mismatch'),
}));
vi.mock('@/lib/env', () => ({ isSupabaseConfigured: true }));
vi.mock('@/lib/storage/plaintextStaging', () => ({ scavengePlaintextStaging: async () => 0 }));
vi.mock('@/lib/query/queryClient', async () => {
  const { QueryClient } = await import('@tanstack/react-query');
  return {
    queryClient: new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity, gcTime: Infinity, refetchOnMount: false },
      },
    }),
  };
});
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    rpc: (name: string, args: { p_operations: Record<string, unknown>[] }) => ({
      abortSignal: async (signal: AbortSignal) => {
        if (signal.aborted) throw new Error('ABORTED');
        mocks.outgoing.push({ name, operations: args.p_operations });
        if (mocks.offline) throw new Error('OFFLINE');
        return {
          data: args.p_operations.map((operation) => ({
            operation_id: operation.operation_id,
            status: 'applied',
            error_class: null,
          })),
          error: null,
        };
      },
    }),
  },
}));

const PHOTO_KEY = 'layerwell.photos.v1';
const PHOTO_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OPERATION_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4FoAAAAASUVORK5CYII=';
let renderer: ReactTestRenderer | null = null;
let source: ReturnType<typeof usePhotos> | null = null;

async function grant(ownerUserId = 'owner-a', epoch = 1) {
  const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  setActiveHealthProcessingEpoch(epoch, { ownerUserId, accountGeneration });
}
async function seedPending(phase: PhotoDeleteCommand['phase'] = 'metadata_committed') {
  const rawUri = 'file://cache/withdrawal-fixture.png';
  mocks.files.set(rawUri, PNG);
  const identity = { photoId: PHOTO_A, captureSessionId: null };
  const original = await encryptPhotoRendition(rawUri, { ...identity, rendition: 'original' });
  const thumbnail = await encryptPhotoRendition(rawUri, { ...identity, rendition: 'thumbnail' });
  mocks.files.delete(rawUri);
  await setPrivateItem(
    PHOTO_KEY,
    JSON.stringify([
      {
        id: PHOTO_A,
        series: 'front',
        takenLocalDate: '2026-10-05',
        isReference: true,
        notes: null,
        notesCiphertext: await encryptPhotoNote('old private health note'),
        captureSessionId: null,
        localUri: original.encryptedLocalUri,
        encryptedLocalUri: original.encryptedLocalUri,
        thumbnailLocalUri: thumbnail.encryptedLocalUri,
        isEncrypted: true,
        encryptionVersion: original.encryptionVersion,
        keyId: original.keyId,
      },
    ]),
  );
  if (phase === 'prepared') {
    const command: PhotoDeleteCommand = {
      operationId: OPERATION_A,
      photoId: PHOTO_A,
      ownerUserId: 'owner-a',
      epoch: 1,
      phase,
      remotePending: true,
      needsAttention: false,
      files: [original.encryptedLocalUri, thumbnail.encryptedLocalUri],
    };
    await runCurrentHealthDataOperation(async (lease) => {
      await writePhotoDeleteJournal([command], lease);
      for (const uri of command.files) await quarantineEncryptedPhoto(uri, command.operationId);
    });
  } else {
    mocks.blockEncryptedFileDelete = true;
    await expect(removePhoto(PHOTO_A, 'owner-a')).resolves.toMatchObject({
      localDeleted: true,
      cleanupPending: true,
      remotePending: true,
    });
    mocks.blockEncryptedFileDelete = false;
  }
  const commands = await runCurrentHealthDataOperation(readPhotoDeleteJournal);
  expect(commands).toHaveLength(1);
  expect(commands[0]).toMatchObject({
    ownerUserId: 'owner-a',
    epoch: 1,
    photoId: PHOTO_A,
    phase,
    remotePending: true,
  });
  expect(commands[0]!.files).toHaveLength(2);
  const ciphertext = mocks.storage.get(PHOTO_DELETE_JOURNAL_KEY)!;
  expect(ciphertext).not.toContain(PHOTO_A);
  expect(ciphertext).not.toContain('file:');
  return commands[0]!;
}
function SourceProbe() {
  const photos = usePhotos();
  React.useEffect(() => {
    source = photos;
  }, [photos]);
  return null;
}
async function verifyFreshGrant(owner = 'owner-a') {
  await grant(owner, 2);
  await expect(runCurrentHealthDataOperation(readPhotoDeleteJournal)).resolves.toEqual([]);
  await expect(getPhotoDeleteStatus()).resolves.toEqual({
    localPending: 0,
    remotePending: 0,
    needsAttention: false,
  });
  await expect(loadPhotos()).resolves.toEqual([]);
  await act(async () => {
    renderer = create(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(SourceProbe),
      ),
    );
  });
  for (let i = 0; i < 6; i += 1)
    await act(async () => {
      await new Promise<void>((done) => setTimeout(done, 0));
    });
  expect(source?.sourceReady).toBe(true);
  expect(source?.data?.all).toEqual([]);
  expect(source?.isSourceCurrent()).toBe(true);
  await retryPhotoDeletes(owner);
  expect(mocks.outgoing).toEqual([]);
  expect(mocks.storage.has(PHOTO_DELETE_JOURNAL_KEY)).toBe(false);
}
function assertNoOldRecovery(command: PhotoDeleteCommand) {
  expect(mocks.storage.has(PHOTO_DELETE_JOURNAL_KEY)).toBe(false);
  expect(mocks.storage.has(PHOTO_KEY)).toBe(false);
  expect(mocks.files.size).toBe(0);
  const retained = JSON.stringify([...mocks.storage]) + JSON.stringify([...mocks.files]);
  for (const value of [
    command.ownerUserId,
    command.photoId,
    command.operationId,
    ...command.files,
    'old private health note',
  ]) {
    expect(retained).not.toContain(value);
  }
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  await waitForAccountGenerationOperationsToSettle();
  endPrivateKVAccountBoundary();
  endEncryptedPhotoAccountBoundary();
  clearActiveHealthProcessingEpoch();
  queryClient.clear();
  mocks.storage.clear();
  mocks.secure.clear();
  mocks.files.clear();
  mocks.directories.clear();
  mocks.owner = 'owner-a';
  mocks.offline = true;
  mocks.blockEncryptedFileDelete = false;
  mocks.failSingleJournalRemoval = false;
  mocks.failBatchJournalRemoval = false;
  mocks.multiRemoveCalls = [];
  mocks.journalAtMediaCleanup = [];
  mocks.writes = [];
  mocks.outgoing = [];
  mocks.holdJournalWrite = null;
  mocks.journalWriteStarted = null;
  renderer = null;
  source = null;
  await grant();
});
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = null;
  queryClient.clear();
  clearActiveHealthProcessingEpoch();
  await waitForAccountGenerationOperationsToSettle();
});

describe.sequential('C-08B2-R1 actual photo deletion withdrawal lifecycle', () => {
  it.each(['prepared', 'metadata_committed'] as const)(
    'erases a %s journal through health batch cleanup before media fallback, then reconsents cleanly',
    async (phase) => {
      const command = await seedPending(phase);
      queryClient.setQueryData(['photos', 'old-grant'], { id: PHOTO_A, files: command.files });
      await clearHealthPurposeLocalData('owner-a');
      expect(mocks.multiRemoveCalls[0]).toContain(PHOTO_DELETE_JOURNAL_KEY);
      // The media cleanup has its own idempotent fallback; it must not be the
      // only thing removing a health-purpose private record.
      expect(mocks.journalAtMediaCleanup).toEqual([null]);
      expect(activeHealthProcessingLeaseSnapshot()).toBeNull();
      expect(queryClient.getQueryCache().getAll()).toEqual([]);
      assertNoOldRecovery(command);
      await verifyFreshGrant();
      assertNoOldRecovery(command);
    },
  );

  it('erases the batch-owned journal even if the redundant native removal fails, retaining a retryable cleanup failure', async () => {
    const command = await seedPending();
    mocks.failSingleJournalRemoval = true;
    await expect(clearHealthPurposeLocalData('owner-a')).rejects.toThrow(
      'HEALTH_PURPOSE_LOCAL_CLEAR_FAILED',
    );
    assertNoOldRecovery(command);
    expect(activeHealthProcessingLeaseSnapshot()).toBeNull();
    await expect(retryPhotoDeletes('owner-a')).rejects.toThrow();
    mocks.failSingleJournalRemoval = false;
    await clearHealthPurposeLocalData('owner-a');
    await verifyFreshGrant();
  });

  it('does not pretend withdrawal completed when both journal removal paths fail; a real cleanup retry erases it', async () => {
    const command = await seedPending();
    const before = mocks.storage.get(PHOTO_DELETE_JOURNAL_KEY);
    mocks.failSingleJournalRemoval = true;
    mocks.failBatchJournalRemoval = true;
    await expect(clearHealthPurposeLocalData('owner-a')).rejects.toThrow(
      'HEALTH_PURPOSE_LOCAL_CLEAR_FAILED',
    );
    expect(mocks.storage.get(PHOTO_DELETE_JOURNAL_KEY)).toBe(before);
    expect(activeHealthProcessingLeaseSnapshot()).toBeNull();
    await expect(loadPhotos()).rejects.toThrow();
    mocks.failSingleJournalRemoval = false;
    mocks.failBatchJournalRemoval = false;
    await clearHealthPurposeLocalData('owner-a');
    assertNoOldRecovery(command);
    await verifyFreshGrant();
  });

  it('keeps the journal in real ordinary account cleanup and leaves no A recovery data for B', async () => {
    const command = await seedPending();
    expect(LOCAL_PRIVATE_DATA_KEYS).toContain(PHOTO_DELETE_JOURNAL_KEY);
    beginAccountGenerationBoundary();
    beginPrivateKVAccountBoundary();
    beginEncryptedPhotoAccountBoundary();
    try {
      await waitForAccountGenerationOperationsToSettle();
      await waitForPrivateKVWritesToSettle();
      await waitForEncryptedPhotoWritesToSettle();
      await clearLocalPrivateData();
    } finally {
      endEncryptedPhotoAccountBoundary();
      endPrivateKVAccountBoundary();
      endAccountGenerationBoundary();
    }
    expect(mocks.multiRemoveCalls[0]).toContain(PHOTO_DELETE_JOURNAL_KEY);
    assertNoOldRecovery(command);
    mocks.owner = 'owner-b';
    await verifyFreshGrant('owner-b');
  });

  it('rejects a private-KV journal write at entry after health closes, without relying only on the photo wrapper', async () => {
    const command = await seedPending();
    const raw = JSON.stringify({ version: 1, commands: [command] });
    const before = mocks.storage.get(PHOTO_DELETE_JOURNAL_KEY);
    const writes = mocks.writes.length;
    clearActiveHealthProcessingEpoch();
    await expect(setPrivateItem(PHOTO_DELETE_JOURNAL_KEY, raw)).rejects.toThrow(
      'HEALTH_DATA_WRITE_ADMISSION_CLOSED',
    );
    expect(mocks.writes).toHaveLength(writes);
    expect(mocks.storage.get(PHOTO_DELETE_JOURNAL_KEY)).toBe(before);
  });

  it('prevents a delayed private-KV journal write from completing under a later health grant', async () => {
    const command = await seedPending();
    const before = mocks.storage.get(PHOTO_DELETE_JOURNAL_KEY);
    const started = deferred();
    const blocked = deferred();
    mocks.holdJournalWrite = blocked.promise;
    mocks.journalWriteStarted = started.resolve;
    const pending = setPrivateItem(
      PHOTO_DELETE_JOURNAL_KEY,
      JSON.stringify({ version: 1, commands: [{ ...command, needsAttention: true }] }),
    );
    const rejection = expect(pending).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    await started.promise;
    clearActiveHealthProcessingEpoch();
    await grant('owner-a', 2);
    mocks.holdJournalWrite = null;
    blocked.resolve();
    await rejection;
    expect(mocks.storage.get(PHOTO_DELETE_JOURNAL_KEY)).toBe(before);
  });

  it('drains an already-started journal writer during actual withdrawal before removing its old recovery state', async () => {
    const command = await seedPending();
    const started = deferred();
    const blocked = deferred();
    mocks.holdJournalWrite = blocked.promise;
    mocks.journalWriteStarted = started.resolve;
    const writing = runCurrentHealthDataOperation((lease) =>
      writePhotoDeleteJournal([{ ...command, needsAttention: true }], lease),
    );
    const rejected = expect(writing).rejects.toThrow();
    await started.promise;
    let cleaned = false;
    const cleanup = clearHealthPurposeLocalData('owner-a').then(() => {
      cleaned = true;
    });
    await vi.waitFor(() => expect(activeHealthProcessingLeaseSnapshot()).toBeNull());
    expect(cleaned).toBe(false);
    mocks.holdJournalWrite = null;
    blocked.resolve();
    await rejected;
    await cleanup;
    assertNoOldRecovery(command);
    await verifyFreshGrant();
    assertNoOldRecovery(command);
  });

  it('keeps the mismatch guard fail-closed when old-epoch state really is present', async () => {
    await seedPending();
    const before = mocks.storage.get(PHOTO_DELETE_JOURNAL_KEY);
    clearActiveHealthProcessingEpoch();
    await grant('owner-a', 2);
    await expect(runCurrentHealthDataOperation(readPhotoDeleteJournal)).rejects.toThrow(
      'PHOTO_DELETE_JOURNAL_AUTHORITY_MISMATCH',
    );
    await expect(getPhotoDeleteStatus()).rejects.toThrow('PHOTO_DELETE_JOURNAL_AUTHORITY_MISMATCH');
    expect(mocks.storage.get(PHOTO_DELETE_JOURNAL_KEY)).toBe(before);
  });

  it('preserves uninterrupted-authority offline intent and replays the same UUID using real encrypted storage', async () => {
    const command = await seedPending();
    await expect(retryPhotoDeletes('owner-a')).rejects.toThrow('OFFLINE');
    const pending = await runCurrentHealthDataOperation(readPhotoDeleteJournal);
    expect(pending[0]).toMatchObject({
      operationId: command.operationId,
      remotePending: true,
      files: [],
    });
    expect(await loadPhotos()).toEqual([]);
    mocks.offline = false;
    await retryPhotoDeletes('owner-a');
    expect(mocks.outgoing).toHaveLength(2);
    expect(mocks.outgoing[1]).toEqual(mocks.outgoing[0]);
    expect(mocks.outgoing[0]!.name).toBe('apply_photo_delete_outbox_batch');
    expect(mocks.outgoing[0]!.operations[0]).toMatchObject({
      operation_id: command.operationId,
      payload: null,
      entity_id: PHOTO_A,
    });
    expect(await getPhotoDeleteStatus()).toEqual({
      localPending: 0,
      remotePending: 0,
      needsAttention: false,
    });
    expect(await getPrivateItem(PHOTO_DELETE_JOURNAL_KEY)).toBe(
      JSON.stringify({ version: 1, commands: [] }),
    );
  });
});
