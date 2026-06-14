import type { FunctionalTag, RecommendationTrigger } from '@onskin/types';

import type { SensitivityLevel } from '@/features/intelligence/engine';

import type { RecType } from './catalog';
import type { RecPreferences } from './preferences';

// The FIT score (docs/09 §5/§6). A weighted, explainable score over SIX inputs,
// every one about the user or the evidence. *** CHURCH AND STATE (D-054): there is
// NO commercial input here. *** A product's commission, partnership, or
// purchasability cannot enter this function. It is not a parameter, and the
// commerce layer (doc #10) only reads the ranked output. Hard exclusions (pregnancy,
// would-add-a-conflict, an unmet hard preference) run first; nothing unsafe is ever
// merely down-ranked. Deterministic + unit-tested.

export type FitContext = {
  sensitivity: SensitivityLevel;
  pregnancy: boolean;
  preferences: RecPreferences;
  /** Functional tags that already appear on the shelf (for de-dup / complement). */
  ownedTags: Set<FunctionalTag>;
  /** Tags that would ADD a conflict if introduced. A hard exclusion (§5). */
  conflictTags: Set<FunctionalTag>;
  trigger: RecommendationTrigger;
};

export type FitBreakdown = {
  profileMatch: number;
  evidence: number;
  needPriority: number;
  simplicity: number;
  preferenceMatch: number;
  catalogQuality: number;
};

export type FitResult = {
  /** 0..1 merit score; null when HARD-excluded (never recommend an unsafe/clashing type). */
  score: number | null;
  excludedReason: 'pregnancy' | 'conflict' | 'preference' | null;
  breakdown: FitBreakdown;
};

// Weights sum to 1.0. Need-priority + profile dominate; catalog-quality is a small,
// honest down-weight until the curated catalog lands (B-CATALOG-SEED).
const W = {
  profileMatch: 0.3,
  evidence: 0.25,
  needPriority: 0.2,
  simplicity: 0.1,
  preferenceMatch: 0.1,
  catalogQuality: 0.05,
} as const;

// The §5 priority ladder: safety/gap > replacement > conflict > better-fit > goal.
const NEED_PRIORITY: Record<RecommendationTrigger, number> = {
  gap: 1.0,
  routine_completion: 0.95,
  replacement: 0.8,
  conflict: 0.6,
  better_fit: 0.45,
  goal: 0.35,
};

const EVIDENCE_WEIGHT = { established: 1.0, plausible: 0.7, contested: 0.4, refuted: 0.0 } as const;

const POTENT_ACTIVE: FunctionalTag[] = ['retinoid', 'aha', 'bha', 'benzoyl_peroxide'];

const EMPTY_BREAKDOWN: FitBreakdown = {
  profileMatch: 0,
  evidence: 0,
  needPriority: 0,
  simplicity: 0,
  preferenceMatch: 0,
  catalogQuality: 0,
};

/** Whether the user's hard preferences can be satisfied by this TYPE. For type-first
 *  recommendations every type can be sourced fragrance-free / vegan / etc., so this
 *  is satisfiable today; it becomes a real hard filter on specific products
 *  (B-CATALOG-SEED). Budget is a soft signal until products carry price bands. */
function preferenceSatisfiable(_type: RecType, _prefs: RecPreferences): boolean {
  return true;
}

export function fitScore(type: RecType, ctx: FitContext): FitResult {
  // --- HARD exclusions first (safety + church-and-state: never down-rank, exclude) ---
  if (ctx.pregnancy && !type.pregnancySafe) {
    return { score: null, excludedReason: 'pregnancy', breakdown: EMPTY_BREAKDOWN };
  }
  if (type.tags.some((t) => ctx.conflictTags.has(t))) {
    return { score: null, excludedReason: 'conflict', breakdown: EMPTY_BREAKDOWN };
  }
  if (!preferenceSatisfiable(type, ctx.preferences)) {
    return { score: null, excludedReason: 'preference', breakdown: EMPTY_BREAKDOWN };
  }
  if (type.evidenceLabel === 'refuted') {
    return { score: null, excludedReason: null, breakdown: EMPTY_BREAKDOWN };
  }

  // --- soft, explainable scoring ---
  const profileMatch = ctx.sensitivity === 'sensitive' && !type.sensitiveSafe ? 0.5 : 1.0;
  const evidence = EVIDENCE_WEIGHT[type.evidenceLabel];
  const needPriority = NEED_PRIORITY[ctx.trigger];

  // Simplicity / fit-with-shelf: full marks for filling an unowned slot; a small
  // penalty for adding a SECOND potent active to sensitive skin (skinimalism, §5).
  const addsPotent = type.tags.some((t) => POTENT_ACTIVE.includes(t));
  const ownsPotent = POTENT_ACTIVE.some((t) => ctx.ownedTags.has(t));
  const simplicity = addsPotent && ownsPotent && ctx.sensitivity === 'sensitive' ? 0.7 : 1.0;

  // Preference match: a bonus when a set values filter aligns with the type's note
  // (e.g. fragrance-free types for a fragrance-free preference). Honest, not a sell.
  const wantsFragranceFree = ctx.preferences.values.includes('fragrance_free');
  const typeIsFragranceFree = /fragrance-free/i.test(type.what) || type.sensitiveSafe;
  const preferenceMatch = wantsFragranceFree && typeIsFragranceFree ? 1.0 : 0.85;

  // Catalog quality: type-first only until the curated catalog lands. A deliberate,
  // honest down-weight (the engine degrades to type-first guidance, §5/§12).
  const catalogQuality = type.example ? 0.6 : 0.5;

  const breakdown: FitBreakdown = {
    profileMatch,
    evidence,
    needPriority,
    simplicity,
    preferenceMatch,
    catalogQuality,
  };
  const score =
    W.profileMatch * profileMatch +
    W.evidence * evidence +
    W.needPriority * needPriority +
    W.simplicity * simplicity +
    W.preferenceMatch * preferenceMatch +
    W.catalogQuality * catalogQuality;

  return { score, excludedReason: null, breakdown };
}

/** Calm, claim-safe fit descriptor. TEXT, never colour alone (§11). No hype. */
export function fitLabel(score: number | null): string {
  if (score == null) return 'Not a fit';
  if (score >= 0.8) return 'Strong fit';
  if (score >= 0.62) return 'Good fit';
  return 'Worth considering';
}
