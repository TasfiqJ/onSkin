import { toggleCompletion, getPendingCompletionSyncOperations, getCompletedSteps } from '@/features/today/completionsStore';
import { localDateString, currentRoutineType } from '@/features/today/useToday';
import { flushCompletions } from '@/lib/offline/completionQueue';
import { loadRoutineOrderOverrides, saveRoutineOrderOverrides } from '@/features/routine/orderStore';
import { loadCycleConfig, updateCycleConfig, skipTonight } from '@/features/scheduler/cycleStore';
import { loadNotifPrefs, saveNotifPrefs } from '@/features/notifications/store';
import { reserveNotificationSlotLocal, schedulingAttemptsThisWeekForTierLocal } from '@/features/notifications/sentStore';
import * as React from 'react';
import { randomUUID, createHash } from 'node:crypto';
import {
  clearAccountIsolatedState,
  prepareLocalDataForSession,
} from '@/lib/auth/localAccountIsolation';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearHealthPurposeLocalData } from '@/features/healthConsent/selectiveCleanup';
import {
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
  endPrivateKVAccountBoundary,
  assertPrivateKVReadable,
  getPrivateItem,
  setPrivateItem,
} from '@/lib/storage/privateKV';

import {
  decryptPhotoToDataUri,
  endEncryptedPhotoAccountBoundary,
  encryptPhotoNote,
  encryptPhotoRendition,
  quarantineEncryptedPhoto,
} from './encryptedStorage';
import {
  PHOTO_DELETE_JOURNAL_KEY,
  readPhotoDeleteJournal,
  writePhotoDeleteJournal,
  type PhotoDeleteCommand,
} from './photoDeleteJournal';
import { addPhotoWithOutcome, getPhotoDeleteStatus, loadPhotos, removePhoto, retryPhotoDeletes, updatePhoto } from './store';
import { createEncryptedPhotoThumbnail } from './photoThumbnail';
import { usePhotos } from './usePhotos';
import { LargeSecureStore } from '@/lib/supabase/largeSecureStore';
import {
  PHOTO_DELETE_CLEANUP_VAULT_KEY_PREFIX,
  readPhotoDeleteRemoteObligations,
  reservePhotoDeleteRemoteObligation,
  erasePhotoDeleteRemoteCleanupForBinding,
} from './photoDeleteRemoteCleanup';

