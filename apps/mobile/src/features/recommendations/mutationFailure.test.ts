import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { createOwnerQueryScope, queryKeys } from '@/lib/query/queryKeys';

import { failClosedRecommendationQueriesAfterMutationFailure } from './mutationFailure';
import type { RecommendationInputs } from './store';

describe('recommendation mutation failure cache containment', () => {
  it('drops retained combined success and publishes a strict recovery-read error', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const ownerScope = createOwnerQueryScope();
    const queryKey = queryKeys.recommendations(ownerScope);
    const cached: RecommendationInputs = {
      prefs: { values: ['vegan'], budget: 'mid', formats: ['gel'] },
      dismissed: ['gap:spf'],
    };
    client.setQueryData(queryKey, cached);

    const observer = new QueryObserver<RecommendationInputs>(client, {
      queryKey,
      queryFn: async () => {
        throw new Error('REC_DISMISSED_UNAVAILABLE');
      },
      retry: false,
      staleTime: Infinity,
    });
    const unsubscribe = observer.subscribe(() => undefined);

    expect(observer.getCurrentResult()).toMatchObject({ data: cached, isSuccess: true });

    await failClosedRecommendationQueriesAfterMutationFailure(client, ownerScope);

    expect(observer.getCurrentResult()).toMatchObject({ data: undefined, isError: true });
    unsubscribe();
    client.clear();
  });
});
