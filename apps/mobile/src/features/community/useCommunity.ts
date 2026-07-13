import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';

import { isCommunityConsented } from './consent';
import { getAgeConfirmedLocal } from './store';

// Community gate state (docs/11 §8). Whether the user has granted the separate
// community_participation consent + confirmed 16+. Phase-1 (read-mostly Skin Notes)
// needs no gate; this governs the Phase-2 ask composer.
export function useCommunityGate() {
  const ownerScope = useOwnerQueryScope();
  return useQuery({
    queryKey: queryKeys.communityGate(ownerScope),
    queryFn: async () => ({
      consented: await isCommunityConsented(),
      ageConfirmed: await getAgeConfirmedLocal(),
    }),
  });
}
