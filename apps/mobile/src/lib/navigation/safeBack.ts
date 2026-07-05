export const APP_HOME_ROUTE = '/(tabs)/today' as const;
export const APP_SHELF_ROUTE = '/(tabs)/shelf' as const;

export type AppFallbackRoute = typeof APP_HOME_ROUTE | typeof APP_SHELF_ROUTE;

export type BackOrReplaceRouter = {
  canGoBack: () => boolean;
  back: () => void;
  replace: (route: AppFallbackRoute) => void;
};

export function backOrReplace(
  router: BackOrReplaceRouter,
  fallbackRoute: AppFallbackRoute = APP_HOME_ROUTE,
) {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallbackRoute);
}
