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
import { localDateString } from '@/features/today/useToday';
import { supabase } from '@/lib/supabase/client';

// Calm, forgiving progress data (docs/03 §6 + docs/07 §4): weekly adherence, a
// month heat-map, and the freeze-aware streak. The streak/freeze logic lives in the
// pure, tested `features/streak/streak.ts`; this hook just loads the completion log
// and the cached personal best, then delegates. Resilient before the backend exists
// (B-SUPABASE). Empty completions yield a calm zero state, not an error.

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

export function useProgress() {
  const todayISO = localDateString();

  return useQuery<ProgressData>({
    queryKey: ['progress', todayISO],
    retry: 1,
    queryFn: async () => {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      // Look back far enough for the streak run (beyond the current month).
      const lookback = new Date(today.getTime() - 120 * 86_400_000);

      const { data: completions } = await supabase
        .from('routine_completions')
        .select('completed_date')
        .gte('completed_date', localDateString(lookback));

      const countByDate = new Map<string, number>();
      const completed = new Set<string>();
      for (const c of completions ?? []) {
        completed.add(c.completed_date);
        countByDate.set(c.completed_date, (countByDate.get(c.completed_date) ?? 0) + 1);
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('longest_streak')
        .limit(1)
        .maybeSingle();

      const s = streakState(completed, todayISO);
      const frozen = new Set(s.frozenDates);
      const week = buildWeek(completed, todayISO, frozen);
      // Heat-map only needs the current month's counts.
      const monthCounts = new Map<string, number>();
      for (const [date, n] of countByDate) if (date >= localDateString(monthStart)) monthCounts.set(date, n);

      // longest is a non-decreasing personal best (D-011): greatest(server best, computed).
      const longest = Math.max(profile?.longest_streak ?? 0, bestStreak(completed), s.current);

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
    },
  });
}
