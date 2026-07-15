import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import {
  LOCAL_PRIVATE_DATA_KEYS,
  LOCAL_PRIVATE_SECURE_CONTROL_KEYS,
  LOCAL_PRIVATE_SECURE_CONTROL_KEY_PREFIXES,
} from '@/features/settings/localPrivateDataKeys';

import { beginHealthDependentConsentGrant, resetHealthDependentConsentLeasesForTests } from './dependentConsentLease';
import {
  HEALTH_DEPENDENT_CONSENT_TOMBSTONE_TYPES,
  readDependentConsentWithdrawalTombstone,
  readLocalDependentConsentReceipt,
  writeDependentConsentWithdrawalTombstone,
  writeLocalDependentConsentReceipt,
} from './dependentConsentLocal';
import { HEALTH_PURPOSE_PRIVATE_DATA_KEYS } from './healthDataWriteAdmission';
import { clearActiveHealthProcessingEpoch, setActiveHealthProcessingEpoch } from './healthProcessingEpoch';

const mocks = vi.hoisted(() => ({
  privateStorage: new Map<string, string>(),
  recoveryStorage: new Map<string, string>(),
}));
vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: vi.fn(),
  getRandomBytesAsync: vi.fn(),
}));
vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.privateStorage.get(key) ?? null),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    mocks.privateStorage.set(key, value);
  }),
  removePrivateItem: vi.fn(async (key: string) => { mocks.privateStorage.delete(key); }),
}));
vi.mock('./dependentConsentRecoveryStore', () => ({
  HEALTH_DEPENDENT_CONSENT_RECOVERY_KEY_PREFIX:
    'routinekind.health_dependent_withdrawal.owner.',
  readDependentConsentRecoveryRaw: vi.fn(
    async (owner: string, type: string) =>
      mocks.recoveryStorage.get(`${owner}:${type}`) ?? null,
  ),
  writeDependentConsentRecoveryRaw: vi.fn(async (owner: string, type: string, value: string) => {
    mocks.recoveryStorage.set(`${owner}:${type}`, value);
  }),
  removeDependentConsentRecoveryRaw: vi.fn(async (owner: string, type: string) => {
    mocks.recoveryStorage.delete(`${owner}:${type}`);
  }),
  clearOwnerDependentConsentRecoveryRaw: vi.fn(async (owner: string) => {
    for (const key of [...mocks.recoveryStorage.keys()]) {
      if (key.startsWith(`${owner}:`)) mocks.recoveryStorage.delete(key);
    }
  }),
}));

describe('dependent consent local receipts and control tombstones', () => {
  let accountGeneration = 0;
  beforeEach(async () => {
    mocks.privateStorage.clear();
    mocks.recoveryStorage.clear();
    resetHealthDependentConsentLeasesForTests();
    clearActiveHealthProcessingEpoch();
    await runAccountGenerationOperation((lease) => { accountGeneration = lease.generation; });
    setActiveHealthProcessingEpoch(7, { ownerUserId: 'user-a', accountGeneration });
  });
  afterEach(() => {
    clearActiveHealthProcessingEpoch();
    resetHealthDependentConsentLeasesForTests();
  });

  it('round-trips only an exact owner/type/epoch/version/hash receipt', async () => {
    const lease = beginHealthDependentConsentGrant('photo_capture');
    await writeLocalDependentConsentReceipt({ lease, serverGeneration: null });
    await expect(readLocalDependentConsentReceipt(lease)).resolves.toMatchObject({
      ownerUserId: 'user-a', type: 'photo_capture', healthEpoch: 7, granted: true,
    });

    const key = 'onskin.photos.captureConsent.v1';
    const corrupt = JSON.parse(mocks.privateStorage.get(key)!) as Record<string, unknown>;
    corrupt.consentTextHash = '0'.repeat(64);
    mocks.privateStorage.set(key, JSON.stringify(corrupt));
    await expect(readLocalDependentConsentReceipt(lease)).rejects.toThrow(
      'HEALTH_DEPENDENT_CONSENT_LOCAL_INVALID',
    );
  });

  it('keeps A recovery isolated while B remains independently usable', async () => {
    await writeDependentConsentWithdrawalTombstone({
      ownerUserId: 'user-a',
      type: 'data_sharing',
      state: 'pending',
      authority: 'remote_required',
      resumeMode: 'local_intent',
      healthEpoch: 7,
      expectedConsentGeneration: 4,
      observedConsentGeneration: 4,
      idempotencyKey: 'ab'.repeat(32),
      requestedAt: '2026-07-15T00:00:00.000Z',
    });
    await expect(
      readDependentConsentWithdrawalTombstone('user-b', 'data_sharing'),
    ).resolves.toBeNull();
    await expect(
      readDependentConsentWithdrawalTombstone('user-a', 'data_sharing'),
    ).resolves.toMatchObject({ ownerUserId: 'user-a', state: 'pending' });
  });

  it('keeps recovery capabilities non-exported and outside ordinary account cleanup', () => {
    expect(HEALTH_DEPENDENT_CONSENT_TOMBSTONE_TYPES).toHaveLength(6);
    expect(LOCAL_PRIVATE_SECURE_CONTROL_KEY_PREFIXES).toContain(
      'routinekind.health_dependent_withdrawal.owner.',
    );
    expect(LOCAL_PRIVATE_SECURE_CONTROL_KEYS).not.toContain(
      'routinekind.health_dependent_withdrawal.owner.' as never,
    );
    expect(LOCAL_PRIVATE_DATA_KEYS.some((key) =>
      key.startsWith('routinekind.health_dependent_withdrawal.owner.'),
    )).toBe(false);
    expect(HEALTH_PURPOSE_PRIVATE_DATA_KEYS.some((key) =>
      key.startsWith('routinekind.health_dependent_withdrawal.owner.'),
    )).toBe(false);
  });

  it('preserves an owner-bound pending retry across private-data cleanup and relaunch', async () => {
    await writeDependentConsentWithdrawalTombstone({
      ownerUserId: 'user-a',
      type: 'data_sharing',
      state: 'pending',
      authority: 'remote_required',
      resumeMode: 'local_intent',
      healthEpoch: 7,
      expectedConsentGeneration: 4,
      observedConsentGeneration: 4,
      idempotencyKey: 'cd'.repeat(32),
      requestedAt: '2026-07-15T00:00:00.000Z',
    });

    // Ordinary sign-out clears encrypted privateKV and its content key, but
    // the SecureStore recovery capability remains owner-bound for relaunch.
    mocks.privateStorage.clear();
    await expect(
      readDependentConsentWithdrawalTombstone('user-a', 'data_sharing'),
    ).resolves.toMatchObject({
      state: 'pending',
      idempotencyKey: 'cd'.repeat(32),
    });
    await expect(
      readDependentConsentWithdrawalTombstone('user-b', 'data_sharing'),
    ).resolves.toBeNull();
  });
});
