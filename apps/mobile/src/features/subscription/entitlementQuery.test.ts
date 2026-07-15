import { onlineManager, QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createOwnerQueryScope, queryKeys } from '@/lib/query/queryKeys';

import { deriveState, type StoredEntitlement } from './entitlement';
import { ENTITLEMENT_OFFLINE_GRACE_MS } from './entitlementEvidence';
import {
  entitlementQueryOptions,
  entitlementStateForAcceptance,
  loadEntitlementLocalSnapshot,
  publishEntitlementQueryAcceptance,
  publishEntitlementVerificationFailure,
  selectEntitlementQueryState,
} from './entitlementQuery';

vi.mock('./store', () => ({
  readEntitlementCache: vi.fn(),
}));

const NOW = '2026-07-05T12:00:00.000Z';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

function entitlement(overrides: Partial<StoredEntitlement> = {}): StoredEntitlement {
  return {
    tier: 'pro',
    isActive: true,
    periodType: 'normal',
    store: 'app_store',
    productId: 'routinekind_pro_annual',
    expiresAt: '2027-07-05T12:00:00.000Z',
    willRenew: true,
    grantedAt: NOW,
    source: 'revenuecat',
    environment: 'production',
    managementUrl: null,
    verifiedAt: NOW,
    offeringId: null,
    packageId: null,
    storeUserId: 'owner-a',
    priceLabel: null,
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

afterEach(() => {
  onlineManager.setOnline(true);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('local-first entitlement query', () => {
  it('keeps newer/equal query evidence and accepts a newer inactive revocation', () => {
    const current = deriveState(
      entitlement({ verifiedAt: '2026-07-05T12:02:00.000Z', productId: 'current' }),
      NOW,
      'fresh',
    );
    const older = deriveState(
      entitlement({
        verifiedAt: '2026-07-05T12:01:00.000Z',
        productId: 'older-revocation',
        isActive: false,
      }),
      NOW,
      'expired',
    );
    const equal = deriveState(
      entitlement({ verifiedAt: current.verifiedAt, productId: 'equal-duplicate' }),
      NOW,
      'fresh',
    );
    const newerInactive = deriveState(
      entitlement({
        verifiedAt: '2026-07-05T12:03:00.000Z',
        productId: 'newer-revocation',
        isActive: false,
      }),
      NOW,
      'expired',
    );

    expect(selectEntitlementQueryState(current, older)).toMatchObject({
      productId: 'current',
      storeRevocationVerifiedAt: '2026-07-05T12:01:00.000Z',
      storeRevocationStoreUserId: 'owner-a',
    });
    expect(selectEntitlementQueryState(current, equal)).toBe(current);
    expect(selectEntitlementQueryState(current, newerInactive)).toMatchObject({
      isPro: false,
      productId: null,
      verifiedAt: '2026-07-05T12:03:00.000Z',
      evidenceStatus: 'expired',
      storeRevocationVerifiedAt: '2026-07-05T12:03:00.000Z',
    });
  });

  it('runs the encrypted local read while TanStack is offline', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const scope = createOwnerQueryScope();
    const readCache = vi.fn().mockResolvedValue({
      status: 'available',
      entitlement: entitlement(),
    });
    const options = entitlementQueryOptions({
      ownerScope: scope,
      loadLocal: (lease) =>
        loadEntitlementLocalSnapshot(lease, {
          readCache,
          nowISO: () => NOW,
          appEnvironment: 'production',
        }),
    });
    onlineManager.setOnline(false);

    expect(options.networkMode).toBe('always');
    await expect(client.fetchQuery(options)).resolves.toMatchObject({
      isPro: true,
      evidenceStatus: 'fresh',
    });
    expect(readCache).toHaveBeenCalledOnce();
    client.clear();
  });

  it('does not let an anonymous absent read clear uncertainty, but accepts verified RC empty', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const scope = createOwnerQueryScope();
    const corrupt = deriveState(null, NOW, 'corrupt');
    const anonymousAbsent = deriveState(null, NOW, 'absent');
    client.setQueryData(queryKeys.entitlement(scope), corrupt);
    await client.invalidateQueries({ queryKey: queryKeys.entitlement(scope) });

    const result = await client.fetchQuery(
      entitlementQueryOptions({
        ownerScope: scope,
        loadLocal: async () => ({ state: anonymousAbsent, shouldReconcile: false }),
        selectCurrentState: (incoming) =>
          selectEntitlementQueryState(
            client.getQueryData(queryKeys.entitlement(scope)),
            incoming,
          ),
      }),
    );
    expect(result).toBe(corrupt);
    expect(client.getQueryData(queryKeys.entitlement(scope))).toBe(corrupt);

    const verifiedEmpty = entitlementStateForAcceptance(
      {
        entitlement: null,
        revenueCatEmpty: { verifiedAt: '2026-07-05T12:01:00.000Z' },
      },
      NOW,
      'production',
    );
    expect(selectEntitlementQueryState(corrupt, verifiedEmpty)).toBe(verifiedEmpty);
    client.clear();
  });

  it('publishes fresh local Pro before a blocked server reconciliation settles', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const scope = createOwnerQueryScope();
    const blockedServer = deferred<void>();
    const reconcile = vi.fn(() => blockedServer.promise);

    const localState = await client.fetchQuery(
      entitlementQueryOptions({
        ownerScope: scope,
        loadLocal: (lease) =>
          loadEntitlementLocalSnapshot(lease, {
            readCache: async () => ({ status: 'available', entitlement: entitlement() }),
            nowISO: () => NOW,
            appEnvironment: 'production',
          }),
        reconcile,
      }),
    );
    expect(localState).toMatchObject({ isPro: true, evidenceStatus: 'fresh' });
    expect(client.getQueryData(queryKeys.entitlement(scope))).toEqual(localState);
    expect(reconcile).toHaveBeenCalledOnce();

    blockedServer.resolve();
    client.clear();
  });

  it('does not synthesize Free while the encrypted local read is unresolved', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const scope = createOwnerQueryScope();
    const local = deferred<{ status: 'absent'; entitlement: null }>();
    const request = client.fetchQuery(
      entitlementQueryOptions({
        ownerScope: scope,
        loadLocal: (lease) =>
          loadEntitlementLocalSnapshot(lease, {
            readCache: () => local.promise,
            nowISO: () => NOW,
            appEnvironment: 'production',
          }),
      }),
    );

    expect(client.getQueryData(queryKeys.entitlement(scope))).toBeUndefined();
    local.resolve({ status: 'absent', entitlement: null });
    await expect(request).resolves.toMatchObject({
      isPro: false,
      evidenceStatus: 'absent',
    });
    client.clear();
  });

  it('keeps a newer in-memory proof when a delayed queryFn commits', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const scope = createOwnerQueryScope();
    const local = deferred<{ state: ReturnType<typeof deriveState>; shouldReconcile: false }>();
    const request = client.fetchQuery(
      entitlementQueryOptions({
        ownerScope: scope,
        loadLocal: () => local.promise,
        selectCurrentState: (incoming) =>
          selectEntitlementQueryState(
            client.getQueryData(queryKeys.entitlement(scope)),
            incoming,
          ),
      }),
    );

    publishEntitlementQueryAcceptance(
      client,
      scope,
      {
        entitlement: entitlement({
          productId: 'newer-store-proof',
          verifiedAt: '2026-07-05T12:02:00.000Z',
        }),
        revenueCatEmpty: null,
      },
      NOW,
      'production',
    );
    local.resolve({
      state: deriveState(
        entitlement({ verifiedAt: '2026-07-05T12:01:00.000Z' }),
        NOW,
        'fresh',
      ),
      shouldReconcile: false,
    });

    await expect(request).resolves.toMatchObject({
      isPro: true,
      source: 'revenuecat',
      verifiedAt: '2026-07-05T12:02:00.000Z',
    });
    expect(client.getQueryData(queryKeys.entitlement(scope))).toMatchObject({
      source: 'revenuecat',
      verifiedAt: '2026-07-05T12:02:00.000Z',
    });
    client.clear();
  });

  it('keeps T2 when it is published after queryFn pre-selection but before commit', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const scope = createOwnerQueryScope();
    const localT1 = deriveState(
      entitlement({ verifiedAt: '2026-07-05T12:01:00.000Z', productId: 'local-t1' }),
      NOW,
      'fresh',
    );
    const acceptedT2 = entitlement({
      productId: 'published-t2',
      verifiedAt: '2026-07-05T12:02:00.000Z',
    });

    const request = client.fetchQuery(
      entitlementQueryOptions({
        ownerScope: scope,
        loadLocal: async () => ({ state: localT1, shouldReconcile: false }),
        selectCurrentState: (incoming) => {
          const preselected = selectEntitlementQueryState(
            client.getQueryData(queryKeys.entitlement(scope)),
            incoming,
          );
          publishEntitlementQueryAcceptance(
            client,
            scope,
            { entitlement: acceptedT2, revenueCatEmpty: null },
            NOW,
            'production',
          );
          return preselected;
        },
      }),
    );

    await request;
    expect(client.getQueryData(queryKeys.entitlement(scope))).toMatchObject({
      isPro: true,
      productId: 'published-t2',
      source: 'revenuecat',
      verifiedAt: '2026-07-05T12:02:00.000Z',
    });
    client.clear();
  });

  it('keeps a newer RevenueCat empty watermark when a delayed local proof commits', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const scope = createOwnerQueryScope();
    const local = deferred<{ state: ReturnType<typeof deriveState>; shouldReconcile: false }>();
    const request = client.fetchQuery(
      entitlementQueryOptions({
        ownerScope: scope,
        loadLocal: () => local.promise,
        selectCurrentState: (incoming) =>
          selectEntitlementQueryState(
            client.getQueryData(queryKeys.entitlement(scope)),
            incoming,
          ),
      }),
    );

    publishEntitlementQueryAcceptance(
      client,
      scope,
      {
        entitlement: null,
        revenueCatEmpty: {
          verifiedAt: '2026-07-05T12:02:00.000Z',
          storeUserId: 'owner-a',
        },
      },
      NOW,
      'production',
    );
    local.resolve({
      state: deriveState(
        entitlement({ verifiedAt: '2026-07-05T12:01:00.000Z' }),
        NOW,
        'fresh',
      ),
      shouldReconcile: false,
    });

    await expect(request).resolves.toMatchObject({
      isPro: false,
      source: 'revenuecat',
      verifiedAt: '2026-07-05T12:02:00.000Z',
      evidenceStatus: 'absent',
    });
    expect(client.getQueryData(queryKeys.entitlement(scope))).toMatchObject({
      isPro: false,
      verifiedAt: '2026-07-05T12:02:00.000Z',
    });
    client.clear();
  });

  it('commits deterministic expiry of the same proof on a real QueryClient refetch', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const scope = createOwnerQueryScope();
    const proof = entitlement({ expiresAt: '2026-07-05T12:10:00.000Z' });
    const current = deriveState(proof, NOW, 'fresh');
    const expired = deriveState(proof, '2026-07-05T12:10:00.000Z', 'expired');
    client.setQueryData(queryKeys.entitlement(scope), current);
    await client.invalidateQueries({ queryKey: queryKeys.entitlement(scope) });

    const result = await client.fetchQuery(
      entitlementQueryOptions({
        ownerScope: scope,
        loadLocal: async () => ({ state: expired, shouldReconcile: false }),
        selectCurrentState: (incoming) =>
          selectEntitlementQueryState(
            client.getQueryData(queryKeys.entitlement(scope)),
            incoming,
          ),
      }),
    );

    expect(result).toMatchObject({
      ...expired,
      storeRevocationVerifiedAt: NOW,
      storeRevocationStoreUserId: 'owner-a',
    });
    expect(client.getQueryData(queryKeys.entitlement(scope))).toMatchObject({
      isPro: false,
      evidenceStatus: 'expired',
      verifiedAt: NOW,
    });
    client.clear();
  });

  it('commits RevenueCat empty evidence from ordinary absent to stale at 72 hours', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const scope = createOwnerQueryScope();
    const acceptance = {
      entitlement: null,
      revenueCatEmpty: { verifiedAt: NOW, storeUserId: 'owner-a' },
    } as const;
    const ordinaryFree = entitlementStateForAcceptance(acceptance, NOW, 'production');
    const stale = entitlementStateForAcceptance(
      acceptance,
      new Date(Date.parse(NOW) + ENTITLEMENT_OFFLINE_GRACE_MS).toISOString(),
      'production',
    );
    client.setQueryData(queryKeys.entitlement(scope), ordinaryFree);
    await client.invalidateQueries({ queryKey: queryKeys.entitlement(scope) });

    await client.fetchQuery(
      entitlementQueryOptions({
        ownerScope: scope,
        loadLocal: async () => ({ state: stale, shouldReconcile: false }),
        selectCurrentState: (incoming) =>
          selectEntitlementQueryState(
            client.getQueryData(queryKeys.entitlement(scope)),
            incoming,
          ),
      }),
    );

    expect(client.getQueryData(queryKeys.entitlement(scope))).toMatchObject({
      isPro: false,
      evidenceStatus: 'stale',
      source: 'revenuecat',
      verifiedAt: NOW,
    });
    client.clear();
  });

  it.each(['empty', 'inactive'] as const)(
    'immediately commits an equal-time %s revocation and does not let refetch regrant',
    async (kind) => {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const scope = createOwnerQueryScope();
      const active = deriveState(entitlement(), NOW, 'fresh');
      client.setQueryData(queryKeys.entitlement(scope), active);

      const published = publishEntitlementQueryAcceptance(
        client,
        scope,
        kind === 'empty'
          ? {
              entitlement: null,
              revenueCatEmpty: { verifiedAt: NOW, storeUserId: 'owner-a' },
            }
          : {
              entitlement: entitlement({ isActive: false, productId: 'equal-revocation' }),
              revenueCatEmpty: null,
            },
        NOW,
        'production',
      );
      expect(published.isPro).toBe(false);
      expect(client.getQueryData(queryKeys.entitlement(scope))).toMatchObject({
        isPro: false,
        verifiedAt: NOW,
      });

      await client.invalidateQueries({ queryKey: queryKeys.entitlement(scope) });
      await client.fetchQuery(
        entitlementQueryOptions({
          ownerScope: scope,
          loadLocal: async () => ({ state: active, shouldReconcile: false }),
          selectCurrentState: (incoming) =>
            selectEntitlementQueryState(
              client.getQueryData(queryKeys.entitlement(scope)),
              incoming,
            ),
        }),
      );
      expect(client.getQueryData(queryKeys.entitlement(scope))).toMatchObject({
        isPro: false,
        verifiedAt: NOW,
      });
      client.clear();
    },
  );

  it('fails closed on the first QueryObserver result when cached access expired while unobserved', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const scope = createOwnerQueryScope();
    const expiry = '2026-07-05T12:10:00.000Z';
    const active = deriveState(entitlement({ expiresAt: expiry }), NOW, 'fresh');
    client.setQueryData(queryKeys.entitlement(scope), active);
    const now = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW));

    const firstObserver = new QueryObserver(
      client,
      entitlementQueryOptions({ ownerScope: scope, enabled: false }),
    );
    expect(firstObserver.getCurrentResult().data).toBe(active);
    firstObserver.destroy();

    now.mockReturnValue(Date.parse(expiry));
    const remountedObserver = new QueryObserver(
      client,
      entitlementQueryOptions({ ownerScope: scope, enabled: false }),
    );
    expect(remountedObserver.getCurrentResult().data).toMatchObject({
      isPro: false,
      evidenceStatus: 'expired',
      verifiedAt: NOW,
    });
    expect(client.getQueryData(queryKeys.entitlement(scope))).toBe(active);
    remountedObserver.destroy();
    client.clear();
  });

  it('fails closed on the first QueryObserver result at the 72-hour trust boundary', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const scope = createOwnerQueryScope();
    const active = deriveState(entitlement({ expiresAt: null }), NOW, 'fresh');
    client.setQueryData(queryKeys.entitlement(scope), active);
    vi.spyOn(Date, 'now').mockReturnValue(
      Date.parse(NOW) + ENTITLEMENT_OFFLINE_GRACE_MS,
    );

    const observer = new QueryObserver(
      client,
      entitlementQueryOptions({ ownerScope: scope, enabled: false }),
    );
    expect(observer.getCurrentResult().data).toMatchObject({
      isPro: false,
      evidenceStatus: 'stale',
      verifiedAt: NOW,
    });
    expect(client.getQueryData(queryKeys.entitlement(scope))).toBe(active);
    observer.destroy();
    client.clear();
  });

  it('retains store revocation while an app grant wins and blocks delayed store resurrection', () => {
    const appGrant = deriveState(
      entitlement({
        source: 'app_granted',
        store: 'app_granted',
        periodType: 'reverse_trial',
        productId: 'app-grant-t1',
        willRenew: false,
        expiresAt: '2026-07-05T12:10:00.000Z',
        verifiedAt: '2026-07-05T12:01:00.000Z',
      }),
      NOW,
      'fresh',
    );
    const inactiveT3 = deriveState(
      entitlement({
        productId: 'inactive-store-t3',
        isActive: false,
        verifiedAt: '2026-07-05T12:03:00.000Z',
      }),
      NOW,
      'expired',
    );
    const activeT2 = deriveState(
      entitlement({
        productId: 'delayed-active-store-t2',
        verifiedAt: '2026-07-05T12:02:00.000Z',
      }),
      NOW,
      'fresh',
    );
    const activeT4 = deriveState(
      entitlement({
        productId: 'active-store-t4',
        verifiedAt: '2026-07-05T12:04:00.000Z',
      }),
      NOW,
      'fresh',
    );

    const retained = selectEntitlementQueryState(appGrant, inactiveT3);
    expect(retained).toMatchObject({
      productId: 'app-grant-t1',
      isPro: true,
      storeRevocationVerifiedAt: '2026-07-05T12:03:00.000Z',
    });
    expect(selectEntitlementQueryState(retained, activeT2)).toMatchObject({
      productId: 'app-grant-t1',
      isPro: true,
    });

    vi.setSystemTime('2026-07-05T12:10:00.000Z');
    expect(selectEntitlementQueryState(retained, activeT2)).toMatchObject({
      isPro: false,
      productId: null,
      storeRevocationVerifiedAt: '2026-07-05T12:03:00.000Z',
    });
    expect(selectEntitlementQueryState(retained, activeT4)).toMatchObject({
      isPro: true,
      productId: 'active-store-t4',
    });
  });

  it('reattaches a retained watermark when the same time-derived proof arrives without it', () => {
    const appGrant = deriveState(
      entitlement({
        source: 'app_granted',
        store: 'app_granted',
        periodType: 'reverse_trial',
        productId: 'same-app-grant',
        willRenew: false,
        expiresAt: '2026-07-05T12:10:00.000Z',
        verifiedAt: '2026-07-05T12:01:00.000Z',
      }),
      NOW,
      'fresh',
    );
    const retained = {
      ...appGrant,
      storeRevocationVerifiedAt: '2026-07-05T12:03:00.000Z',
      storeRevocationStoreUserId: 'owner-a',
    };
    const refreshed = selectEntitlementQueryState(retained, appGrant);

    expect(refreshed).toMatchObject({
      productId: 'same-app-grant',
      storeRevocationVerifiedAt: '2026-07-05T12:03:00.000Z',
      storeRevocationStoreUserId: 'owner-a',
    });
    expect(
      selectEntitlementQueryState(
        refreshed,
        deriveState(
          entitlement({
            productId: 'delayed-store-t2',
            verifiedAt: '2026-07-05T12:02:00.000Z',
          }),
          NOW,
          'fresh',
        ),
      ),
    ).toMatchObject({ isPro: true, productId: 'same-app-grant' });
  });

  it('monotonically enriches same-proof commercial metadata without changing authority', () => {
    const base = deriveState(entitlement(), NOW, 'fresh');
    const enrichedIncoming = {
      ...base,
      priceLabel: '$39.99/year',
      managementUrl: 'https://apps.apple.com/account/subscriptions',
    };
    const enriched = selectEntitlementQueryState(base, enrichedIncoming);

    expect(enriched).toMatchObject({
      evidenceIdentity: base.evidenceIdentity,
      priceLabel: '$39.99/year',
      managementUrl: 'https://apps.apple.com/account/subscriptions',
    });
    expect(selectEntitlementQueryState(enriched, base)).toMatchObject({
      priceLabel: '$39.99/year',
      managementUrl: 'https://apps.apple.com/account/subscriptions',
    });
  });

  it('lets a delayed live app grant survive newer inactive store memory evidence', () => {
    const inactiveT3 = deriveState(
      entitlement({ isActive: false, verifiedAt: '2026-07-05T12:03:00.000Z' }),
      NOW,
      'expired',
    );
    const appGrantT1 = deriveState(
      entitlement({
        source: 'app_granted',
        store: 'app_granted',
        periodType: 'reverse_trial',
        willRenew: false,
        expiresAt: '2026-07-05T12:10:00.000Z',
        verifiedAt: '2026-07-05T12:01:00.000Z',
      }),
      NOW,
      'fresh',
    );

    expect(selectEntitlementQueryState(inactiveT3, appGrantT1)).toMatchObject({
      isPro: true,
      source: 'app_granted',
      storeRevocationVerifiedAt: '2026-07-05T12:03:00.000Z',
    });
  });

  it('publishes an app grant with its coexisting watermark before a delayed T2 commit', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const scope = createOwnerQueryScope();
    const appGrant = entitlement({
      source: 'app_granted',
      store: 'app_granted',
      periodType: 'reverse_trial',
      productId: 'app-grant-t1',
      willRenew: false,
      expiresAt: '2026-07-05T12:10:00.000Z',
      verifiedAt: '2026-07-05T12:01:00.000Z',
    });
    const published = publishEntitlementQueryAcceptance(
      client,
      scope,
      {
        entitlement: appGrant,
        revenueCatEmpty: {
          verifiedAt: '2026-07-05T12:03:00.000Z',
          storeUserId: 'owner-a',
        },
      },
      NOW,
      'production',
    );
    expect(published).toMatchObject({
      productId: 'app-grant-t1',
      storeRevocationVerifiedAt: '2026-07-05T12:03:00.000Z',
    });

    await client.fetchQuery(
      entitlementQueryOptions({
        ownerScope: scope,
        loadLocal: async () => ({
          state: deriveState(
            entitlement({
              productId: 'delayed-store-t2',
              verifiedAt: '2026-07-05T12:02:00.000Z',
            }),
            NOW,
            'fresh',
          ),
          shouldReconcile: false,
        }),
      }),
    );
    expect(client.getQueryData(queryKeys.entitlement(scope))).toMatchObject({
      productId: 'app-grant-t1',
      isPro: true,
      storeRevocationVerifiedAt: '2026-07-05T12:03:00.000Z',
    });
    client.clear();
  });

  it.each([true, false])(
    'disqualifies a current live store proof before selecting an incoming %s app grant carrying a newer watermark',
    (appGrantIsLive) => {
      const currentStore = deriveState(
        entitlement({
          productId: 'store-t2',
          verifiedAt: '2026-07-05T12:02:00.000Z',
        }),
        NOW,
        'fresh',
      );
      const appGrant = entitlement({
        source: 'app_granted',
        store: 'app_granted',
        periodType: 'reverse_trial',
        productId: 'appgrant-t3',
        isActive: appGrantIsLive,
        willRenew: false,
        expiresAt: appGrantIsLive
          ? '2026-07-05T12:10:00.000Z'
          : '2026-07-05T11:59:00.000Z',
        verifiedAt: '2026-07-05T12:03:00.000Z',
      });
      const incoming = entitlementStateForAcceptance(
        {
          entitlement: appGrant,
          revenueCatEmpty: {
            verifiedAt: '2026-07-05T12:03:00.000Z',
            storeUserId: 'owner-a',
          },
        },
        NOW,
        'production',
      );

      expect(selectEntitlementQueryState(currentStore, incoming)).toMatchObject({
        isPro: appGrantIsLive,
        storeRevocationVerifiedAt: '2026-07-05T12:03:00.000Z',
      });
      expect(selectEntitlementQueryState(currentStore, incoming).productId).not.toBe(
        'store-t2',
      );
    },
  );

  it.each(['invalid', 'unavailable', 'corrupt', 'unsupported_version'] as const)(
    'never promotes a %s carrier or its retained watermark in either arrival order',
    (evidenceStatus) => {
      const store = deriveState(
        entitlement({
          productId: 'valid-store-t2',
          verifiedAt: '2026-07-05T12:02:00.000Z',
        }),
        NOW,
        'fresh',
      );
      const invalidCarrier = {
        ...deriveState(
          entitlement({
            source: 'app_granted',
            store: 'app_granted',
            periodType: 'reverse_trial',
            productId: 'invalid-carrier-t3',
            willRenew: false,
            verifiedAt: '2026-07-05T12:03:00.000Z',
          }),
          NOW,
          evidenceStatus,
        ),
        storeRevocationVerifiedAt: '2026-07-05T12:03:00.000Z',
        storeRevocationStoreUserId: 'owner-a',
      };

      expect(selectEntitlementQueryState(store, invalidCarrier)).toMatchObject({
        isPro: true,
        productId: 'valid-store-t2',
      });
      expect(selectEntitlementQueryState(invalidCarrier, store)).toMatchObject({
        isPro: true,
        productId: 'valid-store-t2',
      });
    },
  );

  it.each([
    ['newer', '2026-07-05T12:03:00.000Z'],
    ['equal', '2026-07-05T12:02:00.000Z'],
  ] as const)(
    'never lets a %s inactive app grant revoke a live paid store proof in either arrival order',
    (_label, verifiedAt) => {
      const store = deriveState(
        entitlement({
          productId: 'paid-store-t2',
          verifiedAt: '2026-07-05T12:02:00.000Z',
        }),
        NOW,
        'fresh',
      );
      const inactiveGrant = deriveState(
        entitlement({
          source: 'app_granted',
          store: 'app_granted',
          periodType: 'reverse_trial',
          productId: 'inactive-appgrant',
          isActive: false,
          willRenew: false,
          expiresAt: '2026-07-05T11:59:00.000Z',
          verifiedAt,
        }),
        NOW,
        'expired',
      );

      expect(selectEntitlementQueryState(store, inactiveGrant)).toMatchObject({
        isPro: true,
        productId: 'paid-store-t2',
      });
      expect(selectEntitlementQueryState(inactiveGrant, store)).toMatchObject({
        isPro: true,
        productId: 'paid-store-t2',
      });
    },
  );

  it('publishes untrusted verification as uncertainty only over ordinary absence', () => {
    const client = new QueryClient();
    const scope = createOwnerQueryScope();
    client.setQueryData(queryKeys.entitlement(scope), deriveState(null, NOW, 'absent'));
    expect(publishEntitlementVerificationFailure(client, scope, NOW)).toMatchObject({
      isPro: false,
      source: 'revenuecat',
      evidenceStatus: 'unavailable',
    });

    const active = deriveState(entitlement(), NOW, 'fresh');
    client.setQueryData(queryKeys.entitlement(scope), active);
    expect(publishEntitlementVerificationFailure(client, scope, NOW)).toEqual(active);

    const verifiedEmpty = entitlementStateForAcceptance(
      {
        entitlement: null,
        revenueCatEmpty: { verifiedAt: NOW, storeUserId: 'owner-a' },
      },
      NOW,
      'production',
    );
    client.setQueryData(queryKeys.entitlement(scope), verifiedEmpty);
    expect(publishEntitlementVerificationFailure(client, scope, NOW)).toEqual(verifiedEmpty);
    client.clear();
  });
});
