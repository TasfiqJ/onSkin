import { env } from '@/lib/env';

export type BillingCadence = 'annual' | 'monthly';

/** Billing cadence is authority only when the entitlement product matches the
 * exact build-configured Store product. Never infer it from a localized price. */
export function billingCadenceForProductId(productId: string | null): BillingCadence | null {
  if (!productId) return null;
  if (productId === env.revenueCatAnnualProductId) return 'annual';
  if (productId === env.revenueCatMonthlyProductId) return 'monthly';
  return null;
}

export function priceWithCadence(
  price: string,
  cadence: BillingCadence,
  form: 'long' | 'short' = 'long',
): string {
  const trimmed = price.trim();
  const amount = trimmed.replace(/\s*\/\s*(?:year|yr|month|mo)\.?$/iu, '');
  const unit = cadence === 'annual' ? (form === 'long' ? 'year' : 'yr') : 'month';
  return `${amount}/${unit}`;
}
