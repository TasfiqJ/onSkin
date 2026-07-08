import type { GoalId } from '@onskin/types';
import { useQuery } from '@tanstack/react-query';

import type { SensitivityLevel } from '@/features/intelligence/engine';
import {
  getStoredSkinProfile,
  type StoredSkinProfile,
} from '@/features/onboarding/skinProfileStore';
import { isSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase/client';

import { moistureFromAxis, sensitivityFromAxis, type MoistureBalance } from './profileMapping';

// The skin-profile bits the scheduler + plan generator need (sensitivity,
// pregnancy, goals). Shared so the cycle, the routine plan, and Today all honour
// the SAME profile. Critical for safety (pregnancy → retinoid suppressed must be
// reflected everywhere, not just in one surface). Guarded for offline / no-DB.
export type ProfileBits = {
  sensitivity: SensitivityLevel;
  moisture: MoistureBalance;
  pregnancy: boolean;
  goals: GoalId[];
};

const NEUTRAL: ProfileBits = {
  sensitivity: 'neutral',
  moisture: 'balanced',
  pregnancy: false,
  goals: [],
};

function profileBitsFromStoredProfile(profile: StoredSkinProfile): ProfileBits {
  return {
    sensitivity: sensitivityFromAxis(profile.result.axisScores.sensitive_resistant),
    moisture: moistureFromAxis(profile.result.axisScores.oily_dry),
    pregnancy:
      profile.result.pregnancyStatus === 'pregnant' ||
      profile.result.pregnancyStatus === 'breastfeeding',
    goals: profile.goals,
  };
}

export async function readProfileBits(): Promise<ProfileBits> {
  const local = await getStoredSkinProfile();
  if (local) return profileBitsFromStoredProfile(local);

  if (!isSupabaseConfigured) return NEUTRAL;

  try {
    const { data } = await supabase
      .from('skin_profiles')
      .select('oily_dry, sensitive_resistant, pregnancy_status, goals')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      return {
        sensitivity: sensitivityFromAxis(data.sensitive_resistant ?? null),
        moisture: moistureFromAxis(data.oily_dry ?? null),
        pregnancy:
          data.pregnancy_status === 'pregnant' || data.pregnancy_status === 'breastfeeding',
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
