import type { FunctionalTag } from '@onskin/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { STARTER_RULES, shippableRules } from '@/features/intelligence/rules';
import { ROUTINE_CADENCE_REVIEWED } from '@/features/routine/reviewGate';

import { CAPS_REVIEWED, frequencyCap, reviewedFrequencyCap } from './classes';
import {
  orchestrate,
  type Cycle,
  type SchedulerActive,
  type SchedulerProfile,
} from './orchestrate';

// Multi-active orchestration fixtures (docs/05 §4). The doc mandates the rules be
// testable on this harm-relevant surface; these assert the FIRM invariants
// (one potent active per night; retinoid and exfoliant NEVER share a night;
// frequency caps; recovery present; pregnancy suppression; vitamin C in the AM).

function active(id: string, name: string, tags: FunctionalTag[], isNew = false): SchedulerActive {
  return { id, name, tags, isNew };
}
const base: SchedulerProfile = { sensitivity: 'neutral', pregnancy: false, goals: [] };
const run = (actives: SchedulerActive[], profile: SchedulerProfile = base) =>
  orchestrate(actives, profile);

const runtime = globalThis as { __DEV__?: boolean };
let previousDev: boolean | undefined;

beforeEach(() => {
  previousDev = runtime.__DEV__;
  runtime.__DEV__ = true;
});

afterEach(() => {
  if (previousDev === undefined) delete runtime.__DEV__;
  else runtime.__DEV__ = previousDev;
});

