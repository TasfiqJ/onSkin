import type { ReactNode } from 'react';

import { useLocalDateBoundary } from '@/lib/query/localDateBoundaryStore';

import { PhotoStorageBoundary } from './PhotoStorageGate';
import { usePhotosFromBoundary, type PhotosQueryData } from './usePhotos';

type ProgressPhotoRouteSourceProps = {
  children: (photos: PhotosQueryData) => ReactNode;
  onExit: () => void;
};

/**
 * Own the single date identity and photo observer for one focused, unlocked
 * Progress route. The exact snapshot used to prove storage availability is the
 * one passed to the route content.
 */
export function ProgressPhotoRouteSource({ children, onExit }: ProgressPhotoRouteSourceProps) {
  const boundary = useLocalDateBoundary();
  const query = usePhotosFromBoundary(boundary, 'front');

  return (
    <PhotoStorageBoundary query={query} onExit={onExit}>
      {query.data ? children(query.data) : null}
    </PhotoStorageBoundary>
  );
}
