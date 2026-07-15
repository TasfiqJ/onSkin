import { awaitAccountGenerationLease } from '@/lib/auth/accountGeneration';
import type { AccountGenerationLease } from '@/lib/auth/accountGeneration';
import { runOwnerQueryOperation, type OwnerQueryScope } from '@/lib/query/queryKeys';

import { ENTITLEMENT_RECONCILIATION_INTERVAL_MS } from './entitlementEvidence';
import type {
  EntitlementAcceptance,
  ServerEntitlementFetchResult,
} from './store';

export type EntitlementReconciliation = Readonly<{
  ownerScope: OwnerQueryScope;
  fetchServer: (assertCurrentOwner: () => void) => Promise<ServerEntitlementFetchResult>;
  publish: (acceptance: EntitlementAcceptance) => void;
  force?: boolean;
  nowMs?: number;
}>;

/** Owner-generation single-flight for background server-mirror reconciliation. */
export class EntitlementServerCoordinator {
  private readonly inFlight = new Map<number, Promise<void>>();
  private readonly lastSucceededAt = new Map<number, number>();

  reconcile(input: EntitlementReconciliation): Promise<void> {
    const generation = input.ownerScope.generation;
    const active = this.inFlight.get(generation);
    if (active) return active;

    const nowMs = input.nowMs ?? Date.now();
    const lastSucceededAt = this.lastSucceededAt.get(generation);
    if (
      !input.force &&
      lastSucceededAt !== undefined &&
      nowMs >= lastSucceededAt &&
      nowMs - lastSucceededAt < ENTITLEMENT_RECONCILIATION_INTERVAL_MS
    ) {
      return Promise.resolve();
    }

    for (const priorGeneration of this.lastSucceededAt.keys()) {
      if (priorGeneration !== generation && !this.inFlight.has(priorGeneration)) {
        this.lastSucceededAt.delete(priorGeneration);
      }
    }

    const operation = runOwnerQueryOperation(input.ownerScope, async (lease) => {
      const result = await awaitAccountGenerationLease(lease, () =>
        input.fetchServer(lease.assertCurrent),
      );
      lease.assertCurrent();
      if (result.status === 'failure') return;
      if (result.status === 'evidence') {
        input.publish(result.acceptance);
        lease.assertCurrent();
      }
      // Production cooldown starts when publication succeeds. Tests may inject
      // a deterministic clock value to exercise the exact eligibility edge.
      // A successful no-row read also starts cooldown without publishing Free.
      this.lastSucceededAt.set(generation, input.nowMs ?? Date.now());
    });

    let settled!: Promise<void>;
    settled = operation
      .catch(() => undefined)
      .finally(() => {
        if (this.inFlight.get(generation) === settled) this.inFlight.delete(generation);
      });
    this.inFlight.set(generation, settled);
    return settled;
  }
}

export const entitlementServerCoordinator = new EntitlementServerCoordinator();

export type EntitlementRevenueCatRefresh = Readonly<{
  ownerScope: OwnerQueryScope;
  refresh: (lease: AccountGenerationLease) => Promise<void>;
}>;

/** Owner-generation single-flight for explicit CustomerInfo recovery refreshes. */
export class EntitlementRevenueCatRefreshCoordinator {
  private readonly inFlight = new Map<number, Promise<void>>();

  refresh(input: EntitlementRevenueCatRefresh): Promise<void> {
    const generation = input.ownerScope.generation;
    const active = this.inFlight.get(generation);
    if (active) return active;

    const operation = runOwnerQueryOperation(input.ownerScope, async (lease) => {
      await awaitAccountGenerationLease(lease, () => input.refresh(lease));
      lease.assertCurrent();
    });
    let settled!: Promise<void>;
    settled = operation
      .catch(() => undefined)
      .finally(() => {
        if (this.inFlight.get(generation) === settled) this.inFlight.delete(generation);
      });
    this.inFlight.set(generation, settled);
    return settled;
  }
}

export const entitlementRevenueCatRefreshCoordinator =
  new EntitlementRevenueCatRefreshCoordinator();

export type EntitlementVerificationRetry = Readonly<{
  ownerScope: OwnerQueryScope;
  refreshLocal: (lease: AccountGenerationLease) => Promise<void>;
  refreshRevenueCat?: (lease: AccountGenerationLease) => Promise<void>;
  reconcileServer: (lease: AccountGenerationLease) => Promise<void>;
}>;

/**
 * One owner-fenced manual Retry flight. Its promise does not settle until the
 * local cache, RevenueCat CustomerInfo, and server mirror legs have all
 * settled, so UI pending state covers the full verification attempt.
 */
export class EntitlementVerificationRetryCoordinator {
  private readonly inFlight = new Map<number, Promise<void>>();

  retry(input: EntitlementVerificationRetry): Promise<void> {
    const generation = input.ownerScope.generation;
    const active = this.inFlight.get(generation);
    if (active) return active;

    const operation = runOwnerQueryOperation(input.ownerScope, async (lease) => {
      const operations = [
        awaitAccountGenerationLease(lease, () => input.refreshLocal(lease)),
        awaitAccountGenerationLease(lease, () => input.reconcileServer(lease)),
      ];
      const refreshRevenueCat = input.refreshRevenueCat;
      if (refreshRevenueCat) {
        operations.push(
          awaitAccountGenerationLease(lease, () => refreshRevenueCat(lease)),
        );
      }
      await Promise.all(operations);
      lease.assertCurrent();
    });

    let settled!: Promise<void>;
    settled = operation
      .catch(() => undefined)
      .finally(() => {
        if (this.inFlight.get(generation) === settled) this.inFlight.delete(generation);
      });
    this.inFlight.set(generation, settled);
    return settled;
  }
}

export const entitlementVerificationRetryCoordinator =
  new EntitlementVerificationRetryCoordinator();
