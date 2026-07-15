import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { cancelTrialReminder, scheduleTrialReminder } from '@/features/notifications/deliver';
import { track } from '@/lib/analytics/track';
import type { AccountGenerationLease } from '@/lib/auth/accountGeneration';
import { useAuth } from '@/lib/auth/AuthProvider';
import { env } from '@/lib/env';
import {
  customerInfoToStoredEntitlement,
  purchasePackage,
  purchaseWinBackPackage,
  restorePurchases,
  showNativeManageSubscriptions,
} from '@/lib/iap/revenuecat';
import {
  isOwnerQueryScopeCurrent,
  ownerQueryPrefixes,
  queryKeys,
  runOwnerQueryOperation,
} from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';

import { deriveState, type StoredEntitlement, type SubscriptionState } from './entitlement';
import {
  clearStoreEntitlementIfRevenueCatVerifiedEmpty,
  downgradeToFree,
  fetchServerEntitlement,
  loadEntitlement,
  readEntitlementCache,
  saveVerifiedEntitlement,
  startReverseTrialOnServer,
} from './store';

const MAX_E2E_ENTITLEMENT_DELAY_MS = 3_000;

export type EntitlementActionResult = {
  active: boolean;
  cancelled?: boolean;
  offerUnavailable?: boolean;
  entitlement: StoredEntitlement | null;
};

function activeResult(
  entitlement: StoredEntitlement | null,
  extras?: Omit<EntitlementActionResult, 'active' | 'entitlement'>,
): EntitlementActionResult {
  const active = entitlement ? deriveState(entitlement, new Date().toISOString()).isPro : false;
  return { active, entitlement, ...extras };
}

function e2eEntitlementDelayMs(): number {
  if (env.appEnvironment !== 'development') return 0;

  const raw = process.env.EXPO_PUBLIC_E2E_ENTITLEMENT_DELAY_MS;
  if (!raw) return 0;

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(Math.round(value), MAX_E2E_ENTITLEMENT_DELAY_MS);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function e2eEntitlementState(): SubscriptionState | null {
  if (env.appEnvironment !== 'development') return null;

  const fixture = process.env.EXPO_PUBLIC_E2E_ENTITLEMENT;
  if (
    fixture !== 'pro' &&
    fixture !== 'store_pro' &&
    fixture !== 'expired_store' &&
    fixture !== 'expired_reverse_trial'
  )
    return null;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const expiredAt = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  if (fixture === 'store_pro') {
    return deriveState(
      {
        tier: 'pro',
        isActive: true,
        periodType: 'normal',
        store: 'app_store',
        productId: 'routinekind_pro_annual_dev',
        expiresAt,
        willRenew: true,
        grantedAt: now.toISOString(),
        source: 'revenuecat',
        environment: 'sandbox',
        managementUrl: 'https://apps.apple.com/account/subscriptions',
        verifiedAt: now.toISOString(),
        offeringId: 'local_store_fixture',
        packageId: 'annual',
        storeUserId: 'e2e-store-user',
        priceLabel: '$49.99/year',
      },
      now.toISOString(),
    );
  }
  if (fixture === 'expired_store') {
    return deriveState(
      {
        tier: 'pro',
        isActive: true,
        periodType: 'normal',
        store: 'app_store',
        productId: 'routinekind_pro_annual_dev',
        expiresAt: expiredAt,
        willRenew: false,
        grantedAt: new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000).toISOString(),
        source: 'revenuecat',
        environment: 'sandbox',
        managementUrl: 'https://apps.apple.com/account/subscriptions',
        verifiedAt: now.toISOString(),
        offeringId: 'local_store_fixture',
        packageId: 'annual',
        storeUserId: 'e2e-expired-store-user',
        priceLabel: '$49.99/year',
      },
      now.toISOString(),
    );
  }
  if (fixture === 'expired_reverse_trial') {
    return deriveState(
      {
        tier: 'pro',
        isActive: true,
        periodType: 'reverse_trial',
        store: 'app_granted',
        productId: 'routinekind_pro_reverse_trial_local',
        expiresAt: expiredAt,
        willRenew: false,
        grantedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        source: 'app_granted',
        environment: 'development',
        managementUrl: null,
        verifiedAt: now.toISOString(),
        offeringId: 'local_reverse_trial',
        packageId: 'reverse_trial_7d',
        storeUserId: null,
        priceLabel: null,
      },
      now.toISOString(),
    );
  }

  return deriveState(
    {
      tier: 'pro',
      isActive: true,
      periodType: 'reverse_trial',
      store: 'app_granted',
      productId: 'routinekind_pro_reverse_trial_local',
      expiresAt,
      willRenew: false,
      grantedAt: now.toISOString(),
      source: 'app_granted',
      environment: 'development',
      managementUrl: null,
      verifiedAt: now.toISOString(),
      offeringId: 'local_reverse_trial',
      packageId: 'reverse_trial_7d',
      storeUserId: null,
      priceLabel: null,
    },
    now.toISOString(),
  );
}

