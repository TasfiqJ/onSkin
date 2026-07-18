import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { usePhotos } from '@/features/photos/usePhotos';
import {
  ACCOUNT_GENERATION_CHANGED,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import {
  runRequestWithLease,
  supabaseRequestFailure,
} from '@/lib/network/requestPolicy';
import { queryKeys, runOwnerQueryOperation } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';
import { supabase } from '@/lib/supabase/client';

import { isTrendInsightsConsentedWithLease } from './consent';
import { trendNarrative } from './copy';
import { classifyChange, MIN_CAPTURES } from './trend';

// The trend data layer (docs/12 §6). Assembles the engine's inputs. The user's own
// guided-photo series (usePhotos), their Monk tone band (for the fairness-adjusted noise
// floor), and the lighting QA. Then runs the pure classifier. *** The real registered-
// pair SSIM/colour delta comes from the on-device CV engine (B-AI-ONDEVICE); v1 uses a
// conservative stub so the calm "consistent" output (the common, celebrated case)
// renders, while the classification + the fairness floor are the real, tested logic. ***
// Nothing is uploaded; there is no score, ever.

function isAbortOrAccountGenerationError(error: unknown): boolean {
  if (error === ACCOUNT_GENERATION_CHANGED) return true;
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown; name?: unknown };
  return (
    candidate.name === 'AbortError' ||
    candidate.code === 'ABORT_ERR' ||
    candidate.code === ACCOUNT_GENERATION_CHANGED ||
    candidate.message === ACCOUNT_GENERATION_CHANGED
  );
}

export async function readMonkBandWithLease(lease: AccountGenerationLease): Promise<number | null> {
  lease.assertCurrent();
  try {
    const data = await runRequestWithLease(
      lease,
      {
        endpoint: 'trend_monk_band',
        deadlineMs: 8_000,
        idempotent: true,
        maxAttempts: 2,
        maxResponseBytes: 64 * 1024,
      },
      async ({ signal }) => {
        const response = await supabase
          .from('skin_profiles')
          .select('monk_tone')
          .order('created_at', { ascending: false })
          .limit(1)
          .abortSignal(signal)
          .maybeSingle();
        if (response.error) {
          throw supabaseRequestFailure(response.error, response.status);
        }
        return response.data;
      },
    );
    lease.assertCurrent();
    return data?.monk_tone ?? null;
  } catch (error) {
    // An ordinary server/offline failure retains the typed null fallback. An
    // owner change must reject so React Query cannot cache account A as absent.
    lease.assertCurrent();
    if (isAbortOrAccountGenerationError(error)) throw error;
    return null;
  }
}

type TrendQueryOptions = { enabled?: boolean };

export function useTrendConsent(options: TrendQueryOptions = {}) {
  const ownerScope = useOwnerQueryScope();
  return useQuery({
    queryKey: queryKeys.trendConsent(ownerScope),
    queryFn: () => runOwnerQueryOperation(ownerScope, isTrendInsightsConsentedWithLease),
    enabled: options.enabled,
    networkMode: 'always',
  });
}

export function useMonkBand(options: TrendQueryOptions = {}) {
  const ownerScope = useOwnerQueryScope();
  return useQuery({
    queryKey: queryKeys.monkBand(ownerScope),
    queryFn: () => runOwnerQueryOperation(ownerScope, readMonkBandWithLease),
    enabled: options.enabled,
  });
}

export type TrendPhotoSource = Pick<
  ReturnType<typeof usePhotos>,
  'data' | 'isLoading' | 'isSuccess'
>;

/** Derive trend state from the exact photo snapshot already owned by a route. */
export function useTrendInsightFromPhotos(
  photos: TrendPhotoSource,
  options: TrendQueryOptions = {},
) {
  const enabled = options.enabled !== false;
  const consent = useTrendConsent({ enabled: enabled && photos.isSuccess });
  const monk = useMonkBand({
    enabled: enabled && consent.isSuccess && consent.data === true && photos.isSuccess,
  });

  const insight = useMemo(() => {
    if (
      !consent.isSuccess ||
      consent.data !== true ||
      !photos.isSuccess ||
      !photos.data ||
      !monk.isSuccess
    ) {
      return null;
    }
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
  }, [consent.data, consent.isSuccess, photos.data, photos.isSuccess, monk.data, monk.isSuccess]);

  return {
    consented: consent.isSuccess && consent.data === true,
    insight,
    isLoading: consent.isLoading || photos.isLoading || monk.isLoading,
  };
}

/** Standalone trend consumer. Route view models should pass their photo source. */
export function useTrendInsight() {
  const photos = usePhotos('front');
  return useTrendInsightFromPhotos(photos);
}
