import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  applyCurrentServerSkinProfileFilters,
  CURRENT_SERVER_SKIN_PROFILE_SELECT,
  isServerSkinProfileFallbackPermitted,
  parseCurrentServerSkinProfile,
} from '@/features/onboarding/serverSkinProfile';
import { readStoredSkinProfile } from '@/features/onboarding/skinProfileStore';
import { usePhotos } from '@/features/photos/usePhotos';
import { runHealthDataWriteOperation } from '@/lib/consent/healthDataWriteAdmission';
import { activeHealthProcessingOwnerUserId } from '@/lib/consent/healthProcessingEpoch';
import { isSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase/client';

import { isTrendInsightsConsented } from './consent';
import { trendNarrative } from './copy';
import { classifyChange, MIN_CAPTURES } from './trend';

// The trend data layer (docs/12 §6). Assembles the engine's inputs. The user's own
// guided-photo series (usePhotos), their Monk tone band (for the fairness-adjusted noise
// floor), and the lighting QA. Then runs the pure classifier. *** The real registered-
// pair SSIM/colour delta comes from the on-device CV engine (B-AI-ONDEVICE); v1 uses a
// conservative stub so the calm "consistent" output (the common, celebrated case)
// renders, while the classification + the fairness floor are the real, tested logic. ***
// Nothing is uploaded; there is no score, ever.

export async function readMonkBand(): Promise<number | null> {
  const expectedOwnerUserId = activeHealthProcessingOwnerUserId();
  if (!expectedOwnerUserId) return null;
  return runHealthDataWriteOperation(expectedOwnerUserId, async (lease) => {
    const local = await readStoredSkinProfile();
    lease.assertCurrent();
    if (local.status === 'available') return local.profile.result.monkTone;
    // A corrupt, unsupported, stale-policy, or unreadable device record is not
    // absence and cannot be bypassed by a potentially stale server mirror.
    if (!isServerSkinProfileFallbackPermitted(local.status) || !isSupabaseConfigured) return null;

    try {
      lease.assertCurrent();
      const { data, error } = await applyCurrentServerSkinProfileFilters(
        supabase.from('skin_profiles').select(CURRENT_SERVER_SKIN_PROFILE_SELECT),
      )
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      lease.assertCurrent();
      if (error) return null;
      return parseCurrentServerSkinProfile(data)?.monk_tone ?? null;
    } catch {
      lease.assertCurrent();
      return null;
    }
  });
}

export function useTrendConsent() {
  return useQuery({ queryKey: ['trendConsent'], queryFn: isTrendInsightsConsented });
}

export function useMonkBand() {
  return useQuery({ queryKey: ['monkBand'], queryFn: readMonkBand });
}

export function useTrendInsight() {
  const consent = useTrendConsent();
  const photos = usePhotos('front');
  const monk = useMonkBand();

  const insight = useMemo(() => {
    if (!consent.data) return null;
    // Count the FRONT series the trend actually narrates, not the cross-series
    // total (`count` = all angles). Using the total could tell a user their FRONT
    // texture "looked consistent over your last N captures" with N counting
    // left/right photos that have no front frame (docs/12 §6).
    const captureCount = photos.data?.series.length ?? 0;
    // BLOCKED: B-AI-ONDEVICE. The real registered-pair delta AND the lighting-QA
    // consistency check are both computed by the on-device CV engine. Until then
    // delta is a conservative stub and lighting is assumed consistent, so the
    // honest `inconclusive_lighting` state is unreachable in v1 by design (not a
    // dropped wire). It activates with the engine, alongside the real delta.
    const deltaMetric = captureCount >= MIN_CAPTURES ? 0.05 : null;
    const { changeState, mdcThreshold } = classifyChange({
      deltaMetric,
      captureCount,
      lightingConsistent: true,
      monkBand: monk.data ?? null,
    });
    return {
      changeState,
      mdcThreshold,
      narrative: trendNarrative(changeState, { n: captureCount }),
      monkBand: monk.data ?? null,
    };
  }, [consent.data, photos.data, monk.data]);

  return {
    consented: consent.data ?? false,
    insight,
    isLoading: consent.isLoading || photos.isLoading,
  };
}
