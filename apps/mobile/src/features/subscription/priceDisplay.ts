import type { PlanId } from '@onskin/types';

import type { SubscriptionOfferingView, SubscriptionPackageView } from '@/lib/iap/revenuecat';

export type PlanPriceDisplay = {
  introLabel: string;
  priceLabel: string;
  periodLabel: 'year' | 'month' | null;
  pricePerMonthLabel: string | null;
  reason: string | null;
  canShowPurchasePrice: boolean;
};

function packageDisplay(pack: SubscriptionPackageView, reason: string | null): PlanPriceDisplay {
  const eligibleTrialDays = pack.trialEligibility === 'eligible' ? pack.trialDays : null;
  return {
    introLabel: eligibleTrialDays ? `Start ${eligibleTrialDays} days free, then` : 'Subscribe for',
    priceLabel: pack.priceLabel,
    periodLabel: pack.periodLabel,
    pricePerMonthLabel: pack.pricePerMonthLabel,
    reason,
    canShowPurchasePrice: true,
  };
}

function checkingDisplay(): PlanPriceDisplay {
  return {
    introLabel: 'Store pricing',
    priceLabel: 'Checking price',
    periodLabel: null,
    pricePerMonthLabel: null,
    reason: null,
    canShowPurchasePrice: false,
  };
}

function unavailableDisplay(reason: string | null): PlanPriceDisplay {
  return {
    introLabel: 'Store pricing',
    priceLabel: 'Price unavailable',
    periodLabel: null,
    pricePerMonthLabel: null,
    reason,
    canShowPurchasePrice: false,
  };
}

export function planPriceDisplay(
  plan: PlanId,
  offering: SubscriptionOfferingView | undefined,
): PlanPriceDisplay {
  if (!offering) return checkingDisplay();
  const pack = offering[plan];
  if (pack) {
    return packageDisplay(pack, offering.status === 'available' ? null : offering.reason);
  }
  return unavailableDisplay(offering.status === 'available' ? null : offering.reason);
}

export function planLineLabel(display: PlanPriceDisplay): string {
  return display.periodLabel ? `${display.priceLabel}/${display.periodLabel}` : display.priceLabel;
}
