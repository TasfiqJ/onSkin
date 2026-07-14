import type { QueryClient } from '@tanstack/react-query';

import {
  isOwnerQueryScopeCurrent,
  ownerQueryPrefixes,
  type OwnerQueryScope,
} from '@/lib/query/queryKeys';

/** Drop retained recommendation success after a failed local mutation. Active
 * observers perform a strict read, so unreadable preferences/dismissals become
 * recovery UI instead of leaving stale guidance actionable. */
export async function failClosedRecommendationQueriesAfterMutationFailure(
  queryClient: QueryClient,
  ownerScope: OwnerQueryScope,
): Promise<void> {
  if (!isOwnerQueryScopeCurrent(ownerScope)) return;
  await Promise.all([
    queryClient.resetQueries({
      queryKey: ownerQueryPrefixes.recommendationPreferences(ownerScope),
    }),
    queryClient.resetQueries({ queryKey: ownerQueryPrefixes.recommendations(ownerScope) }),
  ]);
}
