import { describe, expect, it } from 'vitest';

import { isStoreBackedBilling, shouldTrackSubscriptionCancelIntent } from './cancelIntent';

describe('subscription cancel-intent analytics gate', () => {
  it('recognizes store-backed billing stores only', () => {
    expect(isStoreBackedBilling('app_store')).toBe(true);
    expect(isStoreBackedBilling('play_store')).toBe(true);
    expect(isStoreBackedBilling('web')).toBe(true);
    expect(isStoreBackedBilling('test_store')).toBe(true);
    expect(isStoreBackedBilling('app_granted')).toBe(false);
    expect(isStoreBackedBilling(null)).toBe(false);
  });

  it('tracks only renewing active store-backed subscriptions as cancel intent', () => {
    expect(
      shouldTrackSubscriptionCancelIntent({
        isPro: true,
        store: 'app_store',
        willRenew: true,
      }),
    ).toBe(true);

    expect(
      shouldTrackSubscriptionCancelIntent({
        isPro: true,
        store: 'play_store',
        willRenew: true,
      }),
    ).toBe(true);
  });

  it('does not count app-granted reverse trials, free users, or already non-renewing access', () => {
    expect(
      shouldTrackSubscriptionCancelIntent({
        isPro: true,
        store: 'app_granted',
        willRenew: false,
      }),
    ).toBe(false);

    expect(
      shouldTrackSubscriptionCancelIntent({
        isPro: false,
        store: 'app_store',
        willRenew: true,
      }),
    ).toBe(false);

    expect(
      shouldTrackSubscriptionCancelIntent({
        isPro: true,
        store: 'app_store',
        willRenew: false,
      }),
    ).toBe(false);

    expect(
      shouldTrackSubscriptionCancelIntent({
        isPro: true,
        store: 'app_store',
        willRenew: null,
      }),
    ).toBe(false);
  });
});
