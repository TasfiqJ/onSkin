import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  HEALTH_DATA_WRITE_ADMISSION_CLOSED,
  runHealthDataOperation,
  runHealthDataWriteOperation,
} from '@/lib/consent/healthDataWriteAdmission';
import { activeHealthProcessingOwnerUserId } from '@/lib/consent/healthProcessingEpoch';

import { applyNotificationPreferencePatch } from './applyPreferences';
import { rescheduleReminders } from './deliver';
import { loadNotifPrefs, saveNotifPrefs, type NotifPrefs } from './store';

// Reads/writes the local-first notification preferences and reschedules the
// utility reminders whenever they change (docs/07 §3.4). Visible state updates
// only after local private persistence succeeds.
const KEY = ['notifPrefs'] as const;

export function useNotifPrefs() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const expectedOwnerUserId = activeHealthProcessingOwnerUserId();
      if (!expectedOwnerUserId) throw new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED);
      return runHealthDataOperation(expectedOwnerUserId, async (lease) => {
        const prefs = await loadNotifPrefs();
        lease.assertCurrent();
        return prefs;
      });
    },
    retry: 0,
  });
}

export function useUpdateNotifPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<NotifPrefs>) => {
      const expectedOwnerUserId = activeHealthProcessingOwnerUserId();
      if (!expectedOwnerUserId) throw new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED);
      return runHealthDataWriteOperation(expectedOwnerUserId, async (lease) => {
        const next = await applyNotificationPreferencePatch(
          patch,
          {
            save: saveNotifPrefs,
            reschedule: rescheduleReminders,
          },
          lease,
        );
        lease.assertCurrent();
        qc.setQueryData<NotifPrefs>(KEY, next);
        lease.assertCurrent();
        await qc.invalidateQueries({ queryKey: KEY });
        lease.assertCurrent();
        return next;
      });
    },
  });
}
