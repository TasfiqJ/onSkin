import { describe, expect, it } from 'vitest';

import {
  NATIVE_AGE_ASSURANCE_RESPONSE_INVALID,
  decodeNativeAgeAssuranceResponseJSON,
  evaluateNativeAgeAssuranceMinimumAge,
  normalizeNativeAgeAssuranceRequestId,
  type NativeAgeAssuranceDeclaration,
} from './nativeAgeAssuranceContract';

const REQUEST_ID = '10000000-0000-4000-8000-000000000001';
const OTHER_REQUEST_ID = '20000000-0000-4000-8000-000000000002';

const declarations: readonly NativeAgeAssuranceDeclaration[] = [
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
];

function sharedResponse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    requestId: REQUEST_ID,
    availability: 'available',
    regulatoryEligibility: 'eligible',
    sharingStatus: 'shared',
    ageRange: { lowerBound: 16, upperBound: null },
    declaration: 'payment_checked',
    parentalControls: {
      anyEnabled: false,
      communicationLimitsEnabled: false,
    },
    ...overrides,
  };
}

function unavailableResponse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    requestId: REQUEST_ID,
    availability: 'unsupported_os',
    regulatoryEligibility: 'unknown',
    sharingStatus: 'not_requested',
    ageRange: null,
    declaration: 'not_provided',
    parentalControls: null,
    ...overrides,
  };
}

function decode(value: Record<string, unknown>) {
  return decodeNativeAgeAssuranceResponseJSON(JSON.stringify(value), REQUEST_ID);
}

function expectInvalid(value: Record<string, unknown>, requestId: string = REQUEST_ID) {
  expect(() => decodeNativeAgeAssuranceResponseJSON(JSON.stringify(value), requestId)).toThrow(
    NATIVE_AGE_ASSURANCE_RESPONSE_INVALID,
  );
}

