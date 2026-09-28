export const NATIVE_AGE_ASSURANCE_CONTRACT_VERSION = 1 as const;
export const NATIVE_AGE_ASSURANCE_REVIEW_STATUS = 'launch_blocked' as const;
export const NATIVE_AGE_ASSURANCE_PROVIDER = 'apple_declared_age_range' as const;
export const NATIVE_AGE_ASSURANCE_MINIMUM_AGE = 16 as const;
export const NATIVE_AGE_ASSURANCE_MINIMUM_RUNTIME = 'iOS 26.2' as const;
export const NATIVE_AGE_ASSURANCE_MINIMUM_SDK = 'iOS 26.2' as const;
export const NATIVE_AGE_ASSURANCE_EXACT_BIRTH_DATE_COLLECTED = false as const;
export const NATIVE_AGE_ASSURANCE_MAX_RESPONSE_UTF8_BYTES = 4 * 1024;

export const NATIVE_AGE_ASSURANCE_UNAVAILABLE = 'NATIVE_AGE_ASSURANCE_UNAVAILABLE';
export const NATIVE_AGE_ASSURANCE_LAUNCH_BLOCKED = 'NATIVE_AGE_ASSURANCE_LAUNCH_BLOCKED';
export const NATIVE_AGE_ASSURANCE_RESPONSE_INVALID = 'NATIVE_AGE_ASSURANCE_RESPONSE_INVALID';

const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const RESPONSE_KEYS = [
  'ageRange',
  'availability',
  'declaration',
  'parentalControls',
  'regulatoryEligibility',
  'requestId',
  'schemaVersion',
  'sharingStatus',
].sort();
const RANGE_KEYS = ['lowerBound', 'upperBound'].sort();
const PARENTAL_CONTROL_KEYS = ['anyEnabled', 'communicationLimitsEnabled'].sort();

const AVAILABILITIES = new Set([
  'available',
  'unsupported_os',
  'sdk_unavailable',
  'not_available',
] as const);
const REGULATORY_ELIGIBILITIES = new Set(['eligible', 'not_eligible', 'unknown'] as const);
const SHARING_STATUSES = new Set(['shared', 'declined', 'not_requested'] as const);
const DECLARATIONS = new Set([
  'not_provided',
  'self_declared',
  'guardian_declared',
  'checked_by_other_method',
  'guardian_checked_by_other_method',
  'government_id_checked',
  'guardian_government_id_checked',
  'payment_checked',
  'guardian_payment_checked',
  'unknown',
] as const);

export type NativeAgeAssuranceAvailability =
  | 'available'
  | 'unsupported_os'
  | 'sdk_unavailable'
  | 'not_available';

export type NativeAgeAssuranceRegulatoryEligibility = 'eligible' | 'not_eligible' | 'unknown';

export type NativeAgeAssuranceSharingStatus = 'shared' | 'declined' | 'not_requested';

export type NativeAgeAssuranceDeclaration =
  | 'not_provided'
  | 'self_declared'
  | 'guardian_declared'
  | 'checked_by_other_method'
  | 'guardian_checked_by_other_method'
  | 'government_id_checked'
  | 'guardian_government_id_checked'
  | 'payment_checked'
  | 'guardian_payment_checked'
  | 'unknown';

export type NativeAgeAssuranceRange = Readonly<{
  lowerBound: number | null;
  upperBound: number | null;
}>;

export type NativeAgeAssuranceParentalControls = Readonly<{
  anyEnabled: boolean;
  communicationLimitsEnabled: boolean;
}>;

export type NativeAgeAssuranceResponse = Readonly<{
  schemaVersion: typeof NATIVE_AGE_ASSURANCE_CONTRACT_VERSION;
  requestId: string;
  availability: NativeAgeAssuranceAvailability;
  regulatoryEligibility: NativeAgeAssuranceRegulatoryEligibility;
  sharingStatus: NativeAgeAssuranceSharingStatus;
  ageRange: NativeAgeAssuranceRange | null;
  declaration: NativeAgeAssuranceDeclaration;
  parentalControls: NativeAgeAssuranceParentalControls | null;
}>;

export type NativeAgeAssuranceMinimumAgeDecision = Readonly<{
  allowed: boolean;
  reason:
    | 'shared_lower_bound_at_or_above_minimum'
    | 'shared_below_minimum'
    | 'sharing_declined'
    | 'assurance_unavailable';
}>;

export type NativeAgeAssuranceModuleAvailability =
  | 'launch_blocked'
  | 'unavailable'
  | 'misconfigured';

export type NativeAgeAssuranceAdapter = Readonly<{
  availability: () => NativeAgeAssuranceModuleAvailability;
  request: (requestId: string) => Promise<NativeAgeAssuranceResponse>;
}>;

function invalid(): never {
  throw new Error(NATIVE_AGE_ASSURANCE_RESPONSE_INVALID);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === keys[index]);
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function parseJSON(json: unknown): unknown {
  if (
    typeof json !== 'string' ||
    utf8Bytes(json) === 0 ||
    utf8Bytes(json) > NATIVE_AGE_ASSURANCE_MAX_RESPONSE_UTF8_BYTES
  ) {
    invalid();
  }
  try {
    return JSON.parse(json);
  } catch {
    invalid();
  }
}

