import { describe, expect, it, vi } from 'vitest';

import {
  createLocalDateBoundaryCoordinator,
  millisecondsUntilNextTimeZoneOffsetChange,
  readLocalDateBoundarySnapshot,
  type LocalDateBoundarySnapshot,
} from './queryDateBoundaryCore';
import { createLocalDateBoundaryStore } from './localDateBoundaryStore';

function createHarness(
  initial: LocalDateBoundarySnapshot,
  initialAppState: string | null = 'active',
) {
  let snapshot = initial;
  let appState = initialAppState;
  let nextTimerId = 0;
  const timers = new Map<number, () => void>();
  const listeners = new Set<(state: string) => void>();
  const events: string[] = [];
  const remove = vi.fn();
  const invalidate = vi.fn(async () => {
    events.push('invalidate');
  });
  const publishSnapshot = vi.fn((next: LocalDateBoundarySnapshot) => {
    events.push(`publish:${next.localDate}:${next.timeZone}`);
  });
  const clearTimer = vi.fn((handle: unknown) => {
    timers.delete(handle as number);
  });
  const setTimer = vi.fn((callback: () => void, _delayMs: number) => {
    const id = ++nextTimerId;
    timers.set(id, callback);
    return id;
  });
  const readSnapshot = vi.fn(() => snapshot);
  const addEventListener = vi.fn((_event: 'change', listener: (state: string) => void) => {
    listeners.add(listener);
    return {
      remove: () => {
        listeners.delete(listener);
        remove();
      },
    };
  });
  const coordinator = createLocalDateBoundaryCoordinator({
    appState: {
      get currentState() {
        return appState;
      },
      addEventListener,
    },
    clearTimer,
    invalidate,
    publishSnapshot,
    readSnapshot,
    setTimer,
  });

  return {
    addEventListener,
    clearTimer,
    coordinator,
    emit: (state: string) => {
      appState = state;
      listeners.forEach((listener) => listener(state));
    },
    events,
    fireTimer: () => {
      const entry = [...timers.entries()][0];
      if (!entry) throw new Error('NO_BOUNDARY_TIMER');
      timers.delete(entry[0]);
      entry[1]();
    },
    invalidate,
    publishSnapshot,
    readSnapshot,
    remove,
    setSnapshot: (next: LocalDateBoundarySnapshot) => {
      snapshot = next;
    },
    setTimer,
    timers,
  };
}

const DAY_ONE: LocalDateBoundarySnapshot = {
  localDate: '2026-07-13',
  timeZone: 'America/Toronto|offset:240',
  millisecondsUntilNextDay: 10_000,
};

