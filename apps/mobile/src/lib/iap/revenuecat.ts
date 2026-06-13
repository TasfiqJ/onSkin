// BLOCKED: B-REVENUECAT — real `react-native-purchases` wiring (configure with
// the platform SDK keys, fetch offerings, purchasePackage, entitlement check)
// lands in the subscriptions/paywall slice (build-order #8, Document 8). This
// stub keeps the onboarding paywall flow navigable without the SDK/account.
//
// Pricing + trial from docs/00 §5 / docs/01 §2 (authorized): $39.99/yr, 14-day
// trial, single annual offer (NO trial toggle on iOS — Guideline 3.1.2).
export const PRO_ANNUAL = {
  productId: 'onskin_pro_annual',
  priceLabel: '$39.99/yr',
  perMonth: '$3.33 a month, billed once a year',
  trialDays: 14,
} as const;

export async function purchaseProAnnual(): Promise<{ purchased: boolean }> {
  // No-op until RevenueCat is configured. Returns false so the UI can continue
  // to the app either way (the entitlement gate is enforced where features live).
  return { purchased: false };
}
