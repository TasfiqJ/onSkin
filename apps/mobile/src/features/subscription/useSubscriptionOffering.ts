import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth/AuthProvider';
import { configureRevenueCat, getSubscriptionOffering } from '@/lib/iap/revenuecat';
import { queryKeys, runOwnerQueryOperation } from '@/lib/query/queryKeys';
import { stableErrorQueryPolicy } from '@/lib/query/queryPolicies';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';

type SubscriptionOfferingOptions = {
  enabled?: boolean;
};

export function useSubscriptionOffering({ enabled = true }: SubscriptionOfferingOptions = {}) {
  const { user } = useAuth();
  const ownerScope = useOwnerQueryScope();

  return useQuery({
    ...stableErrorQueryPolicy,
    queryKey: queryKeys.subscriptionOffering(ownerScope),
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: () =>
      runOwnerQueryOperation(ownerScope, async (lease) => {
        if (!user?.id) throw new Error('REVENUECAT_OWNER_REQUIRED');
        const owner = { appUserId: user.id, lease } as const;
        await configureRevenueCat(owner);
        lease.assertCurrent();
        return getSubscriptionOffering(owner);
      }),
  });
}
