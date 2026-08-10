import type { GoalId, RecommendationTrigger } from '@layerwell/types';

import type { ReplenishmentReason } from './replenishment';

/**
 * Centralised, claim-safe recommendation copy (docs/09 §6/§10, the Slice-11/20/21/22
 * guard pattern). Every user-facing string the engine surfaces lives here (or in a
 * builder below) so `claimsafety.test.ts` scans it on every edit. The bar (docs/09 §10):
 *  - recommend for CONCERNS, not CONDITIONS. No "treats/cures/heals", no diagnosis;
 *  - no alarm words, no manufactured urgency / scarcity / guilt (it must never feel
 *    like a storefront. It can say "you're set" and recommend nothing);
 *  - the affiliate disclosure is honest and states independence ("never affects what
 *    we recommend"), but the commerce path itself is inert here (doc #10 / B-PRIVACY).
 * Keep persuasive copy HERE, not inline in screens (screen-inline text is limited to
 * data. Product/goal names, evidence labels).
 */

/** Group label per trigger. The calm "For you" hub sections (docs/09 §7.1). */
export const GROUP_LABEL: Record<RecommendationTrigger, string> = {
  gap: 'Fill a gap',
  replacement: 'Time to replace',
  conflict: 'Simplify a clash',
  better_fit: 'A gentler option',
  goal: 'Toward your goal',
  routine_completion: 'Start simple',
};

/** Cosmetic-appearance phrasing for a goal. Concerns, not conditions (docs/09 §10). */
const GOAL_CONCERN: Record<GoalId, string> = {
  clear_skin: 'clearer-looking skin',
  even_tone: 'a more even-looking tone',
  hydration: 'lasting hydration',
  anti_aging: 'the look of fine lines',
  sensitivity: 'calmer, more comfortable skin',
  barrier_repair: 'a stronger-feeling barrier',
};
export const goalConcern = (g: GoalId): string => GOAL_CONCERN[g];

export function replacementCopy(
  name: string,
  reason: ReplenishmentReason,
): { what: string; why: string; gap: string; evidence: string } {
  switch (reason) {
    case 'printed_expiry_countdown':
      return {
        what: `Your ${name} is nearing its recorded package date`,
        why: `Your shelf shows ${name} is within 30 days of the package date you recorded. You can repurchase it or consider a better-fit alternative.`,
        gap: `${name} is within 30 days of its recorded package date`,
        evidence: 'From your shelf. Recorded package date',
      };
    case 'printed_expiry_expired':
      return {
        what: `Your ${name} has passed its recorded package date`,
        why: `Your shelf shows ${name} has passed the package date you recorded. You can repurchase it or consider a better-fit alternative.`,
        gap: `${name} has passed its recorded package date`,
        evidence: 'From your shelf. Recorded package date',
      };
    case 'label_pao_countdown':
      return {
        what: `Your ${name} is nearing its tracked PAO date`,
        why: `Your shelf shows ${name} is within 30 days of the PAO date calculated from its opened date and the PAO recorded from the product label. You can repurchase it or consider a better-fit alternative.`,
        gap: `${name} is within 30 days of its tracked PAO date`,
        evidence: 'From your shelf. Opened date + PAO recorded from the product label',
      };
    case 'label_pao_expired':
      return {
        what: `Your ${name} has passed its tracked PAO date`,
        why: `Your shelf shows ${name} has passed the PAO date calculated from its opened date and the PAO recorded from the product label. You can repurchase it or consider a better-fit alternative.`,
        gap: `${name} has passed its tracked PAO date`,
        evidence: 'From your shelf. Opened date + PAO recorded from the product label',
      };
    case 'catalog_pao_countdown':
      return {
        what: `Your ${name} is nearing its tracked PAO date`,
        why: `Your shelf shows ${name} is within 30 days of the PAO date calculated from its opened date and a reviewed catalog PAO. You can repurchase it or consider a better-fit alternative.`,
        gap: `${name} is within 30 days of its tracked PAO date`,
        evidence: 'From your shelf. Opened date + reviewed catalog PAO',
      };
    case 'catalog_pao_expired':
      return {
        what: `Your ${name} has passed its tracked PAO date`,
        why: `Your shelf shows ${name} has passed the PAO date calculated from its opened date and a reviewed catalog PAO. You can repurchase it or consider a better-fit alternative.`,
        gap: `${name} has passed its tracked PAO date`,
        evidence: 'From your shelf. Opened date + reviewed catalog PAO',
      };
    case 'finished':
      return {
        what: `You marked ${name} as finished`,
        why: `You marked ${name} as finished. You can repurchase it or consider a better-fit alternative.`,
        gap: `${name} is marked finished`,
        evidence: 'From your shelf. Marked finished',
      };
  }
}

/** Short goal tag for the profile/how line (e.g. "fine-lines goal"). */
const GOAL_SHORT: Record<GoalId, string> = {
  clear_skin: 'clear-skin',
  even_tone: 'even-tone',
  hydration: 'hydration',
  anti_aging: 'fine-lines',
  sensitivity: 'sensitivity',
  barrier_repair: 'barrier-repair',
};
export const goalShort = (g: GoalId): string => GOAL_SHORT[g];

