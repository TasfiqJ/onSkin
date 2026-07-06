export const APP_HOME_ROUTE = '/(tabs)/today' as const;
export const APP_SHELF_ROUTE = '/(tabs)/shelf' as const;
export const APP_PROGRESS_ROUTE = '/(tabs)/progress' as const;
export const APP_YOU_ROUTE = '/(tabs)/you' as const;
export const APP_RECOMMENDATIONS_ROUTE = '/recommendations' as const;
export const APP_COMMERCE_STACKS_ROUTE = '/commerce/stacks' as const;
export const APP_TREND_OPTIN_ROUTE = '/trend/optin' as const;
export const APP_COMMUNITY_ROUTE = '/community' as const;
export const APP_ASK_ROUTE = '/ask' as const;

export type AppFallbackRoute =
  | typeof APP_HOME_ROUTE
  | typeof APP_SHELF_ROUTE
  | typeof APP_PROGRESS_ROUTE
  | typeof APP_YOU_ROUTE
  | typeof APP_RECOMMENDATIONS_ROUTE
  | typeof APP_COMMERCE_STACKS_ROUTE
  | typeof APP_TREND_OPTIN_ROUTE
  | typeof APP_COMMUNITY_ROUTE
  | typeof APP_ASK_ROUTE;

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
