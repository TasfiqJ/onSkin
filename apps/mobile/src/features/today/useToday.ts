import type { RoutineType } from '@onskin/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { track } from '@/lib/analytics/track';
import { supabase } from '@/lib/supabase/client';

export type TodayStep = {
  id: string;
  name: string;
  instruction: string | null;
  cyclingNight: number | null;
  done: boolean;
};

export type TodayData = {
  routineId: string | null;
  type: RoutineType;
  steps: TodayStep[];
  streak: number;
};

/** Local calendar date as YYYY-MM-DD (the user's day — see DECISIONS D-012). */
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

function stepName(step: {
  manual_name: string | null;
  manual_brand: string | null;
}): string {
  return step.manual_name ?? 'Step';
}

export function useToday() {
  const type = currentRoutineType();
  const today = localDateString();

  return useQuery<TodayData>({
    queryKey: ['today', type, today],
    queryFn: async () => {
      const empty: TodayData = { routineId: null, type, steps: [], streak: 0 };

      const { data: routine } = await supabase
        .from('routines')
        .select('id')
        .eq('type', type)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      const { data: profile } = await supabase
        .from('profiles')
        .select('current_streak')
        .limit(1)
        .maybeSingle();
      const streak = profile?.current_streak ?? 0;

      if (!routine) return { ...empty, streak };

      const { data: steps } = await supabase
        .from('routine_steps')
        .select('id, step_order, instructions, cycling_night, user_product_id')
        .eq('routine_id', routine.id)
        .order('step_order', { ascending: true });

      const { data: completions } = await supabase
        .from('routine_completions')
        .select('step_id')
        .eq('completed_date', today);
      const doneSet = new Set((completions ?? []).map((c) => c.step_id));

      // Resolve product names for steps that reference a user_product.
      const productIds = (steps ?? []).map((s) => s.user_product_id).filter((id): id is string => !!id);
      const nameById = new Map<string, string>();
      if (productIds.length) {
        const { data: products } = await supabase
          .from('user_products')
          .select('id, manual_name, manual_brand')
          .in('id', productIds);
        for (const p of products ?? []) nameById.set(p.id, stepName(p));
      }

      const todaySteps: TodayStep[] = (steps ?? []).map((s) => ({
        id: s.id,
        name: s.user_product_id ? (nameById.get(s.user_product_id) ?? 'Step') : 'Step',
        instruction: s.instructions,
        cyclingNight: s.cycling_night,
        done: doneSet.has(s.id),
      }));

      return { routineId: routine.id, type, steps: todaySteps, streak };
    },
    // Resilient before the backend is configured (B-SUPABASE): empty rather than error.
    retry: 1,
  });
}

export function useToggleStep() {
  const qc = useQueryClient();
  const type = currentRoutineType();
  const today = localDateString();
  const key = ['today', type, today];

  return useMutation({
    mutationFn: async ({ routineId, stepId }: { routineId: string; stepId: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('not signed in');
      // Append-only insert; server sets source + caps backfill (migration 0007).
      const { error } = await supabase.from('routine_completions').insert({
        user_id: userId,
        routine_id: routineId,
        step_id: stepId,
        completed_date: today,
      });
      if (error) throw error;
    },
    // Optimistic check-off (docs/01 §6) — bathroom check-offs feel instant.
    onMutate: async ({ stepId }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TodayData>(key);
      if (prev) {
        qc.setQueryData<TodayData>(key, {
          ...prev,
          steps: prev.steps.map((s) => (s.id === stepId ? { ...s, done: true } : s)),
        });
      }
      track('first_checkoff_completed', { step_id: stepId });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key });
    },
  });
}
