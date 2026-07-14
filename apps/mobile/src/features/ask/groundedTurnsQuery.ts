import { queryOptions } from '@tanstack/react-query';

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
    queryFn: () => runOwnerQueryOperation(ownerScope, () => getGroundedTurns(period)),
    enabled,
    networkMode: 'always',
    retry: 0,
  });
}
