export type CycleLengthBounds = {
  minLength: number;
  maxLength: number;
  requiredRecoveryNights?: number;
};

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * Calculates floor(maxFrequencyPerWeek * lengthNights / 7) without allowing
 * the intermediate multiplication to exceed Number.MAX_SAFE_INTEGER.
 */
function weeklyOccurrenceBudget(maxFrequencyPerWeek: number, lengthNights: number): number {
  if (maxFrequencyPerWeek >= 7) return lengthNights;

  const completeWeeks = Math.floor(lengthNights / 7);
  const remainingNights = lengthNights % 7;
  return (
    completeWeeks * maxFrequencyPerWeek + Math.floor((remainingNights * maxFrequencyPerWeek) / 7)
  );
}

/** Maximum occurrences a repeated cycle can apply without exceeding a weekly ceiling. */
export function allowedCycleOccurrences(
  maxFrequencyPerWeek: number,
  lengthNights: number,
  requiredRecoveryNights = 1,
): number {
  if (
    !isPositiveSafeInteger(maxFrequencyPerWeek) ||
    !isPositiveSafeInteger(lengthNights) ||
    !isNonNegativeSafeInteger(requiredRecoveryNights) ||
    requiredRecoveryNights > lengthNights
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      lengthNights - requiredRecoveryNights,
      weeklyOccurrenceBudget(maxFrequencyPerWeek, lengthNights),
    ),
  );
}

/** Smallest bounded cycle where requested occurrences obey the same weekly ceiling. */
export function minimumCycleLengthForOccurrences(
  occurrences: number,
  maxFrequencyPerWeek: number,
  bounds: CycleLengthBounds,
): number | null {
  if (
    !isNonNegativeSafeInteger(occurrences) ||
    !isPositiveSafeInteger(maxFrequencyPerWeek) ||
    !bounds ||
    typeof bounds !== 'object' ||
    Array.isArray(bounds)
  ) {
    return null;
  }

  const { minLength, maxLength, requiredRecoveryNights = 1 } = bounds;
  if (
    !isPositiveSafeInteger(minLength) ||
    !isPositiveSafeInteger(maxLength) ||
    minLength > maxLength ||
    !isNonNegativeSafeInteger(requiredRecoveryNights) ||
    requiredRecoveryNights > maxLength
  ) {
    return null;
  }

  if (occurrences > maxLength - requiredRecoveryNights) return null;

  let lowerBound = Math.max(minLength, occurrences + requiredRecoveryNights);
  if (
    allowedCycleOccurrences(maxFrequencyPerWeek, maxLength, requiredRecoveryNights) < occurrences
  ) {
    return null;
  }

  let upperBound = maxLength;
  while (lowerBound < upperBound) {
    const candidate = lowerBound + Math.floor((upperBound - lowerBound) / 2);
    if (
      allowedCycleOccurrences(maxFrequencyPerWeek, candidate, requiredRecoveryNights) >= occurrences
    ) {
      upperBound = candidate;
    } else {
      lowerBound = candidate + 1;
    }
  }

  return lowerBound;
}
