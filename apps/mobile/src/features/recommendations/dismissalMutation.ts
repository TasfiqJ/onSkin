import type { QueryClient } from '@tanstack/react-query';

import {
  isOwnerQueryScopeCurrent,
  ownerQueryPrefixes,
  queryKeys,
  type OwnerQueryScope,
} from '@/lib/query/queryKeys';

import { dismissRecommendation, type RecommendationInputs } from './store';
import { failClosedRecommendationQueriesAfterMutationFailure } from './mutationFailure';

type RecommendationDismissalFailureHandlers = {
  isMounted: () => boolean;
  onFailure: () => void;
  onRelease: () => void;
};

export type RecommendationDismissalMutationOutcome = 'committed' | 'failed' | 'stale_owner';

type RecommendationDismissalMutationHandlers = {
  onFailure: () => void;
  onSuccess: () => void;
};

const dismissalMutationsByClient = new WeakMap<
  QueryClient,
  Map<string, Promise<RecommendationDismissalMutationOutcome>>
>();

function dismissalMutationKey(ownerScope: OwnerQueryScope, recommendationId: string): string {
  return JSON.stringify([ownerScope.generation, recommendationId]);
}

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

/** Own a teaser dismissal outside the prompt component lifecycle. A prompt that
 * remounts while the write is pending joins the same owner/recommendation
 * operation, while the initiating route callbacks still receive its settlement.
 */
export function runRecommendationDismissalMutation(
  queryClient: QueryClient,
  ownerScope: OwnerQueryScope,
  recommendationId: string,
  handlers: RecommendationDismissalMutationHandlers,
): Promise<RecommendationDismissalMutationOutcome> {
  let clientMutations = dismissalMutationsByClient.get(queryClient);
  if (!clientMutations) {
    clientMutations = new Map();
    dismissalMutationsByClient.set(queryClient, clientMutations);
  }

  const mutationKey = dismissalMutationKey(ownerScope, recommendationId);
  const existing = clientMutations.get(mutationKey);
  if (existing) return existing;

  let mutation!: Promise<RecommendationDismissalMutationOutcome>;
  mutation = Promise.resolve()
    .then(async (): Promise<RecommendationDismissalMutationOutcome> => {
      try {
        await dismissRecommendation(ownerScope, recommendationId);
      } catch {
        if (!isOwnerQueryScopeCurrent(ownerScope)) return 'stale_owner';

        try {
          handlers.onFailure();
        } finally {
          try {
            await failClosedRecommendationQueriesAfterMutationFailure(queryClient, ownerScope);
          } catch {
            // The route-owned failure state remains the recovery surface when a
            // query reset itself cannot settle. Never restore retained guidance.
          }
        }
        return isOwnerQueryScopeCurrent(ownerScope) ? 'failed' : 'stale_owner';
      }

      if (
        !publishCommittedRecommendationDismissal(queryClient, ownerScope, recommendationId) ||
        !isOwnerQueryScopeCurrent(ownerScope)
      ) {
        return 'stale_owner';
      }

      handlers.onSuccess();
      return 'committed';
    })
    .finally(() => {
      if (clientMutations?.get(mutationKey) === mutation) clientMutations.delete(mutationKey);
      if (clientMutations?.size === 0) dismissalMutationsByClient.delete(queryClient);
    });

  clientMutations.set(mutationKey, mutation);
  return mutation;
}
