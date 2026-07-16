import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { createOwnerQueryScope, queryKeys } from '@/lib/query/queryKeys';

import { failClosedShelfQueriesAfterMutationFailure } from './mutationFailure';
import type { ShelfData } from './useShelf';

describe('Shelf mutation failure cache containment', () => {
  it('drops cached success and publishes query error when the recovery read is unreadable', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const ownerScope = createOwnerQueryScope();
    const queryKey = queryKeys.shelf(ownerScope, {
      localDate: '2026-07-13',
      timeZone: 'America/Toronto',
    });
    const cached = {
      items: [],
      archive: [],
      conflicts: [],
      unresolvedConflicts: [],
      conflictChoices: {},
      reassurances: [],
      banner: null,
      profile: {
        consentCurrent: true,
        goals: [],
        moisture: 'balanced',
        pregnancy: false,
        pregnancySafety: 'clear',
        pregnancyStatus: 'none',
        sensitivity: 'neutral',
        source: 'local',
      },
    } satisfies ShelfData;
    client.setQueryData(queryKey, cached);

    const observer = new QueryObserver<ShelfData>(client, {
      queryKey,
      queryFn: async () => {
        throw new Error('SHELF_STATE_INVALID');
      },
      retry: false,
      staleTime: Infinity,
    });
    const unsubscribe = observer.subscribe(() => undefined);

    expect(observer.getCurrentResult()).toMatchObject({
      data: cached,
      isSuccess: true,
    });

    await failClosedShelfQueriesAfterMutationFailure(client, ownerScope);

    expect(observer.getCurrentResult()).toMatchObject({
      data: undefined,
      isError: true,
    });
    unsubscribe();
    client.clear();
  });
});
