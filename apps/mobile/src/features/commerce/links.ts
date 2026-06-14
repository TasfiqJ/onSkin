import type { AffiliateSource } from '@onskin/types';

import { buildOutboundUrl } from './attribution';

// Rail-agnostic "where to buy" resolution (docs/10 §5, the B-SHOPMY hedge). The
// research surfaced a BLOCKING unknown: ShopMy's documented APIs do not confirm a
// brand can mint affiliate links on its OWN first-party recommendations under a house
// account (link creation is creator-OAuth-only; the Brand Partners API is reporting-
// only, poll-based, no webhooks). So the boundary is SOURCE-TAGGED. Swapping ShopMy
// ⇄ Skimlinks/Sovrn/direct is a localised change. Pure + testable; the live
// resolution (ShopMy Search Catalog / Create Link, or a fallback rail) is stubbed
// behind B-SHOPMY + B-CATALOG-SEED.

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

function toSource(s: string): AffiliateSource {
  return s === 'shopmy' || s === 'skimlinks' || s === 'direct' ? s : 'none';
}

/** Resolve the disclosed retailer options for a recommended product TYPE, from the
 *  affiliate_links catalog. Pure: the hook supplies the rows (DB in prod, a dev demo
 *  set otherwise). Returns [] when none. The surface then shows the honest empty
 *  state, never a fabricated retailer. NEVER sorted by commission (church and state):
 *  there is no rate field here to sort by. */
export function resolveWhereToBuy(productType: string, rows: AffiliateLinkRow[]): WhereToBuyOption[] {
  return rows
    .filter((r) => r.is_active && r.product_type === productType)
    .map((r) => ({
      id: r.id,
      retailer: r.retailer,
      label: r.label,
      url: r.url,
      priceCents: r.price_cents,
      currency: r.currency ?? 'USD',
      source: toSource(r.source),
      isPaid: r.is_paid,
    }));
}

/** The final outbound URL for a tapped option. Opaque token only (attribution.ts). */
export function outboundFor(option: WhereToBuyOption, clickToken: string): string {
  return buildOutboundUrl(option.url, clickToken);
}

/** A dev-only demo set so the "where to buy" surface renders the design before the
 *  catalogue lands (B-CATALOG-SEED). Clearly placeholder ("partner retailer"); never
 *  used in production (the prod path returns [] until real links exist). */
export function demoWhereToBuy(productType: string): AffiliateLinkRow[] {
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  if (!isDev) return [];
  return [
    {
      id: `demo-${productType}-1`,
      product_type: productType,
      retailer: 'Partner retailer',
      label: 'Zinc Mineral SPF 30',
      url: 'https://example.com/p/demo-1',
      price_cents: 3400,
      currency: 'USD',
      source: 'none',
      is_paid: true,
      is_active: true,
    },
    {
      id: `demo-${productType}-2`,
      product_type: productType,
      retailer: 'Another retailer',
      label: 'Mineral Fluid SPF 30',
      url: 'https://example.com/p/demo-2',
      price_cents: 2900,
      currency: 'USD',
      source: 'none',
      is_paid: true,
      is_active: true,
    },
  ];
}

/** Format a price for the disclosed label (illustrative until B-CATALOG-SEED). */
export function formatPrice(priceCents: number | null, currency = 'USD'): string | null {
  if (priceCents == null) return null;
  const amount = (priceCents / 100).toFixed(priceCents % 100 === 0 ? 0 : 2);
  return currency === 'USD' ? `$${amount}` : `${amount} ${currency}`;
}
