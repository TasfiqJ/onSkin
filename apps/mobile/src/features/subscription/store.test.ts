import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';

import { deriveState, type StoredEntitlement } from './entitlement';
import { resolveEntitlementCacheRead } from './entitlementEvidence';
import {
  ENTITLEMENT_CACHE_INVALID,
  ENTITLEMENT_CACHE_UNSUPPORTED_VERSION,
  acceptRevenueCatVerifiedEmpty,
  acceptTrustedRevenueCatEntitlement,
  acceptVerifiedEntitlement,
  clearEntitlement,
  clearStoreEntitlementIfRevenueCatVerifiedEmpty,
  downgradeToFree,
  fetchServerEntitlement,
  loadEntitlement,
  readEntitlementCache,
  rowToStoredEntitlement,
  saveVerifiedEntitlement,
  startReverseTrialOnServer,
} from './store';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  readErrors: new Map<string, Error>(),
  mutationTails: new Map<string, Promise<void>>(),
  nextMutationReadError: null as Error | null,
  nextMutationError: null as Error | null,
  nextMutationErrorKey: null as string | null,
  nextMutationErrorAttempt: null as number | null,
  mutationAttempts: new Map<string, number>(),
  writes: 0,
  writeKeys: [] as string[],
  env: {
    appEnvironment: 'development' as 'development' | 'staging' | 'production',
    revenueCatReverseTrialProductId: 'routinekind_pro_reverse_trial_local',
  },
  isSupabaseConfigured: false,
  getUser: vi.fn(),
  getSession: vi.fn(),
  invoke: vi.fn(),
  from: vi.fn(),
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
    (key: string, updater: (current: string | null) => string | null): Promise<void> => {
      const previous = mocks.mutationTails.get(key) ?? Promise.resolve();
      const operation = previous
        .catch(() => undefined)
        .then(() => {
          const readFailure = mocks.nextMutationReadError;
          if (readFailure) {
            mocks.nextMutationReadError = null;
            throw readFailure;
          }
          const current = mocks.storage.get(key) ?? null;
          const next = updater(current);
          const attempt = (mocks.mutationAttempts.get(key) ?? 0) + 1;
          mocks.mutationAttempts.set(key, attempt);
          const failure =
            mocks.nextMutationError &&
            (mocks.nextMutationErrorKey === null || mocks.nextMutationErrorKey === key) &&
            (mocks.nextMutationErrorAttempt === null ||
              mocks.nextMutationErrorAttempt === attempt)
              ? mocks.nextMutationError
              : null;
          if (failure) {
            mocks.nextMutationError = null;
            mocks.nextMutationErrorKey = null;
            mocks.nextMutationErrorAttempt = null;
            throw failure;
          }
          if (next === current) return;
          if (next === null) mocks.storage.delete(key);
          else mocks.storage.set(key, next);
          mocks.writes += 1;
          mocks.writeKeys.push(key);
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
    auth: {
      getUser: mocks.getUser,
      getSession: mocks.getSession,
    },
    functions: {
      invoke: mocks.invoke,
    },
    from: mocks.from,
  },
}));

const NOW = new Date('2026-07-05T12:00:00.000Z');
const KEY = 'onskin.entitlement.v2';
const PREVIOUS_KEY = KEY;
const LEGACY_KEY = 'onskin.entitlement.v1';
const REVENUECAT_EMPTY_KEY = LEGACY_KEY;

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

function cacheEnvelope(entitlement: unknown, version = 1): string {
  return JSON.stringify({ version, entitlement });
}

function compositeCacheEnvelope(
  entitlement: unknown | null,
  revenueCatEmpty: Record<string, unknown> | null = null,
): string {
  const trustedRevenueCatProof = trustedRevenueCatMarkerFor(entitlement);
  if (revenueCatEmpty || trustedRevenueCatProof) {
    mocks.storage.set(
      REVENUECAT_EMPTY_KEY,
      JSON.stringify({
        version: 2,
        revenueCatEmpty,
        trustedRevenueCatProof,
      }),
    );
  }
  if (entitlement !== null) return JSON.stringify(entitlement);
  return JSON.stringify({
    tier: 'pro',
    isActive: false,
    periodType: null,
    store: null,
    productId: null,
    expiresAt: null,
    willRenew: false,
    grantedAt: null,
    source: 'local_cache',
    environment: null,
    managementUrl: null,
    verifiedAt: revenueCatEmpty?.verifiedAt ?? NOW.toISOString(),
    offeringId: null,
    packageId: null,
    storeUserId: null,
    priceLabel: null,
  });
}

function trustedRevenueCatMarkerFor(entitlement: unknown) {
  if (!entitlement || typeof entitlement !== 'object') return null;
  const proof = entitlement as Partial<StoredEntitlement>;
  if (proof.source !== 'revenuecat' || !proof.storeUserId) return null;
  return {
    storeUserId: proof.storeUserId,
    proofIdentity: JSON.stringify([
      proof.source ?? null,
      proof.verifiedAt ?? null,
      proof.tier,
      proof.isActive,
      proof.periodType,
      proof.store,
      proof.productId,
      proof.expiresAt,
      proof.willRenew,
      proof.grantedAt,
      proof.environment ?? null,
      proof.storeUserId ?? null,
    ]),
  };
}

function storeEntitlement(overrides: Record<string, unknown> = {}): StoredEntitlement {
  return cachedEntitlement({
    periodType: 'normal',
    store: 'app_store',
    productId: 'routinekind_pro_annual',
    expiresAt: '2027-07-05T12:00:00.000Z',
    willRenew: true,
    source: 'revenuecat',
    environment: 'production',
    offeringId: 'default',
    packageId: 'annual',
    storeUserId: 'owner-a',
    ...overrides,
  }) as StoredEntitlement;
}

function verifiedEmptyEvidence(verifiedAt = '2026-07-05T12:01:00.000Z') {
  return {
    verifiedAt,
    managementUrl: null,
    storeUserId: 'owner-a',
  } as const;
}

function mockServerEntitlement(row: Record<string, unknown>) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    limit: vi.fn(),
    abortSignal: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.abortSignal.mockReturnValue(builder);
  mocks.from.mockReturnValue(builder);
  return builder;
}

function withoutKey(record: Record<string, unknown>, keyToRemove: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== keyToRemove));
}

