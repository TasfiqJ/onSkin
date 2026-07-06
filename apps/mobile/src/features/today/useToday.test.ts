import { describe, expect, it } from 'vitest';

import { currentRoutineType, localClockLabel, localDateString } from './useToday';

describe('today date and time helpers', () => {
  it('formats the local calendar date as YYYY-MM-DD', () => {
    expect(localDateString(new Date(2026, 6, 5, 9, 7))).toBe('2026-07-05');
  });

  it('uses AM before 5pm and PM from 5pm onward', () => {
    expect(currentRoutineType(new Date(2026, 6, 5, 16, 59))).toBe('AM');
    expect(currentRoutineType(new Date(2026, 6, 5, 17, 0))).toBe('PM');
  });

  it('allows dev web previews to force the routine phase', () => {
    type TestGlobal = typeof globalThis & {
      __DEV__?: boolean;
      location?: { search?: string };
    };
    const testGlobal = globalThis as TestGlobal;
    const originalDev = testGlobal.__DEV__;
    const originalLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');

    try {
      testGlobal.__DEV__ = true;
      Object.defineProperty(globalThis, 'location', {
        configurable: true,
        value: { search: '?routine=AM' },
      });
      expect(currentRoutineType(new Date(2026, 6, 5, 21, 0))).toBe('AM');

      Object.defineProperty(globalThis, 'location', {
        configurable: true,
        value: { search: '?routine=PM' },
      });
      expect(currentRoutineType(new Date(2026, 6, 5, 9, 0))).toBe('PM');
    } finally {
      if (originalDev === undefined) Reflect.deleteProperty(testGlobal, '__DEV__');
      else testGlobal.__DEV__ = originalDev;

      if (originalLocation) Object.defineProperty(globalThis, 'location', originalLocation);
      else Reflect.deleteProperty(testGlobal, 'location');
    }
  });

  it('formats the local clock without relying on hardcoded screen-copy times', () => {
    expect(localClockLabel(new Date(2026, 6, 5, 0, 4))).toBe('12:04 AM');
    expect(localClockLabel(new Date(2026, 6, 5, 9, 7))).toBe('9:07 AM');
    expect(localClockLabel(new Date(2026, 6, 5, 12, 0))).toBe('12:00 PM');
    expect(localClockLabel(new Date(2026, 6, 5, 21, 41))).toBe('9:41 PM');
  });
});
