import {
  hashKey,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import type { PhotoSeries } from '@layerwell/types';

import {
  HEALTH_DATA_WRITE_ADMISSION_CLOSED,
  runCurrentHealthDataOperation,
  runHealthDataOperation,
  type HealthDataWriteOperationLease,
} from '@/lib/consent/healthDataWriteAdmission';
import {
  activeHealthProcessingLeaseSnapshot,
  subscribeActiveHealthProcessingLeaseChanges,
  type ActiveHealthProcessingLeaseSnapshot,
} from '@/lib/consent/healthProcessingEpoch';

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
  addPhotoWithOutcome,
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

type PhotoReadAuthority = ActiveHealthProcessingLeaseSnapshot &
  Readonly<{
    ownerUserId: string;
    accountGeneration: number;
  }>;

function currentPhotoReadAuthority(): PhotoReadAuthority | null {
  const active = activeHealthProcessingLeaseSnapshot();
  if (active === null || active.ownerUserId === null || active.accountGeneration === null) {
    return null;
  }
  return active as PhotoReadAuthority;
}

function samePhotoReadAuthority(
  left: PhotoReadAuthority | null,
  right: PhotoReadAuthority | null,
): boolean {
  if (left === null || right === null) return left === right;
  return (
    left.generation === right.generation &&
    left.epoch === right.epoch &&
    left.ownerUserId === right.ownerUserId &&
    left.accountGeneration === right.accountGeneration
  );
}

function assertPhotoReadAuthority(authority: PhotoReadAuthority): void {
  if (!samePhotoReadAuthority(authority, currentPhotoReadAuthority())) {
    throw new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED);
  }
}

function assertPhotoReadOperationAuthority(
  lease: HealthDataWriteOperationLease,
  authority: PhotoReadAuthority,
): void {
  lease.assertCurrent();
  if (
    lease.generation !== authority.generation ||
    lease.epoch !== authority.epoch ||
    lease.ownerUserId !== authority.ownerUserId ||
    lease.accountGeneration !== authority.accountGeneration
  ) {
    throw new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED);
  }
  assertPhotoReadAuthority(authority);
}

function photoQueryKey(authority: PhotoReadAuthority, series: PhotoSeries, todayYmd: string) {
  return [
    ...KEY,
    'authority',
    authority.generation,
    authority.epoch,
    authority.accountGeneration,
    authority.ownerUserId,
    series,
    todayYmd,
  ] as const;
}

function photoSourceIsCurrent<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  authority: PhotoReadAuthority | null,
  data: T | undefined,
): boolean {
  if (authority === null || data === undefined) return false;
  if (!samePhotoReadAuthority(authority, currentPhotoReadAuthority())) return false;
  const current = queryClient.getQueryState(queryKey);
  return Boolean(
    current?.status === 'success' &&
    current.fetchStatus === 'idle' &&
    !current.isInvalidated &&
    current.data === data,
  );
}

function usePhotoReadAuthority(): PhotoReadAuthority | null {
  const published = useSyncExternalStore(
    subscribeActiveHealthProcessingLeaseChanges,
    currentPhotoReadAuthority,
    () => null,
  );
  const [, forceExpiryCheck] = useState(0);

  useEffect(() => {
    if (published?.expiresAt === null || published?.expiresAt === undefined) return;
    const delay = Math.max(0, published.expiresAt - Date.now()) + 1;
    const timer = setTimeout(() => forceExpiryCheck((value) => value + 1), delay);
    return () => clearTimeout(timer);
  }, [published]);

  // Re-read synchronously so an expiry reached without a lifecycle publication
  // cannot keep a previously-rendered health lease authoritative.
  return currentPhotoReadAuthority();
}
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

