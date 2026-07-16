import { createContext, useContext, useMemo, type ReactNode } from 'react';

import {
  useLocalDateBoundary,
  type LocalDateBoundaryIdentity,
} from '@/lib/query/localDateBoundaryStore';

import { useShelfFromBoundary } from './useShelf';

export type ShelfRouteQuery = ReturnType<typeof useShelfFromBoundary>;
export type ShelfRouteSources = {
  boundary: LocalDateBoundaryIdentity;
  shelf: ShelfRouteQuery;
};

const ShelfRouteSourcesContext = createContext<ShelfRouteSources | null>(null);

/** One Shelf/date observer graph shared by every screen in the Shelf stack. */
export function ShelfRouteSourcesProvider({ children }: { children: ReactNode }) {
  const boundary = useLocalDateBoundary();
  const shelf = useShelfFromBoundary(boundary);
  const value = useMemo(() => ({ boundary, shelf }), [boundary, shelf]);

  return (
    <ShelfRouteSourcesContext.Provider value={value}>{children}</ShelfRouteSourcesContext.Provider>
  );
}

export function useShelfRouteSources(): ShelfRouteSources {
  const value = useContext(ShelfRouteSourcesContext);
  if (!value) throw new Error('SHELF_ROUTE_SOURCES_REQUIRED');
  return value;
}
