import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createElement, useEffect, type ReactElement } from 'react';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, vi } from 'vitest';

import type { HealthDataWriteLease } from '@/lib/consent/healthDataWriteAdmission';
import type { GeneratedPlan, PlanStep } from './generate';
import { usePlan, type PlanHookResult } from './usePlan';
import { routineOrderQueryKeyForLease } from './orderStore';

type Renderer = { unmount: () => void };
const { act, create } = createRequire(import.meta.url)('react-test-renderer') as {
  act: (callback: () => void | Promise<void>) => PromiseLike<void>;
  create: (element: ReactElement) => Renderer;
};
const mocks = vi.hoisted(() => ({
  active: null as HealthDataWriteLease | null,
  listeners: new Set<() => void>(),
  records: new Map<string, string>(),
  readGate: undefined as Promise<void> | undefined,
  read: vi.fn(),
  canonical: undefined as GeneratedPlan | undefined,
}));
vi.mock('@/lib/consent/healthProcessingEpoch', () => ({
  activeHealthProcessingLeaseSnapshot: () => {
    const lease = mocks.active;
    return lease && (lease.expiresAt === null || Date.now() < lease.expiresAt) ? lease : null;
  },
  subscribeActiveHealthProcessingLeaseChanges: (callback: () => void) => {
    mocks.listeners.add(callback);
    return () => { mocks.listeners.delete(callback); };
  },
}));
vi.mock('@/lib/consent/healthDataWriteAdmission', () => {
  const capture = (): HealthDataWriteLease => {
    const active = mocks.active;
    if (!active || (active.expiresAt !== null && Date.now() >= active.expiresAt)) throw new Error('CLOSED');
    return { ...active };
  };
  const assertLease = (lease: HealthDataWriteLease) => {
    const active = capture();
    for (const key of ['generation', 'epoch', 'ownerUserId', 'accountGeneration'] as const) {
      if (lease[key] !== active[key]) throw new Error('STALE_LEASE');
    }
  };
  return {
    HEALTH_DATA_WRITE_ADMISSION_CLOSED: 'CLOSED',
    captureHealthDataWriteLease: capture,
    assertHealthDataWriteLease: assertLease,
    runCurrentHealthDataOperation: async (
      operation: (lease: HealthDataWriteLease & { assertCurrent: () => void }) => Promise<unknown>,
    ) => {
      const lease = capture();
      const result = await operation({ ...lease, assertCurrent: () => assertLease(lease) });
      assertLease(lease);
      return result;
    },
  };
});
vi.mock('@/lib/storage/privateKV', () => ({ getPrivateItem: mocks.read, updatePrivateItem: vi.fn() }));
vi.mock('@/features/shelf/useShelf', () => ({
  useShelf: () => ({ isLoading: false, isError: false, data: { items: [
    { id: 'a', engineProduct: { id: 'a', name: 'a', tags: [] }, category: 'toner' },
    { id: 'b', engineProduct: { id: 'b', name: 'b', tags: [] }, category: 'toner' },
  ] } }),
}));
vi.mock('@/features/scheduler/profile', () => ({
  useProfileBits: () => ({ isLoading: false, isError: false, data: { source: 'local' } }),
}));
vi.mock('@/features/scheduler/profileMapping', () => ({ routinePlanProfileLabel: () => 'Test' }));
vi.mock('./planProfileAdmission', () => ({
  routineGenerationProfileForRealShelf: () => ({ sensitivity: 'neutral', pregnancy: false, reproductiveStatus: 'none', goals: [] }),
}));
vi.mock('./generate', () => ({ generatePlan: () => mocks.canonical }));