async function persistRevenueCatResult(
  input: {
    customerInfo?: Parameters<typeof customerInfoToStoredEntitlement>[0];
    packageId?: string;
    offeringId?: string;
    priceLabel?: string;
  },
  assertCurrentOwner: () => void,
): Promise<StoredEntitlement | null> {
  if (!input.customerInfo) return null;
  const entitlement = customerInfoToStoredEntitlement(input.customerInfo);
  if (!entitlement) {
    assertCurrentOwner();
    await clearStoreEntitlementIfRevenueCatVerifiedEmpty();
    assertCurrentOwner();
    await cancelTrialReminder();
    assertCurrentOwner();
    return null;
  }

  const withAttribution: StoredEntitlement = {
    ...entitlement,
    packageId: input.packageId ?? entitlement.packageId ?? null,
    offeringId: input.offeringId ?? entitlement.offeringId ?? null,
    priceLabel: input.priceLabel ?? entitlement.priceLabel ?? null,
  };
  assertCurrentOwner();
  await saveVerifiedEntitlement(withAttribution);
  assertCurrentOwner();

  if (withAttribution.isActive && withAttribution.periodType === 'trial') {
    assertCurrentOwner();
    await scheduleTrialReminder();
  } else {
    assertCurrentOwner();
    await cancelTrialReminder();
  }
  assertCurrentOwner();

  return withAttribution;
}

export function useEntitlement(options: { enabled?: boolean } = {}) {
  const ownerScope = useOwnerQueryScope();
  return useQuery<SubscriptionState>({
    queryKey: queryKeys.entitlement(ownerScope),
    enabled: options.enabled ?? true,
    retry: 0,
    queryFn: () =>
      runOwnerQueryOperation(ownerScope, async (lease) => {
        const e2eDelay = e2eEntitlementDelayMs();
        if (e2eDelay > 0) await wait(e2eDelay);

        const e2e = e2eEntitlementState();
        if (e2e) return e2e;

        const local = await readEntitlementCache();
        const server = await fetchServerEntitlement(lease.assertCurrent);
        const localProof = local.status === 'available' ? local.entitlement : null;
        return deriveState(server ?? localProof, new Date().toISOString());
      }),
  });
}

export function useEntitlementActions() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const ownerScope = useOwnerQueryScope();
  const revenueCatOwner = (lease: AccountGenerationLease) => {
    if (!user?.id) throw new Error('REVENUECAT_OWNER_REQUIRED');
    return { appUserId: user.id, lease } as const;
  };
  const invalidate = () => {
    if (!isOwnerQueryScopeCurrent(ownerScope)) return Promise.resolve();
    return qc.invalidateQueries({ queryKey: ownerQueryPrefixes.entitlement(ownerScope) });
  };

  const startReverseTrial = useMutation({
    mutationFn: () =>
      runOwnerQueryOperation(ownerScope, async (lease) => {
        const entitlement = await startReverseTrialOnServer(lease.assertCurrent);
        lease.assertCurrent();
        track('reverse_trial_started', { source: entitlement.source ?? 'server' });
        return activeResult(entitlement);
      }),
    onSettled: invalidate,
  });

  const startTrial = useMutation({
    mutationFn: () =>
      runOwnerQueryOperation(ownerScope, async (lease) => {
        const result = await purchasePackage(revenueCatOwner(lease), 'annual');
        const entitlement = await persistRevenueCatResult(result, lease.assertCurrent);
        lease.assertCurrent();
        if (!entitlement) return activeResult(null, { cancelled: result.cancelled });

        if (entitlement.isActive && entitlement.periodType === 'trial') {
          track('trial_started', {
            source: 'revenuecat',
            period_type: entitlement.periodType,
          });
        } else if (entitlement.isActive) {
          track('purchase_completed', {
            source: 'revenuecat',
            period_type: entitlement.periodType,
          });
        }
        return activeResult(entitlement, { cancelled: result.cancelled });
      }),
    onSettled: invalidate,
    retry: 0,
  });

  const purchase = useMutation({
    mutationFn: () =>
      runOwnerQueryOperation(ownerScope, async (lease) => {
        const result = await purchasePackage(revenueCatOwner(lease), 'annual');
        const entitlement = await persistRevenueCatResult(result, lease.assertCurrent);
        lease.assertCurrent();
        if (entitlement?.isActive) {
          track('purchase_completed', {
            source: 'revenuecat',
            period_type: entitlement.periodType,
          });
        }
        return activeResult(entitlement, { cancelled: result.cancelled });
      }),
    onSettled: invalidate,
    retry: 0,
  });

  const restore = useMutation({
    mutationFn: () =>
      runOwnerQueryOperation(ownerScope, async (lease) => {
        track('restore_tapped');
        const result = await restorePurchases(revenueCatOwner(lease));
        const entitlement = await persistRevenueCatResult(result, lease.assertCurrent);
        return activeResult(entitlement);
      }),
    onSettled: invalidate,
    retry: 0,
  });

  const downgrade = useMutation({
    mutationFn: () =>
      runOwnerQueryOperation(ownerScope, async (lease) => {
        lease.assertCurrent();
        await downgradeToFree();
        lease.assertCurrent();
        track('reverse_trial_expired');
        return activeResult(await loadEntitlement());
      }),
    onSettled: invalidate,
  });

  const winback = useMutation({
    mutationFn: () =>
      runOwnerQueryOperation(ownerScope, async (lease) => {
        const result = await purchaseWinBackPackage(revenueCatOwner(lease));
        const entitlement = await persistRevenueCatResult(result, lease.assertCurrent);
        lease.assertCurrent();
        if (entitlement?.isActive) {
          track('winback_converted', {
            source: 'revenuecat',
            period_type: entitlement.periodType,
          });
        }
        return activeResult(entitlement, {
          cancelled: result.cancelled,
          offerUnavailable: result.offerUnavailable,
        });
      }),
    onSettled: invalidate,
    retry: 0,
  });

  const manage = useMutation({
    mutationFn: () =>
      runOwnerQueryOperation(ownerScope, async (lease) => {
        const opened = await showNativeManageSubscriptions(revenueCatOwner(lease));
        lease.assertCurrent();
        return opened;
      }),
    retry: 0,
  });

  return { startReverseTrial, startTrial, purchase, restore, downgrade, winback, manage };
}
