import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { clearActiveHealthProcessingEpoch, setActiveHealthProcessingEpoch } from '@/lib/consent/healthProcessingEpoch';
import { useShelfMutations } from './mutations';
import { loadShelf } from './store';

const ports = vi.hoisted(() => ({ bytes: new Map<string, string>(), write: vi.fn(), track: vi.fn() }));
vi.mock('expo-crypto', () => ({ randomUUID: () => '10000000-0000-4000-8000-000000000001' }));
vi.mock('@/lib/analytics/track', () => ({ track: ports.track }));
vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: async (key: string) => ports.bytes.get(key) ?? null,
  removePrivateItem: async (key: string) => { ports.bytes.delete(key); },
  updatePrivateItem: async (key: string, update: (raw: string | null) => string | null) => {
    ports.write();
    const next = update(ports.bytes.get(key) ?? null);
    if (next === null) ports.bytes.delete(key); else ports.bytes.set(key, next);
  },
}));

let client: QueryClient;
let renderer: ReactTestRenderer;
let actions: ReturnType<typeof useShelfMutations>;
function Probe() {
  const next = useShelfMutations();
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
  ports.bytes.clear(); ports.write.mockClear(); ports.track.mockClear();
  await grant();
  client = new QueryClient();
  await act(async () => { renderer = create(createElement(QueryClientProvider, { client }, createElement(Probe))); });
});
afterEach(async () => {
  await act(async () => renderer.unmount()); client.clear(); clearActiveHealthProcessingEpoch();
});

it.each(['synthetic-b', 'synthetic-a'])('a retired intake cannot write after a grant changes to %s', async owner => {
  const retired = actions.add;
  await grant(owner);
  await act(async () => { renderer.update(createElement(QueryClientProvider, { client }, createElement(Probe))); });
  await expect(retired({ name: 'Synthetic old intake', addedVia: 'manual' })).rejects.toThrow(/HEALTH_DATA_WRITE/);
  expect(ports.write).not.toHaveBeenCalled(); expect(ports.track).not.toHaveBeenCalled();
  expect(await loadShelf()).toEqual([]);
  await act(async () => { await actions.add({ name: 'Synthetic current intake', addedVia: 'manual' }); });
  expect((await loadShelf()).map(row => row.name)).toEqual(['Synthetic current intake']);
});

it('returning A cannot resurrect its previous render authorization', async () => {
  const retired = actions.add;
  await grant('synthetic-b'); await grant('synthetic-a');
  await expect(retired({ name: 'Synthetic old intake', addedVia: 'manual' })).rejects.toThrow(/HEALTH_DATA_WRITE/);
  expect(ports.write).not.toHaveBeenCalled();
});

it.each(['edit', 'setOpened', 'markFinished', 'markDiscarded', 'remove', 'replace'] as const)(
  'retired %s rejects before touching local persistence or cache', async action => {
    const retired = actions;
    await grant('synthetic-b');
    const cancel = vi.spyOn(client, 'cancelQueries');
    const invoke = () => action === 'edit' ? retired.edit('old-product', { name: 'Synthetic' })
      : action === 'setOpened' ? retired.setOpened('old-product', { isOpened: true, openedAt: '2026-10-24' })
      : action === 'replace' ? retired.replace('old-product', { isOpened: false, openedAt: null }, '20000000-0000-4000-8000-000000000002')
      : retired[action]('old-product');
    await expect(invoke()).rejects.toThrow(/HEALTH_DATA_WRITE/);
    expect(ports.write).not.toHaveBeenCalled(); expect(cancel).not.toHaveBeenCalled();
  },
);
