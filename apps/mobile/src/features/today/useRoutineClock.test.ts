import { describe, expect, it, vi } from 'vitest';

import { millisecondsUntilNextRoutineBoundary, routineClockSnapshot } from './useRoutineClock';

vi.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
}));

describe('routine clock boundary', () => {
  it('moves an open Today surface from AM to PM at 17:00', () => {
    const before = new Date(2026, 6, 26, 16, 59, 59, 900);
    const after = new Date(before.getTime() + millisecondsUntilNextRoutineBoundary(before));

    expect(routineClockSnapshot(before).phase).toBe('AM');
    expect(routineClockSnapshot(after).phase).toBe('PM');
    expect(after.getHours()).toBe(17);
  });

  it('moves an open routine surface to the next local date at midnight', () => {
    const before = new Date(2026, 11, 31, 23, 59, 59, 900);
    const after = new Date(before.getTime() + millisecondsUntilNextRoutineBoundary(before));

    expect(routineClockSnapshot(before).localDate).toBe('2026-12-31');
    expect(routineClockSnapshot(after).localDate).toBe('2027-01-01');
    expect(routineClockSnapshot(after).phase).toBe('AM');
  });

  it('always schedules a positive delay even exactly on a boundary', () => {
    expect(
      millisecondsUntilNextRoutineBoundary(new Date(2026, 6, 26, 17, 0, 0, 0)),
    ).toBeGreaterThan(1_000);
  });
});
