import { describe, expect, it, vi } from 'vitest';

import {
  dismissPaywall,
  PAYWALL_DISMISS_FALLBACK_ROUTE,
  type PaywallDismissRouter,
} from './dismissPaywall';

function routerWithHistory(canGoBack: boolean): PaywallDismissRouter {
  return {
    canGoBack: vi.fn(() => canGoBack),
    back: vi.fn(),
    replace: vi.fn(),
  };
}

describe('paywall dismissal', () => {
  it('returns to the previous route when paywall history exists', () => {
    const router = routerWithHistory(true);

    dismissPaywall(router);

    expect(router.back).toHaveBeenCalledOnce();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('replaces direct-entry paywalls with the safe Today route', () => {
    const router = routerWithHistory(false);

    dismissPaywall(router);

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith(PAYWALL_DISMISS_FALLBACK_ROUTE);
  });
});
