import {
  deriveState,
  isEntitlementEvidenceUncertain,
  type StoredEntitlement,
  type SubscriptionState,
} from './entitlement';

type Snapshot = Readonly<{
  entitlement: StoredEntitlement | null;
  effectiveNowISO: string;
  hasConflict: boolean;
  requiresUncachedRefresh: boolean;
}>;

/** Unresolved/conflicting evidence is recovery, never a verified downgrade. */
export function stateFromEntitlementSnapshot(snapshot: Snapshot): SubscriptionState {
  if (snapshot.hasConflict) {
    return deriveState(snapshot.entitlement, snapshot.effectiveNowISO, 'invalid');
  }
  if (snapshot.requiresUncachedRefresh && !snapshot.entitlement) {
    return deriveState(null, snapshot.effectiveNowISO, 'unavailable');
  }
  return deriveState(snapshot.entitlement, snapshot.effectiveNowISO);
}

export function stateWithoutServerEvidence(input: Readonly<{
  local: Snapshot | null;
  localStatus: string;
  serverStatus: string;
  nowISO: string;
  development: boolean;
}>): SubscriptionState {
  if (input.serverStatus === 'blocked') {
    return deriveState(null, input.nowISO, 'unavailable');
  }
  if (input.local) {
    const state = stateFromEntitlementSnapshot(input.local);
    return state.isPro && input.serverStatus !== 'absent'
      ? { ...state, evidenceStatus: 'reconciliation_due' }
      : state;
  }
  if (input.localStatus === 'absent' &&
      (input.serverStatus === 'absent' ||
        (input.development && input.serverStatus === 'unconfigured'))) {
    return deriveState(null, input.nowISO);
  }
  return deriveState(null, input.nowISO, 'unavailable');
}

/** Re-evaluate access between query completions; never extend a stored expiry. */
export function advanceSubscriptionState(
  state: SubscriptionState,
  nowMs: number,
): SubscriptionState {
  if (!state.isPro) return state;
  const expiry = state.expiresAt === null ? NaN : Date.parse(state.expiresAt);
  const invalid = !Number.isFinite(nowMs) || !Number.isFinite(expiry);
  if (!invalid && expiry > nowMs) {
    return { ...state, daysLeft: Math.ceil((expiry - nowMs) / 86_400_000) };
  }
  return {
    ...state,
    tier: 'free',
    isPro: false,
    periodType: null,
    priorPeriodType: state.periodType ?? state.priorPeriodType,
    expiresAt: null,
    daysLeft: null,
    willRenew: null,
    productId: null,
    inReverseTrial: false,
    inTrial: false,
    expired: !invalid,
    evidenceStatus: invalid ? 'invalid' : 'expired',
  };
}

export function confirmedFreePlan(input: Readonly<{
  data?: SubscriptionState;
  isPending?: boolean;
  isLoading?: boolean;
  isFetching?: boolean;
  isError?: boolean;
}>): boolean {
  return !input.isPending && !input.isLoading && !input.isFetching && !input.isError &&
    input.data?.isPro === false && !isEntitlementEvidenceUncertain(input.data) &&
    (input.data.evidenceStatus === 'absent' || input.data.evidenceStatus === 'expired');
}

/** Only a durably accepted definitive empty can resolve a no-purchase restore.
 * Positive-on-device empty, stale/ignored results and conflicts are not empty proof.
 * The existing journal still retains prior payment-pending notices on this path. */
export function canFinishEmptyRestore(
  verification: string,
  selectedActive: boolean,
  result: Readonly<{
    status: string;
    disposition: string;
    snapshot: (Snapshot & { activeStoreEntitlement: StoredEntitlement | null }) | null;
    requiresUncachedRefresh: boolean;
  }>,
): boolean {
  return verification === 'VERIFIED' && !selectedActive &&
    (result.status === 'committed' || result.status === 'unchanged') &&
    (result.disposition === 'applied' || result.disposition === 'duplicate') &&
    !result.requiresUncachedRefresh && result.snapshot !== null &&
    !result.snapshot.hasConflict && !result.snapshot.requiresUncachedRefresh &&
    result.snapshot.activeStoreEntitlement === null;
}
