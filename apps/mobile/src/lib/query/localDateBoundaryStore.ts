import { useSyncExternalStore } from 'react';

import {
  readLocalDateBoundarySnapshot,
  type LocalDateBoundarySnapshot,
} from './queryDateBoundaryCore';

export type LocalDateBoundaryIdentity = Pick<LocalDateBoundarySnapshot, 'localDate' | 'timeZone'>;

function identityFromSnapshot(snapshot: LocalDateBoundarySnapshot): LocalDateBoundaryIdentity {
  return { localDate: snapshot.localDate, timeZone: snapshot.timeZone };
}

export function createLocalDateBoundaryStore(initial: LocalDateBoundaryIdentity) {
  let current = initial;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => current,
    publish(snapshot: LocalDateBoundaryIdentity): boolean {
      if (snapshot.localDate === current.localDate && snapshot.timeZone === current.timeZone) {
        return false;
      }
      current = snapshot;
      for (const listener of listeners) listener();
      return true;
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const initialSnapshot = readLocalDateBoundarySnapshot();
const store = createLocalDateBoundaryStore(identityFromSnapshot(initialSnapshot));

export function publishLocalDateBoundarySnapshot(snapshot: LocalDateBoundarySnapshot): boolean {
  return store.publish(identityFromSnapshot(snapshot));
}

export function getLocalDateBoundarySnapshot(): LocalDateBoundaryIdentity {
  return store.getSnapshot();
}

/** Reactive local-day/time-zone identity shared by every date-sensitive query. */
export function useLocalDateBoundary(): LocalDateBoundaryIdentity {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
