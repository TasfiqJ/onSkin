import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from '@/lib/auth/AuthProvider';
import { env } from '@/lib/env';
import {
  assertRevenueCatResultCurrent,
  getUncachedCustomerInfo,
  snapshotRevenueCatGenerationForUser,
} from '@/lib/iap/revenuecat';

import { currentBillingStatus, readClientBillingStatus } from './clientBilling';
import type { SubscriptionState } from './entitlement';
import { PLANS } from './plans';

/** Read-only, owner/generation-keyed billing UI. The entitlement store stays authoritative. */
export function useSubscriptionBilling(state: SubscriptionState | undefined) {
  const { user } = useAuth();
  const generation = user?.id ? snapshotRevenueCatGenerationForUser(user.id) : null;
  const [now, setNow] = useState(Date.now);
  const query = useQuery({
    queryKey: ['subscription-billing', user?.id ?? 'anonymous', generation ?? 'closed', state?.productId ?? null],
    enabled: Platform.OS !== 'web' && !!user?.id && generation !== null,
    retry: 0,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const customerInfo = await getUncachedCustomerInfo();
      if (!customerInfo) throw new Error('SUBSCRIPTION_BILLING_UNAVAILABLE');
      assertRevenueCatResultCurrent(customerInfo);
      const result = readClientBillingStatus(
        customerInfo, env.revenueCatEntitlementId, state?.productId ?? null,
        [PLANS.annual.productId, PLANS.monthly.productId], Date.now(),
      );
      assertRevenueCatResultCurrent(customerInfo);
      return result;
    },
  });
  const { refetch } = query;
  useEffect(() => {
    const tick = () => setNow((previous) => Math.max(previous, Date.now()));
    const interval = setInterval(tick, 1_000);
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        tick();
        if (generation !== null && Platform.OS !== 'web') void refetch();
      }
    });
    return () => { clearInterval(interval); subscription.remove(); };
  }, [generation, refetch]);
  return { ...query, data: currentBillingStatus(query.isError ? undefined : query.data, now) };
}
