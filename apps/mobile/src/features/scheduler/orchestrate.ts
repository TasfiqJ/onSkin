import type { CycleVariant, FunctionalTag, GoalId, IngredientSubflag } from '@onskin/types';

import {
  evaluateConflicts,
  type ConflictEvaluationStatus,
  type DetectedConflict,
  type SensitivityLevel,
} from '@/features/intelligence/engine';
import { conflictKey } from '@/features/intelligence/conflictIdentity';
import {
  choiceForConflict,
  type ConflictChoices,
  type ConflictUserChoice,
} from '@/features/intelligence/conflictChoices';
import {
  type PregnancySafetyMode,
  type PregnancySafetyStatus,
} from '@/features/intelligence/pregnancySafety';
import type { ConflictRule } from '@/features/intelligence/rules';
import {
  shippableRoutineCadencePolicy,
  shippableRoutineGuidanceCopy,
} from '@/features/routine/sequencing';

import {
  classifyActiveClass,
  defaultPhase,
  isPotent,
  reviewedFrequencyCap,
  type ActiveClass,
} from './classes';
import { minimumCycleLengthForOccurrences } from './cadence';
import type { CycleEditorActive } from './customCycle';

// Multi-active orchestration (docs/05 §4). The moat. Turns a cabinet of actives
// into one barrier-safe weekly cycle: one potent active per night, retinoid and
// exfoliant NEVER on the same night (enforced by construction), class frequency
// caps, recovery nights between pushes, vitamin C kept in the AM off the cycle,
// pregnancy → retinoid suppressed. Deterministic + pure + testable. Not AI.

export type SchedulerSlot = 'exfoliate' | 'retinoid' | 'recover' | 'other_active';

export type NightReconciliationReason =
  | 'authored_recovery'
  | 'missing'
  | 'safety'
  | 'staged'
  | 'cadence_cap';

export type NightSlot = {
  index: number; // 0-based
  slot: SchedulerSlot;
  productId: string | null;
  productName: string | null;
  className: ActiveClass | null;
  /** Present for Custom cycles so every applied or withheld night is explainable. */
  authoredProductId?: string | null;
  reconciliationReason?: NightReconciliationReason | null;
};

export type AmItem = { productId: string; name: string; className: ActiveClass };

export type Cycle = {
  variant: CycleVariant;
  lengthNights: number;
  nights: NightSlot[];
  amDaily: AmItem[]; // vitamin C, niacinamide, BP. The stable morning block (SPF appended at render)
  notes: string[]; // phased-intro / suppression / fallback notes
};

/** Orchestration result. `notes` travel even when no cycle forms, so a safety
 *  message (e.g. pregnancy retinoid suppression) always reaches the user even if
 *  the suppressed retinoid was the only potent active (review finding). */
export type ScheduledConflictChoice = {
  key: string;
  choice: ConflictUserChoice;
  productIds: [string, string];
  resolutionType: ConflictRule['resolutionType'];
};

export type OrchestrationResult = {
  cycle: Cycle | null;
  amDaily: AmItem[];
  cycleActives: CycleEditorActive[];
  notes: string[];
  conflictChoices: ScheduledConflictChoice[];
  conflictCoverageStatus: ConflictEvaluationStatus;
  unsupportedConflictPairs: string[];
};

export type SchedulerActive = {
  id: string;
  name: string;
  tags: FunctionalTag[];
  subflags?: IngredientSubflag[];
  category?: string | null;
  concentration?: 'low' | 'high';
  /** Recently added → staged for phased introduction (docs/05 §4). */
  isNew?: boolean;
};

export type SchedulerProfile = {
  sensitivity: SensitivityLevel;
  pregnancy: boolean;
  pregnancySafety?: PregnancySafetyMode;
  pregnancyStatus?: PregnancySafetyStatus;
  goals: GoalId[];
  /** User-chosen variant override; null = auto-pick by profile. */
  preferredVariant?: CycleVariant | null;
  /** Per-product ramp frequency (docs/03 active_ramp) keyed by product id. */
  freqByProductId?: Record<string, number>;
  /** Version-matched local choices. They suppress repeat prompts and flow into
   * schedule explanations, but cannot bypass safety or unreviewed cadence. */
  conflictChoices?: ConflictChoices;
};

/** Auto-pick a variant from the profile (mirrors the docs/02 §5 personalisation). */
export function pickVariant(profile: SchedulerProfile): CycleVariant {
  if (profile.sensitivity === 'sensitive' || profile.goals.includes('barrier_repair'))
    return 'gentle';
  if (profile.sensitivity === 'resistant') return 'advanced';
  return 'classic';
}

const SLOT_FOR_CLASS: Partial<Record<ActiveClass, SchedulerSlot>> = {
  aha: 'exfoliate',
  bha: 'exfoliate',
  retinoid: 'retinoid',
};

