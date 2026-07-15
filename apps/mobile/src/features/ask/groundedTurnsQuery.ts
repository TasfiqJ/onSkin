import { queryOptions } from '@tanstack/react-query';

import { awaitAccountGenerationLease } from '@/lib/auth/accountGeneration';
import {
  queryKeys,
  runOwnerQueryOperation,
  type OwnerQueryScope,
} from '@/lib/query/queryKeys';

import { getGroundedTurns } from './store';

export function groundedTurnsQueryOptions(
  ownerScope: OwnerQueryScope,
  period: string,
  enabled = true,
) {
  return queryOptions({
    queryKey: queryKeys.askGroundedTurns(ownerScope, period),
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    queryFn: () =>
      runOwnerQueryOperation(ownerScope, async (lease) => {
        const count = await awaitAccountGenerationLease(lease, () => getGroundedTurns(period));
        lease.assertCurrent();
        return count;
      }),
    enabled,
    networkMode: 'always',
    retry: 0,
  });
}
