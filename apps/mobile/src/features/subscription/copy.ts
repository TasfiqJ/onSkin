import type { GatedFeature } from '@onskin/types';

import { BRAND } from '@/lib/brand';

import { priceWithCadence, type BillingCadence } from './billingCadence';

/**
 * Centralised, honest-by-design paywall + lifecycle copy (docs/08 §9/§12, the
 * Slice-11/20/21 guard pattern). The subscription playbook is where dark patterns
 * creep in; the app rejects them by mandate, by Apple 3.1.2, by the auto-renewal
 * laws, AND because trust monetises (the Yuka thesis), so this copy carries: NO
 * manufactured urgency ("Don't miss out!", fake countdowns), NO guilt, NO drug/
 * disease claims, and it DOES carry the honest auto-renew disclosure, the
 * conditional reminder wording and App Store management instructions.
 * `claimsafety.test.ts` scans
 * the marketing/disclosure copy in THIS module on every edit (keep all persuasive
 * paywall copy here, not inline in screens, so the guard sees it; screen-inline text
 * is limited to prices/labels, which are data). Prices shown here are FALLBACK labels
 * (plans.ts). The real, localized prices come from the RevenueCat offering (B-REVENUECAT).
 */

export const PAYWALL_COPY = {
  // Onboarding offer (design 01, docs/08 §3.1).
  offer: {
    headlineFor: (skin: string) => `Your plan for ${skin} is ready.`,
    headlineFallback: 'Your personalized plan is ready.',
    subhead: `Everything below is part of ${BRAND.proName}.`,
    valueProps: [
      'Routine builder. Your products and missing steps',
      'Ingredient and shelf details, with source status',
      'Private photo timeline. On-device only',
      'Reminders and a forgiving streak',
    ],
    annualBadge: 'Annual · best value',
    cta: 'Start free trial',
    subscribeCta: 'Subscribe to Pro',
    trialReassurance:
      'Optional reminder with notifications enabled · manage or cancel in App Store',
    subscriptionReassurance: 'Manage or cancel the subscription in App Store',
    // The honest auto-renew disclosure (Apple 3.1.2 / ARLs). Plain, below the CTA.
    autoRenewDisclosure:
      'Your free trial converts to the annual plan and auto-renews unless cancelled at least 24 hours before it ends. Cancel anytime in your account settings.',
    subscriptionDisclosure:
      'Payment is charged to your App Store account at confirmation. The annual plan auto-renews unless cancelled at least 24 hours before the current period ends. Manage or cancel in App Store.',
    exploreTitle: 'Explore first. 7 days of Pro',
    exploreBody: 'No credit card. See your routine work, then decide.',
    continueFreeTitle: 'Continue with the free plan',
    continueFreeBody: 'No purchase. Pro features stay locked until you choose a plan.',
    trustBlock:
      'Health-related guidance requires independent professional review before availability · photos stay on your device · no data sales',
  },
  // Reverse trial in flight (design 02, docs/08 §6).
  reverseTrial: {
    bannerTitle: (daysLeft: number) =>
      `You’re exploring Pro. ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`,
    bannerBody: 'Everything’s unlocked, no card on file. Keep it after your week?',
    keepPill: 'No card on file',
    keepTitle: 'Keep Pro after your week.',
    keepBody:
      'You are exploring Pro now. Nothing renews unless you choose a plan. Selecting a plan keeps your routine, shelf tools, photos, and reminders unlocked after the free week.',
    keepCta: 'Keep Pro after your week',
    keepDeclineCta: 'Keep exploring for now',
    settingsNote: (date: string) =>
      `No card is on file. You have Pro until ${date}. Choose a plan only if you want to keep Pro after your week.`,
  },
  // Reverse-trial expired re-offer (design 03, docs/08 §3.2/§6).
  reoffer: {
    pill: 'Your week of Pro is up',
    title: 'Keep the routine you just built.',
    body: 'You’re on the free plan now. Nothing was deleted. Pro keeps the parts you started using this week:',
    continues: [
      'Your routine builder & check-offs',
      'Your shelf details & tracked dates',
      'Your photo timeline & reminders',
    ],
    keepCta: 'Keep my full routine',
    declineCta: 'Continue on free',
  },
  // Purchase success (design 05, docs/08 §3.3).
  success: {
    titleFor: (name: string | null) => (name ? `You’re all set, ${name}.` : 'You’re all set.'),
    bodyFor: (endDate: string, price: string, cadence: BillingCadence) =>
      `Your trial is active through ${endDate}. Current subscription status shows it will renew at ${priceWithCadence(price, cadence)} unless canceled. Manage or cancel in App Store.`,
    metaFor: (endDate: string, price: string, cadence: BillingCadence) =>
      `trial ends ${endDate} · set to renew ${priceWithCadence(price, cadence, 'short')}`,
    metaRowsFor: (endDate: string, price: string, cadence: BillingCadence) => [
      `trial ends ${endDate}`,
      `set to renew ${priceWithCadence(price, cadence, 'short')}`,
    ],
    // Paid path (win-back / direct purchase): there is no trial, so do not promise
    // a trial conversion. The amount the user actually paid is the one shown.
    bodyForPaid: (price: string, cadence: BillingCadence) =>
      `Pro is active now. Current subscription status shows renewal at ${priceWithCadence(price, cadence)}. Manage or cancel in App Store.`,
    metaForPaid: (endDate: string, price: string, cadence: BillingCadence) =>
      `active until ${endDate} · set to renew ${priceWithCadence(price, cadence, 'short')}`,
    metaRowsForPaid: (endDate: string, price: string, cadence: BillingCadence) => [
      `active until ${endDate}`,
      `set to renew ${priceWithCadence(price, cadence, 'short')}`,
    ],
    bodyForAppGrant: (endDate: string) =>
      `No-card Pro access is active through ${endDate}. You will not be charged automatically.`,
    metaRowsForAppGrant: (endDate: string) => [`access through ${endDate}`, 'no card on file'],
    bodyForPromotion: (endDate: string) =>
      `Promotional Pro access is active through ${endDate}. This grant does not charge or renew.`,
    metaRowsForPromotion: (endDate: string) => [
      `access through ${endDate}`,
      'no purchase or renewal',
    ],
    bodyForNonRenewing: (endDate: string) =>
      `Pro is active through ${endDate}. No renewal is scheduled.`,
    metaRowsForNonRenewing: (endDate: string) => [
      `access through ${endDate}`,
      'no renewal scheduled',
    ],
    bodyForBillingUnknown: (endDate: string) =>
      `Pro is active through ${endDate}. Check Subscription for current billing details.`,
    metaRowsForBillingUnknown: (endDate: string) => [
      `access through ${endDate}`,
      'billing details in Subscription',
    ],
    cta: 'See tonight’s routine',
  },
  // Manage subscription (design 06, docs/08 §3.4).
  manage: {
    title: 'Subscription',
    activeLabel: 'Active',
    manageRow: 'Manage in App Store',
    restoreRow: 'Restore purchases',
    termsRow: 'Terms & Privacy',
    cancelNote: (date: string) =>
      `You keep Pro until ${date}. Manage or cancel the subscription in App Store settings.`,
    appGrantedNote: (date: string) =>
      `No card is on file for this access. You keep Pro until ${date}; choose a plan only if you want Pro to continue after that.`,
    freeTitle: 'You’re on the free plan',
    freeBody:
      'The quiz result and shelf view are always free. Interaction-specific guidance requires completed independent professional review before it can be available.',
    upgradeCta: `See ${BRAND.proName}`,
  },
  // Graceful downgrade after a paid expiry (design 08, docs/08 §6).
  downgrade: {
    pill: 'Pro ended · you’re on the free plan',
    title: 'Everything you made is still here.',
    body: 'Your routine, your shelf, your photos, and your history are safe and yours. Nothing was deleted. Re-subscribe anytime to pick the full plan back up.',
    kept: ['Your routine & cycle. Kept', 'Your photos. On your phone', 'Your shelf & streak. Kept'],
    floorNote:
      'On free, you keep the quiz result and shelf view. Interaction-specific guidance requires completed independent professional review before it can be available.',
    renewCta: 'Renew Pro',
    declineCta: 'Keep using free',
  },
  // Honest win-back (design 09, docs/08 §6).
  winback: {
    eyebrow: 'A month later',
    title: 'Here’s what your timeline could show by autumn.',
    body: 'Skin rewards consistency. If you’d like to pick it back up, we kept your place.',
    offerLabel: 'A welcome-back offer',
    cta: 'Come back to Pro',
    declineCta: 'No thanks',
  },
  // The trial-end pre-charge reminder content (delivered by doc 7; docs/08 §6).
  trialReminder: {
    title: 'Your free trial ends in 2 days',
    bodyFor: (date: string, price: string, cadence: BillingCadence) =>
      `On ${date}, the subscription renews at ${priceWithCadence(price, cadence)} unless canceled. Manage or cancel it in App Store.`,
    footnote: 'Reminder delivery requires notification permission and device availability.',
  },
} as const;

