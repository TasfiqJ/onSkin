import { Pressable } from 'react-native';
import { createElement, useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { clearActiveHealthProcessingEpoch, setActiveHealthProcessingEpoch } from '@/lib/consent/healthProcessingEpoch';
import { notificationPreferenceRetryPatch } from './applyPreferences';
import { configureNotifications } from './startup';
import { rescheduleReminders } from './deliver';
import { loadNotifPrefs } from './store';
import { useNotifPrefs, useUpdateNotifPrefs } from './useNotifications';
import { NotificationPreferenceSaveNotice, NotificationPreferenceSavedNotice } from './NotificationPreferenceSaveNotice';

// External ports only. The complete startup/save/scheduler/native-compensation/
// lease/QueryClient/hook/visible-notice chain is production code.
const ports = vi.hoisted(() => ({
  storage: new Map<string, string>(), native: new Map<string, unknown>(),
  failSetup: true, failSave: false, denied: false, failClear: false,
  category: vi.fn(async () => {}), cancel: vi.fn(async (_id: string) => {}),
  schedule: vi.fn(async (_request: { identifier: string }) => ''),
  billing: vi.fn(async () => null),
}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' },
  AppState: { addEventListener: () => ({ remove() {} }) }, Pressable: 'Pressable', View: 'View',
}));
vi.mock('@/components/ui', () => ({ Text: 'Text' }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'synthetic-notification-id' }));
vi.mock('expo-notifications', () => ({
  setNotificationHandler() {}, setBadgeCountAsync: async () => true,
  setNotificationCategoryAsync: ports.category, setNotificationChannelAsync: async () => {},
  getPermissionsAsync: async () => ({
    status: ports.denied ? 'denied' : 'granted', granted: !ports.denied, canAskAgain: true,
  }),
  SchedulableTriggerInputTypes: { DAILY: 'daily', WEEKLY: 'weekly', DATE: 'date' },
  cancelAllScheduledNotificationsAsync: async () => { if (ports.failClear) throw new Error('cancel-failed'); ports.native.clear(); },
  clearLastNotificationResponseAsync: async () => {}, dismissAllNotificationsAsync: async () => {},
  dismissNotificationAsync: async () => {},
  cancelScheduledNotificationAsync: ports.cancel, scheduleNotificationAsync: ports.schedule,
}));
vi.mock('@/features/subscription/store', () => ({ loadEntitlement: ports.billing }));
vi.mock('@/features/routine/reviewGate', () => ({ canUseRoutineCadence: () => false, canUseRoutineRecovery: () => false }));
vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: async (key: string) => ports.storage.get(key) ?? null,
  removePrivateItem: async (key: string) => { ports.storage.delete(key); },
  updatePrivateItem: async (key: string, fn: (old: string | null) => string | null) => {
    if (ports.failSave) throw new Error('synthetic-storage-refusal');
    const next = fn(ports.storage.get(key) ?? null);
    if (next === null) ports.storage.delete(key); else ports.storage.set(key, next);
  },
}));

let renderer: ReactTestRenderer | undefined;
let client: QueryClient;
let mutation: ReturnType<typeof useUpdateNotifPrefs>;
function Probe() {
  useNotifPrefs();
  const update = useUpdateNotifPrefs();
  useEffect(() => { mutation = update; }, [update]);
  if (update.isError) return createElement(NotificationPreferenceSaveNotice, {
    error: update.error, pending: update.isPending, onRetry: () => update.mutate(notificationPreferenceRetryPatch(update.error, update.variables)),
  });
  if (update.isSuccess) return createElement(NotificationPreferenceSavedNotice, { scheduling: update.data.scheduling });
  return null;
}
async function flush() {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
}
async function mount() {
  await act(async () => { renderer = create(createElement(QueryClientProvider, { client }, createElement(Probe))); });
  await flush();
}
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  clearActiveHealthProcessingEpoch();
  const accountGeneration = await runAccountGenerationOperation(lease => lease.generation);
  setActiveHealthProcessingEpoch(1, { ownerUserId: 'synthetic-owner-a', accountGeneration });
  ports.storage.clear(); ports.native.clear(); ports.failSetup = true; ports.failSave = false; ports.denied = false; ports.failClear = false;
  ports.category.mockReset().mockImplementation(async () => { if (ports.failSetup) throw new Error('setup-unavailable'); });
  ports.cancel.mockReset().mockImplementation(async id => { ports.native.delete(id); });
  ports.schedule.mockReset().mockImplementation(async request => { ports.native.set(request.identifier, request); return request.identifier; });
  ports.billing.mockClear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
});
afterEach(async () => {
  await act(async () => renderer?.unmount()); renderer = undefined;
  client.clear(); clearActiveHealthProcessingEpoch();
});

