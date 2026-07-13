import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deriveState, type StoredEntitlement } from './entitlement';
import {
  ENTITLEMENT_CACHE_INVALID,
  ENTITLEMENT_CACHE_UNSUPPORTED_VERSION,
  clearEntitlement,
  clearStoreEntitlementIfRevenueCatVerifiedEmpty,
  downgradeToFree,
  loadEntitlement,
  readEntitlementCache,
  saveVerifiedEntitlement,
  startReverseTrialOnServer,
} from './store';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  readErrors: new Map<string, Error>(),
  mutationTails: new Map<string, Promise<void>>(),
  nextMutationReadError: null as Error | null,
  nextMutationError: null as Error | null,
  writes: 0,
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
  PRIVATE_KV_DECRYPTION_FAILED: 'PRIVATE_KV_DECRYPTION_FAILED',
  PRIVATE_KV_ENVELOPE_INVALID: 'PRIVATE_KV_ENVELOPE_INVALID',
  PRIVATE_KV_ENVELOPE_UNSUPPORTED: 'PRIVATE_KV_ENVELOPE_UNSUPPORTED',
  getPrivateItem: vi.fn(async (key: string) => {
    const failure = mocks.readErrors.get(key);
    if (failure) throw failure;
    return mocks.storage.get(key) ?? null;
  }),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    mocks.storage.set(key, value);
    mocks.writes += 1;
  }),
  removePrivateItem: vi.fn(async (key: string) => {
    if (mocks.storage.delete(key)) mocks.writes += 1;
  }),
  multiRemovePrivateItems: vi.fn(async (keys: readonly string[]) => {
    for (const key of keys) {
      if (mocks.storage.delete(key)) mocks.writes += 1;
    }
  }),
  updatePrivateItem: vi.fn(
    (
      key: string,
      updater: (current: string | null) => string | null,
    ): Promise<void> => {
      const previous = mocks.mutationTails.get(key) ?? Promise.resolve();
      const operation = previous.catch(() => undefined).then(() => {
        const readFailure = mocks.nextMutationReadError;
        if (readFailure) {
          mocks.nextMutationReadError = null;
          throw readFailure;
        }
        const current = mocks.storage.get(key) ?? null;
        const next = updater(current);
        const failure = mocks.nextMutationError;
        if (failure) {
          mocks.nextMutationError = null;
          throw failure;
        }
        if (next === current) return;
        if (next === null) mocks.storage.delete(key);
        else mocks.storage.set(key, next);
        mocks.writes += 1;
      });
      const settled = operation.then(
        () => undefined,
        () => undefined,
      );
      mocks.mutationTails.set(key, settled);
      void settled.finally(() => {
        if (mocks.mutationTails.get(key) === settled) mocks.mutationTails.delete(key);
      });
      return operation;
    },
  ),
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

function cacheEnvelope(entitlement: Record<string, unknown>, version = 1): string {
  return JSON.stringify({ version, entitlement });
}

function withoutKey(
  record: Record<string, unknown>,
  keyToRemove: string,
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== keyToRemove));
}

