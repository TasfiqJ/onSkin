import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { rescheduleReminders } from './deliver';
import { loadNotifPrefs, normalizeNotifPatch, saveNotifPrefs, type NotifPrefs } from './store';

// Reads/writes the local-first notification preferences and reschedules the
// utility reminders whenever they change (docs/07 §3.4). Optimistic so the
// settings toggles feel instant.
const KEY = ['notifPrefs'] as const;

export function useNotifPrefs() {
  return useQuery({ queryKey: KEY, queryFn: loadNotifPrefs, retry: 0 });
}

export function useUpdateNotifPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<NotifPrefs>) => {
      const next = await saveNotifPrefs(patch);
      await rescheduleReminders(next);
      return next;
    },
    onMutate: async (patch: Partial<NotifPrefs>) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<NotifPrefs>(KEY);
      if (prev) qc.setQueryData<NotifPrefs>(KEY, { ...prev, ...normalizeNotifPatch(patch) });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}
