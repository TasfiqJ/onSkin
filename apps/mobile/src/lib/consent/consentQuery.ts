import { getLatestConsentsWithLease } from '@/lib/consent/consent';
import {
  queryKeys,
  runOwnerQueryOperation,
  type OwnerQueryScope,
} from '@/lib/query/queryKeys';

export type ConsentManagementQuerySnapshot<T> = Readonly<{
  data: T | undefined;
  isError: boolean;
  isFetching: boolean;
}>;

export type ConsentManagementState = Readonly<{
  canChange: boolean;
  canRetry: boolean;
  hasVerifiedValue: boolean;
  isChecking: boolean;
  isUnavailable: boolean;
  value: boolean;
}>;

/**
 * Consent enforcement and consent management intentionally have different
 * publication rules. A hard gate withholds stale data during a refresh, while
 * a management control keeps the last verified value visible so an active
 * grant can still be revoked after a failed refresh. Unknown is never presented
 * as an ordinary declined choice.
 */
export function consentManagementState<T>(
  query: ConsentManagementQuerySnapshot<T>,
  selectValue: (data: T) => boolean,
): ConsentManagementState {
  const hasVerifiedValue = query.data !== undefined;
  return {
    canChange: hasVerifiedValue && !query.isFetching,
    canRetry: query.isError && !query.isFetching,
    hasVerifiedValue,
    isChecking: query.isFetching,
    isUnavailable: query.isError,
    value: hasVerifiedValue ? selectValue(query.data as T) : false,
  };
}

export function latestConsentsQueryOptions(ownerScope: OwnerQueryScope) {
  return {
    queryKey: queryKeys.consents(ownerScope),
    queryFn: () => runOwnerQueryOperation(ownerScope, getLatestConsentsWithLease),
    networkMode: 'always' as const,
    retry: 0,
  };
}