function slotForClass(cls: ActiveClass): SchedulerSlot {
  return SLOT_FOR_CLASS[cls] ?? 'other_active';
}

function needsRecoveryBetween(a: Classified, b: Classified): boolean {
  return a.id === b.id || slotForClass(a.cls) === slotForClass(b.cls);
}

function weeklyFrequencyFor(active: Classified, profile: SchedulerProfile): number {
  const cap = reviewedFrequencyCap(active.cls, profile.sensitivity);
  if (cap === null) return 0;
  const storedRamp = profile.freqByProductId?.[active.id];
  const requested =
    typeof storedRamp === 'number' && Number.isFinite(storedRamp) ? Math.floor(storedRamp) : cap;
  return Math.max(1, Math.min(requested, cap));
}

type Classified = { id: string; name: string; cls: ActiveClass; isNew: boolean };
type Push = { active: Classified };

/** Round-robin the potent pushes so the same active is never back-to-back and
 *  exfoliants/retinoid interleave (exfoliants ordered before retinoid). */
function buildPushes(potent: { active: Classified; freq: number }[]): Push[] {
  const order: ActiveClass[] = ['aha', 'bha', 'retinoid'];
  const queues = potent
    .map((p) => ({ active: p.active, remaining: p.freq }))
    .sort(
      (a, b) =>
        order.indexOf(a.active.cls) - order.indexOf(b.active.cls) ||
        a.active.id.localeCompare(b.active.id),
    );
  const out: Push[] = [];
  let any = true;
  while (any) {
    any = false;
    for (const q of queues) {
      if (q.remaining > 0) {
        out.push({ active: q.active });
        q.remaining -= 1;
        any = true;
      }
    }
  }
  return out;
}

function recoveryNight(index: number): NightSlot {
  return { index, slot: 'recover', productId: null, productName: null, className: null };
}

function scheduledConflictChoices(
  detected: readonly DetectedConflict[],
  choices: ConflictChoices,
): ScheduledConflictChoice[] {
  if (Object.keys(choices).length === 0) return [];

  return detected.flatMap((conflict) => {
    const choice = choiceForConflict(choices, conflict);
    if (
      !choice ||
      conflict.rule.interactionType === 'safety' ||
      !conflict.productAId ||
      !conflict.productBId
    ) {
      return [];
    }
    return [
      {
        key: conflictKey(conflict),
        choice,
        productIds: [conflict.productAId, conflict.productBId].sort() as [string, string],
        resolutionType: conflict.rule.resolutionType,
      },
    ];
  });
}

/**
 * Orchestrate the user's actives into a cycle. `cycle` is null when there are no
 * potent night-cycled actives (→ a simple daily AM/PM routine. Docs/02 §5 /
 * docs/05 caveats), but `notes` always carry any safety/phased messages.
 */
