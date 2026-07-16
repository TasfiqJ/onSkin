import { describe, expect, it } from 'vitest';

import type { GeneratedPlan, PlanStep } from '@/features/routine/generate';
import type { Cycle, NightSlot } from '@/features/scheduler/orchestrate';

import {
  projectTodayRoutine,
  todayRoutineStepKey,
  type TodayCycleSource,
} from './routineProjection';

const cleanser: PlanStep = {
  productId: 'cleanser',
  name: 'Cleanser',
  role: 'cleanser',
  cadence: 'stable',
  order: 10,
  instruction: 'Start with a clean base.',
};
const retinoid: PlanStep = {
  productId: 'retinoid',
  name: 'Retinoid',
  role: 'treatment',
  cadence: 'cycle',
  order: 40,
  instruction: 'Apply to dry skin.',
};
const moisturiser: PlanStep = {
  productId: 'moisturiser',
  name: 'Moisturiser',
  role: 'moisturiser',
  cadence: 'stable',
  order: 60,
  instruction: 'Seal everything in.',
};
const spf: PlanStep = {
  productId: 'spf',
  name: 'SPF',
  role: 'spf',
  cadence: 'stable',
  order: 100,
  instruction: 'Always the last morning step.',
};

function plan(overrides: Partial<GeneratedPlan> = {}): GeneratedPlan {
  return {
    am: [cleanser, spf],
    pm: [cleanser, retinoid, moisturiser],
    cycle: null,
    ramp: [],
    safetyExclusions: [],
    cadenceWithheld: [],
    unplacedProducts: [],
    gaps: [],
    conflicts: [],
    ...overrides,
  };
}

const retinoidNight: NightSlot = {
  index: 0,
  slot: 'retinoid',
  productId: 'retinoid',
  productName: 'Retinoid',
  className: 'retinoid',
};
const acidNight: NightSlot = {
  index: 1,
  slot: 'exfoliate',
  productId: 'acid',
  productName: 'Lactic acid',
  className: 'aha',
};
const recoveryNight: NightSlot = {
  index: 2,
  slot: 'recover',
  productId: null,
  productName: null,
  className: null,
};
const cycle: Cycle = {
  variant: 'classic',
  lengthNights: 3,
  nights: [retinoidNight, acidNight, recoveryNight],
  amDaily: [],
  notes: [],
};

function cycleSource(overrides: Partial<TodayCycleSource> = {}): TodayCycleSource {
  return {
    cycle,
    tonight: { index: 0, night: retinoidNight },
    weekAhead: [
      { dateISO: '2026-07-16', weekday: 'Thu', night: retinoidNight },
      { dateISO: '2026-07-17', weekday: 'Fri', night: acidNight },
    ],
    nextAcidNight: '2026-07-17',
    recovery: { active: false, day: 0, days: 0, reason: null },
    paused: false,
    skippedTonight: false,
    stagedActiveIds: [],
    conflictChoices: [],
    ...overrides,
  };
}

describe('projectTodayRoutine', () => {
  it('never publishes the design-only example plan, even with stale cycle data', () => {
    const projected = projectTodayRoutine({
      planData: { plan: plan(), isExample: true },
      cycleData: cycleSource(),
    });

    expect(projected.source).toBe('example');
    expect(projected.hasRealRoutine).toBe(false);
    expect(projected.am.steps).toEqual([]);
    expect(projected.pm.steps).toEqual([]);
    expect(projected.cycle).toBeNull();
    expect(projected.tonight).toBeNull();
  });

  it('projects phase-scoped keys, completion state, and the scheduled cycle step', () => {
    const projected = projectTodayRoutine({
      planData: { plan: plan(), isExample: false },
      cycleData: cycleSource(),
      completedStepKeys: new Set(['AM:cleanser', 'PM:cleanser']),
    });

    expect(projected.am.steps.map((step) => step.productId)).toEqual(['cleanser', 'spf']);
    expect(projected.am.completedCount).toBe(1);
    expect(projected.am.firstUndoneKey).toBe('AM:spf');
    expect(projected.pm.steps.map((step) => step.productId)).toEqual([
      'cleanser',
      'retinoid',
      'moisturiser',
    ]);
    expect(projected.pm.completedCount).toBe(1);
    expect(projected.pm.firstUndoneKey).toBe('PM:retinoid');
    expect(projected.pm.steps[1]).toMatchObject({
      cadence: 'cycle',
      instruction: 'Apply to dry skin · pea-sized · avoid the eye area.',
      order: 40,
      role: 'treatment',
    });
    expect(projected.cycleActive).toBe(true);
    expect(projected.nightNumber).toBe(1);
    expect(projected.nightTotal).toBe(3);
    expect(projected.cycleStripNights).toEqual([retinoidNight, acidNight]);
    expect(projected.suppressedAcidName).toBe('Lactic acid');
    expect(projected.nextAcidISO).toBe('2026-07-17');
    expect(todayRoutineStepKey('PM', 'retinoid')).toBe('PM:retinoid');
  });

  it.each([
    ['paused', { paused: true }],
    ['skipped', { skippedTonight: true }],
    ['recovery', { recovery: { active: true, day: 1, days: 3, reason: 'irritation' as const } }],
  ])('keeps only stable barrier steps when tonight is %s', (_label, overrides) => {
    const projected = projectTodayRoutine({
      planData: { plan: plan(), isExample: false },
      cycleData: cycleSource(overrides),
    });

    expect(projected.pm.steps.map((step) => step.productId)).toEqual(['cleanser', 'moisturiser']);
    expect(projected.cycleActive).toBe(false);
    expect(projected.suppressedAcidName).toBeNull();
  });

  it('does not publish an active withheld by phased introduction', () => {
    const projected = projectTodayRoutine({
      planData: { plan: plan(), isExample: false },
      cycleData: cycleSource({ stagedActiveIds: ['retinoid'] }),
    });

    expect(projected.pm.steps.map((step) => step.productId)).toEqual(['cleanser', 'moisturiser']);
    expect(projected.cycleActive).toBe(false);
    expect(projected.suppressedAcidName).toBeNull();
  });

  it('fails closed when the profile safety projection excludes tonight’s active', () => {
    const projected = projectTodayRoutine({
      planData: {
        plan: plan({
          safetyExclusions: [{ productId: 'retinoid', name: 'Retinoid', reason: 'retinoid' }],
        }),
        isExample: false,
      },
      cycleData: cycleSource(),
    });

    expect(projected.safetyExclusionCount).toBe(1);
    expect(projected.pm.steps.map((step) => step.productId)).toEqual(['cleanser', 'moisturiser']);
    expect(projected.cycleActive).toBe(false);
    expect(projected.suppressedAcidName).toBeNull();
  });

  it('uses stable PM steps on an orchestrated recovery slot', () => {
    const projected = projectTodayRoutine({
      planData: { plan: plan(), isExample: false },
      cycleData: cycleSource({ tonight: { index: 2, night: recoveryNight } }),
    });

    expect(projected.tonightSlot).toBe('recover');
    expect(projected.pm.steps.map((step) => step.productId)).toEqual(['cleanser', 'moisturiser']);
    expect(projected.cycleActive).toBe(false);
  });
});
