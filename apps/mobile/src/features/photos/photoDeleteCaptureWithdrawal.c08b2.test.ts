import {
  claimLocalDataOwnership,
  clearLocalDataCleanupRequired,
  localDataOwnerBinding,
  LOCAL_DATA_OWNER_HASH_KEY,
} from '@/lib/auth/sessionOwner';
import { hasPhotoCaptureConsent, grantPhotoCaptureConsent } from './consent';
import { consentCopyFor } from '@/lib/consent/dependentConsentContract';
import {
  resetHealthDependentConsentLeasesForTests,
  runHealthDependentConsentOperation,
} from '@/lib/consent/dependentConsentLease';
import { readDependentConsentWithdrawalTombstone } from '@/lib/consent/dependentConsentLocal';
import { withdrawHealthDependentConsent } from '@/lib/consent/dependentConsentLifecycle';

import * as React from 'react';
import { randomUUID, createHash, randomBytes } from 'node:crypto';
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
  setPrivateItem,
} from '@/lib/storage/privateKV';

import {
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
import {
  getPhotoDeleteStatus,
  loadPhotos,
  removePhoto,
  retryPhotoDeletes,
  clearPhotos,
} from './store';
import { usePhotos } from './usePhotos';
import { LargeSecureStore } from '@/lib/supabase/largeSecureStore';
import {
  PHOTO_DELETE_CLEANUP_VAULT_KEY_PREFIX,
  readPhotoDeleteRemoteObligations,
  reservePhotoDeleteRemoteObligation,
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
  remoteState: 'active' as 'active' | 'unconsented' | 'withdrawing' | 'withdrawn',
  consentGeneration: 4,
  statusUnavailable: false,
  withdrawalPending: false,
  withdrawals: [] as Record<string, unknown>[],
  offline: true,
  remoteGate: null as Promise<void> | null,
  remoteStarted: null as (() => void) | null,
  infoError: null as string | null,
  moveAfterError: null as string | null,
  moveBeforeError: null as string | null,
  moves: [] as { from: string; to: string }[],
  blockEncryptedFileDelete: false,
  failVaultWrite: false,
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
  getRandomBytesAsync: async (length: number) => new Uint8Array(randomBytes(length)),
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
vi.mock('@/lib/env', () => ({
  isSupabaseConfigured: true,
  env: { appEnvironment: 'development' },
}));
vi.mock('@/lib/consent/consent', () => ({
  getHealthDependentConsentStatus: async () => {
    if (mocks.statusUnavailable) throw new Error('CONSENT_STATUS_UNAVAILABLE');
    return remoteStatus();
  },
  recordConsent: async () => {
    mocks.remoteState = 'active';
    mocks.consentGeneration += 1;
    return remoteStatus();
  },
}));
vi.mock('@/lib/consent/withdrawal', () => ({
  HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_PENDING: 'HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_PENDING',
  withdrawConsent: async (request: Record<string, unknown>) => {
    mocks.withdrawals.push(request);
    mocks.consentGeneration = Number(request.expectedConsentGeneration) + 1;
    mocks.remoteState = mocks.withdrawalPending ? 'withdrawing' : 'withdrawn';
    if (mocks.withdrawalPending) throw new Error('HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_PENDING');
    return {
      operationId: 'purpose-withdrawal',
      consentType: 'photo_capture',
      processingEpoch: request.expectedProcessingEpoch,
      consentGeneration: mocks.consentGeneration,
      replayed: mocks.withdrawals.length > 1,
    };
  },
}));
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
        mocks.remoteStarted?.();
        if (mocks.remoteGate) await mocks.remoteGate;
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
  mocks.owner = ownerUserId;
  await claimLocalDataOwnership(ownerUserId);
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
  mocks.remoteGate = null;
  mocks.remoteStarted = null;
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
  await clearLocalDataCleanupRequired();
  resetHealthDependentConsentLeasesForTests();
  mocks.remoteState = 'active';
  mocks.consentGeneration = 4;
  mocks.statusUnavailable = false;
  mocks.withdrawalPending = false;
  mocks.withdrawals = [];
  await grant();
});
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = null;
  queryClient.clear();
  clearActiveHealthProcessingEpoch();
  await waitForAccountGenerationOperationsToSettle();
});

