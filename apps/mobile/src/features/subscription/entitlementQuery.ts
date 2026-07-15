import {
  awaitAccountGenerationLease,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { env, type AppEnvironment } from '@/lib/env';
import { queryKeys, runOwnerQueryOperation, type OwnerQueryScope } from '@/lib/query/queryKeys';
import type { QueryClient, UseQueryOptions } from '@tanstack/react-query';

import { deriveState, type SubscriptionState } from './entitlement';
import { advanceEntitlementStateAtBoundary } from './entitlementBoundaryScheduler';
import { resolveEntitlementCacheRead } from './entitlementEvidence';
import { selectLatestAuthoritativeEntitlementEvidence } from './entitlementOrdering';
import {
  readEntitlementCache,
  type EntitlementAcceptance,
  type EntitlementCacheRead,
} from './store';

export type EntitlementLocalSnapshot = Readonly<{
  state: SubscriptionState;
  shouldReconcile: boolean;
}>;

type EntitlementQueryKey = ReturnType<typeof queryKeys.entitlement>;

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isSubscriptionState(value: unknown): value is SubscriptionState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  const periodType = (candidate: unknown) =>
    candidate === null ||
    candidate === 'reverse_trial' ||
    candidate === 'trial' ||
    candidate === 'intro' ||
    candidate === 'normal' ||
    candidate === 'prepaid';
  const source =
    state.source === null ||
    state.source === undefined ||
    state.source === 'revenuecat' ||
    state.source === 'app_granted' ||
    state.source === 'server' ||
    state.source === 'local_cache';
  const environment =
    state.environment === null ||
    state.environment === undefined ||
    state.environment === 'production' ||
    state.environment === 'sandbox' ||
    state.environment === 'test_store' ||
    state.environment === 'development' ||
    state.environment === 'unknown';

  return (
    (state.tier === 'free' || state.tier === 'pro' || state.tier === 'pro_plus') &&
    typeof state.isPro === 'boolean' &&
    periodType(state.periodType) &&
    periodType(state.priorPeriodType) &&
    isNullableString(state.expiresAt) &&
    (state.daysLeft === null ||
      (typeof state.daysLeft === 'number' &&
        Number.isSafeInteger(state.daysLeft) &&
        state.daysLeft >= 0)) &&
    (state.willRenew === null || typeof state.willRenew === 'boolean') &&
    isNullableString(state.productId) &&
    (state.store === null ||
      state.store === 'app_store' ||
      state.store === 'play_store' ||
      state.store === 'web' ||
      state.store === 'app_granted' ||
      state.store === 'test_store') &&
    isNullableString(state.priceLabel) &&
    isNullableString(state.managementUrl) &&
    source &&
    environment &&
    isNullableString(state.verifiedAt) &&
    isNullableString(state.storeUserId) &&
    isNullableString(state.evidenceIdentity) &&
    (state.storeRevocationVerifiedAt === undefined ||
      isNullableString(state.storeRevocationVerifiedAt)) &&
    (state.storeRevocationStoreUserId === undefined ||
      isNullableString(state.storeRevocationStoreUserId)) &&
    typeof state.inReverseTrial === 'boolean' &&
    typeof state.inTrial === 'boolean' &&
    typeof state.expired === 'boolean' &&
    (state.evidenceStatus === 'fresh' ||
      state.evidenceStatus === 'reconciliation_due' ||
      state.evidenceStatus === 'stale' ||
      state.evidenceStatus === 'expired' ||
      state.evidenceStatus === 'invalid' ||
      state.evidenceStatus === 'absent' ||
      state.evidenceStatus === 'unavailable' ||
      state.evidenceStatus === 'corrupt' ||
      state.evidenceStatus === 'unsupported_version')
  );
}

function structurallyShareEntitlementState(
  current: unknown,
  incoming: unknown,
): SubscriptionState {
  if (!isSubscriptionState(incoming)) {
    throw new Error('ENTITLEMENT_QUERY_STATE_INVALID');
  }
  return selectEntitlementQueryState(
    isSubscriptionState(current) ? current : undefined,
    incoming,
  );
}

function selectEntitlementStateAtObservation(state: SubscriptionState): SubscriptionState {
  return advanceEntitlementStateAtBoundary(state, Date.now());
}