// Only platform/service ports are mocked. The actual cleanup functions, photo
// store/journal, encryption/private KV, account/health boundaries, and read hook
// run together. In particular neither cleanup function nor its key list is mocked.
const PHOTO_DELETE_CLEANUP_VAULT_KEY =
  PHOTO_DELETE_CLEANUP_VAULT_KEY_PREFIX +
  createHash('sha256').update('layerwell:local-data-owner:v1:owner-a').digest('hex');

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  secure: new Map<string, string>(),
  files: new Map<string, string>(),
  directories: new Set<string>(),
  owner: 'owner-a',
  completionLostOnce: false,
  completionGate: null as Promise<void> | null,
  completionStarted: null as (() => void) | null,
  completionFacts: new Map<string, string>(),
  completionCalls: [] as string[],
  offline: true,
  infoError: null as string | null,
  moveAfterError: null as string | null,
  moveBeforeError: null as string | null,
  moves: [] as { from: string; to: string }[],
  blockEncryptedFileDelete: false,
  failVaultWrite: false,
  failPublicationStage: false,
  failVaultErase: false,
  failSingleJournalRemoval: false,
  failBatchJournalRemoval: false,
  multiRemoveCalls: [] as string[][],
  journalAtMediaCleanup: [] as (string | null)[],
  writes: [] as string[],
  nativeReads: [] as string[],
  outgoing: [] as { name: string; operations: Record<string, unknown>[] }[],
  holdJournalWrite: null as Promise<void> | null,
  journalWriteStarted: null as (() => void) | null,
}));
vi.mock('react-native-get-random-values', () => ({}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-crypto', () => ({
  randomUUID: () => randomUUID(),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_algorithm: string, value: string) =>
    createHash('sha256').update(value).digest('hex'),
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => {
      mocks.nativeReads.push(key);
      return mocks.storage.get(key) ?? null;
    },
    getAllKeys: async () => [...mocks.storage.keys()],
    multiGet: async (keys: string[]) => keys.map((key) => [key, mocks.storage.get(key) ?? null]),
    setItem: async (key: string, value: string) => {
      mocks.writes.push(key);
      if (key === 'layerwell.photo.publication_journal.v1' && mocks.failPublicationStage &&
          JSON.parse(value).stage === 'metadata_committed') {
        throw new Error('SYNTHETIC_PUBLICATION_STAGE_FAILED');
      }
      if (key === PHOTO_DELETE_CLEANUP_VAULT_KEY && mocks.failVaultWrite)
        throw new Error('VAULT_WRITE_FAILED');
      if (key === 'layerwell.photos.deleteJournal.v1') {
        mocks.journalWriteStarted?.();
        if (mocks.holdJournalWrite) await mocks.holdJournalWrite;
      }
      mocks.storage.set(key, value);
    },
    removeItem: async (key: string) => {
      if (key === PHOTO_DELETE_CLEANUP_VAULT_KEY && mocks.failVaultErase)
        throw new Error('VAULT_ERASE_FAILED');
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
  getInfoAsync: async (uri: string) => {
    if (mocks.infoError === uri) throw new Error('INFO_UNAVAILABLE');
    return { exists: mocks.files.has(uri) || mocks.directories.has(uri) };
  },
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
    mocks.moves.push({ from, to });
    if (mocks.moveBeforeError === from) throw new Error('MOVE_UNAVAILABLE');
    const value = mocks.files.get(from);
    if (value === undefined) throw new Error('FILE_MISSING');
    mocks.files.set(to, value);
    mocks.files.delete(from);
    if (mocks.moveAfterError === from) {
      mocks.moveAfterError = null;
      throw new Error('MOVE_ACK_LOST');
    }
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
  readLocalDataOwnership: async (owner: string) => (owner === mocks.owner ? 'match' : 'mismatch'),
  localDataOwnerBinding: async (owner: string) =>
    createHash('sha256')
      .update('layerwell:local-data-owner:v1:' + owner)
      .digest('hex'),
  markLocalDataCleanupRequired: async () => undefined,
  clearLocalDataCleanupRequired: async () => undefined,
  claimLocalDataOwnership: async () => undefined,
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
  getPersistedSupabaseUser: async () => ({ data: { user: { id: mocks.owner } } }),
  supabase: {
    rpc: (name: string, args: Record<string, unknown>) => {
      if (name === 'record_routine_completion') return (async () => {
        const event = String(args.p_event_id);
        mocks.completionCalls.push(event);
        if (mocks.offline) throw new Error('OFFLINE');
        const prior = mocks.completionFacts.get(event);
        const payload = JSON.stringify(args);
        if (prior && prior !== payload) throw new Error('CONFLICTING_REPLAY_PAYLOAD');
        mocks.completionFacts.set(event, payload);
        mocks.completionStarted?.();
        if (mocks.completionGate) await mocks.completionGate;
        if (mocks.completionLostOnce) {
          mocks.completionLostOnce = false;
          throw new Error('COMMIT_THEN_RESPONSE_LOST');
        }
        return { data: { version: 1, event_id: event, status: prior ? 'idempotent' : 'accepted', code: null }, error: null };
      })();
      return { abortSignal: async (signal: AbortSignal) => {
        if (signal.aborted) throw new Error('ABORTED');
        mocks.outgoing.push({ name, operations: args.p_operations as Record<string, unknown>[] });
        if (mocks.offline) throw new Error('OFFLINE');
        return {
          data: (args.p_operations as Record<string, unknown>[]).map((operation) => ({
            operation_id: operation.operation_id,
            status: 'applied',
            error_class: null,
          })),
          error: null,
        };
      },
    };
    },
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
async function seedPending(phase: PhotoDeleteCommand['phase'] | 'live' = 'metadata_committed') {
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
  if (phase === 'live')
    return {
      operationId: OPERATION_A,
      photoId: PHOTO_A,
      ownerUserId: 'owner-a',
      epoch: 1,
      phase: 'prepared' as const,
      remotePending: true,
      needsAttention: false,
      files: [original.encryptedLocalUri, thumbnail.encryptedLocalUri],
    };
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
beforeEach(async () => {
  mocks.failPublicationStage = false;
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
  mocks.completionLostOnce = false;
  mocks.completionGate = null;
  mocks.completionStarted = null;
  mocks.completionFacts.clear();
  mocks.completionCalls = [];
  mocks.offline = true;
  mocks.infoError = null;
  mocks.moveAfterError = null;
  mocks.moveBeforeError = null;
  mocks.moves = [];
  mocks.blockEncryptedFileDelete = false;
  mocks.failVaultWrite = false;
  mocks.failVaultErase = false;
  mocks.failSingleJournalRemoval = false;
  mocks.failBatchJournalRemoval = false;
  mocks.multiRemoveCalls = [];
  mocks.journalAtMediaCleanup = [];
  mocks.writes = [];
  mocks.nativeReads = [];
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

describe.sequential('C-08B2-R3 real encrypted deletion/file/sign-out recovery', () => {
  it('recovers a committed encrypted photo after the publication acknowledgement fails', async () => {
    const raw = 'file://cache/synthetic-publication.png';
    mocks.files.set(raw, PNG);
    mocks.failPublicationStage = true;
    vi.mocked(createEncryptedPhotoThumbnail).mockImplementation(async ({ sourceUri, photoId, captureSessionId }) =>
      encryptPhotoRendition(sourceUri, { photoId, captureSessionId, rendition: 'thumbnail' }));
    try {
      const result = await addPhotoWithOutcome({ takenLocalDate: '2026-10-23', localUri: raw, notes: 'synthetic note' });
      expect(result).toMatchObject({ createdNow: true, sourceCleanupPending: true });
      expect(mocks.files.has(raw)).toBe(true);
      expect(JSON.parse(mocks.storage.get('layerwell.photo.publication_journal.v1')!).stage).toBe('pair_adopted');
      expect(mocks.storage.get(PHOTO_KEY)).not.toContain('synthetic note');
      expect(mocks.files.get(result.photo.encryptedLocalUri!)).not.toContain(PNG);

      mocks.failPublicationStage = false;
      const recovered = await loadPhotos();
      expect(recovered).toHaveLength(1);
      expect(recovered[0]!.id).toBe(result.photo.id);
      expect(recovered[0]!.notes).toBe('synthetic note');
      expect(mocks.files.has(raw)).toBe(false);
      expect(mocks.storage.has('layerwell.photo.publication_journal.v1')).toBe(false);
      await expect(decryptPhotoToDataUri(result.photo.encryptedLocalUri!, {
        photoId: result.photo.id, captureSessionId: null, rendition: 'original',
      })).resolves.toBe(`data:image/png;base64,${PNG}`);
    } finally {
      vi.mocked(createEncryptedPhotoThumbnail).mockReset();
    }
  });

  it.each(['original', 'thumbnail', 'both'] as const)(
    'deletes safely with %s already absent, retaining authenticated intent',
    async (missing) => {
      const live = await seedPending('live');
      if (missing !== 'thumbnail') mocks.files.delete(live.files[0]!);
      if (missing !== 'original') mocks.files.delete(live.files[1]!);
      await expect(removePhoto(PHOTO_A, 'owner-a')).resolves.toEqual({
        localDeleted: true,
        cleanupPending: false,
        remotePending: true,
      });
      expect(mocks.files.size).toBe(0);
      const quarantinedOriginal = mocks.moves.some(
        (move) => move.from === live.files[0] && move.to.includes('.pending-delete-'),
      );
      const quarantinedThumbnail = mocks.moves.some(
        (move) => move.from === live.files[1] && move.to.includes('.pending-delete-'),
      );
      expect(quarantinedOriginal).toBe(missing === 'thumbnail');
      expect(quarantinedThumbnail).toBe(missing === 'original');
      const commands = await runCurrentHealthDataOperation(readPhotoDeleteJournal);
      expect(commands).toHaveLength(1);
      expect(commands[0]).toMatchObject({
        photoId: PHOTO_A,
        phase: 'metadata_committed',
        remotePending: true,
        files: [],
      });
      // A separate authoritative read/recovery is what a fresh Progress mount runs.
      await expect(loadPhotos()).resolves.toEqual([]);
      expect(await getPhotoDeleteStatus()).toMatchObject({ localPending: 0, remotePending: 1 });
      mocks.offline = false;
      await retryPhotoDeletes('owner-a');
      expect(mocks.outgoing[0]!.operations[0]?.entity_id).toBe(PHOTO_A);
      expect(await getPhotoDeleteStatus()).toMatchObject({ remotePending: 0 });
    },
  );

  it('recovers an interrupted prepared delete with an absent thumbnail after the original was quarantined', async () => {
    const live = await seedPending('live');
    await runCurrentHealthDataOperation((lease) => writePhotoDeleteJournal([live], lease));
    await quarantineEncryptedPhoto(live.files[0]!, live.operationId);
    mocks.files.delete(live.files[1]!);
    // No remembered operation result: the real fresh-read path reconciles durable state.
    const rows = await loadPhotos();
    expect(rows.map((row) => row.id)).toEqual([PHOTO_A]);
    expect(mocks.files.has(live.files[0]!)).toBe(true);
    expect(mocks.files.has(live.files[1]!)).toBe(false);
    expect(await runCurrentHealthDataOperation(readPhotoDeleteJournal)).toEqual([]);
    await expect(loadPhotos()).resolves.toHaveLength(1);
    // Explicit user retry now commits the deletion; remote obligation cannot vanish.
    await removePhoto(PHOTO_A, 'owner-a');
    expect(await getPhotoDeleteStatus()).toMatchObject({ remotePending: 1 });
    expect(mocks.files.size).toBe(0);
  });

  it('does not confuse filesystem uncertainty with absence; a later real read restores and cancels the failed prepare', async () => {
    const live = await seedPending('live');
    mocks.infoError = live.files[1]!;
    mocks.moveBeforeError = live.files[1]!;
    await expect(removePhoto(PHOTO_A, 'owner-a')).rejects.toThrow();
    expect(await runCurrentHealthDataOperation(readPhotoDeleteJournal)).toHaveLength(1);
    expect(
      mocks.files.has(live.files[0]!) ||
        [...mocks.files.keys()].some((file) => file.startsWith(live.files[0]!)),
    ).toBe(true);
    mocks.infoError = null;
    mocks.moveBeforeError = null;
    await expect(loadPhotos()).resolves.toHaveLength(1);
    expect(await runCurrentHealthDataOperation(readPhotoDeleteJournal)).toEqual([]);
    expect([...mocks.files.keys()].sort()).toEqual([...live.files].sort());
  });

  it('recognizes a completed quarantine move whose acknowledgement was lost without losing either rendition', async () => {
    const live = await seedPending('live');
    mocks.moveAfterError = live.files[0]!;
    await expect(removePhoto(PHOTO_A, 'owner-a')).resolves.toMatchObject({
      localDeleted: true,
      remotePending: true,
    });
    expect(mocks.files.size).toBe(0);
    await expect(loadPhotos()).resolves.toEqual([]);
  });

  it('keeps an accepted offline obligation through the actual explicit-sign-out isolation path, invisible to B and resumable by fresh A', async () => {
    await seedPending();
    await expect(retryPhotoDeletes('owner-a')).rejects.toThrow('OFFLINE');
    const accepted = mocks.outgoing[0]!.operations[0]!;
    mocks.outgoing = [];
    // This is the exact private isolation function used by AuthProvider's
    // explicit sign-out applySessionBoundary(null), with its real cleanup/drains.
    await prepareLocalDataForSession('owner-a', null);
    expect(mocks.storage.has(PHOTO_DELETE_JOURNAL_KEY)).toBe(false);
    expect(mocks.storage.has(PHOTO_KEY)).toBe(false);
    expect(mocks.files.size).toBe(0);
    expect(activeHealthProcessingLeaseSnapshot()).toBeNull();
    mocks.owner = 'owner-b';
    await grant('owner-b', 2);
    await retryPhotoDeletes('owner-b');
    expect(await getPhotoDeleteStatus()).toMatchObject({ remotePending: 0 });
    expect(mocks.outgoing).toEqual([]);
    await clearAccountIsolatedState();
    mocks.owner = 'owner-a';
    await grant('owner-a', 3);
    expect(await loadPhotos()).toEqual([]);
    expect(await getPhotoDeleteStatus()).toMatchObject({ remotePending: 1 });
    mocks.offline = false;
    await retryPhotoDeletes('owner-a');
    expect(mocks.outgoing).toHaveLength(1);
    expect(mocks.outgoing[0]!.operations).toEqual([accepted]);
    expect(await getPhotoDeleteStatus()).toMatchObject({ remotePending: 0 });
    // Neither encrypted vault nor key remains after the last acknowledgement.
    expect([...mocks.storage.keys()].filter((key) => key.includes('photoDeleteCleanup'))).toEqual(
      [],
    );
    expect([...mocks.secure.keys()].filter((key) => key.includes('photoDeleteCleanup'))).toEqual(
      [],
    );
  });

  it('withdrawal supersedes the separate remote obligation too, with no residue in a later grant', async () => {
    const command = await seedPending();
    await clearHealthPurposeLocalData('owner-a');
    assertNoOldRecovery(command);
    expect([...mocks.storage.keys()].filter((key) => key.includes('photoDeleteCleanup'))).toEqual(
      [],
    );
    expect([...mocks.secure.keys()].filter((key) => key.includes('photoDeleteCleanup'))).toEqual(
      [],
    );
    await verifyFreshGrant();
  });

  it('already-terminal deletion leaves nothing to preserve on sign-out', async () => {
    await seedPending();
    mocks.offline = false;
    await retryPhotoDeletes('owner-a');
    mocks.outgoing = [];
    await prepareLocalDataForSession('owner-a', null);
    await grant('owner-a', 2);
    await retryPhotoDeletes('owner-a');
    expect(await getPhotoDeleteStatus()).toEqual({
      localPending: 0,
      remotePending: 0,
      needsAttention: false,
    });
    expect(mocks.outgoing).toEqual([]);
    expect([...mocks.storage.keys()].filter((key) => key.includes('photoDeleteCleanup'))).toEqual(
      [],
    );
  });
  it('keeps independent tombstone encryption outside the ordinary private-KV key lifecycle and startup scanner', async () => {
    const command = await seedPending();
    await prepareLocalDataForSession('owner-a', null);
    await expect(assertPrivateKVReadable()).resolves.toBeUndefined();
    await expect(getPrivateItem(PHOTO_DELETE_CLEANUP_VAULT_KEY)).rejects.toThrow(
      'PRIVATE_KV_ENVELOPE_FOREIGN',
    );
    const vault = new LargeSecureStore();
    const raw = await vault.getItem(PHOTO_DELETE_CLEANUP_VAULT_KEY);
    const parsed = JSON.parse(raw!) as { version: number; operations: Record<string, unknown>[] };
    expect(parsed.operations).toHaveLength(1);
    expect(Object.keys(parsed.operations[0]!).sort()).toEqual([
      'needsAttention',
      'operationId',
      'ownerBinding',
      'phase',
      'photoId',
    ]);
    expect(parsed.operations[0]).toMatchObject({
      operationId: command.operationId,
      photoId: PHOTO_A,
      phase: 'committed',
    });
    expect(parsed.operations[0]!.ownerBinding).toMatch(/^[a-f0-9]{64}$/);
    for (const value of [
      'owner-a',
      'file:',
      'old private health note',
      'access_token',
      'refresh_token',
      'epoch',
    ])
      expect(raw).not.toContain(value);
    const cipher = mocks.storage.get(PHOTO_DELETE_CLEANUP_VAULT_KEY)!;
    expect(cipher).not.toContain(PHOTO_A);
    expect(cipher).not.toContain(command.operationId);
    expect([...mocks.secure.keys()]).toEqual([PHOTO_DELETE_CLEANUP_VAULT_KEY]);
    // Only canonical independent namespaces bypass generic KV validation.
    const lookalike = PHOTO_DELETE_CLEANUP_VAULT_KEY_PREFIX + 'not-a-canonical-owner';
    mocks.storage.set(
      lookalike,
      '{"version":"xchacha20poly1305:v1","nonceHex":"bad","ciphertextHex":"bad"}',
    );
    await expect(assertPrivateKVReadable()).rejects.toThrow('PRIVATE_KV_ENVELOPE_INVALID');
    mocks.storage.delete(lookalike);
  });

  it('never exposes A tombstones to B or to a stale captured lease', async () => {
    await seedPending();
    const oldLease = await runCurrentHealthDataOperation((lease) => lease);
    await prepareLocalDataForSession('owner-a', null);
    mocks.owner = 'owner-b';
    await grant('owner-b', 2);
    await expect(readPhotoDeleteRemoteObligations(oldLease)).rejects.toThrow();
    await expect(runCurrentHealthDataOperation(readPhotoDeleteRemoteObligations)).resolves.toEqual(
      [],
    );
    await expect(retryPhotoDeletes('owner-a')).rejects.toThrow('PHOTO_DELETE_OWNER_MISMATCH');
    expect(mocks.outgoing).toEqual([]);
  });

  it('owner-limited withdrawal erases A obligations while preserving B, and repeated erasure is idempotent', async () => {
    await seedPending();
    await grant('owner-b', 2);
    const operationB = {
      operationId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      photoId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      needsAttention: false,
    };
    await runCurrentHealthDataOperation((lease) =>
      reservePhotoDeleteRemoteObligation(operationB, lease, true),
    );
    await grant('owner-a', 1);
    await clearHealthPurposeLocalData('owner-a');
    const bindingA = createHash('sha256')
      .update('layerwell:local-data-owner:v1:owner-a')
      .digest('hex');
    await erasePhotoDeleteRemoteCleanupForBinding(bindingA);
    mocks.owner = 'owner-b';
    await grant('owner-b', 2);
    expect(await runCurrentHealthDataOperation(readPhotoDeleteRemoteObligations)).toEqual([
      { ...operationB, phase: 'committed' },
    ]);
    await erasePhotoDeleteRemoteCleanupForBinding(
      createHash('sha256').update('layerwell:local-data-owner:v1:owner-b').digest('hex'),
    );
    expect(mocks.storage.has(PHOTO_DELETE_CLEANUP_VAULT_KEY)).toBe(false);
    expect(mocks.secure.has(PHOTO_DELETE_CLEANUP_VAULT_KEY)).toBe(false);
  });

  it('reconciles a reservation interrupted before local metadata deletion without dispatching remote cleanup', async () => {
    const live = await seedPending('live');
    await runCurrentHealthDataOperation((lease) => reservePhotoDeleteRemoteObligation(live, lease));
    expect(await getPhotoDeleteStatus()).toMatchObject({ localPending: 1, remotePending: 1 });
    await retryPhotoDeletes('owner-a');
    expect(mocks.outgoing).toEqual([]);
    expect(await loadPhotos()).toHaveLength(1);
    expect([...mocks.files.keys()].sort()).toEqual([...live.files].sort());
    expect(mocks.storage.has(PHOTO_DELETE_CLEANUP_VAULT_KEY)).toBe(false);
  });

  it('reservation preceding a sign-out remains a minimal obligation instead of inheriting a new owner', async () => {
    const live = await seedPending('live');
    await runCurrentHealthDataOperation((lease) => reservePhotoDeleteRemoteObligation(live, lease));
    await prepareLocalDataForSession('owner-a', null);
    await grant('owner-a', 2);
    mocks.offline = false;
    await retryPhotoDeletes('owner-a');
    expect(mocks.outgoing[0]!.operations[0]?.operation_id).toBe(live.operationId);
    expect(mocks.storage.has(PHOTO_DELETE_CLEANUP_VAULT_KEY)).toBe(false);
  });

  it('never accepts local deletion when independent remote-intent reservation cannot persist', async () => {
    const live = await seedPending('live');
    const before = mocks.storage.get(PHOTO_KEY);
    mocks.failVaultWrite = true;
    await expect(removePhoto(PHOTO_A, 'owner-a')).rejects.toThrow('VAULT_WRITE_FAILED');
    expect(mocks.storage.get(PHOTO_KEY)).toBe(before);
    expect(mocks.storage.has(PHOTO_DELETE_JOURNAL_KEY)).toBe(false);
    expect([...mocks.files.keys()].sort()).toEqual([...live.files].sort());
    expect(mocks.storage.has(PHOTO_DELETE_CLEANUP_VAULT_KEY)).toBe(false);
    expect(mocks.secure.has(PHOTO_DELETE_CLEANUP_VAULT_KEY)).toBe(false);
    mocks.failVaultWrite = false;
    await removePhoto(PHOTO_A, 'owner-a');
    expect(await getPhotoDeleteStatus()).toMatchObject({ remotePending: 1 });
  });

  it('keeps withdrawal explicitly incomplete until the minimal remote obligation is actually erased', async () => {
    await seedPending();
    mocks.failVaultErase = true;
    await expect(clearHealthPurposeLocalData('owner-a')).rejects.toThrow(
      'HEALTH_PURPOSE_LOCAL_CLEAR_FAILED',
    );
    expect(activeHealthProcessingLeaseSnapshot()).toBeNull();
    expect(mocks.storage.has(PHOTO_DELETE_JOURNAL_KEY)).toBe(false);
    expect(mocks.storage.has(PHOTO_KEY)).toBe(false);
    expect(mocks.storage.has(PHOTO_DELETE_CLEANUP_VAULT_KEY)).toBe(true);
    await expect(retryPhotoDeletes('owner-a')).rejects.toThrow();
    mocks.failVaultErase = false;
    await clearHealthPurposeLocalData('owner-a');
    expect(mocks.storage.has(PHOTO_DELETE_CLEANUP_VAULT_KEY)).toBe(false);
    expect(mocks.secure.has(PHOTO_DELETE_CLEANUP_VAULT_KEY)).toBe(false);
    await verifyFreshGrant();
  });

  it('never even reads or decrypts A cleanup namespace while serving a legitimately active B', async () => {
    await seedPending();
    await prepareLocalDataForSession('owner-a', null);
    mocks.owner = 'owner-b';
    await grant('owner-b', 2);
    mocks.nativeReads = [];
    expect(await runCurrentHealthDataOperation(readPhotoDeleteRemoteObligations)).toEqual([]);
    expect(mocks.nativeReads).not.toContain(PHOTO_DELETE_CLEANUP_VAULT_KEY);
  });

  it('erases an exact owner obligation during withdrawal even if its independent encryption key is lost', async () => {
    await seedPending();
    mocks.secure.delete(PHOTO_DELETE_CLEANUP_VAULT_KEY);
    await expect(clearHealthPurposeLocalData('owner-a')).resolves.toBeUndefined();
    expect(mocks.storage.has(PHOTO_DELETE_CLEANUP_VAULT_KEY)).toBe(false);
    expect(mocks.secure.has(PHOTO_DELETE_CLEANUP_VAULT_KEY)).toBe(false);
    await verifyFreshGrant();
  });

  it('M102 retains real encrypted completion identities across parallel duplicates, offline and lost acknowledgements', async () => {
    const day = localDateString();
    const a = `PM:${PHOTO_A}`;
    const b = `PM:${OPERATION_A}`;
    const scheduled = { phase: 'PM' as const, stepKeys: [a, b] };
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const remote = { source: 'real_plan' as const, timezone, stepOrder: 1 };
    await Promise.all(Array.from({ length: 12 }, (_, index) => toggleCompletion(
      index % 2 ? a : b, day, scheduled, { ...remote, stepOrder: index % 2 ? 1 : 2 },
    )));
    expect(await getCompletedSteps(day)).toEqual(new Set([a, b]));
    const pending = await getPendingCompletionSyncOperations();
    expect(pending.map((operation) => operation.kind)).toEqual(['step', 'step', 'routine_day']);
    const ids = pending.map((operation) => operation.eventId);
    expect(mocks.storage.get('layerwell.completions.v1')).not.toContain(PHOTO_A);
    expect(await flushCompletions()).toMatchObject({ flushed: 0, remaining: 3 });
    mocks.offline = false;
    mocks.completionLostOnce = true;
    expect(await flushCompletions()).toMatchObject({ flushed: 0, remaining: 3 });
    expect((await getPendingCompletionSyncOperations()).map((operation) => operation.eventId)).toEqual(ids);
    expect(await flushCompletions()).toMatchObject({ flushed: 3, remaining: 0 });
    expect(mocks.completionFacts.size).toBe(3);
    expect(mocks.completionCalls.slice(-3)).toEqual(ids);
    await toggleCompletion(a, day, scheduled, remote);
    expect(await getPendingCompletionSyncOperations()).toEqual([]);
  });

  it('M102 withdrawal beats an actual encrypted outbox late remote acknowledgement', async () => {
    const day = localDateString();
    await toggleCompletion(`AM:${PHOTO_A}`, day, undefined, {
      source: 'real_plan', stepOrder: 1, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    let release!: () => void;
    let started!: () => void;
    mocks.offline = false;
    mocks.completionGate = new Promise<void>((resolve) => { release = resolve; });
    const entered = new Promise<void>((resolve) => { started = resolve; });
    mocks.completionStarted = started;
    const replay = flushCompletions().catch((error: unknown) => error);
    await entered;
    const cleanup = clearHealthPurposeLocalData('owner-a');
    // Wait for the real boundary to close, without manually fabricating one.
    for (let i = 0; i < 20 && activeHealthProcessingLeaseSnapshot(); i++) await Promise.resolve();
    expect(activeHealthProcessingLeaseSnapshot()).toBeNull();
    release();
    expect(await replay).toBeInstanceOf(Error);
    await cleanup;
    expect(mocks.storage.has('layerwell.completions.v1')).toBe(false);
    await grant('owner-a', 2);
    expect(await getPendingCompletionSyncOperations()).toEqual([]);
    expect(await getCompletedSteps(day)).toEqual(new Set());
  });

  it('M102 merges real encrypted routine/cycle/preferences and atomically caps local attempts', async () => {
    vi.stubGlobal('__DEV__', true); // Existing draft corpus, never an approval receipt.
    try {
      const empty = await loadRoutineOrderOverrides();
      await Promise.all([
        saveRoutineOrderOverrides({ previous: empty, next: { ...empty, am: [PHOTO_A] } }),
        saveRoutineOrderOverrides({ previous: empty, next: { ...empty, pm: [OPERATION_A] } }),
        updateCycleConfig({ variant: 'classic' }),
        skipTonight(),
        saveNotifPrefs({ amEnabled: true }),
        saveNotifPrefs({ pmTime: '20:00' }),
      ]);
      expect(await loadRoutineOrderOverrides()).toMatchObject({ am: [PHOTO_A], pm: [OPERATION_A] });
      expect(await loadCycleConfig()).toMatchObject({ variant: 'classic', skips: [localDateString()] });
      expect(await loadNotifPrefs()).toMatchObject({ amEnabled: true, pmEnabled: false, pmTime: '20:00', liveActivityEnabled: false });
      const now = Date.now();
      const outcomes = await Promise.all(Array.from({ length: 10 }, () => reserveNotificationSlotLocal('replenishment', now)));
      expect(outcomes.filter(Boolean)).toHaveLength(3);
      expect(await schedulingAttemptsThisWeekForTierLocal('behavioural', now)).toBe(3);
      for (const key of ['layerwell.routineOrder.v1', 'layerwell.cycle.v2', 'layerwell.notifPrefs.v1', 'layerwell.notiflog.v1']) {
        expect(JSON.parse(mocks.storage.get(key)!)).toHaveProperty('ciphertextHex');
      }
      await clearHealthPurposeLocalData('owner-a');
      await grant('owner-a', 2);
      expect(await loadRoutineOrderOverrides()).toEqual(empty);
      expect(await loadNotifPrefs()).toMatchObject({ amEnabled: false, pmEnabled: false });
    } finally { vi.unstubAllGlobals(); }
  });

  it('M102 opens and edits actual encrypted pair/notes and preserves ciphertext on unknown metadata', async () => {
    const live = await seedPending('live');
    const [photo] = await loadPhotos();
    expect(photo?.notes).toBe('old private health note');
    for (const [index, uri] of live.files.entries()) expect(await decryptPhotoToDataUri(uri, {
      photoId: PHOTO_A, captureSessionId: null, rendition: index === 0 ? 'original' : 'thumbnail',
    })).toBe(`data:image/png;base64,${PNG}`);
    await updatePhoto(PHOTO_A, { notes: 'synthetic edited note' });
    expect((await loadPhotos())[0]?.notes).toBe('synthetic edited note');
    expect(mocks.storage.get(PHOTO_KEY)).not.toContain('synthetic edited note');
    const prior = await getPrivateItem(PHOTO_KEY);
    const originals = live.files.map((uri) => mocks.files.get(uri));
    await setPrivateItem(PHOTO_KEY, '{bad metadata');
    await expect(loadPhotos()).rejects.toThrow('PHOTO_METADATA_INVALID');
    expect(live.files.map((uri) => mocks.files.get(uri))).toEqual(originals);
    await setPrivateItem(PHOTO_KEY, prior!);
    expect((await loadPhotos())[0]?.notes).toBe('synthetic edited note');
  });

  it.each([
    ['2026-03-08T06:59:00.000Z', '2026-03-08', 'AM'],
    ['2026-03-08T07:01:00.000Z', '2026-03-08', 'AM'],
    ['2026-11-01T05:59:00.000Z', '2026-11-01', 'AM'],
    ['2026-11-01T06:01:00.000Z', '2026-11-01', 'AM'],
    ['2026-10-21T03:59:00.000Z', '2026-10-20', 'PM'],
    ['2026-10-21T04:01:00.000Z', '2026-10-21', 'AM'],
    ['2026-10-20T20:59:00.000Z', '2026-10-20', 'AM'],
    ['2026-10-20T21:00:00.000Z', '2026-10-20', 'PM'],
  ])('M102 binds real encrypted completion to local date/phase through DST and midnight at %s', async (instant, day, phase) => {
    vi.stubEnv('TZ', 'America/Toronto');
    vi.useFakeTimers();
    vi.setSystemTime(new Date(instant!));
    try {
      expect(localDateString()).toBe(day);
      expect(currentRoutineType()).toBe(phase);
      await toggleCompletion(`${phase}:${PHOTO_A}`, day, undefined, {
        source: 'real_plan', stepOrder: 1, timezone: 'America/Toronto',
      });
      expect(await getPendingCompletionSyncOperations()).toEqual([
        expect.objectContaining({ completedAt: instant, completedDate: day, routineType: phase, timezone: 'America/Toronto' }),
      ]);
    } finally { vi.useRealTimers(); vi.unstubAllEnvs(); }
  });

  it('restarts from durable encrypted state after a partial prepared delete with both renditions missing', async () => {
    const live = await seedPending('live');
    await runCurrentHealthDataOperation((lease) => writePhotoDeleteJournal([live], lease));
    for (const file of live.files) mocks.files.delete(file);
    vi.resetModules();
    const account = await import('@/lib/auth/accountGeneration');
    const health = await import('@/lib/consent/healthProcessingEpoch');
    const generation = await account.runAccountGenerationOperation((lease) => lease.generation);
    health.setActiveHealthProcessingEpoch(1, {
      ownerUserId: 'owner-a',
      accountGeneration: generation,
    });
    const fresh = await import('./store');
    expect(await fresh.loadPhotos()).toHaveLength(1);
    expect(await fresh.getPhotoDeleteStatus()).toEqual({
      localPending: 0,
      remotePending: 0,
      needsAttention: false,
    });
    expect(mocks.files.size).toBe(0);
    await fresh.removePhoto(PHOTO_A, 'owner-a');
    expect(await fresh.loadPhotos()).toEqual([]);
    expect(await fresh.getPhotoDeleteStatus()).toMatchObject({ remotePending: 1 });
    health.clearActiveHealthProcessingEpoch();
  });
});
