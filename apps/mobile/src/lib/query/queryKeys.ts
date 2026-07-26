import {
  AccountGenerationLeaseError,
  getAccountGeneration,
  runAccountGenerationOperation,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';

import type { LocalDateBoundaryIdentity } from './localDateBoundaryStore';
import { readLocalDateBoundarySnapshot } from './queryDateBoundaryCore';

export const OWNER_QUERY_NAMESPACE = 'account-generation' as const;
export const LOCAL_DAY_QUERY_NAMESPACE = 'local-day' as const;

export type OwnerQueryScope = Readonly<{ generation: number }>;

export function createOwnerQueryScope(): OwnerQueryScope {
  return Object.freeze({ generation: getAccountGeneration() });
}

/** Fail closed while an account boundary is active or after this mounted tree becomes stale. */
export function isOwnerQueryScopeCurrent(scope: OwnerQueryScope): boolean {
  try {
    return scope.generation === getAccountGeneration();
  } catch {
    return false;
  }
}

/**
 * Track account-owned async query/mutation work across the destructive account
 * boundary. The boundary aborts and drains these operations before owner B can
 * mount, while the final assertion prevents a stale result from publishing.
 */
export function runOwnerQueryOperation<T>(
  scope: OwnerQueryScope,
  operation: (lease: AccountGenerationLease) => T | Promise<T>,
): Promise<T> {
  return runAccountGenerationOperation(async (lease) => {
    if (lease.generation !== scope.generation) throw new AccountGenerationLeaseError();
    const result = await operation(lease);
    lease.assertCurrent();
    return result;
  });
}

/**
 * Run owner reads under a shared child signal. The first same-generation error
 * aborts its siblings, while the parent remains registered until every sibling
 * acknowledges cancellation. This both surfaces strict storage failures without
 * waiting for an unrelated hung request and prevents that request from escaping
 * account-boundary drain tracking.
 */
export async function settleOwnerQueryOperations<const T extends readonly unknown[]>(
  lease: AccountGenerationLease,
  operations: {
    readonly [K in keyof T]: (childLease: AccountGenerationLease) => T[K] | Promise<T[K]>;
  },
): Promise<T> {
  lease.assertCurrent();
  const controller = new AbortController();
  const abortChildren = () => controller.abort();
  lease.signal.addEventListener('abort', abortChildren, { once: true });
  if (lease.signal.aborted) abortChildren();

  let hasFailure = false;
  let firstFailure: unknown;
  const childLease: AccountGenerationLease = Object.freeze({
    generation: lease.generation,
    signal: controller.signal,
    assertCurrent: () => {
      lease.assertCurrent();
      if (controller.signal.aborted) throw new AccountGenerationLeaseError();
    },
    // Query branches are not destructive boundary owners.
    beginBoundaryHandoff: () => {
      throw new AccountGenerationLeaseError();
    },
  });

  try {
    const pending = operations.map((operation) =>
      Promise.resolve()
        .then(() => {
          childLease.assertCurrent();
          return operation(childLease);
        })
        .catch((error: unknown) => {
          if (!hasFailure) {
            hasFailure = true;
            firstFailure = error;
            abortChildren();
          }
          throw error;
        }),
    );
    const settled = await Promise.allSettled(pending);
    lease.assertCurrent();

    if (hasFailure) throw firstFailure;

    return settled.map(
      (result) => (result as PromiseFulfilledResult<unknown>).value,
    ) as unknown as T;
  } finally {
    lease.signal.removeEventListener('abort', abortChildren);
  }
}

export const queryPrefixes = {
  askConsent: ['ask_onskin'] as const,
  askGroundedTurns: ['askGroundedTurns'] as const,
  commerceConsent: ['commerceConsent'] as const,
  commerceConsentWithdrawalPending: ['commerceConsentWithdrawalPending'] as const,
  completions: ['completions'] as const,
  communityGate: ['communityGate'] as const,
  consents: ['consents'] as const,
  cycleAnchor: ['cycleAnchor'] as const,
  cycleConfig: ['cycleConfig'] as const,
  entitlement: ['entitlement'] as const,
  monkBand: ['monkBand'] as const,
  noteHelped: ['noteHelped'] as const,
  notificationPreferences: ['notifPrefs'] as const,
  notificationPreferencesOutboxStatus: ['notificationPreferencesOutboxStatus'] as const,
  onboarded: ['onboarded'] as const,
  photoDeleteOutboxStatus: ['photoDeleteOutboxStatus'] as const,
  photos: ['photos'] as const,
  progress: ['progress'] as const,
  ramp: ['ramp'] as const,
  recommendationPreferences: ['recPreferences'] as const,
  recommendationPreferencesOutboxStatus: ['recommendationPreferencesOutboxStatus'] as const,
  recommendations: ['recPrefsAndDismissed'] as const,
  routineOrder: ['routineOrder'] as const,
  shelf: ['shelf'] as const,
  shelfOutboxStatus: ['shelfOutboxStatus'] as const,
  skinProfile: ['skinProfileBits'] as const,
  subscriptionOffering: ['subscription-offering'] as const,
  trendConsent: ['trendConsent'] as const,
  whereToBuy: ['whereToBuy'] as const,
};

export function ownerScopedQueryKey<
  const TRoot extends string,
  const TParts extends readonly unknown[],
>(
  scope: OwnerQueryScope,
  root: TRoot,
  ...parts: TParts
): readonly [TRoot, typeof OWNER_QUERY_NAMESPACE, number, ...TParts] {
  return [root, OWNER_QUERY_NAMESPACE, scope.generation, ...parts];
}

export function ownerScopedQueryPrefix<const TRoot extends string>(
  scope: OwnerQueryScope,
  root: TRoot,
): readonly [TRoot, typeof OWNER_QUERY_NAMESPACE, number] {
  return [root, OWNER_QUERY_NAMESPACE, scope.generation];
}

function localDayQueryKey<const TRoot extends string, const TParts extends readonly unknown[]>(
  scope: OwnerQueryScope,
  root: TRoot,
  boundary: LocalDateBoundaryIdentity,
  ...parts: TParts
) {
  return ownerScopedQueryKey(
    scope,
    root,
    LOCAL_DAY_QUERY_NAMESPACE,
    boundary.localDate,
    boundary.timeZone,
    ...parts,
  );
}

export function queryKeyMatchesLocalDateBoundary(
  queryKey: readonly unknown[],
  boundary: LocalDateBoundaryIdentity,
): boolean {
  return (
    queryKey[1] === OWNER_QUERY_NAMESPACE &&
    queryKey[3] === LOCAL_DAY_QUERY_NAMESPACE &&
    queryKey[4] === boundary.localDate &&
    queryKey[5] === boundary.timeZone
  );
}

/**
 * Reconnect/focus can fire while React still observes the prior day's key.
 * Compare against a fresh wall-clock snapshot so that stale active observers
 * cannot refetch in the background before the external store rotates on focus.
 */
export function shouldRefetchCurrentLocalDayQuery(query: {
  queryKey: readonly unknown[];
}): boolean {
  try {
    return (
      query.queryKey[1] === OWNER_QUERY_NAMESPACE &&
      query.queryKey[2] === getAccountGeneration() &&
      queryKeyMatchesLocalDateBoundary(query.queryKey, readLocalDateBoundarySnapshot())
    );
  } catch {
    return false;
  }
}

export const queryKeys = {
  askConsent: (scope: OwnerQueryScope) => ownerScopedQueryKey(scope, 'ask_onskin'),
  askGroundedTurns: (scope: OwnerQueryScope, period: string) =>
    ownerScopedQueryKey(scope, 'askGroundedTurns', period),
  commerceConsent: (scope: OwnerQueryScope) => ownerScopedQueryKey(scope, 'commerceConsent'),
  commerceConsentWithdrawalPending: (scope: OwnerQueryScope) =>
    ownerScopedQueryKey(scope, 'commerceConsentWithdrawalPending'),
  completions: (scope: OwnerQueryScope, boundary: LocalDateBoundaryIdentity) =>
    localDayQueryKey(scope, 'completions', boundary),
  communityGate: (scope: OwnerQueryScope) => ownerScopedQueryKey(scope, 'communityGate'),
  consents: (scope: OwnerQueryScope) => ownerScopedQueryKey(scope, 'consents'),
  cycleAnchor: (scope: OwnerQueryScope, boundary: LocalDateBoundaryIdentity) =>
    localDayQueryKey(scope, 'cycleAnchor', boundary),
  cycleConfig: (scope: OwnerQueryScope, boundary: LocalDateBoundaryIdentity) =>
    localDayQueryKey(scope, 'cycleConfig', boundary),
  entitlement: (scope: OwnerQueryScope) => ownerScopedQueryKey(scope, 'entitlement'),
  monkBand: (scope: OwnerQueryScope) => ownerScopedQueryKey(scope, 'monkBand'),
  noteHelped: (scope: OwnerQueryScope, noteId: string | undefined) =>
    ownerScopedQueryKey(scope, 'noteHelped', noteId),
  notificationPreferences: (scope: OwnerQueryScope) => ownerScopedQueryKey(scope, 'notifPrefs'),
  notificationPreferencesOutboxStatus: (scope: OwnerQueryScope, revision: number) =>
    ownerScopedQueryKey(scope, 'notificationPreferencesOutboxStatus', revision),
  onboarded: (scope: OwnerQueryScope) => ownerScopedQueryKey(scope, 'onboarded'),
  photoDeleteOutboxStatus: (scope: OwnerQueryScope, revision: number) =>
    ownerScopedQueryKey(scope, 'photoDeleteOutboxStatus', revision),
  photos: (scope: OwnerQueryScope, boundary: LocalDateBoundaryIdentity, series: string) =>
    localDayQueryKey(scope, 'photos', boundary, series),
  progress: (scope: OwnerQueryScope, boundary: LocalDateBoundaryIdentity) =>
    localDayQueryKey(scope, 'progress', boundary),
  ramp: (scope: OwnerQueryScope, boundary: LocalDateBoundaryIdentity, productIds: string) =>
    localDayQueryKey(scope, 'ramp', boundary, productIds),
  recommendationPreferences: (scope: OwnerQueryScope) =>
    ownerScopedQueryKey(scope, 'recPreferences'),
  recommendationPreferencesOutboxStatus: (scope: OwnerQueryScope, revision: number) =>
    ownerScopedQueryKey(scope, 'recommendationPreferencesOutboxStatus', revision),
  recommendations: (scope: OwnerQueryScope) => ownerScopedQueryKey(scope, 'recPrefsAndDismissed'),
  routineOrder: (scope: OwnerQueryScope) => ownerScopedQueryKey(scope, 'routineOrder', 'v1'),
  shelf: (scope: OwnerQueryScope, boundary: LocalDateBoundaryIdentity) =>
    localDayQueryKey(scope, 'shelf', boundary),
  shelfOutboxStatus: (scope: OwnerQueryScope, revision: number) =>
    ownerScopedQueryKey(scope, 'shelfOutboxStatus', revision),
  skinProfile: (scope: OwnerQueryScope) => ownerScopedQueryKey(scope, 'skinProfileBits'),
  subscriptionOffering: (scope: OwnerQueryScope) =>
    ownerScopedQueryKey(scope, 'subscription-offering'),
  trendConsent: (scope: OwnerQueryScope) => ownerScopedQueryKey(scope, 'trendConsent'),
  whereToBuy: (scope: OwnerQueryScope, productType: string | null) =>
    ownerScopedQueryKey(scope, 'whereToBuy', productType),
};

export const ownerQueryPrefixes = {
  askConsent: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'ask_onskin'),
  askGroundedTurns: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'askGroundedTurns'),
  commerceConsent: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'commerceConsent'),
  commerceConsentWithdrawalPending: (scope: OwnerQueryScope) =>
    ownerScopedQueryPrefix(scope, 'commerceConsentWithdrawalPending'),
  completions: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'completions'),
  communityGate: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'communityGate'),
  consents: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'consents'),
  cycleAnchor: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'cycleAnchor'),
  cycleConfig: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'cycleConfig'),
  entitlement: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'entitlement'),
  monkBand: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'monkBand'),
  noteHelped: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'noteHelped'),
  notificationPreferences: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'notifPrefs'),
  notificationPreferencesOutboxStatus: (scope: OwnerQueryScope) =>
    ownerScopedQueryPrefix(scope, 'notificationPreferencesOutboxStatus'),
  onboarded: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'onboarded'),
  photoDeleteOutboxStatus: (scope: OwnerQueryScope) =>
    ownerScopedQueryPrefix(scope, 'photoDeleteOutboxStatus'),
  photos: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'photos'),
  progress: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'progress'),
  ramp: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'ramp'),
  recommendationPreferences: (scope: OwnerQueryScope) =>
    ownerScopedQueryPrefix(scope, 'recPreferences'),
  recommendationPreferencesOutboxStatus: (scope: OwnerQueryScope) =>
    ownerScopedQueryPrefix(scope, 'recommendationPreferencesOutboxStatus'),
  recommendations: (scope: OwnerQueryScope) =>
    ownerScopedQueryPrefix(scope, 'recPrefsAndDismissed'),
  routineOrder: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'routineOrder'),
  shelf: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'shelf'),
  shelfOutboxStatus: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'shelfOutboxStatus'),
  skinProfile: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'skinProfileBits'),
  subscriptionOffering: (scope: OwnerQueryScope) =>
    ownerScopedQueryPrefix(scope, 'subscription-offering'),
  trendConsent: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'trendConsent'),
  whereToBuy: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'whereToBuy'),
};

export const DATE_SENSITIVE_QUERY_PREFIXES = [
  queryPrefixes.askGroundedTurns,
  queryPrefixes.completions,
  queryPrefixes.cycleAnchor,
  queryPrefixes.cycleConfig,
  queryPrefixes.photos,
  queryPrefixes.progress,
  queryPrefixes.ramp,
  queryPrefixes.shelf,
] as const;
