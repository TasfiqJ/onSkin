import { useEffect } from 'react';

import { devWarn } from '@/lib/observability/safeLog';

import { rescheduleReminders, suspendPreferenceOwnedReminders } from './deliver';
import { useNotifPrefs } from './useNotifications';

const RETRY_DELAYS_MS = [1_000, 4_000] as const;

/**
 * Root-owned fixed-schedule convergence. It contains no Shelf/Ramp/Progress work
 * and reruns on every completed refetch, even when React Query structurally
 * shares an equal domain result after a prior native cancellation failure.
 */
export default function NotificationPreferenceScheduleReconciler() {
  const query = useNotifPrefs();
  const read = query.data;

  useEffect(() => {
    if (!query.isFetched && !query.isError) return;
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const reconcile = async (attempt: number): Promise<void> => {
      try {
        if (!query.isError && read?.status === 'available') {
          await rescheduleReminders(read.prefs);
        } else {
          await suspendPreferenceOwnedReminders();
        }
      } catch (error) {
        if (disposed) return;
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
  }, [query.dataUpdatedAt, query.isError, query.isFetched, read]);

  return null;
}
