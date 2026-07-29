import type { AffiliateSource } from '@onskin/types';

// Dormant rail-agnostic shapes remain for compatibility. COM-01A admits no
// retailer rows or outbound URL in any runtime.

export type AffiliateLinkRow = {
  id: string;
  product_type: string;
  retailer: string;
  label: string;
  url: string;
  price_cents: number | null;
  currency: string | null;
  source: string;
  is_paid: boolean;
  is_active: boolean;
};

export type WhereToBuyOption = {
  id: string;
  retailer: string;
  label: string;
  /** The retailer/pin base URL. The opaque attribution token is appended at tap. */
  url: string;
  priceCents: number | null;
  currency: string;
  source: AffiliateSource;
  isPaid: boolean;
};

/** COM-01A: supplied rows cannot become a runtime retailer option. */
export function resolveWhereToBuy(
  _productType: string,
  _rows: AffiliateLinkRow[],
): WhereToBuyOption[] {
  return [];
}

/** No outbound retailer URL exists while commerce admission is closed. */
export function outboundFor(_option: WhereToBuyOption, _clickToken: string): null {
  return null;
}

/** Development and E2E runtimes receive no simulated retailer rows. */
export function demoWhereToBuy(_productType: string): AffiliateLinkRow[] {
  return [];
}

/** Format a price for the disclosed label (illustrative until B-CATALOG-SEED). */
export function formatPrice(priceCents: number | null, currency = 'USD'): string | null {
  if (priceCents == null) return null;
  const amount = (priceCents / 100).toFixed(priceCents % 100 === 0 ? 0 : 2);
  return currency === 'USD' ? `$${amount}` : `${amount} ${currency}`;
}
