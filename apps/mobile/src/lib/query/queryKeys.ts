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

export const queryPrefixes = {
  askConsent: ['ask_onskin'] as const,
  askGroundedTurns: ['askGroundedTurns'] as const,
  commerceConsent: ['commerceConsent'] as const,
  completions: ['completions'] as const,
  communityGate: ['communityGate'] as const,
  consents: ['consents'] as const,
  cycleAnchor: ['cycleAnchor'] as const,
  cycleConfig: ['cycleConfig'] as const,
  entitlement: ['entitlement'] as const,
  monkBand: ['monkBand'] as const,
  noteHelped: ['noteHelped'] as const,
  notificationPreferences: ['notifPrefs'] as const,
  onboarded: ['onboarded'] as const,
  photos: ['photos'] as const,
  progress: ['progress'] as const,
  ramp: ['ramp'] as const,
  recommendationPreferences: ['recPreferences'] as const,
  recommendations: ['recPrefsAndDismissed'] as const,
  routineOrder: ['routineOrder'] as const,
  shelf: ['shelf'] as const,
  skinProfile: ['skinProfileBits'] as const,
  subscriptionOffering: ['subscription-offering'] as const,
  trendConsent: ['trendConsent'] as const,
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
  askGroundedTurns: (scope: OwnerQueryScope, boundary: LocalDateBoundaryIdentity, period: string) =>
    localDayQueryKey(scope, 'askGroundedTurns', boundary, period),
  commerceConsent: (scope: OwnerQueryScope) => ownerScopedQueryKey(scope, 'commerceConsent'),
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
  onboarded: (scope: OwnerQueryScope) => ownerScopedQueryKey(scope, 'onboarded'),
  photos: (scope: OwnerQueryScope, boundary: LocalDateBoundaryIdentity, series: string) =>
    localDayQueryKey(scope, 'photos', boundary, series),
  progress: (scope: OwnerQueryScope, boundary: LocalDateBoundaryIdentity) =>
    localDayQueryKey(scope, 'progress', boundary),
  ramp: (scope: OwnerQueryScope, boundary: LocalDateBoundaryIdentity, productIds: string) =>
    localDayQueryKey(scope, 'ramp', boundary, productIds),
  recommendationPreferences: (scope: OwnerQueryScope) =>
    ownerScopedQueryKey(scope, 'recPreferences'),
  recommendations: (scope: OwnerQueryScope) => ownerScopedQueryKey(scope, 'recPrefsAndDismissed'),
  routineOrder: (scope: OwnerQueryScope) => ownerScopedQueryKey(scope, 'routineOrder', 'v1'),
  shelf: (scope: OwnerQueryScope, boundary: LocalDateBoundaryIdentity) =>
    localDayQueryKey(scope, 'shelf', boundary),
  skinProfile: (scope: OwnerQueryScope) => ownerScopedQueryKey(scope, 'skinProfileBits'),
  subscriptionOffering: (scope: OwnerQueryScope) =>
    ownerScopedQueryKey(scope, 'subscription-offering'),
  trendConsent: (scope: OwnerQueryScope) => ownerScopedQueryKey(scope, 'trendConsent'),
};

export const ownerQueryPrefixes = {
  askConsent: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'ask_onskin'),
  askGroundedTurns: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'askGroundedTurns'),
  commerceConsent: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'commerceConsent'),
  completions: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'completions'),
  communityGate: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'communityGate'),
  consents: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'consents'),
  cycleAnchor: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'cycleAnchor'),
  cycleConfig: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'cycleConfig'),
  entitlement: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'entitlement'),
  monkBand: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'monkBand'),
  noteHelped: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'noteHelped'),
  notificationPreferences: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'notifPrefs'),
  onboarded: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'onboarded'),
  photos: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'photos'),
  progress: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'progress'),
  ramp: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'ramp'),
  recommendationPreferences: (scope: OwnerQueryScope) =>
    ownerScopedQueryPrefix(scope, 'recPreferences'),
  recommendations: (scope: OwnerQueryScope) =>
    ownerScopedQueryPrefix(scope, 'recPrefsAndDismissed'),
  routineOrder: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'routineOrder'),
  shelf: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'shelf'),
  skinProfile: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'skinProfileBits'),
  subscriptionOffering: (scope: OwnerQueryScope) =>
    ownerScopedQueryPrefix(scope, 'subscription-offering'),
  trendConsent: (scope: OwnerQueryScope) => ownerScopedQueryPrefix(scope, 'trendConsent'),
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
