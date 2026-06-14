// Pure calm, forgiving streak logic (docs/07 §4, implementing the D-021 philosophy
// docs/03 §6 set). A "completion day" is any day the user did their scheduled
// routine. And recovery nights count (they're completions like any other). The
// streak FORGIVES: up to `freezeWindow` missed days in the active run are absorbed
// by auto-applied freezes (never purchased), beyond which it resets. Because past
// that point the habit has lapsed and the streak must stay meaningful. `longest`
// is a non-decreasing personal best (D-011). All deterministic + unit-tested; the
// freeze logic is offline-safe and mirrors the server `recompute_streak` target.

export type DayState = 'done' | 'missed' | 'today' | 'future' | 'frozen';
export type WeekDay = { label: string; state: DayState };
export type HeatCell = { intensity: 0 | 1 | 2 | 3 };

export const DEFAULT_FREEZE_WINDOW = 2;
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // getDay() 0=Sun

function parse(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}
function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function addDays(ymd: string, n: number): string {
  const d = parse(ymd);
  d.setDate(d.getDate() + n);
  return fmt(d);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
}

export type StreakState = {
  current: number;
  freezeActive: boolean; // a recent miss is being absorbed by a freeze (streak safe)
  frozenDates: string[]; // the missed days the active run has absorbed
  lapsed: boolean; // the run broke (more misses than the window). Earn-back applies
};

/**
 * The current forgiving streak ending at/near `today`. Today being not-yet-done is
 * neutral (not a miss). Past missed days are absorbed up to `freezeWindow`; beyond
 * that the streak resets.
 */
export function streakState(
  completed: Set<string>,
  today: string,
  freezeWindow = DEFAULT_FREEZE_WINDOW,
): StreakState {
  let current = 0;
  let committedFreezes = 0;
  const frozen: string[] = [];
  // Freezes are only "committed" when a further-back completion proves the miss was
  // INTERIOR to the run. Trailing misses before the streak started are discarded,
  // so a clean run that simply ended is never reported as frozen.
  let pendingFreezes = 0;
  let pendingDates: string[] = [];
  for (let i = 0; i <= 730; i++) {
    const day = addDays(today, -i);
    if (completed.has(day)) {
      current += 1;
      committedFreezes += pendingFreezes;
      frozen.push(...pendingDates);
      pendingFreezes = 0;
      pendingDates = [];
      continue;
    }
    if (day === today) continue; // today not done yet. Neutral, don't break
    pendingFreezes += 1;
    pendingDates.push(day);
    if (committedFreezes + pendingFreezes > freezeWindow) break; // gap exceeds forgiveness
  }
  if (current === 0) {
    return { current: 0, freezeActive: false, frozenDates: [], lapsed: completed.size > 0 };
  }
  return { current, freezeActive: frozen.length > 0, frozenDates: frozen, lapsed: false };
}

/**
 * The best forgiving run over all history (the non-decreasing personal best, D-011
 *. Callers take greatest(priorBest, this)). Linear over the completion log.
 */
export function bestStreak(completed: Set<string>, freezeWindow = DEFAULT_FREEZE_WINDOW): number {
  const sorted = [...completed].sort();
  let best = 0;
  let run = 0;
  let freezes = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    if (prev === null) {
      run = 1;
      freezes = 0;
    } else {
      const gap = daysBetween(prev, d) - 1; // missed days strictly between
      if (gap === 0) run += 1;
      else if (freezes + gap <= freezeWindow) {
        freezes += gap;
        run += 1;
      } else {
        run = 1;
        freezes = 0;
      }
    }
    if (run > best) best = run;
    prev = d;
  }
  return best;
}

/** The Mon→Sun states for the current week (matches the Progress heat-map view). */
export function buildWeek(completed: Set<string>, todayISO: string, frozen: Set<string> = new Set()): WeekDay[] {
  const today = parse(todayISO);
  const dow = (today.getDay() + 6) % 7; // 0=Mon
  const monday = new Date(today);
  monday.setDate(today.getDate() - dow);
  const week: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = fmt(d);
    let state: DayState = 'future';
    if (iso === todayISO) state = 'today';
    else if (parse(iso) < parse(todayISO)) {
      state = completed.has(iso) ? 'done' : frozen.has(iso) ? 'frozen' : 'missed';
    }
    week.push({ label: DAY_LETTERS[d.getDay()]!, state });
  }
  return week;
}

export function weeklyDone(week: WeekDay[]): number {
  return week.filter((d) => d.state === 'done').length;
}

/** Per-day month heat-map intensity (0 empty/future … 3 done), by completion count. */
export function monthHeat(countByDate: Map<string, number>, todayISO: string): HeatCell[] {
  const today = parse(todayISO);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const heat: HeatCell[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = fmt(new Date(today.getFullYear(), today.getMonth(), day));
    if (parse(iso) > today) {
      heat.push({ intensity: 0 });
      continue;
    }
    const n = countByDate.get(iso) ?? 0;
    heat.push({ intensity: (n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : 3) as HeatCell['intensity'] });
  }
  return heat;
}
