import { describe, expect, it } from 'vitest';

import { deriveState, type SubscriptionState } from './entitlement';
import { directPaywallDecision, type DirectPaywallRoute } from './directPaywallPolicy';

const NOW = '2026-07-15T12:00:00.000Z';
const FUTURE = '2026-08-15T12:00:00.000Z';
const PAST = '2026-07-14T12:00:00.000Z';

function absent(): SubscriptionState {
  return deriveState(null, NOW, 'absent');
}

function uncertain(
  status: 'stale' | 'invalid' | 'unavailable' | 'corrupt' | 'unsupported_version',
) {
  return deriveState(null, NOW, status);
}

function activeStore(evidenceStatus: 'fresh' | 'reconciliation_due' = 'fresh'): SubscriptionState {
  return deriveState(
    {
      tier: 'pro',
      isActive: true,
      periodType: 'normal',
      store: 'app_store',
      productId: 'onskin_pro_annual',
      expiresAt: FUTURE,
      willRenew: true,
      grantedAt: NOW,
      source: 'revenuecat',
      verifiedAt: NOW,
    },
    NOW,
    evidenceStatus,
  );
}

function activeReverseTrial(): SubscriptionState {
  return deriveState(
    {
      tier: 'pro',
      isActive: true,
      periodType: 'reverse_trial',
      store: 'app_granted',
      productId: null,
      expiresAt: FUTURE,
      willRenew: false,
      grantedAt: NOW,
      source: 'app_granted',
      verifiedAt: NOW,
    },
    NOW,
    'fresh',
  );
}

function expired(
  periodType: 'reverse_trial' | 'normal' | 'trial' = 'normal',
  store: SubscriptionState['store'] = 'app_store',
): SubscriptionState {
  return deriveState(
    {
      tier: 'pro',
      isActive: false,
      periodType,
      store,
      productId: periodType === 'reverse_trial' ? null : 'onskin_pro_annual',
      expiresAt: PAST,
      willRenew: false,
      grantedAt: PAST,
      source: periodType === 'reverse_trial' ? 'app_granted' : 'revenuecat',
      verifiedAt: NOW,
    },
    NOW,
    'expired',
  );
}

function expectInert(decision: ReturnType<typeof directPaywallDecision>) {
  expect(decision).toMatchObject({
    loadOffering: false,
    allowPurchase: false,
    allowReverseTrial: false,
    trackPresentation: false,
  });
  expect(decision.lifecycleDisposition).not.toBe('present');
}