export const REC_COPY = {
  hub: {
    title: 'For you',
    subtitle: 'Ranked by fit and evidence, never by commission.',
    eyebrow: 'YOUR RECOMMENDATIONS',
  },
  // The honest seventh state (docs/09 §4). Recommending nothing is a feature.
  // `body` claims goal coverage and is used ONLY when goal recs can ship; in
  // production goal actives are gated (B-DERM-REVIEW), so `bodyNoGoals` is shown
  // instead, which never asserts a goal-matching the engine cannot perform.
  youreSet: {
    title: 'Your routine looks complete.',
    body: 'Cleanser, moisturiser and SPF are covered, conflict-free, and matched to your goals. Nothing to add right now.',
    bodyNoGoals:
      'Cleanser, moisturiser and SPF are covered and conflict-free. Nothing to add right now.',
    checks: ['Cleanser · moisturiser · SPF', 'No unresolved conflicts'],
    footnote: 'Nothing else is suggested from the current reviewed inputs.',
  },
  reviewPending: {
    title: 'Recommendation review in progress',
    body: "We won't call your routine complete or suggest an unreviewed active while the required review is still pending.",
  },
  noPairEvaluation: {
    title: 'No compatibility result',
    body: "No relevant product pair was evaluated, so we won't call your routine conflict-free or complete.",
  },
  noCurrentSuggestion: {
    title: 'No current suggestion',
    body: "There isn't a current suggestion to show. We haven't marked your routine complete.",
  },
  card: {
    whatLabel: 'What',
    whyLabel: 'Why',
    howLabel: 'How we decided',
    seeHow: 'See how',
    specificNote: 'No specific product is selected or offered.',
    addToShelf: 'Add to shelf',
    dismiss: 'Not for me',
    whereToFind: 'Where to find it',
    // The disclosed-commerce line (doc #10, inert here behind B-PRIVACY). States
    // independence plainly (Yuka / Wirecutter model, docs/09 §3).
    disclosure: 'We may earn a commission. It never affects what we recommend.',
    optional: 'A suggestion, not a must, and we won’t keep asking.',
  },
  howKeys: {
    profile: 'profile',
    gap: 'the gap',
    evidence: 'evidence',
    fit: 'fit',
    caveat: 'caveat',
  },
  // In-routine SPF gap prompt (docs/09 §7.2, design 04). Inline, dismissible.
  gapPrompt: {
    title: 'Your morning routine has no SPF',
    body: 'It’s the highest-impact step you could add. Especially toward your goals.',
    cta: 'See why',
    dismiss: 'Not now',
  },
  // A calm Today entry into the hub (docs/09 §7.1).
  todayCard: {
    title: 'A few honest suggestions',
    statusTitle: 'Recommendation status',
    bodyOne: '1 thing we’d gently suggest',
    bodyMany: (n: number) => `${n} things we’d gently suggest`,
    bodySet: 'Your routine looks complete',
    bodyReviewPending: 'Recommendation review is in progress; no unreviewed result is shown.',
    bodyNoPairEvaluation: 'No product pair was evaluated, so no completeness result is shown.',
    bodyNoCurrentSuggestion:
      'There is no current suggestion, and your routine is not marked complete.',
  },
  preferences: {
    title: 'Recommendation preferences',
    subtitle:
      'Only fragrance-free can affect current type guidance. Other choices are saved, but reviewed product matching is not available and they do not affect current suggestions.',
    compactScope: 'Current guidance: fragrance-free only.',
    valuesLabel: 'Values',
    budgetLabel: 'Budget',
    formatLabel: 'Texture',
    // Honest until specific products carry attributes (B-CATALOG-SEED): the
    // engine is type-first and weights these in fit, it does not yet hard-exclude.
    footnote:
      'Only fragrance-free can affect current type guidance. Other choices are saved but do not affect current suggestions.',
    none: 'No preference',
    saveFailedTitle: 'Preference not saved',
    saveFailedBody: "We couldn't save that preference. Please try again.",
    loadFailedTitle: 'Preferences unavailable',
    loadFailedBody:
      "We couldn't verify your saved preferences, so suggestions are paused and nothing was replaced.",
  },
  unavailable: {
    title: 'Suggestions unavailable',
    body: "We couldn't verify your profile, shelf, and preferences, so no personalised suggestion is shown.",
  },
} as const;

/** Human label for a values filter (UI chips). */
export const VALUES_LABEL: Record<string, string> = {
  fragrance_free: 'Fragrance-free',
  vegan: 'Vegan',
  cruelty_free: 'Cruelty-free',
  non_comedogenic: 'Non-comedogenic',
  sustainable: 'Sustainable',
};
export const BUDGET_LABEL: Record<string, string> = {
  drugstore: 'Drugstore',
  mid: 'Mid-range',
  premium: 'Premium',
};
export const FORMAT_LABEL: Record<string, string> = {
  gel: 'Gel',
  cream: 'Cream',
  fluid: 'Fluid',
  balm: 'Balm',
  oil: 'Oil',
};

// --- "Why" builders (the personalised one-liner, docs/09 §6) ------------------
export const whyCopy = {
  gapSpf: (goal: GoalId | null): string =>
    `Your morning routine has no SPF, and daily SPF is the single highest-impact step${
      goal ? ` toward ${goalConcern(goal)}` : ''
    }.`,
  gapMoisturiser:
    'Your routine has no moisturiser. It helps seal everything in and support your barrier.',
  gapCleanser: 'Your routine has no cleanser. A gentle, clean base is where every routine starts.',
  betterFit: (name: string): string =>
    `Your saved shelf details include a fragrance marker for ${name}. A fragrance-free option may be worth considering. Optional, not a must.`,
  conflict: (a: string, b: string): string =>
    `${a} and ${b} can clash on your shelf. A non-conflicting alternative to one of them would keep your routine simple.`,
  goal: (goal: GoalId): string =>
    `You set a goal toward ${goalConcern(goal)} that nothing in your routine addresses yet. Here’s a routine option to consider.`,
  routineCompletion:
    'A simple, complete routine is the best place to start. A cleanser, a moisturiser and an SPF, no more.',
};
