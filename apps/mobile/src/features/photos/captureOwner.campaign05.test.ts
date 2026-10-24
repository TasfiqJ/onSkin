import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { createElement, useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { clearActiveHealthProcessingEpoch, setActiveHealthProcessingEpoch } from '@/lib/consent/healthProcessingEpoch';
import { usePhotoActions } from './usePhotos';

const ports = vi.hoisted(() => ({ add: vi.fn() }));
vi.mock('./store', () => ({ addPhotoWithOutcome: ports.add, loadPhotos: vi.fn(),
  removePhoto: vi.fn(), setReference: vi.fn(), updatePhoto: vi.fn() }));
let renderer: ReactTestRenderer;
let client: QueryClient;
let actions: ReturnType<typeof usePhotoActions>;
const input = { takenLocalDate: '2026-10-24', localUri: 'synthetic:camera-port' };
function Probe() {
  const next = usePhotoActions();
  useEffect(() => { actions = next; }, [next]);
  return null;
}
async function grant(owner = 'synthetic-a') {
  clearActiveHealthProcessingEpoch();
  const accountGeneration = await runAccountGenerationOperation(lease => lease.generation);
  setActiveHealthProcessingEpoch(1, { ownerUserId: owner, accountGeneration });
}
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  await grant(); onlineManager.setOnline(false);
  ports.add.mockReset().mockResolvedValue({ photo: { id: 'synthetic' }, createdNow: true, sourceCleanupPending: false });
  client = new QueryClient();
  await act(async () => { renderer = create(createElement(QueryClientProvider, { client }, createElement(Probe))); });
});
afterEach(async () => {
  await act(async () => renderer.unmount()); client.clear(); onlineManager.setOnline(true); clearActiveHealthProcessingEpoch();
});
it.each(['synthetic-a', 'synthetic-b'])('an old capture callback cannot adopt a new grant for %s', async owner => {
  const retired = actions.add.mutateAsync;
  await act(async () => { await grant(owner); });
  await act(async () => { await expect(retired(input)).rejects.toThrow(/HEALTH_DATA_WRITE/); });
  expect(ports.add).not.toHaveBeenCalled();
  await act(async () => { await actions.add.mutateAsync(input); });
  expect(ports.add).toHaveBeenCalledOnce();
});
it('late capture settlement after withdrawal never invalidates a successor diary or reports success', async () => {
  let release!: () => void;
  ports.add.mockImplementationOnce(() => new Promise(resolve => { release = () => resolve({ photo: { id: 'synthetic' } }); }));
  let pending!: Promise<unknown>;
  await act(async () => { pending = actions.add.mutateAsync(input).catch(error => error); });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  await act(async () => { await grant('synthetic-b'); release(); expect(await pending).toBeInstanceOf(Error); });
  expect(invalidate).not.toHaveBeenCalled(); expect(actions.add.isSuccess).toBe(false);
});
