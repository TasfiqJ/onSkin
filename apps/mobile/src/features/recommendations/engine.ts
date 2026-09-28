import type {
  EvidenceLabel,
  FunctionalTag,
  GoalId,
  RecommendationTrigger,
  SequencingRole,
} from '@layerwell/types';

import type {
  ConflictEvaluationStatus,
  DetectedConflict,
  EngineProduct,
  SensitivityLevel,
} from '@/features/intelligence/engine';
import {
  evaluateExactApplicabilityForReview,
  evaluateReviewedSeverityForApplicability,
  isAdmittedDetectedConflict,
  isReassuring,
} from '@/features/intelligence/engine';
import { conflictKey } from '@/features/intelligence/conflictIdentity';
import {
  pregnancySafetyEvaluationForProduct,
  type PregnancySafetyMode,
} from '@/features/intelligence/pregnancySafety';
import {
  shippableRules,
  type ConflictRule,
  type ConflictSafetyContext,
} from '@/features/intelligence/rules';

import { recTypeByKey, shippableRecTypes, type RecType } from './catalog';
import {
  shelfContextProvenance,
  typeFirstProvenance,
  type RecommendationProvenance,
} from './admission';
import { GROUP_LABEL, goalShort, replacementCopy, whyCopy } from './copy';
import { fitLabel, fitScore, type FitContext, type FitResult } from './fit';
import { isCurrentFragranceFreeRecommendationType } from './fragrance';
import { goalActiveRecommendationAdmission } from './goalAdmission';
import type { GoalRecommendationProvenance } from './goalProvenance';
import { DEFAULT_PREFERENCES, type RecPreferences } from './preferences';
import type { ReplenishmentReason } from './replenishment';

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
  applicabilityFacts?: EngineProduct['applicabilityFacts'];
  fragranced: boolean;
};

export type RecReplenishmentItem = Pick<
  RecShelfItem,
  'id' | 'name' | 'tags' | 'concentration' | 'applicabilityFacts'
> & { reason: ReplenishmentReason };

export type RecProfile = {
  sensitivity: SensitivityLevel;
  pregnancy: boolean;
  /** Legacy input bit only; exact decisions use reproductiveStatus. */
  pregnancySafety?: PregnancySafetyMode;
  reproductiveStatus?: ConflictSafetyContext | 'none';
  goals: GoalId[];
  consentCurrent?: boolean;
  goalProvenance?: GoalRecommendationProvenance | null;
};

export type RecInput = {
  profile: RecProfile;
  /** Active products only. These determine routine coverage, fit, and conflicts. */
  shelf: RecShelfItem[];
  /** Honest replacement signals, including finished archive rows. */
  replenishment?: RecReplenishmentItem[];
  /** Unresolved interactions from the docs/02 engine (already launch-gated). */
  conflicts: DetectedConflict[];
  conflictCoverageStatus?: ConflictEvaluationStatus;
  preferences: RecPreferences;
  /** Ids the user has dismissed ("not for me"). Never re-surfaced. */
  dismissed?: Set<string>;
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
  /** Exact unordered product pair for a conflict detail route. */
  relatedConflictProductIds: [string, string] | null;
  /**
   * Runtime-safe origin boundary. Current engine producers emit only type-first
   * or shelf-context provenance; neither can become a catalog product.
   */
  provenance: RecommendationProvenance;
};

