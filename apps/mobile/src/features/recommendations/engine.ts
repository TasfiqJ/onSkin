import type {
  EvidenceLabel,
  FunctionalTag,
  GoalId,
  RecommendationTrigger,
  SequencingRole,
} from '@onskin/types';

import type { DetectedConflict, SensitivityLevel } from '@/features/intelligence/engine';
import { isReassuring } from '@/features/intelligence/engine';
import {
  pregnancySafetyReasonForProduct,
  type PregnancySafetyMode,
} from '@/features/intelligence/pregnancySafety';
import { shippableRules, type ConflictRule } from '@/features/intelligence/rules';

import { recTypeByKey, shippableRecTypes, type RecType } from './catalog';
import { GROUP_LABEL, goalShort, whyCopy } from './copy';
import { fitLabel, fitScore, type FitContext, type FitResult } from './fit';
import { DEFAULT_PREFERENCES, type RecPreferences } from './preferences';

// The recommendation engine (docs/09 §5). A deterministic, explainable rules +
// evidence + FIT-scoring function over the profile/shelf/conflicts/preferences +
// type catalog. NOT collaborative filtering. Restrained by construction: it returns
// the MINIMAL set of genuine needs, type-first, prioritised safety/gap > replacement
// > conflict > better-fit > goal, and returns NOTHING ("you're set") when nothing is
// needed. *** CHURCH AND STATE (D-054): no commercial field is an input anywhere. ***

export type RecShelfItem = {
  id: string;
  name: string;
  role: SequencingRole;
  tags: FunctionalTag[];
  concentration?: 'low' | 'high';
  fragranced: boolean;
  /** Genuinely depleted/expiring (countdown or expired badge). The only replacement
   *  trigger sourced from the active shelf. (A separate "finished product" channel
   *  sourced from the archive is a future enhancement: gap-detection vs replacement
   *  for an already-archived role needs product sign-off, so it is not wired yet.) */
  expiring: boolean;
};

export type RecProfile = {
  sensitivity: SensitivityLevel;
  pregnancy: boolean;
  pregnancySafety?: PregnancySafetyMode;
  goals: GoalId[];
};

export type RecInput = {
  profile: RecProfile;
  shelf: RecShelfItem[];
  /** Unresolved interactions from the docs/02 engine (already launch-gated). */
  conflicts: DetectedConflict[];
  preferences: RecPreferences;
  /** Ids the user has dismissed ("not for me"). Never re-surfaced. */
  dismissed?: Set<string>;
  rules?: ConflictRule[];
  recTypes?: RecType[];
};

export type RecHow = {
  profile: string;
  gap: string;
  evidence: string;
  fit: string;
  caveat: string | null;
};

export type Recommendation = {
  /** Stable across recomputes. The cache is not authoritative, so the detail
   *  screen re-derives by id (docs/09 §5/§12). */
  id: string;
  trigger: RecommendationTrigger;
  group: string;
  /** The recommended TYPE key (type-first). 'replacement'/'conflict' are shelf-anchored. */
  productType: string;
  what: string;
  example: string | null;
  why: string;
  how: RecHow;
  evidenceLabel: EvidenceLabel | null;
  /** Bottom-left card label. An evidence note (with a calm dot) or a provenance. */
  footLabel: string;
  footIsEvidence: boolean;
  caveat: string | null;
  fit: FitResult | null;
  fitLabel: string;
  /** Priority for ranking (the §5 ladder). */
  priority: number;
  /** The shelf product this is anchored to (replacement / better-fit / conflict). */
  relatedProductId: string | null;
  /** The conflict rule id, when trigger==='conflict' (links to the conflict sheet). */
  relatedRuleId: string | null;
};

export type RecResult = {
  recommendations: Recommendation[];
  /** True only when a real evaluation found nothing to add (docs/09 §4 seventh state). */
  youreSet: boolean;
};

const ESSENTIALS: SequencingRole[] = ['spf', 'moisturiser', 'cleanser'];
// Roles that count as a goal-driven ACTIVE (vs a structural essential). SPF /
// moisturiser / cleanser are routine-completeness GAPS, not goal actives. Even
// though SPF genuinely helps anti-aging/even-tone, the goal trigger introduces a
// treatment, not a structural staple (docs/09 §4.5).
const GOAL_ACTIVE_ROLES: SequencingRole[] = [
  'antioxidant',
  'treatment',
  'exfoliant',
  'hydrating_serum',
];
const PRIORITY: Record<RecommendationTrigger, number> = {
  gap: 1.0,
  routine_completion: 0.95,
  replacement: 0.8,
  conflict: 0.6,
  better_fit: 0.45,
  goal: 0.35,
};

