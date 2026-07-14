import type { QueryClient } from '@tanstack/react-query';

import {
  isOwnerQueryScopeCurrent,
  ownerQueryPrefixes,
  queryKeys,
  type OwnerQueryScope,
} from '@/lib/query/queryKeys';

import type { RecommendationInputs } from './store';
import { failClosedRecommendationQueriesAfterMutationFailure } from './mutationFailure';

type RecommendationDismissalFailureHandlers = {
  isMounted: () => boolean;
  onFailure: () => void;
  onRelease: () => void;
};

/** Contain a failed write for the current owner even if its originating surface
 * already unmounted. Only UI publication/release depends on mount state. */
export async function containRecommendationDismissalFailure(
  queryClient: QueryClient,
  ownerScope: OwnerQueryScope,
  handlers: RecommendationDismissalFailureHandlers,
): Promise<void> {
  if (!isOwnerQueryScopeCurrent(ownerScope)) return;
  if (handlers.isMounted()) handlers.onFailure();
  try {
    await failClosedRecommendationQueriesAfterMutationFailure(queryClient, ownerScope);
  } finally {
    if (handlers.isMounted() && isOwnerQueryScopeCurrent(ownerScope)) handlers.onRelease();
  }
}

/** Publish a dismissal only after its encrypted local write commits. Updating the
 * owner-scoped cache synchronously removes the stale action surface before the
 * strict read runs, so navigation never waits on storage revalidation. */
export function publishCommittedRecommendationDismissal(
  queryClient: QueryClient,
  ownerScope: OwnerQueryScope,
  recommendationId: string,
): boolean {
  if (!isOwnerQueryScopeCurrent(ownerScope)) return false;

  queryClient.setQueryData<RecommendationInputs>(
    queryKeys.recommendations(ownerScope),
    (current) => {
      if (!current || current.dismissed.includes(recommendationId)) return current;
      return { ...current, dismissed: [...current.dismissed, recommendationId] };
    },
  );

  void queryClient
    .invalidateQueries({ queryKey: ownerQueryPrefixes.recommendations(ownerScope) })
    .catch(() => undefined);
  return true;
}
