import {
  queryKeys,
  runOwnerQueryOperation,
  type OwnerQueryScope,
} from '@/lib/query/queryKeys';

import { isAskConsentedWithLease } from './consent';

export function askConsentQueryOptions(ownerScope: OwnerQueryScope) {
  return {
    queryKey: queryKeys.askConsent(ownerScope),
    queryFn: () => runOwnerQueryOperation(ownerScope, isAskConsentedWithLease),
    networkMode: 'always' as const,
    retry: 0,
  };
}
