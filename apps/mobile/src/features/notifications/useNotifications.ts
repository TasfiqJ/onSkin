import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import {
  HEALTH_DATA_WRITE_ADMISSION_CLOSED,
  captureHealthDataWriteLease,
  assertHealthDataWriteLease,
  runHealthDataOperation,
  runHealthDataWriteOperation,
} from '@/lib/consent/healthDataWriteAdmission';
import {
  activeHealthProcessingLeaseSnapshot,
  subscribeActiveHealthProcessingLeaseChanges,
} from '@/lib/consent/healthProcessingEpoch';

import { applyNotificationPreferencePatch, NotificationPreferenceSaveError } from './applyPreferences';
import { getPermissionStatus, rescheduleReminders } from './deliver';
import { loadNotifPrefs, saveNotifPrefs, type NotifPrefs } from './store';

// Reads/writes the local-first notification preferences and reschedules the
// utility reminders whenever they change (docs/07 §3.4). Visible state updates
// only after local private persistence succeeds.
const KEY = ['notifPrefs'] as const;
const AUTHORIZATION_KEY = ['notificationAuthorization'] as const;

export function useNotificationAuthorization() {
  const qc = useQueryClient();
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void qc.invalidateQueries({ queryKey: AUTHORIZATION_KEY });
      }
    });
    return () => subscription.remove();
  }, [qc]);
  const query = useQuery({
    queryKey: AUTHORIZATION_KEY,
    networkMode: 'always',
    queryFn: async () => {
      // Reconcile on every settings mount/foreground read. Revocation cancels
      // existing native schedules; a later user-granted state rebuilds only the
      // still-stored, independently controlled purposes.
      await rescheduleReminders();
      // Reconciliation can outlive a permission change. Publish the status
      // observed after it settles, never its earlier authorization snapshot.
      return getPermissionStatus();
    },
    retry: 0,
    staleTime: 0,
  });
  // A foreground read or failed native cancellation cannot keep an old grant
  // visible as current permission. Settings already renders undefined as unavailable.
  return { ...query, data: query.isFetching || query.isError ? undefined : query.data };
}

export function useNotifPrefs() {
  const published = useSyncExternalStore(subscribeActiveHealthProcessingLeaseChanges, activeHealthProcessingLeaseSnapshot, () => null);
  const [, checkExpiry] = useState(0);
  useEffect(() => {
    if (published?.expiresAt == null) return;
    const timer = setTimeout(() => checkExpiry(value => value + 1), Math.max(0, published.expiresAt - Date.now()) + 1);
    return () => clearTimeout(timer);
  }, [published]);
  const authority = activeHealthProcessingLeaseSnapshot();
  const query = useQuery({
    queryKey: authority ? [...KEY, authority.generation, authority.ownerUserId, authority.accountGeneration] : [...KEY, 'closed'],
    networkMode: 'always',
    enabled: authority?.ownerUserId != null && authority.accountGeneration != null,
    // The app-wide one-minute freshness cannot stand in for a device read
    // when returning to settings after storage or local intent changes.
    staleTime: 0,
    queryFn: async () => {
      const expectedOwnerUserId = authority?.ownerUserId;
      if (!authority || !expectedOwnerUserId) throw new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED);
      return runHealthDataOperation(expectedOwnerUserId, async (lease) => {
        if (lease.generation !== authority.generation) throw new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED);
        const prefs = await loadNotifPrefs({ strict: true });
        lease.assertCurrent();
        return prefs;
      });
    },
    retry: 0,
  });
  return { ...query, data: authority === null || query.isFetching || query.isError ? undefined : query.data };
}

export function useUpdateNotifPrefs() {
  const qc = useQueryClient();
  // A permission response may outlive this screen and its owner.
  let expectedLease: ReturnType<typeof captureHealthDataWriteLease> | undefined;
  try { expectedLease = captureHealthDataWriteLease(); } catch { /* admission closed */ }
  const mutation = useMutation({
    networkMode: 'always',
    retry: false,
    mutationFn: async ({ patch, accepted }: { patch: Partial<NotifPrefs>; accepted: typeof expectedLease }) => {
      if (!accepted) throw new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED);
      assertHealthDataWriteLease(accepted);
      const expectedOwnerUserId = accepted.ownerUserId;
      const queryKey = [...KEY, accepted.generation, accepted.ownerUserId, accepted.accountGeneration];
      return runHealthDataWriteOperation(expectedOwnerUserId, async (lease) => {
        let result: Awaited<ReturnType<typeof applyNotificationPreferencePatch>>;
        try {
          result = await applyNotificationPreferencePatch(
            patch,
            {
              save: saveNotifPrefs,
              reschedule: rescheduleReminders,
            },
            lease,
          );
        } catch (error) {
          lease.assertCurrent();
          if (error instanceof NotificationPreferenceSaveError) {
            // A data-less initial read can still publish its pre-save snapshot.
            // Retire it before exposing the durable intent that needs retry.
            await qc.cancelQueries({ queryKey: KEY });
            lease.assertCurrent();
            qc.setQueryData<NotifPrefs>(queryKey, error.prefs);
          }
          throw error;
        }
        lease.assertCurrent();
        const next = result.prefs;
        qc.setQueryData<NotifPrefs>(queryKey, next);
        lease.assertCurrent();
        await qc.invalidateQueries({ queryKey: KEY });
        lease.assertCurrent();
        return result;
      });
    },
  });
  const current = expectedLease !== undefined && mutation.variables?.accepted?.generation === expectedLease.generation;
  const actions = {
    // Observer options may change while an OS permission request is pending.
    // Carry the render's lease in variables instead of adopting its successor.
    mutateAsync: (patch: Partial<NotifPrefs>) => mutation.mutateAsync({ patch, accepted: expectedLease }),
    mutate: (patch: Partial<NotifPrefs>) => { mutation.mutate({ patch, accepted: expectedLease }); },
  };
  return current ? { ...mutation, variables: mutation.variables?.patch, ...actions } : {
    ...mutation, ...actions, data: undefined, error: null, variables: undefined,
    status: 'idle' as const, isIdle: true as const, isSuccess: false as const,
    isError: false as const, isPending: false as const, isPaused: false,
  };
}