// Which owned tags/roles count a goal as already addressed (so we never push a
// product onto a goal the routine already serves. Restraint, §4/§5).
const GOAL_SERVED_BY: Record<GoalId, { tags: FunctionalTag[]; roles: SequencingRole[] }> = {
  anti_aging: { tags: ['retinoid', 'vitamin_c'], roles: [] },
  even_tone: { tags: ['vitamin_c', 'niacinamide'], roles: [] },
  clear_skin: { tags: ['bha', 'benzoyl_peroxide'], roles: [] },
  hydration: { tags: ['humectant', 'ceramide'], roles: ['moisturiser', 'hydrating_serum'] },
  sensitivity: { tags: ['ceramide', 'barrier', 'niacinamide'], roles: [] },
  barrier_repair: { tags: ['ceramide', 'barrier'], roles: ['moisturiser'] },
};

function sensitivityWord(s: SensitivityLevel): string {
  return s === 'sensitive' ? 'Sensitive skin' : s === 'resistant' ? 'Resistant skin' : 'Your skin';
}

function profileSummary(p: RecProfile): string {
  const parts = [sensitivityWord(p.sensitivity)];
  if (p.pregnancy) parts.push('pregnancy-aware');
  if (p.goals[0]) parts.push(`${goalShort(p.goals[0])} goal`);
  return parts.join(' · ');
}

/** Tags that would ADD a conflict if introduced to this shelf (docs/09 §5 exclusion). */
function conflictTagsForShelf(
  ownedTags: Set<FunctionalTag>,
  rules: ConflictRule[],
): Set<FunctionalTag> {
  const out = new Set<FunctionalTag>();
  for (const r of rules) {
    if (
      r.interactionType === 'myth' ||
      r.interactionType === 'synergy' ||
      r.interactionType === 'safety'
    )
      continue;
    if (ownedTags.has(r.tagA)) out.add(r.tagB);
    if (ownedTags.has(r.tagB)) out.add(r.tagA);
  }
  return out;
}

function makeFitContext(input: RecInput, trigger: RecommendationTrigger): FitContext {
  const ownedTags = new Set<FunctionalTag>(input.shelf.flatMap((p) => p.tags));
  return {
    sensitivity: input.profile.sensitivity,
    pregnancy: input.profile.pregnancySafety === 'caution' || input.profile.pregnancy,
    preferences: input.preferences,
    ownedTags,
    conflictTags: conflictTagsForShelf(ownedTags, input.rules ?? shippableRules()),
    trigger,
  };
}

/** Best shippable type for a role, scored by FIT; null if none survives exclusions. */
function bestTypeForRole(
  role: SequencingRole,
  input: RecInput,
  trigger: RecommendationTrigger,
  recTypes: RecType[],
): { type: RecType; fit: FitResult } | null {
  const ctx = makeFitContext(input, trigger);
  const scored = recTypes
    .filter((t) => t.role === role)
    .map((t) => ({ type: t, fit: fitScore(t, ctx) }))
    .filter((s) => s.fit.score != null)
    .sort((a, b) => (b.fit.score ?? 0) - (a.fit.score ?? 0));
  return scored[0] ?? null;
}

/** Best shippable goal-active for a goal (pregnancy-safe etc. via FIT exclusions). */
function bestTypeForGoal(
  goal: GoalId,
  input: RecInput,
  recTypes: RecType[],
): { type: RecType; fit: FitResult } | null {
  const ctx = makeFitContext(input, 'goal');
  const scored = recTypes
    .filter((t) => t.goals.includes(goal) && GOAL_ACTIVE_ROLES.includes(t.role))
    .map((t) => ({ type: t, fit: fitScore(t, ctx) }))
    .filter((s) => s.fit.score != null)
    .sort((a, b) => (b.fit.score ?? 0) - (a.fit.score ?? 0));
  return scored[0] ?? null;
}

function howFor(type: RecType, input: RecInput, gapLine: string): RecHow {
  const fitBits: string[] = [];
  if (input.profile.sensitivity === 'sensitive' && type.sensitiveSafe)
    fitBits.push('sensitive-safe');
  if (input.profile.pregnancy && type.pregnancySafe) fitBits.push('pregnancy-friendly');
  if (
    input.preferences.values.includes('fragrance_free') &&
    (/fragrance-free/i.test(type.what) || type.sensitiveSafe)
  )
    fitBits.push('fragrance-free (your preference)');
  if (fitBits.length === 0) fitBits.push('Matched to your profile');
  return {
    profile: profileSummary(input.profile),
    gap: gapLine,
    evidence: type.evidenceNote,
    fit: fitBits.join(' · '),
    caveat: type.caveat,
  };
}

