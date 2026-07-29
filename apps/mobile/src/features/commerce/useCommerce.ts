import { useQuery } from '@tanstack/react-query';

import type { WhereToBuyOption } from './links';

// COM-01A: hooks retain their shapes for dormant callers but never read consent,
// storage, fixtures, catalog rows, or the network while commerce has no issuer.

export function useCommerceConsent() {
  return useQuery<boolean>({
    queryKey: ['commerceConsent', 'zero-admission'],
    queryFn: async () => false,
    initialData: false,
    enabled: false,
  });
}

export function useWhereToBuy(_productType: string | null) {
  return useQuery<WhereToBuyOption[]>({
    queryKey: ['whereToBuy', 'zero-admission'],
    queryFn: async () => [],
    initialData: [],
    enabled: false,
  });
}
