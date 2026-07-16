import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';

import { PHOTO_SERIES, type PhotoSeries } from '@onskin/types';

import {
  useLocalDateBoundary,
  type LocalDateBoundaryIdentity,
} from '@/lib/query/localDateBoundaryStore';
import {
  isOwnerQueryScopeCurrent,
  LOCAL_DAY_QUERY_NAMESPACE,
  ownerQueryPrefixes,
  queryKeys,
  runOwnerQueryOperation,
  shouldRefetchCurrentLocalDayQuery,
  type OwnerQueryScope,
} from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';

import {
  defaultComparePair,
  detectMilestones,
  forSeries,
  groupByMonth,
  metadataLine,
  referenceFor,
} from './timeline';
import {
  addPhoto,
  loadPhotos,
  recoverPhotoStoreMutations,
  removePhoto,
  setReference,
  updatePhoto,
  type NewPhoto,
  type PhotoMutationCommit,
  type PhotoRecord,
} from './store';

// Reads the local-first photo store (docs/06 §6) and derives the Progress-tab
// surfaces via the pure, tested timeline helpers. Resilient before the backend
// exists (B-SUPABASE). The store is encrypted local private KV.

let e2eProgressStorageFailureConsumed = false;
const E2E_PROGRESS_PHOTO_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAABACAYAAABcIPRGAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAIiSURBVGhD7ZhRZxxRFMf3w4VS+hCthIq0osqWREMisaxGVldXVsNKdFlZViKJRMpqlRJC6UvpQ5V+nYl/2Brn7M7cc+4Z13Iefi9r5v7Pb2bunDNb+/f1LJtnavSHecMFUuMCqXGB1LhAalwgNZUJ/L4eZHeD7n9+XfTZMRaYCvz5PMzG3WbWefk0aywuMNqri9nV+50HOXquFjOBH8PDrPX8CSt6Gu+WH2dfPu6xNTSYCKAYWmQIJzt1tpaUaAFt8RMuW1tsTQlRAnhsaEEavvX22dqhqAX+jkczN6sU7B3txlYL3HxosEJiOG1usIwQVAK4+qFvnFCazx6p7oJKAM8sLcAC9AiaVYZK4NPbNRZuwcGrJZZVhkoAjYiGW4FuTvOKEAv8HPVYqCW3/Q7LLEIsgMGMhloiHTHEArGdtwzpRhYLYNqkoZZIRwuxQNV3oHIBbDIaaknle8BqgJvF9+M2yyxCLIAxAm2fBlsh/fQUC4DemxUWbAE+OWlWGSoBbDQaboHmC00lgKmxiscIXZ5mlaESAJjfaQExYECkGSGoBazvgubqA7UAsOrK53ubbO1QogTA0foLVpAEfAPg1UzXDSVaAOFaCRQvnf8p0QITMEXSAovAKzO2eGAmAIa7dVboNAbbr9m5WkwFQhucdOIswgXyuIACF8jjAgpcII8LKHCBPC6gwAXy4K93FFcGjqPnajEVSIELpMYFUuMCqbkHf2oGzqtPmcgAAAAASUVORK5CYII=';

function e2eProgressPhotoFixture(): PhotoRecord[] | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  if (process.env.EXPO_PUBLIC_E2E_PROGRESS_PHOTOS !== 'populated') return null;

  const base = {
    series: 'front' as const,
    timeOfDay: 'morning' as const,
    notes: null,
    captureSessionId: 'e2e-progress-compare-picker',
    headRoll: null,
    headYaw: null,
    headPitch: null,
    qualitySource: null,
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
      localUri: E2E_PROGRESS_PHOTO_URI,
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
      localUri: E2E_PROGRESS_PHOTO_URI,
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
      localUri: E2E_PROGRESS_PHOTO_URI,
      takenLocalDate: '2026-06-24',
      takenAt: '2026-06-24T12:00:00.000Z',
      alignmentScore: 0.94,
      lightingScore: 0.91,
      isReference: false,
      referencePhotoId: 'e2e-front-2026-04-01',
    },
  ];
}

function e2eProgressStorageFailure(): Error | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  const fixture = process.env.EXPO_PUBLIC_E2E_PROGRESS_STORAGE_FAILURE;
  if (fixture === 'unavailable') return new Error('E2E_PROGRESS_STORAGE_UNAVAILABLE');
  if (fixture !== 'unavailable_once' || e2eProgressStorageFailureConsumed) return null;
  e2eProgressStorageFailureConsumed = true;
  return new Error('E2E_PROGRESS_STORAGE_UNAVAILABLE');
}

