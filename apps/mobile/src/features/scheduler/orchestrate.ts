import type { CycleVariant, FunctionalTag, GoalId, IngredientSubflag } from '@onskin/types';

import { detectConflicts, type SensitivityLevel } from '@/features/intelligence/engine';
import { conflictKey } from '@/features/intelligence/conflictIdentity';
import {
  choiceForConflict,
  type ConflictChoices,
  type ConflictUserChoice,
} from '@/features/intelligence/conflictChoices';
import {
  pregnancySafetyReasonForProduct,
  type PregnancySafetyMode,
  type PregnancySafetyStatus,
} from '@/features/intelligence/pregnancySafety';
import { shippableRules, type ConflictRule } from '@/features/intelligence/rules';
import { canUseRoutineCadence } from '@/features/routine/reviewGate';

import {
  classifyActiveClass,
  defaultPhase,
  isPotent,
  reviewedFrequencyCap,
  type ActiveClass,
} from './classes';

// Multi-active orchestration (docs/05 §4). The moat. Turns a cabinet of actives
// into one barrier-safe weekly cycle: one potent active per night, retinoid and
// exfoliant NEVER on the same night (enforced by construction), class frequency
// caps, recovery nights between pushes, vitamin C kept in the AM off the cycle,
// pregnancy → retinoid suppressed. Deterministic + pure + testable. Not AI.

export type SchedulerSlot = 'exfoliate' | 'retinoid' | 'recover' | 'other_active';

export type NightSlot = {
  index: number; // 0-based
  slot: SchedulerSlot;
  productId: string | null;
  productName: string | null;
  className: ActiveClass | null;
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
  notes: string[];
  conflictChoices: ScheduledConflictChoice[];
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

// Recovery density per variant: nights inserted between pushes + trailing.
const RECOVERY: Record<CycleVariant, { between: number; trailing: number }> = {
  classic: { between: 0, trailing: 2 }, // the Bowe 4-night rhythm
  gentle: { between: 1, trailing: 1 }, // more rest, for sensitive / barrier-repair
  advanced: { between: 0, trailing: 1 }, // tighter, for resistant skin
  custom: { between: 1, trailing: 1 },
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
  actives: readonly SchedulerActive[],
  profile: SchedulerProfile,
  rules: ConflictRule[],
): ScheduledConflictChoice[] {
  const choices = profile.conflictChoices ?? {};
  if (Object.keys(choices).length === 0) return [];

  const detected = detectConflicts(
    actives.map((active) => ({
      id: active.id,
      name: active.name,
      tags: active.tags,
      subflags: active.subflags,
      concentration: active.concentration,
    })),
    { sensitivity: profile.sensitivity, pregnancy: profile.pregnancy },
    rules,
  );

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
  rules: ConflictRule[] = shippableRules(),
): OrchestrationResult {
  const pregnancySafety = profile.pregnancySafety ?? (profile.pregnancy ? 'caution' : 'clear');
  const safetyExclusions = actives.flatMap((active) => {
    const reason = pregnancySafetyReasonForProduct(active, pregnancySafety, rules);
    return reason ? [{ active, reason }] : [];
  });
  const excludedIds = new Set(safetyExclusions.map(({ active }) => active.id));
  const eligibleActives = actives.filter((active) => !excludedIds.has(active.id));
  const conflictChoices = scheduledConflictChoices(eligibleActives, profile, rules);
  const classified: Classified[] = actives
    .filter((active) => !excludedIds.has(active.id))
    .map((a) => ({
      id: a.id,
      name: a.name,
      cls: classifyActiveClass(a.tags, a.category),
      isNew: !!a.isNew,
    }));

  const notes: string[] = [];

  if (safetyExclusions.length > 0) {
    const knownStatus =
      profile.pregnancyStatus === 'pregnant' || profile.pregnancyStatus === 'breastfeeding';
    notes.push(
      knownStatus || (profile.pregnancy && profile.pregnancyStatus == null)
        ? 'Products with pregnancy cautions are paused. Worth a word with your doctor.'
        : 'Products with pregnancy cautions stay paused until you confirm this safety setting.',
    );
  }

  if (!canUseRoutineCadence()) return { cycle: null, notes, conflictChoices };

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
  if (staged.length && potent.length > staged.length) {
    potent = potent.filter((c) => !c.isNew);
    notes.push(
      `We'll add your ${staged.map((s) => s.name).join(' and ')} next week, once your routine settles.`,
    );
  }

  if (potent.length === 0) return { cycle: null, notes, conflictChoices };

  const variant = profile.preferredVariant ?? pickVariant(profile);

  // Each potent active gets min(ramp frequency, class cap) nights. The cap is
  // launch-gated (B-DERM-REVIEW): conservative in production until sign-off.
  const withFreq = potent.map((active) => {
    const cap = reviewedFrequencyCap(active.cls, profile.sensitivity);
    const ramp = profile.freqByProductId?.[active.id];
    const freq = Math.max(1, Math.min(ramp ?? cap, cap));
    return { active, freq };
  });

  const pushes = buildPushes(withFreq);
  const rec = RECOVERY[variant];

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
    const gaps = isLast ? rec.trailing : Math.max(rec.between, repeatPotentSlot ? 1 : 0);
    for (let g = 0; g < gaps; g++) nights.push(recoveryNight(nights.length));
  });
  // Guarantee at least one recovery night so the barrier always gets rest.
  if (!nights.some((n) => n.slot === 'recover')) nights.push(recoveryNight(nights.length));

  return {
    cycle: { variant, lengthNights: nights.length, nights, amDaily, notes },
    notes,
    conflictChoices,
  };
}
