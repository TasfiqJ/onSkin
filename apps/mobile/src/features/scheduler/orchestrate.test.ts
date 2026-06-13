import type { FunctionalTag } from '@onskin/types';
import { describe, expect, it } from 'vitest';

import { CAPS_REVIEWED, frequencyCap } from './classes';
import { orchestrate, type Cycle, type SchedulerActive, type SchedulerProfile } from './orchestrate';

// Multi-active orchestration fixtures (docs/05 §4). The doc mandates the rules be
// testable on this harm-relevant surface; these assert the FIRM invariants
// (one potent active per night; retinoid and exfoliant NEVER share a night;
// frequency caps; recovery present; pregnancy suppression; vitamin C in the AM).

function active(id: string, name: string, tags: FunctionalTag[], isNew = false): SchedulerActive {
  return { id, name, tags, isNew };
}
const base: SchedulerProfile = { sensitivity: 'neutral', pregnancy: false, goals: [] };
const run = (actives: SchedulerActive[], profile: SchedulerProfile = base) => orchestrate(actives, profile);

function potentNights(cycle: Cycle) {
  return cycle.nights.filter((n) => n.slot === 'retinoid' || n.slot === 'exfoliate');
}

describe('orchestration — FIRM invariants (docs/05 §4)', () => {
  const cabinet = [
    active('r', 'Retinol 0.3%', ['retinoid']),
    active('g', 'Glycolic 7%', ['aha']),
    active('s', 'Salicylic 2%', ['bha']),
    active('c', 'Vitamin C 15%', ['vitamin_c']),
    active('n', 'Niacinamide 10%', ['niacinamide']),
  ];

  it('one potent active per night — no night holds two potent actives', () => {
    const { cycle } = run(cabinet);
    expect(cycle).not.toBeNull();
    for (const night of cycle!.nights) {
      if (night.slot === 'recover') expect(night.productId).toBeNull();
      else expect(night.productId).not.toBeNull();
    }
  });

  it('NEVER schedules a retinoid and an exfoliant on the same night (harm-relevant)', () => {
    const { cycle } = run(cabinet);
    const retinoidNights = new Set(cycle!.nights.filter((n) => n.slot === 'retinoid').map((n) => n.index));
    const exfoliateNights = new Set(cycle!.nights.filter((n) => n.slot === 'exfoliate').map((n) => n.index));
    for (const i of retinoidNights) expect(exfoliateNights.has(i)).toBe(false);
  });

  it('keeps vitamin C + niacinamide in the AM, off the night cycle', () => {
    const { cycle } = run(cabinet);
    const amClasses = cycle!.amDaily.map((a) => a.className);
    expect(amClasses).toContain('vitamin_c');
    expect(amClasses).toContain('niacinamide');
    expect(cycle!.nights.every((n) => n.className !== 'vitamin_c' && n.className !== 'niacinamide')).toBe(true);
  });

  it('always includes at least one recovery night for barrier rest', () => {
    const { cycle } = run(cabinet);
    expect(cycle!.nights.some((n) => n.slot === 'recover')).toBe(true);
  });
});

describe('orchestration — frequency caps + launch gate (docs/05 §4/§8)', () => {
  it('the cap table is the documented consensus, but the defaults are launch-gated', () => {
    expect(frequencyCap('aha', 'sensitive')).toBe(1);
    expect(frequencyCap('bha', 'resistant')).toBe(7);
    // B-DERM-REVIEW: the per-type numbers are not authoritative until sign-off.
    expect(CAPS_REVIEWED).toBe(false);
  });

  it('caps AHA at 1×/week for sensitive skin', () => {
    const { cycle } = run([active('g', 'Glycolic', ['aha']), active('r', 'Retinol', ['retinoid'])], {
      ...base,
      sensitivity: 'sensitive',
    });
    expect(cycle!.nights.filter((n) => n.productId === 'g').length).toBe(1);
  });

  it('sensitive → gentle variant, resistant → advanced (auto)', () => {
    const a = [active('r', 'Retinol', ['retinoid'])];
    expect(run(a, { ...base, sensitivity: 'sensitive' }).cycle!.variant).toBe('gentle');
    expect(run(a, { ...base, sensitivity: 'resistant' }).cycle!.variant).toBe('advanced');
    expect(run(a, { ...base, sensitivity: 'neutral' }).cycle!.variant).toBe('classic');
  });

  it('honours a user variant override', () => {
    expect(run([active('r', 'Retinol', ['retinoid'])], { ...base, preferredVariant: 'classic' }).cycle!.variant).toBe('classic');
  });
});

describe('orchestration — Maya (the spec example) + the complex cabinet', () => {
  it('Maya: retinoid + glycolic, gentle — both appear, alternated, with recovery', () => {
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

describe('orchestration — safety + fallback', () => {
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
    const { cycle, notes } = run([active('r', 'Retinol', ['retinoid'])], { ...base, pregnancy: true });
    expect(cycle).toBeNull(); // no cycle (nothing left to cycle)
    expect(notes.join(' ')).toMatch(/pregnan|doctor/i); // ...but the safety message still reaches the user
  });

  it('no potent actives → no cycle (a simple daily routine)', () => {
    expect(run([active('n', 'Niacinamide', ['niacinamide'])]).cycle).toBeNull();
    expect(run([]).cycle).toBeNull();
  });
});