export function derivePhotosQueryData(
  photos: PhotoRecord[],
  series: PhotoSeries,
  todayYmd: string,
) {
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
}

export type PhotosQueryData = ReturnType<typeof derivePhotosQueryData>;

const PHOTO_SERIES_SET = new Set<string>(PHOTO_SERIES);

function photoQueryIdentity(queryKey: QueryKey): { series: PhotoSeries; todayYmd: string } | null {
  if (
    queryKey[0] !== 'photos' ||
    queryKey[3] !== LOCAL_DAY_QUERY_NAMESPACE ||
    typeof queryKey[4] !== 'string' ||
    typeof queryKey[6] !== 'string' ||
    !PHOTO_SERIES_SET.has(queryKey[6])
  ) {
    return null;
  }
  return { todayYmd: queryKey[4], series: queryKey[6] as PhotoSeries };
}

/** Publish one durable snapshot into every already-owned local-day/series view. */
export function publishPhotoMutationSnapshot(
  queryClient: Pick<QueryClient, 'getQueriesData' | 'setQueryData'>,
  ownerScope: OwnerQueryScope,
  photos: PhotoRecord[],
): void {
  if (!isOwnerQueryScopeCurrent(ownerScope)) return;
  const cachedQueries = queryClient.getQueriesData<PhotosQueryData>({
    queryKey: ownerQueryPrefixes.photos(ownerScope),
  });
  for (const [queryKey] of cachedQueries) {
    if (!isOwnerQueryScopeCurrent(ownerScope)) return;
    const identity = photoQueryIdentity(queryKey);
    if (!identity) continue;
    queryClient.setQueryData(
      queryKey,
      derivePhotosQueryData(photos, identity.series, identity.todayYmd),
    );
  }
}

/**
 * Read and derive one photo timeline from a local-day identity already owned by
 * the current route. This keeps nested storage/trend/presentation boundaries
 * from mounting duplicate photo observers and midnight subscriptions.
 */
export function usePhotosFromBoundary(
  boundary: LocalDateBoundaryIdentity,
  series: PhotoSeries = 'front',
) {
  const ownerScope = useOwnerQueryScope();
  const { localDate: todayYmd } = boundary;
  return useQuery({
    queryKey: queryKeys.photos(ownerScope, boundary, series),
    refetchOnReconnect: shouldRefetchCurrentLocalDayQuery,
    refetchOnWindowFocus: shouldRefetchCurrentLocalDayQuery,
    queryFn: () =>
      runOwnerQueryOperation(ownerScope, async () => {
        const storageFailure = e2eProgressStorageFailure();
        if (storageFailure) throw storageFailure;
        const fixture = e2eProgressPhotoFixture();
        if (!fixture) await recoverPhotoStoreMutations();
        const photos = fixture ?? (await loadPhotos());
        return derivePhotosQueryData(photos, series, todayYmd);
      }),
    retry: 0,
  });
}

/** Standalone photo consumer. Route view models should prefer the shared boundary. */
export function usePhotos(series: PhotoSeries = 'front') {
  const boundary = useLocalDateBoundary();
  return usePhotosFromBoundary(boundary, series);
}

export type PhotosQueryResult = ReturnType<typeof usePhotosFromBoundary>;

export function usePhotoActions() {
  const qc = useQueryClient();
  const ownerScope = useOwnerQueryScope();
  const commit = async <TResult>(
    operation: () => Promise<PhotoMutationCommit<TResult>>,
  ): Promise<TResult> => {
    const committed = await runOwnerQueryOperation(ownerScope, operation);
    if (isOwnerQueryScopeCurrent(ownerScope)) {
      publishPhotoMutationSnapshot(qc, ownerScope, committed.photos);
    }
    return committed.result;
  };

  const add = useMutation({
    mutationFn: (input: NewPhoto) => commit(() => addPhoto(input)),
  });
  const reference = useMutation({
    mutationFn: (id: string) => commit(() => setReference(id)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => commit(() => removePhoto(id)),
  });
  const note = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      commit(() => updatePhoto(id, { notes })),
  });

  return { add, reference, remove, note };
}

export type { PhotoRecord };