const globals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previousActEnvironment = globals.IS_REACT_ACT_ENVIRONMENT;
beforeAll(() => { globals.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => {
  if (previousActEnvironment === undefined) delete globals.IS_REACT_ACT_ENVIRONMENT;
  else globals.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
});

const latest = { current: undefined as PlanHookResult | undefined };
let renderer: Renderer | undefined;
let client: QueryClient;
let wasOnline: boolean;
function Harness() {
  const result = usePlan();
  useEffect(() => { latest.current = result; }, [result]);
  return null;
}
function currentPlan(): PlanHookResult {
  assert.ok(latest.current, 'The hook must have rendered');
  return latest.current;
}
function step(productId: string): PlanStep {
  return { productId, name: productId, instruction: 'Use as directed.', order: 10, cadence: 'stable', role: 'toner' };
}
async function settle(operation: () => void = () => undefined) {
  await act(async () => { operation(); });
  // React Query batches observer notifications onto timers; do not replace its
  // real cache/online manager with a mock in these integration tests.
  for (let i = 0; i < 6; i += 1) {
    await act(async () => { await new Promise<void>((done) => setTimeout(done, 0)); });
  }
}
async function mount() {
  await settle(() => {
    renderer = create(createElement(QueryClientProvider, { client }, createElement(Harness)));
  });
}
function publish(lease: HealthDataWriteLease | null) {
  mocks.active = lease;
  for (const callback of mocks.listeners) callback();
}

beforeEach(() => {
  wasOnline = onlineManager.isOnline();
  latest.current = undefined;
  mocks.listeners.clear();
  mocks.records.clear();
  mocks.readGate = undefined;
  mocks.active = { generation: 1, epoch: 1, ownerUserId: 'owner-a', accountGeneration: 0, expiresAt: null };
  mocks.records.set('owner-a', '{"schemaVersion":1,"am":["b","a"],"pm":[]}');
  mocks.records.set('owner-b', '{"schemaVersion":1,"am":["a","b"],"pm":[]}');
  mocks.canonical = {
    am: [step('a'), step('b')], pm: [], cycle: null, ramp: [], safetyExclusions: [],
    cadenceWithheld: [], sequencingWithheld: [], unplacedProducts: [], gaps: [], conflicts: [],
    conflictCoverageStatus: 'compatible', unsupportedConflictPairs: [],
  };
  mocks.read.mockReset();
  mocks.read.mockImplementation(async () => {
    const owner = mocks.active?.ownerUserId;
    const raw = owner ? mocks.records.get(owner) ?? null : null;
    const gate = mocks.readGate;
    mocks.readGate = undefined;
    if (gate) await gate;
    return raw;
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
});
afterEach(async () => {
  if (renderer) await settle(() => { renderer?.unmount(); });
  renderer = undefined;
  client.clear();
  onlineManager.setOnline(wasOnline);
});

describe('G2 routine order query integration', () => {
  it('reads the saved order offline with the real QueryClient instead of pausing', async () => {
    onlineManager.setOnline(false);
    await mount();
    assert.equal(currentPlan().sourceReady, true);
    assert.deepEqual(currentPlan().data?.plan.am.map((item) => item.productId), ['b', 'a']);
    assert.equal(mocks.read.mock.calls.length, 1);
  });

  it('does not read storage or fabricate a plan while routine authority is closed', async () => {
    mocks.active = null;
    await mount();
    assert.equal(mocks.read.mock.calls.length, 0);
    assert.equal(currentPlan().sourceReady, false);
    assert.equal(currentPlan().data, undefined);
  });

  it('does not turn corrupt saved bytes into empty overrides and supports a repaired read', async () => {
    mocks.records.set('owner-a', '{broken');
    await mount();
    assert.equal(currentPlan().isError, true);
    assert.equal(currentPlan().sourceReady, false);
    assert.equal(currentPlan().data, undefined);
    assert.equal(mocks.read.mock.calls.length, 1); // no automatic retry loop
    assert.equal(mocks.records.get('owner-a'), '{broken');
    mocks.records.set('owner-a', '{"am":["b","a"],"pm":[],"schemaVersion":1}');
    await act(async () => {
      await client.refetchQueries({ queryKey: routineOrderQueryKeyForLease(mocks.active!), exact: true });
    });
    await settle();
    assert.equal(currentPlan().sourceReady, true);
    assert.deepEqual(currentPlan().data?.orderOverrides.am, ['b', 'a']);
  });

  it('never reuses the old owner cache under a new account generation', async () => {
    await mount();
    const oldKey = routineOrderQueryKeyForLease(mocks.active!);
    await settle(() => publish({ ...mocks.active!, ownerUserId: 'owner-b', generation: 2, accountGeneration: 1 }));
    assert.notDeepEqual(routineOrderQueryKeyForLease(currentPlan().orderLease), oldKey);
    assert.deepEqual(currentPlan().data?.orderOverrides.am, ['a', 'b']);
    assert.equal(mocks.read.mock.calls.length, 2);
  });

  it('rereads after a same-owner same-epoch re-grant rather than using old consent cache', async () => {
    await mount();
    const oldKey = routineOrderQueryKeyForLease(mocks.active!);
    mocks.records.set('owner-a', '{"schemaVersion":1,"am":["a","b"],"pm":[]}');
    await settle(() => publish({ ...mocks.active!, generation: 2 }));
    assert.notDeepEqual(routineOrderQueryKeyForLease(currentPlan().orderLease), oldKey);
    assert.deepEqual(currentPlan().data?.orderOverrides.am, ['a', 'b']);
    assert.equal(mocks.read.mock.calls.length, 2);
  });

  it('a delayed old-owner read cannot populate the new owner plan', async () => {
    let release!: () => void;
    mocks.readGate = new Promise<void>((done) => { release = done; });
    const oldKey = routineOrderQueryKeyForLease(mocks.active!);
    await mount();
    assert.equal(currentPlan().data, undefined);
    await settle(() => publish({ ...mocks.active!, ownerUserId: 'owner-b', generation: 2, accountGeneration: 1 }));
    assert.deepEqual(currentPlan().data?.orderOverrides.am, ['a', 'b']);
    await settle(release);
    assert.equal(client.getQueryData(oldKey), undefined);
    assert.deepEqual(currentPlan().data?.orderOverrides.am, ['a', 'b']);
  });

  it('stops publishing at lease expiry without waiting for another owner event', async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    try {
      mocks.active = { ...mocks.active!, expiresAt: now + 50 };
      await mount();
      assert.equal(currentPlan().sourceReady, true);
      clock.mockReturnValue(now + 51);
      await act(async () => { await new Promise<void>((done) => setTimeout(done, 75)); });
      await settle();
      assert.equal(currentPlan().orderLease, undefined);
      assert.equal(currentPlan().sourceReady, false);
      assert.equal(currentPlan().data, undefined);
    } finally {
      clock.mockRestore();
    }
  });
});
