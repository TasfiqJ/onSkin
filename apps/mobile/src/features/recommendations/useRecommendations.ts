import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { classifyRole } from '@/features/routine/sequencing';
import { useProfileBits } from '@/features/scheduler/profile';
import { useShelf } from '@/features/shelf/useShelf';
import { runCurrentHealthDataOperation } from '@/lib/consent/healthDataWriteAdmission';

import { recommend, type RecReplenishmentItem, type RecResult, type RecShelfItem } from './engine';
import { hasExplicitFragranceMarker } from './fragrance';
import { isRecommendationDataLoading, isRecommendationDataUnavailable } from './loading';
import { collectReplenishmentCandidates } from './replenishment';
import { loadDismissed, loadPreferences } from './store';

// The recommendation data layer (docs/09 §5/§12). Assembles the engine's inputs
// from the user's REAL state. The live shelf + its conflicts (useShelf), the shared
// skin profile (useProfileBits), and the local-first preferences/dismissals. Then
// runs the pure, tested engine. Works offline / before the backend exists
// (B-SUPABASE): every input is local-first. *** No commercial input anywhere. ***

const EMPTY: RecResult = {
  recommendations: [],
  youreSet: false,
  goalReviewPending: false,
  conflictCoverageStatus: 'unsupported_unreviewed',
};

async function loadRecommendationStateForCurrentHealthLease() {
  return runCurrentHealthDataOperation(async (lease) => {
    lease.assertCurrent();
    const [prefs, dismissed] = await Promise.all([loadPreferences(), loadDismissed()]);
    lease.assertCurrent();
    return { prefs, dismissed };
  });
}

export function useRecommendations() {
  const shelf = useShelf();
  const profile = useProfileBits();
  const prefsQ = useQuery({
    queryKey: ['recPrefsAndDismissed'],
    queryFn: loadRecommendationStateForCurrentHealthLease,
  });
  const isUnavailable = isRecommendationDataUnavailable({
    shelfError: shelf.isError,
    profileError: profile.isError,
    prefsError: prefsQ.isError,
    profileSource: profile.data?.source ?? null,
    consentCurrent: profile.data?.consentCurrent ?? null,
  });

  const result = useMemo<RecResult>(() => {
    if (!shelf.data || !profile.data || !prefsQ.data || isUnavailable) return EMPTY;
    const items: RecShelfItem[] = shelf.data.items.flatMap((i) => {
      const role = classifyRole({ ...i.engineProduct, category: i.category });
      if (!role) return [];
      return [
        {
          id: i.id,
          name: i.name,
          role,
          tags: i.engineProduct.tags,
          concentration: i.engineProduct.concentration,
          applicabilityFacts: i.engineProduct.applicabilityFacts,
          fragranced: hasExplicitFragranceMarker(i.product),
        },
      ];
    });
    const replenishment: RecReplenishmentItem[] = collectReplenishmentCandidates(shelf.data).map(
      ({ item, reason }) => ({
        id: item.id,
        name: item.name,
        tags: item.engineProduct.tags,
        concentration: item.engineProduct.concentration,
        applicabilityFacts: item.engineProduct.applicabilityFacts,
        reason,
      }),
    );
    return recommend({
      profile: {
        ...profile.data,
        reproductiveStatus: profile.data.pregnancyStatus,
        consentCurrent: profile.data.consentCurrent,
        goalProvenance: profile.data.goalProvenance,
      },
      shelf: items,
      replenishment,
      conflicts: shelf.data.unresolvedConflicts,
      conflictCoverageStatus: shelf.data.conflictCoverageStatus,
      preferences: prefsQ.data.prefs,
      dismissed: new Set(prefsQ.data.dismissed),
    });
  }, [isUnavailable, shelf.data, profile.data, prefsQ.data]);

  return {
    result,
    isUnavailable,
    isLoading: isRecommendationDataLoading({
      shelfLoading: shelf.isLoading,
      profileLoading: profile.isLoading,
      prefsLoading: prefsQ.isLoading,
    }),
  };
}