function remoteStatus() {
  const copy = consentCopyFor(
    'photo_capture',
    mocks.remoteState === 'active' ? 'grant' : 'withdrawal',
  );
  return {
    consentType: 'photo_capture' as const,
    state: mocks.remoteState,
    generation: mocks.consentGeneration,
    healthEpoch: activeHealthProcessingLeaseSnapshot()?.epoch ?? 1,
    version: copy.version,
    consentTextHash: copy.sha256,
  };
}
async function pendingUnderCaptureAuthority() {
  await grantPhotoCaptureConsent();
  expect(await hasPhotoCaptureConsent()).toBe(true);
  const command = await seedPending();
  await expect(retryPhotoDeletes('owner-a')).rejects.toThrow('OFFLINE');
  expect(mocks.storage.has(PHOTO_DELETE_CLEANUP_VAULT_KEY)).toBe(true);
  expect(mocks.secure.has(PHOTO_DELETE_CLEANUP_VAULT_KEY)).toBe(true);
  mocks.outgoing = [];
  return command;
}
function assertVaultAbsent() {
  expect(mocks.storage.has(PHOTO_DELETE_CLEANUP_VAULT_KEY)).toBe(false);
  expect(mocks.secure.has(PHOTO_DELETE_CLEANUP_VAULT_KEY)).toBe(false);
}
async function assertFreshCaptureCannotReplay(command: PhotoDeleteCommand) {
  await grantPhotoCaptureConsent();
  expect(await hasPhotoCaptureConsent()).toBe(true);
  await verifyFreshGrant();
  assertVaultAbsent();
  assertNoOldRecovery(command);
  expect(mocks.outgoing).toEqual([]);
}

