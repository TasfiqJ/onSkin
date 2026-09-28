import type { SubscriptionState } from './entitlement';

/** Node/test resolver and unsupported-platform default: never grant or delay access. */
export function e2eEntitlementDelayMs(): number {
  return 0;
}

/** Positive entitlement fixtures are confined to the Expo web implementation. */
export function e2eEntitlementState(): SubscriptionState | null {
  return null;
}
