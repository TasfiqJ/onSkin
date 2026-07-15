import {
  awaitAccountGenerationLease,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import {
  queryKeys,
  runOwnerQueryOperation,
  type OwnerQueryScope,
} from '@/lib/query/queryKeys';
import { requirePrivateBoolean } from '@/lib/storage/privateBoolean';

import { isCommunityConsentedWithLease } from './consent';
import { readAgeConfirmedLocal } from './store';

export type CommunityGate = Readonly<{
  consented: boolean;
  ageConfirmed: boolean;
}>;

export async function readCommunityGateWithLease(
  lease: AccountGenerationLease,
): Promise<CommunityGate> {
  const consented = await isCommunityConsentedWithLease(lease);
  lease.assertCurrent();
  const age = await awaitAccountGenerationLease(lease, readAgeConfirmedLocal);
  lease.assertCurrent();
  return { consented, ageConfirmed: requirePrivateBoolean(age) };
}

export function communityGateQueryOptions(ownerScope: OwnerQueryScope) {
  return {
    queryKey: queryKeys.communityGate(ownerScope),
    queryFn: () => runOwnerQueryOperation(ownerScope, readCommunityGateWithLease),
    networkMode: 'always' as const,
    retry: 0,
  };
}