export function usePhotos(series: PhotoSeries = 'front') {
  const queryClient = useQueryClient();
  const todayYmd = localDay();
  const authority = usePhotoReadAuthority();
  const queryKey = useMemo<QueryKey>(
    () =>
      authority === null
        ? [...KEY, 'closed', series, todayYmd]
        : photoQueryKey(authority, series, todayYmd),
    [authority, series, todayYmd],
  );
  const capturedAuthority = authority;
  const query = useQuery({
    queryKey,
    enabled: capturedAuthority !== null,
    queryFn: () => {
      if (capturedAuthority === null) {
        return Promise.reject(new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED));
      }
      return runHealthDataOperation(capturedAuthority.ownerUserId, async (lease) => {
        assertPhotoReadOperationAuthority(lease, capturedAuthority);
        const storageFailure = e2eProgressStorageFailure();
        if (storageFailure) throw storageFailure;
        const fixture = e2eProgressPhotoFixture();
        assertPhotoReadOperationAuthority(lease, capturedAuthority);
        const photos = fixture ?? (await loadPhotos());
        assertPhotoReadOperationAuthority(lease, capturedAuthority);
        const inSeries = forSeries(photos, series);
        const result = {
          all: photos,
          series: inSeries,
          count: photos.length,
          metadata: metadataLine(photos),
          comparePair: defaultComparePair(photos, { series }),
          monthGroups: groupByMonth(photos, series, todayYmd),
          milestones: detectMilestones(photos, series),
          reference: referenceFor(photos, series),
        };
        assertPhotoReadOperationAuthority(lease, capturedAuthority);
        return result;
      });
    },
    retry: 0,
  });

  const isSourceCurrent = useCallback(
    () => photoSourceIsCurrent(queryClient, queryKey, authority, query.data),
    [authority, query.data, queryClient, queryKey],
  );
  const queryHash = hashKey(queryKey);
  const subscribeCurrentness = useCallback(
    (notify: () => void) => {
      const unsubscribeQuery = queryClient.getQueryCache().subscribe((event) => {
        if (event.query.queryHash === queryHash) notify();
      });
      const unsubscribeAuthority = subscribeActiveHealthProcessingLeaseChanges(() => notify());
      return () => {
        unsubscribeQuery();
        unsubscribeAuthority();
      };
    },
    [queryClient, queryHash],
  );
  const sourceReady = useSyncExternalStore(subscribeCurrentness, isSourceCurrent, () => false);
  const currentData = sourceReady ? query.data : undefined;
  const isLoading = authority !== null && query.isPending;
  const isRefreshing = authority !== null && query.data !== undefined && query.isFetching;
  const isError = authority !== null && query.isError;

  const retry = useCallback(async () => {
    if (authority === null) throw new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED);
    assertPhotoReadAuthority(authority);
    const result = await query.refetch({ cancelRefetch: false, throwOnError: true });
    assertPhotoReadAuthority(authority);
    if (!photoSourceIsCurrent(queryClient, queryKey, authority, result.data)) {
      throw new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED);
    }
  }, [authority, query, queryClient, queryKey]);

  return {
    ...query,
    // Never expose React Query's retained snapshot as current Progress data.
    data: currentData,
    isLoading,
    isError,
    isRefreshing,
    sourceReady,
    isSourceCurrent,
    retry,
  };
}

export function usePhotoActions() {
  const qc = useQueryClient();
  const mutateAndInvalidate = <T>(operation: () => Promise<T>): Promise<T> =>
    runCurrentHealthDataOperation(async (lease) => {
      try {
        lease.assertCurrent();
        return await operation();
      } finally {
        // Invalidating is itself a cache publication boundary. Keep it under
        // the same immutable lease as the local mutation that triggered it.
        lease.assertCurrent();
        await qc.invalidateQueries({ queryKey: KEY });
        lease.assertCurrent();
      }
    });

  const add = useMutation({
    mutationFn: (input: NewPhoto) => mutateAndInvalidate(() => addPhotoWithOutcome(input)),
  });
  const reference = useMutation({
    mutationFn: (id: string) => mutateAndInvalidate(() => setReference(id)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => mutateAndInvalidate(() => removePhoto(id)),
  });
  const note = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      mutateAndInvalidate(() => updatePhoto(id, { notes })),
  });

  return { add, reference, remove, note };
}

export type { PhotoRecord };
