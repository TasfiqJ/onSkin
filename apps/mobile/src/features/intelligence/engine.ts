import type { ConflictSeverity, FunctionalTag, IngredientSubflag } from '@layerwell/types';

import {
  isReviewedRule,
  isRuntimeAdmittedConflictRuleCorpus,
  isRuleAdmittedByCorpus,
  shippableConflictRuleCorpus,
  type AdmittedConflictRuleCorpus,
  type ConflictApplicabilityConditions,
  type ConflictConstraint,
  type ConflictParticipantApplicability,
  type ConflictRule,
  type ConflictSafetyContext,
} from './rules';

// The conflict / synergy engine (docs/02 §4). Pure, deterministic, testable ,
// the doc mandates a fixture test per rule for this liability surface (§10).
// Tag-based, both-orders matching; concentration- and sensitivity-modulated
// severity; sub-flag exemptions; safety via a profile-derived `pregnancy`
// pseudo-tag; resolution-first; reassurance for myths.

export type SensitivityLevel = 'sensitive' | 'resistant' | 'neutral';

export type EngineProduct = {
  id: string;
  name: string;
  tags: FunctionalTag[];
  subflags?: IngredientSubflag[];
  /** Normalized molecule ids used only by molecule-scoped reviewed rules. */
  moleculeIds?: string[];
  /** Exact validated finished-formulation identity; never inferred from a name/subflag. */
  finishedFormulationId?: string;
  /** Coarse concentration band for modulation (docs/02 §4.2). */
  concentration?: 'low' | 'high';
  /** Exact reviewed applicability facts. Production adapters never infer these from names. */
  applicabilityFacts?: {
    moleculeIds?: readonly string[];
    finishedProductId?: string;
    finishedFormulationId?: string;
    concentration?: { value: number; unit: '%' | 'mg/ml' | 'unknown_unit' };
    applicationAmount?: {
      value: number;
      unit: 'pea_sized' | 'drops' | 'ml' | 'unknown_unit';
    };
    applicationArea?: string;
    frequencyPerWeek?: number;
    durationDays?: number;
    ph?: number;
    vehicle?: string;
    occlusion?: boolean;
    barrierCondition?: 'intact' | 'compromised' | 'unknown';
    exposure?: 'leave_on' | 'rinse_off';
  };
};

export type EngineProfile = {
  sensitivity: SensitivityLevel;
  /** Exact status used by production adapters. */
  reproductiveStatus?: ConflictSafetyContext | 'none';
  /** Preview/test compatibility only. Production must set reproductiveStatus. */
  pregnancy?: boolean;
  /** Exact safety context where available; legacy `pregnancy` maps to pregnant. */
  safetyStatus?: ConflictSafetyContext | 'none';
};

export type DetectedConflict = {
  rule: ConflictRule;
  productAId: string | null;
  productBId: string | null;
  productAName: string | null;
  productBName: string | null;
  computedSeverity: ConflictSeverity;
};

export type AdmittedDetectedConflict = DetectedConflict & {
  rule: ConflictRule & { admission: NonNullable<ConflictRule['admission']> };
};

export function isAdmittedDetectedConflict(
  conflict: DetectedConflict | null | undefined,
): conflict is AdmittedDetectedConflict {
  return Boolean(conflict && conflict.rule.admission && isReviewedRule(conflict.rule));
}

export type ConflictEvaluationStatus =
  | 'reviewed_interactions'
  | 'compatible'
  | 'not_applicable'
  | 'unsupported_unreviewed';

export type ConflictEvaluation = {
  status: ConflictEvaluationStatus;
  conflicts: DetectedConflict[];
  unsupportedPairs: string[];
};

export type ConcentrationCertainty = 'confirmed_low' | 'confirmed_high' | 'unknown';

const ORDER: ConflictSeverity[] = ['none', 'mild', 'moderate', 'high'];
const rank = (s: ConflictSeverity) => ORDER.indexOf(s);