function withDevFlag<T>(value: boolean, fn: () => T): T {
  const before = runtime.__DEV__;
  runtime.__DEV__ = value;
  try {
    return fn();
  } finally {
    if (before === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = before;
  }
}

function potentNights(cycle: Cycle) {
  return cycle.nights.filter((n) => n.slot === 'retinoid' || n.slot === 'exfoliate');
}

function expectNoAdjacentRepeatedPotentSlot(cycle: Cycle) {
  for (let i = 0; i < cycle.nights.length; i += 1) {
    const current = cycle.nights[i]!;
    const next = cycle.nights[(i + 1) % cycle.nights.length]!;
    if (current.slot === 'recover' || next.slot === 'recover') continue;

    expect(current.productId).not.toBe(next.productId);
    expect(current.slot).not.toBe(next.slot);
  }
}

describe('orchestration. FIRM invariants (docs/05 §4)', () => {
  const cabinet = [
    active('r', 'Retinol 0.3%', ['retinoid']),
    active('g', 'Glycolic 7%', ['aha']),
    active('s', 'Salicylic 2%', ['bha']),
    active('c', 'Vitamin C 15%', ['vitamin_c']),
    active('n', 'Niacinamide 10%', ['niacinamide']),
  ];

  it('one potent active per night. No night holds two potent actives', () => {
    const { cycle } = run(cabinet);
    expect(cycle).not.toBeNull();
    for (const night of cycle!.nights) {
      if (night.slot === 'recover') expect(night.productId).toBeNull();
      else expect(night.productId).not.toBeNull();
    }
  });

  it('NEVER schedules a retinoid and an exfoliant on the same night (harm-relevant)', () => {
    const { cycle } = run(cabinet);
    const retinoidNights = new Set(
      cycle!.nights.filter((n) => n.slot === 'retinoid').map((n) => n.index),
    );
    const exfoliateNights = new Set(
      cycle!.nights.filter((n) => n.slot === 'exfoliate').map((n) => n.index),
    );
    for (const i of retinoidNights) expect(exfoliateNights.has(i)).toBe(false);
  });

  it('schedules a ramped active on its ramp frequency (freq = min(ramp, cap)), not the full cap', () => {
    // Regression: the ramp's freq_per_week must reach the scheduler (docs/05 §2/§4).
    // Previously freqByProductId was read by orchestrate but never populated, so
    // every active defaulted to the class cap regardless of the user's ramp.
    const r = active('r', 'Retinol 0.3%', ['retinoid']);
    const cap = reviewedFrequencyCap('retinoid', base.sensitivity);
    const rampFreq = Math.max(1, cap - 1); // strictly below the cap when cap > 1

    const { cycle: ramped } = orchestrate([r], { ...base, freqByProductId: { r: rampFreq } });
    const rampedNights = ramped!.nights.filter((n) => n.slot === 'retinoid').length;
    expect(rampedNights).toBe(rampFreq);

    const { cycle: capped } = orchestrate([r], base); // no ramp → full cap
    expect(capped!.nights.filter((n) => n.slot === 'retinoid').length).toBe(cap);

    if (cap > 1) expect(rampedNights).toBeLessThan(cap);
  });

  it('never exceeds the cap even when the ramp frequency is higher', () => {
    const r = active('r', 'Retinol 0.3%', ['retinoid']);
    const cap = reviewedFrequencyCap('retinoid', base.sensitivity);
    const { cycle } = orchestrate([r], { ...base, freqByProductId: { r: cap + 5 } });
    expect(cycle!.nights.filter((n) => n.slot === 'retinoid').length).toBe(cap);
  });

  it('keeps vitamin C + niacinamide in the AM, off the night cycle', () => {
    const { cycle } = run(cabinet);
    const amClasses = cycle!.amDaily.map((a) => a.className);
    expect(amClasses).toContain('vitamin_c');
    expect(amClasses).toContain('niacinamide');
    expect(
      cycle!.nights.every((n) => n.className !== 'vitamin_c' && n.className !== 'niacinamide'),
    ).toBe(true);
  });

  it('always includes at least one recovery night for barrier rest', () => {
    const { cycle } = run(cabinet);
    expect(cycle!.nights.some((n) => n.slot === 'recover')).toBe(true);
  });

  it('spaces repeated retinoid nights with recovery, even in the classic variant', () => {
    const { cycle } = orchestrate([active('r', 'Retinol 0.3%', ['retinoid'])], {
      ...base,
      freqByProductId: { r: 2 },
      preferredVariant: 'classic',
    });

    expect(cycle!.nights.slice(0, 4).map((n) => n.slot)).toEqual([
      'retinoid',
      'recover',
      'retinoid',
      'recover',
    ]);
    expectNoAdjacentRepeatedPotentSlot(cycle!);
  });

  it('spaces repeated exfoliant-slot nights with recovery instead of stacking acids', () => {
    const { cycle } = orchestrate(
      [active('g', 'Glycolic 7%', ['aha']), active('s', 'Salicylic 2%', ['bha'])],
      { ...base, freqByProductId: { g: 1, s: 1 }, preferredVariant: 'classic' },
    );

    expect(cycle!.nights.slice(0, 3).map((n) => n.slot)).toEqual([
      'exfoliate',
      'recover',
      'exfoliate',
    ]);
    expectNoAdjacentRepeatedPotentSlot(cycle!);
  });
});

describe('orchestration. Frequency caps + launch gate (docs/05 §4/§8)', () => {
  it('the cap table is the documented consensus, but the defaults are launch-gated', () => {
    expect(frequencyCap('aha', 'sensitive')).toBe(1);
    expect(frequencyCap('bha', 'resistant')).toBe(7);
    // B-DERM-REVIEW: the per-type numbers are not authoritative until sign-off.
    expect(CAPS_REVIEWED).toBe(false);
    expect(ROUTINE_CADENCE_REVIEWED).toBe(false);
  });

  it('withholds unreviewed cycle cadence in production until B-DERM-REVIEW closes', () => {
    withDevFlag(false, () => {
      const { cycle, notes } = run([
        active('r', 'Retinol 0.3%', ['retinoid']),
        active('g', 'Glycolic 7%', ['aha']),
      ]);

      expect(cycle).toBeNull();
      expect(notes).toEqual([]);
    });
  });

  it('caps AHA at 1×/week for sensitive skin', () => {
    const { cycle } = run(
      [active('g', 'Glycolic', ['aha']), active('r', 'Retinol', ['retinoid'])],
      {
        ...base,
        sensitivity: 'sensitive',
      },
    );
    expect(cycle!.nights.filter((n) => n.productId === 'g').length).toBe(1);
  });

  it('sensitive → gentle variant, resistant → advanced (auto)', () => {
    const a = [active('r', 'Retinol', ['retinoid'])];
    expect(run(a, { ...base, sensitivity: 'sensitive' }).cycle!.variant).toBe('gentle');
    expect(run(a, { ...base, sensitivity: 'resistant' }).cycle!.variant).toBe('advanced');
    expect(run(a, { ...base, sensitivity: 'neutral' }).cycle!.variant).toBe('classic');
  });

  it('honours a user variant override', () => {
    expect(
      run([active('r', 'Retinol', ['retinoid'])], { ...base, preferredVariant: 'classic' }).cycle!
        .variant,
    ).toBe('classic');
  });
});

describe('orchestration. Maya (the spec example) + the complex cabinet', () => {
  it('Maya: retinoid + glycolic, gentle. Both appear, alternated, with recovery', () => {
    const { cycle } = run(
      [active('r', 'Retinol 0.3%', ['retinoid']), active('g', 'Glycolic 7%', ['aha'])],
      { ...base, sensitivity: 'sensitive', goals: ['barrier_repair'] },
    );
    expect(cycle!.variant).toBe('gentle');
    expect(cycle!.nights.some((n) => n.slot === 'retinoid')).toBe(true);
    expect(cycle!.nights.some((n) => n.slot === 'exfoliate')).toBe(true);
    expect(cycle!.nights.some((n) => n.slot === 'recover')).toBe(true);
  });

  it('complex cabinet: six actives become one barrier-safe week', () => {
    const { cycle } = run([
      active('r', 'Retinol', ['retinoid']),
      active('g', 'Glycolic', ['aha']),
      active('s', 'Salicylic', ['bha']),
      active('c', 'Vitamin C', ['vitamin_c']),
      active('n', 'Niacinamide', ['niacinamide']),
      active('bp', 'Benzoyl peroxide', ['benzoyl_peroxide']),
    ]);
    const slots = new Set(potentNights(cycle!).map((n) => n.className));
    expect(slots.has('retinoid')).toBe(true);
    expect(slots.has('aha')).toBe(true);
    expect(slots.has('bha')).toBe(true);
    expect(cycle!.amDaily.some((a) => a.className === 'benzoyl_peroxide')).toBe(true);
  });
});

describe('orchestration. Safety + fallback', () => {
  const reviewedSafetyRules = STARTER_RULES.filter((rule) => rule.interactionType === 'safety').map(
    (rule) => ({ ...rule, reviewedBy: 'B-DERM-REVIEW' }),
  );

  it('pregnancy suppresses the retinoid and routes to the safety note', () => {
    const { cycle, notes } = run(
      [active('r', 'Retinol', ['retinoid']), active('g', 'Glycolic', ['aha'])],
      { ...base, pregnancy: true },
    );
    expect(cycle!.nights.some((n) => n.slot === 'retinoid')).toBe(false);
    expect(notes.join(' ')).toMatch(/pregnan|doctor/i);
    expect(notes.join(' ')).not.toMatch(/danger|warning|!/i);
  });

  it('pregnancy note survives even when the retinoid was the ONLY potent active', () => {
    const { cycle, notes } = run([active('r', 'Retinol', ['retinoid'])], {
      ...base,
      pregnancy: true,
    });
    expect(cycle).toBeNull(); // no cycle (nothing left to cycle)
    expect(notes.join(' ')).toMatch(/pregnan|doctor/i); // ...but the safety message still reaches the user
  });

  it('applies safety exclusions before the closed production cadence gate', () => {
    withDevFlag(false, () => {
      const { cycle, notes } = orchestrate(
        [active('r', 'Retinol', ['retinoid'])],
        {
          ...base,
          pregnancy: true,
          pregnancySafety: 'caution',
          pregnancyStatus: 'pregnant',
        },
        shippableRules(reviewedSafetyRules),
      );

      expect(cycle).toBeNull();
      expect(notes.join(' ')).toMatch(/pregnan|doctor/i);
    });
  });

  it('does not surface unreviewed safety guidance in production', () => {
    withDevFlag(false, () => {
      const { cycle, notes } = run([active('r', 'Retinol', ['retinoid'])], {
        ...base,
        pregnancy: true,
        pregnancySafety: 'caution',
        pregnancyStatus: 'pregnant',
      });

      expect(cycle).toBeNull();
      expect(notes).toEqual([]);
    });
  });

  it('keeps unknown and prefer-not status cautious without asserting pregnancy', () => {
    for (const pregnancyStatus of ['unknown', 'prefer_not'] as const) {
      const { cycle, notes } = run(
        [
          active('r', 'Retinol', ['retinoid']),
          { ...active('s', 'Salicylic serum', ['bha']), concentration: undefined },
        ],
        {
          ...base,
          pregnancySafety: 'caution',
          pregnancyStatus,
        },
      );

      expect(cycle).toBeNull();
      expect(notes.join(' ')).toMatch(/confirm this safety setting/i);
      expect(notes.join(' ')).not.toMatch(/you(?:'re| are) pregnant/i);
    }
  });

  it('keeps confirmed-low BHA eligible on the cautious branch', () => {
    const { cycle } = run([{ ...active('s', 'Salicylic 0.5%', ['bha']), concentration: 'low' }], {
      ...base,
      pregnancySafety: 'caution',
      pregnancyStatus: 'prefer_not',
    });

    expect(cycle?.nights.some((night) => night.productId === 's')).toBe(true);
  });

  it('no potent actives → no cycle (a simple daily routine)', () => {
    expect(run([active('n', 'Niacinamide', ['niacinamide'])]).cycle).toBeNull();
    expect(run([]).cycle).toBeNull();
  });
});
