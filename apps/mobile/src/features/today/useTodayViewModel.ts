import type { RoutineType } from '@onskin/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { RecommendationShelfSource } from '@/features/recommendations/useRecommendations';
import { useProgressFromBoundary } from '@/features/routine/useProgress';
import { usePlanFromSources } from '@/features/routine/usePlan';
import { useRampFromPlan } from '@/features/routine/useRamp';
import { requestReviewAfterValue } from '@/features/review/prompt';
import { useProfileBits } from '@/features/scheduler/profile';
import { useCycleFromSources } from '@/features/scheduler/useCycle';
import type { useShelfFromBoundary } from '@/features/shelf/useShelf';
import { useEntitlement } from '@/features/subscription/useEntitlement';
import { awaitAccountGenerationLease } from '@/lib/auth/accountGeneration';
import { track } from '@/lib/analytics/track';
import type { LocalDateBoundaryIdentity } from '@/lib/query/localDateBoundaryStore';
import {
  isOwnerQueryScopeCurrent,
  ownerQueryPrefixes,
  queryKeys,
  runOwnerQueryOperation,
  shouldRefetchCurrentLocalDayQuery,
} from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';
import { haptics } from '@/theme/haptics';

import { commitTodayCompletionForOwner } from './completionMutationCoordinator';
import { commitCompletion, getCompletedSteps } from './completionsStore';
import { reserveCycleNightCompletionAnalyticsForOwner } from './cycleNightAnalytics';

type TodayShelfSource = ReturnType<typeof useShelfFromBoundary>;
type TodayRoutinePhase = Extract<RoutineType, 'AM' | 'PM'>;
type ProgressReconciliationState = {
  promise: Promise<void>;
  scope: string;
  trailing: boolean;
};

export type TodayCompletionContext = {
  phase: TodayRoutinePhase;
  cycleActive: boolean;
  stepKeys: readonly string[];
};

export type TodayViewModelInput = {
  boundary: LocalDateBoundaryIdentity;
  routineType: TodayRoutinePhase;
  shelf: TodayShelfSource;
};

function retryResultFailed(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && 'isError' in value && value.isError);
}

const EMPTY_COMPLETIONS = new Set<string>();
const MAX_E2E_COMPLETION_COMMIT_DELAY_MS = 3_000;