/** Find every independently reviewed interaction for an unordered tag pair. */
export function findRules(
  rules: readonly ConflictRule[],
  a: FunctionalTag,
  b: FunctionalTag,
): ConflictRule[] {
  return rules.filter(
    (rule) => (rule.tagA === a && rule.tagB === b) || (rule.tagA === b && rule.tagB === a),
  );
}

/** Compatibility helper for call sites that require exactly one rule. */
export function findRule(
  rules: readonly ConflictRule[],
  a: FunctionalTag,
  b: FunctionalTag,
): ConflictRule | undefined {
  const matches = findRules(rules, a, b);
  return matches.length === 1 ? matches[0] : undefined;
}

/** Computed severity after concentration + sensitivity modulation (docs/02 §4.2). */
type ApplicabilityMatchContext = {
  a: EngineProduct;
  b: EngineProduct;
  reproductiveStatus: ConflictSafetyContext | null;
};

export type ExactApplicabilityEvaluation = 'matches' | 'does_not_match' | 'missing_facts';

function valueInRange(
  value: number,
  range: { minInclusive: number | null; maxInclusive: number | null },
): boolean {
  return (
    (range.minInclusive === null || value >= range.minInclusive) &&
    (range.maxInclusive === null || value <= range.maxInclusive)
  );
}

function allowedStringMatches(allowed: readonly string[], actual: string | undefined): boolean {
  return allowed.length > 0 && actual !== undefined && allowed.includes(actual);
}

function anyAllowedStringMatches(allowed: readonly string[], actual: readonly string[]): boolean {
  return allowed.length > 0 && actual.some((value) => allowed.includes(value));
}

function combineExactEvaluations(
  evaluations: readonly ExactApplicabilityEvaluation[],
): ExactApplicabilityEvaluation {
  if (evaluations.includes('does_not_match')) return 'does_not_match';
  if (evaluations.includes('missing_facts')) return 'missing_facts';
  return 'matches';
}

