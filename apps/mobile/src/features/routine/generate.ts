import type { GoalId, SequencingRole } from '@layerwell/types';

import {
  evaluateConflicts,
  type ConflictEvaluationStatus,
  type DetectedConflict,
  type EngineProduct,
  type EngineProfile,
} from '@/features/intelligence/engine';
import { unresolvedConflicts, type ConflictChoices } from '@/features/intelligence/conflictChoices';
import { pickCycle, type CycleTemplate } from '@/features/intelligence/scheduler';
import type {
  PregnancySafetyMode,
  PregnancySafetyReason,
  PregnancySafetyStatus,
} from '@/features/intelligence/pregnancySafety';

import { initRamp, type RampState } from './ramp';
import { canUseRoutineCadence, canUseRoutineSequencing } from './reviewGate';
import {
  classifyRole,
  routineCadenceDisposition,
  sequencePhase,
  shippableSequencingRules,
  type ClassifiableProduct,
  type SequencedStep,
  type ShippableSequencingRules,
} from './sequencing';

// The deterministic generation pipeline (docs/03 §2): classify → allocate AM/PM →
// sequence → assign frequency/cycling + init ramp → run detect_conflicts + apply
// resolutions → plan. Pure + explainable. Every step traces to a rule/profile.

export type PlanStep = SequencedStep;

export type GeneratedPlan = {
  am: PlanStep[];
  pm: PlanStep[];
  cycle: CycleTemplate | null;
  ramp: { productId: string; name: string; state: RampState }[];
  safetyExclusions: {
    productId: string;
    name: string;
    reason: PregnancySafetyReason;
  }[];
  cadenceWithheld: { productId: string; name: string }[];
  sequencingWithheld: {
    productId: string;
    name: string;
    role: SequencingRole;
    placement: 'withheld';
    reason: 'review_required';
  }[];
  unplacedProducts: { productId: string; name: string }[];
  gaps: string[];
  conflicts: DetectedConflict[];
  conflictCoverageStatus: ConflictEvaluationStatus;
  unsupportedConflictPairs: string[];
};

// Roles whose absence is worth a calm, claim-safe gap note (docs/03 §2. Never
// fabricate a product, just note what would round the routine out).
const GAP_NOTES: Partial<Record<SequencingRole, string>> = {
  cleanser: 'A gentle cleanser would give your routine a clean base.',
  moisturiser: 'A moisturiser would help seal everything in.',
  spf: 'A daily SPF would round this out. It’s the highest-impact morning step.',
};

export type RoutineProduct = ClassifiableProduct & {
  rampEligible?: boolean;
  /** Coarse concentration band (docs/02 §4.2) so the conflict engine escalates
   *  high-dose severity and the dose-gated pregnancy safety rule can fire. */
  concentration?: 'low' | 'high';
};

export type RoutineGenerationProfile = EngineProfile & {
  goals: string[];
  pregnancySafety?: PregnancySafetyMode;
  pregnancyStatus?: PregnancySafetyStatus;
};

