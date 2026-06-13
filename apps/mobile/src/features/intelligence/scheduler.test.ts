import { describe, expect, it } from 'vitest';

import {
  CYCLE_TEMPLATES,
  friendlyWeekday,
  nextNightWithSlot,
  nightForDate,
  pickCycle,
  pmResolution,
  type SchedulerProfile,
} from './scheduler';

const base: SchedulerProfile = { sensitivity: 'neutral', goals: [], hasActives: true };

describe('cycle selection (docs/02 §5)', () => {
  it('no actives -> no cycle', () => {
    expect(pickCycle({ ...base, hasActives: false })).toBeNull();
  });
  it('sensitive -> gentle (more recovery nights)', () => {
    expect(pickCycle({ ...base, sensitivity: 'sensitive' })?.id).toBe('gentle_5');
  });
  it('barrier_repair goal -> gentle', () => {
    expect(pickCycle({ ...base, goals: ['barrier_repair'] })?.id).toBe('gentle_5');
  });
  it('resistant -> advanced', () => {
    expect(pickCycle({ ...base, sensitivity: 'resistant' })?.id).toBe('advanced_3');
  });
  it('neutral -> classic four-night', () => {
    expect(pickCycle(base)?.id).toBe('classic_4');
  });
});

describe('night computation (classic 4-night)', () => {
  const t = CYCLE_TEMPLATES.classic_4;
  const anchor = '2026-06-10'; // night 1 = exfoliate

  it('anchor day is night 1 / exfoliate', () => {
    expect(nightForDate(t, anchor, '2026-06-10')).toEqual({ index: 1, slot: 'exfoliate', total: 4 });
  });
  it('day +1 is night 2 / retinoid (the spec PM screen: NIGHT 2 OF 4)', () => {
    expect(nightForDate(t, anchor, '2026-06-11')).toEqual({ index: 2, slot: 'retinoid', total: 4 });
  });
  it('cycle repeats: day +4 is night 1 again', () => {
    expect(nightForDate(t, anchor, '2026-06-14')).toEqual({ index: 1, slot: 'exfoliate', total: 4 });
  });
  it('handles dates before the anchor', () => {
    expect(nightForDate(t, anchor, '2026-06-09').slot).toBe('recover'); // night 4
  });
});

describe('next acid (exfoliate) night', () => {
  const t = CYCLE_TEMPLATES.classic_4;
  const anchor = '2026-06-10';
  it('from a retinoid night, next exfoliate is 3 nights later', () => {
    // today = 2026-06-11 (retinoid). nights: 12 recover,13 recover,14 exfoliate
    expect(nextNightWithSlot(t, anchor, '2026-06-11', 'exfoliate')).toBe('2026-06-14');
  });
});

describe('PM auto-resolution (spec §7.4)', () => {
  const t = CYCLE_TEMPLATES.classic_4;
  const anchor = '2026-06-10';

  it('on a retinoid night, skips the acid and names the next acid night', () => {
    const r = pmResolution(t, anchor, '2026-06-11', ['Glycolic 7% Toner']);
    expect(r.skippedTonight).toEqual(['Glycolic 7% Toner']);
    expect(r.nextAcidNight).toBe(friendlyWeekday('2026-06-14'));
  });

  it('on an exfoliate night, nothing is skipped', () => {
    const r = pmResolution(t, anchor, '2026-06-10', ['Glycolic 7% Toner']);
    expect(r.skippedTonight).toEqual([]);
    expect(r.nextAcidNight).toBeNull();
  });

  it('no acids owned -> nothing skipped', () => {
    const r = pmResolution(t, anchor, '2026-06-11', []);
    expect(r.skippedTonight).toEqual([]);
  });
});
