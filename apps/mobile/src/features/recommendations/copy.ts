import type { GoalId, RecommendationTrigger } from '@onskin/types';

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
    body: 'Cleanser, treatment, moisturiser and SPF. All covered, conflict-free, and matched to your goals. Nothing to add right now.',
    bodyNoGoals: 'Cleanser, treatment, moisturiser and SPF. All covered and conflict-free. Nothing to add right now.',
    checks: ['Cleanser · treatment · moisturiser · SPF', 'No unresolved conflicts'],
    footnote: 'we’ll tell you the moment that changes, never before',
  },
  card: {
    whatLabel: 'What',
    whyLabel: 'Why',
    howLabel: 'How we decided',
    seeHow: 'See how',
    specificNote: 'specific products, ranked by fit',
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
    bodyOne: '1 thing we’d gently suggest',
    bodyMany: (n: number) => `${n} things we’d gently suggest`,
    bodySet: 'Your routine looks complete',
  },
  preferences: {
    title: 'Recommendation preferences',
    subtitle: 'These shape what fits you. They never change what sells.',
    valuesLabel: 'Values',
    budgetLabel: 'Budget',
    formatLabel: 'Texture',
    // Honest until specific products carry attributes (B-CATALOG-SEED): the
    // engine is type-first and weights these in fit, it does not yet hard-exclude.
    footnote: 'We prioritise options that fit these.',
    none: 'No preference',
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
  gapMoisturiser: 'Your routine has no moisturiser. It helps seal everything in and support your barrier.',
  gapCleanser: 'Your routine has no cleanser. A gentle, clean base is where every routine starts.',
  replacement: (name: string): string =>
    `Your ${name} is running low. When it’s done, there are two honest options. Repurchase, or a better-fit alternative.`,
  betterFit: (name: string): string =>
    `Your ${name} is fragranced, which can suit sensitive skin less well. A fragrance-free option is worth considering. Optional, not a must.`,
  conflict: (a: string, b: string): string =>
    `${a} and ${b} can clash on your shelf. A non-conflicting alternative to one of them would keep your routine simple.`,
  goal: (goal: GoalId): string =>
    `You set a goal toward ${goalConcern(goal)} that nothing in your routine addresses yet. Here’s an evidence-backed option to consider.`,
  routineCompletion:
    'A simple, complete routine is the best place to start. A cleanser, a moisturiser and an SPF, no more.',
};
