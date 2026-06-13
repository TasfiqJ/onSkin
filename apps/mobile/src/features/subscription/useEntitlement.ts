import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { track } from '@/lib/analytics/track';
import { purchasePackage, restorePurchases } from '@/lib/iap/revenuecat';

import { deriveState, type SubscriptionState } from './entitlement';
import {
  downgradeToFree,
  fetchServerEntitlement,
  grantReverseTrial,
  grantTrial,
  loadEntitlement,
  setActivePaid,
} from './store';

// The entitlement gate (docs/08 §4). Reads the local-first cache (offline-safe),
// reconciles with the server row when present, and derives the SubscriptionState
// that every Pro feature gates on. Actions grant the app-granted reverse trial,
// the (stubbed) carded trial/purchase, the win-back, and the graceful downgrade.
const KEY = ['entitlement'] as const;

export function useEntitlement() {
  return useQuery<SubscriptionState>({
    queryKey: KEY,
    retry: 0,
    queryFn: async () => {
      const local = await loadEntitlement();
      const server = await fetchServerEntitlement(); // null without a backend (B-SUPABASE)
      return deriveState(server ?? local, new Date().toISOString());
    },
  });
}

export function useEntitlementActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const startReverseTrial = useMutation({
    mutationFn: async () => {
      await grantReverseTrial();
      track('reverse_trial_started');
    },
    onSettled: invalidate,
  });

  // "Start free trial" → the carded 14-day store trial. Real StoreKit/Play purchase
  // (B-REVENUECAT); v1 grants the trial locally so the flow + success screen work.
  const startTrial = useMutation({
    mutationFn: async () => {
      await purchasePackage('annual');
      await grantTrial();
      track('trial_started', { product: 'onskin_pro_annual' });
    },
    onSettled: invalidate,
  });

  const purchase = useMutation({
    mutationFn: async () => {
      await purchasePackage('annual');
      await setActivePaid();
      track('purchase_completed', { product: 'onskin_pro_annual' });
    },
    onSettled: invalidate,
  });

  const restore = useMutation({
    mutationFn: async () => {
      track('restore_tapped');
      await restorePurchases();
    },
    onSettled: invalidate,
  });

  const downgrade = useMutation({
    mutationFn: async () => {
      await downgradeToFree();
      track('reverse_trial_expired');
    },
    onSettled: invalidate,
  });

  const winback = useMutation({
    mutationFn: async () => {
      await setActivePaid('onskin_pro_annual_winback');
      track('winback_converted');
    },
    onSettled: invalidate,
  });

  return { startReverseTrial, startTrial, purchase, restore, downgrade, winback };
}