function exactConstraintEvaluation(
  rule: ConflictRule,
  conditions: ConflictApplicabilityConditions,
  context: ApplicabilityMatchContext,
): ExactApplicabilityEvaluation {
  const exact = <T>(constraint: ConflictConstraint<T>): T | null =>
    constraint.status === 'exact' ? constraint.value : null;
  const reproductiveContexts = exact(conditions.reproductiveContexts);
  if (reproductiveContexts) {
    if (!context.reproductiveStatus) return 'missing_facts';
    if (!reproductiveContexts.includes(context.reproductiveStatus)) return 'does_not_match';
  }

  const participantMatches = (
    participant: ConflictParticipantApplicability,
    product: EngineProduct,
  ): ExactApplicabilityEvaluation => {
    if (
      Object.values(participant).some(
        (constraint: ConflictConstraint<unknown>) => constraint.status === 'review_required',
      )
    ) {
      return 'missing_facts';
    }
    const facts = product.applicabilityFacts;
    const evaluations: ExactApplicabilityEvaluation[] = [];
    const evaluateFact = <T>(
      constraint: ConflictConstraint<T>,
      factPresent: boolean,
      matches: () => boolean,
    ) => {
      if (constraint.status !== 'exact') return;
      evaluations.push(!factPresent ? 'missing_facts' : matches() ? 'matches' : 'does_not_match');
    };

    const moleculeIds = exact(participant.moleculeIds);
    evaluateFact(participant.moleculeIds, Boolean(facts?.moleculeIds?.length), () =>
      Boolean(moleculeIds && anyAllowedStringMatches(moleculeIds, facts?.moleculeIds ?? [])),
    );
    const productIds = exact(participant.finishedProductIds);
    evaluateFact(participant.finishedProductIds, Boolean(facts?.finishedProductId), () =>
      Boolean(productIds && allowedStringMatches(productIds, facts?.finishedProductId)),
    );
    const formulationIds = exact(participant.finishedFormulationIds);
    evaluateFact(participant.finishedFormulationIds, Boolean(facts?.finishedFormulationId), () =>
      Boolean(formulationIds && allowedStringMatches(formulationIds, facts?.finishedFormulationId)),
    );
    const concentration = exact(participant.concentration);
    evaluateFact(participant.concentration, Boolean(facts?.concentration), () =>
      Boolean(
        concentration &&
        facts?.concentration &&
        facts.concentration.unit === concentration.unit &&
        valueInRange(facts.concentration.value, concentration),
      ),
    );
    const amount = exact(participant.applicationAmount);
    evaluateFact(participant.applicationAmount, Boolean(facts?.applicationAmount), () =>
      Boolean(
        amount &&
        facts?.applicationAmount &&
        facts.applicationAmount.unit === amount.unit &&
        valueInRange(facts.applicationAmount.value, amount),
      ),
    );
    const areas = exact(participant.applicationArea);
    evaluateFact(participant.applicationArea, Boolean(facts?.applicationArea), () =>
      Boolean(areas && allowedStringMatches(areas, facts?.applicationArea)),
    );
    const frequency = exact(participant.frequencyPerWeek);
    evaluateFact(participant.frequencyPerWeek, facts?.frequencyPerWeek !== undefined, () =>
      Boolean(
        frequency &&
        facts?.frequencyPerWeek !== undefined &&
        valueInRange(facts.frequencyPerWeek, frequency),
      ),
    );
    const duration = exact(participant.durationDays);
    evaluateFact(participant.durationDays, facts?.durationDays !== undefined, () =>
      Boolean(
        duration && facts?.durationDays !== undefined && valueInRange(facts.durationDays, duration),
      ),
    );
    const ph = exact(participant.ph);
    evaluateFact(participant.ph, facts?.ph !== undefined, () =>
      Boolean(ph && facts?.ph !== undefined && valueInRange(facts.ph, ph)),
    );
    const vehicles = exact(participant.vehicle);
    evaluateFact(participant.vehicle, Boolean(facts?.vehicle), () =>
      Boolean(vehicles && allowedStringMatches(vehicles, facts?.vehicle)),
    );
    const occlusion = exact(participant.occlusion);
    evaluateFact(
      participant.occlusion,
      facts?.occlusion !== undefined,
      () => occlusion !== null && facts?.occlusion === occlusion,
    );
    const barriers = exact(participant.barrierCondition);
    evaluateFact(participant.barrierCondition, facts?.barrierCondition !== undefined, () =>
      Boolean(
        barriers &&
        facts?.barrierCondition !== undefined &&
        barriers.includes(facts.barrierCondition),
      ),
    );
    const exposure = exact(participant.exposure);
    evaluateFact(
      participant.exposure,
      facts?.exposure !== undefined,
      () => exposure !== null && facts?.exposure === exposure,
    );
    return combineExactEvaluations(evaluations);
  };

  const assignments: [EngineProduct, EngineProduct][] = [];
  if (context.a.tags.includes(rule.tagA) && context.b.tags.includes(rule.tagB)) {
    assignments.push([context.a, context.b]);
  }
  if (context.b.tags.includes(rule.tagA) && context.a.tags.includes(rule.tagB)) {
    assignments.push([context.b, context.a]);
  }
  if (assignments.length === 0) return 'does_not_match';
  const assignmentEvaluations = assignments.map(([tagAProduct, tagBProduct]) =>
    combineExactEvaluations([
      participantMatches(conditions.tagA, tagAProduct),
      participantMatches(conditions.tagB, tagBProduct),
    ]),
  );
  if (assignmentEvaluations.includes('matches')) return 'matches';
  if (assignmentEvaluations.includes('missing_facts')) return 'missing_facts';
  return 'does_not_match';
}

/**
 * Pure applicability predicate for corpus-review tooling and exhaustive tests.
 * It never admits a rule or produces user-facing guidance.
 */
export function evaluateExactApplicabilityForReview(
  rule: ConflictRule,
  conditions: ConflictApplicabilityConditions,
  a: EngineProduct,
  b: EngineProduct,
  reproductiveStatus: ConflictSafetyContext | null = null,
): ExactApplicabilityEvaluation {
  return exactConstraintEvaluation(rule, conditions, { a, b, reproductiveStatus });
}

