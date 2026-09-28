import {
  APP_HOME_ROUTE,
  APP_PROGRESS_ROUTE,
  APP_SHELF_ROUTE,
  backOrReplace,
  type AppFallbackRoute,
  type BackOrReplaceRouter,
} from '@/lib/navigation/safeBack';
import { track } from '@/lib/analytics/track';
import type { GatedFeature } from '@layerwell/types';

export const PAYWALL_DISMISS_FALLBACK_ROUTE = APP_HOME_ROUTE;

export type PaywallDismissRouter = BackOrReplaceRouter;

export function paywallDismissFallbackForFeature(feature: GatedFeature): AppFallbackRoute {
  if (feature === 'photo_timeline') return APP_PROGRESS_ROUTE;
  if (feature === 'conflict_checks') return APP_SHELF_ROUTE;

  return PAYWALL_DISMISS_FALLBACK_ROUTE;
}

export function dismissPaywall(
  router: PaywallDismissRouter,
  fallbackRoute: AppFallbackRoute = PAYWALL_DISMISS_FALLBACK_ROUTE,
) {
  track('paywall_dismissed', { surface: 'paywall' });
  backOrReplace(router, fallbackRoute);
}