/** Contextual upsell copy, framed around the specific gated feature (design 04). */
export const UPSELL_COPY: Record<GatedFeature, { title: string; body: string }> = {
  photo_timeline: {
    title: 'Unlock your private photo timeline.',
    body: `Watch your skin change over weeks. Guided capture, on-device only, never scored. Part of ${BRAND.proName}.`,
  },
  scheduler: {
    title: 'Build and track your routine.',
    body: `Organize the products you chose and keep daily check-offs together. Part of ${BRAND.proName}.`,
  },
  conflict_checks: {
    title: 'Interaction guidance is unavailable.',
    body: `Independent professional review of the exact rules and copy is required before product-interaction claims can be sold, unlocked, or shown.`,
  },
  reminders_widgets: {
    title: 'Reminders and a forgiving streak.',
    body: `Gentle nudges at times you choose, plus a calm view of your routine consistency. Part of ${BRAND.proName}.`,
  },
  full_routine: {
    title: 'Unlock your full routine.',
    body: `Build and edit daily routine steps around the products you chose. Part of ${BRAND.proName}.`,
  },
  // Cloud Ask has no approved provider or exact-release privacy contract.
  // Keep the upsell unavailable rather than marketing an unconfigured service.
  ask: {
    title: 'Cloud Ask is unavailable.',
    body: `It is not included in this release. It requires an approved provider, exact data and retention disclosures, explicit permission, safety validation, and professional review before it can be offered.`,
  },
};

export const UPSELL_DISMISS = 'Maybe later';
