import type { GoalId } from '@onskin/types';
import { useQuery } from '@tanstack/react-query';

import type { SensitivityLevel } from '@/features/intelligence/engine';
import { supabase } from '@/lib/supabase/client';

// The skin-profile bits the scheduler + plan generator need (sensitivity,
// pregnancy, goals). Shared so the cycle, the routine plan, and Today all honour
// the SAME profile. Critical for safety (pregnancy → retinoid suppressed must be
// reflected everywhere, not just in one surface). Guarded for offline / no-DB.
export type ProfileBits = { sensitivity: SensitivityLevel; pregnancy: boolean; goals: GoalId[] };

const NEUTRAL: ProfileBits = { sensitivity: 'neutral', pregnancy: false, goals: [] };

export async function readProfileBits(): Promise<ProfileBits> {
  try {
    const { data } = await supabase
      .from('skin_profiles')
      .select('sensitive_resistant, pregnancy_status, goals')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      const s = data.sensitive_resistant ?? 0;
      return {
        sensitivity: s === 0 ? 'neutral' : s > 0 ? 'sensitive' : 'resistant',
        pregnancy: data.pregnancy_status === 'pregnant' || data.pregnancy_status === 'breastfeeding',
        goals: (data.goals ?? []) as GoalId[],
      };
    }
  } catch {
    /* offline / no DB */
  }
  return NEUTRAL;
}

export function useProfileBits() {
  return useQuery({ queryKey: ['skinProfileBits'], queryFn: readProfileBits });
}
