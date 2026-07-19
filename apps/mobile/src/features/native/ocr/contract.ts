export const LABEL_OCR_CONTRACT_VERSION = 1 as const;
export const LABEL_OCR_ENGINE = 'apple_vision_legacy' as const;
export const LABEL_OCR_REQUEST_REVISION = 3 as const;
export const LABEL_OCR_RECOGNITION_LEVEL = 'accurate' as const;
export const LABEL_OCR_RUNS_ON_DEVICE = true as const;
export const LABEL_OCR_MAX_OBSERVATIONS = 128;
export const LABEL_OCR_MAX_CANDIDATES = 2;
export const LABEL_OCR_MAX_CANDIDATE_SCALARS = 512;
export const LABEL_OCR_MAX_CANDIDATE_UTF8_BYTES = 2 * 1024;
export const LABEL_OCR_MAX_AGGREGATE_CANDIDATE_UTF8_BYTES = 64 * 1024;
export const LABEL_OCR_MAX_RESPONSE_UTF8_BYTES = 128 * 1024;
export const LABEL_OCR_MAX_TRANSCRIPT_UTF8_BYTES = 32 * 1024;
export const LABEL_OCR_TIMEOUT_MS = 12_000;

export const LABEL_OCR_NATIVE_UNAVAILABLE = 'LABEL_OCR_NATIVE_UNAVAILABLE';
export const LABEL_OCR_NATIVE_RESPONSE_INVALID = 'LABEL_OCR_NATIVE_RESPONSE_INVALID';
export const LABEL_OCR_NATIVE_TIMEOUT_CODE = 'E_LABEL_OCR_TIMEOUT';

const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const MANAGED_PHOTO_URI =
  /^file:\/\/\/.+\/catalog-label-photo-temp-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$/u;

const RESPONSE_KEYS = ['observations', 'requestId', 'schemaVersion', 'status', 'truncated'].sort();
const OBSERVATION_KEYS = ['boundingBox', 'candidates'].sort();
const BOUNDING_BOX_KEYS = ['height', 'width', 'x', 'y'].sort();
const CANDIDATE_KEYS = ['confidence', 'text'].sort();
const CANCEL_KEYS = ['requestId', 'schemaVersion', 'status'].sort();

export type LabelOcrBoundingBox = Readonly<{
  /** Normalized Vision coordinate, whose origin is the lower-left corner. */
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type LabelOcrCandidate = Readonly<{
  text: string;
  /** Vision ranking signal, not a calibrated probability or user-facing percentage. */
  confidence: number;
}>;

export type LabelOcrObservation = Readonly<{
  boundingBox: LabelOcrBoundingBox;
  candidates: readonly LabelOcrCandidate[];
}>;

export type LabelOcrNativeResponse = Readonly<{
  schemaVersion: typeof LABEL_OCR_CONTRACT_VERSION;
  requestId: string;
  status: 'recognized' | 'no_text' | 'cancelled';
  truncated: boolean;
  observations: readonly LabelOcrObservation[];
}>;

export type LabelOcrNativeCancelReceipt = Readonly<{
  schemaVersion: typeof LABEL_OCR_CONTRACT_VERSION;
  requestId: string;
  status: 'cancel_requested' | 'not_found';
}>;

export type LabelOcrNativeAvailability =
  | 'configured'
  | 'not_configured'
  | 'unavailable'
  | 'misconfigured';

export type LabelOcrNativeAdapter = Readonly<{
  availability: () => LabelOcrNativeAvailability;
  recognize: (managedPhotoUri: string, requestId: string) => Promise<LabelOcrNativeResponse>;
  cancel: (requestId: string) => Promise<LabelOcrNativeCancelReceipt>;
}>;

function invalid(): never {
  throw new Error(LABEL_OCR_NATIVE_RESPONSE_INVALID);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isLabelOcrNativeTimeoutError(value: unknown): boolean {
  try {
    return isRecord(value) && value.code === LABEL_OCR_NATIVE_TIMEOUT_CODE;
  } catch {
    return false;
  }
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === keys[index]);
}

function isUnitNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isUnicodeNoncharacter(codePoint: number): boolean {
  return (
    (codePoint >= 0xfdd0 && codePoint <= 0xfdef) ||
    (codePoint <= 0x10ffff && (codePoint & 0xfffe) === 0xfffe)
  );
}

function normalizeCandidateText(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) invalid();

  for (const scalar of value) {
    const codePoint = scalar.codePointAt(0);
    if (
      codePoint === undefined ||
      (codePoint >= 0xd800 && codePoint <= 0xdfff) ||
      isUnicodeNoncharacter(codePoint) ||
      codePoint === 0x2028 ||
      codePoint === 0x2029 ||
      codePoint === 0xfeff ||
      /\p{Cc}/u.test(scalar) ||
      (/\p{Cf}/u.test(scalar) && codePoint !== 0x200c && codePoint !== 0x200d)
    ) {
      invalid();
    }
  }

  const normalized = value.normalize('NFC').replace(/\s+/gu, ' ').trim();
  if (
    normalized.length === 0 ||
    [...normalized].length > LABEL_OCR_MAX_CANDIDATE_SCALARS ||
    utf8Bytes(normalized) > LABEL_OCR_MAX_CANDIDATE_UTF8_BYTES
  ) {
    invalid();
  }
  return normalized;
}

