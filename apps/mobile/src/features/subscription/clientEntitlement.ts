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

const snapshotPublicationChecks = new WeakMap<Snapshot, () => void>();
const currentStateReaders = new WeakMap<SubscriptionState, () => SubscriptionState>();

/** Local publication validity only; this does not grant recovery authority. */
export function bindEntitlementSnapshotState(snapshot: Snapshot, assertCurrent: () => void): void {
  snapshotPublicationChecks.set(snapshot, assertCurrent);
}

// Query Core structurally shares plain objects, which would flatten accessors
// into the old booleans. A non-plain instance retains these checks in the real
// QueryClient, including the queued continuation after an async query returns.
class CurrentSubscriptionState implements SubscriptionState {
  declare tier: SubscriptionState['tier'];
  declare isPro: SubscriptionState['isPro'];
  declare periodType: SubscriptionState['periodType'];
  declare priorPeriodType: SubscriptionState['priorPeriodType'];
  declare expiresAt: SubscriptionState['expiresAt'];
  declare daysLeft: SubscriptionState['daysLeft'];
  declare willRenew: SubscriptionState['willRenew'];
  declare productId: SubscriptionState['productId'];
  declare store: SubscriptionState['store'];
  declare priceLabel: SubscriptionState['priceLabel'];
  declare managementUrl: SubscriptionState['managementUrl'];
  declare source: SubscriptionState['source'];
  declare environment: SubscriptionState['environment'];
  declare verifiedAt: SubscriptionState['verifiedAt'];
  declare storeUserId: SubscriptionState['storeUserId'];
  declare evidenceIdentity: SubscriptionState['evidenceIdentity'];
  declare storeRevocationVerifiedAt: SubscriptionState['storeRevocationVerifiedAt'];
  declare storeRevocationStoreUserId: SubscriptionState['storeRevocationStoreUserId'];
  declare inReverseTrial: SubscriptionState['inReverseTrial'];
  declare inTrial: SubscriptionState['inTrial'];
  declare expired: SubscriptionState['expired'];
  declare evidenceStatus: SubscriptionState['evidenceStatus'];

  constructor(read: () => SubscriptionState) {
    for (const key of Object.keys(read()) as (keyof SubscriptionState)[]) {
      Object.defineProperty(this, key, { enumerable: true, get: () => read()[key] });
    }
    currentStateReaders.set(this, read);
    Object.freeze(this);
  }
}

function mapCurrentState(
  state: SubscriptionState,
  transform: (current: SubscriptionState) => SubscriptionState,
): SubscriptionState {
  const read = currentStateReaders.get(state);
  return read ? new CurrentSubscriptionState(() => transform(read())) : transform(state);
}

/** Unresolved/conflicting evidence is recovery, never a verified downgrade. */
export function stateFromEntitlementSnapshot(snapshot: Snapshot): SubscriptionState {
  const assertCurrent = snapshotPublicationChecks.get(snapshot);
  if (assertCurrent) {
    return new CurrentSubscriptionState(() => {
      try {
        assertCurrent();
      } catch {
        // Unavailable access is not a verified empty/Free subscription. Retain
        // historical provider fields without exposing an obsolete paid state.
        return deriveState(snapshot.entitlement, snapshot.effectiveNowISO, 'unavailable');
      }
      return stateFromEntitlementSnapshot({ ...snapshot });
    });
  }
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
  // A malformed authenticated publication is not an offline transport failure.
  // Reusing cached positive access here could conceal an undecodable revocation.
  if (input.serverStatus === 'blocked' || input.serverStatus === 'rejected') {
    return deriveState(null, input.nowISO, 'unavailable');
  }
  if (input.local) {
    const state = stateFromEntitlementSnapshot(input.local);
    return mapCurrentState(state, (current) => current.isPro && input.serverStatus !== 'absent'
      ? { ...current, evidenceStatus: 'reconciliation_due' }
      : current);
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
  return mapCurrentState(state, (current) => advanceCurrentSubscriptionState(current, nowMs));
}

function advanceCurrentSubscriptionState(state: SubscriptionState, nowMs: number): SubscriptionState {
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
