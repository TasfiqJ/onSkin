import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prepareLocalDataForSession } from '@/lib/auth/localAccountIsolation';
import {
  claimLocalDataOwnership,
  clearLocalDataCleanupRequired,
  LOCAL_DATA_OWNER_HASH_KEY,
  LOCAL_DATA_RETAINED_OWNER_HASH_KEY,
  LOCAL_DATA_UNCLAIMED_QUARANTINE_KEY,
  markLocalDataCleanupRequired,
  quarantineUnclaimedLocalDataForSignedOutRestore,
  readLocalDataOwnership,
  retainLocalDataOwnerForSignedOutRestore,
} from '@/lib/auth/sessionOwner';

import { finalizeCompletedAccountDeletion } from './accountDeletionRecovery';

const OWNER_B = 'b2'.repeat(32);
const storage = new Map<string, string>();

const peripheral = vi.hoisted(() => ({
  clearDependentRecovery: vi.fn(async (_ownerBinding: string) => {}),
  clearPersistedPrivateData: vi.fn(async () => {
    storage.delete('layerwell.localDataOwnerHash.v1');
    storage.delete('layerwell.localDataRetainedOwnerHash.v1');
    storage.delete('layerwell.localDataUnclaimedQuarantine.v1');
  }),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    multiGet: vi.fn(async (keys: readonly string[]) =>
      keys.map((key) => [key, storage.get(key) ?? null] as [string, string | null]),
    ),
    multiRemove: vi.fn(async (keys: readonly string[]) => {
      for (const key of keys) storage.delete(key);
    }),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
  },
}));

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: vi.fn(async (_algorithm: string, value: string) =>
    (value.endsWith('user-b') ? 'b2' : 'c3').repeat(32),
  ),
}));

vi.mock('expo-notifications', () => ({
  cancelAllScheduledNotificationsAsync: vi.fn(async () => {}),
}));

vi.mock('@/features/photos/encryptedStorage', () => ({
  beginEncryptedPhotoAccountBoundary: vi.fn(),
  endEncryptedPhotoAccountBoundary: vi.fn(),
  waitForEncryptedPhotoWritesToSettle: vi.fn(async () => {}),
}));

vi.mock('@/features/photos/sensitiveImageMemory', () => ({
  purgeSensitiveImageMemory: vi.fn(async () => {}),
}));

vi.mock('@/features/healthConsent/pendingIntent', () => ({
  clearPendingHealthWithdrawalIntentByOwnerBinding: vi.fn(async () => {}),
}));

vi.mock('@/lib/consent/dependentConsentLocal', () => ({
  clearAllDependentConsentWithdrawalTombstonesByOwnerBinding: peripheral.clearDependentRecovery,
}));

vi.mock('@/features/settings/localPrivateData', () => ({
  clearLocalPrivateData: peripheral.clearPersistedPrivateData,
}));

vi.mock('@/lib/analytics/track', () => ({ resetAnalyticsIdentity: vi.fn(async () => {}) }));
vi.mock('@/lib/auth/accountGeneration', () => ({
  beginAccountGenerationBoundary: vi.fn(),
  endAccountGenerationBoundary: vi.fn(),
  waitForAccountGenerationOperationsToSettle: vi.fn(async () => {}),
}));
vi.mock('@/lib/auth/revokedCredentialActivity', () => ({
  clearAuthDerivedLocalActivity: vi.fn(async () => {}),
}));
vi.mock('@/lib/env', () => ({
  env: { supabasePublishableKey: 'unused', supabaseUrl: 'https://unused.supabase.co' },
  isSupabaseConfigured: false,
}));
vi.mock('@/lib/iap/revenuecat', () => ({ resetRevenueCatIdentity: vi.fn(async () => {}) }));
vi.mock('@/lib/iap/storeTransactionNotice', () => ({
  convertStoreTransactionNoticeForTerminalDeletion: vi.fn(async () => {}),
}));
vi.mock('@/lib/query/queryClient', () => ({
  queryClient: { cancelQueries: vi.fn(async () => {}), clear: vi.fn() },
}));
vi.mock('@/lib/storage/privateKV', () => ({
  beginPrivateKVAccountBoundary: vi.fn(),
  endPrivateKVAccountBoundary: vi.fn(),
  waitForPrivateKVWritesToSettle: vi.fn(async () => {}),
}));
vi.mock('@/lib/supabase/client', () => ({
  clearPersistedSupabaseSession: vi.fn(async () => {}),
  readPersistedSupabaseSessionCandidate: vi.fn(async () => null),
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      getUser: vi.fn(),
      signOut: vi.fn(async () => ({ error: null })),
    },
  },
}));

