import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isCommerceConsented } from '@/features/commerce/consent';
import { getCommerceConsentLocal } from '@/features/commerce/store';
import { isCommunityConsented } from '@/features/community/consent';
import {
  getAgeConfirmedLocal,
  getCommunityConsentLocal,
  setAgeConfirmedLocal,
  setCommunityConsentLocal,
} from '@/features/community/store';
import { HEALTH_DATA_CONSENT } from '@/features/onboarding/consentCopy';
import {
  hasCurrentHealthDataCollectionConsent,
  setHealthDataCollectionConsentLocal,
} from '@/features/onboarding/healthConsentStore';
import { HEALTH_PURPOSE_PRIVATE_DATA_KEYS } from '@/lib/consent/healthDataWriteAdmission';
import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';

const COMMERCE_KEY = 'layerwell.commerceConsent.v1';
const COMMUNITY_KEY = 'layerwell.communityConsent.v1';
const COMMUNITY_AGE_KEY = 'layerwell.communityAge16.v1';

const mocks = vi.hoisted(() => ({
  getLatestConsents: vi.fn(),
  storage: new Map<string, string>(),
}));

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: vi.fn(async (_algorithm: string, value: string) => `sha256:${value}`),
  randomUUID: vi.fn(() => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
}));

vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));
vi.mock('@/lib/consent/consent', () => ({
  getLatestConsents: mocks.getLatestConsents,
  recordConsent: vi.fn(),
}));
vi.mock('@/lib/consent/withdrawal', () => ({ withdrawConsent: vi.fn() }));
vi.mock('@/lib/consent/dependentConsentRecoveryStore', () => ({
  clearOwnerDependentConsentRecoveryRaw: vi.fn(async () => {}),
  readDependentConsentRecoveryRaw: vi.fn(async () => null),
  removeDependentConsentRecoveryRaw: vi.fn(async () => {}),
  writeDependentConsentRecoveryRaw: vi.fn(async () => {}),
}));
vi.mock('@/lib/supabase/client', () => ({
  getPersistedSupabaseUser: vi.fn(async () => ({ data: { user: null } })),
  supabase: { from: vi.fn() },
}));
vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.storage.delete(key);
  }),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    mocks.storage.set(key, value);
  }),
  updatePrivateItem: vi.fn(
    async (key: string, updater: (current: string | null) => string | null) => {
      const next = updater(mocks.storage.get(key) ?? null);
      if (next === null) mocks.storage.delete(key);
      else mocks.storage.set(key, next);
    },
  ),
}));

describe('dependent consent cleanup on base health withdrawal', () => {
  beforeEach(() => {
    clearActiveHealthProcessingEpoch();
    mocks.storage.clear();
    mocks.getLatestConsents.mockReset();
    mocks.getLatestConsents.mockRejectedValue(new Error('ledger unavailable'));
  });

  afterEach(() => {
    clearActiveHealthProcessingEpoch();
  });

  it('cannot resurrect stale commerce or community grants after fresh base reconsent', async () => {
    await setHealthDataCollectionConsentLocal({
      granted: true,
      version: HEALTH_DATA_CONSENT.version,
      consentText: HEALTH_DATA_CONSENT.fullText,
    });
    // Seed a pre-COM-01A stale receipt directly; the production positive setter is
    // intentionally fail-closed and cannot create this state.
    mocks.storage.set(COMMERCE_KEY, 'v1:1');
    await setCommunityConsentLocal(true);
    await setAgeConfirmedLocal(true);

    // Base withdrawal first records the collection revocation, then selective
    // cleanup directly removes every purpose-classified record.
    await setHealthDataCollectionConsentLocal({
      granted: false,
      version: HEALTH_DATA_CONSENT.version,
      consentText: HEALTH_DATA_CONSENT.fullText,
    });
    for (const key of HEALTH_PURPOSE_PRIVATE_DATA_KEYS) mocks.storage.delete(key);

    expect(mocks.storage.has(COMMERCE_KEY)).toBe(false);
    expect(mocks.storage.has(COMMUNITY_KEY)).toBe(false);
    expect(mocks.storage.get(COMMUNITY_AGE_KEY)).toBe('v1:1');

    // A later base-only reconsent must not imply either separate purpose. If
    // the ledger/network is unavailable, both local fallbacks remain closed.
    await setHealthDataCollectionConsentLocal({
      granted: true,
      version: HEALTH_DATA_CONSENT.version,
      consentText: HEALTH_DATA_CONSENT.fullText,
    });

    await expect(hasCurrentHealthDataCollectionConsent()).resolves.toBe(true);
    await expect(getCommerceConsentLocal()).resolves.toBe(false);
    await expect(getCommunityConsentLocal()).resolves.toBe(false);
    let accountGeneration!: number;
    await runAccountGenerationOperation((lease) => {
      accountGeneration = lease.generation;
    });
    setActiveHealthProcessingEpoch(2, {
      ownerUserId: 'owner-a',
      accountGeneration,
      serverVerifiedAt: null,
    });
    await expect(isCommerceConsented()).resolves.toBe(false);
    await expect(isCommunityConsented()).resolves.toBe(false);
    await expect(getAgeConfirmedLocal()).resolves.toBe(true);
  });
});