describe('native declared age range response contract', () => {
  it('accepts every Apple declaration method without using it to grant access', () => {
    for (const declaration of declarations) {
      const response = decode(sharedResponse({ declaration }));
      expect(response.declaration).toBe(declaration);
      expect(evaluateNativeAgeAssuranceMinimumAge(response)).toEqual({
        allowed: true,
        reason: 'shared_lower_bound_at_or_above_minimum',
      });
    }
  });

  it('grants only from a shared lower bound at or above 16', () => {
    const adult = decode(sharedResponse());
    expect(evaluateNativeAgeAssuranceMinimumAge(adult)).toEqual({
      allowed: true,
      reason: 'shared_lower_bound_at_or_above_minimum',
    });

    for (const ageRange of [
      { lowerBound: 15, upperBound: 17 },
      { lowerBound: null, upperBound: 15 },
    ]) {
      expect(evaluateNativeAgeAssuranceMinimumAge(decode(sharedResponse({ ageRange })))).toEqual({
        allowed: false,
        reason: 'shared_below_minimum',
      });
    }
  });

  it('fails closed for declined and unavailable results', () => {
    const declined = decode(
      sharedResponse({
        sharingStatus: 'declined',
        ageRange: null,
        declaration: 'not_provided',
        parentalControls: null,
      }),
    );
    expect(evaluateNativeAgeAssuranceMinimumAge(declined)).toEqual({
      allowed: false,
      reason: 'sharing_declined',
    });

    for (const availability of ['unsupported_os', 'sdk_unavailable', 'not_available']) {
      const response = decode(unavailableResponse({ availability }));
      expect(evaluateNativeAgeAssuranceMinimumAge(response)).toEqual({
        allowed: false,
        reason: 'assurance_unavailable',
      });
    }
  });

  it('requires an exact request-bound schema and excludes birth-date fields', () => {
    expectInvalid(sharedResponse({ requestId: OTHER_REQUEST_ID }));
    expectInvalid({ ...sharedResponse(), dateOfBirth: '2000-01-01' });

    const missing = sharedResponse();
    delete missing.parentalControls;
    expectInvalid(missing);

    expect(() =>
      decodeNativeAgeAssuranceResponseJSON(JSON.stringify(sharedResponse()), OTHER_REQUEST_ID),
    ).toThrow(NATIVE_AGE_ASSURANCE_RESPONSE_INVALID);
  });

  it('rejects malformed, oversized, or noncanonical request inputs', () => {
    expect(() => decodeNativeAgeAssuranceResponseJSON('{', REQUEST_ID)).toThrow(
      NATIVE_AGE_ASSURANCE_RESPONSE_INVALID,
    );
    expect(() => decodeNativeAgeAssuranceResponseJSON(`"${'a'.repeat(4097)}"`, REQUEST_ID)).toThrow(
      NATIVE_AGE_ASSURANCE_RESPONSE_INVALID,
    );
    expect(() =>
      decodeNativeAgeAssuranceResponseJSON(JSON.stringify(sharedResponse()), 'INVALID'),
    ).toThrow(NATIVE_AGE_ASSURANCE_RESPONSE_INVALID);
    expect(normalizeNativeAgeAssuranceRequestId(REQUEST_ID)).toBe(REQUEST_ID);
    const alphaRequestId = 'a0000000-0000-4000-8000-000000000001';
    expect(normalizeNativeAgeAssuranceRequestId(alphaRequestId)).toBe(alphaRequestId);
    expect(normalizeNativeAgeAssuranceRequestId(alphaRequestId.toUpperCase())).toBeNull();
    expect(normalizeNativeAgeAssuranceRequestId(` ${REQUEST_ID} `)).toBe(REQUEST_ID);
    expect(normalizeNativeAgeAssuranceRequestId(42)).toBeNull();
  });

  it('rejects empty, reversed, fractional, and out-of-range age bounds', () => {
    for (const ageRange of [
      { lowerBound: null, upperBound: null },
      { lowerBound: 18, upperBound: 17 },
      { lowerBound: 15.5, upperBound: 17 },
      { lowerBound: -1, upperBound: 15 },
      { lowerBound: 16, upperBound: 151 },
      { lowerBound: 16, upperBound: 17, exactAge: 16 },
    ]) {
      expectInvalid(sharedResponse({ ageRange }));
    }
  });

  it('rejects incoherent availability, sharing, declaration, and parental controls', () => {
    const incoherent = [
      sharedResponse({ availability: 'not_available' }),
      sharedResponse({ regulatoryEligibility: 'unknown' }),
      unavailableResponse({ regulatoryEligibility: 'eligible' }),
      unavailableResponse({ availability: 'available' }),
      unavailableResponse({
        sharingStatus: 'declined',
        availability: 'not_available',
      }),
      unavailableResponse({
        ageRange: { lowerBound: 16, upperBound: null },
      }),
      unavailableResponse({ declaration: 'self_declared' }),
      unavailableResponse({
        parentalControls: {
          anyEnabled: false,
          communicationLimitsEnabled: false,
        },
      }),
      sharedResponse({ ageRange: null }),
      sharedResponse({ parentalControls: null }),
      sharedResponse({
        parentalControls: {
          anyEnabled: false,
          communicationLimitsEnabled: true,
        },
      }),
    ];

    for (const value of incoherent) expectInvalid(value);
  });

  it('returns frozen, data-minimized objects', () => {
    const response = decode(
      sharedResponse({
        parentalControls: {
          anyEnabled: true,
          communicationLimitsEnabled: true,
        },
      }),
    );
    expect(Object.isFrozen(response)).toBe(true);
    expect(Object.isFrozen(response.ageRange)).toBe(true);
    expect(Object.isFrozen(response.parentalControls)).toBe(true);
    expect(Object.keys(response).sort()).toEqual([
      'ageRange',
      'availability',
      'declaration',
      'parentalControls',
      'regulatoryEligibility',
      'requestId',
      'schemaVersion',
      'sharingStatus',
    ]);
  });
});
