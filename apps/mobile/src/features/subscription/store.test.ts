import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deriveState, type StoredEntitlement } from './entitlement';
import {
  clearEntitlement,
  clearStoreEntitlementIfRevenueCatVerifiedEmpty,
  loadEntitlement,
  saveVerifiedEntitlement,
  startReverseTrialOnServer,
} from './store';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  env: {
    appEnvironment: 'development' as 'development' | 'staging' | 'production',
    revenueCatReverseTrialProductId: 'routinekind_pro_reverse_trial_local',
  },
  isSupabaseConfigured: false,
  invoke: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  env: mocks.env,
  get isSupabaseConfigured() {
    return mocks.isSupabaseConfigured;
  },
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    mocks.storage.set(key, value);
  }),
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.storage.delete(key);
  }),
  multiRemovePrivateItems: vi.fn(async (keys: readonly string[]) => {
    keys.forEach((key) => mocks.storage.delete(key));
  }),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mocks.invoke,
    },
    from: vi.fn(),
  },
}));

const NOW = new Date('2026-07-05T12:00:00.000Z');
const KEY = 'onskin.entitlement.v2';
const LEGACY_KEY = 'onskin.entitlement.v1';

function cachedEntitlement(overrides: Record<string, unknown> = {}) {
  return {
    tier: 'pro',
    isActive: true,
    periodType: 'reverse_trial',
    store: 'app_granted',
    productId: 'routinekind_pro_reverse_trial_local',
    expiresAt: '2026-07-12T12:00:00.000Z',
    willRenew: false,
    grantedAt: '2026-07-05T12:00:00.000Z',
    source: 'app_granted',
    environment: 'development',
    managementUrl: null,
    verifiedAt: '2026-07-05T12:00:00.000Z',
    offeringId: 'local_reverse_trial',
    packageId: 'reverse_trial_7d',
    storeUserId: null,
    priceLabel: null,
    ...overrides,
  };
}

