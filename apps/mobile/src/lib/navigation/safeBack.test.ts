import { describe, expect, it, vi } from 'vitest';

import {
  APP_HOME_ROUTE,
  APP_PROGRESS_ROUTE,
  APP_SHELF_ROUTE,
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
});
