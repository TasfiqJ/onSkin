import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  isOwnerQueryScopeCurrent,
  ownerQueryPrefixes,
  queryKeys,
  runOwnerQueryOperation,
} from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';

import { applyNotificationPreferencePatch } from './applyPreferences';
import { rescheduleReminders } from './deliver';
import { loadNotifPrefs, saveNotifPrefs, type NotifPrefs } from './store';

// Reads/writes the local-first notification preferences and reschedules the
// utility reminders whenever they change (docs/07 §3.4). Visible state updates
// only after local private persistence succeeds.
export function useNotifPrefs() {
  const ownerScope = useOwnerQueryScope();
  return useQuery({
    queryKey: queryKeys.notificationPreferences(ownerScope),
    queryFn: loadNotifPrefs,
    retry: 0,
  });
}

export function useUpdateNotifPrefs() {
  const qc = useQueryClient();
  const ownerScope = useOwnerQueryScope();
  return useMutation({
    mutationFn: (patch: Partial<NotifPrefs>) =>
      runOwnerQueryOperation(ownerScope, async (lease) =>
        applyNotificationPreferencePatch(patch, {
          save: async (nextPatch) => {
            lease.assertCurrent();
            return saveNotifPrefs(nextPatch);
          },
          reschedule: async (prefs) => {
            lease.assertCurrent();
            await rescheduleReminders(prefs);
          },
        }),
      ),
    onSuccess: (next) => {
      if (!isOwnerQueryScopeCurrent(ownerScope)) return;
      qc.setQueryData<NotifPrefs>(queryKeys.notificationPreferences(ownerScope), next);
    },
    onSettled: () => {
      if (!isOwnerQueryScopeCurrent(ownerScope)) return;
      void qc.invalidateQueries({
        queryKey: ownerQueryPrefixes.notificationPreferences(ownerScope),
      });
    },
  });
}
