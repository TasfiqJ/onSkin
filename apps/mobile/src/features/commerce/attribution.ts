import { appendExternalQueryParam } from '@/lib/navigation/externalUrl';

// Opaque-token attribution (docs/10 §5/§7). The trust guarantee, validated by the
// MHMDA research: a "where to buy" hand-off shares ONLY an opaque correlation token
// with the affiliate partner. NEVER a health-adjacent attribute (concern, goal,
// skin axis, pregnancy, photo, profile). This is Doc 10's analogue of the docs/09
// "FIT score has no commercial input" guard: a structural, tested guarantee, not a
// promise. Pure + unit-tested; token GENERATION (native crypto) lives in store.ts so
// this stays a pure, vitest-friendly module.

/** The single query param we append. Deliberately opaque and NOT containing any
 *  health term (so it never trips the health-leak guard, and reads as anonymous). */
export const ATTRIBUTION_PARAM = 'oref';

/** Health-adjacent substrings that must NEVER appear in an outbound commerce URL we
 *  build. If any shows up, we are leaking skin data to a retailer (MHMDA breach). */
export const HEALTH_DENYLIST = [
  'concern',
  'goal',
  'acne',
  'rosacea',
  'eczema',
  'sensitiv',
  'pregnan',
  'baumann',
  'dspt',
  'profile',
  'photo',
  'health',
  'condition',
  'axis',
  'retinoid',
  'diagnos',
] as const;

/**
 * Build the outbound retailer URL for a "where to buy" tap. Appends ONLY the opaque
 * click token. The signature accepts no profile/health argument, so health data
 * cannot be attached even by mistake (docs/10 §5). Deep-link straight out; no in-app
 * webview (keeps the app out of the transaction + reduces data-handling liability).
 */
export function buildOutboundUrl(retailerUrl: string, clickToken: string): string | null {
  return appendExternalQueryParam(retailerUrl, ATTRIBUTION_PARAM, clickToken);
}

/** True if a URL contains any health-adjacent term. Used to prove an outbound link
 *  never leaks skin data (the tested invariant). Case-insensitive. */
export function urlLeaksHealthData(
  url: string,
  denylist: readonly string[] = HEALTH_DENYLIST,
): boolean {
  const lower = url.toLowerCase();
  return denylist.some((term) => lower.includes(term));
}

/** Guard for the click-event payload that gets persisted/mirrored: it may carry only
 *  the opaque token, the product TYPE, the source, and the consent flag. Never any
 *  extra identifier, raw URL, free text, or health-adjacent key (docs/10 §9. The
 *  table has no health column; this is the belt-and-suspenders at the app boundary). */
export type ClickPayload = {
  clickToken: string;
  productType: string | null;
  source: string;
  consented: boolean;
};

const CLICK_PAYLOAD_KEYS = ['clickToken', 'consented', 'productType', 'source'] as const;
const CLICK_PAYLOAD_KEY_SET = new Set<string>(CLICK_PAYLOAD_KEYS);
const SAFE_OPAQUE_TOKEN = /^[A-Za-z0-9_-]{1,128}$/;
const SAFE_PRODUCT_TYPE = /^[a-z0-9_:-]{1,80}$/;
const AFFILIATE_SOURCE_VALUES = new Set(['shopmy', 'skimlinks', 'direct', 'none']);

function isCleanCommerceValue(value: string): boolean {
  return !value.includes('@') && !/https?:\/\//i.test(value) && !/file:\/\/|content:\/\//i.test(value);
}

export function isHealthSafePayload(payload: Record<string, unknown>): boolean {
  const keys = Object.keys(payload);
  if (keys.length !== CLICK_PAYLOAD_KEYS.length) return false;
  if (!keys.every((key) => CLICK_PAYLOAD_KEY_SET.has(key) && !urlLeaksHealthData(key))) return false;

  const clickToken = payload.clickToken;
  if (typeof clickToken !== 'string' || !SAFE_OPAQUE_TOKEN.test(clickToken) || !isCleanCommerceValue(clickToken)) {
    return false;
  }

  const productType = payload.productType;
  if (
    productType !== null &&
    (typeof productType !== 'string' || !SAFE_PRODUCT_TYPE.test(productType) || !isCleanCommerceValue(productType))
  ) {
    return false;
  }

  const source = payload.source;
  if (typeof source !== 'string' || !AFFILIATE_SOURCE_VALUES.has(source) || !isCleanCommerceValue(source)) {
    return false;
  }

  return typeof payload.consented === 'boolean';
}
