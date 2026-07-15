import { afterEach, describe, expect, it, vi } from 'vitest';

import { readLocalDateBoundarySnapshot } from '@/lib/query/queryDateBoundaryCore';

import {
  createRoutinePhaseStore,
  currentRoutineType,
  currentRoutineTypeForBoundary,
  localClockLabel,
  localDateString,
  millisecondsUntilNextRoutinePhaseBoundary,
  ROUTINE_PHASE_CLOCK_CHECK_MS,
} from './useToday';

function createAppStateSource(initialState: string = 'active') {
  let currentState = initialState;
  let listener: ((state: string) => void) | null = null;
  const remove = vi.fn(() => {
    listener = null;
  });
  return {
    source: {
      get currentState() {
        return currentState;
      },
      addEventListener: vi.fn((_event: 'change', nextListener: (state: string) => void) => {
        listener = nextListener;
        return { remove };
      }),
    },
    emit(nextState: string) {
      currentState = nextState;
      listener?.(nextState);
    },
    remove,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('today date and time helpers', () => {
  it('formats the local calendar date as YYYY-MM-DD', () => {
    expect(localDateString(new Date(2026, 6, 5, 9, 7))).toBe('2026-07-05');
  });

  it('uses AM before 5pm and PM from 5pm onward', () => {
    expect(currentRoutineType(new Date(2026, 6, 5, 16, 59))).toBe('AM');
    expect(currentRoutineType(new Date(2026, 6, 5, 17, 0))).toBe('PM');
  });

  it('schedules 5pm and midnight as the next phase boundaries', () => {
    expect(millisecondsUntilNextRoutinePhaseBoundary(new Date(2026, 6, 5, 16, 59, 59, 900))).toBe(
      100,
    );
    expect(millisecondsUntilNextRoutinePhaseBoundary(new Date(2026, 6, 5, 17, 0, 0, 0))).toBe(
      7 * 60 * 60 * 1000,
    );
  });

  it('publishes PM at 5pm and AM again at local midnight without a remount', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 5, 16, 59, 59, 900));
    const store = createRoutinePhaseStore();
    const phases: string[] = [];
    const unsubscribe = store.subscribe(() => phases.push(store.getSnapshot()));

    expect(store.getSnapshot()).toBe('AM');
    await vi.advanceTimersByTimeAsync(100);
    expect(store.getSnapshot()).toBe('PM');
    await vi.advanceTimersByTimeAsync(7 * 60 * 60 * 1000);
    expect(store.getSnapshot()).toBe('AM');
    expect(phases).toEqual(['PM', 'AM']);

    unsubscribe();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reschedules against the current clock when the date boundary reconciles', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 5, 9, 0));
    const store = createRoutinePhaseStore();
    const phases: string[] = [];
    const unsubscribe = store.subscribe(() => phases.push(store.getSnapshot()));

    vi.setSystemTime(new Date(2026, 6, 5, 16, 59, 59, 900));
    store.reconcile();
    await vi.advanceTimersByTimeAsync(100);

    expect(store.getSnapshot()).toBe('PM');
    expect(phases).toEqual(['PM']);
    unsubscribe();
  });

  it('reconciles immediately on foreground and cleans up its shared AppState listener', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 5, 9, 0));
    const appState = createAppStateSource();
    const store = createRoutinePhaseStore({ appState: appState.source });
    const phases: string[] = [];
    const unsubscribe = store.subscribe(() => phases.push(store.getSnapshot()));

    appState.emit('background');
    expect(vi.getTimerCount()).toBe(0);
    vi.setSystemTime(new Date(2026, 6, 5, 18, 0));
    appState.emit('active');

    expect(store.getSnapshot()).toBe('PM');
    expect(phases).toEqual(['PM']);
    expect(vi.getTimerCount()).toBe(1);

    unsubscribe();
    expect(appState.remove).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('detects an active same-day manual clock jump on the shared clock check', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 5, 9, 0));
    const store = createRoutinePhaseStore();
    const phases: string[] = [];
    const unsubscribe = store.subscribe(() => phases.push(store.getSnapshot()));

    vi.setSystemTime(new Date(2026, 6, 5, 18, 0));
    await vi.advanceTimersByTimeAsync(ROUTINE_PHASE_CLOCK_CHECK_MS);

    expect(store.getSnapshot()).toBe('PM');
    expect(phases).toEqual(['PM']);
    unsubscribe();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('withholds a new-day phase until the route boundary matches the same clock snapshot', () => {
    const previousDay = new Date(2026, 6, 5, 23, 59, 59);
    const nextDay = new Date(2026, 6, 6, 0, 0, 1);
    const previousBoundary = readLocalDateBoundarySnapshot(previousDay);
    const nextBoundary = readLocalDateBoundarySnapshot(nextDay);

    expect(currentRoutineTypeForBoundary(previousBoundary, nextDay)).toBeNull();
    expect(currentRoutineTypeForBoundary(nextBoundary, nextDay)).toBe('AM');
  });

  it('reconciles the date boundary before publishing a natural-midnight phase change', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 5, 23, 59, 59, 900));
    const order: string[] = [];
    const store = createRoutinePhaseStore({
      reconcileBoundary: () => order.push('boundary'),
    });
    const unsubscribe = store.subscribe(() => order.push(`phase:${store.getSnapshot()}`));
    order.length = 0;

    await vi.advanceTimersByTimeAsync(100);

    expect(order).toEqual(['boundary', 'phase:AM']);
    unsubscribe();
  });

  it('reconciles a cross-day active clock jump even when AM/PM does not change', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 5, 9, 0));
    const reconcileBoundary = vi.fn();
    const store = createRoutinePhaseStore({ reconcileBoundary });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    reconcileBoundary.mockClear();

    vi.setSystemTime(new Date(2026, 6, 6, 9, 0));
    await vi.advanceTimersByTimeAsync(ROUTINE_PHASE_CLOCK_CHECK_MS);

    expect(reconcileBoundary).toHaveBeenCalledOnce();
    expect(listener).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toBe('AM');
    unsubscribe();
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
      expect(
        createRoutinePhaseStore({ now: () => new Date(2026, 6, 5, 21, 0) }).getSnapshot(),
      ).toBe('AM');

      Object.defineProperty(globalThis, 'location', {
        configurable: true,
        value: { search: '?routine=PM' },
      });
      expect(currentRoutineType(new Date(2026, 6, 5, 9, 0))).toBe('PM');
      expect(createRoutinePhaseStore({ now: () => new Date(2026, 6, 5, 9, 0) }).getSnapshot()).toBe(
        'PM',
      );
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
