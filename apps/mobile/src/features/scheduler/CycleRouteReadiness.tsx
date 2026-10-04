import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { StateNotice } from '@/components/ui';

import { ActiveScheduleUnavailableNotice } from './ActiveScheduleUnavailableNotice';
import type { CycleData, RecoverableCycleHookResult } from './useCycle';

export type CycleRouteReadinessState = 'loading' | 'unavailable' | 'ready';

function sourceIsCurrent(source: RecoverableCycleHookResult): boolean {
  return Boolean(
    !source.isLoading &&
    !source.isRefreshing &&
    !source.isError &&
    source.sourceReady &&
    source.data !== undefined &&
    source.isSourceCurrent(),
  );
}

/**
 * Read/presentation admission for cycle routes.
 *
 * useCycle may intentionally retain computed data while an input is refreshing or
 * after a read error. That retained snapshot is useful for recovery, but it is not
 * authority for cycle-route presentation. Query-cache subscription also closes the
 * small window where isSourceCurrent() has gone false before the hook observer has
 * published a new render.
 */
export function useCycleRouteReadiness(source: RecoverableCycleHookResult) {
  const queryClient = useQueryClient();
  const subscribe = useCallback(
    (notify: () => void) => queryClient.getQueryCache().subscribe(() => notify()),
    [queryClient],
  );
  const getSnapshot = useCallback(() => sourceIsCurrent(source), [source]);
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [retrying, setRetrying] = useState(false);
  const retryInFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const state: CycleRouteReadinessState =
    retrying || source.isLoading || source.isRefreshing
      ? 'loading'
      : !current || source.isError || !source.sourceReady || source.data === undefined
        ? 'unavailable'
        : 'ready';

  const isCurrent = useCallback(() => sourceIsCurrent(source), [source]);

  const retry = useCallback(async () => {
    if (retryInFlight.current) return;
    retryInFlight.current = true;
    if (mounted.current) setRetrying(true);
    try {
      await source.retry();
    } catch {
      // The route stays fail-closed. useCycle preserves the authoritative error.
    } finally {
      retryInFlight.current = false;
      if (mounted.current) setRetrying(false);
    }
  }, [source]);

  return {
    state,
    data: state === 'ready' ? (source.data as CycleData) : undefined,
    isCurrent,
    retry,
    retrying,
  };
}

export function CycleRouteReadinessNotice({
  state,
  onRetry,
  retrying,
  tone = 'paper',
  className,
}: {
  state: Exclude<CycleRouteReadinessState, 'ready'>;
  onRetry: () => void;
  retrying: boolean;
  tone?: 'paper' | 'night';
  className?: string;
}) {
  if (state === 'loading') {
    return (
      <StateNotice
        kind="loading"
        tone={tone}
        className={className}
        title="Checking your active schedule..."
        body="Cycle guidance stays hidden until Layerwell confirms the current saved schedule and routine inputs."
      />
    );
  }

  return (
    <ActiveScheduleUnavailableNotice
      className={className}
      onRetry={onRetry}
      retrying={retrying}
      tone={tone}
    />
  );
}
