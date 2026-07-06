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

function devRoutineTypeOverride(): RoutineType | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  const locationLike = (globalThis as { location?: { search?: string } }).location;
  if (!locationLike?.search || typeof URLSearchParams === 'undefined') return null;
  const requested = new URLSearchParams(locationLike.search).get('routine');
  return requested === 'AM' || requested === 'PM' ? requested : null;
}

/** AM before 5pm, PM after (design spec: morning check-off / evening cycling). */
export function currentRoutineType(d = new Date()): RoutineType {
  const override = devRoutineTypeOverride();
  if (override) return override;
  return d.getHours() < 17 ? 'AM' : 'PM';
}

/** Local clock label for user-visible routine headers. */
export function localClockLabel(d = new Date()): string {
  const hour = d.getHours();
  const hour12 = hour % 12 || 12;
  const minute = String(d.getMinutes()).padStart(2, '0');
  const meridiem = hour < 12 ? 'AM' : 'PM';
  return `${hour12}:${minute} ${meridiem}`;
}