// The dependent lifecycle, purpose tombstones/receipts, canonical owner proof,
// clearPhotos, encrypted media/KV, independent vault and sign-out isolation are
// real. Only remote consent responses and native service I/O are controlled.
describe.sequential(
  'C-08B2-R4 authoritative photo_capture close retires exact-owner deletion intent',
  () => {
    it('preserves offline intent through real sign-out and B isolation, then erases it on A authoritative capture close', async () => {
      const command = await pendingUnderCaptureAuthority();
      await prepareLocalDataForSession('owner-a', null);
      assertNoOldRecovery(command);
      await expect(assertPrivateKVReadable()).resolves.toBeUndefined();
      expect(mocks.storage.has(PHOTO_DELETE_CLEANUP_VAULT_KEY)).toBe(true);
      await grant('owner-b', 2);
      mocks.nativeReads = [];
      expect(await runCurrentHealthDataOperation(readPhotoDeleteRemoteObligations)).toEqual([]);
      await retryPhotoDeletes('owner-b');
      expect(mocks.outgoing).toEqual([]);
      expect(mocks.nativeReads).not.toContain(PHOTO_DELETE_CLEANUP_VAULT_KEY);
      await clearAccountIsolatedState();
      await grant('owner-a', 3);
      expect(await getPhotoDeleteStatus()).toMatchObject({ remotePending: 1 });
      mocks.remoteState = 'withdrawn';
      mocks.consentGeneration += 1;
      await expect(hasPhotoCaptureConsent()).resolves.toBe(false);
      assertVaultAbsent();
      expect(mocks.withdrawals).toEqual([]); // Remote withdrawal already owns cleanup; do not create another request.
      await assertFreshCaptureCannotReplay(command);
    });

    it('includes exact vault erasure in the actual explicit dependent-withdrawal local cleanup before terminal publication', async () => {
      const command = await pendingUnderCaptureAuthority();
      await withdrawHealthDependentConsent({ type: 'photo_capture', deleteLocal: clearPhotos });
      assertVaultAbsent();
      assertNoOldRecovery(command);
      expect(mocks.withdrawals).toHaveLength(1);
      expect(mocks.withdrawals[0]).toMatchObject({
        type: 'photo_capture',
        expectedUserId: 'owner-a',
        expectedProcessingEpoch: 1,
      });
      expect(
        await readDependentConsentWithdrawalTombstone('owner-a', 'photo_capture'),
      ).toMatchObject({ state: 'withdrawn' });
      expect(mocks.outgoing).toEqual([]);
      await assertFreshCaptureCannotReplay(command);
    });

    it.each(['withdrawing', 'withdrawn', 'unconsented'] as const)(
      'cross-device authoritative %s status uses the same exact-owner cleanup path',
      async (state) => {
        const command = await pendingUnderCaptureAuthority();
        mocks.remoteState = state;
        mocks.consentGeneration = state === 'unconsented' ? 0 : mocks.consentGeneration + 1;
        await expect(hasPhotoCaptureConsent()).resolves.toBe(false);
        assertVaultAbsent();
        assertNoOldRecovery(command);
        await expect(
          runHealthDependentConsentOperation('photo_capture', async () => undefined),
        ).rejects.toThrow();
        expect(mocks.withdrawals).toEqual([]);
        expect(mocks.outgoing).toEqual([]);
        if (state === 'withdrawing') {
          mocks.remoteState = 'withdrawn';
          await expect(hasPhotoCaptureConsent()).resolves.toBe(false);
        }
        await assertFreshCaptureCannotReplay(command);
      },
    );

    it('does not erase accepted intent on a non-authoritative status outage', async () => {
      await pendingUnderCaptureAuthority();
      const raw = mocks.storage.get(PHOTO_DELETE_CLEANUP_VAULT_KEY);
      mocks.statusUnavailable = true;
      expect(await hasPhotoCaptureConsent()).toBe(false);
      expect(mocks.storage.get(PHOTO_DELETE_CLEANUP_VAULT_KEY)).toBe(raw);
      mocks.statusUnavailable = false;
      mocks.offline = false;
      expect(await hasPhotoCaptureConsent()).toBe(true);
      await retryPhotoDeletes('owner-a');
      expect(mocks.outgoing).toHaveLength(1);
      assertVaultAbsent();
    });

    it('vault erase failure keeps explicit local cleanup pending; retry uses the same purpose withdrawal capability', async () => {
      const command = await pendingUnderCaptureAuthority();
      mocks.failVaultErase = true;
      await expect(
        withdrawHealthDependentConsent({ type: 'photo_capture', deleteLocal: clearPhotos }),
      ).rejects.toThrow('HEALTH_DEPENDENT_CONSENT_LOCAL_CLEANUP_FAILED');
      assertNoOldRecovery(command);
      expect(mocks.storage.has(PHOTO_DELETE_CLEANUP_VAULT_KEY)).toBe(true);
      const pending = await readDependentConsentWithdrawalTombstone('owner-a', 'photo_capture');
      expect(pending).toMatchObject({ state: 'pending', authority: 'remote_required' });
      await expect(grantPhotoCaptureConsent()).rejects.toThrow(
        'HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_PENDING',
      );
      mocks.failVaultErase = false;
      await withdrawHealthDependentConsent({ type: 'photo_capture', deleteLocal: clearPhotos });
      expect(mocks.withdrawals).toHaveLength(2);
      expect(mocks.withdrawals[1]).toEqual(mocks.withdrawals[0]);
      assertVaultAbsent();
      await assertFreshCaptureCannotReplay(command);
    });

    it('cross-device close erase failure is visible/retryable rather than a successful closed check', async () => {
      const command = await pendingUnderCaptureAuthority();
      mocks.remoteState = 'withdrawn';
      mocks.consentGeneration += 1;
      mocks.failVaultErase = true;
      await expect(hasPhotoCaptureConsent()).rejects.toThrow(
        'HEALTH_DEPENDENT_CONSENT_LOCAL_CLEANUP_FAILED',
      );
      expect(mocks.storage.has(PHOTO_DELETE_CLEANUP_VAULT_KEY)).toBe(true);
      expect(mocks.withdrawals).toEqual([]);
      mocks.failVaultErase = false;
      await expect(hasPhotoCaptureConsent()).resolves.toBe(false);
      assertVaultAbsent();
      await assertFreshCaptureCannotReplay(command);
    });

    it('photo-purpose erasure never needs the missing independent content key', async () => {
      await pendingUnderCaptureAuthority();
      mocks.secure.delete(PHOTO_DELETE_CLEANUP_VAULT_KEY);
      mocks.remoteState = 'withdrawn';
      mocks.consentGeneration += 1;
      await expect(hasPhotoCaptureConsent()).resolves.toBe(false);
      assertVaultAbsent();
      expect(mocks.outgoing).toEqual([]);
    });

    it('A capture withdrawal never reads, removes, or executes a preserved B namespace', async () => {
      await prepareLocalDataForSession('owner-a', null);
      await grant('owner-b', 2);
      const operationB = {
        operationId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        photoId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        needsAttention: false,
      };
      await runCurrentHealthDataOperation((lease) =>
        reservePhotoDeleteRemoteObligation(operationB, lease, true),
      );
      const keyB = PHOTO_DELETE_CLEANUP_VAULT_KEY_PREFIX + (await localDataOwnerBinding('owner-b'));
      const rawB = mocks.storage.get(keyB);
      const secretB = mocks.secure.get(keyB);
      await prepareLocalDataForSession('owner-b', null);
      await grant('owner-a', 1);
      await pendingUnderCaptureAuthority();
      mocks.nativeReads = [];
      mocks.remoteState = 'withdrawn';
      mocks.consentGeneration += 1;
      await expect(hasPhotoCaptureConsent()).resolves.toBe(false);
      assertVaultAbsent();
      expect(mocks.nativeReads).not.toContain(keyB);
      expect(mocks.storage.get(keyB)).toBe(rawB);
      expect(mocks.secure.get(keyB)).toBe(secretB);
      await prepareLocalDataForSession('owner-a', null);
      await grant('owner-b', 2);
      expect(await runCurrentHealthDataOperation(readPhotoDeleteRemoteObligations)).toEqual([
        { ...operationB, phase: 'committed' },
      ]);
      expect(mocks.outgoing).toEqual([]);
    });

    it('local erasure does not falsely complete the independently pending server withdrawal', async () => {
      await pendingUnderCaptureAuthority();
      mocks.withdrawalPending = true;
      await expect(
        withdrawHealthDependentConsent({ type: 'photo_capture', deleteLocal: clearPhotos }),
      ).rejects.toThrow('HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_PENDING');
      assertVaultAbsent();
      expect(
        await readDependentConsentWithdrawalTombstone('owner-a', 'photo_capture'),
      ).toMatchObject({ state: 'pending' });
      expect(mocks.withdrawals).toHaveLength(1);
      mocks.withdrawalPending = false;
      await withdrawHealthDependentConsent({ type: 'photo_capture', deleteLocal: clearPhotos });
      expect(mocks.withdrawals[1]).toEqual(mocks.withdrawals[0]);
      expect(mocks.outgoing).toEqual([]);
    });

    it('fails closed on unreadable canonical ownership rather than guessing whose vault to erase', async () => {
      await pendingUnderCaptureAuthority();
      mocks.storage.set(LOCAL_DATA_OWNER_HASH_KEY, 'malformed-owner-proof');
      mocks.remoteState = 'withdrawn';
      mocks.consentGeneration += 1;
      await expect(hasPhotoCaptureConsent()).rejects.toThrow(
        'HEALTH_DEPENDENT_CONSENT_LOCAL_CLEANUP_FAILED',
      );
      expect(mocks.storage.has(PHOTO_DELETE_CLEANUP_VAULT_KEY)).toBe(true);
      mocks.storage.set(LOCAL_DATA_OWNER_HASH_KEY, await localDataOwnerBinding('owner-a'));
      await expect(hasPhotoCaptureConsent()).resolves.toBe(false);
      assertVaultAbsent();
    });

    it('waits for an accepted local delete before capture-purpose erasure, so its late journal commit cannot recreate the vault', async () => {
      await grantPhotoCaptureConsent();
      await seedPending('live');
      let release!: () => void;
      let started!: () => void;
      const blocked = new Promise<void>((resolve) => {
        release = resolve;
      });
      const entered = new Promise<void>((resolve) => {
        started = resolve;
      });
      mocks.holdJournalWrite = blocked;
      mocks.journalWriteStarted = started;
      const deleting = removePhoto(PHOTO_A, 'owner-a');
      await entered;
      let closeCompleted = false;
      const closing = withdrawHealthDependentConsent({
        type: 'photo_capture',
        deleteLocal: clearPhotos,
      }).then(() => {
        closeCompleted = true;
      });
      await vi.waitFor(() => expect(mocks.withdrawals).toHaveLength(1));
      expect(closeCompleted).toBe(false);
      mocks.holdJournalWrite = null;
      release();
      await deleting;
      await closing;
      assertVaultAbsent();
      expect(mocks.storage.has(PHOTO_DELETE_JOURNAL_KEY)).toBe(false);
      expect(mocks.files.size).toBe(0);
      mocks.offline = false;
      await retryPhotoDeletes('owner-a');
      expect(mocks.outgoing).toEqual([]);
    });

    it('a replay response already in flight cannot resurrect erased purpose state or replay after re-grant', async () => {
      const command = await pendingUnderCaptureAuthority();
      let release!: () => void;
      let started!: () => void;
      mocks.remoteGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const entered = new Promise<void>((resolve) => {
        started = resolve;
      });
      mocks.remoteStarted = started;
      mocks.offline = false;
      const replaying = retryPhotoDeletes('owner-a');
      await entered;
      expect(mocks.outgoing).toHaveLength(1);
      mocks.remoteState = 'withdrawn';
      mocks.consentGeneration += 1;
      await expect(hasPhotoCaptureConsent()).resolves.toBe(false);
      assertVaultAbsent();
      release();
      await replaying;
      expect(mocks.outgoing).toHaveLength(1);
      mocks.outgoing = [];
      mocks.remoteGate = null;
      await assertFreshCaptureCannotReplay(command);
    });

    it('base health withdrawal still removes the R1 journal and independent vault through its unchanged path', async () => {
      const command = await pendingUnderCaptureAuthority();
      await clearHealthPurposeLocalData('owner-a');
      assertNoOldRecovery(command);
      assertVaultAbsent();
      await verifyFreshGrant();
    });

    it('uninterrupted offline/reconnect replay still uses the same operation payload and retires its key', async () => {
      const command = await pendingUnderCaptureAuthority();
      const raw = await new LargeSecureStore().getItem(PHOTO_DELETE_CLEANUP_VAULT_KEY);
      expect(raw).toContain(command.operationId);
      await expect(retryPhotoDeletes('owner-a')).rejects.toThrow('OFFLINE');
      const first = mocks.outgoing[0];
      mocks.offline = false;
      await retryPhotoDeletes('owner-a');
      expect(mocks.outgoing[1]).toEqual(first);
      assertVaultAbsent();
      await prepareLocalDataForSession('owner-a', null);
      await grant('owner-a', 2);
      mocks.outgoing = [];
      await retryPhotoDeletes('owner-a');
      expect(mocks.outgoing).toEqual([]);
    });
  },
);