export function orchestrate(
  actives: SchedulerActive[],
  profile: SchedulerProfile,
): OrchestrationResult {
  const reproductiveStatus = profile.pregnancyStatus ?? (profile.pregnancy ? 'pregnant' : 'none');
  const engineProducts = actives.map((active) => ({
    id: active.id,
    name: active.name,
    tags: active.tags,
    subflags: active.subflags,
    concentration: active.concentration,
  }));
  const conflictEvaluation = evaluateConflicts(engineProducts, {
    sensitivity: profile.sensitivity,
    reproductiveStatus,
  });
  const safetyConflicts = conflictEvaluation.conflicts.filter(
    (conflict) => conflict.rule.interactionType === 'safety',
  );
  const excludedIds = new Set(
    safetyConflicts.flatMap((conflict) =>
      [conflict.productAId, conflict.productBId].filter(
        (id): id is string => typeof id === 'string',
      ),
    ),
  );
  const eligibleActives = actives.filter((active) => !excludedIds.has(active.id));
  const eligibleIds = new Set(eligibleActives.map((active) => active.id));
  const conflictChoices = scheduledConflictChoices(
    conflictEvaluation.conflicts.filter(
      (conflict) =>
        (!conflict.productAId || eligibleIds.has(conflict.productAId)) &&
        (!conflict.productBId || eligibleIds.has(conflict.productBId)),
    ),
    profile.conflictChoices ?? {},
  );
  const allClassified: Classified[] = actives.map((a) => ({
    id: a.id,
    name: a.name,
    cls: classifyActiveClass(a.tags, a.category),
    isNew: !!a.isNew,
  }));
  const classified = allClassified.filter((active) => !excludedIds.has(active.id));

  const notes: string[] = [];

  if (
    conflictEvaluation.status === 'unsupported_unreviewed' &&
    conflictEvaluation.unsupportedPairs.length > 0
  ) {
    notes.push(
      'Interaction checking requires completed independent professional review for some product pairs; no compatibility result is shown.',
    );
  }

  if (safetyConflicts.length > 0) {
    notes.push(...new Set(safetyConflicts.map((conflict) => conflict.rule.copy.resolution)));
  }

  const cadencePolicy = shippableRoutineCadencePolicy();
  const guidanceCopy = shippableRoutineGuidanceCopy();
  if (!cadencePolicy || !guidanceCopy) {
    return {
      cycle: null,
      amDaily: [],
      cycleActives: [],
      notes,
      conflictChoices,
      conflictCoverageStatus: conflictEvaluation.status,
      unsupportedConflictPairs: conflictEvaluation.unsupportedPairs,
    };
  }

  // AM / daily block (stable morning): vitamin C, BP, flexible niacinamide.
  const amDaily: AmItem[] = classified
    .filter(
      (c) =>
        defaultPhase(c.cls) === 'am' ||
        (c.cls === 'niacinamide' && defaultPhase(c.cls) === 'flexible'),
    )
    .map((c) => ({ productId: c.id, name: c.name, className: c.cls }));

  // Potent night-cycled actives.
  let potent = classified.filter((c) => isPotent(c.cls));

  // Phased introduction: a brand-new active is staged in next, not switched on now.
  const staged = potent.filter((c) => c.isNew);
  const stagedIds = new Set<string>();
  if (staged.length && potent.length > staged.length) {
    for (const active of staged) stagedIds.add(active.id);
    potent = potent.filter((c) => !c.isNew);
    notes.push(
      guidanceCopy.phasedIntroductionNoteTemplate.replace(
        '{productNames}',
        staged.map((s) => s.name).join(' and '),
      ),
    );
  }

  const cycleActives: CycleEditorActive[] = allClassified
    .filter((active) => isPotent(active.cls))
    .map((active) => {
      return {
        id: active.id,
        name: active.name,
        className: active.cls as CycleEditorActive['className'],
        eligible: !excludedIds.has(active.id),
        staged: stagedIds.has(active.id),
        maxFrequencyPerWeek: weeklyFrequencyFor(active, profile),
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));

  if (potent.length === 0) {
    return {
      cycle: null,
      amDaily,
      cycleActives,
      notes,
      conflictChoices,
      conflictCoverageStatus: conflictEvaluation.status,
      unsupportedConflictPairs: conflictEvaluation.unsupportedPairs,
    };
  }

  const variant = profile.preferredVariant ?? pickVariant(profile);

  // Each potent active gets min(ramp frequency, class cap) nights. The cap is
  // launch-gated (B-DERM-REVIEW): conservative in production until sign-off.
  const withFreq = potent.map((active) => ({ active, freq: weeklyFrequencyFor(active, profile) }));

  const pushes = buildPushes(withFreq);
  const rec = cadencePolicy.cycleRecoveryNights[variant];

  const nights: NightSlot[] = [];
  pushes.forEach((p, i) => {
    nights.push({
      index: nights.length,
      slot: slotForClass(p.active.cls),
      productId: p.active.id,
      productName: p.active.name,
      className: p.active.cls,
    });
    const isLast = i === pushes.length - 1;
    const nextPush = pushes[i + 1];
    const repeatPotentSlot = nextPush ? needsRecoveryBetween(p.active, nextPush.active) : false;
    const gaps = isLast
      ? rec.trailing
      : Math.max(
          rec.betweenPushes,
          repeatPotentSlot ? cadencePolicy.minimumBetweenRepeatedPotentSlotNights : 0,
        );
    for (let g = 0; g < gaps; g++) nights.push(recoveryNight(nights.length));
  });
  // Guarantee at least one recovery night so the barrier always gets rest.
  while (
    nights.filter((night) => night.slot === 'recover').length <
    cadencePolicy.minimumRecoveryNightsPerCycle
  ) {
    nights.push(recoveryNight(nights.length));
  }

  // `freq` is a weekly ceiling, not a raw per-cycle count. Short generated
  // cycles are padded until their repeated projection obeys the same
  // length-aware budget as authored Custom cycles.
  const cadenceLength = withFreq.reduce((required, item) => {
    const minimum = minimumCycleLengthForOccurrences(item.freq, item.freq, {
      minLength: 1,
      maxLength: 14,
    });
    return Math.max(required, minimum ?? required);
  }, 1);
  while (nights.length < cadenceLength) nights.push(recoveryNight(nights.length));

  return {
    cycle: { variant, lengthNights: nights.length, nights, amDaily, notes },
    amDaily,
    cycleActives,
    notes,
    conflictChoices,
    conflictCoverageStatus: conflictEvaluation.status,
    unsupportedConflictPairs: conflictEvaluation.unsupportedPairs,
  };
}