function parseJSON(json: unknown): unknown {
  if (
    typeof json !== 'string' ||
    utf8Bytes(json) === 0 ||
    utf8Bytes(json) > LABEL_OCR_MAX_RESPONSE_UTF8_BYTES
  ) {
    invalid();
  }
  try {
    return JSON.parse(json);
  } catch {
    invalid();
  }
}

export function normalizeLabelOcrRequestId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return REQUEST_ID.test(normalized) ? normalized : null;
}

/**
 * Performs the JS-side half of the managed-photo trust boundary. Native code
 * must additionally prove that the file is a direct, regular, non-symlink
 * child of the current application cache directory before reading it.
 */
export function isManagedLabelPhotoUri(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 2_048 &&
    !value.includes('?') &&
    !value.includes('#') &&
    MANAGED_PHOTO_URI.test(value)
  );
}

export function decodeLabelOcrNativeResponseJSON(
  json: unknown,
  expectedRequestIdValue: unknown,
): LabelOcrNativeResponse {
  const value = parseJSON(json);
  const expectedRequestId = normalizeLabelOcrRequestId(expectedRequestIdValue);
  if (
    expectedRequestId === null ||
    !isRecord(value) ||
    !exactKeys(value, RESPONSE_KEYS) ||
    value.schemaVersion !== LABEL_OCR_CONTRACT_VERSION ||
    value.requestId !== expectedRequestId ||
    (value.status !== 'recognized' && value.status !== 'no_text' && value.status !== 'cancelled') ||
    typeof value.truncated !== 'boolean' ||
    !Array.isArray(value.observations) ||
    value.observations.length > LABEL_OCR_MAX_OBSERVATIONS
  ) {
    invalid();
  }

  let aggregateCandidateBytes = 0;
  const observations = value.observations.map((observation): LabelOcrObservation => {
    if (
      !isRecord(observation) ||
      !exactKeys(observation, OBSERVATION_KEYS) ||
      !isRecord(observation.boundingBox) ||
      !exactKeys(observation.boundingBox, BOUNDING_BOX_KEYS) ||
      !isUnitNumber(observation.boundingBox.x) ||
      !isUnitNumber(observation.boundingBox.y) ||
      !isUnitNumber(observation.boundingBox.width) ||
      !isUnitNumber(observation.boundingBox.height) ||
      observation.boundingBox.width <= 0 ||
      observation.boundingBox.height <= 0 ||
      observation.boundingBox.x + observation.boundingBox.width > 1 + 1e-6 ||
      observation.boundingBox.y + observation.boundingBox.height > 1 + 1e-6 ||
      !Array.isArray(observation.candidates) ||
      observation.candidates.length === 0 ||
      observation.candidates.length > LABEL_OCR_MAX_CANDIDATES
    ) {
      invalid();
    }

    let previousConfidence = Number.POSITIVE_INFINITY;
    const candidateTexts = new Set<string>();
    const candidates = observation.candidates.map((candidate): LabelOcrCandidate => {
      if (
        !isRecord(candidate) ||
        !exactKeys(candidate, CANDIDATE_KEYS) ||
        typeof candidate.text !== 'string' ||
        [...candidate.text].length > LABEL_OCR_MAX_CANDIDATE_SCALARS ||
        utf8Bytes(candidate.text) > LABEL_OCR_MAX_CANDIDATE_UTF8_BYTES ||
        !isUnitNumber(candidate.confidence) ||
        candidate.confidence > previousConfidence
      ) {
        invalid();
      }
      aggregateCandidateBytes += utf8Bytes(candidate.text);
      if (aggregateCandidateBytes > LABEL_OCR_MAX_AGGREGATE_CANDIDATE_UTF8_BYTES) invalid();
      const text = normalizeCandidateText(candidate.text);
      if (candidateTexts.has(text)) invalid();
      candidateTexts.add(text);
      previousConfidence = candidate.confidence;
      return Object.freeze({ text, confidence: candidate.confidence });
    });

    const width = Math.min(observation.boundingBox.width, 1 - observation.boundingBox.x);
    const height = Math.min(observation.boundingBox.height, 1 - observation.boundingBox.y);
    if (width <= 0 || height <= 0) invalid();

    return Object.freeze({
      boundingBox: Object.freeze({
        x: observation.boundingBox.x,
        y: observation.boundingBox.y,
        width,
        height,
      }),
      candidates: Object.freeze(candidates),
    });
  });

  if (
    (value.status === 'recognized' && observations.length === 0) ||
    (value.status !== 'recognized' && (observations.length !== 0 || value.truncated))
  ) {
    invalid();
  }

  return Object.freeze({
    schemaVersion: LABEL_OCR_CONTRACT_VERSION,
    requestId: expectedRequestId,
    status: value.status,
    truncated: value.truncated,
    observations: Object.freeze(observations),
  });
}

export function decodeLabelOcrNativeCancelReceiptJSON(
  json: unknown,
  expectedRequestIdValue: unknown,
): LabelOcrNativeCancelReceipt {
  const value = parseJSON(json);
  const expectedRequestId = normalizeLabelOcrRequestId(expectedRequestIdValue);
  if (
    expectedRequestId === null ||
    !isRecord(value) ||
    !exactKeys(value, CANCEL_KEYS) ||
    value.schemaVersion !== LABEL_OCR_CONTRACT_VERSION ||
    value.requestId !== expectedRequestId ||
    (value.status !== 'cancel_requested' && value.status !== 'not_found')
  ) {
    invalid();
  }
  return Object.freeze({
    schemaVersion: LABEL_OCR_CONTRACT_VERSION,
    requestId: expectedRequestId,
    status: value.status,
  });
}
