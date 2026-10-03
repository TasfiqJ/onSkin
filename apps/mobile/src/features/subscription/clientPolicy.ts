/** Pure client-side admission rules. No price arithmetic and no access grants. */
export type StandardPlan = 'annual' | 'monthly';

export type StorePackageShape = Readonly<{
  identifier: string;
  offeringIdentifier: string;
  presentedOfferingContext?: Readonly<{ offeringIdentifier: string }> | null;
  product: Readonly<{
    identifier: string;
    subscriptionPeriod: string | null;
    productCategory?: unknown;
    price: number;
    priceString: string;
    currencyCode: string;
  }>;
}>;

type CurrentOffering<T extends StorePackageShape> = Readonly<{
  identifier: string;
  annual: T | null;
  monthly: T | null;
  availablePackages: readonly T[];
}>;

function nonblank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** A package slot is not proof of product identity, duration, or usable pricing. */
export function standardStorePackage<T extends StorePackageShape>(
  current: CurrentOffering<T> | null,
  plan: StandardPlan,
  productIds: Readonly<Record<StandardPlan, string>>,
): T | null {
  if (
    !current ||
    !nonblank(current.identifier) ||
    !nonblank(productIds.annual) ||
    !nonblank(productIds.monthly) ||
    productIds.annual === productIds.monthly ||
    !Array.isArray(current.availablePackages)
  ) return null;

  const matches = current.availablePackages.filter(
    (pack) => pack?.product?.identifier === productIds[plan],
  );
  // Ambiguous duplicate configuration must be repaired in RevenueCat, not guessed here.
  if (matches.length !== 1) return null;
  const pack = matches[0];
  const slot = current[plan];
  if (slot && (slot.identifier !== pack.identifier ||
    slot.product?.identifier !== pack.product.identifier ||
    slot.product?.price !== pack.product.price ||
    slot.product?.priceString !== pack.product.priceString ||
    slot.product?.currencyCode !== pack.product.currencyCode ||
    slot.product?.subscriptionPeriod !== pack.product.subscriptionPeriod)) return null;
  if (
    !pack ||
    pack.identifier !== matches[0].identifier ||
    !nonblank(pack.identifier) ||
    pack.product?.identifier !== productIds[plan] ||
    pack.product.subscriptionPeriod !== (plan === 'annual' ? 'P1Y' : 'P1M') ||
    pack.product.productCategory !== 'SUBSCRIPTION' ||
    !Number.isFinite(pack.product.price) ||
    pack.product.price <= 0 ||
    !nonblank(pack.product.priceString) ||
    !/^[A-Z]{3}$/.test(pack.product.currencyCode) ||
    pack.offeringIdentifier !== current.identifier ||
    (pack.presentedOfferingContext != null &&
      pack.presentedOfferingContext.offeringIdentifier !== current.identifier)
  ) return null;
  // Keep the SDK object and localized priceString verbatim for the native checkout.
  return pack;
}

/** Calendar months and years are not fixed 30/365-day trial promises. */
export function exactIntroDays(
  unit: string | undefined,
  units: number | undefined,
  cycles = 1,
): number | null {
  if (!Number.isSafeInteger(units) || !units || units < 1 ||
      !Number.isSafeInteger(cycles) || cycles < 1) return null;
  const multiplier = unit === 'DAY' ? 1 : unit === 'WEEK' ? 7 : null;
  if (multiplier === null) return null;
  const days = units * cycles * multiplier;
  return Number.isSafeInteger(days) && days > 0 ? days : null;
}

/** URL configuration is a prerequisite, not legal approval or an uptime test. */
export function isConfiguredPolicyUrl(value: unknown): boolean {
  if (typeof value !== 'string' || value.trim() !== value ||
      /[\u0000-\u0020\u007f\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    return url.protocol === 'https:' && !url.username && !url.password &&
      (!url.port || url.port === '443') && host.includes('.') &&
      !/^[\d.]+$/.test(host) && !host.includes(':') &&
      !/(^|\.)(localhost|local|invalid|test|example)$/.test(host) &&
      !/(^|\.)example\.(com|org|net)$/.test(host);
  } catch {
    return false;
  }
}

export function subscriptionPoliciesConfigured(terms: unknown, privacy: unknown): boolean {
  return isConfiguredPolicyUrl(terms) && isConfiguredPolicyUrl(privacy);
}

export function subscriptionNetworkAvailable(state: Readonly<{
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
}>): boolean {
  return state.isConnected === true && state.isInternetReachable === true;
}

export const SUBSCRIPTION_CLIENT_MESSAGES = {
  SUBSCRIPTION_POLICIES_UNAVAILABLE:
    'Subscription checkout is unavailable because Terms or Privacy is not configured. You can continue free, restore purchases, or manage an existing subscription.',
  SUBSCRIPTION_NETWORK_REQUIRED:
    'Connect to the internet to check store pricing or subscribe. Previously verified access remains available until its verified expiry; the free plan is still available.',
  SUBSCRIPTION_ACCESS_UNCONFIRMED:
    'We could not confirm your current plan. Do not buy again yet. Check access or use Restore purchases.',
  SUBSCRIPTION_ALREADY_ACTIVE:
    'This account already has verified Pro access. Manage your existing subscription instead of buying again.',
  REVENUECAT_OFFERING_UNAVAILABLE:
    'Store pricing is unavailable or has changed. Refresh store pricing before trying again.',
} as const;

export function subscriptionClientMessage(error: unknown): string | null {
  const code = error instanceof Error ? error.message : null;
  return code && Object.prototype.hasOwnProperty.call(SUBSCRIPTION_CLIENT_MESSAGES, code)
    ? SUBSCRIPTION_CLIENT_MESSAGES[code as keyof typeof SUBSCRIPTION_CLIENT_MESSAGES]
    : null;
}
