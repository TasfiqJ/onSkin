type RevenueCatPeriod = Readonly<{
  periodUnit: string;
  periodNumberOfUnits: number;
}>;

type RevenueCatWinBackPeriod = RevenueCatPeriod &
  Readonly<{
    cycles: number;
  }>;

function unitLabel(unit: string): string | null {
  const normalized = unit.toUpperCase();
  if (normalized === 'DAY') return 'day';
  if (normalized === 'WEEK') return 'week';
  if (normalized === 'MONTH') return 'month';
  if (normalized === 'YEAR') return 'year';
  return null;
}

function positiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

export function revenueCatPeriodLabel(period: RevenueCatPeriod): string | null {
  const unit = unitLabel(period.periodUnit);
  if (!unit || !positiveInteger(period.periodNumberOfUnits)) return null;
  const units = period.periodNumberOfUnits;
  return units === 1 ? unit : `${units} ${unit}s`;
}

export function revenueCatOfferDurationLabel(offer: RevenueCatWinBackPeriod): string | null {
  const unit = unitLabel(offer.periodUnit);
  if (!unit || !positiveInteger(offer.periodNumberOfUnits) || !positiveInteger(offer.cycles)) {
    return null;
  }
  const totalUnits = offer.periodNumberOfUnits * offer.cycles;
  if (!Number.isSafeInteger(totalUnits)) return null;
  return `${totalUnits} ${unit}${totalUnits === 1 ? '' : 's'}`;
}

export function comparableWinBackPercentOff(input: {
  offerPeriod: string;
  standardPeriod: string | null;
  offerPrice: number;
  standardPrice: number;
}): number | null {
  if (
    !input.standardPeriod ||
    input.offerPeriod !== input.standardPeriod ||
    !Number.isFinite(input.offerPrice) ||
    input.offerPrice < 0 ||
    !Number.isFinite(input.standardPrice) ||
    input.standardPrice <= 0
  ) {
    return null;
  }
  return Math.round(Math.max(0, 1 - input.offerPrice / input.standardPrice) * 100);
}
