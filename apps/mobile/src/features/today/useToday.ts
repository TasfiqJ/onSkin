import type { RoutineType } from '@onskin/types';
import { useEffect, useSyncExternalStore } from 'react';

import {
  reconcileLocalDateBoundarySnapshot,
  type LocalDateBoundaryIdentity,
} from '@/lib/query/localDateBoundaryStore';
import { readLocalDateBoundaryIdentity } from '@/lib/query/queryDateBoundaryCore';

// Shared local-day / routine-phase helpers for the Today loop and every store
// that keys on the user's calendar day (shelf, cycle, ramp, ask, photos...).
//
// NOTE on the check-off path: the live, v1 source of truth for completions is
// the local-first AsyncStorage log in `completionsStore.ts` (read by Today and
// `useProgress`). The earlier server-backed `useToday()`/`useToggleStep()` hooks
// were removed: they queried `routines`/`routine_steps`/`routine_completions`,
// which do not exist until the backend is provisioned, and the live Today screen
// never used them, so they were dead wiring that presented as a second, parallel
// completion system. The durable server-sync target (the offline queue in
// `lib/offline/completionQueue.ts`) drains from the local log once real server
// routine/step ids exist (B-SUPABASE / B-ROUTINE-PERSIST).

/** Local calendar date as YYYY-MM-DD (the user's day. See DECISIONS D-012). */
export function localDateString(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type TodayRoutinePhase = Extract<RoutineType, 'AM' | 'PM'>;

type RoutinePhaseAppStateSource = {
  currentState: string | null;
  addEventListener: (event: 'change', listener: (state: string) => void) => { remove: () => void };
};

type RoutinePhaseStoreDependencies = {
  appState?: RoutinePhaseAppStateSource;
  clearTimer?: (handle: ReturnType<typeof setTimeout>) => void;
  now?: () => Date;
  reconcileBoundary?: () => void;
  setTimer?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
};

export const ROUTINE_PHASE_CLOCK_CHECK_MS = 60_000;

function devRoutineTypeOverride(): TodayRoutinePhase | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  const locationLike = (globalThis as { location?: { search?: string } }).location;
  if (!locationLike?.search || typeof URLSearchParams === 'undefined') return null;
  const requested = new URLSearchParams(locationLike.search).get('routine');
  return requested === 'AM' || requested === 'PM' ? requested : null;
}

/** AM before 5pm, PM after (design spec: morning check-off / evening cycling). */
export function currentRoutineType(d = new Date()): TodayRoutinePhase {
  const override = devRoutineTypeOverride();
  if (override) return override;
  return d.getHours() < 17 ? 'AM' : 'PM';
}

/** Milliseconds until the next local AM/PM transition (17:00 or midnight). */
export function millisecondsUntilNextRoutinePhaseBoundary(d = new Date()): number {
  const next = new Date(d);
  if (d.getHours() < 17) {
    next.setHours(17, 0, 0, 0);
  } else {
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
  }
  return Math.max(1, next.getTime() - d.getTime());
}

function setRoutinePhaseTimer(
  callback: () => void,
  delayMs: number,
): ReturnType<typeof setTimeout> {
  const handle = setTimeout(callback, delayMs);
  const nodeHandle = handle as ReturnType<typeof setTimeout> & { unref?: () => void };
  nodeHandle.unref?.();
  return handle;
}

function localClockIdentity(now: Date): string {
  let zone = 'local';
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone || zone;
  } catch {
    // The UTC offset still detects most travel and daylight-saving changes.
  }
  return `${localDateString(now)}|${zone}|offset:${now.getTimezoneOffset()}`;
}

/**
 * One timer-backed phase source. The snapshot is read from the live clock so a
 * parent render, development URL override, or explicit reconciliation can also
 * correct a manual clock/time-zone change without remounting Today.
 */
