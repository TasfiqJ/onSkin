import { describe, expect, it, vi } from 'vitest';

import {
  APP_ASK_ROUTE,
  APP_COMMERCE_STACKS_ROUTE,
  APP_COMMUNITY_ROUTE,
  APP_HOME_ROUTE,
  APP_PROGRESS_ROUTE,
  APP_RECOMMENDATIONS_ROUTE,
  APP_SHELF_ROUTE,
  APP_TREND_OPTIN_ROUTE,
  APP_YOU_ROUTE,
  backOrReplace,
  type BackOrReplaceRouter,
} from './safeBack';

function routerWithHistory(canGoBack: boolean): BackOrReplaceRouter {
  return {
    canGoBack: vi.fn(() => canGoBack),
    back: vi.fn(),
    replace: vi.fn(),
  };
}

describe('safe back navigation', () => {
  it('uses native back navigation when history exists', () => {
    const router = routerWithHistory(true);

    backOrReplace(router);

    expect(router.back).toHaveBeenCalledOnce();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('replaces direct-entry screens with the app home route', () => {
    const router = routerWithHistory(false);

    backOrReplace(router);

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith(APP_HOME_ROUTE);
  });

  it('replaces direct-entry screens with a route-specific fallback', () => {
    const router = routerWithHistory(false);

    backOrReplace(router, APP_SHELF_ROUTE);

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith(APP_SHELF_ROUTE);
  });

  it('supports Progress as a route-specific fallback', () => {
    const router = routerWithHistory(false);

    backOrReplace(router, APP_PROGRESS_ROUTE);

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith(APP_PROGRESS_ROUTE);
  });

  it('supports You as a route-specific fallback', () => {
    const router = routerWithHistory(false);

    backOrReplace(router, APP_YOU_ROUTE);

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith(APP_YOU_ROUTE);
  });

  it('supports Recommendations as a route-specific fallback', () => {
    const router = routerWithHistory(false);

    backOrReplace(router, APP_RECOMMENDATIONS_ROUTE);

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith(APP_RECOMMENDATIONS_ROUTE);
  });

  it('supports Commerce stacks as a route-specific fallback', () => {
    const router = routerWithHistory(false);

    backOrReplace(router, APP_COMMERCE_STACKS_ROUTE);

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith(APP_COMMERCE_STACKS_ROUTE);
  });

  it('supports Trend opt-in as a route-specific fallback', () => {
    const router = routerWithHistory(false);

    backOrReplace(router, APP_TREND_OPTIN_ROUTE);

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith(APP_TREND_OPTIN_ROUTE);
  });

  it('supports Community as a route-specific fallback', () => {
    const router = routerWithHistory(false);

    backOrReplace(router, APP_COMMUNITY_ROUTE);

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith(APP_COMMUNITY_ROUTE);
  });

  it('supports Ask as a route-specific fallback', () => {
    const router = routerWithHistory(false);

    backOrReplace(router, APP_ASK_ROUTE);

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith(APP_ASK_ROUTE);
  });
});