export function matchesExactApplicabilityForReview(
  rule: ConflictRule,
  conditions: ConflictApplicabilityConditions,
  a: EngineProduct,
  b: EngineProduct,
  reproductiveStatus: ConflictSafetyContext | null = null,
): boolean {
  return (
    evaluateExactApplicabilityForReview(rule, conditions, a, b, reproductiveStatus) === 'matches'
  );
}

export type ReviewedSeverityEvaluation =
  | { status: 'resolved'; severity: ConflictSeverity }
  | { status: 'unsupported_missing_facts'; severity: null }
  | { status: 'unsupported_ambiguous_branches'; severity: null };

/**
 * Resolve an admitted rule's severity branches without treating absent exact
 * facts as the base branch. Admission provenance is enforced by the caller.
 */
export function evaluateReviewedSeverityForApplicability(
  rule: ConflictRule,
  a: EngineProduct,
  b: EngineProduct,
  reproductiveStatus: ConflictSafetyContext | null = null,
): ReviewedSeverityEvaluation {
  const evaluations = rule.applicability.severityBranches.map((branch) => ({
    branch,
    applicability: evaluateExactApplicabilityForReview(
      rule,
      branch.conditions,
      a,
      b,
      reproductiveStatus,
    ),
  }));
  if (evaluations.some(({ applicability }) => applicability === 'missing_facts')) {
    return { status: 'unsupported_missing_facts', severity: null };
  }
  const matched = evaluations.filter(({ applicability }) => applicability === 'matches');
  if (matched.length > 1) {
    return { status: 'unsupported_ambiguous_branches', severity: null };
  }
  return {
    status: 'resolved',
    severity: matched[0]?.branch.severity ?? rule.baseSeverity,
  };
}

export function modulateSeverity(
  rule: ConflictRule,
  context?: ApplicabilityMatchContext,
  corpus: AdmittedConflictRuleCorpus | null = null,
): ConflictSeverity | null {
  if (
    context &&
    corpus &&
    rule.applicability.reviewStatus === 'reviewed' &&
    isRuleAdmittedByCorpus(rule, corpus)
  ) {
    const evaluation = evaluateReviewedSeverityForApplicability(
      rule,
      context.a,
      context.b,
      context.reproductiveStatus,
    );
    return evaluation.severity;
  }
  return rule.baseSeverity;
}

function concentrationCertainty(a: EngineProduct, b: EngineProduct): ConcentrationCertainty {
  if (a.concentration === 'high' || b.concentration === 'high') return 'confirmed_high';
  if (a.concentration === 'low' && b.concentration === 'low') return 'confirmed_low';
  return 'unknown';
}

function safetyContext(profile: EngineProfile): ConflictSafetyContext | null {
  if (profile.reproductiveStatus === 'none') return null;
  if (profile.reproductiveStatus) return profile.reproductiveStatus;
  if (profile.safetyStatus === 'none') return null;
  if (profile.safetyStatus) return profile.safetyStatus;
  return profile.pregnancy ? 'pregnant' : null;
}