function hasAuthoritativeQueryEvidence(state: SubscriptionState): boolean {
  if (
    state.evidenceStatus === 'invalid' ||
    state.evidenceStatus === 'stale' ||
    state.evidenceStatus === 'unavailable' ||
    state.evidenceStatus === 'corrupt' ||
    state.evidenceStatus === 'unsupported_version'
  ) {
    return false;
  }
  if (
    state.source !== 'revenuecat' &&
    state.source !== 'server' &&
    state.source !== 'app_granted'
  ) {
    return false;
  }
  if (!state.verifiedAt) return false;
  const verifiedTime = Date.parse(state.verifiedAt);
  if (
    !Number.isFinite(verifiedTime) ||
    new Date(verifiedTime).toISOString() !== state.verifiedAt
  ) {
    return false;
  }
  return state.evidenceStatus !== 'absent' || state.source === 'revenuecat';
}

export function selectEntitlementQueryState(
  current: SubscriptionState | undefined,
  incoming: SubscriptionState,
): SubscriptionState {
  const nowMs = Date.now();
  current = current ? advanceEntitlementStateAtBoundary(current, nowMs) : undefined;
  incoming = advanceEntitlementStateAtBoundary(incoming, nowMs);

  const canonicalTime = (value: string | null | undefined): number | null => {
    if (!value) return null;
    const time = Date.parse(value);
    return Number.isFinite(time) && new Date(time).toISOString() === value ? time : null;
  };
  const isAppGrant = (state: SubscriptionState) =>
    state.source === 'app_granted' || state.store === 'app_granted';
  const isStoreEvidence = (state: SubscriptionState) =>
    state.source === 'revenuecat' ||
    state.store === 'app_store' ||
    state.store === 'play_store' ||
    state.store === 'test_store' ||
    state.store === 'web';
  const isAuthoritativeStoreRevocation = (state: SubscriptionState) =>
    !state.isPro &&
    isStoreEvidence(state) &&
    (state.evidenceStatus === 'expired' || state.evidenceStatus === 'absent');
  type StoreRevocation = Readonly<{ time: number; owner: string }>;
  const revocations = (state: SubscriptionState | undefined): StoreRevocation[] => {
    if (!state || !hasAuthoritativeQueryEvidence(state)) return [];
    const result: StoreRevocation[] = [];
    const ownTime = isAuthoritativeStoreRevocation(state)
      ? canonicalTime(state.verifiedAt)
      : null;
    if (ownTime !== null && state.storeUserId) {
      result.push({ time: ownTime, owner: state.storeUserId });
    }
    const retainedTime = canonicalTime(state.storeRevocationVerifiedAt);
    if (retainedTime !== null && state.storeRevocationStoreUserId) {
      result.push({ time: retainedTime, owner: state.storeRevocationStoreUserId });
    }
    return result;
  };
  const latestRevocationForOwner = (owner: string | null): StoreRevocation | null => {
    if (!owner) return null;
    return [...revocations(current), ...revocations(incoming)].reduce<StoreRevocation | null>(
      (latest, candidate) =>
        candidate.owner === owner && (!latest || candidate.time > latest.time)
          ? candidate
          : latest,
      null,
    );
  };
  const withRevocation = (
    state: SubscriptionState,
    revocation: StoreRevocation | null,
  ): SubscriptionState => {
    if (!revocation) return state;
    const currentTime = canonicalTime(state.storeRevocationVerifiedAt);
    if (
      state.storeRevocationStoreUserId === revocation.owner &&
      currentTime !== null &&
      currentTime >= revocation.time
    ) {
      return state;
    }
    return {
      ...state,
      storeRevocationVerifiedAt: new Date(revocation.time).toISOString(),
      storeRevocationStoreUserId: revocation.owner,
    };
  };

  if (
    current?.evidenceIdentity &&
    current.evidenceIdentity === incoming.evidenceIdentity &&
    selectLatestAuthoritativeEntitlementEvidence(current, incoming) === incoming
  ) {
    return withRevocation(
      {
        ...incoming,
        priceLabel: incoming.priceLabel ?? current.priceLabel,
        managementUrl: incoming.managementUrl ?? current.managementUrl,
      },
      latestRevocationForOwner(incoming.storeUserId),
    );
  }

  // Uncertain/invalid states are displayable recovery information, never
  // ordering or revocation authority. Reject them before collecting retained
  // watermark fields so a malformed T3 cannot revoke a valid T2.
  const currentIsAuthoritative = current ? hasAuthoritativeQueryEvidence(current) : false;
  const incomingIsAuthoritative = hasAuthoritativeQueryEvidence(incoming);
  if (current && !currentIsAuthoritative) {
    return incomingIsAuthoritative ? incoming : current;
  }
  if (!incomingIsAuthoritative) return current ?? incoming;

  const blockedRevocation = (state: SubscriptionState): StoreRevocation | null => {
    if (!state.isPro || !isStoreEvidence(state)) return null;
    const proofTime = canonicalTime(state.verifiedAt);
    const revocation = latestRevocationForOwner(state.storeUserId);
    return proofTime !== null && revocation && proofTime <= revocation.time
      ? revocation
      : null;
  };
  const stateAfterRevocation = (state: SubscriptionState): SubscriptionState => {
    const revocation = blockedRevocation(state);
    if (!revocation) return state;
    const carrier = [current, incoming].find(
      (candidate) =>
        candidate &&
        isAuthoritativeStoreRevocation(candidate) &&
        candidate.storeUserId === revocation.owner &&
        canonicalTime(candidate.verifiedAt) === revocation.time,
    );
    if (carrier) return carrier;
    const verifiedAt = new Date(revocation.time).toISOString();
    return {
      ...deriveState(null, new Date(nowMs).toISOString(), 'absent'),
      source: 'revenuecat',
      verifiedAt,
      storeUserId: revocation.owner,
      managementUrl: state.managementUrl,
      evidenceIdentity: JSON.stringify([
        'revenuecat_empty',
        verifiedAt,
        revocation.owner,
      ]),
      storeRevocationVerifiedAt: verifiedAt,
      storeRevocationStoreUserId: revocation.owner,
    };
  };

  const effectiveCurrent = current ? stateAfterRevocation(current) : undefined;
  const effectiveIncoming = stateAfterRevocation(incoming);

  const sameCorePublishedProof = Boolean(
    effectiveCurrent &&
      effectiveCurrent === current &&
      effectiveIncoming === incoming &&
      current.verifiedAt === incoming.verifiedAt &&
      current.source === incoming.source &&
      current.storeUserId === incoming.storeUserId &&
      current.tier === incoming.tier &&
      current.isPro === incoming.isPro &&
      current.periodType === incoming.periodType &&
      current.store === incoming.store &&
      current.productId === incoming.productId &&
      current.expiresAt === incoming.expiresAt &&
      current.willRenew === incoming.willRenew,
  );
  if (
    current &&
    sameCorePublishedProof &&
    ((current.priceLabel === null && incoming.priceLabel !== null) ||
      (current.managementUrl === null && incoming.managementUrl !== null))
  ) {
    return withRevocation(
      {
        ...current,
        priceLabel: current.priceLabel ?? incoming.priceLabel,
        managementUrl: current.managementUrl ?? incoming.managementUrl,
      },
      latestRevocationForOwner(incoming.storeUserId),
    );
  }

  let selected: SubscriptionState;
  const currentLiveStore = Boolean(
    effectiveCurrent?.isPro && isStoreEvidence(effectiveCurrent),
  );
  const incomingLiveStore =
    effectiveIncoming.isPro && isStoreEvidence(effectiveIncoming);
  if (currentLiveStore || incomingLiveStore) {
    selected = currentLiveStore && incomingLiveStore
      ? selectLatestAuthoritativeEntitlementEvidence(
          effectiveCurrent,
          effectiveIncoming,
        )
      : currentLiveStore
        ? (effectiveCurrent as SubscriptionState)
        : effectiveIncoming;
  } else {
    const currentLiveAppGrant = Boolean(
      effectiveCurrent?.isPro && isAppGrant(effectiveCurrent),
    );
    const incomingLiveAppGrant =
      effectiveIncoming.isPro && isAppGrant(effectiveIncoming);
    if (currentLiveAppGrant || incomingLiveAppGrant) {
      selected = currentLiveAppGrant && incomingLiveAppGrant
        ? selectLatestAuthoritativeEntitlementEvidence(
            effectiveCurrent,
            effectiveIncoming,
          )
        : currentLiveAppGrant
          ? (effectiveCurrent as SubscriptionState)
          : effectiveIncoming;
    } else {
      selected = selectLatestAuthoritativeEntitlementEvidence(
        effectiveCurrent,
        effectiveIncoming,
      );
    }
  }
  return withRevocation(selected, latestRevocationForOwner(selected.storeUserId));
}