function isAgeBound(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 150)
  );
}

export function normalizeNativeAgeAssuranceRequestId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return REQUEST_ID.test(normalized) ? normalized : null;
}

function decodeRange(value: unknown): NativeAgeAssuranceRange | null {
  if (value === null) return null;
  if (
    !isRecord(value) ||
    !exactKeys(value, RANGE_KEYS) ||
    !isAgeBound(value.lowerBound) ||
    !isAgeBound(value.upperBound) ||
    (value.lowerBound === null && value.upperBound === null) ||
    (value.lowerBound !== null && value.upperBound !== null && value.lowerBound > value.upperBound)
  ) {
    invalid();
  }
  return Object.freeze({
    lowerBound: value.lowerBound,
    upperBound: value.upperBound,
  });
}

function decodeParentalControls(value: unknown): NativeAgeAssuranceParentalControls | null {
  if (value === null) return null;
  if (
    !isRecord(value) ||
    !exactKeys(value, PARENTAL_CONTROL_KEYS) ||
    typeof value.anyEnabled !== 'boolean' ||
    typeof value.communicationLimitsEnabled !== 'boolean' ||
    (value.communicationLimitsEnabled && !value.anyEnabled)
  ) {
    invalid();
  }
  return Object.freeze({
    anyEnabled: value.anyEnabled,
    communicationLimitsEnabled: value.communicationLimitsEnabled,
  });
}

export function decodeNativeAgeAssuranceResponseJSON(
  json: unknown,
  expectedRequestIdValue: unknown,
): NativeAgeAssuranceResponse {
  const value = parseJSON(json);
  const expectedRequestId = normalizeNativeAgeAssuranceRequestId(expectedRequestIdValue);
  if (
    expectedRequestId === null ||
    !isRecord(value) ||
    !exactKeys(value, RESPONSE_KEYS) ||
    value.schemaVersion !== NATIVE_AGE_ASSURANCE_CONTRACT_VERSION ||
    value.requestId !== expectedRequestId ||
    typeof value.availability !== 'string' ||
    !AVAILABILITIES.has(value.availability as NativeAgeAssuranceAvailability) ||
    typeof value.regulatoryEligibility !== 'string' ||
    !REGULATORY_ELIGIBILITIES.has(
      value.regulatoryEligibility as NativeAgeAssuranceRegulatoryEligibility,
    ) ||
    typeof value.sharingStatus !== 'string' ||
    !SHARING_STATUSES.has(value.sharingStatus as NativeAgeAssuranceSharingStatus) ||
    typeof value.declaration !== 'string' ||
    !DECLARATIONS.has(value.declaration as NativeAgeAssuranceDeclaration)
  ) {
    invalid();
  }

  const availability = value.availability as NativeAgeAssuranceAvailability;
  const regulatoryEligibility =
    value.regulatoryEligibility as NativeAgeAssuranceRegulatoryEligibility;
  const sharingStatus = value.sharingStatus as NativeAgeAssuranceSharingStatus;
  const declaration = value.declaration as NativeAgeAssuranceDeclaration;
  const ageRange = decodeRange(value.ageRange);
  const parentalControls = decodeParentalControls(value.parentalControls);

  if (
    (sharingStatus === 'shared' &&
      (availability !== 'available' ||
        regulatoryEligibility === 'unknown' ||
        ageRange === null ||
        parentalControls === null)) ||
    (sharingStatus !== 'shared' &&
      (ageRange !== null || parentalControls !== null || declaration !== 'not_provided')) ||
    (sharingStatus === 'declined' && availability !== 'available') ||
    (sharingStatus === 'not_requested' && availability === 'available') ||
    ((availability === 'unsupported_os' || availability === 'sdk_unavailable') &&
      regulatoryEligibility !== 'unknown')
  ) {
    invalid();
  }

  return Object.freeze({
    schemaVersion: NATIVE_AGE_ASSURANCE_CONTRACT_VERSION,
    requestId: expectedRequestId,
    availability,
    regulatoryEligibility,
    sharingStatus,
    ageRange,
    declaration,
    parentalControls,
  });
}

/**
 * Apple requires minimum-age decisions to use the shared range's lower bound.
 * Every declined, unavailable, malformed, or below-threshold result stays
 * closed; an upper bound or declaration method can never grant access.
 */
export function evaluateNativeAgeAssuranceMinimumAge(
  response: NativeAgeAssuranceResponse,
): NativeAgeAssuranceMinimumAgeDecision {
  if (response.availability !== 'available') {
    return Object.freeze({ allowed: false, reason: 'assurance_unavailable' });
  }
  if (response.sharingStatus !== 'shared' || response.ageRange === null) {
    return Object.freeze({ allowed: false, reason: 'sharing_declined' });
  }
  if (
    response.ageRange.lowerBound === null ||
    response.ageRange.lowerBound < NATIVE_AGE_ASSURANCE_MINIMUM_AGE
  ) {
    return Object.freeze({ allowed: false, reason: 'shared_below_minimum' });
  }
  return Object.freeze({
    allowed: true,
    reason: 'shared_lower_bound_at_or_above_minimum',
  });
}
