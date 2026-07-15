import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth/AuthProvider';
import { getSubscriptionOffering, snapshotRevenueCatGenerationForUser } from '@/lib/iap/revenuecat';

const KEY = ['subscription-offering'] as const;

type SubscriptionOfferingOptions = {
  enabled?: boolean;
};

export function useSubscriptionOffering({ enabled = true }: SubscriptionOfferingOptions = {}) {
  const { user } = useAuth();
  const publicationGeneration = user?.id ? snapshotRevenueCatGenerationForUser(user.id) : null;

  return useQuery({
    queryKey: [...KEY, user?.id ?? 'anonymous', publicationGeneration ?? 'closed'],
    enabled,
    retry: 1,
    staleTime: 5 * 60 * 1000,
    queryFn: () => getSubscriptionOffering(user?.id),
  });
}