vi.mock('./accountDeletionClientState', () => ({
  accountDeletionRecordMatchesOwner: vi.fn(() => false),
  clearCompletedAccountDeletionState: vi.fn(async () => {}),
  markAccountDeletionIntakeState: vi.fn(),
}));
vi.mock('./accountDeletionNotice', () => ({
  queueAppleManualRevocationNotice: vi.fn(),
}));

function isolationDependencies() {
  return {
    claimOwnership: claimLocalDataOwnership,
    clearCleanupRequired: clearLocalDataCleanupRequired,
    clearPersistedPrivateData: peripheral.clearPersistedPrivateData,
    clearPlaintextStaging: vi.fn(async () => {}),
    clearSensitiveImageMemory: vi.fn(async () => {}),
    markCleanupRequired: markLocalDataCleanupRequired,
    queryCache: {
      cancelQueries: vi.fn(async () => {}),
      clear: vi.fn(),
    },
    readOwnership: readLocalDataOwnership,
  };
}

describe('account-deletion foreign-owner preservation lifecycle', () => {
  beforeEach(() => {
    storage.clear();
    peripheral.clearDependentRecovery.mockClear();
    peripheral.clearPersistedPrivateData.mockClear();
  });

  it('survives completion, forced sign-out, cold null restore, and exact-owner reauth', async () => {
    const order: string[] = [];
    await claimLocalDataOwnership('user-b');

    await expect(
      finalizeCompletedAccountDeletion(
        {
          version: 2,
          ownerBinding: 'a1'.repeat(32),
          state: 'completed',
          createdAt: '2026-07-14T12:00:00.000Z',
          idempotencyKey: '01'.repeat(32),
          statusCapability: '02'.repeat(32),
          notice: null,
        },
        {
          retainLocalDataOwner: async () => {
            await retainLocalDataOwnerForSignedOutRestore();
            order.push('retained-owner');
          },
          clearSession: vi.fn(async () => {
            order.push('session');
          }),
          clearIsolatedState: vi.fn(async () => {
            order.push('private-data');
          }),
          clearAuthDerivedActivity: vi.fn(async () => {
            order.push('derived');
          }),
          quarantineUnclaimedLocalData: vi.fn(async () => {}),
          convertStoreSafetyNotice: vi.fn(async () => {
            order.push('store-safety');
          }),
          clearDependentWithdrawalRecovery: vi.fn(async (ownerBinding: string) => {
            await peripheral.clearDependentRecovery(ownerBinding);
            order.push('dependent-recovery');
          }),
          queueAppleNotice: vi.fn(),
          clearCompletedState: vi.fn(async () => {
            order.push('recovery-proof');
          }),
        },
        {
          clearSession: true,
          clearIsolatedState: false,
          quarantineUnclaimedLocalData: false,
          retainLocalDataOwner: true,
        },
      ),
    ).resolves.toBe('cleared');

    expect(order).toEqual([
      'derived',
      'store-safety',
      'dependent-recovery',
      'retained-owner',
      'session',
      'recovery-proof',
    ]);
    expect(storage.get(LOCAL_DATA_OWNER_HASH_KEY)).toBe(OWNER_B);
    expect(storage.get(LOCAL_DATA_RETAINED_OWNER_HASH_KEY)).toBe(OWNER_B);
    expect(peripheral.clearDependentRecovery).toHaveBeenCalledExactlyOnceWith('a1'.repeat(32));

    const dependencies = isolationDependencies();
    await expect(prepareLocalDataForSession('user-b', null, dependencies)).resolves.toEqual({
      cleared: false,
      resetRoute: false,
    });
    await expect(prepareLocalDataForSession(null, null, dependencies)).resolves.toEqual({
      cleared: false,
      resetRoute: false,
    });
    expect(peripheral.clearPersistedPrivateData).not.toHaveBeenCalled();

    await expect(prepareLocalDataForSession(null, 'user-b', dependencies)).resolves.toEqual({
      cleared: false,
      resetRoute: false,
    });
    expect(storage.get(LOCAL_DATA_OWNER_HASH_KEY)).toBe(OWNER_B);
    expect(storage.has(LOCAL_DATA_RETAINED_OWNER_HASH_KEY)).toBe(false);
  });

  it('uses the normal destructive boundary when a foreign owner logs in', async () => {
    await claimLocalDataOwnership('user-b');
    await retainLocalDataOwnerForSignedOutRestore();
    const dependencies = isolationDependencies();

    await expect(prepareLocalDataForSession(null, 'user-c', dependencies)).resolves.toEqual({
      cleared: true,
      resetRoute: true,
    });

    expect(peripheral.clearPersistedPrivateData).toHaveBeenCalledOnce();
    expect(storage.has(LOCAL_DATA_RETAINED_OWNER_HASH_KEY)).toBe(false);
    expect(storage.get(LOCAL_DATA_OWNER_HASH_KEY)).toBe('c3'.repeat(32));
  });

  it('quarantines unclaimed recovery data until even the same cached subject wipes it', async () => {
    const order: string[] = [];

    await expect(
      finalizeCompletedAccountDeletion(
        {
          version: 2,
          ownerBinding: 'a1'.repeat(32),
          state: 'completed',
          createdAt: '2026-07-14T12:00:00.000Z',
          idempotencyKey: '01'.repeat(32),
          statusCapability: '02'.repeat(32),
          notice: null,
        },
        {
          quarantineUnclaimedLocalData: async () => {
            await quarantineUnclaimedLocalDataForSignedOutRestore();
            order.push('unclaimed-quarantine');
          },
          retainLocalDataOwner: vi.fn(async () => {}),
          clearSession: vi.fn(async () => {
            order.push('session');
          }),
          clearIsolatedState: vi.fn(async () => {
            order.push('private-data');
          }),
          clearAuthDerivedActivity: vi.fn(async () => {
            order.push('derived');
          }),
          convertStoreSafetyNotice: vi.fn(async () => {
            order.push('store-safety');
          }),
          queueAppleNotice: vi.fn(),
          clearCompletedState: vi.fn(async () => {
            order.push('recovery-proof');
          }),
        },
        {
          clearSession: true,
          clearIsolatedState: false,
          quarantineUnclaimedLocalData: true,
          retainLocalDataOwner: false,
        },
      ),
    ).resolves.toBe('cleared');

    expect(order).toEqual([
      'derived',
      'store-safety',
      'unclaimed-quarantine',
      'session',
      'recovery-proof',
    ]);
    expect(storage.get(LOCAL_DATA_UNCLAIMED_QUARANTINE_KEY)).toBe('1');
    expect(storage.has(LOCAL_DATA_OWNER_HASH_KEY)).toBe(false);

    const dependencies = isolationDependencies();
    await expect(prepareLocalDataForSession(null, null, dependencies)).resolves.toEqual({
      cleared: false,
      resetRoute: false,
    });
    expect(storage.get(LOCAL_DATA_UNCLAIMED_QUARANTINE_KEY)).toBe('1');
    await expect(claimLocalDataOwnership('user-b')).rejects.toThrow(
      'LOCAL_DATA_UNCLAIMED_QUARANTINED',
    );

    await expect(prepareLocalDataForSession(null, 'user-b', dependencies)).resolves.toEqual({
      cleared: true,
      resetRoute: true,
    });

    expect(peripheral.clearPersistedPrivateData).toHaveBeenCalledOnce();
    expect(storage.has(LOCAL_DATA_UNCLAIMED_QUARANTINE_KEY)).toBe(false);
    expect(storage.get(LOCAL_DATA_OWNER_HASH_KEY)).toBe(OWNER_B);
  });

  it('withholds ownership when quarantine cleanup cannot be committed', async () => {
    await quarantineUnclaimedLocalDataForSignedOutRestore();
    peripheral.clearPersistedPrivateData.mockRejectedValueOnce(new Error('wipe unavailable'));
    const claimOwnership = vi.fn(claimLocalDataOwnership);
    const dependencies = { ...isolationDependencies(), claimOwnership };

    try {
      await expect(prepareLocalDataForSession(null, 'user-b', dependencies)).rejects.toThrow(
        'wipe unavailable',
      );

      expect(claimOwnership).not.toHaveBeenCalled();
      expect(storage.get(LOCAL_DATA_UNCLAIMED_QUARANTINE_KEY)).toBe('1');
      expect(storage.has(LOCAL_DATA_OWNER_HASH_KEY)).toBe(false);
    } finally {
      await clearLocalDataCleanupRequired();
    }
  });
});
