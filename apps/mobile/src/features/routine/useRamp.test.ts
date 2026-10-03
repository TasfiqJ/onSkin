import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createElement, useEffect, type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, vi } from 'vitest';

import type { HealthDataWriteLease, HealthDataWriteOperationLease } from '@/lib/consent/healthDataWriteAdmission';
import type { StoredRamp } from './rampStore';
import { usePlan, type RecoverablePlanHookResult } from './usePlan';
import { useRamp } from './useRamp';
import { routineOrderQueryKeyForLease } from './orderStore';

// Real usePlan, useRamp, QueryClient and renderer. Only private IO/clinical
// generation are controlled; no query/result mock supplies sourceReady=true.
const { act, create } = createRequire(import.meta.url)('react-test-renderer') as {
  act: (operation: () => void | Promise<void>) => PromiseLike<void>;
  create: (element: ReactElement) => { update: (element: ReactElement) => void; unmount: () => void };
};
const mocks = vi.hoisted(() => ({
  active: undefined as HealthDataWriteLease | undefined,
  cadenceReady: true, recoveryReady: true,
  shelfRead: vi.fn(), profileRead: vi.fn(), orderRead: vi.fn(),
  getStoredRamps: vi.fn(), ensureRamp: vi.fn(), stepUpRamp: vi.fn(),
  assertCadence: vi.fn(), operations: vi.fn(), events: [] as string[],
  entryGate: undefined as Promise<void> | undefined,
  assert: (lease: HealthDataWriteLease | undefined) => {
    if (!lease || !mocks.active) throw new Error('CLOSED');
    for (const field of ['generation', 'epoch', 'ownerUserId', 'accountGeneration'] as const) {
      if (lease[field] !== mocks.active[field]) throw new Error('STALE_LEASE');
    }
    if (lease.expiresAt !== null && Date.now() >= lease.expiresAt) throw new Error('EXPIRED');
  },
}));
vi.mock('@/features/shelf/useShelf', async () => {
  const { useQuery } = await import('@tanstack/react-query');
  return { useShelf: () => useQuery({
    queryKey: ['shelf'], retry: false, staleTime: Infinity,
    queryFn: async () => {
      const lease = mocks.active; mocks.assert(lease);
      const data = await mocks.shelfRead(); mocks.assert(lease); return data;
    },
  }) };
});
vi.mock('@/features/scheduler/profile', async () => {
  const { useQuery } = await import('@tanstack/react-query');
  return { useProfileBits: () => useQuery({
    queryKey: ['skinProfileBits'], retry: false, staleTime: Infinity,
    queryFn: async () => {
      const lease = mocks.active; mocks.assert(lease);
      const data = await mocks.profileRead(); mocks.assert(lease); return data;
    },
  }) };
});
vi.mock('@/features/scheduler/profileMapping', () => ({ routinePlanProfileLabel: () => 'Test' }));
vi.mock('@/lib/consent/healthProcessingEpoch', () => ({
  activeHealthProcessingLeaseSnapshot: () => {
    const lease = mocks.active;
    return lease && (lease.expiresAt === null || Date.now() < lease.expiresAt) ? lease : null;
  },
  subscribeActiveHealthProcessingLeaseChanges: () => () => undefined,
}));
vi.mock('@/lib/consent/healthDataWriteAdmission', () => ({
  HEALTH_DATA_WRITE_ADMISSION_CLOSED: 'CLOSED',
  captureHealthDataWriteLease: () => { mocks.assert(mocks.active); return { ...mocks.active! }; },
  assertHealthDataWriteLease: (lease: HealthDataWriteLease) => mocks.assert(lease),
  runCurrentHealthDataOperation: async <T,>(operation: (lease: HealthDataWriteOperationLease) => T | Promise<T>) => {
    const lease = mocks.active; mocks.assert(lease);
    mocks.operations(); mocks.events.push('health');
    if (mocks.entryGate) await mocks.entryGate;
    mocks.assert(lease);
    const result = await operation({ ...lease!, signal: new AbortController().signal, assertCurrent: () => mocks.assert(lease) });
    mocks.assert(lease); return result;
  },
}));
vi.mock('@/lib/storage/privateKV', () => ({ getPrivateItem: mocks.orderRead, updatePrivateItem: vi.fn() }));
vi.mock('@/features/routine/reviewGate', () => ({
  canUseRoutineCadence: () => mocks.cadenceReady,
  canUseRoutineRecovery: () => mocks.recoveryReady,
}));
vi.mock('@/features/scheduler/cycleStore', () => ({ assertRoutineCadenceMutationAdmission: mocks.assertCadence }));
vi.mock('@/features/today/useToday', () => ({ localDateString: () => '2026-07-26' }));
vi.mock('./ramp', () => ({ shouldOfferStepUp: () => true }));
vi.mock('./rampStore', () => ({
  getStoredRamps: mocks.getStoredRamps, ensureRamp: mocks.ensureRamp, stepUpRamp: mocks.stepUpRamp,
}));
vi.mock('./generate', () => ({
  generatePlan: (products: { id: string; name: string }[]) => ({
    am: [], pm: [], cycle: null, safetyExclusions: [], cadenceWithheld: [],
    sequencingWithheld: [], unplacedProducts: [], gaps: [], conflicts: [],
    conflictCoverageStatus: 'compatible', unsupportedConflictPairs: [],
    ramp: products.map((product) => ({ productId: product.id, name: product.name, state: {
      freqPerWeek: 2, targetPerWeek: 3, toleranceState: 'steady',
      startedAt: '2026-06-01', lastStepUp: null,
    } })),
  }),
}));