function ruleApplies(
  rule: ConflictRule,
  a: EngineProduct,
  b: EngineProduct,
  activeSafetyContext: ConflictSafetyContext | null,
  requireExactApplicability: boolean,
): boolean {
  if (requireExactApplicability) {
    return (
      rule.applicability.reviewStatus === 'reviewed' &&
      evaluateExactApplicabilityForReview(
        rule,
        rule.applicability.approvedConditions,
        a,
        b,
        activeSafetyContext,
      ) === 'matches'
    );
  }

  const ingredientScope = rule.applicability.ingredientScope;
  if (ingredientScope.mode === 'named_molecules') {
    const scopedProduct = [a, b].find((product) =>
      ingredientScope.tag ? product.tags.includes(ingredientScope.tag) : false,
    );
    if (
      !scopedProduct?.moleculeIds?.some((molecule) => ingredientScope.molecules.includes(molecule))
    ) {
      return false;
    }
  }

  const formulationIds = new Set(
    [a.finishedFormulationId, b.finishedFormulationId].filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    ),
  );
  if (
    rule.applicability.ingredientScope.formulationExemptions.some((exemption) =>
      formulationIds.has(exemption.finishedFormulationId),
    )
  ) {
    return false;
  }

  if (
    rule.interactionType === 'safety' &&
    (!activeSafetyContext || !rule.applicability.safetyContexts.includes(activeSafetyContext))
  ) {
    return false;
  }

  if (rule.applicability.concentration === 'confirmed_high_or_unknown') {
    const real = a.id === '__pregnancy__' ? b : b.id === '__pregnancy__' ? a : null;
    if (!real || real.concentration === 'low') return false;
  }
  return true;
}

/**
 * Shelf-level detection: every unordered pair of the user's active products,
 * plus each product against the `pregnancy` pseudo-product when applicable.
 * Resolution-awareness (already-separated pairs in a routine) is applied by the
 * scheduler layer, not here.
 */
function detectConflicts(
  products: EngineProduct[],
  profile: EngineProfile,
  rules: readonly ConflictRule[],
  corpus: AdmittedConflictRuleCorpus | null = null,
): DetectedConflict[] {
  const items: EngineProduct[] = [...products];
  const activeSafetyContext = safetyContext(profile);
  if (activeSafetyContext) {
    items.push({ id: '__pregnancy__', name: activeSafetyContext, tags: ['pregnancy'] });
  }

  const seen = new Set<string>();
  const out: DetectedConflict[] = [];

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]!;
      const b = items[j]!;

      for (const tagA of a.tags) {
        for (const tagB of b.tags) {
          for (const rule of findRules(rules, tagA, tagB)) {
            const key = `${rule.id}:${a.id}:${b.id}`;
            if (seen.has(key) || !ruleApplies(rule, a, b, activeSafetyContext, Boolean(corpus))) {
              continue;
            }

            const computedSeverity = modulateSeverity(
              rule,
              { a, b, reproductiveStatus: activeSafetyContext },
              corpus,
            );
            if (computedSeverity === null) continue;
            seen.add(key);
            out.push({
              rule,
              productAId: a.id === '__pregnancy__' ? null : a.id,
              productBId: b.id === '__pregnancy__' ? null : b.id,
              productAName: a.id === '__pregnancy__' ? null : a.name,
              productBName: b.id === '__pregnancy__' ? null : b.name,
              computedSeverity,
            });
          }
        }
      }
    }
  }

  // Rank: safety first, then severity desc, then by evidence (established first).
  const evidenceOrder = ['established', 'plausible', 'contested', 'refuted'];
  out.sort((x, y) => {
    const safety =
      Number(y.rule.interactionType === 'safety') - Number(x.rule.interactionType === 'safety');
    if (safety) return safety;
    const sev = rank(y.computedSeverity) - rank(x.computedSeverity);
    if (sev) return sev;
    return (
      evidenceOrder.indexOf(x.rule.evidenceLabel) - evidenceOrder.indexOf(y.rule.evidenceLabel)
    );
  });

  return out;
}

/** Candidate-only evaluator for tests and explicit development previews. */
export function previewDetectConflicts(
  products: EngineProduct[],
  profile: EngineProfile,
  rules: readonly ConflictRule[],
): DetectedConflict[] {
  return detectConflicts(products, profile, rules);
}

type EvaluatedPair = {
  a: EngineProduct;
  b: EngineProduct;
  tagA: FunctionalTag;
  tagB: FunctionalTag;
  coverageKey: string;
};

