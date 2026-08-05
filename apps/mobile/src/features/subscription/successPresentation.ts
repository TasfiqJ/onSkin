import { PAYWALL_COPY } from './copy';
import { billingCadenceForProductId } from './billingCadence';
import type { SubscriptionState } from './entitlement';

export type PaywallSuccessPresentation = Readonly<{
  body: string;
  metaRows: readonly string[];
}>;

const BILLING_STORES = new Set<SubscriptionState['store']>([
  'app_store',
  'play_store',
  'test_store',
  'web',
]);

/** Build claims from exact entitlement facts, never from a catalog fallback. */
export function buildPaywallSuccessPresentation(
  state: SubscriptionState,
  endDate: string,
): PaywallSuccessPresentation {
  if (state.periodType === 'reverse_trial' || state.store === 'app_granted') {
    return {
      body: PAYWALL_COPY.success.bodyForAppGrant(endDate),
      metaRows: PAYWALL_COPY.success.metaRowsForAppGrant(endDate),
    };
  }

  // RevenueCat-granted promotional entitlements are out-of-store, non-billing
  // access grants. They are not Apple/StoreKit promotional offers.
  if (state.store === 'promotional') {
    return {
      body: PAYWALL_COPY.success.bodyForPromotion(endDate),
      metaRows: PAYWALL_COPY.success.metaRowsForPromotion(endDate),
    };
  }

  const price = state.priceLabel?.trim() || null;
  const cadence = billingCadenceForProductId(state.productId);
  if (state.willRenew === true && BILLING_STORES.has(state.store) && price && cadence) {
    const isCardedTrial = state.periodType === 'trial';
    return {
      body: isCardedTrial
        ? PAYWALL_COPY.success.bodyFor(endDate, price, cadence)
        : PAYWALL_COPY.success.bodyForPaid(price, cadence),
      metaRows: isCardedTrial
        ? PAYWALL_COPY.success.metaRowsFor(endDate, price, cadence)
        : PAYWALL_COPY.success.metaRowsForPaid(endDate, price, cadence),
    };
  }

  if (state.willRenew === false) {
    return {
      body: PAYWALL_COPY.success.bodyForNonRenewing(endDate),
      metaRows: PAYWALL_COPY.success.metaRowsForNonRenewing(endDate),
    };
  }

  return {
    body: PAYWALL_COPY.success.bodyForBillingUnknown(endDate),
    metaRows: PAYWALL_COPY.success.metaRowsForBillingUnknown(endDate),
  };
}