const globals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previousActEnvironment = globals.IS_REACT_ACT_ENVIRONMENT;
beforeAll(() => { globals.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => {
  if (previousActEnvironment === undefined) delete globals.IS_REACT_ACT_ENVIRONMENT;
  else globals.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
});
let renderer: ReturnType<typeof create> | undefined;
let client: QueryClient;
let latest: { plan: RecoverablePlanHookResult; ramp: ReturnType<typeof useRamp> };
function Harness() {
  const plan = usePlan();
  const ramp = useRamp();
  useEffect(() => { latest = { plan, ramp }; }, [plan, ramp]);
  return null;
}
const element = () => createElement(QueryClientProvider, { client }, createElement(Harness));
async function flush(operation: () => void = () => undefined) {
  await act(async () => { operation(); });
  for (let i = 0; i < 6; i += 1) {
    await act(async () => { await new Promise<void>((done) => setTimeout(done, 0)); });
  }
}
async function mount() { await flush(() => { renderer = create(element()); }); }
async function rerender() { await flush(() => renderer!.update(element())); }
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function shelf(prefix = '') {
  return { items: ['steady', 'paused'].map((id) => ({
    id, engineProduct: { id, name: `${prefix}${id}`, tags: ['retinoid'] },
  })), conflictChoices: [] };
}
const steady: StoredRamp = {
  freqPerWeek: 2, targetPerWeek: 3, toleranceState: 'steady',
  startedAt: '2026-06-01', lastStepUp: null,
};
const stored = () => ({ steady, paused: { ...steady, toleranceState: 'paused_irritation' as const } });
const rampQuery = () => {
  const query = client.getQueryCache().find({
    queryKey: ['ramp', 'steady,paused', mocks.active], exact: true,
  });
  assert.ok(query); return query;
};
beforeEach(() => {
  mocks.active = { ownerUserId: 'owner-a', generation: 1, epoch: 1, accountGeneration: 0, expiresAt: null };
  mocks.cadenceReady = true; mocks.recoveryReady = true; mocks.entryGate = undefined; mocks.events = [];
  for (const mock of [mocks.shelfRead, mocks.profileRead, mocks.orderRead, mocks.getStoredRamps,
    mocks.ensureRamp, mocks.stepUpRamp, mocks.assertCadence, mocks.operations]) mock.mockReset();
  mocks.shelfRead.mockResolvedValue(shelf());
  mocks.profileRead.mockResolvedValue({
    source: 'local', sensitivity: 'neutral', pregnancy: false, pregnancyStatus: 'none', goals: [],
  });
  mocks.orderRead.mockResolvedValue(null);
  mocks.getStoredRamps.mockResolvedValue(stored());
  mocks.ensureRamp.mockImplementation(async (_id: string, state: StoredRamp) => state);
  mocks.stepUpRamp.mockImplementation(async () => { mocks.events.push('step-up'); });
  mocks.assertCadence.mockImplementation(() => {
    mocks.events.push('cadence');
    if (!mocks.cadenceReady) throw new Error('ROUTINE_CADENCE_MUTATION_ADMISSION_CLOSED');
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } } });
});
afterEach(async () => {
  if (renderer) await flush(() => renderer?.unmount());
  renderer = undefined; client.clear();
});

