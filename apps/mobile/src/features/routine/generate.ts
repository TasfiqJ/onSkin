import type { GoalId, SequencingRole } from '@onskin/types';

import {
  detectConflicts,
  type DetectedConflict,
  type EngineProduct,
  type EngineProfile,
} from '@/features/intelligence/engine';
import { shippableRules, type ConflictRule } from '@/features/intelligence/rules';
import { pickCycle, type CycleTemplate } from '@/features/intelligence/scheduler';

import { initRamp, type RampState } from './ramp';
import { canUseRoutineCadence } from './reviewGate';
import { classifyRole, sequencePhase, type ClassifiableProduct, type SequencedStep } from './sequencing';

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

export function generatePlan(
  products: RoutineProduct[],
  profile: EngineProfile & { goals: string[] },
  rules: ConflictRule[] = shippableRules(),
): GeneratedPlan {
  const am = sequencePhase(products, 'am');
  const pm = sequencePhase(products, 'pm') as PlanStep[];

  // Cycling: assign nights to PM actives (exfoliant=1, retinoid=2) when a cycle
  // applies. The retinoid × acid alternate_nights resolution is satisfied by
  // placing them on different nights.
  const allowCadence = canUseRoutineCadence();
  const hasActives = allowCadence && pm.some((s) => s.role === 'treatment' || s.role === 'exfoliant');
  const cycle = pickCycle({ sensitivity: profile.sensitivity, goals: profile.goals as GoalId[], hasActives });
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
  const ownedRoles = new Set(products.map(classifyRole));
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
  const conflicts = detectConflicts(engineProducts, profile, rules);

  return { am, pm, cycle, ramp, gaps, conflicts };
}
