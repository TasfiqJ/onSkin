import { useQuery } from '@tanstack/react-query';

import { localDateString } from '@/features/today/useToday';
import { supabase } from '@/lib/supabase/client';

// Calm, forgiving progress data (docs/03 §6/§9.5, D-025): weekly adherence + a
// month heat-map + a grace-day "Streak protected" state. No all-or-nothing
// counter. Reads the append-only routine_completions log + the cached streak.

export type DayState = 'done' | 'missed' | 'today' | 'future';
export type WeekDay = { label: string; state: DayState };
export type HeatCell = { intensity: 0 | 1 | 2 | 3 }; // 0 empty/future … 3 done

export type ProgressData = {
  streak: number;
  longest: number;
  weeklyDone: number; // nights done in the last 7
  week: WeekDay[]; // 7 days, Mon→Sun
  monthLabel: string;
  heat: HeatCell[]; // current-month days
  graceUsed: boolean; // a forgiven miss in the last 7 days while the streak holds
};

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // getDay() 0=Sun

function ymd(d: Date): string {
  return localDateString(d);
}

export function useProgress() {
  const todayISO = localDateString();

  return useQuery<ProgressData>({
    queryKey: ['progress', todayISO],
    retry: 1,
    queryFn: async () => {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      const { data: completions } = await supabase
        .from('routine_completions')
        .select('completed_date')
        .gte('completed_date', ymd(monthStart));
      const countByDate = new Map<string, number>();
      for (const c of completions ?? []) {
        countByDate.set(c.completed_date, (countByDate.get(c.completed_date) ?? 0) + 1);
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('current_streak, longest_streak')
        .limit(1)
        .maybeSingle();

      // Last 7 days (Mon→Sun of the current week).
      const week: WeekDay[] = [];
      let weeklyDone = 0;
      const dow = (today.getDay() + 6) % 7; // 0=Mon
      const monday = new Date(today);
      monday.setDate(today.getDate() - dow);
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const iso = ymd(d);
        const done = (countByDate.get(iso) ?? 0) > 0;
        let state: DayState = 'future';
        if (iso === todayISO) state = 'today';
        else if (d < today) state = done ? 'done' : 'missed';
        if (done) weeklyDone += 1;
        week.push({ label: DAY_LETTERS[d.getDay()]!, state });
      }
      const graceUsed = week.some((d) => d.state === 'missed') && (profile?.current_streak ?? 0) > 0;

      // Month heat-map: one cell per day of the month, intensity by completions.
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const heat: HeatCell[] = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(today.getFullYear(), today.getMonth(), day);
        if (d > today) {
          heat.push({ intensity: 0 });
          continue;
        }
        const n = countByDate.get(ymd(d)) ?? 0;
        heat.push({ intensity: (n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : 3) as HeatCell['intensity'] });
      }

      return {
        streak: profile?.current_streak ?? 0,
        longest: profile?.longest_streak ?? 0,
        weeklyDone,
        week,
        monthLabel: today.toLocaleDateString('en-US', { month: 'long' }),
        heat,
        graceUsed,
      };
    },
  });
}