it('startup unavailable -> durable save -> visible notice -> recovered port -> actual Retry -> schedule acknowledgement', async () => {
  const first = configureNotifications();
  expect(configureNotifications()).toBe(first);
  expect(await first).toBe('unavailable');
  expect(ports.category).toHaveBeenCalledTimes(4);
  await mount();
  await act(async () => { await expect(mutation.mutateAsync({ amEnabled: true })).rejects.toThrow('PREFERENCES_SAVED_REMINDERS_UNCONFIRMED'); });
  await flush();
  expect(await loadNotifPrefs()).toMatchObject({ amEnabled: true, pmEnabled: false, captureReminders: false });
  expect(client.getQueryData(['notifPrefs'])).toMatchObject({ amEnabled: true });
  expect(JSON.stringify(renderer!.toJSON())).toContain('Your preferences are saved, but reminders were not confirmed');
  expect(ports.native.size).toBe(0);
  expect(ports.category).toHaveBeenCalledTimes(8);
  await act(async () => { renderer!.root.findByType(Pressable).props.onPress(); });
  await flush();
  expect(ports.category).toHaveBeenCalledTimes(12);
  ports.failSetup = false;
  await act(async () => { renderer!.root.findByType(Pressable).props.onPress(); });
  await flush();
  expect(mutation.isSuccess).toBe(true);
  expect(mutation.data?.scheduling).toBe('scheduled');
  expect(JSON.stringify(renderer!.toJSON())).toContain('OS delivery is not guaranteed');
  expect(ports.category).toHaveBeenCalledTimes(16);
  expect(ports.native.size).toBe(1);
  expect(await configureNotifications()).toBe('ready');
  expect(ports.category).toHaveBeenCalledTimes(16);
});

it('distinguishes all-off and denied without opting in or claiming scheduling', async () => {
  expect(await rescheduleReminders()).toBe('disabled');
  ports.denied = true;
  expect(await rescheduleReminders()).toBe('permission_denied');
  expect(ports.schedule).not.toHaveBeenCalled();
  expect(ports.category).not.toHaveBeenCalled();
});

it('storage refusal does not schedule or publish saved status', async () => {
  await mount(); ports.failSave = true;
  await act(async () => { await expect(mutation.mutateAsync({ amEnabled: true })).rejects.toThrow('synthetic-storage-refusal'); });
  await flush();
  expect(JSON.stringify(renderer!.toJSON())).toContain('Your preferences may be saved');
  expect(ports.schedule).not.toHaveBeenCalled();
  expect(await loadNotifPrefs()).toMatchObject({ amEnabled: false });
});

it('concurrent saves converge to the latest purpose/time with one fixed native ID', async () => {
  await mount();
  await act(async () => { await Promise.all([
    mutation.mutateAsync({ amEnabled: true, amTime: '08:00' }),
    mutation.mutateAsync({ amTime: '09:00' }), mutation.mutateAsync({ amTime: '09:00' }),
  ]); });
  expect(await loadNotifPrefs()).toMatchObject({ amEnabled: true, amTime: '09:00', captureReminders: false, promotionalOptIn: false });
  expect(ports.native.size).toBe(1);
  const request = [...ports.native.values()][0] as { trigger: { hour: number } };
  expect(request.trigger.hour).toBe(9);
});

it('compensates commit-then-reject, retains independent billing reconciliation, and retries', async () => {
  await mount();
  ports.schedule.mockImplementationOnce(async request => { ports.native.set(request.identifier, request); throw new Error('bridge-response-lost'); });
  await act(async () => { await expect(mutation.mutateAsync({ amEnabled: true })).rejects.toThrow('PREFERENCES_SAVED_REMINDERS_UNCONFIRMED'); });
  expect(ports.native.size).toBe(0);
  expect(ports.billing).toHaveBeenCalled();
  await act(async () => { await mutation.mutateAsync({ amEnabled: true }); });
  expect(ports.native.size).toBe(1);
});

