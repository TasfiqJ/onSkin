import { useEffect } from 'react';

import { devWarn } from '@/lib/observability/safeLog';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';

import { reconcileRootNotificationSchedules } from './deliver';
import { NotificationPermissionUnavailableError } from './permission';
import { useNotifPrefs } from './useNotifications';

const RETRY_DELAYS_MS = [1_000, 4_000] as const;

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
    if (
      blockedTrialReminderGeneration !== null &&
      blockedTrialReminderGeneration !== generation
    ) {
      blockedTrialReminderGeneration = null;
    }
    if (
      auditedTrialReminderGeneration !== null &&
      auditedTrialReminderGeneration !== generation
    ) {
      auditedTrialReminderGeneration = null;
    }
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const reconcile = async (attempt: number): Promise<void> => {
      try {
        const prefs = !query.isError && read?.status === 'available' ? read.prefs : null;
        const outcome = await reconcileRootNotificationSchedules(prefs, generation);

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
          const trialResult = await reconcileLocalEntitlementTrialReminder(ownerScope);
          if (trialResult === 'failed') {
            throw new Error('TRIAL_REMINDER_RECONCILIATION_FAILED');
          }
          blockedTrialReminderGeneration = null;
          auditedTrialReminderGeneration = generation;
        }
      } catch (error) {
        if (disposed) return;
        if (error instanceof NotificationPermissionUnavailableError) {
          blockedTrialReminderGeneration = generation;
        }
        const delay = RETRY_DELAYS_MS[attempt];
        if (delay !== undefined) {
          retryTimer = setTimeout(() => void reconcile(attempt + 1), delay);
          return;
        }
        devWarn('notification_schedule_reconciliation_failed', error);
      }
    };

    void reconcile(0);
    return () => {
      disposed = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
    };
  }, [ownerScope, query.dataUpdatedAt, query.isError, query.isFetched, read]);

  return null;
}