function evaluatedPairs(
  products: readonly EngineProduct[],
  profile: EngineProfile,
): EvaluatedPair[] {
  const items: EngineProduct[] = [...products];
  const activeSafetyContext = safetyContext(profile);
  if (activeSafetyContext) {
    items.push({ id: '__pregnancy__', name: 'Safety context', tags: ['pregnancy'] });
  }
  const pairs: EvaluatedPair[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]!;
      const b = items[j]!;
      for (const tagA of items[i]!.tags) {
        for (const tagB of items[j]!.tags) {
          const pair = [tagA, tagB].sort().join('|');
          const context =
            tagA === 'pregnancy' || tagB === 'pregnancy'
              ? (activeSafetyContext ?? 'none')
              : 'routine';
          pairs.push({
            a,
            b,
            tagA,
            tagB,
            coverageKey: `${pair}@${context}@${concentrationCertainty(a, b)}`,
          });
        }
      }
    }
  }
  return pairs;
}

function unassessablePairCoverageKeys(
  products: readonly EngineProduct[],
  profile: EngineProfile,
): string[] {
  const keys: string[] = [];
  for (let i = 0; i < products.length; i++) {
    for (let j = i + 1; j < products.length; j++) {
      if (products[i]!.tags.length === 0 || products[j]!.tags.length === 0) {
        keys.push(`unassessable_pair@routine@unknown#${i}-${j}`);
      }
    }
  }
  const activeSafetyContext = safetyContext(profile);
  if (activeSafetyContext) {
    for (let i = 0; i < products.length; i++) {
      if (products[i]!.tags.length === 0) {
        keys.push(`unassessable_pair@${activeSafetyContext}@unknown#${i}`);
      }
    }
  }
  return keys;
}

/**
 * Coverage-aware production entry point. Missing admission or an uncovered
 * pair is never reported as compatibility.
 */
export function evaluateConflicts(
  products: EngineProduct[],
  profile: EngineProfile,
  corpus: AdmittedConflictRuleCorpus | null = shippableConflictRuleCorpus(),
): ConflictEvaluation {
  const pairs = evaluatedPairs(products, profile);
  const unassessablePairs = unassessablePairCoverageKeys(products, profile);
  if (pairs.length === 0) {
    if (unassessablePairs.length > 0) {
      return {
        status: 'unsupported_unreviewed',
        conflicts: [],
        unsupportedPairs: unassessablePairs,
      };
    }
    return { status: 'not_applicable', conflicts: [], unsupportedPairs: [] };
  }
  if (!isRuntimeAdmittedConflictRuleCorpus(corpus)) {
    return {
      status: 'unsupported_unreviewed',
      conflicts: [],
      unsupportedPairs: [
        ...new Set([...pairs.map((pair) => pair.coverageKey), ...unassessablePairs]),
      ].sort(),
    };
  }

  const conflicts = detectConflicts(products, profile, corpus.rules, corpus);
  const activeSafetyContext = safetyContext(profile);
  const compatibleCoverage = new Set(corpus.reviewedCompatiblePairs);
  const unsupportedPairs = [
    ...new Set([
      ...unassessablePairs,
      ...pairs
        .filter((pair) => {
          const applicableRules = findRules(corpus.rules, pair.tagA, pair.tagB).filter((rule) =>
            ruleApplies(rule, pair.a, pair.b, activeSafetyContext, true),
          );
          if (
            applicableRules.some(
              (rule) =>
                evaluateReviewedSeverityForApplicability(rule, pair.a, pair.b, activeSafetyContext)
                  .status !== 'resolved',
            )
          ) {
            return true;
          }
          return applicableRules.length === 0 && !compatibleCoverage.has(pair.coverageKey);
        })
        .map((pair) => pair.coverageKey),
    ]),
  ].sort();
  if (unsupportedPairs.length > 0) {
    return { status: 'unsupported_unreviewed', conflicts, unsupportedPairs };
  }
  return {
    status: conflicts.length > 0 ? 'reviewed_interactions' : 'compatible',
    conflicts,
    unsupportedPairs: [],
  };
}

/** Positive/neutral interactions to surface as reassurance (docs/02 §4.1/§7.8). */
export function isReassuring(c: DetectedConflict): boolean {
  return c.rule.interactionType === 'myth' || c.rule.interactionType === 'synergy';
}
