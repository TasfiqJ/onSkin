import type { PlanId } from '@onskin/types';

import type { SubscriptionOfferingView, SubscriptionPackageView } from '@/lib/iap/revenuecat';

import { monthlyEquivalent, PLANS } from './plans';

export type PlanPriceDisplay = {
  introLabel: string;
  priceLabel: string;
  periodLabel: 'year' | 'month' | null;
  pricePerMonthLabel: string | null;
  reason: string | null;
  canShowPurchasePrice: boolean;
};

function packageDisplay(pack: SubscriptionPackageView, reason: string | null): PlanPriceDisplay {
  return {
    introLabel: pack.trialDays ? `Start ${pack.trialDays} days free, then` : 'Subscribe for',
    priceLabel: pack.priceLabel,
    periodLabel: pack.periodLabel,
    pricePerMonthLabel: pack.pricePerMonthLabel,
    reason,
    canShowPurchasePrice: true,
  };
}

function fallbackDisplay(plan: PlanId, reason: string | null = null): PlanPriceDisplay {
  const fallback = PLANS[plan];
  return {
    introLabel: fallback.trialDays ? `Start ${fallback.trialDays} days free, then` : 'Subscribe for',
    priceLabel: fallback.priceLabel,
    periodLabel: fallback.unit,
    pricePerMonthLabel: plan === 'annual' ? monthlyEquivalent(fallback.priceLabel) : null,
    reason,
    canShowPurchasePrice: true,
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
  if (!offering) return fallbackDisplay(plan);
  const pack = offering[plan];
  if (pack) {
    return packageDisplay(pack, offering.status === 'available' ? null : offering.reason);
  }
  return unavailableDisplay(offering.status === 'available' ? null : offering.reason);
}

export function planLineLabel(display: PlanPriceDisplay): string {
  return display.periodLabel ? `${display.priceLabel}/${display.periodLabel}` : display.priceLabel;
}
