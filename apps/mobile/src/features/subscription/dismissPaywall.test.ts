import { beforeEach, describe, expect, it, vi } from 'vitest';

import { APP_PROGRESS_ROUTE, APP_SHELF_ROUTE } from '@/lib/navigation/safeBack';

import {
  dismissPaywall,
  PAYWALL_DISMISS_FALLBACK_ROUTE,
  paywallDismissFallbackForFeature,
  type PaywallDismissRouter,
} from './dismissPaywall';

const mocks = vi.hoisted(() => ({
  track: vi.fn(),
}));

vi.mock('@/lib/analytics/track', () => ({
  track: mocks.track,
}));

function routerWithHistory(canGoBack: boolean): PaywallDismissRouter {
  return {
    canGoBack: vi.fn(() => canGoBack),
    back: vi.fn(),
    replace: vi.fn(),
  };
}

describe('paywall dismissal', () => {
  beforeEach(() => {
    mocks.track.mockClear();
  });

  it('returns to the previous route when paywall history exists', () => {
    const router = routerWithHistory(true);

    dismissPaywall(router);

    expect(mocks.track).toHaveBeenCalledWith('paywall_dismissed', { surface: 'paywall' });
    expect(router.back).toHaveBeenCalledOnce();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('replaces direct-entry paywalls with the safe Today route', () => {
    const router = routerWithHistory(false);

    dismissPaywall(router);

    expect(mocks.track).toHaveBeenCalledWith('paywall_dismissed', { surface: 'paywall' });
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith(PAYWALL_DISMISS_FALLBACK_ROUTE);
  });

  it('replaces direct-entry photo timeline paywalls with the Progress tab', () => {
    const router = routerWithHistory(false);

    dismissPaywall(router, paywallDismissFallbackForFeature('photo_timeline'));

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith(APP_PROGRESS_ROUTE);
  });

  it('replaces direct-entry conflict-check paywalls with the Shelf tab', () => {
    const router = routerWithHistory(false);

    dismissPaywall(router, paywallDismissFallbackForFeature('conflict_checks'));

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith(APP_SHELF_ROUTE);
  });

  it('keeps generic contextual paywalls on the safe Today fallback', () => {
    expect(paywallDismissFallbackForFeature('scheduler')).toBe(PAYWALL_DISMISS_FALLBACK_ROUTE);
    expect(paywallDismissFallbackForFeature('reminders_widgets')).toBe(
      PAYWALL_DISMISS_FALLBACK_ROUTE,
    );
    expect(paywallDismissFallbackForFeature('full_routine')).toBe(PAYWALL_DISMISS_FALLBACK_ROUTE);
    expect(paywallDismissFallbackForFeature('ask')).toBe(PAYWALL_DISMISS_FALLBACK_ROUTE);
  });
});
