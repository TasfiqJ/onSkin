import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { classifyRole } from '@/features/routine/sequencing';
import { useProfileBits } from '@/features/scheduler/profile';
import type { ShelfProduct } from '@/features/shelf/store';
import { useShelf } from '@/features/shelf/useShelf';

import { recommend, type RecResult, type RecShelfItem } from './engine';
import { isRecommendationDataLoading } from './loading';
import { DEFAULT_PREFERENCES } from './preferences';
import { loadDismissed, loadPreferences } from './store';

// The recommendation data layer (docs/09 §5/§12). Assembles the engine's inputs
// from the user's REAL state. The live shelf + its conflicts (useShelf), the shared
// skin profile (useProfileBits), and the local-first preferences/dismissals. Then
// runs the pure, tested engine. Works offline / before the backend exists
// (B-SUPABASE): every input is local-first. *** No commercial input anywhere. ***

const EMPTY: RecResult = { recommendations: [], youreSet: false };

function isFragranced(p: ShelfProduct): boolean {
  return [p.name, ...p.ingredients].some((t) => /fragrance|parfum|perfume/i.test(t));
}

export function useRecommendations() {
  const shelf = useShelf();
  const profile = useProfileBits();
  const prefsQ = useQuery({
    queryKey: ['recPrefsAndDismissed'],
    queryFn: async () => ({ prefs: await loadPreferences(), dismissed: await loadDismissed() }),
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
          fragranced: isFragranced(i.product),
          expiring: i.badge.kind === 'countdown' || i.badge.kind === 'expired',
        },
      ];
    });
    return recommend({
      profile: profile.data,
      shelf: items,
      conflicts: shelf.data.conflicts,
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
