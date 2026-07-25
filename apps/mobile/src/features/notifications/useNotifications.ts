import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth/AuthProvider';
import {
  isOwnerQueryScopeCurrent,
  ownerQueryPrefixes,
  queryKeys,
  runOwnerQueryOperation,
} from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';

import { applyNotificationPreferencePatch } from './applyPreferences';
import { saveAndRescheduleNotifPrefs } from './deliver';
import { readNotifPrefs, type NotifPrefs, type NotifPrefsRead } from './store';

// Reads/writes the local-first notification preferences and reschedules the
// utility reminders whenever they change (docs/07 §3.4). Visible state updates
// only after local private persistence succeeds.
export function useNotifPrefs() {
  const ownerScope = useOwnerQueryScope();
  return useQuery<NotifPrefsRead>({
    queryKey: queryKeys.notificationPreferences(ownerScope),
    queryFn: () =>
      runOwnerQueryOperation(ownerScope, async (lease) => {
        const result = await readNotifPrefs();
        lease.assertCurrent();
        return result;
      }),
    networkMode: 'always',
    retry: 0,
    refetchOnWindowFocus: 'always',
  });
}

export function useUpdateNotifPrefs() {
  const qc = useQueryClient();
  const ownerScope = useOwnerQueryScope();
  const { user } = useAuth();
  const ownerId = user?.id.trim();
  return useMutation({
    networkMode: 'always',
    mutationFn: (patch: Partial<NotifPrefs>) =>
      runOwnerQueryOperation(ownerScope, async (lease) =>
        applyNotificationPreferencePatch(patch, {
          saveAndReschedule: async (nextPatch) => {
            lease.assertCurrent();
            return saveAndRescheduleNotifPrefs(
              nextPatch,
              ownerId
                ? {
                    ownerId,
                    ownerGeneration: lease.generation,
                    assertCurrent: lease.assertCurrent,
                  }
                : undefined,
            );
          },
        }),
      ),
    onSuccess: (next) => {
      if (!isOwnerQueryScopeCurrent(ownerScope)) return;
      const available = {
        status: 'available',
        prefs: next,
        format: 'current',
      } satisfies NotifPrefsRead;
      qc.setQueryData<NotifPrefsRead>(queryKeys.notificationPreferences(ownerScope), available);
    },
    onSettled: () => {
      if (!isOwnerQueryScopeCurrent(ownerScope)) return;
      void qc.invalidateQueries({
        queryKey: ownerQueryPrefixes.notificationPreferences(ownerScope),
      });
    },
  });
}
