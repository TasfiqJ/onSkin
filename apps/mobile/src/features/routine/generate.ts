import type { GoalId, SequencingRole } from '@onskin/types';

import {
  detectConflicts,
  type DetectedConflict,
  type EngineProduct,
  type EngineProfile,
} from '@/features/intelligence/engine';
import { shippableRules, type ConflictRule } from '@/features/intelligence/rules';
import {
  unresolvedConflicts,
  type ConflictChoices,
} from '@/features/intelligence/conflictChoices';
import { pickCycle, type CycleTemplate } from '@/features/intelligence/scheduler';
import {
  pregnancySafetyReasonForProduct,
  type PregnancySafetyMode,
  type PregnancySafetyReason,
  type PregnancySafetyStatus,
} from '@/features/intelligence/pregnancySafety';

import { initRamp, type RampState } from './ramp';
import { canUseRoutineCadence } from './reviewGate';
import {
  classifyRole,
  routineCadenceDisposition,
  sequencePhase,
  type ClassifiableProduct,
  type SequencedStep,
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
  unplacedProducts: { productId: string; name: string }[];
  gaps: string[];
  conflicts: DetectedConflict[];
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
  rules: ConflictRule[] = shippableRules(),
  conflictChoices: ConflictChoices = {},
): GeneratedPlan {
  const pregnancySafety = profile.pregnancySafety ?? (profile.pregnancy ? 'caution' : 'clear');
  const safetyExclusions = products.flatMap((product) => {
    const reason = pregnancySafetyReasonForProduct(product, pregnancySafety, rules);
    return reason ? [{ productId: product.id, name: product.name, reason }] : [];
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
  const cadenceEligibleProducts = routineProducts.filter(
    (product) => !cadenceWithheldIds.has(product.id),
  );
  const am = sequencePhase(cadenceEligibleProducts, 'am');
  const pm = sequencePhase(cadenceEligibleProducts, 'pm') as PlanStep[];
  const cycleProductIds = new Set(
    classifiedProducts
      .filter(({ product, cadence }) => cadence === 'cycle' && !cadenceWithheldIds.has(product.id))
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
  const gaps = (Object.keys(GAP_NOTES) as SequencingRole[])
    .filter((role) => !ownedRoles.has(role))
    .map((role) => GAP_NOTES[role]!);

  // Conflicts: run the docs/02 engine (launch-gated rules) over the shelf.
  const engineProducts: EngineProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    tags: p.tags,
    concentration: p.concentration,
  }));
  const detectedConflicts = detectConflicts(
    engineProducts,
    { ...profile, pregnancy: profile.pregnancy },
    rules,
  );
  const conflicts = unresolvedConflicts(detectedConflicts, conflictChoices);

  return {
    am,
    pm,
    cycle,
    ramp,
    safetyExclusions,
    cadenceWithheld,
    unplacedProducts,
    gaps,
    conflicts,
  };
}