function typeRec(args: {
  trigger: RecommendationTrigger;
  type: RecType;
  fit: FitResult;
  why: string;
  gapLine: string;
  input: RecInput;
  relatedProductId?: string | null;
}): Recommendation {
  const { trigger, type, fit, why, gapLine, input, relatedProductId } = args;
  const id = `${trigger}:${type.type}${relatedProductId ? `:${relatedProductId}` : ''}`;
  // Evidence dot only for the genuinely-graded, structural/goal recommendations.
  return {
    id,
    trigger,
    group: GROUP_LABEL[trigger],
    productType: type.type,
    what: type.what,
    example: type.example,
    why,
    how: howFor(type, input, gapLine),
    evidenceLabel: type.evidenceLabel,
    footLabel: type.evidenceNote,
    footIsEvidence: true,
    caveat: type.caveat,
    fit,
    fitLabel: fitLabel(fit.score),
    priority: PRIORITY[trigger],
    relatedProductId: relatedProductId ?? null,
    relatedRuleId: null,
  };
}

export function recommend(input: RecInput): RecResult {
  const rules = input.rules ?? shippableRules();
  const pregnancySafety =
    input.profile.pregnancySafety ?? (input.profile.pregnancy ? 'caution' : 'clear');
  const safetyExcludedIds = new Set(
    input.shelf
      .filter((item) => pregnancySafetyReasonForProduct(item, pregnancySafety, rules) != null)
      .map((item) => item.id),
  );
  const eligibleShelf = input.shelf.filter((item) => !safetyExcludedIds.has(item.id));
  const eligibleConflicts = input.conflicts.filter(
    (conflict) =>
      (conflict.productAId == null || !safetyExcludedIds.has(conflict.productAId)) &&
      (conflict.productBId == null || !safetyExcludedIds.has(conflict.productBId)),
  );
  const eligibleInput: RecInput = {
    ...input,
    shelf: eligibleShelf,
    conflicts: eligibleConflicts,
    rules,
  };
  const recTypes = shippableRecTypes(eligibleInput.recTypes);
  const dismissed = input.dismissed ?? new Set<string>();
  const out: Recommendation[] = [];

  const ownedRoles = new Set(eligibleShelf.map((p) => p.role));
  const missingEssentials = ESSENTIALS.filter((r) => !ownedRoles.has(r));
  const hasNoEssentials = ESSENTIALS.every((r) => !ownedRoles.has(r));
  const isBeginner = hasNoEssentials && eligibleShelf.length <= 1;

  // 1 + 6. Gap / routine-completion. The missing essentials (SPF prioritised).
  // A true beginner gets a calm "start simple" starter routine; an established
  // routine gets individual gap prompts.
  const gapTrigger: RecommendationTrigger = isBeginner ? 'routine_completion' : 'gap';
  for (const role of missingEssentials) {
    const best = bestTypeForRole(role, eligibleInput, gapTrigger, recTypes);
    if (!best) continue;
    const why =
      role === 'spf'
        ? whyCopy.gapSpf(eligibleInput.profile.goals[0] ?? null)
        : role === 'moisturiser'
          ? whyCopy.gapMoisturiser
          : whyCopy.gapCleanser;
    const gapLine =
      role === 'spf'
        ? 'No SPF in your routine'
        : role === 'moisturiser'
          ? 'No moisturiser yet'
          : 'No cleanser yet';
    out.push(
      typeRec({
        trigger: gapTrigger,
        type: best.type,
        fit: best.fit,
        why,
        gapLine,
        input: eligibleInput,
      }),
    );
  }

  // 2. Replacement. A genuinely depleted/expiring product (docs/04). Shelf-anchored;
  // the existing replenishment sheet handles repurchase-or-better-fit (reuse).
  for (const item of eligibleShelf) {
    if (!item.expiring) continue;
    const id = `replacement:${item.id}`;
    out.push({
      id,
      trigger: 'replacement',
      group: GROUP_LABEL.replacement,
      productType: 'replacement',
      what: `Your ${item.name} is running low`,
      example: null,
      why: whyCopy.replacement(item.name),
      how: {
        profile: profileSummary(eligibleInput.profile),
        gap: `${item.name} is genuinely running out`,
        evidence: 'From your shelf. Opened a while ago',
        fit: 'Repurchase, or a better-fit alternative',
        caveat: null,
      },
      evidenceLabel: null,
      footLabel: 'From your shelf',
      footIsEvidence: false,
      caveat: null,
      fit: null,
      fitLabel: '',
      priority: PRIORITY.replacement,
      relatedProductId: item.id,
      relatedRuleId: null,
    });
  }

  // 3. Conflict resolution. A non-conflicting alternative to a clashing product
  // (docs/02). Surfaced as an OPTION; the conflict sheet holds the full detail.
  const topConflict = eligibleConflicts.find(
    (c) => !isReassuring(c) && c.rule.interactionType !== 'safety' && c.computedSeverity !== 'none',
  );
  if (topConflict && topConflict.productAName && topConflict.productBName) {
    const id = `conflict:${topConflict.rule.id}`;
    out.push({
      id,
      trigger: 'conflict',
      group: GROUP_LABEL.conflict,
      productType: 'conflict',
      what: `A non-conflicting alternative to ${topConflict.productBName}`,
      example: null,
      why: whyCopy.conflict(topConflict.productAName, topConflict.productBName),
      how: {
        profile: profileSummary(eligibleInput.profile),
        gap: `${topConflict.productAName} × ${topConflict.productBName} on your shelf`,
        evidence: topConflict.rule.resolutionCopy,
        fit: 'Would let you simplify your routine',
        caveat: null,
      },
      evidenceLabel: topConflict.rule.evidenceLabel,
      footLabel: 'Simplifies your shelf',
      footIsEvidence: false,
      caveat: null,
      fit: null,
      fitLabel: '',
      priority: PRIORITY.conflict,
      relatedProductId: topConflict.productBId,
      relatedRuleId: topConflict.rule.id,
    });
  }

  // 4. Better-fit. An owned fragranced product for sensitive skin (or a fragrance-
  // free preference): a gentler alternative, as an OPTION not a mandate.
  if (
    eligibleInput.profile.sensitivity === 'sensitive' ||
    eligibleInput.preferences.values.includes('fragrance_free')
  ) {
    const fragranced = eligibleShelf.find(
      (p) => p.fragranced && (p.role === 'cleanser' || p.role === 'moisturiser'),
    );
    if (fragranced) {
      const best = bestTypeForRole(fragranced.role, eligibleInput, 'better_fit', recTypes);
      // Prefer the fragrance-free variant explicitly.
      const ff = recTypes.find((t) => t.role === fragranced.role && /fragrance-free/i.test(t.what));
      const chosen = ff
        ? { type: ff, fit: fitScore(ff, makeFitContext(eligibleInput, 'better_fit')) }
        : best;
      if (chosen && chosen.fit.score != null) {
        const rec = typeRec({
          trigger: 'better_fit',
          type: chosen.type,
          fit: chosen.fit,
          why: whyCopy.betterFit(fragranced.name),
          gapLine: `${fragranced.name} is fragranced`,
          input: eligibleInput,
          relatedProductId: fragranced.id,
        });
        out.push({ ...rec, footLabel: 'Better fit', footIsEvidence: false });
      }
    }
  }

  // 5. Goal-driven. The first set goal nothing addresses yet, one active at a time
  // (docs/09 §4). Pregnancy-unsafe actives are excluded by FIT (→ a safe alternative).
  for (const goal of eligibleInput.profile.goals) {
    const served = GOAL_SERVED_BY[goal];
    const addressed =
      eligibleShelf.some((p) => p.tags.some((t) => served.tags.includes(t))) ||
      eligibleShelf.some(
        (p) => served.roles.includes(p.role) && (goal === 'hydration' || goal === 'barrier_repair'),
      );
    if (addressed) continue;
    const best = bestTypeForGoal(goal, eligibleInput, recTypes);
    if (!best) continue;
    out.push(
      typeRec({
        trigger: 'goal',
        type: best.type,
        fit: best.fit,
        why: whyCopy.goal(goal),
        gapLine: `Nothing addresses your ${goalShort(goal)} goal yet`,
        input: eligibleInput,
      }),
    );
    break; // one goal active at a time (restraint)
  }

  // Drop dismissed, de-dup by id, rank by the §5 priority ladder then FIT.
  const seen = new Set<string>();
  const ranked = out
    .filter((r) => !dismissed.has(r.id) && !seen.has(r.id) && (seen.add(r.id), true))
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return (b.fit?.score ?? b.priority) - (a.fit?.score ?? a.priority);
    });

  return { recommendations: ranked, youreSet: ranked.length === 0 };
}

/** Convenience for the detail screen: re-derive a single recommendation by id. */
export function findRecommendation(input: RecInput, id: string): Recommendation | undefined {
  return recommend(input).recommendations.find((r) => r.id === id);
}

export { DEFAULT_PREFERENCES, recTypeByKey };
