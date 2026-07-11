import type { GoalId, SequencingRole } from '@onskin/types';

import {
  detectConflicts,
  type DetectedConflict,
  type EngineProduct,
  type EngineProfile,
} from '@/features/intelligence/engine';
import { shippableRules, type ConflictRule } from '@/features/intelligence/rules';
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
  sequencePhase,
  type ClassifiableProduct,
  type SequencedStep,
} from './sequencing';

// The deterministic generation pipeline (docs/03 §2): classify → allocate AM/PM →
// sequence → assign frequency/cycling + init ramp → run detect_conflicts + apply
// resolutions → plan. Pure + explainable. Every step traces to a rule/profile.

export type PlanStep = SequencedStep & {
  /** Exfoliant→night 1, retinoid→night 2 when the cycle is active (docs/02 §5). */
  cyclingNight?: number;
};

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
  }));
  const unplacedProducts = classifiedProducts
    .filter(({ role }) => role == null)
    .map(({ product }) => ({ productId: product.id, name: product.name }));

  // Treatment/exfoliant placement implies a cadence. Until the clinical cadence
  // review gate opens, withhold those products instead of turning an unassigned
  // PM active into a daily Today step.
  const allowCadence = canUseRoutineCadence();
  const cadenceWithheld = allowCadence
    ? []
    : classifiedProducts
        .filter(({ role }) => role === 'treatment' || role === 'exfoliant')
        .map(({ product }) => ({ productId: product.id, name: product.name }));
  const cadenceWithheldIds = new Set(cadenceWithheld.map((item) => item.productId));
  const cadenceEligibleProducts = routineProducts.filter(
    (product) => !cadenceWithheldIds.has(product.id),
  );
  const am = sequencePhase(cadenceEligibleProducts, 'am');
  const pm = sequencePhase(cadenceEligibleProducts, 'pm') as PlanStep[];

  // Cycling: assign nights to PM actives (exfoliant=1, retinoid=2) when a cycle
  // applies. The retinoid × acid alternate_nights resolution is satisfied by
  // placing them on different nights.
  const hasActives =
    allowCadence && pm.some((s) => s.role === 'treatment' || s.role === 'exfoliant');
  const cycle = pickCycle({
    sensitivity: profile.sensitivity,
    goals: profile.goals as GoalId[],
    hasActives,
  });
  if (cycle) {
    for (const step of pm) {
      if (step.role === 'exfoliant') step.cyclingNight = 1;
      else if (step.role === 'treatment') step.cyclingNight = 2;
    }
  }

  // Ramp: initialise for each exfoliating/retinoid active.
  const ramp = allowCadence
    ? pm
        .filter((s) => s.role === 'treatment' || s.role === 'exfoliant')
        .map((s) => ({
          productId: s.productId,
          name: s.name,
          state: initRamp(s.role === 'treatment' ? 'retinoid' : 'aha', profile.sensitivity),
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
  const conflicts = detectConflicts(
    engineProducts,
    { ...profile, pregnancy: profile.pregnancy },
    rules,
  );

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
