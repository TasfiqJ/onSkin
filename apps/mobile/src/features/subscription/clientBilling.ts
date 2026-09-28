/** Display-only billing observations. These values never grant Pro access. */
export type ClientBillingStatus = Readonly<{
  kind: 'unknown' | 'active' | 'renewal_off' | 'expired' | 'billing_issue' | 'grace';
  productId: string | null;
  observedAt: string | null;
  date: string | null;
}>;

const UNKNOWN: ClientBillingStatus = Object.freeze({
  kind: 'unknown', productId: null, observedAt: null, date: null,
});
const MAX_BILLING_OBSERVATION_AGE_MS = 5 * 60 * 1000;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function instant(value: unknown): number | null {
  if (typeof value !== 'string' || value.trim() !== value ||
      !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function selectedInfo(value: unknown, entitlementId: string, includeInactive: boolean) {
  const customer = record(value);
  const entitlements = record(customer?.entitlements);
  const active = record(entitlements?.active);
  const all = record(entitlements?.all);
  const selected = record(active?.[entitlementId] ?? (includeInactive ? all?.[entitlementId] : null));
  const productId = typeof selected?.productIdentifier === 'string'
    ? selected.productIdentifier : null;
  const subscriptions = record(customer?.subscriptionsByProductIdentifier);
  const subscription = productId ? record(subscriptions?.[productId]) : null;
  return { customer, entitlements, selected, subscription, productId };
}

/**
 * A currently reported, signed store grace period can bound existing access.
 * Historical grace dates, unsigned data, and inactive entitlements cannot extend it.
 * This does not manufacture a duration or mutate the provider's evidence cursor.
 */
export function storeEntitlementExpiry(customerInfo: unknown, entitlementId: string): string | null {
  const { customer, entitlements, selected, subscription, productId } =
    selectedInfo(customerInfo, entitlementId, false);
  const base = instant(selected?.expirationDate);
  if (base === null) return null;
  const request = instant(customer?.requestDate);
  const grace = instant(subscription?.gracePeriodExpiresDate);
  const issue = instant(selected?.billingIssueDetectedAt) ??
    instant(subscription?.billingIssuesDetectedAt);
  const sameSubscription = subscription?.productIdentifier === productId &&
    subscription?.store === selected?.store;
  if (
    entitlements?.verification === 'VERIFIED' && selected?.verification === 'VERIFIED' &&
    selected.isActive === true && (selected.store === 'APP_STORE' || selected.store === 'PLAY_STORE') &&
    sameSubscription && request !== null && grace !== null && issue !== null &&
    issue <= request && grace > request && grace > base
  ) return new Date(grace).toISOString();
  return new Date(base).toISOString();
}

export function readClientBillingStatus(
  customerInfo: unknown,
  entitlementId: string,
  expectedProductId: string | null,
  configuredProducts: readonly string[],
  nowMs: number,
): ClientBillingStatus {
  const { customer, entitlements, selected, subscription, productId } =
    selectedInfo(customerInfo, entitlementId, true);
  const request = instant(customer?.requestDate);
  if (
    !selected || !productId || !configuredProducts.includes(productId) ||
    (expectedProductId !== null && productId !== expectedProductId) ||
    entitlements?.verification !== 'VERIFIED' || selected.verification !== 'VERIFIED' ||
    (selected.store !== 'APP_STORE' && selected.store !== 'PLAY_STORE') ||
    request === null || !Number.isFinite(nowMs) || request > nowMs ||
    nowMs - request > MAX_BILLING_OBSERVATION_AGE_MS
  ) return UNKNOWN;

  const sameSubscription = subscription?.productIdentifier === productId &&
    subscription?.store === selected.store;
  const issue = instant(selected.billingIssueDetectedAt) ??
    (sameSubscription ? instant(subscription?.billingIssuesDetectedAt) : null);
  const grace = sameSubscription ? instant(subscription?.gracePeriodExpiresDate) : null;
  const base = instant(selected.expirationDate);
  const date = base === null ? null : new Date(base).toISOString();
  const observation = { productId, observedAt: new Date(request).toISOString(), date };
  if (issue !== null && issue <= request) {
    if (selected.isActive === true && grace !== null && grace > nowMs) {
      return { ...observation, kind: 'grace', date: new Date(grace).toISOString() };
    }
    return { ...observation, kind: 'billing_issue' };
  }
  if (selected.isActive !== true || (base !== null && base <= nowMs)) {
    return { ...observation, kind: 'expired' };
  }
  if (base === null) return UNKNOWN;
  if (selected.willRenew === false) return { ...observation, kind: 'renewal_off' };
  return selected.willRenew === true ? { ...observation, kind: 'active' } : UNKNOWN;
}

/** Stale display metadata must not keep an old grace/cancellation badge alive. */
export function currentBillingStatus(
  status: ClientBillingStatus | undefined,
  nowMs: number,
): ClientBillingStatus {
  const observed = instant(status?.observedAt);
  if (!status || observed === null || !Number.isFinite(nowMs) || nowMs < observed ||
      nowMs - observed > MAX_BILLING_OBSERVATION_AGE_MS) return UNKNOWN;
  const end = instant(status.date);
  if (end !== null && end <= nowMs &&
      (status.kind === 'active' || status.kind === 'renewal_off' || status.kind === 'grace')) {
    // Refresh, rather than declaring an unobserved renewal or final expiry.
    return UNKNOWN;
  }
  return status;
}

export function billingStatusCopy(status: ClientBillingStatus): Readonly<{
  label: string;
  message: string;
}> {
  switch (status.kind) {
    case 'grace': return {
      label: 'Billing grace period',
      message: 'The store reports a billing grace period. Update your payment details in Manage subscriptions. Pro access follows the verified store expiry, not this message.',
    };
    case 'billing_issue': return {
      label: 'Billing issue',
      message: 'The store reports a payment issue. Check Manage subscriptions before buying again. This message does not extend Pro access.',
    };
    case 'renewal_off': return {
      label: 'Auto-renewal off',
      message: 'Auto-renewal is off. Verified access continues until its expiry. Manage subscriptions shows the current store details.',
    };
    case 'expired': return {
      label: 'Store subscription ended',
      message: 'The store reports that this subscription is no longer active. Your saved data remains available; paid features require verified access.',
    };
    case 'active': return {
      label: 'Auto-renewal on',
      message: 'The store currently reports auto-renewal on. Manage subscriptions is where you can review or cancel renewal.',
    };
    default: return {
      label: 'Check store details',
      message: 'Current billing details are unavailable. Previously verified access is not erased by this check. Use Manage subscriptions or Restore purchases to check the store account.',
    };
  }
}