export function entitlementStateForAcceptance(
  acceptance: Pick<EntitlementAcceptance, 'entitlement' | 'revenueCatEmpty'>,
  nowISO: string,
  appEnvironment: AppEnvironment,
): SubscriptionState {
  if (acceptance.entitlement) {
    const state = resolveEntitlementCacheRead(
      { status: 'available', entitlement: acceptance.entitlement },
      nowISO,
      appEnvironment,
    );
    return acceptance.revenueCatEmpty
      ? {
          ...state,
          storeRevocationVerifiedAt: acceptance.revenueCatEmpty.verifiedAt,
          storeRevocationStoreUserId:
            acceptance.revenueCatEmpty.storeUserId ?? null,
        }
      : state;
  }
  return resolveEntitlementCacheRead(
    acceptance.revenueCatEmpty
      ? {
          status: 'absent',
          entitlement: null,
          revenueCatEmpty: acceptance.revenueCatEmpty,
        }
      : { status: 'absent', entitlement: null },
    nowISO,
    appEnvironment,
  );
}

export function publishEntitlementQueryAcceptance(
  queryClient: Pick<QueryClient, 'setQueryData'>,
  ownerScope: OwnerQueryScope,
  acceptance: Pick<EntitlementAcceptance, 'entitlement' | 'revenueCatEmpty'>,
  nowISO: string,
  appEnvironment: AppEnvironment,
): SubscriptionState {
  const incoming = entitlementStateForAcceptance(acceptance, nowISO, appEnvironment);
  let published = incoming;
  queryClient.setQueryData<SubscriptionState>(queryKeys.entitlement(ownerScope), (current) => {
    published = selectEntitlementQueryState(current, incoming);
    return published;
  });
  return published;
}

