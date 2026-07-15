import { useQuery } from '@tanstack/react-query';

import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';

import { communityGateQueryOptions } from './communityGateQuery';

// Community gate state (docs/11 §8). Whether the user has granted the separate
// community_participation consent + confirmed 16+. Phase-1 (read-mostly Skin Notes)
// needs no gate; this governs the Phase-2 ask composer.
export function useCommunityGate() {
  const ownerScope = useOwnerQueryScope();
  const query = useQuery(communityGateQueryOptions(ownerScope));
  return { ...query, data: query.isSuccess && !query.isFetching ? query.data : undefined };
}