export function createRoutinePhaseStore({
  appState: initialAppState,
  clearTimer = clearTimeout,
  now = () => new Date(),
  reconcileBoundary = () => {},
  setTimer = setRoutinePhaseTimer,
}: RoutinePhaseStoreDependencies = {}) {
  const listeners = new Set<() => void>();
  let appState = initialAppState ?? null;
  let appStateSubscription: { remove: () => void } | null = null;
  let active = appState?.currentState !== 'background' && appState?.currentState !== 'inactive';
  const initialNow = now();
  let lastClockIdentity = localClockIdentity(initialNow);
  let lastPhase = currentRoutineType(initialNow);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const safelyReconcileBoundary = () => {
    try {
      reconcileBoundary();
    } catch {
      // A failed coordinator read withholds its own publication and retries.
    }
  };

  const clearScheduledBoundary = () => {
    if (timer === null) return;
    clearTimer(timer);
    timer = null;
  };

  const scheduleNextBoundary = (): void => {
    clearScheduledBoundary();
    if (!active || listeners.size === 0) return;
    const current = now();
    timer = setTimer(
      () => {
        timer = null;
        reconcile();
      },
      Math.min(millisecondsUntilNextRoutinePhaseBoundary(current), ROUTINE_PHASE_CLOCK_CHECK_MS),
    );
  };

  const reconcile = (forceBoundary = false): void => {
    const current = now();
    const nextClockIdentity = localClockIdentity(current);
    if (forceBoundary || nextClockIdentity !== lastClockIdentity) {
      // Publish the local-day/time-zone identity synchronously before a phase
      // listener can expose controls for the new clock.
      safelyReconcileBoundary();
    }
    lastClockIdentity = nextClockIdentity;
    const nextPhase = currentRoutineType(current);
    if (nextPhase !== lastPhase) {
      lastPhase = nextPhase;
      for (const listener of listeners) listener();
    }
    scheduleNextBoundary();
  };

  const stopAppStateSubscription = () => {
    appStateSubscription?.remove();
    appStateSubscription = null;
  };

  const startAppStateSubscription = () => {
    if (!appState || appStateSubscription || listeners.size === 0) return;
    active = appState.currentState !== 'background' && appState.currentState !== 'inactive';
    appStateSubscription = appState.addEventListener('change', (state) => {
      active = state === 'active';
      if (active) reconcile(true);
      else clearScheduledBoundary();
    });
    if (!active) clearScheduledBoundary();
  };

  return {
    getSnapshot: () => currentRoutineType(now()),
    attachAppState(nextAppState: RoutinePhaseAppStateSource) {
      if (appState === nextAppState) return;
      stopAppStateSubscription();
      appState = nextAppState;
      startAppStateSubscription();
      if (active) reconcile(true);
    },
    reconcile,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      if (listeners.size === 1) {
        const current = now();
        lastClockIdentity = localClockIdentity(current);
        lastPhase = currentRoutineType(current);
        safelyReconcileBoundary();
        startAppStateSubscription();
        scheduleNextBoundary();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          clearScheduledBoundary();
          stopAppStateSubscription();
        }
      };
    },
  };
}

const routinePhaseStore = createRoutinePhaseStore({
  reconcileBoundary: reconcileLocalDateBoundarySnapshot,
});
let routinePhaseAppStatePromise: Promise<RoutinePhaseAppStateSource | null> | null = null;

function loadRoutinePhaseAppState(): Promise<RoutinePhaseAppStateSource | null> {
  routinePhaseAppStatePromise ??= import('react-native')
    .then(({ AppState }) => AppState as RoutinePhaseAppStateSource)
    .catch(() => null);
  return routinePhaseAppStatePromise;
}

/** Reactive local routine phase shared by a mounted Today route. */
export function currentRoutineTypeForBoundary(
  boundary: LocalDateBoundaryIdentity,
  now = new Date(),
): TodayRoutinePhase | null {
  const clockBoundary = readLocalDateBoundaryIdentity(now);
  if (
    clockBoundary.localDate !== boundary.localDate ||
    clockBoundary.timeZone !== boundary.timeZone
  ) {
    return null;
  }
  return currentRoutineType(now);
}

export function useCurrentRoutineType(
  boundary: LocalDateBoundaryIdentity,
): TodayRoutinePhase | null {
  const observedPhase = useSyncExternalStore(
    routinePhaseStore.subscribe,
    routinePhaseStore.getSnapshot,
    routinePhaseStore.getSnapshot,
  );

  useEffect(() => {
    // The shared local-date observer detects resume and time-zone changes. Its
    // identity change reschedules this phase timer against the corrected clock.
    routinePhaseStore.reconcile();
  }, [boundary?.localDate, boundary?.timeZone]);

  useEffect(() => {
    let mounted = true;
    void loadRoutinePhaseAppState().then((appState) => {
      if (mounted && appState) routinePhaseStore.attachAppState(appState);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Read date and phase from one Date instance. If the global boundary has not
  // caught up yet, withhold routine controls instead of writing the new phase
  // into the previous local day's completion key.
  void observedPhase;
  return currentRoutineTypeForBoundary(boundary);
}

/** Local clock label for user-visible routine headers. */
export function localClockLabel(d = new Date()): string {
  const hour = d.getHours();
  const hour12 = hour % 12 || 12;
  const minute = String(d.getMinutes()).padStart(2, '0');
  const meridiem = hour < 12 ? 'AM' : 'PM';
  return `${hour12}:${minute} ${meridiem}`;
}
