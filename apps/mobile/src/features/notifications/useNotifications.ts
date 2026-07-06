import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { applyNotificationPreferencePatch } from './applyPreferences';
import { rescheduleReminders } from './deliver';
import { loadNotifPrefs, saveNotifPrefs, type NotifPrefs } from './store';

// Reads/writes the local-first notification preferences and reschedules the
// utility reminders whenever they change (docs/07 §3.4). Visible state updates
// only after local private persistence succeeds.
const KEY = ['notifPrefs'] as const;

export function useNotifPrefs() {
  return useQuery({ queryKey: KEY, queryFn: loadNotifPrefs, retry: 0 });
}

export function useUpdateNotifPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<NotifPrefs>) => {
      return applyNotificationPreferencePatch(patch, {
        save: saveNotifPrefs,
        reschedule: rescheduleReminders,
      });
    },
    onSuccess: (next) => qc.setQueryData<NotifPrefs>(KEY, next),
    onSettled: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}
