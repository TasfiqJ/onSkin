import { createElement, useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';

import { useRoutineClock, routineClockSnapshot, millisecondsUntilNextRoutineBoundary } from './useRoutineClock';

const app = vi.hoisted(() => ({ currentState: 'active', listener: (_state: string) => {} }));
vi.mock('react-native', () => ({ AppState: {
  get currentState() { return app.currentState; },
  addEventListener: (_event: string, listener: (state: string) => void) => {
    app.listener = listener; return { remove() {} };
  },
} }));
let renderer: ReactTestRenderer | undefined;
let observed: ReturnType<typeof useRoutineClock>;
function Probe() {
  const clock = useRoutineClock();
  useEffect(() => { observed = clock; }, [clock]);
  return null;
}
afterEach(async () => {
  await act(async () => renderer?.unmount()); renderer = undefined;
  vi.useRealTimers(); app.currentState = 'active';
});

it('updates a mounted supported-flow view at 17:00 and midnight without host clock mutation', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 20, 16, 59, 59));
  await act(async () => { renderer = create(createElement(Probe)); });
  expect(observed.phase).toBe('AM');
  await act(async () => { vi.advanceTimersByTime(1_100); });
  expect(observed.phase).toBe('PM');
  app.currentState = 'background';
  await act(async () => { app.listener('background'); });
  vi.setSystemTime(new Date(2026, 9, 21, 0, 0, 1));
  app.currentState = 'active';
  await act(async () => { app.listener('active'); });
  expect(observed.localDate).toBe('2026-10-21');
  expect(observed.phase).toBe('AM');
});

it('refreshes the local day after suspended travel/timezone change on foreground', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 20, 23, 30));
  await act(async () => { renderer = create(createElement(Probe)); });
  const before = observed.localDate;
  app.currentState = 'background';
  await act(async () => app.listener('background'));
  // The external wall-clock boundary after travel is represented in this JS
  // runtime only; no workstation timezone or clock is changed.
  vi.setSystemTime(new Date(2026, 9, 21, 9, 30));
  app.currentState = 'active';
  await act(async () => app.listener('active'));
  expect(observed.localDate).not.toBe(before);
  expect(observed.phase).toBe('AM');
});

it.each([[2026, 2, 8], [2026, 10, 1]])('uses local calendar boundaries on DST day %i/%i/%i', (year, month, day) => {
  const midnight = new Date(year, month, day, 0, 0, 0);
  const boundary = new Date(midnight.getTime() + millisecondsUntilNextRoutineBoundary(midnight));
  expect(boundary.getDate()).toBe(day);
  expect(boundary.getHours()).toBe(17);
  expect(routineClockSnapshot(boundary).phase).toBe('PM');
  // Under the separately recorded America/Toronto run these are 16h/18h
  // elapsed days, proving that a fixed 24h interval is not used.
  if (Intl.DateTimeFormat().resolvedOptions().timeZone === 'America/Toronto') {
    expect(Math.round((boundary.getTime() - midnight.getTime()) / 3_600_000)).toBe(month === 2 ? 16 : 18);
  }
});

it('maps the same instant to the current runtime timezone local day', () => {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const expected = { 'America/Toronto': '2026-10-19', 'Pacific/Auckland': '2026-10-20', UTC: '2026-10-20' }[zone];
  if (expected) expect(routineClockSnapshot(new Date('2026-10-20T03:30:00Z')).localDate).toBe(expected);
});
