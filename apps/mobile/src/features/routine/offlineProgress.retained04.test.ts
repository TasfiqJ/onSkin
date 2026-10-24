import { randomUUID } from 'node:crypto';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { createElement, useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { clearActiveHealthProcessingEpoch, setActiveHealthProcessingEpoch } from '@/lib/consent/healthProcessingEpoch';
import { getCompletionSummary, toggleCompletion } from '@/features/today/completionsStore';
import { localDateString } from '@/features/today/useToday';
import { useProgress } from './useProgress';

const ports = vi.hoisted(() => ({ storage: new Map<string, string>(), readError: false, readGate: null as Promise<void> | null, configured: false, rpc: vi.fn() }));
vi.mock('expo-crypto', () => ({ randomUUID: () => randomUUID() }));
vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: async (key: string) => {
    if (ports.readError) throw new Error('synthetic local read refusal');
    if (ports.readGate) await ports.readGate;
    return ports.storage.get(key) ?? null;
  },
  setPrivateItem: async (key: string, value: string) => { ports.storage.set(key, value); },
  removePrivateItem: async (key: string) => { ports.storage.delete(key); },
  updatePrivateItem: async (key: string, update: (current: string | null) => string | null) => {
    const next = update(ports.storage.get(key) ?? null);
    if (next === null) ports.storage.delete(key); else ports.storage.set(key, next);
  },
}));
vi.mock('@/lib/env', () => ({ get isSupabaseConfigured() { return ports.configured; } }));
vi.mock('@/lib/supabase/client', () => ({ supabase: { rpc: ports.rpc } }));
vi.mock('@/features/today/useRoutineClock', () => ({ useRoutineClock: () => ({ localDate: localDateString() }) }));

let renderer: ReactTestRenderer | undefined;
let client: QueryClient;
let source: ReturnType<typeof useProgress>;
function Probe() {
  const next = { ...useProgress() };
  useEffect(() => { source = next; });
  return null;
}
async function flush() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); }); }
async function mount() {
  await act(async () => { renderer = create(createElement(QueryClientProvider, { client }, createElement(Probe))); });
  await flush();
}
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  clearActiveHealthProcessingEpoch();
  const accountGeneration = await runAccountGenerationOperation(lease => lease.generation);
  setActiveHealthProcessingEpoch(1, { ownerUserId: 'synthetic-progress-a', accountGeneration });
  ports.storage.clear(); ports.readError = false; ports.readGate = null; ports.configured = false;
  ports.rpc.mockReset().mockRejectedValue(new Error('synthetic remote unavailable'));
  const date = localDateString();
  await toggleCompletion('PM:local-moisturizer', date, { phase: 'PM', stepKeys: ['PM:local-moisturizer'] });
  onlineManager.setOnline(false);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: Infinity } } });
});
afterEach(async () => {
  await act(async () => { renderer?.unmount(); }); renderer = undefined;
  client.clear(); onlineManager.setOnline(true); clearActiveHealthProcessingEpoch();
});

it('loads a durable completed PM night on a cold offline mount', async () => {
  expect((await getCompletionSummary()).completedDates).toContain(localDateString());
  await mount();
  expect(source.isPaused).toBe(false);
  expect(source.data).toMatchObject({ streak: 1, weeklyDone: 1, serverStatus: 'not_configured' });
});

it('refreshes offline after a duplicate completion without losing the visible streak', async () => {
  onlineManager.setOnline(true); await mount();
  expect(source.data?.streak).toBe(1);
  onlineManager.setOnline(false);
  await toggleCompletion('PM:local-moisturizer', localDateString(), { phase: 'PM', stepKeys: ['PM:local-moisturizer'] });
  await act(async () => { await client.invalidateQueries({ queryKey: ['progress'] }); });
  await flush();
  expect(source.isPaused).toBe(false);
  expect(source.data).toMatchObject({ streak: 1, weeklyDone: 1 });
});

it('reports configured cross-device data unavailable offline without contacting the provider', async () => {
  ports.configured = true; await mount();
  expect(source.data).toMatchObject({ streak: 1, weeklyDone: 1, serverStatus: 'unavailable' });
  expect(ports.rpc).not.toHaveBeenCalled();
});

it('surfaces local storage refusal and allows an explicit offline retry', async () => {
  ports.readError = true; await mount(); await flush(); await flush();
  expect(source.isError).toBe(true);
  expect(source.data).toBeUndefined();
  ports.readError = false;
  await act(async () => { await source.refetch({ throwOnError: true }); }); await flush();
  expect(source.data?.streak).toBe(1);
});

it('does not turn absent health authority into an empty or successful offline projection', async () => {
  clearActiveHealthProcessingEpoch(); await mount(); await flush(); await flush();
  expect(source.isError).toBe(true);
  expect(source.data).toBeUndefined();
  expect(ports.rpc).not.toHaveBeenCalled();
});

it('does not present retained totals as current after a local read fails', async () => {
  onlineManager.setOnline(true); await mount(); expect(source.data?.streak).toBe(1);
  ports.readError = true;
  await act(async () => { await source.refetch(); }); await flush();
  expect(source.isError).toBe(true); expect(source.data).toBeUndefined();
});

it('refuses a late offline read after owner withdrawal and regrant', async () => {
  let release!: () => void;
  ports.readGate = new Promise<void>(resolve => { release = resolve; });
  await mount();
  clearActiveHealthProcessingEpoch();
  const accountGeneration = await runAccountGenerationOperation(lease => lease.generation);
  setActiveHealthProcessingEpoch(2, { ownerUserId: 'synthetic-progress-b', accountGeneration });
  await act(async () => { release(); }); await flush(); await flush();
  expect(source.data).toBeUndefined();
  expect(source.isError).toBe(true);
});
