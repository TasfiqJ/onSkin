import {
  canStartContextualReverseTrial,
  isEntitlementEvidenceUncertain,
  type SubscriptionState,
} from './entitlement';

export type DirectPaywallRoute = 'upsell' | 'winback' | 'downgrade' | 'reoffer' | 'onboarding';

export type DirectPaywallRedirect =
  | 'dismiss'
  | 'today'
  | 'routine_plan'
  | 'upsell'
  | 'reoffer'
  | 'downgrade';

export type DirectPaywallLifecycleDisposition = 'none' | 'present' | 'supersede';

export type DirectPaywallDecision = Readonly<{
  phase: 'loading' | 'recovery' | 'offer' | 'redirect';
  variant:
    | 'none'
    | 'free_or_expired'
    | 'lapsed_paid'
    | 'active_reverse_trial'
    | 'expired_reverse_trial';
  redirect: DirectPaywallRedirect | null;
  loadOffering: boolean;
  allowPurchase: boolean;
  allowReverseTrial: boolean;
  trackPresentation: boolean;
  lifecycleDisposition: DirectPaywallLifecycleDisposition;
}>;

export type DirectPaywallInput = Readonly<{
  state: SubscriptionState | null | undefined;
  isLoading?: boolean;
  isError?: boolean;
}>;

const INERT_LOADING: DirectPaywallDecision = Object.freeze({
  phase: 'loading',
  variant: 'none',
  redirect: null,
  loadOffering: false,
  allowPurchase: false,
  allowReverseTrial: false,
  trackPresentation: false,
  lifecycleDisposition: 'none',
});

const INERT_RECOVERY: DirectPaywallDecision = Object.freeze({
  ...INERT_LOADING,
  phase: 'recovery',
});

function redirect(
  destination: DirectPaywallRedirect,
  lifecycleDisposition: DirectPaywallLifecycleDisposition = 'none',
): DirectPaywallDecision {
  return {
    ...INERT_LOADING,
    phase: 'redirect',
    redirect: destination,
    lifecycleDisposition,
  };
}

function offer(
  variant: Exclude<DirectPaywallDecision['variant'], 'none'>,
  options: {
    allowReverseTrial?: boolean;
    lifecycleDisposition?: DirectPaywallLifecycleDisposition;
  } = {},
): DirectPaywallDecision {
  return {
    phase: 'offer',
    variant,
    redirect: null,
    loadOffering: true,
    allowPurchase: true,
    allowReverseTrial: options.allowReverseTrial ?? false,
    trackPresentation: true,
    lifecycleDisposition: options.lifecycleDisposition ?? 'none',
  };
}

function isVerifiedFreeOrExpired(state: SubscriptionState): boolean {
  return (
    !state.isPro &&
    (state.evidenceStatus === 'absent' || (state.evidenceStatus === 'expired' && state.expired))
  );
}

function isStoreBacked(store: SubscriptionState['store']): boolean {
  return (
    store === 'app_store' || store === 'play_store' || store === 'web' || store === 'test_store'
  );
}

function isLapsedPaid(state: SubscriptionState): boolean {
  return (
    !state.isPro &&
    state.expired &&
    state.evidenceStatus === 'expired' &&
    state.priorPeriodType !== null &&
    state.priorPeriodType !== 'reverse_trial' &&
    isStoreBacked(state.store)
  );
}

function isExpiredReverseTrial(state: SubscriptionState): boolean {
  return (
    !state.isPro &&
    state.expired &&
    state.evidenceStatus === 'expired' &&
    state.priorPeriodType === 'reverse_trial'
  );
}

/**
 * One fail-closed decision boundary for direct purchase routes. Rendering,
 * offering fetches, analytics, mutations, and lifecycle acknowledgement all
 * consume this same decision so a deep link cannot bypass the entitlement gate.
 */
export function directPaywallDecision(
  route: DirectPaywallRoute,
  input: DirectPaywallInput,
): DirectPaywallDecision {
  const state = input.state;
  if (!state) return input.isError ? INERT_RECOVERY : INERT_LOADING;
  if (isEntitlementEvidenceUncertain(state)) return INERT_RECOVERY;

  if (route === 'upsell') {
    return isVerifiedFreeOrExpired(state)
      ? offer('free_or_expired')
      : redirect(state.isPro ? 'dismiss' : 'today');
  }

  if (route === 'onboarding') {
    return isVerifiedFreeOrExpired(state)
      ? offer('free_or_expired', {
          allowReverseTrial: canStartContextualReverseTrial(state),
        })
      : redirect(state.isPro ? 'routine_plan' : 'today');
  }

  if (route === 'winback') {
    if (isLapsedPaid(state)) return offer('lapsed_paid');
    return redirect(state.isPro ? 'today' : 'upsell');
  }

  if (route === 'downgrade') {
    if (isLapsedPaid(state)) {
      return offer('lapsed_paid', { lifecycleDisposition: 'present' });
    }
    return redirect(
      state.inReverseTrial || isExpiredReverseTrial(state) ? 'reoffer' : 'today',
      'supersede',
    );
  }

  if (state.isPro && state.inReverseTrial) {
    return offer('active_reverse_trial', { lifecycleDisposition: 'supersede' });
  }
  if (isExpiredReverseTrial(state)) {
    return offer('expired_reverse_trial', { lifecycleDisposition: 'present' });
  }
  if (isLapsedPaid(state)) return redirect('downgrade', 'supersede');
  return redirect(state.isPro ? 'today' : 'upsell', 'supersede');
}