/** Publish a non-persisted trust failure only when no verified local evidence
 * already exists. This closes purchase surfaces on a clean anonymous absence
 * without discarding bounded cached access or a verified provider revocation. */
export function publishEntitlementVerificationFailure(
  queryClient: Pick<QueryClient, 'setQueryData'>,
  ownerScope: OwnerQueryScope,
  nowISO: string,
): SubscriptionState {
  let published = deriveState(null, nowISO, 'unavailable');
  published = { ...published, source: 'revenuecat' };
  queryClient.setQueryData<SubscriptionState>(queryKeys.entitlement(ownerScope), (current) => {
    if (
      current &&
      (hasAuthoritativeQueryEvidence(current) ||
        current.evidenceStatus === 'stale' ||
        current.evidenceStatus === 'invalid' ||
        current.evidenceStatus === 'unavailable' ||
        current.evidenceStatus === 'corrupt' ||
        current.evidenceStatus === 'unsupported_version')
    ) {
      published = current;
      return current;
    }
    return published;
  });
  return published;
}

export async function loadEntitlementLocalSnapshot(
  lease: AccountGenerationLease,
  options: {
    readCache?: () => Promise<EntitlementCacheRead>;
    expectedStoreUserId?: string;
    nowISO?: () => string;
    appEnvironment?: AppEnvironment;
  } = {},
): Promise<EntitlementLocalSnapshot> {
  const read = await awaitAccountGenerationLease(
    lease,
    options.readCache ??
      (() =>
        readEntitlementCache({
          expectedStoreUserId: options.expectedStoreUserId,
        })),
  );
  lease.assertCurrent();
  const nowISO = (options.nowISO ?? (() => new Date().toISOString()))();
  return {
    state: resolveEntitlementCacheRead(read, nowISO, options.appEnvironment ?? env.appEnvironment),
    shouldReconcile: true,
  };
}

export function entitlementQueryOptions(input: {
  ownerScope: OwnerQueryScope;
  enabled?: boolean;
  loadLocal?: (lease: AccountGenerationLease) => Promise<EntitlementLocalSnapshot>;
  reconcile?: (snapshot: EntitlementLocalSnapshot) => void | Promise<void>;
  selectCurrentState?: (incoming: SubscriptionState) => SubscriptionState;
}): UseQueryOptions<SubscriptionState, Error, SubscriptionState, EntitlementQueryKey> {
  return {
    queryKey: queryKeys.entitlement(input.ownerScope),
    enabled: input.enabled ?? true,
    networkMode: 'always' as const,
    retry: 0,
    select: selectEntitlementStateAtObservation,
    structuralSharing: structurallyShareEntitlementState,
    queryFn: () =>
      runOwnerQueryOperation(input.ownerScope, async (lease) => {
        const snapshot = await (input.loadLocal ?? loadEntitlementLocalSnapshot)(lease);
        lease.assertCurrent();
        if (snapshot.shouldReconcile && input.reconcile) {
          try {
            void Promise.resolve(input.reconcile(snapshot)).catch(() => undefined);
          } catch {
            // Background reconciliation never blocks locally proven access.
          }
        }
        return input.selectCurrentState?.(snapshot.state) ?? snapshot.state;
      }),
  };
}