describe('subscription entitlement cache', () => {
  beforeEach(() => {
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mocks.storage.clear();
    mocks.readErrors.clear();
    mocks.mutationTails.clear();
    mocks.nextMutationReadError = null;
    mocks.nextMutationError = null;
    mocks.nextMutationErrorKey = null;
    mocks.nextMutationErrorAttempt = null;
    mocks.mutationAttempts.clear();
    mocks.writes = 0;
    mocks.writeKeys = [];
    mocks.getUser.mockReset();
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'owner-a' } },
      error: null,
    });
    mocks.getSession.mockReset();
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token-a',
          user: { id: 'owner-a' },
        },
      },
      error: null,
    });
    mocks.invoke.mockReset();
    mocks.from.mockReset();
    mocks.env.appEnvironment = 'development';
    mocks.isSupabaseConfigured = false;
  });

  afterEach(() => {
    endAccountGenerationBoundary();
  });

  it('aborts a delayed server entitlement read when the account generation changes', async () => {
    mocks.isSupabaseConfigured = true;
    let rejectQuery!: (reason?: unknown) => void;
    let observeSignal!: (signal: AbortSignal) => void;
    const signalObserved = new Promise<AbortSignal>((resolve) => {
      observeSignal = resolve;
    });
    const pendingQuery = new Promise<never>((_resolve, reject) => {
      rejectQuery = reject;
    });
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      limit: vi.fn(),
      abortSignal: vi.fn(),
      maybeSingle: vi.fn(() => pendingQuery),
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.limit.mockReturnValue(builder);
    builder.abortSignal.mockImplementation((signal: AbortSignal) => {
      observeSignal(signal);
      signal.addEventListener(
        'abort',
        () => rejectQuery(Object.assign(new Error('aborted'), { name: 'AbortError' })),
        { once: true },
      );
      return builder;
    });
    mocks.from.mockReturnValue(builder);

    const request = fetchServerEntitlement();
    const signal = await signalObserved;

    beginAccountGenerationBoundary();

    expect(signal.aborted).toBe(true);
    await expect(request).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    expect(mocks.from).toHaveBeenCalledWith('entitlements');
    expect(builder.abortSignal).toHaveBeenCalledWith(signal);
    expect(builder.maybeSingle).toHaveBeenCalledTimes(1);
    expect(mocks.writes).toBe(0);
  });

  it('grants and persists a versioned development reverse trial when Supabase is not configured', async () => {
    const started = await startReverseTrialOnServer(() => {}, 'owner-a');
    const entitlement = started.entitlement!;

    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(started.started).toBe(true);
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
      productId: 'routinekind_pro_reverse_trial_local',
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
    mocks.storage.set(PREVIOUS_KEY, cacheEnvelope(cachedEntitlement()));
    mocks.storage.set(LEGACY_KEY, JSON.stringify(cachedEntitlement()));

    await clearEntitlement();

    await expect(loadEntitlement()).resolves.toBeNull();
    expect(mocks.storage.has(KEY)).toBe(false);
    expect(mocks.storage.has(PREVIOUS_KEY)).toBe(false);
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

    await expect(
      clearStoreEntitlementIfRevenueCatVerifiedEmpty(verifiedEmptyEvidence()),
    ).resolves.toBeNull();

    await expect(loadEntitlement()).resolves.toBeNull();
  });

  it('preserves app-granted reverse trials when RevenueCat restore finds no store purchase', async () => {
    const started = await startReverseTrialOnServer(() => {}, 'owner-a');
    const entitlement = started.entitlement!;
    const before = mocks.storage.get(KEY);

    await expect(
      clearStoreEntitlementIfRevenueCatVerifiedEmpty(verifiedEmptyEvidence()),
    ).resolves.toMatchObject(entitlement);

    await expect(loadEntitlement()).resolves.toMatchObject(entitlement);
    expect(mocks.storage.get(KEY)).toBe(before);
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
      productId: entitlement.productId,
    });
    expect(JSON.parse(mocks.storage.get(REVENUECAT_EMPTY_KEY) ?? '{}')).toMatchObject({
      version: 2,
      revenueCatEmpty: { verifiedAt: '2026-07-05T12:01:00.000Z' },
    });
  });

  it('stores independent app-granted proof behind a newer RevenueCat empty watermark', async () => {
    mocks.env.appEnvironment = 'production';
    await saveVerifiedEntitlement(
      storeEntitlement({ verifiedAt: '2026-07-05T12:00:00.000Z' }),
    );
    const empty = await acceptRevenueCatVerifiedEmpty(
      verifiedEmptyEvidence('2026-07-05T12:02:00.000Z'),
    );
    expect(empty).toMatchObject({
      entitlement: null,
      revenueCatEmpty: { verifiedAt: '2026-07-05T12:02:00.000Z' },
      persisted: true,
    });
    await expect(readEntitlementCache()).resolves.toEqual({
      status: 'absent',
      entitlement: null,
      revenueCatEmpty: verifiedEmptyEvidence('2026-07-05T12:02:00.000Z'),
    });

    const appGrant = cachedEntitlement({
      productId: 'delayed-independent-app-grant',
      source: 'app_granted',
      environment: 'production',
      storeUserId: 'owner-a',
      verifiedAt: '2026-07-05T12:01:00.000Z',
    }) as StoredEntitlement;
    await expect(acceptVerifiedEntitlement(appGrant)).resolves.toMatchObject({
      entitlement: { productId: 'delayed-independent-app-grant', isActive: true },
      revenueCatEmpty: { verifiedAt: '2026-07-05T12:02:00.000Z' },
      persisted: true,
    });

    await expect(
      acceptVerifiedEntitlement(
        storeEntitlement({
          productId: 'delayed-store-proof',
          verifiedAt: '2026-07-05T12:01:30.000Z',
        }),
      ),
    ).resolves.toMatchObject({
      entitlement: { productId: 'delayed-independent-app-grant' },
      revenueCatEmpty: { verifiedAt: '2026-07-05T12:02:00.000Z' },
      persisted: true,
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
      productId: 'delayed-independent-app-grant',
    });
    expect(JSON.parse(mocks.storage.get(REVENUECAT_EMPTY_KEY) ?? '{}')).toMatchObject({
      revenueCatEmpty: { verifiedAt: '2026-07-05T12:02:00.000Z' },
    });
  });

  it('applies a coexisting RevenueCat empty watermark when selecting the read result', async () => {
    mocks.env.appEnvironment = 'production';
    const watermark = verifiedEmptyEvidence('2026-07-05T12:02:00.000Z');
    const olderStore = storeEntitlement({ verifiedAt: '2026-07-05T12:01:00.000Z' });
    mocks.storage.set(KEY, compositeCacheEnvelope(olderStore, watermark));
    await expect(readEntitlementCache()).resolves.toEqual({
      status: 'absent',
      entitlement: null,
      revenueCatEmpty: watermark,
    });

    const equalStore = storeEntitlement({ verifiedAt: watermark.verifiedAt });
    mocks.storage.set(KEY, compositeCacheEnvelope(equalStore, watermark));
    await expect(readEntitlementCache()).resolves.toMatchObject({
      status: 'absent',
      revenueCatEmpty: watermark,
    });

    const newerStore = storeEntitlement({ verifiedAt: '2026-07-05T12:03:00.000Z' });
    mocks.storage.set(KEY, compositeCacheEnvelope(newerStore, watermark));
    await expect(readEntitlementCache()).resolves.toMatchObject({
      status: 'available',
      entitlement: { productId: 'routinekind_pro_annual', isActive: true },
    });

    const appGrant = cachedEntitlement({
      environment: 'production',
      verifiedAt: '2026-07-05T12:01:00.000Z',
    });
    mocks.storage.set(KEY, compositeCacheEnvelope(appGrant, watermark));
    await expect(readEntitlementCache()).resolves.toMatchObject({
      status: 'available',
      entitlement: { store: 'app_granted', isActive: true },
    });

    const futureWatermark = verifiedEmptyEvidence('2026-07-05T12:05:00.001Z');
    mocks.storage.set(
      KEY,
      compositeCacheEnvelope(
        storeEntitlement({ verifiedAt: '2026-07-05T12:00:00.000Z' }),
        futureWatermark,
      ),
    );
    await expect(readEntitlementCache()).resolves.toMatchObject({
      status: 'available',
      entitlement: { productId: 'routinekind_pro_annual', isActive: true },
    });
    expect(mocks.writes).toBe(0);
  });

  it('canonicalizes a strict v2 store proof already blocked by its empty watermark before accepting mutations', async () => {
    mocks.env.appEnvironment = 'production';
    const watermark = verifiedEmptyEvidence('2026-07-05T12:02:00.000Z');
    const blockedStore = storeEntitlement({
      productId: 'blocked-store-t1',
      verifiedAt: '2026-07-05T12:01:00.000Z',
    });
    mocks.storage.set(KEY, compositeCacheEnvelope(blockedStore, watermark));

    await expect(
      acceptVerifiedEntitlement(
        storeEntitlement({
          productId: 'older-store-t0',
          verifiedAt: '2026-07-05T12:00:00.000Z',
        }),
      ),
    ).resolves.toMatchObject({
      entitlement: null,
      revenueCatEmpty: watermark,
      persisted: true,
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
      source: 'local_cache',
      isActive: false,
      verifiedAt: watermark.verifiedAt,
    });

    mocks.storage.set(KEY, compositeCacheEnvelope(blockedStore, watermark));
    const independentAppGrant = cachedEntitlement({
      productId: 'independent-app-grant-t0',
      environment: 'production',
      verifiedAt: '2026-07-05T12:00:30.000Z',
    }) as StoredEntitlement;
    await expect(acceptVerifiedEntitlement(independentAppGrant)).resolves.toMatchObject({
      entitlement: { productId: 'independent-app-grant-t0', isActive: true },
      revenueCatEmpty: watermark,
      persisted: true,
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
      productId: 'independent-app-grant-t0',
      isActive: true,
    });
  });

  it('preserves a legacy-key app grant when RevenueCat verifies no store purchase', async () => {
    const legacy = JSON.stringify(
      cachedEntitlement({ productId: 'legacy-app-grant', storeUserId: 'owner-a' }),
    );
    mocks.storage.set(LEGACY_KEY, legacy);

    await expect(
      clearStoreEntitlementIfRevenueCatVerifiedEmpty(verifiedEmptyEvidence()),
    ).resolves.toMatchObject({ productId: 'legacy-app-grant', isActive: true });

    expect(mocks.storage.has(KEY)).toBe(true);
    expect(JSON.parse(mocks.storage.get(LEGACY_KEY) ?? '{}')).toMatchObject({
      version: 2,
      revenueCatEmpty: { verifiedAt: '2026-07-05T12:01:00.000Z' },
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
      productId: 'legacy-app-grant',
    });
    expect(JSON.parse(mocks.storage.get(REVENUECAT_EMPTY_KEY) ?? '{}')).toMatchObject({
      revenueCatEmpty: { verifiedAt: '2026-07-05T12:01:00.000Z' },
    });
    await expect(loadEntitlement()).resolves.toMatchObject({
      productId: 'legacy-app-grant',
      isActive: true,
    });
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
    ['a missing entitlement field', cacheEnvelope(withoutKey(cachedEntitlement(), 'priceLabel'))],
    ['an extra entitlement field', cacheEnvelope({ ...cachedEntitlement(), extra: true })],
    ['a wrong entitlement field type', cacheEnvelope(cachedEntitlement({ isActive: 'true' }))],
    [
      'a non-canonical entitlement field value',
      cacheEnvelope(cachedEntitlement({ expiresAt: 'not-a-date' })),
    ],
  ])(
    'classifies a current envelope with %s as corrupt without rewriting it',
    async (_case, raw) => {
      mocks.storage.set(KEY, raw);

      await expect(readEntitlementCache()).resolves.toEqual({
        status: 'corrupt',
        entitlement: null,
      });
      await expect(loadEntitlement()).resolves.toBeNull();
      expect(mocks.storage.get(KEY)).toBe(raw);
      expect(mocks.writes).toBe(0);
    },
  );

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

  it('reads the rollback-compatible v2 key without rewriting or falling through to v1', async () => {
    const previousEntitlement = cachedEntitlement({ productId: 'rollback-v2-proof' });
    const previous = cacheEnvelope(previousEntitlement);
    const staleV1 = JSON.stringify(
      cachedEntitlement({
        productId: 'stale-v1-proof',
        verifiedAt: '2026-07-05T12:04:00.000Z',
      }),
    );
    mocks.storage.set(PREVIOUS_KEY, previous);
    mocks.storage.set(LEGACY_KEY, staleV1);

    await expect(readEntitlementCache()).resolves.toMatchObject({
      status: 'available',
      entitlement: { productId: 'rollback-v2-proof', isActive: true },
    });
    expect(mocks.storage.has(KEY)).toBe(true);
    expect(mocks.storage.get(PREVIOUS_KEY)).toBe(previous);
    expect(mocks.storage.get(LEGACY_KEY)).toBe(staleV1);
    expect(mocks.writes).toBe(0);
  });

  it('rewrites the former v1 envelope as a rollback-readable canonical raw v2 proof', async () => {
    const previousEntitlement = cachedEntitlement({
      productId: 'rollback-compatible-proof',
      verifiedAt: '2026-07-05T12:02:00.000Z',
    });
    const previous = cacheEnvelope(previousEntitlement);
    mocks.storage.set(PREVIOUS_KEY, previous);

    await expect(
      acceptVerifiedEntitlement(
        cachedEntitlement({
          productId: 'older-incoming-proof',
          verifiedAt: '2026-07-05T12:01:00.000Z',
        }) as StoredEntitlement,
      ),
    ).resolves.toMatchObject({
      entitlement: { productId: 'rollback-compatible-proof' },
      persisted: true,
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual(previousEntitlement);
    expect(mocks.writes).toBe(1);
  });

  it('does not revive v1 when the rollback-compatible v2 key is unreadable', async () => {
    const unsupportedPrevious = cacheEnvelope(cachedEntitlement(), 3);
    const legacy = JSON.stringify(
      cachedEntitlement({ productId: 'must-not-revive-v1' }),
    );
    mocks.storage.set(PREVIOUS_KEY, unsupportedPrevious);
    mocks.storage.set(LEGACY_KEY, legacy);

    await expect(readEntitlementCache()).resolves.toEqual({
      status: 'unsupported_version',
      entitlement: null,
    });
    await expect(
      acceptVerifiedEntitlement(
        cachedEntitlement({ productId: 'memory-only-proof' }) as StoredEntitlement,
      ),
    ).resolves.toMatchObject({
      entitlement: { productId: 'memory-only-proof' },
      persisted: false,
    });
    expect(mocks.storage.has(KEY)).toBe(true);
    expect(mocks.storage.get(PREVIOUS_KEY)).toBe(unsupportedPrevious);
    expect(mocks.storage.get(LEGACY_KEY)).toBe(legacy);
    expect(mocks.writes).toBe(0);
  });

  it('orders against a legacy proof and migrates the effective result through the primary key', async () => {
    const legacyEntitlement = cachedEntitlement({
      productId: 'newer-legacy-proof',
      verifiedAt: '2026-07-05T12:02:00.000Z',
    });
    const legacy = cacheEnvelope(legacyEntitlement);
    mocks.storage.set(LEGACY_KEY, legacy);

    await expect(
      acceptVerifiedEntitlement(
        cachedEntitlement({
          productId: 'older-incoming-proof',
          verifiedAt: '2026-07-05T12:01:00.000Z',
        }) as StoredEntitlement,
      ),
    ).resolves.toMatchObject({
      entitlement: { productId: 'newer-legacy-proof' },
      revenueCatEmpty: null,
      persisted: true,
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual(legacyEntitlement);
    expect(mocks.storage.get(LEGACY_KEY)).toBe(legacy);
    expect(mocks.writes).toBe(1);
  });

  it.each(['corrupt', 'unsupported_version', 'unavailable'] as const)(
    'returns valid proof memory-only and preserves an %s legacy key',
    async (failure) => {
      const legacy =
        failure === 'corrupt'
          ? '{not-json'
          : failure === 'unsupported_version'
            ? cacheEnvelope(cachedEntitlement(), 3)
            : cacheEnvelope(cachedEntitlement({ productId: 'unreadable-legacy' }));
      mocks.storage.set(LEGACY_KEY, legacy);
      if (failure === 'unavailable') {
        mocks.readErrors.set(LEGACY_KEY, new Error('PRIVATE_KV_CONTENT_KEY_MISSING'));
      }

      await expect(
        acceptVerifiedEntitlement(
          cachedEntitlement({ productId: 'memory-only-proof' }) as StoredEntitlement,
        ),
      ).resolves.toMatchObject({
        entitlement: { productId: 'memory-only-proof', isActive: true },
        persisted: true,
      });
      expect(mocks.storage.has(KEY)).toBe(true);
      expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
        productId: 'memory-only-proof',
      });
      expect(mocks.storage.get(LEGACY_KEY)).toBe(legacy);
      expect(mocks.writes).toBe(1);
    },
  );

  it('does not rewrite an exact v2 state when the same proof is accepted', async () => {
    const entitlement = cachedEntitlement();
    const raw = compositeCacheEnvelope(entitlement);
    mocks.storage.set(KEY, raw);

    await expect(
      acceptVerifiedEntitlement(entitlement as StoredEntitlement),
    ).resolves.toMatchObject({ entitlement, persisted: true });
    expect(mocks.storage.get(KEY)).toBe(raw);
    expect(mocks.writes).toBe(0);
  });

  it('durably enriches a same-proof management URL without replacing authority', async () => {
    const entitlement = cachedEntitlement({ storeUserId: 'owner-a' }) as StoredEntitlement;
    await acceptVerifiedEntitlement(entitlement);
    await expect(
      acceptVerifiedEntitlement({
        ...entitlement,
        managementUrl: 'https://apps.apple.com/account/subscriptions',
      }),
    ).resolves.toMatchObject({
      entitlement: {
        productId: entitlement.productId,
        managementUrl: 'https://apps.apple.com/account/subscriptions',
      },
    });
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    await expect(readEntitlementCache({ expectedStoreUserId: 'owner-a' })).resolves.toMatchObject({
      status: 'available',
      entitlement: { managementUrl: 'https://apps.apple.com/account/subscriptions' },
    });
  });

  it('preserves an unsupported future cache and does not fall back to legacy access', async () => {
    const future = cacheEnvelope(cachedEntitlement({ productId: 'future-product' }), 3);
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

    await expect(downgradeToFree('missing-proof', 'owner-a')).resolves.toBe(false);
    expect(mocks.storage.get(KEY)).toBe(raw);

    mocks.nextMutationReadError = new Error('PRIVATE_KV_CONTENT_KEY_MISSING');
    await expect(saveVerifiedEntitlement(cachedEntitlement() as StoredEntitlement)).rejects.toThrow(
      'PRIVATE_KV_CONTENT_KEY_MISSING',
    );
    expect(mocks.storage.get(KEY)).toBe(raw);
    expect(mocks.writes).toBe(0);
  });

  it('fails closed on an active RevenueCat cache without verification', async () => {
    const raw = JSON.stringify(cachedEntitlement({ source: 'revenuecat', verifiedAt: null }));
    mocks.storage.set(KEY, raw);

    await expect(loadEntitlement()).resolves.toBeNull();
    expect(mocks.storage.get(KEY)).toBe(raw);
    expect(mocks.writes).toBe(0);
  });

  it('does not mint verification time for a server row that omitted authoritative timestamps', async () => {
    const entitlement = rowToStoredEntitlement({
      entitlement: 'pro',
      is_active: true,
      period_type: 'normal',
      store: 'app_store',
      product_id: 'routinekind_pro_annual',
      expires_at: '2026-08-05T12:00:00.000Z',
      will_renew: true,
      original_purchase_at: '2026-07-05T12:00:00.000Z',
      source: 'server',
      environment: 'production',
    });

    expect(entitlement.verifiedAt).toBeNull();
    await expect(saveVerifiedEntitlement(entitlement)).rejects.toThrow(
      'INVALID_ENTITLEMENT_CACHE_RECORD',
    );
    expect(mocks.storage.has(KEY)).toBe(false);
    expect(mocks.writes).toBe(0);
  });

  it('retains a server-authored updated_at as legacy verification evidence', () => {
    expect(
      rowToStoredEntitlement({
        entitlement: 'pro',
        is_active: true,
        period_type: 'normal',
        store: 'app_store',
        product_id: 'routinekind_pro_annual',
        expires_at: '2026-08-05T12:00:00.000Z',
        will_renew: true,
        original_purchase_at: '2026-07-05T12:00:00.000Z',
        source: 'server',
        environment: 'production',
        updated_at: '2026-07-05T11:59:00.000Z',
      }).verifiedAt,
    ).toBe('2026-07-05T11:59:00.000Z');
  });

  it('does not honor or rewrite a time-boxed entitlement cache without a valid expiry', async () => {
    const raw = JSON.stringify(cachedEntitlement({ expiresAt: 'not-a-date' }));
    mocks.storage.set(KEY, raw);

    await expect(readEntitlementCache()).resolves.toEqual({
      status: 'corrupt',
      entitlement: null,
    });
    await expect(loadEntitlement()).resolves.toBeNull();
    expect(mocks.storage.get(KEY)).toBe(raw);
    expect(mocks.writes).toBe(0);
  });

  it('rejects non-canonical security-sensitive enum bytes without rewriting', async () => {
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

    await expect(readEntitlementCache()).resolves.toEqual({
      status: 'corrupt',
      entitlement: null,
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

    await expect(readEntitlementCache()).resolves.toEqual({
      status: 'unavailable',
      entitlement: null,
    });
    expect(mocks.storage.get(KEY)).toBe(raw);
  });

  it.each([
    [
      'a verification time beyond the five-minute skew window',
      () => storeEntitlement({ verifiedAt: '2026-07-05T12:05:00.001Z' }),
    ],
    ['a development app grant in production', () => cachedEntitlement() as StoredEntitlement],
    [
      'a Test Store proof in production',
      () => storeEntitlement({ store: 'test_store', environment: 'test_store' }),
    ],
    [
      'mismatched app-grant semantics',
      () =>
        cachedEntitlement({
          store: 'app_store',
          source: 'app_granted',
          environment: 'production',
        }) as StoredEntitlement,
    ],
    [
      'a time-boxed proof without expiry',
      () => storeEntitlement({ periodType: 'trial', expiresAt: null }),
    ],
  ])('rejects %s before touching durable bytes', async (_case, incoming) => {
    mocks.env.appEnvironment = 'production';
    const raw = compositeCacheEnvelope(
      storeEntitlement({ productId: 'durable-current-proof' }),
    );
    mocks.storage.set(KEY, raw);

    await expect(
      acceptVerifiedEntitlement(incoming(), {
        reviewedAt: NOW.toISOString(),
        appEnvironment: 'production',
      }),
    ).rejects.toThrow('INVALID_ENTITLEMENT_CACHE_RECORD');
    expect(mocks.storage.get(KEY)).toBe(raw);
    expect(mocks.writes).toBe(0);
  });

  it('replaces evidence-invalid future current bytes with a later valid proof', async () => {
    mocks.env.appEnvironment = 'production';
    const futureCurrent = storeEntitlement({
      productId: 'future-poison',
      verifiedAt: '2026-07-05T12:05:00.001Z',
    });
    mocks.storage.set(KEY, compositeCacheEnvelope(futureCurrent));
    const valid = storeEntitlement({
      productId: 'valid-current',
      verifiedAt: NOW.toISOString(),
    });

    await expect(acceptVerifiedEntitlement(valid)).resolves.toMatchObject({
      entitlement: { productId: 'valid-current', verifiedAt: NOW.toISOString() },
      persisted: true,
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
      productId: 'valid-current',
    });
  });

  it('refuses to overwrite malformed or unsupported bytes during verified saves', async () => {
    const malformed = '{not-json';
    mocks.storage.set(KEY, malformed);

    await expect(saveVerifiedEntitlement(cachedEntitlement() as StoredEntitlement)).rejects.toThrow(
      ENTITLEMENT_CACHE_INVALID,
    );
    expect(mocks.storage.get(KEY)).toBe(malformed);

    const future = cacheEnvelope(cachedEntitlement(), 3);
    mocks.storage.set(KEY, future);
    await expect(saveVerifiedEntitlement(cachedEntitlement() as StoredEntitlement)).rejects.toThrow(
      ENTITLEMENT_CACHE_UNSUPPORTED_VERSION,
    );
    expect(mocks.storage.get(KEY)).toBe(future);
  });

  it('keeps the previous cache durable when a verified save fails', async () => {
    const previous = cacheEnvelope(cachedEntitlement({ productId: 'previous-product' }));
    mocks.storage.set(KEY, previous);
    mocks.nextMutationError = new Error('PRIVATE_KV_WRITE_FAILED');

    await expect(
      saveVerifiedEntitlement(
        cachedEntitlement({ productId: 'replacement-product' }) as StoredEntitlement,
      ),
    ).rejects.toThrow('PRIVATE_KV_WRITE_FAILED');
    expect(mocks.storage.get(KEY)).toBe(previous);
  });

  it.each(['malformed', 'unsupported', 'key_unavailable', 'write_failed'] as const)(
    'accepts an active RevenueCat proof memory-only across %s persistence failure',
    async (failure) => {
      mocks.env.appEnvironment = 'production';
      const original =
        failure === 'malformed'
          ? '{not-json'
          : failure === 'unsupported'
            ? cacheEnvelope(storeEntitlement(), 3)
            : compositeCacheEnvelope(
                storeEntitlement({
                  productId: 'durable-older-proof',
                  verifiedAt: '2026-07-05T11:59:00.000Z',
                }),
              );
      mocks.storage.set(KEY, original);
      if (failure === 'key_unavailable') {
        mocks.nextMutationReadError = new Error('PRIVATE_KV_CONTENT_KEY_MISSING');
      } else if (failure === 'write_failed') {
        mocks.nextMutationError = new Error('PRIVATE_KV_WRITE_FAILED');
      }

      await expect(
        acceptVerifiedEntitlement(storeEntitlement({ productId: 'memory-active-proof' })),
      ).resolves.toMatchObject({
        entitlement: { productId: 'memory-active-proof', isActive: true },
        persisted: false,
      });
      expect(mocks.storage.get(KEY)).toBe(original);
    },
  );

  it('atomically preserves newer/equal evidence and accepts a newer inactive revocation', async () => {
    const current = cachedEntitlement({
      periodType: 'normal',
      store: 'app_store',
      productId: 'current-active',
      expiresAt: null,
      willRenew: true,
      source: 'revenuecat',
      environment: 'sandbox',
      storeUserId: 'owner-a',
      verifiedAt: '2026-07-05T12:02:00.000Z',
    }) as StoredEntitlement;
    await saveVerifiedEntitlement(current);
    const currentBytes = mocks.storage.get(KEY);

    const olderAccepted = await saveVerifiedEntitlement({
      ...current,
      productId: 'older-duplicate',
      verifiedAt: '2026-07-05T12:01:00.000Z',
    });
    const equalAccepted = await saveVerifiedEntitlement({
      ...current,
      productId: 'equal-duplicate',
    });

    expect(olderAccepted.productId).toBe('current-active');
    expect(equalAccepted.productId).toBe('current-active');
    expect(mocks.storage.get(KEY)).toBe(currentBytes);

    const revoked = await saveVerifiedEntitlement({
      ...current,
      isActive: false,
      willRenew: false,
      productId: 'newer-revocation',
      verifiedAt: '2026-07-05T12:03:00.000Z',
    });
    expect(revoked).toMatchObject({
      isActive: false,
      productId: 'newer-revocation',
      verifiedAt: '2026-07-05T12:03:00.000Z',
    });
    await expect(loadEntitlement()).resolves.toMatchObject(revoked);
  });

  it('returns a newer active trial when an older verified-empty result loses ordering', async () => {
    const current = cachedEntitlement({
      periodType: 'trial',
      store: 'app_store',
      productId: 'newer-store-trial',
      expiresAt: '2026-07-12T12:00:00.000Z',
      willRenew: true,
      source: 'revenuecat',
      environment: 'sandbox',
      storeUserId: 'owner-a',
      verifiedAt: '2026-07-05T12:02:00.000Z',
    }) as StoredEntitlement;
    await saveVerifiedEntitlement(current);
    const before = mocks.storage.get(KEY);

    await expect(
      clearStoreEntitlementIfRevenueCatVerifiedEmpty(
        verifiedEmptyEvidence('2026-07-05T12:01:00.000Z'),
      ),
    ).resolves.toMatchObject({
      productId: 'newer-store-trial',
      isActive: true,
      periodType: 'trial',
    });
    expect(mocks.storage.get(KEY)).toBe(before);
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
      productId: 'newer-store-trial',
    });
    expect(JSON.parse(mocks.storage.get(REVENUECAT_EMPTY_KEY) ?? '{}')).toMatchObject({
      revenueCatEmpty: { verifiedAt: '2026-07-05T12:01:00.000Z' },
    });
  });

  it('converges concurrent verified saves on the newest authoritative timestamp', async () => {
    const base = cachedEntitlement({
      periodType: 'normal',
      store: 'app_store',
      expiresAt: null,
      willRenew: true,
      source: 'revenuecat',
      environment: 'sandbox',
    }) as StoredEntitlement;
    const newer = {
      ...base,
      productId: 'newer-concurrent',
      verifiedAt: '2026-07-05T12:02:00.000Z',
    };
    const older = {
      ...base,
      productId: 'older-concurrent',
      verifiedAt: '2026-07-05T12:01:00.000Z',
    };

    const [newerResult, delayedOlderResult] = await Promise.all([
      saveVerifiedEntitlement(newer),
      saveVerifiedEntitlement(older),
    ]);

    expect(newerResult.productId).toBe('newer-concurrent');
    expect(delayedOlderResult.productId).toBe('newer-concurrent');
    await expect(loadEntitlement()).resolves.toMatchObject({
      productId: 'newer-concurrent',
      verifiedAt: '2026-07-05T12:02:00.000Z',
    });
  });

  it('keeps a verified-empty RevenueCat tombstone ahead of an older delayed server row', async () => {
    mocks.env.appEnvironment = 'production';
    mocks.isSupabaseConfigured = true;
    await saveVerifiedEntitlement(
      cachedEntitlement({
        periodType: 'normal',
        store: 'app_store',
        productId: 'prior-store-access',
        expiresAt: null,
        willRenew: true,
        source: 'revenuecat',
        environment: 'production',
        verifiedAt: '2026-07-05T12:00:00.000Z',
      }) as StoredEntitlement,
    );
    await clearStoreEntitlementIfRevenueCatVerifiedEmpty(
      verifiedEmptyEvidence('2026-07-05T12:02:00.000Z'),
    );

    const emptyRead = await readEntitlementCache();
    expect(resolveEntitlementCacheRead(emptyRead, NOW.toISOString(), 'production')).toMatchObject({
      isPro: false,
      expired: false,
      priorPeriodType: null,
      evidenceStatus: 'absent',
      verifiedAt: '2026-07-05T12:02:00.000Z',
    });
    await expect(loadEntitlement()).resolves.toBeNull();

    mockServerEntitlement({
      entitlement: 'pro',
      is_active: true,
      period_type: 'normal',
      store: 'app_store',
      product_id: 'delayed-server-access',
      expires_at: '2026-08-05T12:00:00.000Z',
      will_renew: true,
      original_purchase_at: '2026-06-05T12:00:00.000Z',
      source: 'server',
      environment: 'production',
      storeUserId: 'owner-a',
      verified_at: '2026-07-05T12:01:00.000Z',
    });

    await expect(fetchServerEntitlement()).resolves.toMatchObject({
      status: 'evidence',
      acceptance: {
        entitlement: null,
        revenueCatEmpty: { verifiedAt: '2026-07-05T12:02:00.000Z' },
      },
    });
    await expect(loadEntitlement()).resolves.toBeNull();
  });

  it.each(['malformed', 'unsupported', 'key_unavailable', 'write_failed'] as const)(
    'returns valid server proof in memory while preserving %s cache bytes',
    async (failure) => {
      mocks.env.appEnvironment = 'production';
      mocks.isSupabaseConfigured = true;
      const original =
        failure === 'malformed'
          ? '{not-json'
          : failure === 'unsupported'
            ? cacheEnvelope(cachedEntitlement(), 3)
            : cacheEnvelope(
                cachedEntitlement({
                  periodType: 'normal',
                  store: 'app_store',
                  productId: 'durable-current',
                  expiresAt: null,
                  source: 'revenuecat',
                  environment: 'production',
                  verifiedAt: '2026-07-05T12:00:00.000Z',
                }),
              );
      mocks.storage.set(KEY, original);
      if (failure === 'key_unavailable') {
        mocks.nextMutationReadError = new Error('PRIVATE_KV_CONTENT_KEY_MISSING');
      } else if (failure === 'write_failed') {
        mocks.nextMutationError = new Error('PRIVATE_KV_WRITE_FAILED');
      }
      mockServerEntitlement({
        entitlement: 'pro',
        is_active: true,
        period_type: 'normal',
        store: 'app_store',
        product_id: 'memory-only-server-proof',
        expires_at: '2026-08-05T12:00:00.000Z',
        will_renew: true,
        original_purchase_at: '2026-06-05T12:00:00.000Z',
        source: 'server',
        environment: 'production',
        verified_at: '2026-07-05T12:03:00.000Z',
      });

      await expect(fetchServerEntitlement()).resolves.toMatchObject({
        status: 'evidence',
        acceptance: {
          entitlement: {
            productId: 'memory-only-server-proof',
            isActive: true,
            source: 'server',
            verifiedAt: '2026-07-05T12:03:00.000Z',
          },
        },
      });
      expect(mocks.storage.get(KEY)).toBe(original);
    },
  );

  it('rejects invalid server evidence without changing unreadable cache bytes', async () => {
    mocks.env.appEnvironment = 'production';
    mocks.isSupabaseConfigured = true;
    const malformed = '{not-json';
    mocks.storage.set(KEY, malformed);
    mockServerEntitlement({
      entitlement: 'pro',
      is_active: true,
      period_type: 'normal',
      store: 'app_store',
      product_id: 'invalid-server-proof',
      expires_at: '2026-08-05T12:00:00.000Z',
      will_renew: true,
      original_purchase_at: '2026-06-05T12:00:00.000Z',
      source: 'server',
      environment: 'production',
      verified_at: null,
      updated_at: null,
    });

    await expect(fetchServerEntitlement()).resolves.toEqual({ status: 'failure' });
    expect(mocks.storage.get(KEY)).toBe(malformed);
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
          verifiedAt: '2026-07-05T11:58:00.000Z',
        }),
      ),
    );
    const replacement = cachedEntitlement({
      productId: 'new-app-grant',
      verifiedAt: '2026-07-05T12:00:00.000Z',
    }) as StoredEntitlement;

    const clear = clearStoreEntitlementIfRevenueCatVerifiedEmpty(
      verifiedEmptyEvidence('2026-07-05T11:59:00.000Z'),
    );
    const save = saveVerifiedEntitlement(replacement);
    await Promise.all([clear, save]);

    await expect(loadEntitlement()).resolves.toMatchObject({
      productId: 'new-app-grant',
      isActive: true,
    });
  });

  it('does not let a stale downgrade overwrite a concurrent verified store entitlement', async () => {
    const expiredReverseTrial = cachedEntitlement({
      productId: 'expired-reverse-trial',
      expiresAt: '2026-07-04T12:00:00.000Z',
      verifiedAt: '2026-07-05T11:59:00.000Z',
      storeUserId: 'owner-a',
    }) as StoredEntitlement;
    mocks.storage.set(
      KEY,
      cacheEnvelope(expiredReverseTrial),
    );
    const replacement = cachedEntitlement({
      periodType: 'normal',
      store: 'app_store',
      productId: 'new-store-product',
      expiresAt: null,
      willRenew: true,
      source: 'revenuecat',
      environment: 'sandbox',
      verifiedAt: '2026-07-05T12:00:00.000Z',
    }) as StoredEntitlement;

    const downgrade = downgradeToFree(
      deriveState(expiredReverseTrial, NOW.toISOString()).evidenceIdentity!,
      'owner-a',
    );
    const save = saveVerifiedEntitlement(replacement);
    await Promise.all([downgrade, save]);

    await expect(loadEntitlement()).resolves.toMatchObject({
      productId: 'new-store-product',
      isActive: true,
      willRenew: true,
    });
  });

  it('does not downgrade an identical reverse-trial identity owned by another account', async () => {
    const expiredReverseTrial = cachedEntitlement({
      productId: 'owner-a-expired-reverse',
      expiresAt: '2026-07-04T12:00:00.000Z',
      storeUserId: 'owner-a',
    }) as StoredEntitlement;
    mocks.storage.set(KEY, JSON.stringify(expiredReverseTrial));

    await expect(
      downgradeToFree(
        deriveState(expiredReverseTrial, NOW.toISOString()).evidenceIdentity!,
        'owner-b',
      ),
    ).resolves.toBe(false);
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
      productId: 'owner-a-expired-reverse',
      isActive: true,
    });
  });

  it('migrates a legacy downgrade through the primary v2 key without rewriting legacy bytes', async () => {
    const legacyEntitlement = cachedEntitlement({
      productId: 'expired-legacy-reverse-trial',
      expiresAt: '2026-07-04T12:00:00.000Z',
      storeUserId: 'owner-a',
    });
    const legacy = cacheEnvelope(legacyEntitlement);
    mocks.storage.set(LEGACY_KEY, legacy);

    await downgradeToFree(
      deriveState(legacyEntitlement as StoredEntitlement, NOW.toISOString())
        .evidenceIdentity!,
      'owner-a',
    );

    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      ...legacyEntitlement,
      isActive: false,
      willRenew: false,
    });
    expect(mocks.storage.get(LEGACY_KEY)).toBe(legacy);
  });

  it('keeps unsupported bytes intact when a conditional mutation cannot decode them', async () => {
    const future = cacheEnvelope(cachedEntitlement(), 3);
    mocks.storage.set(KEY, future);

    await expect(downgradeToFree('unsupported-proof', 'owner-a')).resolves.toBe(false);
    await expect(
      clearStoreEntitlementIfRevenueCatVerifiedEmpty(verifiedEmptyEvidence()),
    ).resolves.toBeNull();
    expect(mocks.storage.get(KEY)).toBe(future);
  });

  it.each(
    (['development', 'production'] as const).flatMap((appEnvironment) =>
      (['corrupt', 'key_unavailable', 'write_failed'] as const).map(
        (failure) => [appEnvironment, failure] as const,
      ),
    ),
  )(
    'returns a %s reverse trial in memory across %s persistence failure',
    async (appEnvironment, failure) => {
      mocks.env.appEnvironment = appEnvironment;
      mocks.isSupabaseConfigured = appEnvironment === 'production';
      const original =
        failure === 'corrupt'
          ? '{not-json'
          : compositeCacheEnvelope(
              storeEntitlement({
                productId: 'durable-older-proof',
                isActive: false,
                verifiedAt: '2026-07-05T11:59:00.000Z',
              }),
            );
      mocks.storage.set(KEY, original);
      if (failure === 'key_unavailable') {
        mocks.nextMutationReadError = new Error('PRIVATE_KV_CONTENT_KEY_MISSING');
      } else if (failure === 'write_failed') {
        mocks.nextMutationError = new Error('PRIVATE_KV_WRITE_FAILED');
      }
      if (appEnvironment === 'production') {
        mocks.invoke.mockResolvedValue({
          data: {
            entitlement: {
              entitlement: 'pro',
              is_active: true,
              period_type: 'reverse_trial',
              store: 'app_granted',
              product_id: 'server-reverse-trial',
              expires_at: '2026-07-12T12:00:00.000Z',
              will_renew: false,
              original_purchase_at: NOW.toISOString(),
              source: 'server',
              environment: 'production',
              verified_at: NOW.toISOString(),
            },
          },
          error: null,
        });
      }

      await expect(startReverseTrialOnServer()).resolves.toMatchObject({
        started: true,
        entitlement: {
          isActive: true,
          periodType: 'reverse_trial',
          store: 'app_granted',
          productId:
            appEnvironment === 'production'
              ? 'server-reverse-trial'
              : 'routinekind_pro_reverse_trial_local',
        },
      });
      expect(mocks.storage.get(KEY)).toBe(original);
    },
  );

  it('rejects a malformed server reverse-trial grant instead of caching inactive poison', async () => {
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

    await expect(startReverseTrialOnServer()).rejects.toThrow(
      'INVALID_ENTITLEMENT_CACHE_RECORD',
    );
    expect(mocks.invoke).toHaveBeenCalledWith('subscription-grants', {
      headers: { Authorization: 'Bearer token-a' },
      signal: expect.any(AbortSignal),
      body: { action: 'start_reverse_trial' },
    });
    await expect(loadEntitlement()).resolves.toBeNull();
  });

  it('does not cache an owner-A reverse trial response after an account boundary begins', async () => {
    mocks.isSupabaseConfigured = true;
    mocks.env.appEnvironment = 'production';
    let releaseResponse!: (value: unknown) => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    mocks.invoke.mockImplementationOnce(() => {
      markStarted();
      return new Promise((resolve) => {
        releaseResponse = resolve;
      });
    });

    const starting = startReverseTrialOnServer();
    await started;
    beginAccountGenerationBoundary();
    releaseResponse({
      data: {
        entitlement: {
          entitlement: 'pro',
          is_active: true,
          period_type: 'reverse_trial',
          store: 'app_granted',
          product_id: 'owner-a-reverse-trial',
          expires_at: '2026-07-12T12:00:00.000Z',
          will_renew: false,
          original_purchase_at: '2026-07-05T12:00:00.000Z',
          source: 'server',
          environment: 'production',
          verified_at: '2026-07-05T12:00:00.000Z',
        },
      },
      error: null,
    });

    await expect(starting).rejects.toMatchObject({ kind: 'owner_changed' });
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('reports the reverse-trial grant as superseded when a concurrent paid proof wins', async () => {
    mocks.isSupabaseConfigured = true;
    mocks.env.appEnvironment = 'production';
    let releaseGrant!: (value: unknown) => void;
    let markInvoked!: () => void;
    const invoked = new Promise<void>((resolve) => {
      markInvoked = resolve;
    });
    mocks.invoke.mockImplementationOnce(() => {
      markInvoked();
      return new Promise((resolve) => {
        releaseGrant = resolve;
      });
    });

    const starting = startReverseTrialOnServer(() => {}, 'owner-a');
    await invoked;
    await acceptTrustedRevenueCatEntitlement(
      storeEntitlement({
        productId: 'concurrent-paid-winner',
        verifiedAt: '2026-07-05T12:02:00.000Z',
      }),
    );
    releaseGrant({
      data: {
        entitlement: {
          entitlement: 'pro',
          is_active: true,
          period_type: 'reverse_trial',
          store: 'app_granted',
          product_id: 'superseded-reverse-grant',
          expires_at: '2026-07-12T12:00:00.000Z',
          will_renew: false,
          original_purchase_at: NOW.toISOString(),
          source: 'server',
          environment: 'production',
          verified_at: '2026-07-05T12:03:00.000Z',
        },
      },
      error: null,
    });

    await expect(starting).resolves.toMatchObject({
      started: false,
      entitlement: { productId: 'concurrent-paid-winner', storeUserId: 'owner-a' },
    });
    await expect(loadEntitlement()).resolves.toMatchObject({
      productId: 'concurrent-paid-winner',
    });
  });

  it('recovers a failed T2 proof write without letting a delayed T1 become durable', async () => {
    const t1 = storeEntitlement({
      productId: 't1',
      verifiedAt: '2026-07-05T12:00:00.000Z',
    });
    const t2 = storeEntitlement({
      productId: 't2',
      verifiedAt: '2026-07-05T12:02:00.000Z',
    });
    await acceptTrustedRevenueCatEntitlement(t1);
    mocks.nextMutationError = new Error('PRIVATE_KV_WRITE_FAILED');

    await expect(
      acceptTrustedRevenueCatEntitlement(t2),
    ).resolves.toMatchObject({
      entitlement: { productId: 't2' },
      persisted: false,
    });
    await expect(readEntitlementCache()).resolves.toMatchObject({
      status: 'available',
      entitlement: { productId: 't2' },
    });

    await expect(
      acceptVerifiedEntitlement(
        storeEntitlement({
          productId: 'delayed-t1',
          verifiedAt: '2026-07-05T12:01:00.000Z',
        }),
      ),
    ).resolves.toMatchObject({ entitlement: { productId: 't2' }, persisted: true });

    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    await expect(readEntitlementCache()).resolves.toMatchObject({
      status: 'available',
      entitlement: { productId: 't2' },
    });
  });

  it('recovers a failed T2 empty write before a delayed T1 active proof', async () => {
    await saveVerifiedEntitlement(
      storeEntitlement({
        productId: 'durable-t1',
        verifiedAt: '2026-07-05T12:00:00.000Z',
      }),
    );
    mocks.nextMutationError = new Error('PRIVATE_KV_WRITE_FAILED');

    await expect(
      acceptRevenueCatVerifiedEmpty(
        verifiedEmptyEvidence('2026-07-05T12:02:00.000Z'),
      ),
    ).resolves.toMatchObject({ entitlement: null, persisted: false });
    await expect(readEntitlementCache()).resolves.toMatchObject({
      status: 'absent',
      revenueCatEmpty: { verifiedAt: '2026-07-05T12:02:00.000Z' },
    });

    await acceptVerifiedEntitlement(
      storeEntitlement({
        productId: 'delayed-active-t1',
        verifiedAt: '2026-07-05T12:01:00.000Z',
      }),
    );
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    await expect(readEntitlementCache()).resolves.toMatchObject({
      status: 'absent',
      revenueCatEmpty: { verifiedAt: '2026-07-05T12:02:00.000Z' },
    });
  });

  it('drops a failed-write memory shadow at an account-generation boundary', async () => {
    await acceptTrustedRevenueCatEntitlement(
      storeEntitlement({ productId: 'owner-a-durable-t1' }),
    );
    mocks.nextMutationError = new Error('PRIVATE_KV_WRITE_FAILED');
    await acceptTrustedRevenueCatEntitlement(
      storeEntitlement({
        productId: 'owner-a-memory-t2',
        verifiedAt: '2026-07-05T12:02:00.000Z',
      }),
    );
    await expect(loadEntitlement()).resolves.toMatchObject({
      productId: 'owner-a-memory-t2',
    });

    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    await expect(loadEntitlement()).resolves.toMatchObject({
      productId: 'owner-a-durable-t1',
    });
  });

  it('fails closed after the tombstone-first crash window and never revives v1', async () => {
    const tombstone = {
      tier: 'pro',
      isActive: false,
      periodType: null,
      store: null,
      productId: null,
      expiresAt: null,
      willRenew: false,
      grantedAt: null,
      source: 'local_cache',
      environment: null,
      managementUrl: null,
      verifiedAt: '2026-07-05T12:02:00.000Z',
      offeringId: null,
      packageId: null,
      storeUserId: null,
      priceLabel: null,
    };
    mocks.storage.set(KEY, JSON.stringify(tombstone));
    mocks.storage.set(LEGACY_KEY, JSON.stringify(cachedEntitlement()));

    await expect(readEntitlementCache()).resolves.toEqual({
      status: 'unavailable',
      entitlement: null,
    });
  });

  it('treats a v1 watermark with a missing v2 proof as authoritative absence', async () => {
    const watermark = verifiedEmptyEvidence('2026-07-05T12:02:00.000Z');
    mocks.storage.set(
      REVENUECAT_EMPTY_KEY,
      JSON.stringify({
        version: 2,
        revenueCatEmpty: watermark,
        trustedRevenueCatProof: null,
      }),
    );
    await expect(readEntitlementCache()).resolves.toEqual({
      status: 'absent',
      entitlement: null,
      revenueCatEmpty: watermark,
    });
  });

  it('ignores an account-A watermark when a rollback build left account-B proof in v2', async () => {
    mocks.env.appEnvironment = 'production';
    mocks.storage.set(
      REVENUECAT_EMPTY_KEY,
      JSON.stringify({
        version: 2,
        revenueCatEmpty: verifiedEmptyEvidence('2026-07-05T12:03:00.000Z'),
        trustedRevenueCatProof: trustedRevenueCatMarkerFor(
          storeEntitlement({
            productId: 'owner-b-proof',
            storeUserId: 'owner-b',
            verifiedAt: '2026-07-05T12:01:00.000Z',
          }),
        ),
      }),
    );
    mocks.storage.set(
      KEY,
      JSON.stringify(
        storeEntitlement({
          productId: 'owner-b-proof',
          storeUserId: 'owner-b',
          verifiedAt: '2026-07-05T12:01:00.000Z',
        }),
      ),
    );

    await expect(readEntitlementCache()).resolves.toMatchObject({
      status: 'available',
      entitlement: { productId: 'owner-b-proof', storeUserId: 'owner-b' },
    });
  });

  it('retains inactive store evidence while a live app grant wins and blocks delayed resurrection', async () => {
    mocks.env.appEnvironment = 'production';
    const grant = cachedEntitlement({
      productId: 'app-grant-t1',
      environment: 'production',
      storeUserId: 'owner-a',
      expiresAt: '2026-07-05T12:10:00.000Z',
      verifiedAt: '2026-07-05T12:01:00.000Z',
    }) as StoredEntitlement;
    await saveVerifiedEntitlement(grant);
    await acceptVerifiedEntitlement(
      storeEntitlement({
        productId: 'inactive-store-t3',
        isActive: false,
        verifiedAt: '2026-07-05T12:03:00.000Z',
      }),
    );
    await expect(loadEntitlement()).resolves.toMatchObject({ productId: 'app-grant-t1' });
    expect(JSON.parse(mocks.storage.get(REVENUECAT_EMPTY_KEY) ?? '{}')).toMatchObject({
      revenueCatEmpty: { verifiedAt: '2026-07-05T12:03:00.000Z' },
    });

    await acceptVerifiedEntitlement(
      storeEntitlement({
        productId: 'delayed-active-store-t2',
        verifiedAt: '2026-07-05T12:02:00.000Z',
      }),
    );
    const atExpiry = resolveEntitlementCacheRead(
      await readEntitlementCache(),
      '2026-07-05T12:10:00.000Z',
      'production',
    );
    expect(atExpiry).toMatchObject({ isPro: false, productId: null });

    await acceptVerifiedEntitlement(
      storeEntitlement({
        productId: 'active-store-t4',
        verifiedAt: '2026-07-05T12:04:00.000Z',
      }),
    );
    await expect(loadEntitlement()).resolves.toMatchObject({
      productId: 'active-store-t4',
      isActive: true,
    });
  });

  it('treats a cold pre-marker RevenueCat proof as uncertainty, never offline access', async () => {
    const proof = storeEntitlement({ productId: 'pre-marker-proof' });
    mocks.storage.set(KEY, JSON.stringify(proof));

    await expect(
      readEntitlementCache({ expectedStoreUserId: 'owner-a' }),
    ).resolves.toEqual({ status: 'unavailable', entitlement: null });
  });

  it('writes the proof before its trusted marker and restores it after a cold restart', async () => {
    const proof = storeEntitlement({ productId: 'trusted-cold-proof' });
    await expect(
      acceptTrustedRevenueCatEntitlement(proof),
    ).resolves.toMatchObject({ persisted: true, entitlement: { productId: 'trusted-cold-proof' } });

    expect(mocks.writeKeys.slice(-2)).toEqual([KEY, LEGACY_KEY]);
    expect(JSON.parse(mocks.storage.get(LEGACY_KEY) ?? '{}')).toMatchObject({
      version: 2,
      revenueCatEmpty: null,
      trustedRevenueCatProof: {
        storeUserId: 'owner-a',
        proofIdentity: trustedRevenueCatMarkerFor(proof)?.proofIdentity,
      },
    });
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    await expect(
      readEntitlementCache({ expectedStoreUserId: 'owner-a' }),
    ).resolves.toMatchObject({
      status: 'available',
      entitlement: { productId: 'trusted-cold-proof' },
    });
  });

  it.each([
    ['owner', { storeUserId: 'owner-b' }],
    ['proof identity', { proofIdentity: '["different-proof"]' }],
  ])('rejects a trusted marker with a mismatched %s', async (_name, markerOverride) => {
    const proof = storeEntitlement({ productId: 'marker-mismatch-proof' });
    const marker = trustedRevenueCatMarkerFor(proof);
    mocks.storage.set(KEY, JSON.stringify(proof));
    mocks.storage.set(
      LEGACY_KEY,
      JSON.stringify({
        version: 2,
        revenueCatEmpty: null,
        trustedRevenueCatProof: { ...marker, ...markerOverride },
      }),
    );

    await expect(readEntitlementCache()).resolves.toEqual({
      status: 'unavailable',
      entitlement: null,
    });
  });

  it('never lets generic or server acceptance mint a trusted RevenueCat marker', async () => {
    await acceptVerifiedEntitlement(storeEntitlement({ productId: 'generic-rc-proof' }));
    expect(mocks.storage.has(LEGACY_KEY)).toBe(false);
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    await expect(readEntitlementCache()).resolves.toEqual({
      status: 'unavailable',
      entitlement: null,
    });

    await clearEntitlement();
    const serverProof = storeEntitlement({
      productId: 'server-proof',
      source: 'server',
    });
    await acceptVerifiedEntitlement(serverProof);
    expect(mocks.storage.has(LEGACY_KEY)).toBe(false);
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    await expect(readEntitlementCache()).resolves.toMatchObject({
      status: 'available',
      entitlement: { productId: 'server-proof', source: 'server' },
    });
  });

  it('fails closed after a proof-first crash before the trusted marker write', async () => {
    const proof = storeEntitlement({ productId: 'proof-without-marker-after-crash' });
    mocks.nextMutationError = new Error('PRIVATE_KV_WRITE_FAILED');
    mocks.nextMutationErrorKey = LEGACY_KEY;
    mocks.nextMutationErrorAttempt = 2;

    await expect(
      acceptTrustedRevenueCatEntitlement(proof),
    ).resolves.toMatchObject({
      persisted: false,
      entitlement: { productId: 'proof-without-marker-after-crash' },
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
      productId: 'proof-without-marker-after-crash',
    });
    expect(mocks.storage.has(LEGACY_KEY)).toBe(false);
    await expect(readEntitlementCache()).resolves.toMatchObject({
      status: 'available',
      entitlement: { productId: 'proof-without-marker-after-crash' },
    });

    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    await expect(readEntitlementCache()).resolves.toEqual({
      status: 'unavailable',
      entitlement: null,
    });
  });

  it('preclears marker P before trusted inactive Q so rollback cannot replay P', async () => {
    const proofP = storeEntitlement({
      productId: 'trusted-active-p',
      verifiedAt: '2026-07-05T12:01:00.000Z',
    });
    await acceptTrustedRevenueCatEntitlement(proofP);
    mocks.mutationAttempts.clear();
    mocks.nextMutationError = new Error('PRIVATE_KV_WRITE_FAILED');
    mocks.nextMutationErrorKey = LEGACY_KEY;
    mocks.nextMutationErrorAttempt = 2;

    await expect(
      acceptTrustedRevenueCatEntitlement(
        storeEntitlement({
          productId: 'trusted-inactive-q',
          isActive: false,
          willRenew: false,
          verifiedAt: '2026-07-05T12:02:00.000Z',
        }),
      ),
    ).resolves.toMatchObject({
      persisted: false,
      entitlement: { productId: 'trusted-inactive-q', isActive: false },
    });
    expect(mocks.storage.has(LEGACY_KEY)).toBe(false);

    mocks.storage.set(KEY, JSON.stringify(proofP));
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    await expect(readEntitlementCache()).resolves.toEqual({
      status: 'unavailable',
      entitlement: null,
    });
  });

  it('does not launder a newer generic RevenueCat winner with an older trusted marker', async () => {
    const newerGeneric = storeEntitlement({
      productId: 'generic-t3',
      verifiedAt: '2026-07-05T12:03:00.000Z',
    });
    await acceptVerifiedEntitlement(newerGeneric);

    await expect(
      acceptTrustedRevenueCatEntitlement(
        storeEntitlement({
          productId: 'trusted-t2',
          verifiedAt: '2026-07-05T12:02:00.000Z',
        }),
      ),
    ).resolves.toMatchObject({ entitlement: { productId: 'generic-t3' } });
    expect(mocks.storage.has(LEGACY_KEY)).toBe(false);

    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    await expect(readEntitlementCache()).resolves.toEqual({
      status: 'unavailable',
      entitlement: null,
    });
  });

  it('migrates a cold unmarked legacy RevenueCat proof after an explicit trusted refresh', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify(
        storeEntitlement({
          productId: 'legacy-unmarked-t3',
          verifiedAt: '2026-07-05T12:03:00.000Z',
        }),
      ),
    );
    await expect(readEntitlementCache()).resolves.toEqual({
      status: 'unavailable',
      entitlement: null,
    });

    await expect(
      acceptTrustedRevenueCatEntitlement(
        storeEntitlement({
          productId: 'older-than-unmarked-v2',
          verifiedAt: '2026-07-05T12:00:00.000Z',
        }),
      ),
    ).rejects.toThrow('ENTITLEMENT_ACTIVE_PROVIDER_BARRIER');

    await expect(
      acceptTrustedRevenueCatEntitlement(
        storeEntitlement({
          productId: 'trusted-refresh-t4',
          verifiedAt: '2026-07-05T12:04:00.000Z',
        }),
      ),
    ).resolves.toMatchObject({
      persisted: true,
      entitlement: { productId: 'trusted-refresh-t4' },
    });
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    await expect(readEntitlementCache()).resolves.toMatchObject({
      status: 'available',
      entitlement: { productId: 'trusted-refresh-t4' },
    });
  });

  it('clears a superseded marker so rollback bytes cannot replay its old proof', async () => {
    const trusted = storeEntitlement({
      productId: 'trusted-marker-p',
      verifiedAt: '2026-07-05T12:01:00.000Z',
    });
    await acceptTrustedRevenueCatEntitlement(trusted);
    expect(mocks.storage.has(LEGACY_KEY)).toBe(true);

    await acceptVerifiedEntitlement(
      storeEntitlement({
        productId: 'server-winner',
        source: 'server',
        verifiedAt: '2026-07-05T12:04:00.000Z',
      }),
    );
    expect(mocks.storage.has(LEGACY_KEY)).toBe(false);

    // Simulate a rollback build rewriting the old SDK-shaped proof into v2.
    mocks.storage.set(KEY, JSON.stringify(trusted));
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    await expect(readEntitlementCache()).resolves.toEqual({
      status: 'unavailable',
      entitlement: null,
    });
  });

  it('aborts a non-RC replacement before v2 when clearing its old trusted marker fails', async () => {
    const trusted = storeEntitlement({
      productId: 'trusted-p-before-clear-failure',
      verifiedAt: '2026-07-05T12:01:00.000Z',
    });
    await acceptTrustedRevenueCatEntitlement(trusted);
    const markerBytes = mocks.storage.get(LEGACY_KEY);
    mocks.nextMutationError = new Error('PRIVATE_KV_WRITE_FAILED');
    mocks.nextMutationErrorKey = LEGACY_KEY;

    await expect(
      acceptVerifiedEntitlement(
        storeEntitlement({
          productId: 'server-s-not-durable',
          source: 'server',
          verifiedAt: '2026-07-05T12:04:00.000Z',
        }),
      ),
    ).resolves.toMatchObject({
      entitlement: { productId: 'server-s-not-durable' },
      persisted: false,
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
      productId: 'trusted-p-before-clear-failure',
    });
    expect(mocks.storage.get(LEGACY_KEY)).toBe(markerBytes);

    // A rollback rewrite of P cannot turn S into a marker-replay state because
    // S was never committed. Forward read sees the original trusted pair.
    mocks.storage.set(KEY, JSON.stringify(trusted));
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    await expect(readEntitlementCache()).resolves.toMatchObject({
      status: 'available',
      entitlement: { productId: 'trusted-p-before-clear-failure' },
    });
  });

  it('recovers a marker-only sidecar after a rollback build removes v2', async () => {
    await acceptTrustedRevenueCatEntitlement(
      storeEntitlement({
        productId: 'trusted-before-v2-removal',
        verifiedAt: '2026-07-05T12:01:00.000Z',
      }),
    );
    mocks.storage.delete(KEY);
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    await expect(readEntitlementCache()).resolves.toEqual({
      status: 'unavailable',
      entitlement: null,
    });

    await expect(
      acceptTrustedRevenueCatEntitlement(
        storeEntitlement({
          productId: 'older-than-marker-only',
          verifiedAt: '2026-07-05T12:00:00.000Z',
        }),
      ),
    ).rejects.toThrow('ENTITLEMENT_ACTIVE_PROVIDER_BARRIER');

    await expect(
      acceptTrustedRevenueCatEntitlement(
        storeEntitlement({
          productId: 'trusted-recreated-v2',
          verifiedAt: '2026-07-05T12:04:00.000Z',
        }),
      ),
    ).resolves.toMatchObject({
      entitlement: { productId: 'trusted-recreated-v2' },
      persisted: true,
    });
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    await expect(readEntitlementCache()).resolves.toMatchObject({
      status: 'available',
      entitlement: { productId: 'trusted-recreated-v2' },
    });
  });

  it('recovers a marker-only sidecar through an exact trusted proof retry', async () => {
    const proof = storeEntitlement({
      productId: 'marker-only-exact-proof',
      verifiedAt: '2026-07-05T12:01:00.000Z',
    });
    await acceptTrustedRevenueCatEntitlement(proof);
    mocks.storage.delete(KEY);
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();

    await expect(acceptTrustedRevenueCatEntitlement(proof)).resolves.toMatchObject({
      persisted: true,
      entitlement: { productId: 'marker-only-exact-proof' },
    });
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    await expect(readEntitlementCache()).resolves.toMatchObject({
      status: 'available',
      entitlement: { productId: 'marker-only-exact-proof' },
    });
  });

  it('keeps older W0 uncertain when rollback removes newer active P1 behind its marker', async () => {
    await acceptRevenueCatVerifiedEmpty({
      verifiedAt: '2026-07-05T12:00:00.000Z',
      storeUserId: 'owner-a',
    });
    const p1 = storeEntitlement({
      productId: 'active-p1-behind-w0',
      verifiedAt: '2026-07-05T12:01:00.000Z',
    });
    await acceptTrustedRevenueCatEntitlement(p1);
    mocks.storage.delete(KEY);
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();

    await expect(readEntitlementCache()).resolves.toEqual({
      status: 'unavailable',
      entitlement: null,
    });
    await expect(
      acceptTrustedRevenueCatEntitlement(
        storeEntitlement({
          productId: 'older-than-active-marker',
          verifiedAt: '2026-07-05T12:00:30.000Z',
        }),
      ),
    ).rejects.toThrow('ENTITLEMENT_ACTIVE_PROVIDER_BARRIER');
    await expect(readEntitlementCache()).resolves.toEqual({
      status: 'unavailable',
      entitlement: null,
    });
    await expect(acceptTrustedRevenueCatEntitlement(p1)).resolves.toMatchObject({
      persisted: true,
      entitlement: { productId: 'active-p1-behind-w0' },
    });
  });

  it('lets an expired trusted marker defeat equal-time rollback server access', async () => {
    const expiringQ3 = storeEntitlement({
      productId: 'expiring-trusted-q3',
      periodType: 'trial',
      expiresAt: '2026-07-05T12:02:00.000Z',
      willRenew: false,
      verifiedAt: '2026-07-05T12:01:00.000Z',
    });
    await acceptTrustedRevenueCatEntitlement(expiringQ3);

    mocks.storage.set(
      KEY,
      JSON.stringify(
        storeEntitlement({
          productId: 'rollback-server-s3',
          source: 'server',
          verifiedAt: '2026-07-05T12:01:00.000Z',
        }),
      ),
    );
    vi.setSystemTime(new Date('2026-07-05T12:03:00.000Z'));
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();

    await expect(readEntitlementCache()).resolves.toEqual({
      status: 'unavailable',
      entitlement: null,
    });
    await expect(
      acceptTrustedRevenueCatEntitlement(
        storeEntitlement({
          productId: 'delayed-active-r2',
          verifiedAt: '2026-07-05T12:00:30.000Z',
        }),
      ),
    ).resolves.toMatchObject({ entitlement: null, persisted: true });
    await expect(readEntitlementCache()).resolves.toMatchObject({
      status: 'absent',
      entitlement: null,
      revenueCatEmpty: { verifiedAt: '2026-07-05T12:01:00.000Z' },
    });
  });

  it.each(['active', 'empty'] as const)(
    'repairs a tombstone-first crash with later trusted %s evidence',
    async (repairKind) => {
      await acceptTrustedRevenueCatEntitlement(
        storeEntitlement({
          productId: 'trusted-before-empty-crash',
          verifiedAt: '2026-07-05T12:01:00.000Z',
        }),
      );
      mocks.mutationAttempts.clear();
      mocks.nextMutationError = new Error('PRIVATE_KV_WRITE_FAILED');
      mocks.nextMutationErrorKey = LEGACY_KEY;
      mocks.nextMutationErrorAttempt = 2;
      await expect(
        acceptRevenueCatVerifiedEmpty({
          verifiedAt: '2026-07-05T12:02:00.000Z',
          storeUserId: 'owner-a',
        }),
      ).resolves.toMatchObject({ persisted: false, entitlement: null });
      expect(mocks.storage.has(KEY)).toBe(true);
      expect(mocks.storage.has(LEGACY_KEY)).toBe(false);

      beginAccountGenerationBoundary();
      endAccountGenerationBoundary();
      await expect(readEntitlementCache()).resolves.toEqual({
        status: 'unavailable',
        entitlement: null,
      });

      if (repairKind === 'active') {
        await expect(
          acceptTrustedRevenueCatEntitlement(
            storeEntitlement({
              productId: 'trusted-active-repair-t3',
              verifiedAt: '2026-07-05T12:03:00.000Z',
            }),
          ),
        ).resolves.toMatchObject({ persisted: true });
      } else {
        await expect(
          acceptRevenueCatVerifiedEmpty({
            verifiedAt: '2026-07-05T12:03:00.000Z',
            storeUserId: 'owner-a',
          }),
        ).resolves.toMatchObject({ persisted: true });
      }
      beginAccountGenerationBoundary();
      endAccountGenerationBoundary();
      await expect(readEntitlementCache()).resolves.toMatchObject(
        repairKind === 'active'
          ? {
              status: 'available',
              entitlement: { productId: 'trusted-active-repair-t3' },
            }
          : {
              status: 'absent',
              entitlement: null,
              revenueCatEmpty: { verifiedAt: '2026-07-05T12:03:00.000Z' },
            },
      );
    },
  );

  it.each([false, true])(
    'keeps a crashed empty T3 ahead of delayed trusted T2 (older watermark: %s)',
    async (withOlderWatermark) => {
      if (withOlderWatermark) {
        await acceptRevenueCatVerifiedEmpty({
          verifiedAt: '2026-07-05T12:00:00.000Z',
          storeUserId: 'owner-a',
        });
      }
      await acceptTrustedRevenueCatEntitlement(
        storeEntitlement({
          productId: 'active-p1-before-empty-crash',
          verifiedAt: '2026-07-05T12:01:00.000Z',
        }),
      );
      mocks.mutationAttempts.clear();
      mocks.nextMutationError = new Error('PRIVATE_KV_WRITE_FAILED');
      mocks.nextMutationErrorKey = LEGACY_KEY;
      mocks.nextMutationErrorAttempt = 2;
      await expect(
        acceptRevenueCatVerifiedEmpty({
          verifiedAt: '2026-07-05T12:03:00.000Z',
          storeUserId: 'owner-a',
        }),
      ).resolves.toMatchObject({ persisted: false, entitlement: null });

      beginAccountGenerationBoundary();
      endAccountGenerationBoundary();
      await expect(readEntitlementCache()).resolves.toEqual({
        status: 'unavailable',
        entitlement: null,
      });
      await expect(
        acceptTrustedRevenueCatEntitlement(
          storeEntitlement({
            productId: 'delayed-active-t2',
            verifiedAt: '2026-07-05T12:02:00.000Z',
          }),
        ),
      ).resolves.toMatchObject({ entitlement: null, persisted: true });
      beginAccountGenerationBoundary();
      endAccountGenerationBoundary();
      await expect(readEntitlementCache()).resolves.toMatchObject({
        status: 'absent',
        entitlement: null,
        revenueCatEmpty: { verifiedAt: '2026-07-05T12:03:00.000Z' },
      });

      await expect(
        acceptTrustedRevenueCatEntitlement(
          storeEntitlement({
            productId: 'newer-active-t4',
            verifiedAt: '2026-07-05T12:04:00.000Z',
          }),
        ),
      ).resolves.toMatchObject({
        persisted: true,
        entitlement: { productId: 'newer-active-t4' },
      });
    },
  );

  it('keeps a durable unmarked inactive Q3 ahead of delayed trusted active R2', async () => {
    await acceptTrustedRevenueCatEntitlement(
      storeEntitlement({
        productId: 'trusted-active-p1',
        verifiedAt: '2026-07-05T12:01:00.000Z',
      }),
    );
    mocks.mutationAttempts.clear();
    mocks.nextMutationError = new Error('PRIVATE_KV_WRITE_FAILED');
    mocks.nextMutationErrorKey = LEGACY_KEY;
    mocks.nextMutationErrorAttempt = 2;
    await acceptTrustedRevenueCatEntitlement(
      storeEntitlement({
        productId: 'durable-inactive-q3',
        isActive: false,
        willRenew: false,
        verifiedAt: '2026-07-05T12:03:00.000Z',
      }),
    );
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    await expect(readEntitlementCache()).resolves.toEqual({
      status: 'unavailable',
      entitlement: null,
    });

    await expect(
      acceptTrustedRevenueCatEntitlement(
        storeEntitlement({
          productId: 'delayed-active-r2',
          verifiedAt: '2026-07-05T12:02:00.000Z',
        }),
      ),
    ).resolves.toMatchObject({ entitlement: null, persisted: true });
    await expect(
      acceptTrustedRevenueCatEntitlement(
        storeEntitlement({
          productId: 'newer-active-r4',
          verifiedAt: '2026-07-05T12:04:00.000Z',
        }),
      ),
    ).resolves.toMatchObject({
      entitlement: { productId: 'newer-active-r4' },
      persisted: true,
    });
  });

  it('allows an exact trusted retry to finish the marker phase for durable Q3', async () => {
    const q3 = storeEntitlement({
      productId: 'exact-retry-q3',
      verifiedAt: '2026-07-05T12:03:00.000Z',
    });
    mocks.nextMutationError = new Error('PRIVATE_KV_WRITE_FAILED');
    mocks.nextMutationErrorKey = LEGACY_KEY;
    mocks.nextMutationErrorAttempt = 2;
    await expect(acceptTrustedRevenueCatEntitlement(q3)).resolves.toMatchObject({
      persisted: false,
      entitlement: { productId: 'exact-retry-q3' },
    });
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    await expect(readEntitlementCache()).resolves.toEqual({
      status: 'unavailable',
      entitlement: null,
    });

    await expect(
      acceptTrustedRevenueCatEntitlement(
        storeEntitlement({
          productId: 'older-than-q3',
          verifiedAt: '2026-07-05T12:02:00.000Z',
        }),
      ),
    ).rejects.toThrow('ENTITLEMENT_ACTIVE_PROVIDER_BARRIER');
    await expect(readEntitlementCache()).resolves.toEqual({
      status: 'unavailable',
      entitlement: null,
    });

    await expect(acceptTrustedRevenueCatEntitlement(q3)).resolves.toMatchObject({
      persisted: true,
      entitlement: { productId: 'exact-retry-q3' },
    });
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    await expect(readEntitlementCache()).resolves.toMatchObject({
      status: 'available',
      entitlement: { productId: 'exact-retry-q3' },
    });
  });

  it('preserves a newer volatile R4 when delayed R2 is blocked by durable active Q3', async () => {
    const q3 = storeEntitlement({
      productId: 'durable-active-q3',
      verifiedAt: '2026-07-05T12:03:00.000Z',
    });
    mocks.nextMutationError = new Error('PRIVATE_KV_WRITE_FAILED');
    mocks.nextMutationErrorKey = LEGACY_KEY;
    mocks.nextMutationErrorAttempt = 2;
    await acceptTrustedRevenueCatEntitlement(q3);
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    mocks.mutationAttempts.clear();
    mocks.nextMutationError = new Error('PRIVATE_KV_WRITE_FAILED');
    mocks.nextMutationErrorKey = KEY;
    mocks.nextMutationErrorAttempt = 1;
    await expect(
      acceptTrustedRevenueCatEntitlement(
        storeEntitlement({
          productId: 'volatile-newer-r4',
          verifiedAt: '2026-07-05T12:04:00.000Z',
        }),
      ),
    ).resolves.toMatchObject({
      entitlement: { productId: 'volatile-newer-r4' },
      persisted: false,
    });

    await expect(
      acceptTrustedRevenueCatEntitlement(
        storeEntitlement({
          productId: 'delayed-older-r2',
          verifiedAt: '2026-07-05T12:02:00.000Z',
        }),
      ),
    ).resolves.toMatchObject({
      entitlement: { productId: 'volatile-newer-r4' },
      persisted: true,
    });
    await expect(loadEntitlement()).resolves.toMatchObject({
      productId: 'volatile-newer-r4',
    });
  });

  it('preserves an independent memory-only app grant while active Q3 blocks R2', async () => {
    const q3 = storeEntitlement({
      productId: 'active-q3-before-appgrant',
      verifiedAt: '2026-07-05T12:03:00.000Z',
    });
    mocks.nextMutationError = new Error('PRIVATE_KV_WRITE_FAILED');
    mocks.nextMutationErrorKey = LEGACY_KEY;
    mocks.nextMutationErrorAttempt = 2;
    await acceptTrustedRevenueCatEntitlement(q3);
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();

    await expect(
      acceptVerifiedEntitlement(
        cachedEntitlement({
          productId: 'independent-memory-appgrant',
          environment: 'production',
          storeUserId: 'owner-a',
          expiresAt: '2026-07-05T12:02:00.000Z',
          verifiedAt: '2026-07-05T12:01:00.000Z',
        }) as StoredEntitlement,
      ),
    ).resolves.toMatchObject({
      entitlement: { productId: 'independent-memory-appgrant' },
      persisted: false,
    });
    await expect(readEntitlementCache()).resolves.toMatchObject({
      status: 'available',
      entitlement: { productId: 'independent-memory-appgrant' },
    });
    await expect(
      acceptTrustedRevenueCatEntitlement(
        storeEntitlement({
          productId: 'blocked-r2-after-appgrant',
          verifiedAt: '2026-07-05T12:02:00.000Z',
        }),
      ),
    ).resolves.toMatchObject({
      entitlement: { productId: 'independent-memory-appgrant' },
      persisted: false,
    });

    vi.setSystemTime(new Date('2026-07-05T12:03:00.000Z'));
    await expect(readEntitlementCache()).resolves.toEqual({
      status: 'unavailable',
      entitlement: null,
    });

    await expect(acceptTrustedRevenueCatEntitlement(q3)).resolves.toMatchObject({
      persisted: true,
      entitlement: { productId: 'active-q3-before-appgrant' },
    });
  });

  it('rejects an owner-A app grant when owner B is the expected account', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify(
        cachedEntitlement({
          productId: 'owner-a-appgrant',
          environment: 'production',
          storeUserId: 'owner-a',
        }),
      ),
    );
    await expect(
      readEntitlementCache({ expectedStoreUserId: 'owner-b' }),
    ).resolves.toEqual({ status: 'unavailable', entitlement: null });
  });

  it('discards a newer owner-A app grant before accepting owner-B empty evidence', async () => {
    mocks.env.appEnvironment = 'production';
    await acceptVerifiedEntitlement(
      cachedEntitlement({
        productId: 'owner-a-newer-appgrant',
        environment: 'production',
        storeUserId: 'owner-a',
        verifiedAt: '2026-07-05T12:04:00.000Z',
      }) as StoredEntitlement,
    );
    await expect(
      acceptRevenueCatVerifiedEmpty({
        verifiedAt: '2026-07-05T12:02:00.000Z',
        storeUserId: 'owner-b',
      }),
    ).resolves.toMatchObject({
      entitlement: null,
      revenueCatEmpty: { storeUserId: 'owner-b' },
    });
  });

  it('restores owner-B verified empty from its ownerless tombstone only for owner B', async () => {
    await acceptRevenueCatVerifiedEmpty({
      verifiedAt: '2026-07-05T12:02:00.000Z',
      storeUserId: 'owner-b',
    });
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();

    await expect(
      readEntitlementCache({ expectedStoreUserId: 'owner-b' }),
    ).resolves.toMatchObject({
      status: 'absent',
      entitlement: null,
      revenueCatEmpty: { storeUserId: 'owner-b' },
    });
    await expect(
      readEntitlementCache({ expectedStoreUserId: 'owner-a' }),
    ).resolves.toEqual({ status: 'unavailable', entitlement: null });
  });

  it('discards a newer generic owner-A proof before accepting an older trusted owner-B proof', async () => {
    await acceptVerifiedEntitlement(
      storeEntitlement({
        productId: 'owner-a-generic-t4',
        storeUserId: 'owner-a',
        verifiedAt: '2026-07-05T12:04:00.000Z',
      }),
    );
    await expect(
      acceptTrustedRevenueCatEntitlement(
        storeEntitlement({
          productId: 'owner-b-trusted-t2',
          storeUserId: 'owner-b',
          verifiedAt: '2026-07-05T12:02:00.000Z',
        }),
      ),
    ).resolves.toMatchObject({
      entitlement: { productId: 'owner-b-trusted-t2', storeUserId: 'owner-b' },
      persisted: true,
    });
  });

  it.each([
    ['store-first', '2026-07-05T12:03:00.000Z'],
    ['grant-first', '2026-07-05T12:03:00.000Z'],
    ['store-first', '2026-07-05T12:02:00.000Z'],
    ['grant-first', '2026-07-05T12:02:00.000Z'],
  ] as const)(
    'keeps a live paid store proof when an inactive app grant arrives %s at %s',
    async (order, grantVerifiedAt) => {
      mocks.env.appEnvironment = 'production';
      const store = storeEntitlement({
        productId: 'paid-store-t2',
        verifiedAt: '2026-07-05T12:02:00.000Z',
      });
      const inactiveGrant = cachedEntitlement({
        productId: 'inactive-grant',
        isActive: false,
        environment: 'production',
        storeUserId: 'owner-a',
        verifiedAt: grantVerifiedAt,
      }) as StoredEntitlement;
      const first = order === 'store-first' ? store : inactiveGrant;
      const second = order === 'store-first' ? inactiveGrant : store;
      await acceptVerifiedEntitlement(first);
      await expect(acceptVerifiedEntitlement(second)).resolves.toMatchObject({
        entitlement: { productId: 'paid-store-t2', isActive: true },
      });
      await expect(loadEntitlement()).resolves.toMatchObject({
        productId: 'paid-store-t2',
        isActive: true,
      });
    },
  );

  it.each(['store-first', 'grant-first'] as const)(
    'lets a live app grant beat a 72-hour-stale store proof when it arrives %s',
    async (order) => {
      mocks.env.appEnvironment = 'production';
      const staleStore = storeEntitlement({
        productId: 'stale-store-proof',
        verifiedAt: '2026-07-02T11:59:59.999Z',
      });
      const liveGrant = cachedEntitlement({
        productId: 'live-independent-grant',
        environment: 'production',
        storeUserId: 'owner-a',
        verifiedAt: '2026-07-05T12:00:00.000Z',
      }) as StoredEntitlement;
      const first = order === 'store-first' ? staleStore : liveGrant;
      const second = order === 'store-first' ? liveGrant : staleStore;
      await acceptVerifiedEntitlement(first);
      await expect(acceptVerifiedEntitlement(second)).resolves.toMatchObject({
        entitlement: { productId: 'live-independent-grant' },
      });
      beginAccountGenerationBoundary();
      endAccountGenerationBoundary();
      await expect(
        readEntitlementCache({ expectedStoreUserId: 'owner-a' }),
      ).resolves.toMatchObject({
        status: 'available',
        entitlement: { productId: 'live-independent-grant' },
      });
    },
  );

  it('keeps within-window live store authority above a live app grant', async () => {
    mocks.env.appEnvironment = 'production';
    const grant = cachedEntitlement({
      productId: 'live-grant',
      environment: 'production',
      storeUserId: 'owner-a',
      verifiedAt: '2026-07-05T12:01:00.000Z',
    }) as StoredEntitlement;
    await acceptVerifiedEntitlement(grant);
    await expect(
      acceptVerifiedEntitlement(
        storeEntitlement({
          productId: 'fresh-store',
          verifiedAt: '2026-07-05T12:00:00.000Z',
        }),
      ),
    ).resolves.toMatchObject({ entitlement: { productId: 'fresh-store' } });
  });

  it.each([0, 1])('does not authorize an unmarked RevenueCat legacy v%s proof', async (version) => {
    const proof = storeEntitlement({ productId: `legacy-v${version}-rc` });
    mocks.storage.set(LEGACY_KEY, version === 0 ? JSON.stringify(proof) : cacheEnvelope(proof));

    await expect(readEntitlementCache({ expectedStoreUserId: 'owner-a' })).resolves.toEqual({
      status: 'unavailable',
      entitlement: null,
    });
  });

  it.each([
    [0, 'exact'],
    [0, 'newer'],
    [1, 'exact'],
    [1, 'newer'],
  ] as const)(
    'repairs an unmarked RevenueCat legacy v%s proof through a %s trusted refresh',
    async (version, repairKind) => {
      const legacy = storeEntitlement({
        productId: `unmarked-legacy-v${version}`,
        verifiedAt: '2026-07-05T12:03:00.000Z',
      });
      mocks.storage.set(
        LEGACY_KEY,
        version === 0 ? JSON.stringify(legacy) : cacheEnvelope(legacy),
      );
      await expect(readEntitlementCache({ expectedStoreUserId: 'owner-a' })).resolves.toEqual({
        status: 'unavailable',
        entitlement: null,
      });

      await expect(
        acceptTrustedRevenueCatEntitlement(
          storeEntitlement({
            productId: `older-than-legacy-v${version}`,
            verifiedAt: '2026-07-05T12:02:00.000Z',
          }),
        ),
      ).rejects.toThrow('ENTITLEMENT_ACTIVE_PROVIDER_BARRIER');
      await expect(readEntitlementCache({ expectedStoreUserId: 'owner-a' })).resolves.toEqual({
        status: 'unavailable',
        entitlement: null,
      });

      const repair =
        repairKind === 'exact'
          ? legacy
          : storeEntitlement({
              productId: `trusted-refresh-v${version}`,
              verifiedAt: '2026-07-05T12:04:00.000Z',
            });
      await expect(
        acceptTrustedRevenueCatEntitlement(repair),
      ).resolves.toMatchObject({
        persisted: true,
        entitlement: { productId: repair.productId },
      });
      beginAccountGenerationBoundary();
      endAccountGenerationBoundary();
      await expect(readEntitlementCache({ expectedStoreUserId: 'owner-a' })).resolves.toMatchObject({
        status: 'available',
        entitlement: { productId: repair.productId },
      });
    },
  );

  it('rejects a store-backed reverse_trial proof before app-grant lifecycle handling', async () => {
    mocks.env.appEnvironment = 'production';
    await expect(
      acceptVerifiedEntitlement(
        storeEntitlement({
          periodType: 'reverse_trial',
          source: 'server',
          store: 'app_store',
          willRenew: false,
          expiresAt: '2026-07-12T12:00:00.000Z',
        }),
      ),
    ).rejects.toThrow('INVALID_ENTITLEMENT_CACHE_RECORD');
    await expect(loadEntitlement()).resolves.toBeNull();
  });

  it.each([
    ['invalid app-grant environment', { environment: 'preview' }],
    ['missing app-grant environment', { environment: undefined }],
    [
      'invalid RevenueCat store',
      { source: 'revenuecat', store: 'side_load', environment: 'production' },
    ],
    [
      'invalid trial period',
      { periodType: 'free_trial', expiresAt: null, environment: 'production' },
    ],
    ['invalid owner stamp', { storeUserId: ' owner-a ' }],
  ])('rejects raw v0 %s instead of normalizing it into authority', async (_name, overrides) => {
    mocks.env.appEnvironment = 'production';
    const raw = JSON.stringify(cachedEntitlement(overrides));
    mocks.storage.set(KEY, raw);

    await expect(readEntitlementCache()).resolves.toEqual({
      status: 'corrupt',
      entitlement: null,
    });
    expect(mocks.storage.get(KEY)).toBe(raw);
    mocks.storage.delete(KEY);
  });

  it.each([
    ['period_type', { period_type: 'free_trial' }],
    ['store', { store: 'side_load' }],
    ['environment', { environment: 'preview' }],
    ['source', { source: 'client_minted' }],
  ])('rejects an explicit invalid server %s before normalization', (_name, override) => {
    expect(() =>
      rowToStoredEntitlement({
        entitlement: 'pro',
        is_active: true,
        period_type: 'normal',
        store: 'app_store',
        product_id: 'annual',
        expires_at: '2027-07-05T12:00:00.000Z',
        will_renew: true,
        original_purchase_at: NOW.toISOString(),
        source: 'server',
        environment: 'production',
        verified_at: NOW.toISOString(),
        ...override,
      }),
    ).toThrow('INVALID_ENTITLEMENT_CACHE_RECORD');
  });
});
