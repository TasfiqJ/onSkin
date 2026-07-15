import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearPendingHealthWithdrawalIntentByOwnerBinding,
  preparePendingHealthWithdrawalIntent,
  readPendingHealthWithdrawalIntent,
} from '@/features/healthConsent/pendingIntent';
import { localDataOwnerBinding } from '@/lib/auth/sessionOwner';
import {
  clearAllDependentConsentWithdrawalTombstonesByOwnerBinding,
  readDependentConsentWithdrawalTombstone,
  writeDependentConsentWithdrawalTombstone,
} from '@/lib/consent/dependentConsentLocal';

import { finalizeCompletedAccountDeletion } from './accountDeletionRecovery';

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BINDING_A = 'a1'.repeat(32);
const BINDING_B = 'b2'.repeat(32);
const KEY_A = '01'.repeat(32);
const KEY_B = '02'.repeat(32);
const CAPABILITY = '03'.repeat(32);
const NOW = '2026-07-15T12:00:00.000Z';

const state = vi.hoisted(() => ({ storage: new Map<string, string>() }));

vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => state.storage.get(key) ?? null),
    multiGet: vi.fn(async (keys: readonly string[]) =>
      keys.map((key) => [key, state.storage.get(key) ?? null] as [string, string | null]),
    ),
    removeItem: vi.fn(async (key: string) => {
      state.storage.delete(key);
    }),
    setItem: vi.fn(async (key: string, value: string) => {
      state.storage.set(key, value);
    }),
  },
}));
vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'when-unlocked',
  isAvailableAsync: vi.fn(async () => true),
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));
vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: vi.fn(async (_algorithm: string, value: string) => {
    if (value.endsWith(USER_A)) return BINDING_A;
    if (value.endsWith(USER_B)) return BINDING_B;
    throw new Error('unexpected owner');
  }),
}));
vi.mock('expo-notifications', () => ({
  cancelAllScheduledNotificationsAsync: vi.fn(async () => {}),
}));
vi.mock('@/features/photos/sensitiveImageMemory', () => ({
  purgeSensitiveImageMemory: vi.fn(async () => {}),
}));
vi.mock('@/lib/analytics/track', () => ({ resetAnalyticsIdentity: vi.fn(async () => {}) }));
vi.mock('@/lib/auth/localAccountIsolation', () => ({
  clearAccountIsolatedState: vi.fn(async () => {}),
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
  getPrivateItem: vi.fn(async () => null),
  removePrivateItem: vi.fn(async () => {}),
  setPrivateItem: vi.fn(async () => {}),
}));
vi.mock('@/lib/supabase/client', () => ({
  clearPersistedSupabaseSession: vi.fn(async () => {}),
  readPersistedSupabaseSessionCandidate: vi.fn(async () => null),
  supabase: { auth: { getUser: vi.fn() } },
}));
vi.mock('@/lib/supabase/remoteRequestGate', () => ({
  closeSupabaseRemoteRequestBoundary: vi.fn(async () => {}),
  isSupabaseRemoteRequestAdmissionError: vi.fn(() => false),
  runWithSupabaseAccountDeletionRequestPermit: vi.fn(),
  runWithSupabaseAuthVerificationPermit: vi.fn(),
  setSupabaseRemoteRequestCandidate: vi.fn(),
  waitForSupabaseRemoteResidualSettlement: vi.fn(async () => {}),
}));
vi.mock('./accountDeletionClientState', () => ({
  accountDeletionRecordMatchesOwner: vi.fn(() => false),
  clearCompletedAccountDeletionState: vi.fn(async () => {}),
  markAccountDeletionIntakeState: vi.fn(),
}));
vi.mock('./accountDeletionNotice', () => ({ queueAppleManualRevocationNotice: vi.fn() }));

describe('terminal account deletion withdrawal-journal isolation', () => {
  beforeEach(() => state.storage.clear());

  it('clears only deleted A while preserving B base and dependent withdrawal recovery', async () => {
    expect(await localDataOwnerBinding(USER_A)).toBe(BINDING_A);
    expect(await localDataOwnerBinding(USER_B)).toBe(BINDING_B);
    await preparePendingHealthWithdrawalIntent({
      ownerUserId: USER_A,
      processingEpoch: 2,
      idempotencyKey: KEY_A,
    });
    await preparePendingHealthWithdrawalIntent({
      ownerUserId: USER_B,
      processingEpoch: 7,
      idempotencyKey: KEY_B,
    });
    await writeDependentConsentWithdrawalTombstone({
      ownerUserId: USER_A,
      type: 'data_sharing',
      state: 'pending',
      authority: 'remote_required',
      resumeMode: 'local_intent',
      healthEpoch: 2,
      expectedConsentGeneration: 4,
      observedConsentGeneration: null,
      idempotencyKey: KEY_A,
      requestedAt: NOW,
    });
    await writeDependentConsentWithdrawalTombstone({
      ownerUserId: USER_B,
      type: 'data_sharing',
      state: 'pending',
      authority: 'remote_required',
      resumeMode: 'local_intent',
      healthEpoch: 7,
      expectedConsentGeneration: 9,
      observedConsentGeneration: null,
      idempotencyKey: KEY_B,
      requestedAt: NOW,
    });

    await expect(
      finalizeCompletedAccountDeletion(
        {
          version: 2,
          ownerBinding: BINDING_A,
          state: 'completed',
          createdAt: NOW,
          idempotencyKey: KEY_A,
          statusCapability: CAPABILITY,
          notice: null,
        },
        {
          convertStoreSafetyNotice: vi.fn(async () => {}),
          clearHealthWithdrawalIntent: clearPendingHealthWithdrawalIntentByOwnerBinding,
          clearDependentWithdrawalRecovery:
            clearAllDependentConsentWithdrawalTombstonesByOwnerBinding,
          clearSession: vi.fn(async () => {}),
          clearIsolatedState: vi.fn(async () => {}),
          clearAuthDerivedActivity: vi.fn(async () => {}),
          quarantineUnclaimedLocalData: vi.fn(async () => {}),
          retainLocalDataOwner: vi.fn(async () => {}),
          queueAppleNotice: vi.fn(),
          clearCompletedState: vi.fn(async () => {}),
        },
      ),
    ).resolves.toBe('cleared');

    await expect(readPendingHealthWithdrawalIntent(USER_A)).resolves.toBeNull();
    await expect(
      readDependentConsentWithdrawalTombstone(USER_A, 'data_sharing'),
    ).resolves.toBeNull();
    await expect(readPendingHealthWithdrawalIntent(USER_B)).resolves.toMatchObject({
      processingEpoch: 7,
      idempotencyKey: KEY_B,
    });
    await expect(
      readDependentConsentWithdrawalTombstone(USER_B, 'data_sharing'),
    ).resolves.toMatchObject({
      ownerUserId: USER_B,
      healthEpoch: 7,
      idempotencyKey: KEY_B,
    });
  });
});
