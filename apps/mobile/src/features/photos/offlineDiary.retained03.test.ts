import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { createElement, useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { clearActiveHealthProcessingEpoch, setActiveHealthProcessingEpoch } from '@/lib/consent/healthProcessingEpoch';
import { usePhotoActions, usePhotos } from './usePhotos';

const ports = vi.hoisted(() => ({ read: vi.fn(), add: vi.fn(), remove: vi.fn(), reference: vi.fn(), note: vi.fn() }));
vi.mock('./store', () => ({ loadPhotos: ports.read, addPhotoWithOutcome: ports.add,
  removePhoto: ports.remove, setReference: ports.reference, updatePhoto: ports.note }));

let renderer: ReactTestRenderer;
let client: QueryClient;
let source: ReturnType<typeof usePhotos>;
let actions: ReturnType<typeof usePhotoActions>;
function Probe() {
  const nextSource = usePhotos();
  const nextActions = usePhotoActions();
  useEffect(() => { source = nextSource; actions = nextActions; }, [nextSource, nextActions]);
  return null;
}
async function flush() {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
}
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  clearActiveHealthProcessingEpoch();
  const accountGeneration = await runAccountGenerationOperation(lease => lease.generation);
  setActiveHealthProcessingEpoch(1, { ownerUserId: 'synthetic-offline-diary', accountGeneration });
  onlineManager.setOnline(false);
  ports.read.mockReset().mockResolvedValue([]);
  ports.add.mockReset().mockResolvedValue({ photo: { id: 'synthetic-photo' }, createdNow: true, sourceCleanupPending: false });
  ports.remove.mockReset().mockResolvedValue(undefined);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
});
async function mount() {
  await act(async () => { renderer = create(createElement(QueryClientProvider, { client }, createElement(Probe))); });
  await flush();
}
afterEach(async () => {
  await act(async () => { renderer?.unmount(); });
  client.clear();
  onlineManager.setOnline(true);
  clearActiveHealthProcessingEpoch();
});

it('opens the device-local diary on a cold offline mount', async () => {
  await mount();
  expect(ports.read).toHaveBeenCalledOnce();
  expect(source.isPaused).toBe(false);
  expect(source.sourceReady).toBe(true);
  expect(source.data?.count).toBe(0);
});

it('reports a local read refusal and retries it offline without waiting for connectivity', async () => {
  ports.read.mockRejectedValueOnce(new Error('synthetic encrypted storage unavailable'));
  await mount();
  expect(source.isError).toBe(true);
  await act(async () => { await source.retry(); });
  await flush();
  expect(source.sourceReady).toBe(true);
  expect(ports.read).toHaveBeenCalledTimes(2);
});

it('persists a captured photo offline instead of pausing a local mutation', async () => {
  await mount();
  // Store validation is independently covered; this synthetic input tests dispatch.
  await act(async () => { actions.add.mutate({ series: 'front', takenLocalDate: '2026-10-23', localUri: 'synthetic:local-only' }); });
  await flush();
  expect(ports.add).toHaveBeenCalledOnce();
  expect(actions.add.isPaused).toBe(false);
  expect(actions.add.isSuccess).toBe(true);
});

it('refreshes the diary after an offline deletion without leaving the storage gate pending', async () => {
  await mount();
  await act(async () => { actions.remove.mutate('synthetic-photo'); });
  await flush();
  expect(ports.remove).toHaveBeenCalledOnce();
  expect(actions.remove.isSuccess).toBe(true);
  expect(source.sourceReady).toBe(true);
});

it('keeps a local capture failure retryable offline without automatic replay', async () => {
  ports.add.mockRejectedValueOnce(new Error('synthetic local write refusal'));
  await mount();
  const input = { takenLocalDate: '2026-10-23', localUri: 'synthetic:local-only' };
  await act(async () => { actions.add.mutate(input); });
  await flush();
  expect(actions.add.isError).toBe(true);
  expect(ports.add).toHaveBeenCalledOnce();
  await act(async () => { await actions.add.mutateAsync(input); });
  await flush();
  expect(ports.add).toHaveBeenCalledTimes(2);
  expect(actions.add.isSuccess).toBe(true);
});

it('rejects an offline read crossing withdrawal instead of publishing the old diary', async () => {
  let release!: () => void;
  ports.read.mockImplementationOnce(() => new Promise<[]>(resolve => { release = () => resolve([]); }));
  await mount();
  expect(ports.read).toHaveBeenCalledOnce();
  await act(async () => { clearActiveHealthProcessingEpoch(); release(); });
  await flush();
  expect(source.sourceReady).toBe(false);
  expect(source.data).toBeUndefined();
});

it('keeps the diary closed when health authority is absent even offline', async () => {
  clearActiveHealthProcessingEpoch();
  await mount();
  expect(ports.read).not.toHaveBeenCalled();
  expect(source.sourceReady).toBe(false);
  expect(source.data).toBeUndefined();
});
