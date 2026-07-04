import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { cancelTrialReminder, scheduleTrialReminder } from '@/features/notifications/deliver';
import { track } from '@/lib/analytics/track';
import {
  customerInfoToStoredEntitlement,
  purchasePackage,
  purchaseWinBackPackage,
  restorePurchases,
} from '@/lib/iap/revenuecat';

import { deriveState, type StoredEntitlement, type SubscriptionState } from './entitlement';
import {
  downgradeToFree,
  fetchServerEntitlement,
  loadEntitlement,
  saveVerifiedEntitlement,
  startReverseTrialOnServer,
} from './store';

const KEY = ['entitlement'] as const;

export type EntitlementActionResult = {
  active: boolean;
  cancelled?: boolean;
  offerUnavailable?: boolean;
  entitlement: StoredEntitlement | null;
};

function activeResult(entitlement: StoredEntitlement | null, extras?: Omit<EntitlementActionResult, 'active' | 'entitlement'>): EntitlementActionResult {
  const active = entitlement ? deriveState(entitlement, new Date().toISOString()).isPro : false;
  return { active, entitlement, ...extras };
}

async function persistRevenueCatResult(input: {
  customerInfo?: Parameters<typeof customerInfoToStoredEntitlement>[0];
  packageId?: string;
  offeringId?: string;
  priceLabel?: string;
}): Promise<StoredEntitlement | null> {
  if (!input.customerInfo) return null;
  const entitlement = customerInfoToStoredEntitlement(input.customerInfo);
  if (!entitlement) return null;

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
      track('reverse_trial_started', { source: 'server' });
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
