import { env, type AppEnvironment } from '@/lib/env';

import type { StoredEntitlement, SubscriptionState } from './entitlement';
import { resolveEntitlementCacheRead } from './entitlementEvidence';

export type EntitlementActionResult = {
  active: boolean;
  cancelled?: boolean;
  offerUnavailable?: boolean;
  storePurchaseFound?: boolean;
  successReceiptId?: string;
  pending?: boolean;
  verificationPending?: boolean;
  purchaseMayHaveCompleted?: boolean;
  entitlement: StoredEntitlement | null;
};

export function activeResult(
  entitlement: StoredEntitlement | null,
  extras?: Omit<EntitlementActionResult, 'active' | 'entitlement'>,
  options: { nowISO?: string; appEnvironment?: AppEnvironment } = {},
): EntitlementActionResult {
  const active = entitlement
    ? resolveEntitlementCacheRead(
        { status: 'available', entitlement },
        options.nowISO ?? new Date().toISOString(),
        options.appEnvironment ?? env.appEnvironment,
      ).isPro
    : false;
  return { active, entitlement, ...extras };
}

export function publishedActionResult(
  publishedState: SubscriptionState,
  entitlement: StoredEntitlement | null,
  extras?: Omit<EntitlementActionResult, 'active' | 'entitlement'>,
): EntitlementActionResult {
  return {
    active: publishedState.isPro,
    entitlement,
    ...extras,
  };
}
