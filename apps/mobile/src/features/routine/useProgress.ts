import { useQuery } from '@tanstack/react-query';

import {
  bestStreak,
  buildWeek,
  monthHeat,
  streakState,
  weeklyDone,
  type HeatCell,
  type WeekDay,
} from '@/features/streak/streak';
import { getCompletionSummary } from '@/features/today/completionsStore';
import { useRoutineClock } from '@/features/today/useRoutineClock';
import { localDateString } from '@/features/today/useToday';
import {
  HEALTH_DATA_WRITE_ADMISSION_CLOSED,
  runHealthDataWriteOperation,
  type HealthDataWriteOperationLease,
} from '@/lib/consent/healthDataWriteAdmission';
import { activeHealthProcessingOwnerUserId } from '@/lib/consent/healthProcessingEpoch';
import { isSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase/client';

import { normalizeProgressCompletionDate, normalizeProgressCount } from './progressSanitizers';

// Calm, forgiving progress data (docs/03 §6 + docs/07 §4): weekly adherence, a
// month heat-map, and the freeze-aware streak. The streak/freeze logic lives in the
// pure, tested `features/streak/streak.ts`; this hook loads the completion log and
// then delegates. The local-first completionsStore (the Today check-off writes there)
// is the current source of truth. Only explicit server routine-level rows (`step_id`
// null) are unioned for eventual sync; individual step rows never qualify a night.
// The currently strict server cached streak is intentionally not trusted until its
// forgiveness migration and parity evidence land. Empty completions yield a calm
// zero state, not an error.

export type { WeekDay, HeatCell } from '@/features/streak/streak';
export type DayState = WeekDay['state'];

export type ProgressData = {
  streak: number;
  longest: number;
  weeklyDone: number;
  week: WeekDay[];
  monthLabel: string;
  heat: HeatCell[];
  graceUsed: boolean; // a freeze is currently absorbing a recent miss (streak safe)
  lapsed: boolean; // the streak lapsed past the forgiveness window (earn-back)
  frozenDates: string[];
};

type ServerCompletion = { completed_date: string };

async function loadServerCompletions(
  lease: HealthDataWriteOperationLease,
): Promise<ServerCompletion[]> {
  if (!isSupabaseConfigured) return [];
  try {
    lease.assertCurrent();
    const { data } = await supabase
      .from('routine_completions')
      .select('completed_date')
      .is('step_id', null);
    lease.assertCurrent();
    return (data ?? [])
      .map((completion) => normalizeProgressCompletionDate(completion.completed_date))
      .filter((completedDate): completedDate is string => Boolean(completedDate))
      .map((completedDate) => ({ completed_date: completedDate }));
  } catch {
    lease.assertCurrent();
    return [];
  }
}

export function useProgress() {
  const todayISO = useRoutineClock().localDate;

  return useQuery<ProgressData>({
    queryKey: ['progress', todayISO],
    retry: 1,
    queryFn: async () => {
      const expectedOwnerUserId = activeHealthProcessingOwnerUserId();
      if (!expectedOwnerUserId) throw new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED);
      return runHealthDataWriteOperation(expectedOwnerUserId, async (lease) => {
        const today = new Date();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const [localSummary, completions] = await Promise.all([
          getCompletionSummary(),
          loadServerCompletions(lease),
        ]);
        lease.assertCurrent();

        const countByDate = new Map<string, number>();
        const completed = new Set<string>();
        for (const c of completions) {
          const completedDate = normalizeProgressCompletionDate(c.completed_date);
          if (!completedDate || completedDate > todayISO) continue;
          completed.add(completedDate);
          countByDate.set(completedDate, (countByDate.get(completedDate) ?? 0) + 1);
        }
        // Union the local-first store (the v1 source of truth) so on-device check-offs
        // drive the streak/heat-map even before the backend exists. Same date in both
        // sources represents the same completions, so take the max (never double-count).
        for (const d of localSummary.completedDates) {
          const completedDate = normalizeProgressCompletionDate(d);
          if (completedDate && completedDate <= todayISO) completed.add(completedDate);
        }
        for (const [d, n] of localSummary.countByDate) {
          const completedDate = normalizeProgressCompletionDate(d);
          const count = normalizeProgressCount(n);
          if (completedDate && completedDate <= todayISO && count > 0) {
            countByDate.set(completedDate, Math.max(countByDate.get(completedDate) ?? 0, count));
          }
        }

        // The freeze state is computed deterministically from the completion gaps
        // (streak.ts), which is the v1 source of truth and recomputes identically on
        // every device. The server `streak_freezes` ledger (docs/07 §4.4/§7) is the
        // deferred sync/audit target for the server `recompute_streak` function
        // (B-SUPABASE); it is intentionally not read/written by the client in v1.
        const s = streakState(completed, todayISO);
        const frozen = new Set(s.frozenDates);
        const week = buildWeek(completed, todayISO, frozen);
        // Heat-map only needs the current month's counts.
        const monthCounts = new Map<string, number>();
        for (const [date, n] of countByDate)
          if (date >= localDateString(monthStart)) monthCounts.set(date, n);

        const longest = Math.max(bestStreak(completed, undefined, todayISO), s.current);

        lease.assertCurrent();
        return {
          streak: s.current,
          longest,
          weeklyDone: weeklyDone(week),
          week,
          monthLabel: today.toLocaleDateString('en-US', { month: 'long' }),
          heat: monthHeat(monthCounts, todayISO),
          graceUsed: s.freezeActive,
          lapsed: s.lapsed,
          frozenDates: s.frozenDates,
        };
      });
    },
  });
}
