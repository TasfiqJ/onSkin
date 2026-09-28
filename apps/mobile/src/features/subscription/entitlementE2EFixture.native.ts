import type { SubscriptionState } from './entitlement';

/** The iOS/Android bundle has no local entitlement-fixture authority. */
export function e2eEntitlementDelayMs(): number {
  return 0;
}

/** The iOS/Android bundle can obtain Pro only from durable authority evidence. */
export function e2eEntitlementState(): SubscriptionState | null {
  return null;
}
