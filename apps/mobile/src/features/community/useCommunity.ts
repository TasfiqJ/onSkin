import { useQuery } from '@tanstack/react-query';

import { isCommunityConsented } from './consent';
import { getAgeConfirmedLocal } from './store';

// Community gate state (docs/11 §8). Whether the user has granted the separate
// community_participation consent + confirmed 16+. Phase-1 (read-mostly Skin Notes)
// needs no gate; this governs the Phase-2 ask composer.
export function useCommunityGate() {
  return useQuery({
    queryKey: ['communityGate'],
    queryFn: async () => ({
      consented: await isCommunityConsented(),
      ageConfirmed: await getAgeConfirmedLocal(),
    }),
  });
}
