import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { currentRoutineType, localClockLabel, localDateString } from './useToday';

export type RoutineClockSnapshot = Readonly<{
  now: Date;
  localDate: string;
  phase: 'AM' | 'PM';
  clockLabel: string;
}>;

export function routineClockSnapshot(now = new Date()): RoutineClockSnapshot {
  return Object.freeze({
    now,
    localDate: localDateString(now),
    phase: currentRoutineType(now) === 'PM' ? 'PM' : 'AM',
    clockLabel: localClockLabel(now),
  });
}

export function millisecondsUntilNextRoutineBoundary(now: Date): number {
  const next = new Date(now);
  if (now.getHours() < 17) {
    next.setHours(17, 0, 0, 0);
  } else {
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
  }
  return Math.max(1_000, next.getTime() - now.getTime() + 100);
}

function millisecondsUntilNextMinute(now: Date): number {
  const next = new Date(now);
  next.setSeconds(60, 100);
  return Math.max(1_000, next.getTime() - now.getTime());
}

/**
 * Keeps long-lived routine screens aligned with the user's local day and AM/PM
 * boundary. Foregrounding refreshes immediately, covering suspended apps and
 * travel/timezone changes. Today can also request minute ticks for its visible
 * local clock; progress-only consumers wake only at 17:00 and midnight.
 */
export function useRoutineClock({
  includeMinuteUpdates = false,
}: {
  includeMinuteUpdates?: boolean;
} = {}): RoutineClockSnapshot {
  const [clock, setClock] = useState<RoutineClockSnapshot>(() => routineClockSnapshot());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const clearTimer = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };
    const refresh = () => setClock(routineClockSnapshot());
    const schedule = () => {
      clearTimer();
      if (AppState.currentState !== 'active') return;
      const now = new Date();
      const boundaryDelay = millisecondsUntilNextRoutineBoundary(now);
      const delay = includeMinuteUpdates
        ? Math.min(boundaryDelay, millisecondsUntilNextMinute(now))
        : boundaryDelay;
      timer = setTimeout(() => {
        refresh();
        schedule();
      }, delay);
    };
    const onAppStateChange = (nextState: AppStateStatus) => {
      if (nextState !== 'active') {
        clearTimer();
        return;
      }
      refresh();
      schedule();
    };

    schedule();
    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => {
      clearTimer();
      subscription.remove();
    };
  }, [includeMinuteUpdates]);

  return clock;
}
