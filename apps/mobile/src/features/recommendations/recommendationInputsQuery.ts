import { queryOptions } from '@tanstack/react-query';

import { queryKeys, runOwnerQueryOperation, type OwnerQueryScope } from '@/lib/query/queryKeys';

import { loadRecommendationInputs } from './store';

/** Shared local-only recommendation input query. Every observer must keep these
 * options aligned so direct entry and aggregate guidance behave the same offline. */
export function recommendationInputsQueryOptions(ownerScope: OwnerQueryScope) {
  return queryOptions({
    queryKey: queryKeys.recommendations(ownerScope),
    queryFn: () =>
      runOwnerQueryOperation(ownerScope, async (lease) => {
        const inputs = await loadRecommendationInputs();
        lease.assertCurrent();
        return inputs;
      }),
    retry: false,
    retryOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    networkMode: 'always',
  });
}
