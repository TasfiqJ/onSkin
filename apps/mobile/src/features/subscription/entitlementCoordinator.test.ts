import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';
import { createOwnerQueryScope } from '@/lib/query/queryKeys';

import {
  EntitlementRevenueCatRefreshCoordinator,
  EntitlementServerCoordinator,
  EntitlementVerificationRetryCoordinator,
} from './entitlementCoordinator';
import { ENTITLEMENT_RECONCILIATION_INTERVAL_MS } from './entitlementEvidence';
import type {
  EntitlementAcceptance,
  ServerEntitlementFetchResult,
} from './store';

const NOW = '2026-07-05T12:00:00.000Z';

function entitlement(productId: string): EntitlementAcceptance {
  return {
    entitlement: {
    tier: 'pro',
    isActive: true,
    periodType: 'normal',
    store: 'app_store',
    productId,
    expiresAt: '2027-07-05T12:00:00.000Z',
    willRenew: true,
    grantedAt: NOW,
    source: 'server',
    environment: 'production',
    managementUrl: null,
    verifiedAt: NOW,
    offeringId: null,
    packageId: null,
    storeUserId: 'owner',
    priceLabel: null,
    },
    revenueCatEmpty: null,
    persisted: true,
  };
}

function evidence(productId: string): ServerEntitlementFetchResult {
  return { status: 'evidence', acceptance: entitlement(productId) };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

let boundaryActive = false;

afterEach(() => {
  if (boundaryActive) {
    endAccountGenerationBoundary();
    boundaryActive = false;
  }
});

describe('entitlement server coordinator', () => {
  it('single-flights concurrent reconciliation for one owner generation', async () => {
    const coordinator = new EntitlementServerCoordinator();
    const scope = createOwnerQueryScope();
    const server = deferred<ServerEntitlementFetchResult>();
    const fetchServer = vi.fn(() => server.promise);
    const publish = vi.fn();
    const input = { ownerScope: scope, fetchServer, publish, nowMs: 1_000_000 };

    const first = coordinator.reconcile(input);
    const second = coordinator.reconcile(input);
    expect(second).toBe(first);
    expect(fetchServer).toHaveBeenCalledOnce();

    server.resolve(evidence('owner-a'));
    await first;
    expect(publish).toHaveBeenCalledOnce();
  });

  it('suppresses starts inside five minutes and permits the exact boundary', async () => {
    const coordinator = new EntitlementServerCoordinator();
    const scope = createOwnerQueryScope();
    const fetchServer = vi.fn().mockResolvedValue(evidence('owner-a'));
    const publish = vi.fn();
    const base = 1_000_000;
    const reconcileAt = (nowMs: number) =>
      coordinator.reconcile({ ownerScope: scope, fetchServer, publish, nowMs });

    await reconcileAt(base);
    await reconcileAt(base + ENTITLEMENT_RECONCILIATION_INTERVAL_MS - 1);
    expect(fetchServer).toHaveBeenCalledTimes(1);

    await reconcileAt(base + ENTITLEMENT_RECONCILIATION_INTERVAL_MS);
    expect(fetchServer).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledTimes(2);
  });

  it('permits an immediate retry after fetch failure or publish failure', async () => {
    const coordinator = new EntitlementServerCoordinator();
    const scope = createOwnerQueryScope();
    const fetchServer = vi
      .fn<() => Promise<ServerEntitlementFetchResult>>()
      .mockResolvedValueOnce({ status: 'failure' })
      .mockResolvedValue(evidence('owner-a'));
    const publish = vi.fn<(value: EntitlementAcceptance) => void>().mockImplementationOnce(() => {
      throw new Error('query cache unavailable');
    });

    await coordinator.reconcile({ ownerScope: scope, fetchServer, publish, nowMs: 1_000_000 });
    await coordinator.reconcile({ ownerScope: scope, fetchServer, publish, nowMs: 1_000_001 });
    await coordinator.reconcile({ ownerScope: scope, fetchServer, publish, nowMs: 1_000_002 });

    expect(fetchServer).toHaveBeenCalledTimes(3);
    expect(publish).toHaveBeenCalledTimes(2);
  });

  it('starts cooldown after a successful no-row response without publishing Free', async () => {
    const coordinator = new EntitlementServerCoordinator();
    const scope = createOwnerQueryScope();
    const fetchServer = vi.fn().mockResolvedValue({ status: 'no_evidence' } as const);
    const publish = vi.fn();

    await coordinator.reconcile({ ownerScope: scope, fetchServer, publish, nowMs: 1_000_000 });
    await coordinator.reconcile({ ownerScope: scope, fetchServer, publish, nowMs: 1_000_001 });

    expect(fetchServer).toHaveBeenCalledOnce();
    expect(publish).not.toHaveBeenCalled();
  });

  it('lets an explicit Retry bypass a successful passive reconciliation cooldown', async () => {
    const coordinator = new EntitlementServerCoordinator();
    const scope = createOwnerQueryScope();
    const fetchServer = vi.fn().mockResolvedValue({ status: 'no_evidence' } as const);
    const publish = vi.fn();

    await coordinator.reconcile({ ownerScope: scope, fetchServer, publish, nowMs: 1_000_000 });
    await coordinator.reconcile({
      ownerScope: scope,
      fetchServer,
      publish,
      force: true,
      nowMs: 1_000_001,
    });

    expect(fetchServer).toHaveBeenCalledTimes(2);
    expect(publish).not.toHaveBeenCalled();
  });

  it('never publishes delayed owner-A data after owner B starts', async () => {
    const coordinator = new EntitlementServerCoordinator();
    const scopeA = createOwnerQueryScope();
    const serverA = deferred<ServerEntitlementFetchResult>();
    const publishA = vi.fn();
    const requestA = coordinator.reconcile({
      ownerScope: scopeA,
      fetchServer: () => serverA.promise,
      publish: publishA,
      nowMs: 1_000_000,
    });

    beginAccountGenerationBoundary();
    boundaryActive = true;
    await requestA;
    endAccountGenerationBoundary();
    boundaryActive = false;

    const scopeB = createOwnerQueryScope();
    const publishB = vi.fn();
    await coordinator.reconcile({
      ownerScope: scopeB,
      fetchServer: async () => evidence('owner-b'),
      publish: publishB,
      nowMs: 1_000_001,
    });
    expect(publishB).toHaveBeenCalledWith(
      expect.objectContaining({
        entitlement: expect.objectContaining({ productId: 'owner-b' }),
      }),
    );

    serverA.resolve(evidence('owner-a'));
    await Promise.resolve();
    expect(publishA).not.toHaveBeenCalled();
  });

  it('does not publish Free for a null or failed server response', async () => {
    const scope = createOwnerQueryScope();
    const publish = vi.fn();
    await new EntitlementServerCoordinator().reconcile({
      ownerScope: scope,
      fetchServer: async () => ({ status: 'no_evidence' }),
      publish,
    });
    await new EntitlementServerCoordinator().reconcile({
      ownerScope: scope,
      fetchServer: async () => ({ status: 'failure' }),
      publish,
    });
    expect(publish).not.toHaveBeenCalled();
  });
});

describe('entitlement RevenueCat refresh coordinator', () => {
  it('single-flights Retry refreshes for one owner generation', async () => {
    const coordinator = new EntitlementRevenueCatRefreshCoordinator();
    const scope = createOwnerQueryScope();
    const release = deferred<void>();
    const refresh = vi.fn(async () => release.promise);

    const first = coordinator.refresh({ ownerScope: scope, refresh });
    const second = coordinator.refresh({ ownerScope: scope, refresh });
    expect(second).toBe(first);
    expect(refresh).toHaveBeenCalledOnce();
    release.resolve();
    await first;
  });

  it('never publishes a delayed Retry result after an account boundary', async () => {
    const coordinator = new EntitlementRevenueCatRefreshCoordinator();
    const scope = createOwnerQueryScope();
    const release = deferred<void>();
    const publish = vi.fn();
    const request = coordinator.refresh({
      ownerScope: scope,
      refresh: async (lease) => {
        await release.promise;
        lease.assertCurrent();
        publish();
      },
    });

    beginAccountGenerationBoundary();
    boundaryActive = true;
    await request;
    release.resolve();
    await Promise.resolve();
    expect(publish).not.toHaveBeenCalled();
  });
});

describe('entitlement verification Retry coordinator', () => {
  it('joins one owner flight and stays pending until every verification leg settles', async () => {
    const coordinator = new EntitlementVerificationRetryCoordinator();
    const scope = createOwnerQueryScope();
    const local = deferred<void>();
    const revenueCat = deferred<void>();
    const server = deferred<void>();
    const refreshLocal = vi.fn(async () => local.promise);
    const refreshRevenueCat = vi.fn(async () => revenueCat.promise);
    const reconcileServer = vi.fn(async () => server.promise);
    const input = { ownerScope: scope, refreshLocal, refreshRevenueCat, reconcileServer };

    const first = coordinator.retry(input);
    const second = coordinator.retry(input);
    expect(second).toBe(first);
    expect(refreshLocal).toHaveBeenCalledOnce();
    expect(refreshRevenueCat).toHaveBeenCalledOnce();
    expect(reconcileServer).toHaveBeenCalledOnce();

    let settled = false;
    void first.then(() => {
      settled = true;
    });
    local.resolve();
    revenueCat.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);

    server.resolve();
    await first;
    expect(settled).toBe(true);
  });

  it('does not let delayed Retry work escape an account boundary', async () => {
    const coordinator = new EntitlementVerificationRetryCoordinator();
    const scope = createOwnerQueryScope();
    const release = deferred<void>();
    const publish = vi.fn();
    const request = coordinator.retry({
      ownerScope: scope,
      refreshLocal: async () => undefined,
      reconcileServer: async () => undefined,
      refreshRevenueCat: async (lease) => {
        await release.promise;
        lease.assertCurrent();
        publish();
      },
    });

    beginAccountGenerationBoundary();
    boundaryActive = true;
    await request;
    release.resolve();
    await Promise.resolve();
    expect(publish).not.toHaveBeenCalled();
  });
});
