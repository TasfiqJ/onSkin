import type { GatedFeature } from '@onskin/types';

/**
 * Centralised, honest-by-design paywall + lifecycle copy (docs/08 §9/§12, the
 * Slice-11/20/21 guard pattern). The subscription playbook is where dark patterns
 * creep in; OnSkin rejects them by mandate, by Apple 3.1.2, by the auto-renewal
 * laws, AND because trust monetises (the Yuka thesis), so this copy carries: NO
 * manufactured urgency ("Don't miss out!", fake countdowns), NO guilt, NO drug/
 * disease claims, and it DOES carry the honest auto-renew disclosure, the
 * 2-day-before reminder promise, and "cancel anytime." `claimsafety.test.ts` scans
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
    subhead: 'Everything below is part of OnSkin Pro.',
    valueProps: [
      'Routine intelligence. Order, timing, skin cycling',
      'Ingredient conflict checks, with evidence grades',
      'Private photo timeline. On-device only',
      'Reminders, streaks & home-screen widgets',
    ],
    annualBadge: 'Annual · best value',
    cta: 'Start free trial',
    trialReassurance: 'We’ll remind you 2 days before the trial ends · cancel anytime',
    // The honest auto-renew disclosure (Apple 3.1.2 / ARLs). Plain, below the CTA.
    autoRenewDisclosure:
      'Your free trial converts to the annual plan and auto-renews unless cancelled at least 24 hours before it ends. Cancel anytime in your account settings.',
    exploreTitle: 'Explore first. 7 days of Pro',
    exploreBody: 'No credit card. See your routine work, then decide.',
    trustBlock: 'Reviewed by dermatologists · photos stay on your device · no data sales',
  },
  // Reverse trial in flight (design 02, docs/08 §6).
  reverseTrial: {
    bannerTitle: (daysLeft: number) => `You’re exploring Pro. ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`,
    bannerBody: 'Everything’s unlocked, no card on file. Keep it after your week?',
    keepCta: 'Keep Pro after your week',
  },
  // Reverse-trial expired re-offer (design 03, docs/08 §3.2/§6).
  reoffer: {
    pill: 'Your week of Pro is up',
    title: 'Keep the routine you just built.',
    body: 'You’re on the free plan now. Nothing was deleted. Pro keeps the parts you started using this week:',
    continues: ['The full scheduler & skin-cycling', 'Unlimited conflict checks', 'Your photo timeline & reminders'],
    keepCta: 'Keep my full routine',
    declineCta: 'Continue on free',
  },
  // Purchase success (design 05, docs/08 §3.3).
  success: {
    titleFor: (name: string | null) => (name ? `You’re all set, ${name}.` : 'You’re all set.'),
    bodyFor: (price: string) =>
      `Your 14 days of Pro start now. We’ll remind you 2 days before it converts to ${price}/year. Cancel anytime.`,
    metaFor: (endDate: string, price: string) => `trial ends ${endDate} · renews ${price}/yr`,
    // Paid path (win-back / direct purchase): there is no trial, so do not promise
    // a trial conversion. The amount the user actually paid is the one shown.
    bodyForPaid: (price: string) =>
      `Pro is active now. Your plan renews at ${price}/year. Cancel anytime.`,
    metaForPaid: (endDate: string, price: string) => `active until ${endDate} · renews ${price}/yr`,
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
      `Cancelling is one tap in your App Store settings, and you keep Pro until ${date}. No maze, no calls.`,
    freeTitle: 'You’re on the free plan',
    freeBody: 'The quiz result, a shelf view, and one conflict check are always free. Upgrade to Pro anytime.',
    upgradeCta: 'See OnSkin Pro',
  },
  // Graceful downgrade after a paid expiry (design 08, docs/08 §6).
  downgrade: {
    pill: 'Pro ended · you’re on the free plan',
    title: 'Everything you made is still here.',
    body: 'Your routine, your shelf, your photos, and your history are safe and yours. Nothing was deleted. Re-subscribe anytime to pick the full plan back up.',
    kept: ['Your routine & cycle. Kept', 'Your photos. On your phone', 'Your shelf & streak. Kept'],
    floorNote: 'On free, you keep the quiz result, a shelf view, and one conflict check. Full intelligence returns the moment you do.',
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
    bodyFor: (date: string, price: string) =>
      `On ${date} you’ll move to ${price}/year. Happy to stay? Nothing to do. Not for you? Cancel in one tap. No hard feelings.`,
    footnote: 'we remind you before we ever charge. Apple sends one too',
  },
} as const;

/** Contextual upsell copy, framed around the specific gated feature (design 04). */
export const UPSELL_COPY: Record<GatedFeature, { title: string; body: string }> = {
  photo_timeline: {
    title: 'Unlock your private photo timeline.',
    body: 'Watch your skin change over weeks. Guided capture, on-device only, never scored. Part of OnSkin Pro.',
  },
  scheduler: {
    title: 'Unlock your full skin-cycling scheduler.',
    body: 'Tonight’s active, recovery nights, the next acid night. Orchestrated for your skin. Part of OnSkin Pro.',
  },
  conflict_checks: {
    title: 'Check every product, every time.',
    body: 'Unlimited ingredient-conflict checks with evidence grades and calm resolutions. Part of OnSkin Pro.',
  },
  reminders_widgets: {
    title: 'Reminders, streaks & home-screen widgets.',
    body: 'Gentle nudges at times you choose, a forgiving streak, and glanceable widgets. Part of OnSkin Pro.',
  },
  full_routine: {
    title: 'Unlock your full routine.',
    body: 'The complete builder, sequencing and ramp. Built around your skin. Part of OnSkin Pro.',
  },
  // docs/13 §15: only the deeper, cloud-grounded advisor is gated. The on-device,
  // evidence-grounded answers about your own shelf stay free. Honest, never "AI" hype.
  ask: {
    title: 'A deeper advisor, grounded in your shelf.',
    body: 'Ask follow-ups in your own words and get fluent, evidence-grounded answers about your routine. Private, and never a substitute for your dermatologist. Part of OnSkin Pro.',
  },
};

export const UPSELL_DISMISS = 'Maybe later';
