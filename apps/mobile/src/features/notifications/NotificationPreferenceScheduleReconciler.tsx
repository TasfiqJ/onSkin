import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { devWarn } from '@/lib/observability/safeLog';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';

import {
  cancelTrialReminder,
  reconcileRootNotificationSchedules,
  scheduleTrialReminder,
} from './deliver';
import { NotificationPermissionUnavailableError } from './permission';
import { useNotifPrefs } from './useNotifications';

const RETRY_DELAYS_MS = [1_000, 4_000] as const;

type NotificationScheduleLifecycleCoordinator = Readonly<{
  dispose: () => void;
  handleAppStateChange: (state: AppStateStatus) => void;
  start: (state: AppStateStatus) => void;
}>;

type NotificationScheduleLifecycleDependencies = Readonly<{
  reconcile: (
    lifecycle: Readonly<{ isCurrent: () => boolean; signal: AbortSignal }>,
  ) => Promise<void>;
  onAttemptError: (error: unknown, exhausted: boolean) => void;
}>;

/**
 * Own one active-only retry sequence. A non-active transition invalidates the
 * current continuation, clears its timer synchronously, and retains exactly
 * one pass for the next foreground.
 */
export function createNotificationScheduleLifecycleCoordinator({
  reconcile,
  onAttemptError,
}: NotificationScheduleLifecycleDependencies): NotificationScheduleLifecycleCoordinator {
  let started = false;
  let active = false;
  let disposed = false;
  let lifecycleEpoch = 0;
  let inFlight = false;
  let pending = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let activeRunController: AbortController | null = null;

  const clearRetry = () => {
    if (retryTimer === null) return;
    clearTimeout(retryTimer);
    retryTimer = null;
  };

  const isRunCurrent = (runEpoch: number, signal: AbortSignal) =>
    !disposed && started && active && lifecycleEpoch === runEpoch && !signal.aborted;

  let requestRun!: (attempt?: number) => void;
  const runAttempt = async (attempt: number): Promise<void> => {
    inFlight = true;
    const runEpoch = lifecycleEpoch;
    const controller = new AbortController();
    activeRunController = controller;
    const isCurrent = () => isRunCurrent(runEpoch, controller.signal);
    try {
      await reconcile({ isCurrent, signal: controller.signal });
      if (!isCurrent() && !disposed) pending = true;
    } catch (error) {
      if (!isCurrent()) {
        if (!disposed) pending = true;
        return;
      }

      const delay = RETRY_DELAYS_MS[attempt];
      onAttemptError(error, delay === undefined);
      if (delay !== undefined) {
        retryTimer = setTimeout(() => {
          retryTimer = null;
          requestRun(attempt + 1);
        }, delay);
      }
    } finally {
      if (activeRunController === controller) activeRunController = null;
      inFlight = false;
      if (disposed || retryTimer !== null || !active || !pending) return;
      requestRun();
    }
  };

  requestRun = (attempt = 0) => {
    if (disposed) return;
    if (!active || inFlight) {
      pending = true;
      return;
    }
    pending = false;
    void runAttempt(attempt);
  };

  return Object.freeze({
    start(state) {
      if (disposed || started) return;
      started = true;
      active = state === 'active';
      if (!active) {
        pending = true;
        return;
      }
      requestRun();
    },
    handleAppStateChange(state) {
      const nextActive = state === 'active';
      if (!nextActive) {
        active = false;
        lifecycleEpoch += 1;
        activeRunController?.abort();
        clearRetry();
        pending = true;
        return;
      }
      if (active) return;
      active = true;
      if (!started) return;
      requestRun();
    },
    dispose() {
      disposed = true;
      started = false;
      active = false;
      lifecycleEpoch += 1;
      activeRunController?.abort();
      pending = false;
      clearRetry();
    },
  });
}

// At most one mounted account generation can own a pending trial restoration.
// A genuine owner remount replaces stale state instead of accumulating it.
let blockedTrialReminderGeneration: number | null = null;
let auditedTrialReminderGeneration: number | null = null;

/**
 * Root-owned fixed-schedule convergence. It contains no Shelf/Ramp/Progress work
 * and reruns on every completed refetch, even when React Query structurally
 * shares an equal domain result after a prior native cancellation failure.
 */
export default function NotificationPreferenceScheduleReconciler() {
  const query = useNotifPrefs();
  const ownerScope = useOwnerQueryScope();
  const read = query.data;

  useEffect(() => {
    if (!query.isFetched && !query.isError) return;
    const generation = ownerScope.generation;
    if (blockedTrialReminderGeneration !== null && blockedTrialReminderGeneration !== generation) {
      blockedTrialReminderGeneration = null;
    }
    if (auditedTrialReminderGeneration !== null && auditedTrialReminderGeneration !== generation) {
      auditedTrialReminderGeneration = null;
    }

    const coordinator = createNotificationScheduleLifecycleCoordinator({
      reconcile: async ({ isCurrent, signal }) => {
        const lifecycle = { isCurrent, signal } as const;
        const prefs = !query.isError && read?.status === 'available' ? read.prefs : null;
        const outcome = await reconcileRootNotificationSchedules(prefs, generation, lifecycle);
        if (!isCurrent()) return;

        if (outcome === 'suspended_denied' || outcome === 'suspended_undetermined') {
          blockedTrialReminderGeneration = generation;
          return;
        }

        if (
          outcome === 'scheduled' &&
          (blockedTrialReminderGeneration === generation ||
            auditedTrialReminderGeneration !== generation)
        ) {
          const { reconcileLocalEntitlementTrialReminder } =
            await import('@/features/subscription/entitlementReminder');
          if (!isCurrent()) return;
          const trialResult = await reconcileLocalEntitlementTrialReminder(ownerScope, {
            loadDelivery: async () => ({
              cancelTrialReminder: () => cancelTrialReminder(lifecycle),
              scheduleTrialReminder: (input) => scheduleTrialReminder(input, lifecycle),
            }),
          });
          if (!isCurrent()) return;
          if (trialResult === 'failed') {
            throw new Error('TRIAL_REMINDER_RECONCILIATION_FAILED');
          }
          blockedTrialReminderGeneration = null;
          auditedTrialReminderGeneration = generation;
        }
      },
      onAttemptError: (error, exhausted) => {
        if (error instanceof NotificationPermissionUnavailableError) {
          blockedTrialReminderGeneration = generation;
        }
        if (exhausted) devWarn('notification_schedule_reconciliation_failed', error);
      },
    });

    const subscription = AppState.addEventListener('change', coordinator.handleAppStateChange);
    coordinator.start(AppState.currentState);
    return () => {
      coordinator.dispose();
      subscription.remove();
    };
  }, [ownerScope, query.dataUpdatedAt, query.isError, query.isFetched, read]);

  return null;
}
