import {
  canStartContextualReverseTrial,
  isEntitlementEvidenceUncertain,
  type SubscriptionState,
} from './entitlement';
import { directPaywallDecision, type DirectPaywallRoute } from './directPaywallPolicy';

export const ENTITLEMENT_ACTION_PRECONDITION_FAILED =
  'ENTITLEMENT_ACTION_PRECONDITION_FAILED';

export type EntitlementActionKind =
  | 'onboarding_purchase'
  | 'upsell_purchase'
  | 'downgrade_purchase'
  | 'reoffer_purchase'
  | 'winback_purchase'
  | 'reverse_trial'
  | 'decline_expired_reverse_trial';

export type EntitlementActionInput = Readonly<{
  kind: EntitlementActionKind;
  expectedEvidenceIdentity: string | null;
}>;

function fail(): never {
  throw new Error(ENTITLEMENT_ACTION_PRECONDITION_FAILED);
}

function exactIdentityMatches(
  state: SubscriptionState,
  expectedEvidenceIdentity: string | null,
): boolean {
  if (expectedEvidenceIdentity !== null) {
    return state.evidenceIdentity === expectedEvidenceIdentity;
  }
  return (
    state.evidenceIdentity === null &&
    state.evidenceStatus === 'absent' &&
    !state.isPro &&
    !state.expired &&
    state.priorPeriodType === null
  );
}

function routeForPurchase(kind: EntitlementActionKind): DirectPaywallRoute | null {
  if (kind === 'onboarding_purchase') return 'onboarding';
  if (kind === 'upsell_purchase') return 'upsell';
  if (kind === 'downgrade_purchase') return 'downgrade';
  if (kind === 'reoffer_purchase') return 'reoffer';
  if (kind === 'winback_purchase') return 'winback';
  return null;
}

function isOwnerBoundAppGrantedReverseTrial(
  state: SubscriptionState,
  expectedStoreUserId: string | undefined,
): boolean {
  return Boolean(
    expectedStoreUserId &&
      state.storeUserId === expectedStoreUserId &&
      state.store === 'app_granted' &&
      (state.source === 'app_granted' || state.source === 'server') &&
      (state.periodType === 'reverse_trial' || state.priorPeriodType === 'reverse_trial'),
  );
}

/** Pure commit-time policy; callers must pass the synchronously advanced cache state. */
export function assertEntitlementActionAllowed(
  state: SubscriptionState | null | undefined,
  input: EntitlementActionInput,
  allowedKinds: readonly EntitlementActionKind[],
  expectedStoreUserId?: string,
): asserts state is SubscriptionState {
  if (
    !state ||
    !allowedKinds.includes(input.kind) ||
    isEntitlementEvidenceUncertain(state) ||
    !exactIdentityMatches(state, input.expectedEvidenceIdentity)
  ) {
    fail();
  }

  if (input.kind === 'reverse_trial') {
    if (!canStartContextualReverseTrial(state)) fail();
    return;
  }
  if (input.kind === 'decline_expired_reverse_trial') {
    if (
      !isOwnerBoundAppGrantedReverseTrial(state, expectedStoreUserId) ||
      state.isPro ||
      !state.expired ||
      state.evidenceStatus !== 'expired' ||
      state.priorPeriodType !== 'reverse_trial'
    ) {
      fail();
    }
    return;
  }

  if (
    input.kind === 'reoffer_purchase' &&
    !isOwnerBoundAppGrantedReverseTrial(state, expectedStoreUserId)
  ) {
    fail();
  }

  const route = routeForPurchase(input.kind);
  if (!route || !directPaywallDecision(route, { state }).allowPurchase) fail();
}
