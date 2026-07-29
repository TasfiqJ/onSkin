// Dormant attribution shapes and diagnostic helpers remain for compatibility.
// COM-01A constructs no outbound URL and admits no click payload.

/** Legacy parameter name retained for compatibility; COM-01A never appends it. */
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

/** Compatibility builder. No retailer URL or token can be issued under COM-01A. */
export function buildOutboundUrl(_retailerUrl: string, _clickToken: string): null {
  return null;
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

/** Legacy click shape retained for cleanup/export and dormant caller compatibility. */
export type ClickPayload = {
  clickToken: string;
  productType: string | null;
  source: string;
  consented: boolean;
};

export function isHealthSafePayload(_payload: Record<string, unknown>): false {
  return false;
}