export function generatePlan(
  products: RoutineProduct[],
  profile: RoutineGenerationProfile,
  conflictChoices: ConflictChoices = {},
  sequencingRules: ShippableSequencingRules = shippableSequencingRules(),
): GeneratedPlan {
  const reproductiveStatus =
    profile.pregnancyStatus ??
    profile.reproductiveStatus ??
    (profile.pregnancy ? 'pregnant' : 'none');
  const engineProducts: EngineProduct[] = products.map((product) => ({
    id: product.id,
    name: product.name,
    tags: product.tags,
    concentration: product.concentration,
  }));
  const conflictEvaluation = evaluateConflicts(engineProducts, {
    ...profile,
    reproductiveStatus,
  });
  const productByIdForSafety = new Map(products.map((product) => [product.id, product] as const));
  const safetyExclusions = conflictEvaluation.conflicts.flatMap((conflict) => {
    if (conflict.rule.interactionType !== 'safety') return [];
    const productId = conflict.productAId ?? conflict.productBId;
    const product = productId ? productByIdForSafety.get(productId) : null;
    if (!product) return [];
    const activeTag = conflict.rule.tagA === 'pregnancy' ? conflict.rule.tagB : conflict.rule.tagA;
    const reason: PregnancySafetyReason =
      activeTag === 'retinoid'
        ? 'retinoid'
        : activeTag === 'hydroquinone'
          ? 'hydroquinone'
          : 'bha_not_confirmed_low';
    return [{ productId: product.id, name: product.name, reason }];
  });
  const excludedIds = new Set(safetyExclusions.map((item) => item.productId));
  const routineProducts = products.filter((product) => !excludedIds.has(product.id));
  const classifiedProducts = routineProducts.map((product) => ({
    product,
    role: classifyRole(product),
    cadence: routineCadenceDisposition(product),
  }));
  const unplacedProducts = classifiedProducts
    .filter(({ role }) => role == null)
    .map(({ product }) => ({ productId: product.id, name: product.name }))
    .sort((a, b) => a.productId.localeCompare(b.productId));

  // Treatment/exfoliant placement implies a cadence. Until the clinical cadence
  // review gate opens, withhold those products instead of turning an unassigned
  // PM active into a daily Today step.
  const allowCadence = canUseRoutineCadence();
  const cadenceWithheld = classifiedProducts
    .filter(
      ({ role, cadence }) =>
        (role === 'treatment' || role === 'exfoliant') && (!allowCadence || cadence === 'withheld'),
    )
    .map(({ product }) => ({ productId: product.id, name: product.name }))
    .sort((a, b) => a.productId.localeCompare(b.productId));
  const cadenceWithheldIds = new Set(cadenceWithheld.map((item) => item.productId));
  const availableSequencingRules = shippableSequencingRules(sequencingRules);
  const allowSequencing = canUseRoutineSequencing(availableSequencingRules);
  const sequencingWithheld = classifiedProducts
    .filter(
      ({ product, role }) =>
        role != null &&
        !cadenceWithheldIds.has(product.id) &&
        (!allowSequencing || availableSequencingRules[role] == null),
    )
    .map(({ product, role }) => ({
      productId: product.id,
      name: product.name,
      role: role!,
      placement: 'withheld' as const,
      reason: 'review_required' as const,
    }))
    .sort((a, b) => a.productId.localeCompare(b.productId));
  const sequencingWithheldIds = new Set(sequencingWithheld.map((item) => item.productId));
  const sequenceEligibleProducts = routineProducts.filter(
    (product) => !cadenceWithheldIds.has(product.id) && !sequencingWithheldIds.has(product.id),
  );
  const am = sequencePhase(sequenceEligibleProducts, 'am', availableSequencingRules);
  const pm = sequencePhase(sequenceEligibleProducts, 'pm', availableSequencingRules) as PlanStep[];
  const cycleProductIds = new Set(
    classifiedProducts
      .filter(
        ({ product, cadence }) =>
          cadence === 'cycle' &&
          !cadenceWithheldIds.has(product.id) &&
          !sequencingWithheldIds.has(product.id),
      )
      .map(({ product }) => product.id),
  );
  const productById = new Map(routineProducts.map((product) => [product.id, product] as const));

  // The legacy template remains an insight/example signal only. Actual product
  // nights come exclusively from scheduler/orchestrate via useCycle.
  const hasActives = allowCadence && pm.some((step) => cycleProductIds.has(step.productId));
  const cycle = pickCycle({
    sensitivity: profile.sensitivity,
    goals: profile.goals as GoalId[],
    hasActives,
  });
  // Ramp: initialise for each exfoliating/retinoid active.
  const ramp = allowCadence
    ? pm
        .filter((step) => cycleProductIds.has(step.productId))
        .map((s) => ({
          productId: s.productId,
          name: s.name,
          state: initRamp(
            productById.get(s.productId)?.tags.includes('retinoid') ||
              productById.get(s.productId)?.category === 'retinoid_serum'
              ? 'retinoid'
              : 'aha',
            profile.sensitivity,
          ),
        }))
    : [];

  // Gaps: roles the user doesn't own that would round out the routine.
  const ownedRoles = new Set(
    classifiedProducts.flatMap(({ role }) => (role == null ? [] : [role])),
  );
  const gaps = allowSequencing
    ? (Object.keys(GAP_NOTES) as SequencingRole[])
        .filter((role) => !ownedRoles.has(role))
        .map((role) => GAP_NOTES[role]!)
    : [];

  // Conflicts: run the docs/02 engine (launch-gated rules) over the shelf.
  const conflicts = unresolvedConflicts(conflictEvaluation.conflicts, conflictChoices);

  return {
    am,
    pm,
    cycle,
    ramp,
    safetyExclusions,
    cadenceWithheld,
    sequencingWithheld,
    unplacedProducts,
    gaps,
    conflicts,
    conflictCoverageStatus: conflictEvaluation.status,
    unsupportedConflictPairs: conflictEvaluation.unsupportedPairs,
  };
}
