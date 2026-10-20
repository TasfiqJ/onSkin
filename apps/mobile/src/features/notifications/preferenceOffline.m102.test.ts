import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { clearActiveHealthProcessingEpoch, setActiveHealthProcessingEpoch } from '@/lib/consent/healthProcessingEpoch';
import { useNotifPrefs, useUpdateNotifPrefs, useNotificationAuthorization } from './useNotifications';

const ports = vi.hoisted(() => ({
  save: vi.fn(), read: vi.fn(), reconcile: vi.fn(),
}));
vi.mock('react-native', () => ({ AppState: { addEventListener: () => ({ remove() {} }) } }));
vi.mock('./store', () => ({ loadNotifPrefs: ports.read, saveNotifPrefs: ports.save }));
vi.mock('./deliver', () => ({ getPermissionStatus: async () => 'unavailable', rescheduleReminders: ports.reconcile }));

let renderer: ReactTestRenderer | undefined;
let client: QueryClient;
let observed: ReturnType<typeof useNotifPrefs>;
let mutation: ReturnType<typeof useUpdateNotifPrefs>;
let authorization: ReturnType<typeof useNotificationAuthorization>;
function Probe() {
  observed = useNotifPrefs();
  mutation = useUpdateNotifPrefs();
  authorization = useNotificationAuthorization();
  return null;
}
async function flush() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  clearActiveHealthProcessingEpoch();
  const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  setActiveHealthProcessingEpoch(1, { ownerUserId: 'synthetic-preferences-owner', accountGeneration });
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  ports.read.mockReset().mockResolvedValue({ amTime: '07:30', amEnabled: false });
  ports.save.mockReset().mockImplementation(async (patch) => ({ amTime: '07:30', amEnabled: false, ...patch }));
  ports.reconcile.mockReset().mockResolvedValue(undefined);
  onlineManager.setOnline(false);
  await act(async () => {
    renderer = create(createElement(QueryClientProvider, { client }, createElement(Probe)));
  });
  await flush();
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
  client.clear();
  onlineManager.setOnline(true);
  clearActiveHealthProcessingEpoch();
});

it('reads device preferences/permission and saves while the actual QueryClient is offline', async () => {
  expect(observed.data).toMatchObject({ amTime: '07:30' });
  expect(authorization.data).toBe('unavailable');
  expect(observed.isPaused).toBe(false);
  let result: unknown;
  await act(async () => { result = await mutation.mutateAsync({ amTime: '08:00' }); });
  expect(result).toMatchObject({ amTime: '08:00', amEnabled: false });
  expect(ports.save).toHaveBeenCalledOnce();
  expect(mutation.isPaused).toBe(false);
});

it('reports a failed scheduler and retries the retained idempotent patch offline', async () => {
  ports.reconcile.mockRejectedValueOnce(new Error('synthetic native scheduling failure'));
  await act(async () => {
    await expect(mutation.mutateAsync({ amEnabled: true })).rejects.toThrow('synthetic native scheduling failure');
  });
  await flush();
  expect(mutation.isError).toBe(true);
  expect(mutation.variables).toEqual({ amEnabled: true });
  await act(async () => { await mutation.mutateAsync(mutation.variables!); });
  await flush();
  expect(mutation.isSuccess).toBe(true);
  expect(ports.save).toHaveBeenCalledTimes(2);
});
