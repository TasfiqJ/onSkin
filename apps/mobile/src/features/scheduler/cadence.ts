export type CycleLengthBounds = {
  minLength: number;
  maxLength: number;
  requiredRecoveryNights?: number;
};

/** Maximum occurrences a repeated cycle can apply without exceeding a weekly ceiling. */
export function allowedCycleOccurrences(
  maxFrequencyPerWeek: number,
  lengthNights: number,
  requiredRecoveryNights = 1,
): number {
  if (lengthNights <= 0 || maxFrequencyPerWeek <= 0) return 0;
  return Math.max(
    0,
    Math.min(
      lengthNights - requiredRecoveryNights,
      Math.floor((maxFrequencyPerWeek * lengthNights) / 7),
    ),
  );
}

/** Smallest bounded cycle where requested occurrences obey the same weekly ceiling. */
export function minimumCycleLengthForOccurrences(
  occurrences: number,
  maxFrequencyPerWeek: number,
  bounds: CycleLengthBounds,
): number | null {
  if (!Number.isInteger(occurrences) || occurrences < 0 || maxFrequencyPerWeek <= 0) return null;
  const { minLength, maxLength, requiredRecoveryNights = 1 } = bounds;
  if (!Number.isInteger(minLength) || !Number.isInteger(maxLength) || minLength > maxLength) {
    return null;
  }
  if (occurrences === 0) return minLength;
  for (let length = minLength; length <= maxLength; length += 1) {
    if (
      allowedCycleOccurrences(maxFrequencyPerWeek, length, requiredRecoveryNights) >= occurrences
    ) {
      return length;
    }
  }
  return null;
}
