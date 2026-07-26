import { describe, expect, it } from 'vitest';

import {
  allowedCycleOccurrences,
  minimumCycleLengthForOccurrences,
  type CycleLengthBounds,
} from './cadence';

describe('allowedCycleOccurrences', () => {
  it('preserves the weekly ceiling and required recovery capacity', () => {
    expect(allowedCycleOccurrences(1, 1)).toBe(0);
    expect(allowedCycleOccurrences(1, 7)).toBe(1);
    expect(allowedCycleOccurrences(2, 14)).toBe(4);
    expect(allowedCycleOccurrences(7, 7)).toBe(6);
    expect(allowedCycleOccurrences(7, 7, 0)).toBe(7);
    expect(allowedCycleOccurrences(7, 7, 7)).toBe(0);
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -1,
    0,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
  ])('fails closed for invalid weekly frequencies (%s)', (frequency) => {
    expect(allowedCycleOccurrences(frequency, 7)).toBe(0);
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -1,
    0,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
  ])('fails closed for invalid cycle lengths (%s)', (length) => {
    expect(allowedCycleOccurrences(1, length)).toBe(0);
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
  ])('fails closed for invalid recovery requirements (%s)', (recovery) => {
    expect(allowedCycleOccurrences(7, 7, recovery)).toBe(0);
  });

  it('fails closed when recovery exceeds the entire cycle', () => {
    expect(allowedCycleOccurrences(7, 7, 8)).toBe(0);
  });

  it('does not overflow for safe-integer inputs near the numeric limit', () => {
    expect(
      allowedCycleOccurrences(
        Number.MAX_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER - 1,
      ),
    ).toBe(1);
    expect(allowedCycleOccurrences(1, Number.MAX_SAFE_INTEGER, 0)).toBe(
      Math.floor(Number.MAX_SAFE_INTEGER / 7),
    );
  });
});

describe('minimumCycleLengthForOccurrences', () => {
  const bounds: CycleLengthBounds = {
    minLength: 1,
    maxLength: 14,
  };

  it('returns the smallest bounded cycle that satisfies cadence and recovery', () => {
    expect(minimumCycleLengthForOccurrences(1, 1, bounds)).toBe(7);
    expect(minimumCycleLengthForOccurrences(7, 7, bounds)).toBe(8);
    expect(minimumCycleLengthForOccurrences(14, 7, bounds)).toBeNull();
    expect(
      minimumCycleLengthForOccurrences(1, 7, {
        minLength: 1,
        maxLength: 4,
        requiredRecoveryNights: 2,
      }),
    ).toBe(3);
  });

  it('honors recovery capacity even when zero occurrences are requested', () => {
    expect(
      minimumCycleLengthForOccurrences(0, 1, {
        minLength: 1,
        maxLength: 7,
        requiredRecoveryNights: 3,
      }),
    ).toBe(3);
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
  ])('rejects invalid requested occurrence counts (%s)', (occurrences) => {
    expect(minimumCycleLengthForOccurrences(occurrences, 1, bounds)).toBeNull();
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -1,
    0,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
  ])('rejects invalid weekly frequencies (%s)', (frequency) => {
    expect(minimumCycleLengthForOccurrences(1, frequency, bounds)).toBeNull();
  });

  it.each([
    { minLength: Number.NaN, maxLength: 14 },
    { minLength: Number.POSITIVE_INFINITY, maxLength: 14 },
    { minLength: 1.5, maxLength: 14 },
    { minLength: 0, maxLength: 14 },
    { minLength: -1, maxLength: 14 },
    { minLength: 1, maxLength: Number.NaN },
    { minLength: 1, maxLength: Number.POSITIVE_INFINITY },
    { minLength: 1, maxLength: 14.5 },
    { minLength: 1, maxLength: 0 },
    { minLength: 8, maxLength: 7 },
    { minLength: 1, maxLength: Number.MAX_SAFE_INTEGER + 1 },
  ])('rejects invalid length bounds (%o)', (invalidBounds) => {
    expect(minimumCycleLengthForOccurrences(1, 1, invalidBounds as CycleLengthBounds)).toBeNull();
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
  ])('rejects invalid required recovery bounds (%s)', (requiredRecoveryNights) => {
    expect(
      minimumCycleLengthForOccurrences(1, 1, {
        minLength: 1,
        maxLength: 14,
        requiredRecoveryNights,
      }),
    ).toBeNull();
  });

  it('rejects malformed or impossible bounds without throwing', () => {
    expect(minimumCycleLengthForOccurrences(1, 1, null as unknown as CycleLengthBounds)).toBeNull();
    expect(minimumCycleLengthForOccurrences(1, 1, [] as unknown as CycleLengthBounds)).toBeNull();
    expect(
      minimumCycleLengthForOccurrences(1, 7, {
        minLength: 1,
        maxLength: 7,
        requiredRecoveryNights: 8,
      }),
    ).toBeNull();
  });

  it('handles safe-integer limits without overflow or a linear scan', () => {
    expect(
      minimumCycleLengthForOccurrences(Number.MAX_SAFE_INTEGER - 1, Number.MAX_SAFE_INTEGER, {
        minLength: 1,
        maxLength: Number.MAX_SAFE_INTEGER,
        requiredRecoveryNights: 1,
      }),
    ).toBe(Number.MAX_SAFE_INTEGER);

    expect(
      minimumCycleLengthForOccurrences(Math.floor(Number.MAX_SAFE_INTEGER / 7) + 1, 1, {
        minLength: 1,
        maxLength: Number.MAX_SAFE_INTEGER,
        requiredRecoveryNights: 0,
      }),
    ).toBeNull();
  });
});