export type RecResult = {
  recommendations: Recommendation[];
  /** True only when a real evaluation found nothing to add (docs/09 §4 seventh state). */
  youreSet: boolean;
  /** True when an unaddressed goal exists but current goal-active review is closed. */
  goalReviewPending: boolean;
  conflictCoverageStatus: ConflictEvaluationStatus;
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
// Until the reviewed safety corpus can positively clear an exact product + reproductive
// context, these medically adjacent tags must never produce "repurchase" copy. This is a
// withholding boundary, not product-safety guidance.
const REPRODUCTIVE_REPLACEMENT_REVIEW_TAGS = new Set<FunctionalTag>([
  'retinoid',
  'hydroquinone',
  'bha',
]);
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

function goalIsAddressedByShelf(goal: GoalId, shelf: readonly RecShelfItem[]): boolean {
  const served = GOAL_SERVED_BY[goal];
  return (
    shelf.some((product) => product.tags.some((tag) => served.tags.includes(tag))) ||
    shelf.some(
      (product) =>
        served.roles.includes(product.role) && (goal === 'hydration' || goal === 'barrier_repair'),
    )
  );
}

function sensitivityWord(s: SensitivityLevel): string {
  return s === 'sensitive' ? 'Sensitive skin' : s === 'resistant' ? 'Resistant skin' : 'Your skin';
}

function reproductiveStatusForProfile(profile: RecProfile): ConflictSafetyContext | 'none' {
  return profile.reproductiveStatus ?? (profile.pregnancy ? 'pregnant' : 'none');
}

function requiresReproductiveReviewForReplacement(
  item: RecReplenishmentItem,
  reproductiveStatus: ConflictSafetyContext | 'none',
): boolean {
  return (
    reproductiveStatus !== 'none' &&
    item.tags.some((tag) => REPRODUCTIVE_REPLACEMENT_REVIEW_TAGS.has(tag))
  );
}

function profileSummary(p: RecProfile): string {
  const parts = [sensitivityWord(p.sensitivity)];
  const reproductiveStatus = reproductiveStatusForProfile(p);
  if (reproductiveStatus === 'pregnant') parts.push('Pregnant or trying setting');
  if (reproductiveStatus === 'breastfeeding') parts.push('Breastfeeding setting');
  if (reproductiveStatus === 'trying') parts.push('Trying-to-conceive setting');
  if (reproductiveStatus === 'unknown') parts.push('Safety setting not confirmed');
  if (reproductiveStatus === 'prefer_not') parts.push('Private safety setting');
  if (p.goals[0]) parts.push(`${goalShort(p.goals[0])} goal`);
  return parts.join(' · ');
}

export type RecommendationConflictDisposition =
  | 'eligible'
  | 'reviewed_conflict'
  | 'unsupported_missing_facts'
  | 'unsupported_ambiguous_branches';

function shelfItemAsEngineProduct(item: RecShelfItem): EngineProduct {
  return {
    id: item.id,
    name: item.name,
    tags: item.tags,
    applicabilityFacts: item.applicabilityFacts,
  };
}

function recTypeAsEngineProduct(type: RecType): EngineProduct {
  return {
    id: `__recommendation_type__:${type.type}`,
    name: type.what,
    tags: type.tags,
    applicabilityFacts: type.applicabilityFacts,
  };
}

/**
 * Exact conflict hard-exclusion for one type. A tag pair is only a candidate;
 * exact molecule/formulation/exposure facts decide it. If an admitted rule
 * needs a fact the type or shelf row does not carry, the recommendation is
 * withheld instead of being called compatible.
 */
export function recommendationConflictDispositionForType(
  type: RecType,
  shelf: readonly RecShelfItem[],
  rules: readonly ConflictRule[],
): RecommendationConflictDisposition {
  const candidate = recTypeAsEngineProduct(type);
  let hasMissingFacts = false;
  let hasAmbiguousBranches = false;
  let hasReviewedConflict = false;

  for (const rule of rules) {
    if (
      rule.interactionType === 'myth' ||
      rule.interactionType === 'synergy' ||
      rule.interactionType === 'safety' ||
      rule.applicability.reviewStatus !== 'reviewed' ||
      rule.admission?.status !== 'approved'
    ) {
      continue;
    }
    for (const item of shelf) {
      const product = shelfItemAsEngineProduct(item);
      const base = evaluateExactApplicabilityForReview(
        rule,
        rule.applicability.approvedConditions,
        product,
        candidate,
      );
      if (base === 'does_not_match') continue;
      if (base === 'missing_facts') {
        hasMissingFacts = true;
        continue;
      }

      const severity = evaluateReviewedSeverityForApplicability(rule, product, candidate);
      if (severity.status === 'unsupported_ambiguous_branches') {
        hasAmbiguousBranches = true;
        continue;
      }
      if (severity.status === 'unsupported_missing_facts') {
        hasMissingFacts = true;
        continue;
      }
      if (severity.severity !== 'none') hasReviewedConflict = true;
    }
  }
  if (hasAmbiguousBranches) return 'unsupported_ambiguous_branches';
  if (hasMissingFacts) return 'unsupported_missing_facts';
  return hasReviewedConflict ? 'reviewed_conflict' : 'eligible';
}

function conflictTypeIdsForShelf(
  shelf: readonly RecShelfItem[],
  recTypes: readonly RecType[],
  rules: readonly ConflictRule[],
): Set<string> {
  return new Set(
    recTypes.flatMap((type) =>
      recommendationConflictDispositionForType(type, shelf, rules) === 'eligible'
        ? []
        : [type.type],
    ),
  );
}

function makeFitContext(
  input: RecInput,
  trigger: RecommendationTrigger,
  rules: readonly ConflictRule[],
  recTypes: readonly RecType[],
): FitContext {
  const ownedTags = new Set<FunctionalTag>(input.shelf.flatMap((p) => p.tags));
  return {
    sensitivity: input.profile.sensitivity,
    reproductiveStatus: reproductiveStatusForProfile(input.profile),
    preferences: input.preferences,
    ownedTags,
    conflictTypeIds: conflictTypeIdsForShelf(input.shelf, recTypes, rules),
    trigger,
  };
}

/** Best locally renderable type-first role; null if none survives exclusions. */
function bestTypeForRole(
  role: SequencingRole,
  input: RecInput,
  trigger: RecommendationTrigger,
  recTypes: RecType[],
  rules: ConflictRule[],
): { type: RecType; fit: FitResult } | null {
  const ctx = makeFitContext(input, trigger, rules, recTypes);
  const scored = recTypes
    .filter((t) => t.role === role)
    .map((t) => ({ type: t, fit: fitScore(t, ctx) }))
    .filter((s) => s.fit.score != null)
    .sort((a, b) => (b.fit.score ?? 0) - (a.fit.score ?? 0));
  return scored[0] ?? null;
}

/** Best otherwise-eligible goal active; the independent goal admission still governs output. */
function bestTypeForGoal(
  goal: GoalId,
  input: RecInput,
  recTypes: RecType[],
  rules: ConflictRule[],
): { type: RecType; fit: FitResult } | null {
  // Goal actives are medically adjacent and remain unreviewed. An exact
  // reproductive context cannot be converted into an invented "safe swap."
  if (reproductiveStatusForProfile(input.profile) !== 'none') return null;
  const ctx = makeFitContext(input, 'goal', rules, recTypes);
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
  if (
    input.preferences.values.includes('fragrance_free') &&
    isCurrentFragranceFreeRecommendationType(type)
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
    relatedConflictProductIds: null,
    provenance: typeFirstProvenance(type.type),
  };
}

function recommendCore(input: RecInput, rules: ConflictRule[]): RecResult {
  const reproductiveStatus = reproductiveStatusForProfile(input.profile);
  const replenishment = input.replenishment ?? [];
  const safetyExcludedIds = new Set(
    [...input.shelf, ...replenishment]
      .filter(
        (item) =>
          pregnancySafetyEvaluationForProduct(item, reproductiveStatus, rules).status !==
          'not_applicable',
      )
      .map((item) => item.id),
  );
  const eligibleShelf = input.shelf.filter((item) => !safetyExcludedIds.has(item.id));
  const eligibleReplenishment = replenishment.filter(
    (item) =>
      !safetyExcludedIds.has(item.id) &&
      !requiresReproductiveReviewForReplacement(item, reproductiveStatus),
  );
  const eligibleConflicts = input.conflicts.filter(
    (conflict) =>
      isAdmittedDetectedConflict(conflict) &&
      (conflict.productAId == null || !safetyExcludedIds.has(conflict.productAId)) &&
      (conflict.productBId == null || !safetyExcludedIds.has(conflict.productBId)),
  );
  const eligibleInput: RecInput = {
    ...input,
    shelf: eligibleShelf,
    replenishment: eligibleReplenishment,
    conflicts: eligibleConflicts,
  };
  // The production input cannot supply recommendation copy or type rows. Only
  // the checked-in, launch-gated catalog can reach rendering and scoring.
  const recTypes = shippableRecTypes();
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
    const best = bestTypeForRole(role, eligibleInput, gapTrigger, recTypes, rules);
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

  // 2. Replacement. A tracked freshness signal or an unsuperseded finished unit
  // (docs/04 section 6). Archive rows do not count as active routine inventory.
  for (const item of eligibleReplenishment) {
    const id = `replacement:${item.id}`;
    const copy = replacementCopy(item.name, item.reason);
    out.push({
      id,
      trigger: 'replacement',
      group: GROUP_LABEL.replacement,
      productType: 'replacement',
      what: copy.what,
      example: null,
      why: copy.why,
      how: {
        profile: profileSummary(eligibleInput.profile),
        gap: copy.gap,
        evidence: copy.evidence,
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
      relatedConflictProductIds: null,
      provenance: shelfContextProvenance(item.id),
    });
  }

  // 3. Conflict resolution. A non-conflicting alternative to a clashing product
  // (docs/02). Surfaced as an OPTION; the conflict sheet holds the full detail.
  const topConflict = eligibleConflicts.find(
    (c) => !isReassuring(c) && c.rule.interactionType !== 'safety' && c.computedSeverity !== 'none',
  );
  if (
    topConflict?.productAId &&
    topConflict.productBId &&
    topConflict.productAName &&
    topConflict.productBName
  ) {
    const productIds = [topConflict.productAId, topConflict.productBId].sort() as [string, string];
    const id = `conflict:${conflictKey(topConflict)}`;
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
        evidence: topConflict.rule.copy.resolution,
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
      relatedConflictProductIds: productIds,
      provenance: shelfContextProvenance(topConflict.productBId),
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
      // An adjacent "sensitive-safe" or example-only type is not fragrance-free
      // authority. Withhold unless the exact role has an explicit current type fact.
      const fragranceFreeType = recTypes.find(
        (type) => type.role === fragranced.role && isCurrentFragranceFreeRecommendationType(type),
      );
      if (fragranceFreeType) {
        const fit = fitScore(
          fragranceFreeType,
          makeFitContext(eligibleInput, 'better_fit', rules, recTypes),
        );
        if (fit.score != null) {
          const rec = typeRec({
            trigger: 'better_fit',
            type: fragranceFreeType,
            fit,
            why: whyCopy.betterFit(fragranced.name),
            gapLine: `${fragranced.name} has a fragrance marker in your saved shelf details`,
            input: eligibleInput,
            relatedProductId: fragranced.id,
          });
          out.push({ ...rec, footLabel: 'Better fit', footIsEvidence: false });
        }
      }
    }
  }

  // 5. Goal-driven. The first set goal nothing addresses yet, one active at a time
  // (docs/09 §4). Pregnancy-unsafe actives are excluded by FIT (→ a safe alternative).
  const goalAdmission = goalActiveRecommendationAdmission({
    consentCurrent: eligibleInput.profile.consentCurrent === true,
    goals: eligibleInput.profile.goals,
    provenance: eligibleInput.profile.goalProvenance,
  });
  const unaddressedGoals = eligibleInput.profile.goals.filter(
    (goal) => !goalIsAddressedByShelf(goal, eligibleShelf),
  );
  if (goalAdmission.admitted) {
    for (const goal of unaddressedGoals) {
      const best = bestTypeForGoal(goal, eligibleInput, recTypes, rules);
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
  }

  // Drop dismissed, de-dup by id, rank by the §5 priority ladder then FIT.
  const seen = new Set<string>();
  const ranked = out
    .filter((recommendation) => {
      const legacyConflictId = recommendation.relatedRuleId
        ? `conflict:${recommendation.relatedRuleId}`
        : null;
      const isDismissed =
        dismissed.has(recommendation.id) ||
        (recommendation.trigger === 'conflict' &&
          legacyConflictId != null &&
          dismissed.has(legacyConflictId));
      return !isDismissed && !seen.has(recommendation.id) && (seen.add(recommendation.id), true);
    })
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return (b.fit?.score ?? b.priority) - (a.fit?.score ?? a.priority);
    });

  const conflictCoverageStatus = input.conflictCoverageStatus ?? 'unsupported_unreviewed';
  const goalReviewPending = unaddressedGoals.length > 0 && !goalAdmission.admitted;
  return {
    recommendations: ranked,
    youreSet:
      ranked.length === 0 &&
      conflictCoverageStatus === 'compatible' &&
      unaddressedGoals.length === 0,
    goalReviewPending,
    conflictCoverageStatus,
  };
}

/** Production API: arbitrary rule fields on input are ignored. */
export function recommend(input: RecInput): RecResult {
  return recommendCore(input, shippableRules());
}

/** Convenience for the detail screen: re-derive a single recommendation by id. */
export function findRecommendation(input: RecInput, id: string): Recommendation | undefined {
  return recommend(input).recommendations.find((r) => r.id === id);
}

export { DEFAULT_PREFERENCES, recTypeByKey };
