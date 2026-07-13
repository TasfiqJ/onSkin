import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth/AuthProvider';
import { configureRevenueCat, getSubscriptionOffering } from '@/lib/iap/revenuecat';

const KEY = ['subscription-offering'] as const;

type SubscriptionOfferingOptions = {
  enabled?: boolean;
};

export function useSubscriptionOffering({ enabled = true }: SubscriptionOfferingOptions = {}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...KEY, user?.id ?? 'anonymous'],
    enabled,
    retry: 1,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (user?.id) await configureRevenueCat(user.id).catch(() => {});
      return getSubscriptionOffering();
    },
  });
}
