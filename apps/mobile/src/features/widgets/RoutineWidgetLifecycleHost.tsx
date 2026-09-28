import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import type { RoutineWidgetLifecycleAuthorityInput } from './lifecycleCoordinator';
import { mountRoutineWidgetLifecycle } from './lifecycleRuntime';
import { useNotifPrefs } from '@/features/notifications/useNotifications';
import { usePlan } from '@/features/routine/usePlan';
import { useCycle } from '@/features/scheduler/useCycle';
import { useEntitlement } from '@/features/subscription/useEntitlement';
import { getCompletedSteps } from '@/features/today/completionsStore';
import { projectTodayRoutine } from '@/features/today/routineProjection';
import { currentRoutineType, localDateString } from '@/features/today/useToday';

type HostPublicationSnapshot = Readonly<
  | { enabled: false }
  | {
      enabled: true;
      completedCount: number;
      liveActivityEnabled: boolean;
      localDate: string;
      phase: 'AM' | 'PM';
      remainingStepKeys: readonly string[];
      totalCount: number;
    }
>;

const DISABLED_PUBLICATION_SNAPSHOT: HostPublicationSnapshot = Object.freeze({ enabled: false });

type LifecycleReleaseWithRefresh = (() => void) & {
  refresh?: () => Promise<void>;
};

type LifecycleMountWithPublication = (
  input: RoutineWidgetLifecycleAuthorityInput,
  publication: Readonly<{
    onCanonicalMutation: () => void | Promise<void>;
    readSnapshot: () => HostPublicationSnapshot | null;
  }>,
) => LifecycleReleaseWithRefresh;

type RoutineClock = Readonly<{
  foreground: boolean;
  localDate: string;
  phase: 'AM' | 'PM';
}>;

function currentClock(appState: AppStateStatus = AppState.currentState): RoutineClock {
  const now = new Date();
  const currentPhase = currentRoutineType(now);
  const phase = currentPhase === 'PM' ? 'PM' : 'AM';
  return Object.freeze({
    foreground: appState === 'active',
    localDate: localDateString(now),
    phase,
  });
}

function nextRoutineBoundary(now: Date): number {
  const next = new Date(now);
  if (now.getHours() < 17) next.setHours(17, 0, 0, 0);
  else {
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
  }
  return next.getTime();
}

function useRoutineClock(): RoutineClock {
  const [clock, setClock] = useState<RoutineClock>(() => currentClock());
  useEffect(() => {
    let boundaryTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleBoundary = () => {
      if (boundaryTimer !== null) clearTimeout(boundaryTimer);
      if (AppState.currentState !== 'active') return;
      const now = new Date();
      boundaryTimer = setTimeout(
        () => {
          setClock(currentClock());
          scheduleBoundary();
        },
        Math.max(1_000, nextRoutineBoundary(now) - now.getTime() + 100),
      );
    };
    const subscription = AppState.addEventListener('change', (nextState) => {
      setClock(currentClock(nextState));
      scheduleBoundary();
    });
    scheduleBoundary();
    return () => {
      subscription.remove();
      if (boundaryTimer !== null) clearTimeout(boundaryTimer);
    };
  }, []);
  return clock;
}

export function RoutineWidgetLifecycleHost({
  ownerUserId,
  processingEpoch,
}: RoutineWidgetLifecycleAuthorityInput) {
  const queryClient = useQueryClient();
  const plan = usePlan();
  const cycle = useCycle();
  const entitlement = useEntitlement();
  const notificationPreferences = useNotifPrefs();
  const clock = useRoutineClock();
  const completions = useQuery({
    queryKey: ['completions', clock.localDate],
    queryFn: () => getCompletedSteps(clock.localDate),
    retry: 0,
  });
  const projection = useMemo(
    () =>
      projectTodayRoutine({
        planData: plan.data,
        cycleData: cycle.data,
        completedStepKeys: completions.data,
      }),
    [completions.data, cycle.data, plan.data],
  );
  const publicationSnapshot = useMemo<HostPublicationSnapshot | null>(() => {
    if (!clock.foreground) return null;
    if (entitlement.data?.isPro === false) return Object.freeze({ enabled: false });
    if (
      plan.isLoading ||
      cycle.isLoading ||
      entitlement.isLoading ||
      notificationPreferences.isLoading ||
      completions.isLoading ||
      plan.data === undefined ||
      cycle.data === undefined ||
      completions.data === undefined ||
      entitlement.data === undefined ||
      !plan.sourceReady ||
      !cycle.sourceReady ||
      plan.isError ||
      cycle.isError ||
      plan.isExample ||
      cycle.isExample ||
      plan.data.isExample ||
      entitlement.isError ||
      notificationPreferences.isError ||
      completions.isError
    ) {
      return null;
    }
    const phaseProjection = clock.phase === 'AM' ? projection.am : projection.pm;
    const completed = completions.data ?? new Set<string>();
    return Object.freeze({
      enabled: true,
      completedCount: phaseProjection.completedCount,
      liveActivityEnabled: notificationPreferences.data?.liveActivityEnabled === true,
      localDate: clock.localDate,
      phase: clock.phase,
      remainingStepKeys: Object.freeze(
        phaseProjection.stepKeys.filter((stepKey) => !completed.has(stepKey)),
      ),
      totalCount: phaseProjection.stepKeys.length,
    });
  }, [
    clock,
    completions.data,
    completions.isError,
    completions.isLoading,
    cycle.data,
    cycle.isError,
    cycle.isExample,
    cycle.isLoading,
    cycle.sourceReady,
    entitlement.data,
    entitlement.isError,
    entitlement.isLoading,
    notificationPreferences.data?.liveActivityEnabled,
    notificationPreferences.isError,
    notificationPreferences.isLoading,
    plan.data,
    plan.isError,
    plan.isExample,
    plan.isLoading,
    plan.sourceReady,
    projection.am,
    projection.pm,
  ]);
  const publicationRef = useRef<HostPublicationSnapshot | null>(publicationSnapshot);
  const invalidateRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const lifecycleRef = useRef<LifecycleReleaseWithRefresh | null>(null);
  const confirmedDisabled = entitlement.data?.isPro === false;

  useEffect(() => {
    publicationRef.current = publicationSnapshot;
  }, [publicationSnapshot]);

  useEffect(() => {
    invalidateRef.current = () => queryClient.invalidateQueries({ queryKey: ['completions'] });
  }, [queryClient]);

  useEffect(() => {
    const mountWithPublication = mountRoutineWidgetLifecycle as LifecycleMountWithPublication;
    const release = mountWithPublication(
      { ownerUserId, processingEpoch },
      {
        readSnapshot: () =>
          confirmedDisabled ? DISABLED_PUBLICATION_SNAPSHOT : publicationRef.current,
        onCanonicalMutation: async () => {
          await invalidateRef.current();
          void lifecycleRef.current?.refresh?.();
        },
      },
    );
    lifecycleRef.current = release;
    return () => {
      if (lifecycleRef.current === release) lifecycleRef.current = null;
      release();
    };
  }, [confirmedDisabled, ownerUserId, processingEpoch]);

  useEffect(() => {
    void lifecycleRef.current?.refresh?.();
  }, [ownerUserId, processingEpoch, publicationSnapshot]);

  return null;
}

/** A stable sibling slot protects the Expo Router subtree from remounts. */
export function RoutineWidgetLifecycleSlot({
  authority,
}: {
  authority: RoutineWidgetLifecycleAuthorityInput | null;
}) {
  return authority ? <RoutineWidgetLifecycleHost {...authority} /> : null;
}