async function flushInvalidation(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('local date boundary coordinator', () => {
  it('configures once, suspends its timer in background, and rearms on foreground', () => {
    const harness = createHarness(DAY_ONE);

    expect(harness.coordinator.configure()).toBe('configured');
    expect(harness.coordinator.configure()).toBe('already-configured');
    expect(harness.addEventListener).toHaveBeenCalledTimes(1);
    expect(harness.setTimer).toHaveBeenCalledTimes(1);
    expect(harness.publishSnapshot).toHaveBeenCalledExactlyOnceWith(DAY_ONE);

    harness.emit('background');
    expect(harness.readSnapshot).toHaveBeenCalledTimes(1);
    expect(harness.clearTimer).toHaveBeenCalledTimes(1);
    expect(harness.timers.size).toBe(0);
    harness.emit('active');

    expect(harness.readSnapshot).toHaveBeenCalledTimes(2);
    expect(harness.invalidate).not.toHaveBeenCalled();
    expect(harness.timers.size).toBe(1);
  });

  it('publishes a hidden date change before invalidating when the app returns active', () => {
    const harness = createHarness(DAY_ONE);
    harness.coordinator.configure();
    harness.emit('background');
    harness.events.length = 0;
    harness.setSnapshot({ ...DAY_ONE, localDate: '2026-07-14' });

    expect(harness.timers.size).toBe(0);
    expect(harness.readSnapshot).toHaveBeenCalledTimes(1);
    expect(harness.invalidate).not.toHaveBeenCalled();

    harness.emit('active');

    expect(harness.events).toEqual([`publish:2026-07-14:${DAY_ONE.timeZone}`, 'invalidate']);
    expect(harness.timers.size).toBe(1);
  });

  it('publishes and invalidates once at local midnight, then rearms the next boundary', async () => {
    const harness = createHarness(DAY_ONE);
    harness.coordinator.configure();
    harness.events.length = 0;
    harness.setSnapshot({ ...DAY_ONE, localDate: '2026-07-14' });

    harness.fireTimer();
    expect(harness.invalidate).toHaveBeenCalledTimes(1);
    expect(harness.events).toEqual([`publish:2026-07-14:${DAY_ONE.timeZone}`, 'invalidate']);
    expect(harness.timers.size).toBe(1);

    await flushInvalidation();
    harness.fireTimer();
    expect(harness.invalidate).toHaveBeenCalledTimes(1);
  });

  it('invalidates on a foreground time-zone or UTC-offset change without a date change', () => {
    const harness = createHarness(DAY_ONE);
    harness.coordinator.configure();
    harness.setSnapshot({
      ...DAY_ONE,
      timeZone: 'America/Vancouver|offset:420',
    });

    harness.emit('active');
    harness.emit('active');

    expect(harness.invalidate).toHaveBeenCalledTimes(1);
  });

  it('reconciles an in-foreground native clock or time-zone change event', () => {
    const harness = createHarness(DAY_ONE);
    harness.coordinator.configure();
    harness.setSnapshot({
      ...DAY_ONE,
      timeZone: 'America/Vancouver|offset:420',
    });

    harness.coordinator.reconcile();

    expect(harness.invalidate).toHaveBeenCalledTimes(1);
    expect(harness.publishSnapshot).toHaveBeenLastCalledWith({
      ...DAY_ONE,
      timeZone: 'America/Vancouver|offset:420',
    });
  });

  it('waits for an active app state before arming its first timer', () => {
    const harness = createHarness(DAY_ONE, null);

    expect(harness.coordinator.configure()).toBe('configured');
    expect(harness.publishSnapshot).toHaveBeenCalledExactlyOnceWith(DAY_ONE);
    expect(harness.timers.size).toBe(0);

    harness.emit('active');

    expect(harness.readSnapshot).toHaveBeenCalledTimes(2);
    expect(harness.timers.size).toBe(1);
  });

  it('retries a failed clock snapshot on a bounded retry timer', () => {
    const harness = createHarness(DAY_ONE);
    harness.readSnapshot.mockImplementationOnce(() => {
      throw new Error('clock unavailable');
    });

    expect(harness.coordinator.configure()).toBe('configured');
    expect(harness.timers.size).toBe(1);
    expect(harness.setTimer).toHaveBeenLastCalledWith(expect.any(Function), 60_000);

    harness.fireTimer();

    expect(harness.publishSnapshot).toHaveBeenCalledExactlyOnceWith(DAY_ONE);
    expect(harness.invalidate).not.toHaveBeenCalled();
    expect(harness.timers.size).toBe(1);
  });

  it('retries a failed asynchronous invalidation on a bounded timer', async () => {
    const harness = createHarness(DAY_ONE);
    harness.invalidate.mockRejectedValueOnce(new Error('query client unavailable'));
    harness.coordinator.configure();
    harness.setSnapshot({ ...DAY_ONE, localDate: '2026-07-14' });
    harness.fireTimer();
    await flushInvalidation();

    expect(harness.invalidate).toHaveBeenCalledTimes(1);
    expect(harness.setTimer).toHaveBeenLastCalledWith(expect.any(Function), 60_000);
    harness.fireTimer();
    await flushInvalidation();

    expect(harness.invalidate).toHaveBeenCalledTimes(2);
    expect(harness.timers.size).toBe(1);
  });

  it('guards an in-flight invalidation while retaining a newer boundary change', async () => {
    const harness = createHarness(DAY_ONE);
    let resolveFirst!: () => void;
    harness.invalidate.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    harness.coordinator.configure();
    harness.setSnapshot({ ...DAY_ONE, localDate: '2026-07-14' });
    harness.fireTimer();

    harness.setSnapshot({
      ...DAY_ONE,
      localDate: '2026-07-14',
      timeZone: 'America/Vancouver|offset:420',
    });
    harness.emit('active');
    expect(harness.invalidate).toHaveBeenCalledTimes(1);

    resolveFirst();
    await flushInvalidation();

    expect(harness.invalidate).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['23-hour DST-like day', 23 * 60 * 60 * 1_000],
    ['25-hour DST-like day', 25 * 60 * 60 * 1_000],
  ])('preserves a valid %s boundary delay', (_label, delayMs) => {
    const harness = createHarness({ ...DAY_ONE, millisecondsUntilNextDay: delayMs });

    harness.coordinator.configure();

    expect(harness.setTimer).toHaveBeenLastCalledWith(expect.any(Function), delayMs);
  });

  it('caps an unsafe boundary delay at 26 hours', () => {
    const harness = createHarness({
      ...DAY_ONE,
      millisecondsUntilNextDay: 40 * 60 * 60 * 1_000,
    });

    harness.coordinator.configure();

    expect(harness.setTimer).toHaveBeenLastCalledWith(expect.any(Function), 26 * 60 * 60 * 1_000);
  });

  it('cleans up its timer and lifecycle listener', () => {
    const harness = createHarness(DAY_ONE);
    harness.coordinator.configure();

    harness.coordinator.dispose();
    harness.emit('active');

    expect(harness.remove).toHaveBeenCalledTimes(1);
    expect(harness.timers.size).toBe(0);
    expect(harness.invalidate).not.toHaveBeenCalled();
  });
});

describe('local date boundary snapshot', () => {
  it('uses the local calendar date and schedules the next local midnight', () => {
    const now = new Date(2026, 6, 13, 23, 59, 30, 0);
    const snapshot = readLocalDateBoundarySnapshot(now);

    expect(snapshot.localDate).toBe('2026-07-13');
    expect(snapshot.timeZone).toContain('|offset:');
    expect(snapshot.millisecondsUntilNextDay).toBeGreaterThanOrEqual(30_000);
    expect(snapshot.millisecondsUntilNextDay).toBeLessThan(31_000);
  });

  it('schedules an intra-day UTC-offset transition without polling', () => {
    const now = new Date('2026-07-13T00:00:00.000Z');
    const transitionAt = now.getTime() + 2 * 60 * 60 * 1_000 + 1_234;
    const delay = millisecondsUntilNextTimeZoneOffsetChange(now, (at) =>
      at.getTime() < transitionAt ? 240 : 300,
    );

    expect(delay).not.toBeNull();
    expect(delay!).toBeGreaterThanOrEqual(transitionAt - now.getTime());
    expect(delay!).toBeLessThan(transitionAt - now.getTime() + 1_100);
  });
});

describe('local date boundary external store', () => {
  it('publishes one stable reactive identity only when the date or time zone changes', () => {
    const store = createLocalDateBoundaryStore({
      localDate: DAY_ONE.localDate,
      timeZone: DAY_ONE.timeZone,
    });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const initial = store.getSnapshot();

    expect(store.publish({ ...initial })).toBe(false);
    expect(store.getSnapshot()).toBe(initial);
    expect(listener).not.toHaveBeenCalled();

    expect(store.publish({ ...initial, localDate: '2026-07-14' })).toBe(true);
    expect(store.getSnapshot()).toEqual({
      localDate: '2026-07-14',
      timeZone: DAY_ONE.timeZone,
    });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.publish({ localDate: '2026-07-14', timeZone: 'America/Vancouver|offset:420' });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
