import { createContext, useContext, type ReactNode } from 'react';

import { useShelfFromBoundary } from '@/features/shelf/useShelf';
import {
  useLocalDateBoundary,
  type LocalDateBoundaryIdentity,
} from '@/lib/query/localDateBoundaryStore';

export type RoutineRouteSources = {
  boundary: LocalDateBoundaryIdentity;
  shelf: ReturnType<typeof useShelfFromBoundary>;
};

const RoutineRouteSourcesContext = createContext<RoutineRouteSources | null>(null);

export function RoutineRouteSourcesProvider({ children }: { children: ReactNode }) {
  const boundary = useLocalDateBoundary();
  const shelf = useShelfFromBoundary(boundary);

  return (
    <RoutineRouteSourcesContext.Provider value={{ boundary, shelf }}>
      {children}
    </RoutineRouteSourcesContext.Provider>
  );
}

export function useRoutineRouteSources(): RoutineRouteSources {
  const sources = useContext(RoutineRouteSourcesContext);
  if (!sources) throw new Error('ROUTINE_ROUTE_SOURCES_UNAVAILABLE');
  return sources;
}
