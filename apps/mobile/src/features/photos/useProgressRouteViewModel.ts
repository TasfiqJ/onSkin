import type { LocalDateBoundaryIdentity } from '@/lib/query/localDateBoundaryStore';

import { usePhotosFromBoundary } from './usePhotos';

/**
 * One Progress route graph for the date-sensitive photo read. Entitlement and
 * app-lock gates intentionally stay above this hook so locked routes do not open
 * private photo storage. Optional trend consumers receive this exact snapshot.
 */
export function useProgressRouteViewModel(boundary: LocalDateBoundaryIdentity) {
  const photos = usePhotosFromBoundary(boundary, 'front');

  return { photos };
}
