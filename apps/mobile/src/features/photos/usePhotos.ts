import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PhotoSeries } from '@onskin/types';

import {
  defaultComparePair,
  detectMilestones,
  forSeries,
  groupByMonth,
  metadataLine,
  referenceFor,
} from './timeline';
import { localDay } from './date';
import { addPhoto, loadPhotos, removePhoto, setReference, updatePhoto, type NewPhoto, type PhotoRecord } from './store';

// Reads the local-first photo store (docs/06 §6) and derives the Progress-tab
// surfaces via the pure, tested timeline helpers. Resilient before the backend
// exists (B-SUPABASE). The store is on-device AsyncStorage.

const KEY = ['photos'] as const;

export function usePhotos(series: PhotoSeries = 'front') {
  const todayYmd = localDay();
  return useQuery({
    queryKey: [...KEY, series, todayYmd],
    queryFn: async () => {
      const photos = await loadPhotos();
      const inSeries = forSeries(photos, series);
      return {
        all: photos,
        series: inSeries,
        count: photos.length,
        metadata: metadataLine(photos),
        comparePair: defaultComparePair(photos, { series }),
        monthGroups: groupByMonth(photos, series, todayYmd),
        milestones: detectMilestones(photos, series),
        reference: referenceFor(photos, series),
      };
    },
    retry: 0,
  });
}

export function usePhotoActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const add = useMutation({
    mutationFn: (input: NewPhoto) => addPhoto(input),
    onSettled: invalidate,
  });
  const reference = useMutation({
    mutationFn: (id: string) => setReference(id),
    onSettled: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => removePhoto(id),
    onSettled: invalidate,
  });
  const note = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => updatePhoto(id, { notes }),
    onSettled: invalidate,
  });

  return { add, reference, remove, note };
}

export type { PhotoRecord };
