import type { PlanId } from '@onskin/types';

import { env } from '@/lib/env';

/**
 * The plan catalog (docs/08 §2.3). Annual is the DEFAULT (Health & Fitness earns
 * 68% of revenue from annual, retains ~3.6× better than weekly); monthly is the
 * anchor, not the default; there is NO weekly plan (worst retention, off-brand).
 *
 * IMPORTANT: these price labels are FALLBACK display values only. At runtime the
 * real, **localized** prices come from the RevenueCat Offering (docs/08 §12
 * "render in the store's localized currency from the offering. Never hardcoded")
 *. Wired once the SDK + account exist (B-REVENUECAT). The premium price is itself
 * under A/B test ($49.99 candidate vs $39.99 baseline, docs/08 §10), configured
 * remotely via offerings, so nothing here is a committed price.
 */

export type Plan = {
  id: PlanId;
  productId: string;
  /** Local development display label only; live/loading paywalls use RevenueCat offering data. */
  priceLabel: string;
  unit: 'year' | 'month';
  trialDays: number;
};

export const PLANS: Record<PlanId, Plan> = {
  annual: {
    id: 'annual',
    productId: env.revenueCatAnnualProductId,
    priceLabel: '$49.99',
    unit: 'year',
    trialDays: 14,
  },
  monthly: {
    id: 'monthly',
    productId: env.revenueCatMonthlyProductId,
    priceLabel: '$8.99',
    unit: 'month',
    trialDays: 0,
  },
};

export const DEFAULT_PLAN: PlanId = 'annual';
/** The reverse trial: full Pro, no card, for this many days (docs/08 §2.2). */
export const REVERSE_TRIAL_DAYS = 7;

/** A respectful, ARL-clean win-back offer after a lapse (docs/08 §6, design 09). */
export const WINBACK = { priceLabel: '$34.99', originalLabel: '$49.99', percentOff: 30 } as const;

/** Parse "$49.99" → 49.99 (fallback-label math only; never for real billing). */
export function priceAmount(label: string): number {
  const n = Number(label.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** The "$4.16/mo" equivalent shown beside the annual price (display sugar). Floor
 *  to 2dp so it never overstates the per-month cost ($49.99/12 → $4.16, not $4.17). */
export function monthlyEquivalent(annualLabel: string): string {
  const perMonth = Math.floor((priceAmount(annualLabel) / 12) * 100) / 100;
  return `$${perMonth.toFixed(2)}`;
}

/** "Start 14 days free, then $49.99/year". The honest, billed-amount-conspicuous
 *  offer line (docs/08 §3.1; the price is the most prominent element in the UI). */
export function offerLine(plan: Plan): string {
  return plan.trialDays > 0
    ? `Start ${plan.trialDays} days free, then ${plan.priceLabel}/${plan.unit}`
    : `${plan.priceLabel}/${plan.unit}`;
}
