import { describe, expect, it } from 'vitest';

import { currentRoutineType, localClockLabel, localDateString } from './useToday';

function withTimeZone<T>(timeZone: string, run: () => T): T {
  const previous = process.env.TZ;
  process.env.TZ = timeZone;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

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

  it.each([
    [
      'America/Toronto',
      'spring transition midnight',
      '2026-03-08T04:59:59Z',
      '2026-03-08T05:00:00Z',
      '2026-03-07',
      '2026-03-08',
    ],
    [
      'America/Los_Angeles',
      'spring transition midnight',
      '2026-03-08T07:59:59Z',
      '2026-03-08T08:00:00Z',
      '2026-03-07',
      '2026-03-08',
    ],
    [
      'UTC',
      'year rollover',
      '2026-12-31T23:59:59Z',
      '2027-01-01T00:00:00Z',
      '2026-12-31',
      '2027-01-01',
    ],
  ] as const)(
    'derives the local calendar date in %s at %s',
    (timeZone, _boundary, beforeISO, afterISO, beforeDate, afterDate) => {
      withTimeZone(timeZone, () => {
        expect(localDateString(new Date(beforeISO))).toBe(beforeDate);
        expect(localDateString(new Date(afterISO))).toBe(afterDate);
      });
    },
  );

  it.each([
    ['America/Toronto', '2026-03-08T06:59:00Z', '2026-03-08T07:00:00Z'],
    ['America/Los_Angeles', '2026-03-08T09:59:00Z', '2026-03-08T10:00:00Z'],
  ] as const)(
    'renders the real spring-forward clock jump in %s',
    (timeZone, beforeISO, afterISO) => {
      withTimeZone(timeZone, () => {
        expect(localDateString(new Date(beforeISO))).toBe('2026-03-08');
        expect(localDateString(new Date(afterISO))).toBe('2026-03-08');
        expect(localClockLabel(new Date(beforeISO))).toBe('1:59 AM');
        expect(localClockLabel(new Date(afterISO))).toBe('3:00 AM');
        expect(currentRoutineType(new Date(beforeISO))).toBe('AM');
        expect(currentRoutineType(new Date(afterISO))).toBe('AM');
      });
    },
  );

  it.each([
    ['America/Toronto', '2026-11-01T05:30:00Z', '2026-11-01T06:30:00Z'],
    ['America/Los_Angeles', '2026-11-01T08:30:00Z', '2026-11-01T09:30:00Z'],
  ] as const)(
    'keeps the same local date through the repeated fall-back hour in %s',
    (timeZone, firstISO, repeatedISO) => {
      withTimeZone(timeZone, () => {
        expect(localDateString(new Date(firstISO))).toBe('2026-11-01');
        expect(localDateString(new Date(repeatedISO))).toBe('2026-11-01');
        expect(localClockLabel(new Date(firstISO))).toBe('1:30 AM');
        expect(localClockLabel(new Date(repeatedISO))).toBe('1:30 AM');
      });
    },
  );
});