it('never publishes an old saved/scheduled result after health generation replacement', async () => {
  await mount();
  let release!: () => void;
  let entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  ports.schedule.mockImplementationOnce(async request => {
    entered(); await gate; ports.native.set(request.identifier, request); return request.identifier;
  });
  let pending!: Promise<unknown>;
  await act(async () => { pending = mutation.mutateAsync({ amEnabled: true }).catch(error => error); await started; });
  clearActiveHealthProcessingEpoch();
  const accountGeneration = await runAccountGenerationOperation(lease => lease.generation);
  setActiveHealthProcessingEpoch(2, { ownerUserId: 'synthetic-owner-b', accountGeneration });
  await act(async () => { release(); expect(await pending).toBeInstanceOf(Error); });
  expect(ports.native.size).toBe(0);
  expect(client.getQueryData(['notifPrefs'])).not.toMatchObject({ amEnabled: true });
  expect(mutation.isSuccess).toBe(false);
});

it('cancel failure remains saved/unconfirmed until a full safe retry', async () => {
  await mount(); ports.failClear = true;
  await act(async () => { await expect(mutation.mutateAsync({ amEnabled: true })).rejects.toThrow('PREFERENCES_SAVED_REMINDERS_UNCONFIRMED'); });
  expect(ports.schedule).not.toHaveBeenCalled();
  // Failed global cleanup quarantines all native work, including billing.
  expect(ports.billing).not.toHaveBeenCalled();
  ports.failClear = false;
  await act(async () => { await mutation.mutateAsync({ amEnabled: true }); });
  expect(ports.native.size).toBe(1);
});

it('permission revoked at native settlement compensates and cannot claim scheduling', async () => {
  await mount();
  ports.schedule.mockImplementationOnce(async request => {
    ports.native.set(request.identifier, request); ports.denied = true; return request.identifier;
  });
  await act(async () => { await expect(mutation.mutateAsync({ amEnabled: true })).rejects.toThrow('PREFERENCES_SAVED_REMINDERS_UNCONFIRMED'); });
  expect(ports.native.size).toBe(0);
  await act(async () => { await mutation.mutateAsync({ amEnabled: true }); });
  await vi.waitFor(async () => { await flush(); expect(mutation.isSuccess).toBe(true); });
  expect(mutation.data?.scheduling).toBe('permission_denied');
  expect(ports.native.size).toBe(0);
});

it('a saved failure Retry cannot restore an older opt-in after a later durable opt-out', async () => {
  await mount();
  ports.schedule.mockRejectedValueOnce(new Error('schedule failed'));
  let failed: unknown;
  await act(async () => { failed = await mutation.mutateAsync({ amEnabled: true }).catch(error => error); });
  // Another admitted screen changes the current durable intent.
  const { saveNotifPrefs } = await import('./store');
  await saveNotifPrefs({ amEnabled: false });
  const patch = notificationPreferenceRetryPatch(failed, { amEnabled: true });
  expect(patch).toEqual({});
  await act(async () => { await mutation.mutateAsync(patch); });
  await vi.waitFor(async () => { await flush(); expect(mutation.isSuccess).toBe(true); });
  expect(mutation.data?.scheduling).toBe('disabled');
  expect(await loadNotifPrefs()).toMatchObject({ amEnabled: false });
  expect(ports.native.size).toBe(0);
});

it('a partially scheduled multi-purpose save is fully compensated before Retry', async () => {
  await mount();
  ports.schedule.mockImplementationOnce(async request => {
    ports.native.set(request.identifier, request); return request.identifier;
  }).mockImplementationOnce(async request => {
    ports.native.set(request.identifier, request); throw new Error('second-native-response-lost');
  });
  await act(async () => { await expect(mutation.mutateAsync({ amEnabled: true, pmEnabled: true }))
    .rejects.toThrow('PREFERENCES_SAVED_REMINDERS_UNCONFIRMED'); });
  expect(ports.native.size).toBe(0);
  await act(async () => { await mutation.mutateAsync({}); });
  expect(ports.native.size).toBe(2);
});
