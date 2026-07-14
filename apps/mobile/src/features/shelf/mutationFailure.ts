import type { QueryClient } from '@tanstack/react-query';

import {
  isOwnerQueryScopeCurrent,
  ownerQueryPrefixes,
  type OwnerQueryScope,
} from '@/lib/query/queryKeys';

export async function failClosedShelfQueriesAfterMutationFailure(
  queryClient: QueryClient,
  ownerScope: OwnerQueryScope,
): Promise<void> {
  if (!isOwnerQueryScopeCurrent(ownerScope)) return;
  // Reset drops retained successful data immediately and refetches active
  // observers. If the private bytes are unreadable, useShelf transitions to its
  // explicit error gate instead of continuing to publish the stale snapshot.
  await queryClient.resetQueries({ queryKey: ownerQueryPrefixes.shelf(ownerScope) });
}
