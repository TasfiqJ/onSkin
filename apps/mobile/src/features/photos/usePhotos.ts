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
import {
  addPhoto,
  loadPhotos,
  removePhoto,
  setReference,
  updatePhoto,
  type NewPhoto,
  type PhotoRecord,
} from './store';

// Reads the local-first photo store (docs/06 §6) and derives the Progress-tab
// surfaces via the pure, tested timeline helpers. Resilient before the backend
// exists (B-SUPABASE). The store is encrypted local private KV.

const KEY = ['photos'] as const;

function e2eProgressPhotoFixture(): PhotoRecord[] | null {
  if (process.env.EXPO_PUBLIC_E2E_PROGRESS_PHOTOS !== 'populated') return null;

  const base = {
    series: 'front' as const,
    timeOfDay: 'morning' as const,
    notes: null,
    captureSessionId: 'e2e-progress-compare-picker',
    headRoll: null,
    headYaw: null,
    headPitch: null,
    localOnly: true,
    storagePath: null,
    faceRegionRedacted: false,
    isEncrypted: false,
    encryptedLocalUri: null,
    thumbnailLocalUri: null,
    encryptionVersion: 'none',
    keyId: null,
    localUri: null,
  };

  return [
    {
      ...base,
      id: 'e2e-front-2026-04-01',
      takenLocalDate: '2026-04-01',
      takenAt: '2026-04-01T12:00:00.000Z',
      alignmentScore: 0.92,
      lightingScore: 0.88,
      isReference: true,
      referencePhotoId: null,
    },
    {
      ...base,
      id: 'e2e-front-2026-05-12',
      takenLocalDate: '2026-05-12',
      takenAt: '2026-05-12T12:00:00.000Z',
      alignmentScore: 0.9,
      lightingScore: 0.9,
      isReference: false,
      referencePhotoId: 'e2e-front-2026-04-01',
    },
    {
      ...base,
      id: 'e2e-front-2026-06-24',
      takenLocalDate: '2026-06-24',
      takenAt: '2026-06-24T12:00:00.000Z',
      alignmentScore: 0.94,
      lightingScore: 0.91,
      isReference: false,
      referencePhotoId: 'e2e-front-2026-04-01',
    },
  ];
}

export function usePhotos(series: PhotoSeries = 'front') {
  const todayYmd = localDay();
  return useQuery({
    queryKey: [...KEY, series, todayYmd],
    queryFn: async () => {
      const photos = e2eProgressPhotoFixture() ?? (await loadPhotos());
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
