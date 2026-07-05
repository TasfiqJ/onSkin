import { APP_HOME_ROUTE, backOrReplace, type BackOrReplaceRouter } from '@/lib/navigation/safeBack';

export const PAYWALL_DISMISS_FALLBACK_ROUTE = APP_HOME_ROUTE;

export type PaywallDismissRouter = BackOrReplaceRouter;

export function dismissPaywall(router: PaywallDismissRouter) {
  backOrReplace(router);
}
