import type { RoutineType } from '@onskin/types';

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

/** AM before 5pm, PM after (design spec: morning check-off / evening cycling). */
export function currentRoutineType(d = new Date()): RoutineType {
  return d.getHours() < 17 ? 'AM' : 'PM';
}
