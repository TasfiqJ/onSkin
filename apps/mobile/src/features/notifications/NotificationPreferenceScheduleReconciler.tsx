import { useEffect } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { devWarn } from '@/lib/observability/safeLog';

import { rescheduleReminders, type NotificationScheduleLifecycle } from './deliver';

const RETRY_DELAYS_MS = [1_000, 4_000] as const;

type NotificationScheduleLifecycleCoordinator = Readonly<{
  dispose: () => void;
  handleAppStateChange: (state: AppStateStatus) => void;
  start: (state: AppStateStatus) => void;
}>;

type NotificationScheduleLifecycleDependencies = Readonly<{
  reconcile: (lifecycle: NotificationScheduleLifecycle) => Promise<void>;
  onAttemptError: (error: unknown, exhausted: boolean) => void;
}>;

/**
 * Own one active-only retry sequence. A non-active transition invalidates the
 * current continuation, clears its retry timer synchronously, and retains one
 * convergence pass for the next foreground.
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

/**
 * Root-owned convergence for the fixed local routine/capture reminders only.
 * It mounts behind private-data + health-lifecycle admission. Stored preferences
 * remain authoritative; every cold active launch and foreground re-reads them,
 * so timezone/permission/native-state drift converges without opening Settings.
 */
export default function NotificationPreferenceScheduleReconciler() {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const coordinator = createNotificationScheduleLifecycleCoordinator({
      reconcile: (lifecycle) => rescheduleReminders(undefined, lifecycle),
      onAttemptError: (error, exhausted) => {
        if (exhausted) devWarn('notification_schedule_reconciliation_failed', error);
      },
    });

    const subscription = AppState.addEventListener('change', coordinator.handleAppStateChange);
    coordinator.start(AppState.currentState);
    return () => {
      coordinator.dispose();
      subscription.remove();
    };
  }, []);

  return null;
}
