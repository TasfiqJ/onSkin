import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { cancelTrialReminder, scheduleTrialReminder } from '@/features/notifications/deliver';
import { track } from '@/lib/analytics/track';
import { env } from '@/lib/env';
import {
  customerInfoToStoredEntitlement,
  purchasePackage,
  purchaseWinBackPackage,
  restorePurchases,
} from '@/lib/iap/revenuecat';

import { deriveState, type StoredEntitlement, type SubscriptionState } from './entitlement';
import {
  clearStoreEntitlementIfRevenueCatVerifiedEmpty,
  downgradeToFree,
  fetchServerEntitlement,
  loadEntitlement,
  saveVerifiedEntitlement,
  startReverseTrialOnServer,
} from './store';

const KEY = ['entitlement'] as const;
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
        productId: null,
        expiresAt: expiredAt,
        willRenew: false,
        grantedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        source: 'app_granted',
        environment: 'development',
        managementUrl: null,
        verifiedAt: now.toISOString(),
        offeringId: null,
        packageId: null,
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
      productId: null,
      expiresAt,
      willRenew: false,
      grantedAt: now.toISOString(),
      source: 'app_granted',
      environment: 'development',
      managementUrl: null,
      verifiedAt: now.toISOString(),
      offeringId: null,
      packageId: null,
      storeUserId: null,
      priceLabel: null,
    },
    now.toISOString(),
  );
}

async function persistRevenueCatResult(input: {
  customerInfo?: Parameters<typeof customerInfoToStoredEntitlement>[0];
  packageId?: string;
  offeringId?: string;
  priceLabel?: string;
}): Promise<StoredEntitlement | null> {
  if (!input.customerInfo) return null;
  const entitlement = customerInfoToStoredEntitlement(input.customerInfo);
  if (!entitlement) {
    await clearStoreEntitlementIfRevenueCatVerifiedEmpty();
    return null;
  }

  const withAttribution: StoredEntitlement = {
    ...entitlement,
    packageId: input.packageId ?? entitlement.packageId ?? null,
    offeringId: input.offeringId ?? entitlement.offeringId ?? null,
    priceLabel: input.priceLabel ?? entitlement.priceLabel ?? null,
  };
  await saveVerifiedEntitlement(withAttribution);

  if (withAttribution.isActive && withAttribution.periodType === 'trial') {
    await scheduleTrialReminder();
  } else if (withAttribution.isActive) {
    await cancelTrialReminder();
  }

  return withAttribution;
}

export function useEntitlement() {
  return useQuery<SubscriptionState>({
    queryKey: KEY,
    retry: 0,
    queryFn: async () => {
      const e2eDelay = e2eEntitlementDelayMs();
      if (e2eDelay > 0) await wait(e2eDelay);

      const e2e = e2eEntitlementState();
      if (e2e) return e2e;

      const local = await loadEntitlement();
      const server = await fetchServerEntitlement();
      return deriveState(server ?? local, new Date().toISOString());
    },
  });
}

export function useEntitlementActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const startReverseTrial = useMutation({
    mutationFn: async () => {
      const entitlement = await startReverseTrialOnServer();
      track('reverse_trial_started', { source: entitlement.source ?? 'server' });
      return activeResult(entitlement);
    },
    onSettled: invalidate,
  });

  const startTrial = useMutation({
    mutationFn: async () => {
      const result = await purchasePackage('annual');
      const entitlement = await persistRevenueCatResult(result);
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
    },
    onSettled: invalidate,
  });

  const purchase = useMutation({
    mutationFn: async () => {
      const result = await purchasePackage('annual');
      const entitlement = await persistRevenueCatResult(result);
      if (entitlement?.isActive) {
        track('purchase_completed', {
          source: 'revenuecat',
          period_type: entitlement.periodType,
        });
      }
      return activeResult(entitlement, { cancelled: result.cancelled });
    },
    onSettled: invalidate,
  });

  const restore = useMutation({
    mutationFn: async () => {
      track('restore_tapped');
      const result = await restorePurchases();
      const entitlement = await persistRevenueCatResult(result);
      return activeResult(entitlement);
    },
    onSettled: invalidate,
  });

  const downgrade = useMutation({
    mutationFn: async () => {
      await downgradeToFree();
      track('reverse_trial_expired');
      return activeResult(await loadEntitlement());
    },
    onSettled: invalidate,
  });

  const winback = useMutation({
    mutationFn: async () => {
      const result = await purchaseWinBackPackage();
      const entitlement = await persistRevenueCatResult(result);
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
    },
    onSettled: invalidate,
  });

  return { startReverseTrial, startTrial, purchase, restore, downgrade, winback };
}
