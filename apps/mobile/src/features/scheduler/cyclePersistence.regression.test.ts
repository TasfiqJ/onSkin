import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import {
  activeHealthProcessingLeaseSnapshot,
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

import * as store from './cycleStore';
import { useCycle, useCycleMutations, type CycleHookResult } from './useCycle';

// Real React, TanStack, cycleStore and account/health authority. Only unrelated
// clinical inputs and the decoded private I/O adapter are fixtures. This suite
// is NOT crypto, native process-death, real DST, or professional-review evidence.
const io = vi.hoisted(() => ({
  values: new Map<string, string>(),
  tails: new Map<string, Promise<void>>(),
  reads: [] as string[],
  writes: [] as string[],
  day: '2026-09-29',
  cadence: true,
  recovery: true,
  readFailure: null as Error | null,
  writeFailure: null as Error | null,
  beforeRead: null as ((key: string) => Promise<void>) | null,
  beforeUpdate: null as (() => Promise<void>) | null,
  appListeners: new Set<(state: string) => void>(),
  track: vi.fn(),
}));

vi.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: (_event: string, listener: (state: string) => void) => {
      io.appListeners.add(listener);
      return { remove: () => io.appListeners.delete(listener) };
    },
  },
}));
vi.mock('@/features/today/useToday', () => ({ localDateString: () => io.day }));
vi.mock('@/features/routine/reviewGate', () => ({
  canUseRoutineCadence: () => io.cadence,
  canUseRoutineRecovery: () => io.recovery,
}));
vi.mock('@/features/routine/sequencing', () => ({
  routinePhasedIntroductionDelayDays: () => (io.cadence ? 7 : null),
  shippableRoutineCadencePolicy: () => io.cadence ? {
    recoveryWindows: { irritationDays: 7, procedureChoicesDays: [3, 5, 7, 10, 14] },
  } : null,
}));
vi.mock('@/features/routine/useRamp', () => ({
  useRamp: () => ({
    items: [], isLoading: false, isError: false, sourceReady: true, isExample: false,
  }),
}));
vi.mock('@/features/shelf/useShelf', () => ({
  useShelf: () => ({ data: { items: [], conflictChoices: [] }, isLoading: false, isError: false }),
}));
vi.mock('./profile', () => ({
  useProfileBits: () => ({
    data: {
      source: 'local', sensitivity: 'normal', pregnancy: false,
      pregnancySafety: null, pregnancyStatus: 'none', goals: [],
    },
    isLoading: false, isError: false,
  }),
}));
vi.mock('./orchestrate', () => ({
  orchestrate: () => ({ cycle: null, amDaily: [], cycleActives: [], notes: [], conflictChoices: [] }),
}));
vi.mock('@/lib/analytics/track', () => ({ track: io.track }));
vi.mock('@/lib/storage/privateKV', async () => {
  const admission = await import('@/lib/consent/healthDataWriteAdmission');
  const getPrivateItem = async (key: string) => {
    const lease = admission.captureHealthPurposePrivateDataWriteLease(key);
    io.reads.push(key);
    const value = io.values.get(key) ?? null;
    await io.beforeRead?.(key);
    if (io.readFailure) throw io.readFailure;
    if (lease) admission.assertHealthDataWriteLease(lease);
    return value;
  };
  const updatePrivateItem = async (
    key: string,
    transform: (current: string | null) => string | null,
  ) => {
    const lease = admission.captureHealthPurposePrivateDataWriteLease(key);
    const previous = (io.tails.get(key) ?? Promise.resolve()).catch(() => undefined);
    let release!: () => void;
    const tail = previous.then(() => new Promise<void>((resolve) => { release = resolve; }));
    io.tails.set(key, tail);
    await previous;
    // Allow the tail's promise executor to install release before any failure.
    await Promise.resolve();
    try {
      await io.beforeUpdate?.();
      if (lease) admission.assertHealthDataWriteLease(lease);
      if (io.writeFailure) throw io.writeFailure;
      const next = transform(io.values.get(key) ?? null);
      if (lease) admission.assertHealthDataWriteLease(lease);
      if (next === null) io.values.delete(key);
      else io.values.set(key, next);
      io.writes.push(key);
    } finally {
      release();
      if (io.tails.get(key) === tail) io.tails.delete(key);
    }
  };
  return {
    getPrivateItem,
    updatePrivateItem,
    setPrivateItem: (key: string, value: string) => updatePrivateItem(key, () => value),
    removePrivateItem: async (key: string) => { io.values.delete(key); },
  };
});

