import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { classifyRole } from '@/features/routine/sequencing';
import { useProfileBits } from '@/features/scheduler/profile';
import type { ShelfProduct } from '@/features/shelf/store';
import { useShelf } from '@/features/shelf/useShelf';
import { runCurrentHealthDataOperation } from '@/lib/consent/healthDataWriteAdmission';

import { recommend, type RecReplenishmentItem, type RecResult, type RecShelfItem } from './engine';
import { isRecommendationDataLoading } from './loading';
import { DEFAULT_PREFERENCES } from './preferences';
import { collectReplenishmentCandidates } from './replenishment';
import { loadDismissed, loadPreferences } from './store';

// The recommendation data layer (docs/09 §5/§12). Assembles the engine's inputs
// from the user's REAL state. The live shelf + its conflicts (useShelf), the shared
// skin profile (useProfileBits), and the local-first preferences/dismissals. Then
// runs the pure, tested engine. Works offline / before the backend exists
// (B-SUPABASE): every input is local-first. *** No commercial input anywhere. ***

const EMPTY: RecResult = { recommendations: [], youreSet: false };

async function loadRecommendationStateForCurrentHealthLease() {
  return runCurrentHealthDataOperation(async (lease) => {
    lease.assertCurrent();
    const [prefs, dismissed] = await Promise.all([loadPreferences(), loadDismissed()]);
    lease.assertCurrent();
    return { prefs, dismissed };
  });
}

function isFragranced(p: ShelfProduct): boolean {
  return [p.name, ...p.ingredients].some((t) => /fragrance|parfum|perfume/i.test(t));
}

export function useRecommendations() {
  const shelf = useShelf();
  const profile = useProfileBits();
  const prefsQ = useQuery({
    queryKey: ['recPrefsAndDismissed'],
    queryFn: loadRecommendationStateForCurrentHealthLease,
  });

  const result = useMemo<RecResult>(() => {
    if (!shelf.data || !profile.data) return EMPTY;
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
          fragranced: isFragranced(i.product),
        },
      ];
    });
    const replenishment: RecReplenishmentItem[] = collectReplenishmentCandidates(shelf.data).map(
      ({ item, reason }) => ({
        id: item.id,
        name: item.name,
        tags: item.engineProduct.tags,
        concentration: item.engineProduct.concentration,
        reason,
      }),
    );
    return recommend({
      profile: profile.data,
      shelf: items,
      replenishment,
      conflicts: shelf.data.unresolvedConflicts,
      preferences: prefsQ.data?.prefs ?? DEFAULT_PREFERENCES,
      dismissed: new Set(prefsQ.data?.dismissed ?? []),
    });
  }, [shelf.data, profile.data, prefsQ.data]);

  return {
    result,
    isLoading: isRecommendationDataLoading({
      shelfLoading: shelf.isLoading,
      profileLoading: profile.isLoading,
      prefsLoading: prefsQ.isLoading,
    }),
  };
}
