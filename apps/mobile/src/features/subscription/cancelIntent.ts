import type { SubscriptionState } from './entitlement';

type BillingStore = SubscriptionState['store'];

export function isStoreBackedBilling(store: BillingStore): boolean {
  return (
    store === 'app_store' || store === 'play_store' || store === 'web' || store === 'test_store'
  );
}

export function shouldTrackSubscriptionCancelIntent(
  state: Pick<SubscriptionState, 'isPro' | 'store' | 'willRenew'> | null | undefined,
): boolean {
  return Boolean(state?.isPro && state.willRenew === true && isStoreBackedBilling(state.store));
}