describe('useRamp publication and persistence admission with the real plan source', () => {
  it('publishes no cached cadence items or offers while cadence is closed', async () => {
    await mount(); assert.equal(latest.ramp.items.length, 2);
    const reads = mocks.getStoredRamps.mock.calls.length;
    mocks.cadenceReady = false; await rerender();
    assert.equal(rampQuery().isActive(), false);
    assert.deepEqual(latest.ramp.items, []);
    assert.equal(latest.ramp.isLoading, false); assert.equal(latest.ramp.isError, false);
    assert.equal(latest.ramp.sourceReady, false);
    assert.equal(mocks.getStoredRamps.mock.calls.length, reads);
    assert.equal(mocks.ensureRamp.mock.calls.length, 0);
  });

  it('suppresses cached paused-irritation guidance when recovery is closed', async () => {
    await mount(); const reads = mocks.getStoredRamps.mock.calls.length;
    mocks.recoveryReady = false; await rerender();
    assert.deepEqual(latest.ramp.items.map((item) => item.productId), ['steady']);
    assert.equal(mocks.getStoredRamps.mock.calls.length, reads);
    assert.equal(mocks.ensureRamp.mock.calls.length, 0);
  });

  it('asserts cadence before a forced query can read or seed private ramp state', async () => {
    await mount(); const query = rampQuery(), reads = mocks.getStoredRamps.mock.calls.length;
    mocks.cadenceReady = false; await rerender();
    await assert.rejects(query.fetch(), /ROUTINE_CADENCE_MUTATION_ADMISSION_CLOSED/);
    assert.equal(mocks.getStoredRamps.mock.calls.length, reads);
    assert.equal(mocks.ensureRamp.mock.calls.length, 0);
  });

  it('asserts cadence before the health operation and again before invalidation', async () => {
    await mount(); mocks.events = [];
    const invalidate = client.invalidateQueries.bind(client);
    vi.spyOn(client, 'invalidateQueries').mockImplementation((...args) => {
      mocks.events.push('invalidate'); return invalidate(...args);
    });
    await act(async () => { await latest.ramp.acceptStepUp('steady'); });
    assert.deepEqual(mocks.events.slice(0, 6), ['cadence', 'health', 'cadence', 'step-up', 'cadence', 'invalidate']);
    assert.equal(mocks.stepUpRamp.mock.calls.length, 1);
  });

  it('cannot enter the health operation when direct step-up admission is closed', async () => {
    await mount(); const before = mocks.operations.mock.calls.length;
    mocks.cadenceReady = false;
    assert.throws(() => latest.ramp.acceptStepUp('steady'), /ROUTINE_CADENCE_MUTATION_ADMISSION_CLOSED/);
    assert.equal(mocks.operations.mock.calls.length, before);
    assert.equal(mocks.stepUpRamp.mock.calls.length, 0);
  });

  it('performs no persisted ramp work while current-authority inputs are unconfirmed', async () => {
    const read = deferred<ReturnType<typeof shelf>>(); mocks.shelfRead.mockReturnValue(read.promise);
    await mount();
    assert.equal(latest.plan.sourceReady, false);
    assert.equal(mocks.getStoredRamps.mock.calls.length, 0);
    assert.equal(mocks.ensureRamp.mock.calls.length, 0);
    assert.throws(() => latest.ramp.acceptStepUp('steady'), /ROUTINE_PLAN_SOURCE_UNAVAILABLE/);
    await flush(() => read.resolve(shelf()));
    assert.equal(latest.plan.isSourceCurrent(), true);
    assert.equal(latest.ramp.sourceReady, true);
    assert.equal(mocks.getStoredRamps.mock.calls.length, 1);
  });

  it.each(['shelf', 'profile', 'order'] as const)('a retained plan after %s error cannot read, seed or step up', async (input) => {
    await mount(); const query = rampQuery(), action = latest.ramp.acceptStepUp;
    const reader = input === 'shelf' ? mocks.shelfRead : input === 'profile' ? mocks.profileRead : mocks.orderRead;
    const key = input === 'shelf' ? ['shelf'] : input === 'profile' ? ['skinProfileBits'] : routineOrderQueryKeyForLease(mocks.active);
    reader.mockRejectedValueOnce(new Error('PRIVATE_READ_FAILED'));
    await act(async () => { await client.refetchQueries({ queryKey: key, exact: true }); });
    await flush(); assert.ok(latest.plan.data); assert.equal(latest.plan.sourceReady, false);
    assert.deepEqual(latest.ramp.items, []);
    const reads = mocks.getStoredRamps.mock.calls.length;
    await assert.rejects(query.fetch(), /ROUTINE_PLAN_SOURCE_UNAVAILABLE/);
    assert.throws(() => action('steady'), /ROUTINE_PLAN_SOURCE_UNAVAILABLE/);
    assert.equal(mocks.getStoredRamps.mock.calls.length, reads);
    assert.equal(mocks.ensureRamp.mock.calls.length, 0); assert.equal(mocks.stepUpRamp.mock.calls.length, 0);
  });

  it('blocks a captured step-up immediately when a background fetch starts', async () => {
    await mount(); const action = latest.ramp.acceptStepUp;
    const profile = client.getQueryData(['skinProfileBits']), read = deferred<unknown>();
    mocks.profileRead.mockReturnValueOnce(read.promise);
    await flush(() => {
      void client.refetchQueries({ queryKey: ['skinProfileBits'], exact: true });
      assert.throws(() => action('steady'), /ROUTINE_PLAN_SOURCE_UNAVAILABLE/);
    });
    assert.equal(mocks.stepUpRamp.mock.calls.length, 0);
    await flush(() => read.resolve(profile));
    assert.equal(latest.plan.isSourceCurrent(), true);
  });

  it('source loss while entering the health operation prevents the step-up dispatch', async () => {
    await mount(); const gate = deferred<void>(); mocks.entryGate = gate.promise;
    const pending = latest.ramp.acceptStepUp('steady').catch(() => undefined);
    await client.invalidateQueries({ queryKey: ['shelf'], exact: true, refetchType: 'none' });
    await flush(() => gate.resolve()); await pending;
    assert.equal(mocks.stepUpRamp.mock.calls.length, 0);
  });

  it('source invalidation during the stored-ramp read prevents seeding', async () => {
    const read = deferred<Record<string, StoredRamp>>(); mocks.getStoredRamps.mockReturnValueOnce(read.promise);
    await mount(); assert.equal(mocks.getStoredRamps.mock.calls.length, 1);
    await client.invalidateQueries({ queryKey: ['shelf'], exact: true, refetchType: 'none' });
    await flush(() => read.resolve({}));
    assert.equal(mocks.ensureRamp.mock.calls.length, 0); assert.equal(latest.ramp.sourceReady, false);
  });

  it('source invalidation during one seed prevents another seed and item publication', async () => {
    mocks.getStoredRamps.mockResolvedValue({});
    const seed = deferred<StoredRamp>(); mocks.ensureRamp.mockReturnValueOnce(seed.promise);
    await mount(); assert.equal(mocks.ensureRamp.mock.calls.length, 1);
    await client.invalidateQueries({ queryKey: ['shelf'], exact: true, refetchType: 'none' });
    await flush(() => seed.resolve(steady));
    assert.equal(mocks.ensureRamp.mock.calls.length, 1);
    assert.deepEqual(latest.ramp.items, []); assert.equal(latest.ramp.sourceReady, false);
  });

  it('warm same-product generation rollover cannot reuse old ramp query data', async () => {
    await mount(); const old = latest.ramp, before = mocks.getStoredRamps.mock.calls.length;
    const read = deferred<ReturnType<typeof shelf>>(); mocks.shelfRead.mockReturnValue(read.promise);
    mocks.active = { ...mocks.active!, generation: 2 };
    await rerender(); assert.equal(latest.plan.sourceReady, false);
    assert.equal(mocks.getStoredRamps.mock.calls.length, before);
    assert.throws(() => old.acceptStepUp('steady'), /ROUTINE_PLAN_SOURCE_UNAVAILABLE/);
    await flush(() => read.resolve(shelf('Successor ')));
    assert.equal(mocks.getStoredRamps.mock.calls.length, before + 1);
    assert.equal(latest.ramp.items[0]?.name, 'Successor steady');
    assert.equal(latest.ramp.sourceReady, true);
  });

  it('an old stored-ramp result cannot seed or replace a successor plan', async () => {
    const read = deferred<Record<string, StoredRamp>>(); mocks.getStoredRamps.mockReturnValueOnce(read.promise);
    await mount(); assert.equal(mocks.getStoredRamps.mock.calls.length, 1);
    mocks.active = { ...mocks.active!, generation: 2 }; mocks.shelfRead.mockResolvedValue(shelf('Successor '));
    await rerender(); assert.equal(latest.ramp.items[0]?.name, 'Successor steady');
    await flush(() => read.resolve({}));
    assert.equal(mocks.ensureRamp.mock.calls.length, 0);
    assert.equal(latest.ramp.items[0]?.name, 'Successor steady');
    assert.equal(latest.ramp.sourceReady, true);
  });
});