function completionCommitDelayMsForE2E(): number {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return 0;
  const parsed = Number(process.env.EXPO_PUBLIC_E2E_COMPLETION_COMMIT_DELAY_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(Math.floor(parsed), MAX_E2E_COMPLETION_COMMIT_DELAY_MS);
}

/**
 * One Today route graph: every date/domain observer is mounted once and its exact
 * snapshot is passed into Plan, Ramp, Cycle, recommendations, and presentation.
 */
export function useTodayViewModel({ boundary, routineType, shelf }: TodayViewModelInput) {
  const queryClient = useQueryClient();
  const ownerScope = useOwnerQueryScope();
  const completionActionScope = `${ownerScope.generation}:${boundary.localDate}:${boundary.timeZone}`;
  const profile = useProfileBits();
  const plan = usePlanFromSources(shelf, profile);
  const ramp = useRampFromPlan(plan, boundary);
  const cycle = useCycleFromSources(shelf, profile, ramp, boundary);
  const progress = useProgressFromBoundary(boundary);
  const entitlement = useEntitlement();
  const completionReadFixturePending = useRef(
    typeof __DEV__ !== 'undefined' &&
      __DEV__ &&
      process.env.EXPO_PUBLIC_E2E_COMPLETION_STORAGE_FAILURE === 'today_once',
  );
  const completion = useQuery<Set<string>>({
    queryKey: queryKeys.completions(ownerScope, boundary),
    networkMode: 'always',
    retry: false,
    retryOnMount: false,
    refetchOnReconnect: (query) =>
      query.state.status !== 'error' && shouldRefetchCurrentLocalDayQuery(query),
    refetchOnWindowFocus: (query) =>
      query.state.status !== 'error' && shouldRefetchCurrentLocalDayQuery(query),
    queryFn: () =>
      runOwnerQueryOperation(ownerScope, async (lease) => {
        if (completionReadFixturePending.current) {
          completionReadFixturePending.current = false;
          throw new Error('E2E_COMPLETION_STORAGE_UNAVAILABLE');
        }
        return await awaitAccountGenerationLease(lease, () =>
          getCompletedSteps(boundary.localDate),
        );
      }),
  });
  const [completionMutationFailureScope, setCompletionMutationFailureScope] = useState<
    string | null
  >(null);
  const completionMutationFailed = completionMutationFailureScope === completionActionScope;
  const pendingByStep = useRef(new Map<string, Promise<void>>());
  const [pendingRevision, setPendingRevision] = useState(0);
  const committedInSession = useRef(new Set<string>());
  const progressReconciliation = useRef<ProgressReconciliationState | null>(null);
  const done = completion.data ?? EMPTY_COMPLETIONS;
  const doneRef = useRef<ReadonlySet<string>>(done);
  const progressStreakRef = useRef(progress.data?.streak ?? 0);
  useEffect(() => {
    doneRef.current = done;
    progressStreakRef.current = progress.data?.streak ?? 0;
  }, [done, progress.data?.streak]);
  const recommendationShelf = useMemo<RecommendationShelfSource>(
    () => ({
      data: shelf.data,
      isError: shelf.isError,
      isFetching: shelf.isFetching,
      isLoading: shelf.isLoading,
      isSuccess: shelf.isSuccess,
    }),
    [shelf.data, shelf.isError, shelf.isFetching, shelf.isLoading, shelf.isSuccess],
  );
  const recommendationProfile = useMemo(
    () => ({
      data: profile.data,
      isError: profile.isError,
      isFetching: profile.isFetching,
      isLoading: profile.isLoading,
      isSuccess: profile.isSuccess,
    }),
    [profile.data, profile.isError, profile.isFetching, profile.isLoading, profile.isSuccess],
  );

  const reconcileProgress = useCallback((): Promise<void> => {
    const scope = `${ownerScope.generation}:${boundary.localDate}:${boundary.timeZone}`;
    const active = progressReconciliation.current;
    if (active?.scope === scope) {
      active.trailing = true;
      return active.promise;
    }

    const launch = (): Promise<void> => {
      const state: ProgressReconciliationState = {
        promise: Promise.resolve(),
        scope,
        trailing: false,
      };
      let invalidation: Promise<void>;
      try {
        invalidation = queryClient.invalidateQueries({
          queryKey: ownerQueryPrefixes.progress(ownerScope),
        });
      } catch {
        invalidation = Promise.resolve();
      }
      state.promise = invalidation
        .catch(() => undefined)
        .finally(() => {
          if (progressReconciliation.current !== state) return;
          if (state.trailing && isOwnerQueryScopeCurrent(ownerScope)) {
            state.trailing = false;
            void launch();
            return;
          }
          progressReconciliation.current = null;
        });
      progressReconciliation.current = state;
      return state.promise;
    };

    return launch();
  }, [boundary.localDate, boundary.timeZone, ownerScope, queryClient]);

  const completeStep = useCallback(
    (key: string, context: TodayCompletionContext): Promise<void> => {
      const operationId = `${ownerScope.generation}:${boundary.localDate}:${key}`;
      const pending = pendingByStep.current.get(operationId);
      if (pending) return pending;
      if (doneRef.current.has(key) || committedInSession.current.has(operationId)) {
        return Promise.resolve();
      }

      // Selection acknowledges the accepted tap immediately. Success feedback is
      // reserved for the durable commit that completes the whole phase.
      haptics.select();
      const operation = (async () => {
        try {
          const publication = await commitTodayCompletionForOwner({
            boundary,
            cancel: (queryKey) => queryClient.cancelQueries({ queryKey, exact: true }),
            operation: () =>
              runOwnerQueryOperation(ownerScope, async (lease) => {
                const delayMs = completionCommitDelayMsForE2E();
                if (delayMs > 0) {
                  await awaitAccountGenerationLease(
                    lease,
                    () => new Promise<void>((resolve) => setTimeout(resolve, delayMs)),
                  );
                }
                lease.assertCurrent();
                return commitCompletion(key, boundary.localDate);
              }),
            publish: (queryKey, update) => {
              queryClient.setQueryData<Set<string>>(queryKey, (current) => update(current));
            },
            reconcileProgress,
            scope: ownerScope,
          });
          const result = publication.result;
          if (!publication.published || result.status !== 'committed' || !result.changed) return;

          committedInSession.current.add(operationId);
          const moment = routineType.toLowerCase();
          track('routine_checkoff_completed', { moment });
          if (result.firstEver) track('first_checkoff_completed', { moment });
          const cycleNightReceipt = await reserveCycleNightCompletionAnalyticsForOwner({
            completedAfter: result.completedSteps,
            cycleActive: context.cycleActive,
            phase: context.phase,
            stepKeys: context.stepKeys,
            changed: result.changed,
            localDate: boundary.localDate,
            scope: ownerScope,
          });
          if (!isOwnerQueryScopeCurrent(ownerScope)) return;
          if (cycleNightReceipt.status === 'reserved') {
            track('cycle_night_completed', { moment: 'pm', source: 'today' });
          }
          if (
            context.stepKeys.length > 0 &&
            context.stepKeys.every((step) => result.completedSteps.has(step))
          ) {
            haptics.success();
          }
          if (progressStreakRef.current >= 6) {
            void requestReviewAfterValue('seven_checkoff_days');
          }
        } catch {
          if (isOwnerQueryScopeCurrent(ownerScope)) {
            setCompletionMutationFailureScope(completionActionScope);
          }
        } finally {
          if (pendingByStep.current.delete(operationId)) {
            setPendingRevision((revision) => revision + 1);
          }
        }
      })();

      pendingByStep.current.set(operationId, operation);
      setPendingRevision((revision) => revision + 1);
      return operation;
    },
    [boundary, completionActionScope, ownerScope, queryClient, reconcileProgress, routineType],
  );

  const isCompletionPending = useCallback(
    (key: string): boolean => {
      // The revision makes the ref-backed single-flight map observable without
      // ever placing an uncommitted completion into the durable query cache.
      void pendingRevision;
      return pendingByStep.current.has(`${ownerScope.generation}:${boundary.localDate}:${key}`);
    },
    [boundary.localDate, ownerScope.generation, pendingRevision],
  );

  const retryCompletionHistory = useCallback(async (): Promise<{ isError: boolean }> => {
    const result = await completion.refetch();
    if (result.isSuccess) {
      setCompletionMutationFailureScope((failedScope) =>
        failedScope === completionActionScope ? null : failedScope,
      );
    }
    return { isError: result.isError };
  }, [completion, completionActionScope]);

  const retryPrivateGuidance = useCallback(async (): Promise<{ isError: boolean }> => {
    const results = await Promise.all([
      profile.isError ? profile.refetch() : Promise.resolve(),
      plan.isError ? plan.retry() : Promise.resolve(),
    ]);
    return { isError: results.some(retryResultFailed) };
  }, [plan, profile]);

  const retrySchedule = useCallback(async (): Promise<{ isError: boolean }> => {
    const results = await Promise.all([
      ramp.isError ? ramp.retry() : Promise.resolve(),
      cycle.isError ? cycle.retry() : Promise.resolve(),
    ]);
    return { isError: results.some(retryResultFailed) };
  }, [cycle, ramp]);

  return {
    completion,
    completionActionScope,
    completionMutationFailed,
    completeStep,
    cycle,
    done,
    entitlement,
    isCompletionPending,
    plan,
    profile,
    progress,
    ramp,
    recommendationProfile,
    recommendationShelf,
    retryCompletionHistory,
    retryPrivateGuidance,
    retrySchedule,
    shelf,
  };
}
