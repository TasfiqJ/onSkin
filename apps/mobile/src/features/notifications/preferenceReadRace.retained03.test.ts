import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { createElement, useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { clearActiveHealthProcessingEpoch, setActiveHealthProcessingEpoch } from '@/lib/consent/healthProcessingEpoch';
import { useNotifPrefs, useUpdateNotifPrefs } from './useNotifications';

const ports = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn(), reconcile: vi.fn() }));
vi.mock('react-native', () => ({ AppState: { addEventListener: () => ({ remove() {} }) } }));
vi.mock('./store', () => ({ loadNotifPrefs: ports.read, saveNotifPrefs: ports.save }));
vi.mock('./deliver', () => ({ rescheduleReminders: ports.reconcile }));

let renderer: ReactTestRenderer;
let client: QueryClient;
let update: ReturnType<typeof useUpdateNotifPrefs>;
let observed: ReturnType<typeof useNotifPrefs>;
let durable: { amEnabled: boolean; amTime: string };
let releaseRead: (value: typeof durable) => void;
function Probe() {
  const nextUpdate = useUpdateNotifPrefs();
  const nextObserved = useNotifPrefs();
  useEffect(() => { update = nextUpdate; observed = nextObserved; }, [nextUpdate, nextObserved]);
  return null;
}
async function flush() {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
}
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  clearActiveHealthProcessingEpoch();
  const accountGeneration = await runAccountGenerationOperation(lease => lease.generation);
  setActiveHealthProcessingEpoch(1, { ownerUserId: 'synthetic-preference-race', accountGeneration });
  onlineManager.setOnline(false);
  durable = { amEnabled: false, amTime: '07:30' };
  const oldRead = new Promise<typeof durable>(resolve => { releaseRead = resolve; });
  ports.read.mockReset().mockImplementation(async () => ({ ...durable })).mockReturnValueOnce(oldRead);
  ports.save.mockReset().mockImplementation(async patch => { durable = { ...durable, ...patch }; return { ...durable }; });
  ports.reconcile.mockReset().mockResolvedValue('web_preferences_only');
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await act(async () => { renderer = create(createElement(QueryClientProvider, { client }, createElement(Probe))); });
  expect(ports.read).toHaveBeenCalledOnce();
});
afterEach(async () => {
  await act(async () => { renderer.unmount(); releaseRead({ amEnabled: false, amTime: '07:30' }); });
  client.clear();
  onlineManager.setOnline(true);
  clearActiveHealthProcessingEpoch();
});

it('a pre-save initial read cannot replace the committed opt-in after successful scheduling', async () => {
  let pending!: Promise<unknown>;
  await act(async () => { pending = update.mutateAsync({ amEnabled: true }); });
  await flush();
  expect(durable.amEnabled).toBe(true);
  await act(async () => { releaseRead({ amEnabled: false, amTime: '07:30' }); await pending; });
  await flush();
  expect(observed.data).toMatchObject({ amEnabled: true });
});

it.each([true, false])('a pre-save read cannot replace saved amEnabled=%s when native scheduling needs retry', async enabled => {
  durable.amEnabled = !enabled;
  ports.reconcile.mockRejectedValueOnce(new Error('synthetic schedule refusal'));
  await act(async () => {
    await expect(update.mutateAsync({ amEnabled: enabled })).rejects.toThrow('PREFERENCES_SAVED_REMINDERS_UNCONFIRMED');
  });
  await act(async () => { releaseRead({ amEnabled: !enabled, amTime: '07:30' }); });
  await flush();
  expect(durable.amEnabled).toBe(enabled);
  expect(observed.data).toMatchObject({ amEnabled: enabled });
  expect(update.isError).toBe(true);
});

it('withdrawal while scheduling settles prevents preference cache publication', async () => {
  let releaseSchedule!: () => void;
  ports.reconcile.mockImplementationOnce(() => new Promise<void>(resolve => { releaseSchedule = resolve; }));
  let pending!: Promise<unknown>;
  await act(async () => { pending = update.mutateAsync({ amEnabled: true }).catch(error => error); });
  await flush();
  clearActiveHealthProcessingEpoch();
  await act(async () => { releaseSchedule(); expect(await pending).toBeInstanceOf(Error); });
  expect(client.getQueryData(['notifPrefs'])).toBeUndefined();
});
