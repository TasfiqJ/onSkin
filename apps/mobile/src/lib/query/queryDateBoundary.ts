import type { QueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';

import {
  createLocalDateBoundaryCoordinator,
  readLocalDateBoundarySnapshot,
} from './queryDateBoundaryCore';
import { publishLocalDateBoundarySnapshot } from './localDateBoundaryStore';
import { DATE_SENSITIVE_QUERY_PREFIXES } from './queryKeys';

type QueryInvalidator = Pick<QueryClient, 'invalidateQueries'>;

let coordinator: ReturnType<typeof createLocalDateBoundaryCoordinator> | null = null;

function setBoundaryTimer(callback: () => void, delayMs: number): ReturnType<typeof setTimeout> {
  const handle = setTimeout(callback, delayMs);
  const nodeHandle = handle as ReturnType<typeof setTimeout> & { unref?: () => void };
  nodeHandle.unref?.();
  return handle;
}

/** Configure one app-lifetime local-midnight/time-zone invalidation coordinator. */
export function configureQueryDateBoundary(client: QueryInvalidator) {
  coordinator ??= createLocalDateBoundaryCoordinator({
    appState: AppState,
    clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    invalidate: async () => {
      await Promise.all(
        DATE_SENSITIVE_QUERY_PREFIXES.map((queryKey) =>
          client.invalidateQueries({ queryKey, refetchType: 'none' }),
        ),
      );
    },
    publishSnapshot: publishLocalDateBoundarySnapshot,
    readSnapshot: readLocalDateBoundarySnapshot,
    setTimer: setBoundaryTimer,
  });
  return coordinator.configure();
}

/** Reconcile after the public Expo localization hook observes calendar settings. */
export function reconcileQueryDateBoundary(): void {
  coordinator?.reconcile();
}