describe('direct paywall policy', () => {
  const routes: DirectPaywallRoute[] = ['upsell', 'winback', 'downgrade', 'reoffer', 'onboarding'];

  it.each(routes)('keeps %s inert while entitlement is loading or uncertain', (route) => {
    const loading = directPaywallDecision(route, { state: undefined, isLoading: true });
    expect(loading.phase).toBe('loading');
    expectInert(loading);
    const queryError = directPaywallDecision(route, { state: undefined, isError: true });
    expect(queryError.phase).toBe('recovery');
    expectInert(queryError);

    for (const status of [
      'stale',
      'invalid',
      'unavailable',
      'corrupt',
      'unsupported_version',
    ] as const) {
      const recovery = directPaywallDecision(route, { state: uncertain(status) });
      expect(recovery.phase).toBe('recovery');
      expectInert(recovery);
    }
  });

  it('keeps concrete trusted proof authoritative across background refetch errors', () => {
    const active = directPaywallDecision('upsell', {
      state: activeStore(),
      isError: true,
    });
    expect(active).toMatchObject({
      phase: 'redirect',
      redirect: 'dismiss',
      loadOffering: false,
      allowPurchase: false,
    });

    expect(directPaywallDecision('upsell', { state: absent(), isError: true })).toMatchObject({
      phase: 'offer',
      variant: 'free_or_expired',
      loadOffering: true,
      allowPurchase: true,
    });
    expect(
      directPaywallDecision('winback', {
        state: expired('normal'),
        isError: true,
      }),
    ).toMatchObject({
      phase: 'offer',
      variant: 'lapsed_paid',
      loadOffering: true,
      allowPurchase: true,
    });
  });

  it('allows ordinary upsell only for authoritative Free or expired evidence', () => {
    for (const state of [absent(), expired('normal'), expired('reverse_trial')]) {
      expect(directPaywallDecision('upsell', { state })).toMatchObject({
        phase: 'offer',
        variant: 'free_or_expired',
        loadOffering: true,
        allowPurchase: true,
        trackPresentation: true,
      });
    }

    const active = directPaywallDecision('upsell', { state: activeStore() });
    expect(active).toMatchObject({ phase: 'redirect', redirect: 'dismiss' });
    expectInert(active);
    const reconciledActive = directPaywallDecision('upsell', {
      state: activeStore('reconciliation_due'),
    });
    expect(reconciledActive).toMatchObject({ phase: 'redirect', redirect: 'dismiss' });
    expectInert(reconciledActive);
  });

  it('allows win-back and downgrade only for lapsed store-backed paid proof', () => {
    for (const route of ['winback', 'downgrade'] as const) {
      for (const periodType of ['normal', 'trial'] as const) {
        expect(directPaywallDecision(route, { state: expired(periodType) })).toMatchObject({
          phase: 'offer',
          variant: 'lapsed_paid',
          allowPurchase: true,
          lifecycleDisposition: route === 'downgrade' ? 'present' : 'none',
        });
      }

      for (const state of [
        absent(),
        expired('reverse_trial'),
        activeStore(),
        activeReverseTrial(),
      ]) {
        const decision = directPaywallDecision(route, { state });
        expect(decision.phase).toBe('redirect');
        expectInert(decision);
      }
    }

    const nonStoreExpiry = directPaywallDecision('winback', {
      state: expired('normal', 'app_granted'),
    });
    expect(nonStoreExpiry).toMatchObject({ phase: 'redirect', redirect: 'upsell' });
    expectInert(nonStoreExpiry);
    expect(directPaywallDecision('downgrade', { state: expired('reverse_trial') })).toMatchObject({
      phase: 'redirect',
      redirect: 'reoffer',
      lifecycleDisposition: 'supersede',
    });
    expect(directPaywallDecision('downgrade', { state: activeReverseTrial() })).toMatchObject({
      phase: 'redirect',
      redirect: 'reoffer',
      lifecycleDisposition: 'supersede',
    });
  });

  it('limits re-offer to an active or expired reverse trial', () => {
    expect(directPaywallDecision('reoffer', { state: activeReverseTrial() })).toMatchObject({
      phase: 'offer',
      variant: 'active_reverse_trial',
      lifecycleDisposition: 'supersede',
    });
    expect(directPaywallDecision('reoffer', { state: expired('reverse_trial') })).toMatchObject({
      phase: 'offer',
      variant: 'expired_reverse_trial',
      lifecycleDisposition: 'present',
    });

    const paidExpiry = directPaywallDecision('reoffer', { state: expired('normal') });
    expect(paidExpiry).toMatchObject({
      phase: 'redirect',
      redirect: 'downgrade',
      lifecycleDisposition: 'supersede',
    });
    expectInert(paidExpiry);

    for (const state of [absent(), activeStore()]) {
      const decision = directPaywallDecision('reoffer', { state });
      expect(decision.phase).toBe('redirect');
      expectInert(decision);
    }
  });

  it('offers ordinary subscriptions without custom reverse-trial grants', () => {
    expect(directPaywallDecision('onboarding', { state: absent() })).toMatchObject({
      phase: 'offer',
      allowPurchase: true,
      allowReverseTrial: false,
    });
    expect(directPaywallDecision('onboarding', { state: expired('normal') })).toMatchObject({
      phase: 'offer',
      allowPurchase: true,
      allowReverseTrial: false,
    });

    const active = directPaywallDecision('onboarding', { state: activeStore() });
    expect(active).toMatchObject({ phase: 'redirect', redirect: 'routine_plan' });
    expectInert(active);
  });
});
