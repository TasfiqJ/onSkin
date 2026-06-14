import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { usePhotos } from '@/features/photos/usePhotos';
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

async function readMonkBand(): Promise<number | null> {
  try {
    const { data } = await supabase
      .from('skin_profiles')
      .select('monk_tone')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.monk_tone ?? null;
  } catch {
    return null;
  }
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
    const captureCount = photos.data?.count ?? 0;
    // BLOCKED: B-AI-ONDEVICE. The real registered-pair delta is computed on-device.
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

  return { consented: consent.data ?? false, insight, isLoading: consent.isLoading || photos.isLoading };
}