const KEY = 'layerwell.cycle.v2';
function config(patch: Partial<store.CycleConfig> = {}): store.CycleConfig {
  return {
    schemaVersion: 1, variant: 'classic', anchorISO: '2026-09-01', pausedFrom: null,
    pauseReason: null, recovery: null, skips: [], stagingOverrides: [], customCycle: null,
    ...patch,
  };
}
const pendingGates = new Set<() => void>();
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  pendingGates.add(resolve);
  return { promise, resolve };
}
async function grant(ownerUserId = 'user-a') {
  const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  return setActiveHealthProcessingEpoch(1, { ownerUserId, accountGeneration });
}

let client: QueryClient;
let renderer: ReactTestRenderer | null = null;
let latest: CycleHookResult | undefined;
let mutations: ReturnType<typeof useCycleMutations>;
let history: { generation: number | undefined; variant: string | undefined }[];
function Probe() {
  const cycleResult = useCycle();
  const cycleMutations = useCycleMutations();
  const generation = activeHealthProcessingLeaseSnapshot()?.generation;
  // Observe committed results only, with the authority captured for that render.
  useEffect(() => {
    latest = cycleResult;
    mutations = cycleMutations;
    history.push({
      generation,
      variant: cycleResult.data?.config.variant,
    });
  }, [cycleResult, cycleMutations, generation]);
  return null;
}
function tree() {
  return createElement(QueryClientProvider, { client }, createElement(Probe));
}
async function refresh() {
  await act(async () => { renderer?.update(tree()); });
}
async function flushUntil(check: () => boolean) {
  for (let attempt = 0; attempt < 100 && !check(); attempt += 1) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 2)); });
  }
  expect(check()).toBe(true);
}
async function mount() {
  await act(async () => { renderer = create(tree()); });
  await flushUntil(() => latest?.sourceReady === true);
}
async function rejected(operation: () => Promise<void>, message: RegExp) {
  await expect(Promise.resolve().then(operation)).rejects.toThrow(message);
}

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  io.values.clear(); io.tails.clear(); io.reads.length = 0; io.writes.length = 0;
  io.day = '2026-09-29'; io.cadence = true; io.recovery = true;
  io.readFailure = null; io.writeFailure = null; io.beforeRead = null; io.beforeUpdate = null;
  io.track.mockReset(); io.appListeners.clear(); history = []; latest = undefined;
  clearActiveHealthProcessingEpoch();
  await grant();
  io.values.set(KEY, JSON.stringify(config()));
  client = new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000, gcTime: Infinity, retry: false } },
  });
});
afterEach(async () => {
  for (const release of pendingGates) release();
  pendingGates.clear();
  if (renderer) await act(async () => { renderer?.unmount(); });
  renderer = null;
  await client.cancelQueries(); client.clear();
  clearActiveHealthProcessingEpoch();
  vi.restoreAllMocks();
});

