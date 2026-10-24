import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { createElement, useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { useNotificationAuthorization } from './useNotifications';

const ports = vi.hoisted(() => ({ permission: 'authorized', read: vi.fn(), reconcile: vi.fn(), request: vi.fn() }));
vi.mock('react-native', () => ({ AppState: { addEventListener: () => ({ remove() {} }) } }));
vi.mock('./store', () => ({ loadNotifPrefs: vi.fn(), saveNotifPrefs: vi.fn() }));
vi.mock('./deliver', () => ({ getPermissionStatus: ports.read, rescheduleReminders: ports.reconcile, requestPermission: ports.request }));
let renderer: ReactTestRenderer | undefined;
let client: QueryClient;
let source: ReturnType<typeof useNotificationAuthorization>;
function Probe() {
  const next = { ...useNotificationAuthorization() };
  useEffect(() => { source = next; });
  return null;
}
async function flush() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); }); }
async function mount() {
  await act(async () => { renderer = create(createElement(QueryClientProvider, { client }, createElement(Probe))); });
  await flush();
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  ports.permission = 'authorized';
  ports.read.mockReset().mockImplementation(async () => ports.permission);
  ports.reconcile.mockReset().mockResolvedValue('disabled'); ports.request.mockReset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  onlineManager.setOnline(false);
});
afterEach(async () => {
  await act(async () => { renderer?.unmount(); }); renderer = undefined;
  client.clear(); onlineManager.setOnline(true);
  expect(ports.request).not.toHaveBeenCalled();
});

it.each(['denied', 'unavailable'])('publishes current %s permission after native reconciliation settles', async permission => {
  ports.reconcile.mockImplementationOnce(async () => { ports.permission = permission; return 'permission_denied'; });
  await mount();
  expect(source.data).toBe(permission);
});

it('withholds cached authorization while a foreground reconciliation is pending', async () => {
  await mount(); expect(source.data).toBe('authorized');
  let release!: () => void;
  ports.reconcile.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
  let pending!: Promise<unknown>;
  await act(async () => { pending = source.refetch(); }); await flush();
  expect(source.isFetching).toBe(true);
  expect(source.data).toBeUndefined();
  ports.permission = 'denied';
  await act(async () => { release(); await pending; }); await flush();
  expect(source.data).toBe('denied');
});

it('does not expose cached granted status after a revoked-permission cancellation fails', async () => {
  await mount(); expect(source.data).toBe('authorized');
  ports.permission = 'denied'; ports.reconcile.mockRejectedValueOnce(new Error('synthetic cancellation refusal'));
  await act(async () => { await source.refetch(); }); await flush();
  expect(source.isError).toBe(true);
  expect(source.data).toBeUndefined();
  await act(async () => { await source.refetch({ throwOnError: true }); }); await flush();
  expect(source.data).toBe('denied');
});

it('retains truthful permission-read failures and recovers only after an explicit retry', async () => {
  ports.read.mockRejectedValueOnce(new Error('synthetic permission bridge unavailable'));
  await mount();
  expect(source.isError).toBe(true); expect(source.data).toBeUndefined();
  ports.permission = 'not_determined';
  await act(async () => { await source.refetch({ throwOnError: true }); }); await flush();
  expect(source.data).toBe('not_determined');
});
