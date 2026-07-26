import { queryKeys, runOwnerQueryOperation, type OwnerQueryScope } from '@/lib/query/queryKeys';
import { requirePrivateBoolean } from '@/lib/storage/privateBoolean';

import { isCommerceConsentedWithLease } from './consent';
import { readCommerceConsentLocal } from './store';

export type CommerceConsentReadOutcome = 'consented' | 'declined' | 'stale' | 'unavailable';

/** Resolve a route action without letting an abandoned/superseded request publish. */
export async function resolveCommerceConsentRead(
  read: () => Promise<boolean>,
  isCurrent: () => boolean,
): Promise<CommerceConsentReadOutcome> {
  if (!isCurrent()) return 'stale';
  try {
    const consented = await read();
    if (!isCurrent()) return 'stale';
    return consented ? 'consented' : 'declined';
  } catch {
    return isCurrent() ? 'unavailable' : 'stale';
  }
}

export function readCommerceConsentForOwner(ownerScope: OwnerQueryScope): Promise<boolean> {
  return runOwnerQueryOperation(ownerScope, isCommerceConsentedWithLease);
}

export function commerceConsentQueryOptions(ownerScope: OwnerQueryScope) {
  return {
    queryKey: queryKeys.commerceConsent(ownerScope),
    queryFn: () => readCommerceConsentForOwner(ownerScope),
    networkMode: 'always' as const,
    retry: 0,
  };
}

export function readCommerceConsentWithdrawalPendingForOwner(
  ownerScope: OwnerQueryScope,
): Promise<boolean> {
  return runOwnerQueryOperation(ownerScope, async (lease) => {
    lease.assertCurrent();
    const result = await readCommerceConsentLocal();
    lease.assertCurrent();
    if (result.status === 'absent') return false;
    return requirePrivateBoolean(result) === false;
  });
}

export function commerceConsentWithdrawalPendingQueryOptions(ownerScope: OwnerQueryScope) {
  return {
    queryKey: queryKeys.commerceConsentWithdrawalPending(ownerScope),
    queryFn: () => readCommerceConsentWithdrawalPendingForOwner(ownerScope),
    networkMode: 'always' as const,
    retry: 0,
  };
}
