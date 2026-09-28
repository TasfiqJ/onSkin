import type { ProfileBits } from '@/features/scheduler/profile';

import type { RoutineGenerationProfile } from './generate';

export function routineGenerationProfileForRealShelf(
  profile: ProfileBits | undefined,
): RoutineGenerationProfile | null {
  if (!profile || profile.source === 'unavailable') return null;
  return {
    sensitivity: profile.sensitivity,
    pregnancy: profile.pregnancy,
    reproductiveStatus: profile.pregnancyStatus,
    pregnancySafety: profile.pregnancySafety,
    pregnancyStatus: profile.pregnancyStatus,
    goals: profile.goals,
  };
}
