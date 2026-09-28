import type { GoalId, PregnancyStatus } from '@layerwell/types';
import { useQuery } from '@tanstack/react-query';

import type { SensitivityLevel } from '@/features/intelligence/engine';
import {
  pregnancySafetyModeForStatus,
  type PregnancySafetyMode,
  type PregnancySafetyStatus,
} from '@/features/intelligence/pregnancySafety';
import {
  readStoredSkinProfile,
  updateStoredPregnancyStatus,
  type StoredSkinProfile,
} from '@/features/onboarding/skinProfileStore';
import {
  currentGoalRecommendationProvenance,
  type GoalRecommendationProvenance,
} from '@/features/recommendations/goalProvenance';
import {
  applyCurrentServerSkinProfileFilters,
  CURRENT_SERVER_SKIN_PROFILE_SELECT,
  isServerSkinProfileFallbackPermitted,
  parseCurrentServerSkinProfile,
} from '@/features/onboarding/serverSkinProfile';
import { hasCurrentHealthDataCollectionConsent } from '@/features/onboarding/healthConsentStore';
import {
  HEALTH_DATA_WRITE_ADMISSION_CLOSED,
  runHealthDataWriteOperation,
} from '@/lib/consent/healthDataWriteAdmission';
import { activeHealthProcessingOwnerUserId } from '@/lib/consent/healthProcessingEpoch';
import { isSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase/client';

import { moistureFromAxis, sensitivityFromAxis, type MoistureBalance } from './profileMapping';

// The skin-profile bits the scheduler + plan generator need (sensitivity,
// pregnancy, goals). Shared so the cycle, the routine plan, and Today all honour
// the SAME profile. Critical for safety (pregnancy → retinoid suppressed must be
// reflected everywhere, not just in one surface). Guarded for offline / no-DB.
export type ProfileBits = {
  source: 'local' | 'server' | 'unavailable';
  sensitivity: SensitivityLevel;
  moisture: MoistureBalance;
  pregnancyStatus: PregnancySafetyStatus;
  pregnancySafety: PregnancySafetyMode;
  /** True only for an affirmative pregnant/trying or breastfeeding answer. */
  pregnancy: boolean;
  consentCurrent: boolean;
  goals: GoalId[];
  /** Exact current quiz/profile tuple that authorized these runtime-validated goals. */
  goalProvenance?: GoalRecommendationProvenance | null;
};

const UNKNOWN_PROFILE: ProfileBits = {
  source: 'unavailable',
  sensitivity: 'neutral',
  moisture: 'balanced',
  pregnancyStatus: 'unknown',
  pregnancySafety: 'caution',
  pregnancy: false,
  consentCurrent: false,
  goals: [],
  goalProvenance: null,
};

function normalizePregnancyStatus(value: unknown): PregnancySafetyStatus {
  return value === 'none' ||
    value === 'pregnant' ||
    value === 'breastfeeding' ||
    value === 'prefer_not'
    ? value
    : 'unknown';
}

function pregnancyBits(status: PregnancySafetyStatus) {
  return {
    pregnancyStatus: status,
    pregnancySafety: pregnancySafetyModeForStatus(status),
    pregnancy: status === 'pregnant' || status === 'breastfeeding',
  };
}

function profileBitsFromStoredProfile(profile: StoredSkinProfile): ProfileBits {
  const status = normalizePregnancyStatus(profile.result.pregnancyStatus);
  return {
    source: 'local',
    sensitivity: sensitivityFromAxis(profile.result.axisScores.sensitive_resistant),
    moisture: moistureFromAxis(profile.result.axisScores.oily_dry),
    ...pregnancyBits(status),
    consentCurrent: true,
    goals: profile.goals,
    goalProvenance: currentGoalRecommendationProvenance({
      source: 'local_current_quiz',
      profileCompletedAt: profile.completedAt,
      goals: profile.goals,
    }),
  };
}

export async function readProfileBits(): Promise<ProfileBits> {
  const expectedOwnerUserId = activeHealthProcessingOwnerUserId();
  if (!expectedOwnerUserId) return UNKNOWN_PROFILE;
  return runHealthDataWriteOperation(expectedOwnerUserId, async (lease) => {
    const consentCurrent = await hasCurrentHealthDataCollectionConsent();
    lease.assertCurrent();
    if (!consentCurrent) return UNKNOWN_PROFILE;

    const local = await readStoredSkinProfile();
    lease.assertCurrent();
    if (local.status === 'available') return profileBitsFromStoredProfile(local.profile);

    // A private read/validation failure is not absence. Never consult a stale
    // server mirror after an authoritative local record becomes unreadable.
    if (!isServerSkinProfileFallbackPermitted(local.status)) {
      return { ...UNKNOWN_PROFILE, consentCurrent: true };
    }

    if (!isSupabaseConfigured) return { ...UNKNOWN_PROFILE, consentCurrent: true };

    try {
      lease.assertCurrent();
      const { data, error } = await applyCurrentServerSkinProfileFilters(
        supabase.from('skin_profiles').select(CURRENT_SERVER_SKIN_PROFILE_SELECT),
      )
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      lease.assertCurrent();
      if (!error) {
        const profile = parseCurrentServerSkinProfile(data);
        if (!profile) return { ...UNKNOWN_PROFILE, consentCurrent: true };
        return {
          source: 'server',
          sensitivity: sensitivityFromAxis(profile.sensitive_resistant),
          moisture: moistureFromAxis(profile.oily_dry),
          // Pregnancy edits remain device-authoritative. A server-only row may
          // be stale, so even an otherwise exact v2 profile cannot clear the
          // scheduler's conservative safety posture.
          ...pregnancyBits('unknown'),
          consentCurrent: true,
          goals: profile.goals,
          goalProvenance: currentGoalRecommendationProvenance({
            source: 'server_current_quiz',
            profileCompletedAt: profile.completed_at,
            goals: profile.goals,
          }),
        };
      }
    } catch {
      lease.assertCurrent();
    }
    lease.assertCurrent();
    return { ...UNKNOWN_PROFILE, consentCurrent: true };
  });
}

/** Current profile updates are local-first; the server profile remains a fallback mirror. */
export async function savePregnancyStatus(status: PregnancyStatus): Promise<ProfileBits> {
  const expectedOwnerUserId = activeHealthProcessingOwnerUserId();
  if (!expectedOwnerUserId) throw new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED);
  return runHealthDataWriteOperation(expectedOwnerUserId, async (lease) => {
    if (!(await hasCurrentHealthDataCollectionConsent())) {
      throw new Error('CURRENT_HEALTH_CONSENT_REQUIRED');
    }
    lease.assertCurrent();
    const stored = await updateStoredPregnancyStatus(status);
    lease.assertCurrent();
    return profileBitsFromStoredProfile(stored);
  });
}

export function useProfileBits() {
  return useQuery({ queryKey: ['skinProfileBits'], queryFn: readProfileBits });
}
