import { queryOptions } from '@tanstack/react-query';

import { awaitAccountGenerationLease } from '@/lib/auth/accountGeneration';
import { queryKeys, runOwnerQueryOperation, type OwnerQueryScope } from '@/lib/query/queryKeys';
import { stableErrorQueryPolicy } from '@/lib/query/queryPolicies';

import { getGroundedTurns } from './store';

export function groundedTurnsQueryOptions(
  ownerScope: OwnerQueryScope,
  period: string,
  enabled = true,
) {
  return queryOptions({
    ...stableErrorQueryPolicy,
    queryKey: queryKeys.askGroundedTurns(ownerScope, period),
    queryFn: () =>
      runOwnerQueryOperation(ownerScope, async (lease) => {
        const count = await awaitAccountGenerationLease(lease, () => getGroundedTurns(period));
        lease.assertCurrent();
        return count;
      }),
    enabled,
    networkMode: 'always',
  });
}