describe('cycle persistence baseline comparison', () => {
  for (const operation of ['load', 'mutation'] as const) {
    it.each(['variant', 'anchorISO', 'skips', 'stagingOverrides'] as const)(
      `rejects current null %s without rewriting during ${operation}`,
      async (field) => {
        const raw = JSON.stringify({ ...config(), [field]: null });
        io.values.set(KEY, raw);
        await expect(operation === 'load' ? store.loadCycleConfig() : store.pauseCycle('travel'))
          .rejects.toThrow('CYCLE_CONFIG_INVALID');
        expect(io.values.get(KEY)).toBe(raw);
        expect(io.writes).toEqual([]);
      },
    );
    it(`does not migrate over decrypted empty current during ${operation}`, async () => {
      io.values.set(KEY, '');
      io.values.set('layerwell.cycle.v1', JSON.stringify({ variant: 'advanced' }));
      await expect(operation === 'load' ? store.loadCycleConfig() : store.pauseCycle('travel'))
        .rejects.toThrow('CYCLE_CONFIG_INVALID');
      expect(io.values.get(KEY)).toBe('');
      expect(io.writes).toEqual([]);
    });
  }

  for (const operation of ['load', 'mutation'] as const) {
    it(`preserves an unreadable authoritative legacy anchor during ${operation}`, async () => {
      io.values.delete(KEY);
      io.values.set('layerwell.cycleAnchor', '2026-08-01');
      io.beforeRead = async (key) => {
        if (key === 'layerwell.cycleAnchor') throw new Error('legacy anchor read unavailable');
      };
      await expect(operation === 'load' ? store.loadCycleConfig() : store.pauseCycle('travel'))
        .rejects.toThrow('legacy anchor read unavailable');
      expect(io.values.get('layerwell.cycleAnchor')).toBe('2026-08-01');
      expect(io.values.has(KEY)).toBe(false);
      expect(io.writes).toEqual([]);
    });

    it(`preserves an invalid authoritative legacy anchor during ${operation}`, async () => {
      io.values.delete(KEY);
      io.values.set('layerwell.cycleAnchor', '2026-02-31');
      await expect(operation === 'load' ? store.loadCycleConfig() : store.pauseCycle('travel'))
        .rejects.toThrow('CYCLE_CONFIG_INVALID');
      expect(io.values.get('layerwell.cycleAnchor')).toBe('2026-02-31');
      expect(io.values.has(KEY)).toBe(false);
      expect(io.writes).toEqual([]);
    });
  }

  it('does not consult or repair an obsolete anchor once v2 is authoritative', async () => {
    io.values.set('layerwell.cycleAnchor', '2026-02-31');
    await store.loadCycleConfig();
    await store.pauseCycle('travel');
    expect(io.values.get('layerwell.cycleAnchor')).toBe('2026-02-31');
    expect(io.reads).not.toContain('layerwell.cycleAnchor');
  });

  it('migrates valid anchor-bearing v1 despite an irrelevant anchor read failure', async () => {
    io.values.delete(KEY);
    io.values.set('layerwell.cycle.v1', JSON.stringify({
      variant: 'gentle', anchorISO: '2026-08-01',
    }));
    io.beforeRead = async (key) => {
      if (key === 'layerwell.cycleAnchor') throw new Error('irrelevant anchor read unavailable');
    };
    await expect(store.loadCycleConfig()).resolves.toMatchObject({
      variant: 'gentle', anchorISO: '2026-08-01',
    });
  });

  it('retains a valid anchor-only source through the first v2 mutation', async () => {
    io.values.delete(KEY);
    io.values.set('layerwell.cycleAnchor', '2026-08-01');
    await expect(store.loadCycleConfig()).resolves.toMatchObject({ anchorISO: '2026-08-01' });
    expect(io.values.has(KEY)).toBe(false);
    await expect(store.pauseCycle('travel')).resolves.toMatchObject({ anchorISO: '2026-08-01' });
    expect(io.values.get('layerwell.cycleAnchor')).toBe('2026-08-01');
  });

  it('requires a fresh read after same-owner same-epoch non-destructive revalidation', async () => {
    await mount();
    const priorGeneration = activeHealthProcessingLeaseSnapshot()!.generation;
    const gate = deferred();
    const original = store.updateCycleConfig;
    vi.spyOn(store, 'updateCycleConfig').mockImplementationOnce(async (patch) => {
      const committed = await original(patch);
      // Close strictly after the actual store operation returned, before the
      // hook publication continuation. This is not a primitive rollback model.
      io.beforeRead = async (key) => { if (key === KEY) await gate.promise; };
      clearActiveHealthProcessingEpoch();
      await grant();
      return committed;
    });
    await act(async () => {
      await rejected(() => mutations.setVariant('gentle'), /HEALTH_DATA_WRITE_ADMISSION_CLOSED/);
    });
    await refresh();
    const successor = activeHealthProcessingLeaseSnapshot()!.generation;
    expect(successor).not.toBe(priorGeneration);
    expect(JSON.parse(io.values.get(KEY)!).variant).toBe('gentle');
    expect(latest?.data).toBeUndefined();
    expect(latest?.sourceReady).toBe(false);
    expect(history.filter((row) => row.generation === successor).map((row) => row.variant))
      .not.toContain('classic');
    gate.resolve();
    await flushUntil(() => latest?.data?.config.variant === 'gentle');
    expect(io.track).not.toHaveBeenCalled();
  });

  it('does not let a retained mutation closure borrow a re-granted lease', async () => {
    await mount();
    const stale = mutations;
    await act(async () => { clearActiveHealthProcessingEpoch(); await grant(); });
    await refresh();
    await flushUntil(() => latest?.sourceReady === true);
    const cancel = vi.spyOn(client, 'cancelQueries');
    const before = io.values.get(KEY);
    await act(async () => {
      await rejected(() => stale.pause('travel'), /HEALTH_DATA_WRITE_ADMISSION_CLOSED/);
    });
    expect(cancel).not.toHaveBeenCalled();
    expect(io.values.get(KEY)).toBe(before);
    expect(io.track).not.toHaveBeenCalled();
  });

  it('withholds a warm query immediately after health authority closes', async () => {
    await mount();
    await act(async () => { clearActiveHealthProcessingEpoch(); });
    await refresh();
    expect(latest?.data).toBeUndefined();
    expect(latest?.sourceReady).toBe(false);
  });

  it('isolates an owner switch even while the old same-day cache remains warm', async () => {
    await mount();
    const gate = deferred();
    io.beforeRead = async (key) => { if (key === KEY) await gate.promise; };
    io.values.set(KEY, JSON.stringify(config({ variant: 'advanced' })));
    await act(async () => { clearActiveHealthProcessingEpoch(); await grant('user-b'); });
    await refresh();
    expect(latest?.data).toBeUndefined();
    gate.resolve();
    await flushUntil(() => latest?.data?.config.variant === 'advanced');
  });

  it('does not cancel or publish a successor after old cancellation settles', async () => {
    await mount();
    const started = deferred(); const gate = deferred();
    const actualCancel = client.cancelQueries.bind(client);
    vi.spyOn(client, 'cancelQueries').mockImplementationOnce(async (filters, options) => {
      await actualCancel(filters, options); started.resolve(); await gate.promise;
    });
    let outcome!: Promise<unknown>;
    await act(async () => { outcome = mutations.pause('travel').catch((error: unknown) => error); });
    await started.promise;
    await act(async () => {
      clearActiveHealthProcessingEpoch(); await grant('user-b');
      io.values.set(KEY, JSON.stringify(config({ variant: 'advanced' })));
    });
    await refresh();
    await flushUntil(() => latest?.data?.config.variant === 'advanced');
    const publish = vi.spyOn(client, 'setQueryData');
    const reset = vi.spyOn(client, 'resetQueries');
    await act(async () => { gate.resolve(); await outcome; });
    expect(publish).not.toHaveBeenCalled(); expect(reset).not.toHaveBeenCalled();
    expect(latest?.data?.config.variant).toBe('advanced');
    expect(io.track).not.toHaveBeenCalled();
  });

  it('reads back a new local day instead of stamping an old-day skip as fresh', async () => {
    await mount();
    const started = deferred(); const gate = deferred();
    io.beforeUpdate = async () => { started.resolve(); await gate.promise; };
    let pending!: Promise<void>;
    await act(async () => { pending = mutations.skip(); });
    await started.promise;
    io.day = '2026-09-30';
    await act(async () => { gate.resolve(); await pending; });
    await act(async () => { for (const listener of io.appListeners) listener('active'); });
    await flushUntil(() => latest?.sourceReady === true);
    expect(latest?.data?.config.skips).toEqual([]);
    const current = client.getQueryCache().findAll({ queryKey: ['cycleConfig'] })
      .find((query) => query.queryKey.at(-1) === io.day);
    expect((current?.state.data as store.CycleConfig | undefined)?.skips).toEqual([]);
  });

  it('hides retained cache data after an authoritative read fails', async () => {
    await mount(); io.readFailure = new Error('private read unavailable');
    await act(async () => { await client.refetchQueries({ queryKey: ['cycleConfig'] }); });
    await flushUntil(() => latest?.isError === true);
    expect(latest?.data).toBeUndefined(); expect(latest?.sourceReady).toBe(false);
  });

  it('does not treat unknown write/rollback outcome as a confirmed prior cache', async () => {
    await mount();
    io.writeFailure = new Error('PRIVATE_KV_WRITE_ROLLBACK_FAILED');
    const original = store.pauseCycle;
    vi.spyOn(store, 'pauseCycle').mockImplementationOnce(async (reason) => {
      try {
        return await original(reason);
      } finally {
        // The initial authoritative read must succeed so the intended write
        // error is reached. Only its subsequent recovery read is unavailable.
        io.readFailure = new Error('read-back unavailable');
      }
    });
    await act(async () => {
      await rejected(() => mutations.pause('travel'), /PRIVATE_KV_WRITE_ROLLBACK_FAILED/);
    });
    await flushUntil(() => latest?.isError === true);
    expect(latest?.data).toBeUndefined(); expect(latest?.sourceReady).toBe(false);
    expect(io.track).not.toHaveBeenCalled();
  });

  it('preserves custom, pause and staging intent across concurrent hook transactions', async () => {
    await mount();
    const definition = {
      schemaVersion: 1 as const, lengthNights: 2,
      nights: [{ productId: 'retinol' }, { productId: null }],
    };
    await act(async () => {
      await Promise.all([
        mutations.pause('travel'), mutations.saveCustom(definition, true),
        mutations.overrideStaging(['azelaic']),
      ]);
    });
    await flushUntil(() => latest?.data?.config.stagingOverrides.includes('azelaic') === true);
    expect(latest?.data?.config).toMatchObject({
      variant: 'custom', pausedFrom: io.day, pauseReason: 'travel', customCycle: definition,
    });
    expect(latest?.data?.config.stagingOverrides).toEqual(['retinol', 'azelaic']);
  });
});
