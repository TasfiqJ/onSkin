// PHOTO-05A zero-admission boundary.
//
// The release binary has no validated trend engine
// (`phase7Capabilities.trendEngine` is the sole literal authority and is false).
// Keep these compatibility exports inert so a stale route, legacy consent, photo
// history, caller-provided source, or future fixture cannot mount private-data
// observers while the engine is unavailable.

export type TrendQueryOptions = Readonly<{ enabled?: boolean }>;

export type TrendPhotoSource = Readonly<{
  data?: unknown;
  isLoading?: unknown;
  isSuccess?: unknown;
}>;

export type UnavailableTrendConsentResult = Readonly<{
  data: false;
  isError: false;
  isLoading: false;
  isSuccess: true;
  status: 'success';
}>;

export type UnavailableMonkBandResult = Readonly<{
  data: null;
  isError: false;
  isLoading: false;
  isSuccess: true;
  status: 'success';
}>;

export type UnavailableTrendInsightResult = Readonly<{
  consented: false;
  insight: null;
  isLoading: false;
}>;

const UNAVAILABLE_CONSENT_RESULT: UnavailableTrendConsentResult = Object.freeze({
  data: false,
  isError: false,
  isLoading: false,
  isSuccess: true,
  status: 'success',
});

const UNAVAILABLE_MONK_BAND_RESULT: UnavailableMonkBandResult = Object.freeze({
  data: null,
  isError: false,
  isLoading: false,
  isSuccess: true,
  status: 'success',
});

const UNAVAILABLE_INSIGHT_RESULT: UnavailableTrendInsightResult = Object.freeze({
  consented: false,
  insight: null,
  isLoading: false,
});

/** Reserved compatibility read. No skin-profile transport runs without an engine. */
export async function readMonkBand(): Promise<number | null> {
  return null;
}

/** No consent observer or local/server consent read mounts without an engine. */
export function useTrendConsent(_options: TrendQueryOptions = {}): UnavailableTrendConsentResult {
  return UNAVAILABLE_CONSENT_RESULT;
}

/** No profile observer or network request mounts without an engine. */
export function useMonkBand(_options: TrendQueryOptions = {}): UnavailableMonkBandResult {
  return UNAVAILABLE_MONK_BAND_RESULT;
}

/**
 * Caller input is intentionally not inspected. In particular, a legacy photo
 * snapshot with getters cannot trigger a read or synthesize a positive insight.
 */
export function useTrendInsightFromPhotos(
  _photos: TrendPhotoSource,
  _options: TrendQueryOptions = {},
): UnavailableTrendInsightResult {
  return UNAVAILABLE_INSIGHT_RESULT;
}

/** No standalone photo observer mounts while Trend admission is closed. */
export function useTrendInsight(): UnavailableTrendInsightResult {
  return UNAVAILABLE_INSIGHT_RESULT;
}