describe('subscription entitlement cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mocks.storage.clear();
    mocks.readErrors.clear();
    mocks.mutationTails.clear();
    mocks.nextMutationReadError = null;
    mocks.nextMutationError = null;
    mocks.writes = 0;
    mocks.invoke.mockReset();
    mocks.env.appEnvironment = 'development';
    mocks.isSupabaseConfigured = false;
  });

  it('grants and persists a versioned development reverse trial when Supabase is not configured', async () => {
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
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
      version: 1,
      entitlement: { productId: 'routinekind_pro_reverse_trial_local' },
    });
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

  it('clears persisted entitlement records only through the explicit reset path', async () => {
    await startReverseTrialOnServer();
    mocks.storage.set(LEGACY_KEY, JSON.stringify(cachedEntitlement()));

    await clearEntitlement();

    await expect(loadEntitlement()).resolves.toBeNull();
    expect(mocks.storage.has(KEY)).toBe(false);
    expect(mocks.storage.has(LEGACY_KEY)).toBe(false);
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
    const before = mocks.storage.get(KEY);

    await clearStoreEntitlementIfRevenueCatVerifiedEmpty();

    await expect(loadEntitlement()).resolves.toMatchObject(entitlement);
    expect(mocks.storage.get(KEY)).toBe(before);
  });

  it('preserves a malformed primary cache and fails closed instead of reviving stale legacy access', async () => {
    const malformed = '{not-json';
    const legacy = JSON.stringify(
      cachedEntitlement({
        productId: 'stale-legacy-product',
        source: 'revenuecat',
        store: 'app_store',
        environment: 'sandbox',
        periodType: 'trial',
      }),
    );
    mocks.storage.set(KEY, malformed);
    mocks.storage.set(LEGACY_KEY, legacy);

    await expect(readEntitlementCache()).resolves.toEqual({
      status: 'corrupt',
      entitlement: null,
    });
    await expect(loadEntitlement()).resolves.toBeNull();
    expect(mocks.storage.get(KEY)).toBe(malformed);
    expect(mocks.storage.get(LEGACY_KEY)).toBe(legacy);
    expect(mocks.writes).toBe(0);
  });

  it('reads a valid unversioned primary cache without rewriting it', async () => {
    const legacy = JSON.stringify(cachedEntitlement({ productId: 'legacy-primary' }));
    mocks.storage.set(KEY, legacy);

    await expect(readEntitlementCache()).resolves.toMatchObject({
      status: 'available',
      entitlement: { productId: 'legacy-primary', isActive: true },
    });
    expect(mocks.storage.get(KEY)).toBe(legacy);
    expect(mocks.writes).toBe(0);
  });

  it('keeps forgiving fail-closed normalization for partial unversioned legacy records', async () => {
    const legacy = JSON.stringify({ tier: 'pro', isActive: true });
    mocks.storage.set(KEY, legacy);

    await expect(readEntitlementCache()).resolves.toMatchObject({
      status: 'available',
      entitlement: {
        tier: 'pro',
        isActive: false,
        periodType: null,
        verifiedAt: null,
      },
    });
    expect(mocks.storage.get(KEY)).toBe(legacy);
    expect(mocks.writes).toBe(0);
  });

  it.each([
    [
      'an extra envelope key',
      JSON.stringify({ version: 1, entitlement: cachedEntitlement(), extra: true }),
    ],
    [
      'a missing entitlement field',
      cacheEnvelope(withoutKey(cachedEntitlement(), 'priceLabel')),
    ],
    [
      'an extra entitlement field',
      cacheEnvelope({ ...cachedEntitlement(), extra: true }),
    ],
    [
      'a wrong entitlement field type',
      cacheEnvelope(cachedEntitlement({ isActive: 'true' })),
    ],
    [
      'a non-canonical entitlement field value',
      cacheEnvelope(cachedEntitlement({ expiresAt: 'not-a-date' })),
    ],
  ])('classifies a current envelope with %s as corrupt without rewriting it', async (_case, raw) => {
    mocks.storage.set(KEY, raw);

    await expect(readEntitlementCache()).resolves.toEqual({
      status: 'corrupt',
      entitlement: null,
    });
    await expect(loadEntitlement()).resolves.toBeNull();
    expect(mocks.storage.get(KEY)).toBe(raw);
    expect(mocks.writes).toBe(0);
  });

  it('reads the valid legacy key without migrating it during an ordinary read', async () => {
    const legacy = JSON.stringify(cachedEntitlement({ productId: 'legacy-key-product' }));
    mocks.storage.set(LEGACY_KEY, legacy);

    await expect(readEntitlementCache()).resolves.toMatchObject({
      status: 'available',
      entitlement: { productId: 'legacy-key-product', isActive: true },
    });
    expect(mocks.storage.has(KEY)).toBe(false);
    expect(mocks.storage.get(LEGACY_KEY)).toBe(legacy);
    expect(mocks.writes).toBe(0);
  });

  it('preserves an unsupported future cache and does not fall back to legacy access', async () => {
    const future = cacheEnvelope(cachedEntitlement({ productId: 'future-product' }), 2);
    const legacy = JSON.stringify(cachedEntitlement({ productId: 'stale-legacy-product' }));
    mocks.storage.set(KEY, future);
    mocks.storage.set(LEGACY_KEY, legacy);

    await expect(readEntitlementCache()).resolves.toEqual({
      status: 'unsupported_version',
      entitlement: null,
    });
    await expect(loadEntitlement()).resolves.toBeNull();
    expect(mocks.storage.get(KEY)).toBe(future);
    expect(mocks.storage.get(LEGACY_KEY)).toBe(legacy);
    expect(mocks.writes).toBe(0);
  });

  it('distinguishes unavailable private storage from absence and preserves all bytes', async () => {
    const raw = cacheEnvelope(cachedEntitlement());
    const legacy = JSON.stringify(cachedEntitlement({ productId: 'stale-legacy-product' }));
    mocks.storage.set(KEY, raw);
    mocks.storage.set(LEGACY_KEY, legacy);
    mocks.readErrors.set(KEY, new Error('PRIVATE_KV_CONTENT_KEY_MISSING'));

    await expect(readEntitlementCache()).resolves.toEqual({
      status: 'unavailable',
      entitlement: null,
    });
    await expect(loadEntitlement()).resolves.toBeNull();
    expect(mocks.storage.get(KEY)).toBe(raw);
    expect(mocks.storage.get(LEGACY_KEY)).toBe(legacy);
    expect(mocks.writes).toBe(0);
  });

  it('preserves key-unavailable bytes across conditional and verified mutation attempts', async () => {
    const raw = cacheEnvelope(cachedEntitlement());
    mocks.storage.set(KEY, raw);
    mocks.nextMutationReadError = new Error('PRIVATE_KV_CONTENT_KEY_MISSING');

    await expect(downgradeToFree()).resolves.toBeUndefined();
    expect(mocks.storage.get(KEY)).toBe(raw);

    mocks.nextMutationReadError = new Error('PRIVATE_KV_CONTENT_KEY_MISSING');
    await expect(
      saveVerifiedEntitlement(cachedEntitlement() as StoredEntitlement),
    ).rejects.toThrow('PRIVATE_KV_CONTENT_KEY_MISSING');
    expect(mocks.storage.get(KEY)).toBe(raw);
    expect(mocks.writes).toBe(0);
  });

  it('normalizes an active cache without verification to inactive in memory only', async () => {
    const raw = JSON.stringify(
      cachedEntitlement({ source: 'revenuecat', verifiedAt: null }),
    );
    mocks.storage.set(KEY, raw);

    await expect(loadEntitlement()).resolves.toMatchObject({
      source: 'revenuecat',
      verifiedAt: null,
      isActive: false,
    });
    expect(mocks.storage.get(KEY)).toBe(raw);
    expect(mocks.writes).toBe(0);
  });

  it('does not honor or rewrite a time-boxed entitlement cache without a valid expiry', async () => {
    const raw = JSON.stringify(cachedEntitlement({ expiresAt: 'not-a-date' }));
    mocks.storage.set(KEY, raw);

    await expect(loadEntitlement()).resolves.toMatchObject({
      periodType: 'reverse_trial',
      expiresAt: null,
      isActive: false,
    });
    expect(mocks.storage.get(KEY)).toBe(raw);
    expect(mocks.writes).toBe(0);
  });

  it('normalizes whitespace in memory without read-time persistence', async () => {
    const raw = JSON.stringify(
      cachedEntitlement({
        tier: ' pro ',
        periodType: ' trial ',
        store: ' app_store ',
        productId: ' routinekind_pro_annual ',
        source: ' revenuecat ',
        environment: ' sandbox ',
        verifiedAt: ' 2026-07-05T12:00:00.000Z ',
      }),
    );
    mocks.storage.set(KEY, raw);

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
    expect(mocks.storage.get(KEY)).toBe(raw);
    expect(mocks.writes).toBe(0);
  });

  it('does not honor a development app-granted cache outside development', async () => {
    mocks.env.appEnvironment = 'production';
    const raw = JSON.stringify(cachedEntitlement());
    mocks.storage.set(KEY, raw);

    await expect(loadEntitlement()).resolves.toMatchObject({
      source: 'app_granted',
      environment: 'development',
      isActive: false,
    });
    expect(mocks.storage.get(KEY)).toBe(raw);
  });

  it('does not honor a Test Store entitlement cache in production', async () => {
    mocks.env.appEnvironment = 'production';
    const raw = JSON.stringify(
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
    );
    mocks.storage.set(KEY, raw);

    await expect(loadEntitlement()).resolves.toMatchObject({
      source: 'revenuecat',
      store: 'test_store',
      environment: 'test_store',
      isActive: false,
    });
    expect(mocks.storage.get(KEY)).toBe(raw);
  });

  it('refuses to overwrite malformed or unsupported bytes during verified saves', async () => {
    const malformed = '{not-json';
    mocks.storage.set(KEY, malformed);

    await expect(
      saveVerifiedEntitlement(cachedEntitlement() as StoredEntitlement),
    ).rejects.toThrow(ENTITLEMENT_CACHE_INVALID);
    expect(mocks.storage.get(KEY)).toBe(malformed);

    const future = cacheEnvelope(cachedEntitlement(), 2);
    mocks.storage.set(KEY, future);
    await expect(
      saveVerifiedEntitlement(cachedEntitlement() as StoredEntitlement),
    ).rejects.toThrow(ENTITLEMENT_CACHE_UNSUPPORTED_VERSION);
    expect(mocks.storage.get(KEY)).toBe(future);
  });

  it('keeps the previous cache durable when a verified save fails', async () => {
    const previous = cacheEnvelope(
      cachedEntitlement({ productId: 'previous-product' }),
    );
    mocks.storage.set(KEY, previous);
    mocks.nextMutationError = new Error('PRIVATE_KV_WRITE_FAILED');

    await expect(
      saveVerifiedEntitlement(
        cachedEntitlement({ productId: 'replacement-product' }) as StoredEntitlement,
      ),
    ).rejects.toThrow('PRIVATE_KV_WRITE_FAILED');
    expect(mocks.storage.get(KEY)).toBe(previous);
  });

  it('does not let a concurrent verified save get deleted by an older clear decision', async () => {
    mocks.storage.set(
      KEY,
      cacheEnvelope(
        cachedEntitlement({
          periodType: 'normal',
          store: 'app_store',
          productId: 'old-store-product',
          expiresAt: null,
          willRenew: true,
          source: 'revenuecat',
          environment: 'sandbox',
        }),
      ),
    );
    const replacement = cachedEntitlement({ productId: 'new-app-grant' }) as StoredEntitlement;

    const clear = clearStoreEntitlementIfRevenueCatVerifiedEmpty();
    const save = saveVerifiedEntitlement(replacement);
    await Promise.all([clear, save]);

    await expect(loadEntitlement()).resolves.toMatchObject({
      productId: 'new-app-grant',
      isActive: true,
    });
  });

  it('does not let a stale downgrade overwrite a concurrent verified store entitlement', async () => {
    mocks.storage.set(
      KEY,
      cacheEnvelope(
        cachedEntitlement({
          productId: 'expired-reverse-trial',
          expiresAt: '2026-07-04T12:00:00.000Z',
        }),
      ),
    );
    const replacement = cachedEntitlement({
      periodType: 'normal',
      store: 'app_store',
      productId: 'new-store-product',
      expiresAt: null,
      willRenew: true,
      source: 'revenuecat',
      environment: 'sandbox',
    }) as StoredEntitlement;

    const downgrade = downgradeToFree();
    const save = saveVerifiedEntitlement(replacement);
    await Promise.all([downgrade, save]);

    await expect(loadEntitlement()).resolves.toMatchObject({
      productId: 'new-store-product',
      isActive: true,
      willRenew: true,
    });
  });

  it('keeps unsupported bytes intact when a conditional mutation cannot decode them', async () => {
    const future = cacheEnvelope(cachedEntitlement(), 2);
    mocks.storage.set(KEY, future);

    await expect(downgradeToFree()).resolves.toBeUndefined();
    await expect(clearStoreEntitlementIfRevenueCatVerifiedEmpty()).resolves.toBeUndefined();
    expect(mocks.storage.get(KEY)).toBe(future);
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