describe('subscription store reverse trial', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mocks.storage.clear();
    mocks.invoke.mockReset();
    mocks.env.appEnvironment = 'development';
    mocks.isSupabaseConfigured = false;
  });

  it('grants and persists a development reverse trial when Supabase is not configured', async () => {
    const entitlement = await startReverseTrialOnServer();

    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(entitlement).toMatchObject({
      tier: 'pro',
      isActive: true,
      periodType: 'reverse_trial',
      store: 'app_granted',
      source: 'app_granted',
      environment: 'development',
      willRenew: false,
      productId: 'routinekind_pro_reverse_trial_local',
    });
    expect(entitlement.expiresAt).toBe('2026-07-12T12:00:00.000Z');
    await expect(loadEntitlement()).resolves.toMatchObject(entitlement);

    const state = deriveState(entitlement, NOW.toISOString());
    expect(state).toMatchObject({ isPro: true, inReverseTrial: true, daysLeft: 7 });
  });

  it('still fails closed outside development when Supabase is not configured', async () => {
    mocks.env.appEnvironment = 'production';

    await expect(startReverseTrialOnServer()).rejects.toThrow(
      'Reverse trial is unavailable until Supabase is configured.',
    );
    await expect(loadEntitlement()).resolves.toBeNull();
  });

  it('clears persisted entitlement records', async () => {
    await startReverseTrialOnServer();

    await clearEntitlement();

    await expect(loadEntitlement()).resolves.toBeNull();
  });

  it('clears store-backed access when RevenueCat verifies no entitlement', async () => {
    await saveVerifiedEntitlement(
      cachedEntitlement({
        periodType: 'normal',
        store: 'app_store',
        productId: 'routinekind_pro_annual',
        expiresAt: null,
        willRenew: true,
        source: 'revenuecat',
        environment: 'sandbox',
      }) as StoredEntitlement,
    );

    await clearStoreEntitlementIfRevenueCatVerifiedEmpty();

    await expect(loadEntitlement()).resolves.toBeNull();
  });

  it('preserves app-granted reverse trials when RevenueCat restore finds no store purchase', async () => {
    const entitlement = await startReverseTrialOnServer();

    await clearStoreEntitlementIfRevenueCatVerifiedEmpty();

    await expect(loadEntitlement()).resolves.toMatchObject(entitlement);
  });

  it('removes malformed primary cache and migrates a valid legacy cache', async () => {
    mocks.storage.set(KEY, '{not-json');
    mocks.storage.set(
      LEGACY_KEY,
      JSON.stringify(
        cachedEntitlement({
          productId: 'legacy-product',
          source: 'revenuecat',
          store: 'app_store',
          environment: 'sandbox',
          periodType: 'trial',
        }),
      ),
    );

    await expect(loadEntitlement()).resolves.toMatchObject({
      productId: 'legacy-product',
      source: 'revenuecat',
      store: 'app_store',
      environment: 'sandbox',
      isActive: true,
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
      productId: 'legacy-product',
      source: 'revenuecat',
    });
  });

  it('normalizes an active cache without verification to inactive', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify(cachedEntitlement({ source: 'revenuecat', verifiedAt: null })),
    );

    await expect(loadEntitlement()).resolves.toMatchObject({
      source: 'revenuecat',
      verifiedAt: null,
      isActive: false,
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({ isActive: false });
  });

  it('does not honor a time-boxed entitlement cache without a valid expiry', async () => {
    mocks.storage.set(KEY, JSON.stringify(cachedEntitlement({ expiresAt: 'not-a-date' })));

    await expect(loadEntitlement()).resolves.toMatchObject({
      periodType: 'reverse_trial',
      expiresAt: null,
      isActive: false,
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
      expiresAt: null,
      isActive: false,
    });
  });

  it('trims cache string fields before validation and persistence', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify(
        cachedEntitlement({
          tier: ' pro ',
          periodType: ' trial ',
          store: ' app_store ',
          productId: ' routinekind_pro_annual ',
          source: ' revenuecat ',
          environment: ' sandbox ',
          verifiedAt: ' 2026-07-05T12:00:00.000Z ',
        }),
      ),
    );

    await expect(loadEntitlement()).resolves.toMatchObject({
      tier: 'pro',
      periodType: 'trial',
      store: 'app_store',
      productId: 'routinekind_pro_annual',
      source: 'revenuecat',
      environment: 'sandbox',
      verifiedAt: '2026-07-05T12:00:00.000Z',
      isActive: true,
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
      productId: 'routinekind_pro_annual',
      source: 'revenuecat',
    });
  });

  it('does not honor a development app-granted cache outside development', async () => {
    mocks.env.appEnvironment = 'production';
    mocks.storage.set(KEY, JSON.stringify(cachedEntitlement()));

    await expect(loadEntitlement()).resolves.toMatchObject({
      source: 'app_granted',
      environment: 'development',
      isActive: false,
    });
  });

  it('does not honor a Test Store entitlement cache in production', async () => {
    mocks.env.appEnvironment = 'production';
    mocks.storage.set(
      KEY,
      JSON.stringify(
        cachedEntitlement({
          periodType: 'normal',
          store: 'test_store',
          productId: 'routinekind_pro_annual',
          expiresAt: '2026-08-05T12:00:00.000Z',
          willRenew: true,
          source: 'revenuecat',
          environment: 'test_store',
          verifiedAt: '2026-07-05T12:00:00.000Z',
        }),
      ),
    );

    await expect(loadEntitlement()).resolves.toMatchObject({
      source: 'revenuecat',
      store: 'test_store',
      environment: 'test_store',
      isActive: false,
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
      store: 'test_store',
      environment: 'test_store',
      isActive: false,
    });
  });

  it('returns the normalized server grant instead of a raw fail-open entitlement', async () => {
    mocks.isSupabaseConfigured = true;
    mocks.env.appEnvironment = 'production';
    mocks.invoke.mockResolvedValue({
      data: {
        entitlement: {
          entitlement: 'pro',
          is_active: true,
          period_type: 'reverse_trial',
          store: 'app_granted',
          product_id: 'routinekind_pro_reverse_trial_server',
          expires_at: null,
          will_renew: false,
          original_purchase_at: '2026-07-05T12:00:00.000Z',
          source: 'server',
          environment: 'production',
          verified_at: '2026-07-05T12:00:00.000Z',
        },
      },
      error: null,
    });

    await expect(startReverseTrialOnServer()).resolves.toMatchObject({
      source: 'server',
      environment: 'production',
      periodType: 'reverse_trial',
      expiresAt: null,
      isActive: false,
    });
    await expect(loadEntitlement()).resolves.toMatchObject({ isActive: false });
  });
});
