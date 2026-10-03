import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, vi } from 'vitest';

import PlanScreen from '@/app/routine/plan';
import TodayScreen from '@/app/(tabs)/today';
import { usePlan, type RecoverablePlanHookResult } from '@/features/routine/usePlan';
import type { GeneratedPlan, PlanStep, RoutineProduct } from '@/features/routine/generate';
import type { StoredRamp } from '@/features/routine/rampStore';
import { completionActionStateForLease } from '@/features/today/localCompletionAccess';
import type { HealthDataWriteLease, HealthDataWriteOperationLease } from '@/lib/consent/healthDataWriteAdmission';
import { useCycle, type RecoverableCycleHookResult } from './useCycle';
import type { CycleConfig } from './cycleStore';
import type { Cycle, OrchestrationResult, SchedulerActive, SchedulerProfile } from './orchestrate';
import { cycleConfigAuthoritySnapshot, cycleConfigQueryKey } from './cycleConfigAuthority';

// Real React, QueryClient, usePlan, useRamp, useCycle, CYCLE-R2 config authority,
// Plan/Today and Today projection. Only private IO, native views and clinical
// generation/layout are fixtures. No mock makes a source unconditionally ready.
type Node = { type: unknown; props: Record<string, unknown>; children: (Node | string)[];
  findAll: (predicate: (node: Node) => boolean) => Node[] };
type Renderer = { root: Node; update: (node: React.ReactElement) => void; unmount: () => void };
const { act, create } = createRequire(import.meta.url)('react-test-renderer') as {
  act: (callback: () => void | Promise<void>) => PromiseLike<void>;
  create: (element: React.ReactElement) => Renderer;
};
const mocks = vi.hoisted(() => ({
  active: undefined as HealthDataWriteLease | undefined, listeners: new Set<() => void>(),
  shelfRead: vi.fn(), profileRead: vi.fn(), orderRead: vi.fn(), rampRead: vi.fn(), ensureRamp: vi.fn(),
  configRead: vi.fn(), start: vi.fn(), toggle: vi.fn(), completions: vi.fn(), unsynced: vi.fn(),
  replace: vi.fn(), back: vi.fn(), track: vi.fn(), success: vi.fn(),
  cadence: true, phase: 'PM' as 'AM' | 'PM',
  assert(lease: HealthDataWriteLease | undefined) {
    if (!lease || !mocks.active) throw new Error('CLOSED');
    for (const key of ['ownerUserId', 'accountGeneration', 'generation', 'epoch'] as const) {
      if (lease[key] !== mocks.active[key]) throw new Error('STALE_AUTHORITY');
    }
    if (lease.expiresAt !== null && Date.now() >= lease.expiresAt) throw new Error('EXPIRED');
  },
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' }, View: 'View', ScrollView: 'ScrollView', Pressable: 'Pressable',
  AppState: { addEventListener: () => ({ remove() {} }) },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
}));
vi.mock('@/components/ui', () => ({ Button: 'Button', Screen: 'Screen', Text: 'Text',
  RouteIconButton: 'RouteIconButton', TodayFocusHeader: 'TodayFocusHeader' }));
vi.mock('expo-router', () => ({ router: { replace: mocks.replace, push: vi.fn() } }));
vi.mock('@/lib/navigation/safeBack', () => ({ APP_YOU_ROUTE: '/you', backOrReplace: mocks.back }));
vi.mock('@/theme/tokens', () => ({ colors: {} }));
vi.mock('@/theme/haptics', () => ({ haptics: { select: vi.fn(), success: mocks.success } }));
vi.mock('@/lib/cn', () => ({ cn: (...values: unknown[]) => values.filter(Boolean).join(' ') }));
vi.mock('@/lib/analytics/track', () => ({ track: mocks.track }));
vi.mock('@/lib/launch/phase7', () => ({ phase7Flags: { cloudAsk: false } }));
vi.mock('@/components/navigation/DockMotion', () => ({ reportDockScroll: vi.fn() }));
vi.mock('@/features/ask/AskTeaser', () => ({ AskTeaser: 'AskTeaser' }));
vi.mock('@/features/recommendations/RecommendationsTeaser', () => ({ RecommendationsTeaser: 'RecommendationsTeaser' }));
vi.mock('@/features/subscription/ReverseTrialBanner', () => ({ ReverseTrialBanner: 'ReverseTrialBanner' }));
vi.mock('@/features/review/prompt', () => ({ requestReviewAfterValue: vi.fn() }));
vi.mock('@/features/routine/useProgress', () => ({ useProgress: () => ({ data: { streak: 0 } }) }));
vi.mock('@/features/routine/activationAnalytics', () => ({ recordRoutinePlanAnalytics: vi.fn() }));
vi.mock('@/features/routine/firstInsight', () => ({ routineInsightCount: () => 0, routineFirstInsightCopy: () => null }));
vi.mock('@/features/scheduler/CycleMutationError', () => ({ CycleMutationError: 'CycleMutationError' }));
vi.mock('@/features/routine/reviewGate', () => ({ canUseRoutineCadence: () => mocks.cadence,
  canUseRoutineRecovery: () => mocks.cadence, canUseRoutineSequencing: () => false }));
vi.mock('@/features/routine/sequencing', () => ({ routinePhasedIntroductionDelayDays: () => mocks.cadence ? 7 : null }));
vi.mock('@/features/scheduler/profileMapping', () => ({ routinePlanProfileLabel: () => 'Test profile' }));
vi.mock('@/features/routine/generate', () => ({ generatePlan: (products: RoutineProduct[]) => fixturePlan(products) }));
vi.mock('@/features/routine/ramp', () => ({ shouldOfferStepUp: () => false }));
vi.mock('@/features/routine/rampStore', () => ({ getStoredRamps: mocks.rampRead,
  ensureRamp: mocks.ensureRamp, stepUpRamp: vi.fn() }));
vi.mock('@/features/scheduler/cycleStore', () => ({
  loadCycleConfig: mocks.configRead, startCycleToday: mocks.start,
  assertRoutineCadenceMutationAdmission: () => { if (!mocks.cadence) throw new Error('CADENCE_CLOSED'); },
  assertRoutineRecoveryAvailable: () => { if (!mocks.cadence) throw new Error('RECOVERY_CLOSED'); },
  recoveryProgress: (recovery: CycleConfig['recovery']) => ({ active: Boolean(recovery), day: 1, days: recovery?.days ?? 0 }),
  endRecovery: vi.fn(), overrideStagingProducts: vi.fn(), pauseCycle: vi.fn(), resumeCycle: vi.fn(),
  saveCustomCycleDefinition: vi.fn(), skipTonight: vi.fn(), startRecovery: vi.fn(), updateCycleConfig: vi.fn(),
}));
vi.mock('@/features/scheduler/customCycle', () => ({ applyCustomCycleDefinition: vi.fn() }));
vi.mock('@/features/scheduler/orchestrate', () => ({
  orchestrate: (actives: SchedulerActive[], profile: SchedulerProfile) => fixtureCycle(actives, profile),
}));
vi.mock('@/features/scheduler/classes', () => ({ classLabel: () => 'Retinoid' }));
vi.mock('@/features/scheduler/projection', () => ({
  nightIndex: () => 0, nightFor: (cycle: Cycle) => cycle.nights[0],
  weekAhead: (cycle: Cycle) => cycle.nights.map((night) => ({ dateISO: '2026-07-08', night })),
  nextSlotDate: () => null, friendlyWeekday: () => 'Wednesday', slotLabel: () => 'Retinoid',
  cycleRecoveryNightNumbers: () => [],
  cycleActiveSummaries: (cycle: Cycle) => cycle.nights.slice(0, 1).map((night) => ({
    productId: night.productId, name: night.productName, className: 'retinoid',
    nightNumbers: cycle.nights.map((item) => item.index + 1),
  })),
}));
vi.mock('@/features/shelf/useShelf', async () => {
  const { useQuery } = await import('@tanstack/react-query');
  return { useShelf: () => useQuery({ queryKey: ['shelf'], retry: false, networkMode: 'always',
    queryFn: async () => { const lease = mocks.active; mocks.assert(lease);
      const result = await mocks.shelfRead(); mocks.assert(lease); return result; } }) };
});
vi.mock('@/features/scheduler/profile', async () => {
  const { useQuery } = await import('@tanstack/react-query');
  return { useProfileBits: () => useQuery({ queryKey: ['skinProfileBits'], retry: false, networkMode: 'always',
    queryFn: async () => { const lease = mocks.active; mocks.assert(lease);
      const result = await mocks.profileRead(); mocks.assert(lease); return result; } }) };
});
vi.mock('@/lib/storage/privateKV', () => ({ getPrivateItem: mocks.orderRead, updatePrivateItem: vi.fn() }));
vi.mock('@/lib/consent/healthProcessingEpoch', () => ({
  activeHealthProcessingLeaseSnapshot: () => {
    const lease = mocks.active;
    return lease && (lease.expiresAt === null || Date.now() < lease.expiresAt) ? lease : null;
  },
  subscribeActiveHealthProcessingLeaseChanges: (listener: () => void) => {
    mocks.listeners.add(listener); return () => { mocks.listeners.delete(listener); };
  },
}));
vi.mock('@/lib/consent/healthDataWriteAdmission', () => ({
  HEALTH_DATA_WRITE_ADMISSION_CLOSED: 'CLOSED',
  captureHealthDataWriteLease: () => { mocks.assert(mocks.active); return { ...mocks.active! }; },
  assertHealthDataWriteLease: (lease: HealthDataWriteLease) => mocks.assert(lease),
  runCurrentHealthDataOperation: async <T,>(operation: (lease: HealthDataWriteOperationLease) => T | Promise<T>): Promise<T> => {
    const lease = mocks.active; mocks.assert(lease);
    const result = await operation({ ...lease!, signal: new AbortController().signal,
      assertCurrent: () => mocks.assert(lease) });
    mocks.assert(lease); return result;
  },
}));
vi.mock('@/features/today/useToday', () => ({ localDateString: () => '2026-07-08', currentRoutineType: () => mocks.phase }));
vi.mock('@/features/today/useRoutineClock', () => ({ useRoutineClock: () => ({
  now: new Date(2026, 6, 8, 18), localDate: '2026-07-08', phase: mocks.phase, clockLabel: '6 PM',
}) }));
vi.mock('@/features/today/completionsStore', () => ({ getCompletedSteps: mocks.completions,
  getCompletionSyncUnsynced: mocks.unsynced, recoverCompletionSyncUnsynced: vi.fn(), toggleCompletion: mocks.toggle,
  stepKey: (phase: string, id: string) => `${phase}:${id}` }));
vi.mock('@/features/today/completionSync', () => ({ currentCompletionSyncTimezone: () => 'America/Toronto',
  completionSyncStepIdentity: () => ({ userProductId: 'retinol', routineType: 'PM' }) }));
vi.mock('@/features/today/cycleCompletion', () => ({ shouldTrackCycleNightCompleted: () => false }));

function fixturePlan(products: RoutineProduct[]): GeneratedPlan {
  const active = products.filter((product) => product.tags.includes('retinoid'));
  const toStep = (product: RoutineProduct, cycled = false): PlanStep => ({
    productId: product.id, name: product.name, instruction: 'Fixture instructions.',
    order: cycled ? 40 : 10, cadence: cycled ? 'cycle' : 'stable', role: cycled ? 'treatment' : 'cleanser',
  });
  const daily = products.filter((product) => !product.tags.includes('retinoid')).map((product) => toStep(product));
  return { am: daily, pm: [...daily, ...(mocks.cadence ? active.map((product) => toStep(product, true)) : [])],
    cycle: null, // Relevance must not depend solely on the optional insight template.
    ramp: mocks.cadence ? active.map((product) => ({ productId: product.id, name: product.name,
      state: { freqPerWeek: 2, targetPerWeek: 3, toleranceState: 'building' } })) : [],
    safetyExclusions: [], cadenceWithheld: mocks.cadence ? [] : active.map((product) => ({ productId: product.id, name: product.name })),
    sequencingWithheld: [], unplacedProducts: [], gaps: [], conflicts: [],
    conflictCoverageStatus: 'compatible', unsupportedConflictPairs: [] };
}
function fixtureCycle(actives: SchedulerActive[], profile: SchedulerProfile): OrchestrationResult {
  // Explicit clinical fixture: missing persisted frequency has a cap of three,
  // while the saved test frequency is one. This suite does not admit guidance.
  const nights = actives.filter((active) => active.tags.includes('retinoid')).flatMap((active) =>
    Array.from({ length: profile.freqByProductId?.[active.id] ?? 3 }, () => ({
      index: 0, slot: 'retinoid' as const, productId: active.id, productName: active.name, className: 'retinoid' as const,
    })));
  nights.forEach((night, index) => { night.index = index; });
  const cycle: Cycle | null = nights.length ? { variant: 'classic', lengthNights: nights.length, nights, amDaily: [], notes: [] } : null;
  return { cycle, amDaily: [], cycleActives: [], notes: [], conflictChoices: [],
    conflictCoverageStatus: 'compatible', unsupportedConflictPairs: [] };
}
function shelf(name = 'Current retinol', cycled = true) {
  return { items: [
    { id: 'cleanser', engineProduct: { id: 'cleanser', name: 'Daily cleanser', tags: [] }, product: { createdAt: '2026-01-01' } },
    ...(cycled ? [{ id: 'retinol', engineProduct: { id: 'retinol', name, tags: ['retinoid'] }, product: { createdAt: '2026-01-01' } }] : []),
  ], conflictChoices: [] };
}
const savedRamp: StoredRamp = { freqPerWeek: 1, targetPerWeek: 3, toleranceState: 'steady', startedAt: '2026-01-01', lastStepUp: null };
const storedConfig = (): CycleConfig => ({ schemaVersion: 1, variant: 'auto', anchorISO: '2026-07-01',
  pausedFrom: null, pauseReason: null, recovery: null, skips: [], stagingOverrides: [], customCycle: null });
function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const globals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean; React?: typeof React };
const previousReact = globals.React, previousAct = globals.IS_REACT_ACT_ENVIRONMENT;
beforeAll(() => { globals.React = React; globals.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => {
  if (previousReact === undefined) Reflect.deleteProperty(globals, 'React'); else globals.React = previousReact;
  if (previousAct === undefined) delete globals.IS_REACT_ACT_ENVIRONMENT; else globals.IS_REACT_ACT_ENVIRONMENT = previousAct;
});
let renderer: Renderer | undefined, client: QueryClient;
let route = PlanScreen;
let latestPlan: RecoverablePlanHookResult, latestCycle: RecoverableCycleHookResult;
function Capture() {
  const plan = usePlan();
  const cycle = useCycle();
  // Publish a committed pair from this render, never a mutable successor read.
  React.useEffect(() => {
    latestPlan = plan;
    latestCycle = cycle;
  }, [plan, cycle]);
  return null;
}
const element = () => React.createElement(QueryClientProvider, { client }, React.createElement(React.Fragment, null,
  React.createElement(route), React.createElement(Capture)));
async function flush(operation: () => void = () => undefined) {
  await act(async () => { operation(); });
  for (let i = 0; i < 8; i++) await act(async () => { await new Promise<void>((done) => setTimeout(done, 0)); });
}
async function mount() { await flush(() => { renderer = create(element()); }); }
function nodes(predicate: (node: Node) => boolean): Node[] { assert.ok(renderer); return renderer.root.findAll(predicate); }
function text(node: Node | string): string { return typeof node === 'string' ? node : node.children.map(text).join(' '); }
function button(label: string): Node {
  const found = nodes((node) => node.type === 'Button' && node.props.label === label);
  assert.equal(found.length, 1, label); return found[0]!;
}
const click = (node: Node) => (node.props.onPress as () => void)();
function withheld() {
  assert.equal(nodes((node) => node.props.accessibilityRole === 'checkbox').length, 0);
  assert.equal(nodes((node) => node.type === 'TodayFocusHeader').length, 0);
  assert.equal(nodes((node) => node.type === 'Button' && node.props.label === 'Start today').length, 0);
  assert.ok(!text(renderer!.root).includes('Current retinol'));
  assert.ok(!text(renderer!.root).includes('No routine yet'));
}
function rampKey() { return ['ramp', latestPlan.data?.plan.ramp.map((ramp) => ramp.productId).join(',') ?? '', latestPlan.orderLease] as const; }
function configKey() { const authority = cycleConfigAuthoritySnapshot(); assert.ok(authority); return cycleConfigQueryKey(authority, '2026-07-08'); }
function visible() {
  assert.ok(text(renderer!.root).includes(route === PlanScreen || mocks.phase === 'PM' ? 'Current retinol' : 'Daily cleanser'));
  if (route === PlanScreen) assert.equal(button('Start today').props.disabled, false);
}
function oldAction(): () => void {
  if (route === PlanScreen) return button('Start today').props.onPress as () => void;
  const row = nodes((node) => node.type === 'Pressable' && node.props.accessibilityLabel === 'Current retinol');
  assert.equal(row.length, 1); return row[0]!.props.onPress as () => void;
}
beforeEach(() => {
  mocks.active = undefined; completionActionStateForLease(undefined); mocks.listeners.clear();
  mocks.active = { ownerUserId: 'owner-a', generation: 1, epoch: 1, accountGeneration: 0, expiresAt: null };
  mocks.cadence = true; mocks.phase = 'PM'; route = PlanScreen;
  for (const mock of [mocks.shelfRead, mocks.profileRead, mocks.orderRead, mocks.rampRead, mocks.ensureRamp,
    mocks.configRead, mocks.start, mocks.toggle, mocks.completions, mocks.unsynced, mocks.replace, mocks.back,
    mocks.track, mocks.success]) mock.mockReset();
  mocks.shelfRead.mockResolvedValue(shelf());
  mocks.profileRead.mockResolvedValue({ source: 'local', sensitivity: 'neutral', pregnancy: false, pregnancyStatus: 'none', goals: [] });
  mocks.orderRead.mockResolvedValue(null); mocks.rampRead.mockResolvedValue({ retinol: savedRamp });
  mocks.ensureRamp.mockImplementation(async (_id: string, state: StoredRamp) => state);
  mocks.configRead.mockResolvedValue(storedConfig());
  mocks.start.mockResolvedValue({ ...storedConfig(), anchorISO: '2026-07-08' });
  mocks.completions.mockResolvedValue(new Set<string>()); mocks.unsynced.mockResolvedValue([]);
  mocks.toggle.mockRejectedValue(new Error('WRITE_FAILED'));
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } } });
});
afterEach(async () => {
  if (renderer) await flush(() => renderer?.unmount());
  renderer = undefined; client.clear();
});

describe('PLAN-R3 cycle-current publication and action interlock', () => {
  for (const [name, screen, phase] of [['Plan', PlanScreen, 'PM'], ['Today PM', TodayScreen, 'PM'], ['Today AM', TodayScreen, 'AM']] as const) {
    it(`${name}: plan proof succeeds before ramp; no cap-derived UI until persisted read`, async () => {
      route = screen; mocks.phase = phase;
      const ramp = deferred<Record<string, StoredRamp>>(); mocks.rampRead.mockReturnValue(ramp.promise);
      await mount();
      assert.equal(latestPlan.isSourceCurrent(), true);
      assert.equal(latestCycle.isLoading, true); assert.equal(latestCycle.sourceReady, false);
      assert.equal(latestCycle.data?.cycle?.nights.length, 3, 'real useCycle computed the cap fixture, not current authority');
      assert.equal(mocks.rampRead.mock.calls.length, 1); withheld();
      assert.ok(button('Back'));
      await flush(() => ramp.resolve({ retinol: savedRamp })); visible();
      assert.equal(latestCycle.data?.cycle?.nights.length, 1);
      assert.equal(latestCycle.isSourceCurrent(), true);
      if (screen === PlanScreen) {
        await flush(() => click(button('Start today')));
        assert.equal(mocks.start.mock.calls.length, 1); assert.equal(mocks.replace.mock.calls.length, 1);
      }
    });
    it(`${name}: retained ramp error is unavailable; authoritative retry waits for config too`, async () => {
      route = screen; mocks.phase = phase; await mount(); visible();
      const key = rampKey(), old = client.getQueryData(key);
      mocks.rampRead.mockRejectedValueOnce(new Error('RAMP_READ_FAILED'));
      await act(async () => { await client.refetchQueries({ queryKey: key, exact: true }); }); await flush();
      assert.equal(client.getQueryData(key), old); assert.equal(client.getQueryState(key)?.status, 'error');
      assert.equal(latestCycle.isError, true); assert.ok(latestCycle.data); withheld();
      const ramp = deferred<Record<string, StoredRamp>>(), config = deferred<CycleConfig>();
      mocks.rampRead.mockReturnValueOnce(ramp.promise); mocks.configRead.mockReturnValueOnce(config.promise);
      const configReads = mocks.configRead.mock.calls.length;
      await flush(() => click(button('Retry cycle'))); withheld();
      await flush(() => ramp.resolve({ retinol: savedRamp })); withheld();
      assert.equal(mocks.configRead.mock.calls.length, configReads + 1);
      await flush(() => config.resolve(storedConfig())); visible();
      assert.equal(latestCycle.isSourceCurrent(), true);
    });
    it(`${name}: intentionally closed cadence preserves neutral daily/withheld UX`, async () => {
      route = screen; mocks.phase = phase; mocks.cadence = false;
      mocks.configRead.mockRejectedValue(new Error('IRRELEVANT_CONFIG'));
      await mount(); assert.equal(mocks.rampRead.mock.calls.length, 0);
      assert.ok(text(renderer!.root).includes('Daily cleanser'));
      assert.ok(!text(renderer!.root).includes('saved cycle'));
      assert.ok(!text(renderer!.root).includes('Current retinol'));
      if (screen === TodayScreen) assert.ok(text(renderer!.root).includes('Timing is not set'));
      else { await flush(() => click(button('Start today'))); assert.equal(mocks.start.mock.calls.length, 0); assert.equal(mocks.replace.mock.calls.length, 1); }
    });
    it(`${name}: no cycle-relevant products do not depend on unrelated pending ramp/config`, async () => {
      route = screen; mocks.phase = phase; mocks.shelfRead.mockResolvedValue(shelf('', false));
      mocks.rampRead.mockReturnValue(deferred().promise); mocks.configRead.mockRejectedValue(new Error('IRRELEVANT_CONFIG'));
      await mount(); assert.equal(latestPlan.isSourceCurrent(), true); assert.equal(latestCycle.sourceReady, false);
      assert.ok(text(renderer!.root).includes('Daily cleanser')); assert.ok(!text(renderer!.root).includes('saved cycle'));
      if (screen === PlanScreen) { await flush(() => click(button('Start today'))); assert.equal(mocks.start.mock.calls.length, 0); assert.equal(mocks.replace.mock.calls.length, 1); }
    });
    for (const field of ['ownerUserId', 'accountGeneration', 'epoch', 'generation'] as const) {
      it(`${name}: old ramp retry cannot unlock successor ${field} with warm cache`, async () => {
        route = screen; mocks.phase = phase; await mount();
        const oldRamp = deferred<Record<string, StoredRamp>>(), nextRamp = deferred<Record<string, StoredRamp>>();
        mocks.rampRead.mockReturnValueOnce(oldRamp.promise);
        let oldRetry!: Promise<void>;
        await flush(() => { oldRetry = latestCycle.retry().catch(() => undefined); }); withheld();
        mocks.rampRead.mockReturnValue(nextRamp.promise); mocks.shelfRead.mockResolvedValue(shelf('Successor retinol'));
        await flush(() => {
          const active = mocks.active!;
          mocks.active = { ...active, generation: active.generation + 1,
            ...(field === 'generation' ? {} : { [field]: field === 'ownerUserId' ? 'owner-b' : active[field] + 1 }) };
          for (const listener of mocks.listeners) listener();
          renderer!.update(element());
        });
        assert.equal(latestPlan.isSourceCurrent(), true); withheld();
        const reads = mocks.configRead.mock.calls.length;
        await flush(() => oldRamp.resolve({ retinol: savedRamp })); await oldRetry; withheld();
        assert.equal(mocks.configRead.mock.calls.length, reads);
        await flush(() => nextRamp.resolve({ retinol: savedRamp }));
        assert.equal(latestCycle.isSourceCurrent(), true); assert.ok(!text(renderer!.root).includes('Current retinol'));
        if (screen === PlanScreen || phase === 'PM') assert.ok(text(renderer!.root).includes('Successor retinol'));
      });
    }
  }
  for (const screen of [PlanScreen, TodayScreen]) for (const input of ['ramp', 'config'] as const) {
    it(`${screen.name}/${input}: rejects captured action before query observer notification`, async () => {
      route = screen; await mount(); const action = oldAction(), old = latestCycle;
      await flush(() => {
        void client.invalidateQueries({ queryKey: input === 'ramp' ? rampKey() : configKey(), exact: true, refetchType: 'none' });
        assert.equal(old.isSourceCurrent(), false); action();
      });
      assert.equal(mocks.start.mock.calls.length, 0); assert.equal(mocks.replace.mock.calls.length, 0);
      assert.equal(mocks.toggle.mock.calls.length, 0);
      // refetchType:none need not change a tracked observer property. The live
      // action fence above must work before a render; the next render withholds
      // the view as well. Do not pretend flush alone forces React to render.
      await flush(() => renderer!.update(element())); withheld();
    });
  }
  it('Today completion read-back remains reachable and independent during ramp failure', async () => {
    route = TodayScreen; await mount();
    await flush(oldAction()); // Unconfirmed write latches the real T1 coordinator.
    assert.equal(completionActionStateForLease(mocks.active).failed, true);
    mocks.rampRead.mockRejectedValueOnce(new Error('RAMP_FAILED'));
    await act(async () => { await client.refetchQueries({ queryKey: rampKey(), exact: true }); }); await flush(); withheld();
    const retries = nodes((node) => node.type === 'Pressable' && node.props.accessibilityLabel === 'Try loading saved check-offs again');
    assert.equal(retries.length, 1); await flush(() => click(retries[0]!));
    assert.equal(completionActionStateForLease(mocks.active).failed, false); withheld(); assert.ok(button('Retry cycle'));
    assert.equal(mocks.toggle.mock.calls.length, 1); assert.equal(mocks.success.mock.calls.length, 0);
  });
  it('cycle retry cannot clear an independent T1 recovery latch', async () => {
    route = TodayScreen; await mount();
    await flush(oldAction());
    const retry = latestCycle.retry;
    await act(async () => { await retry(); }); await flush();
    assert.equal(latestCycle.isSourceCurrent(), true);
    assert.equal(completionActionStateForLease(mocks.active).failed, true); withheld();
  });
  it('Today rechecks cycle readiness after preparatory cancellation and before persistence', async () => {
    route = TodayScreen; await mount(); const wait = deferred<void>();
    const cancel = client.cancelQueries.bind(client);
    vi.spyOn(client, 'cancelQueries').mockImplementation(async (...args) => {
      await cancel(...args); if (args[0]?.queryKey?.[0] === 'completions') await wait.promise;
    });
    await flush(oldAction());
    await flush(() => { void client.invalidateQueries({ queryKey: rampKey(), exact: true, refetchType: 'none' }); wait.resolve(); });
    assert.equal(mocks.toggle.mock.calls.length, 0); assert.equal(completionActionStateForLease(mocks.active).failed, false);
  });
  it('Start can navigate after its confirmed config commit without accepting an old checklist snapshot', async () => {
    await mount(); const old = latestCycle;
    await flush(() => click(button('Start today')));
    assert.equal(mocks.start.mock.calls.length, 1); assert.equal(mocks.replace.mock.calls.length, 1);
    assert.equal(old.isSourceCurrent(), false, 'old checklist snapshot must reject the changed anchor');
    assert.equal(latestCycle.isSourceCurrent(), true);
  });
  it('an in-flight Start cannot navigate after a ramp refetch failure', async () => {
    await mount(); const start = deferred<CycleConfig>(); mocks.start.mockReturnValueOnce(start.promise);
    await flush(() => click(button('Start today')));
    mocks.rampRead.mockRejectedValueOnce(new Error('RAMP_FAILED'));
    await act(async () => { await client.refetchQueries({ queryKey: rampKey(), exact: true }); }); await flush(); withheld();
    await flush(() => start.resolve({ ...storedConfig(), anchorISO: '2026-07-08' }));
    assert.equal(mocks.replace.mock.calls.length, 0);
  });
  for (const screen of [PlanScreen, TodayScreen]) it(`${screen.name}: old cycled action cannot inherit a newly closed-cadence bypass`, async () => {
    route = screen; await mount(); const action = oldAction();
    await flush(() => { mocks.cadence = false; action(); });
    assert.equal(mocks.start.mock.calls.length, 0); assert.equal(mocks.toggle.mock.calls.length, 0);
    assert.equal(mocks.replace.mock.calls.length, 0);
  });
});

// PLAN-R4: retain the R3 cases above verbatim. Only Start's presentation state
// changed; these use the same real hook/query/config-action chain as those cases.
async function changeStartAuthority(
  field: 'ownerUserId' | 'accountGeneration' | 'epoch' | 'generation',
) {
  await flush(() => {
    const active = mocks.active!;
    mocks.active = {
      ...active,
      generation: active.generation + 1,
      ...(field === 'generation'
        ? {}
        : { [field]: field === 'ownerUserId' ? 'owner-b' : active[field] + 1 }),
    };
    for (const listener of mocks.listeners) listener();
    renderer!.update(element());
  });
}

function noStartFailure() {
  assert.equal(nodes((node) => node.type === 'CycleMutationError').length, 0);
  assert.equal(nodes((node) => node.type === 'Button' && node.props.label === 'Try again').length, 0);
}

describe('PLAN-R4 authority-scoped Start UI and committed capture', () => {
  for (const field of ['ownerUserId', 'accountGeneration', 'epoch', 'generation'] as const) {
    for (const outcome of ['confirmed', 'rejected'] as const) {
      it(`pending Start ${outcome} cannot fail or unlock successor ${field}`, async () => {
        await mount();
        const predecessor = deferred<CycleConfig>(), successor = deferred<CycleConfig>();
        const capturedAction = oldAction();
        mocks.start.mockReturnValueOnce(predecessor.promise).mockReturnValueOnce(successor.promise);
        await flush(capturedAction);
        assert.equal(button('Starting...').props.disabled, true);
        assert.equal(mocks.start.mock.calls.length, 1);

        await changeStartAuthority(field);
        assert.equal(latestPlan.isSourceCurrent(), true);
        assert.equal(latestCycle.isSourceCurrent(), true);
        assert.equal(button('Start today').props.disabled, false);
        noStartFailure();
        await flush(capturedAction);
        assert.equal(mocks.start.mock.calls.length, 1, 'old handler cannot borrow successor authority');
        const successorAction = oldAction();
        await flush(() => { successorAction(); successorAction(); });
        assert.equal(mocks.start.mock.calls.length, 2, 'same-render duplicate Start stays fenced');

        await flush(() => {
          if (outcome === 'confirmed') predecessor.resolve({ ...storedConfig(), anchorISO: '2026-07-08' });
          else predecessor.reject(new Error('PREDECESSOR_START_FAILED'));
        });
        assert.equal(button('Starting...').props.disabled, true, 'old finally cannot release the new attempt');
        noStartFailure();
        assert.equal(mocks.replace.mock.calls.length, 0);
        assert.equal(mocks.track.mock.calls.length, 0);
        assert.equal(mocks.success.mock.calls.length, 0);
        await flush(successorAction);
        assert.equal(mocks.start.mock.calls.length, 2);

        await flush(() => successor.resolve({ ...storedConfig(), anchorISO: '2026-07-08' }));
        assert.equal(mocks.replace.mock.calls.length, 1);
        assert.deepEqual(mocks.replace.mock.calls[0], ['/today']);
        assert.equal(button('Start today').props.disabled, false);
        noStartFailure();
      });
    }

    it(`a prior failed Start does not supply Try again to successor ${field}`, async () => {
      await mount();
      mocks.start.mockRejectedValueOnce(new Error('CURRENT_START_FAILED'));
      await flush(oldAction());
      assert.equal(button('Try again').props.disabled, false);
      assert.equal(nodes((node) => node.type === 'CycleMutationError').length, 1);
      assert.equal(mocks.replace.mock.calls.length, 0);
      await changeStartAuthority(field);
      assert.equal(button('Start today').props.disabled, false);
      noStartFailure();
      await flush(oldAction());
      assert.equal(mocks.start.mock.calls.length, 2);
      assert.equal(mocks.replace.mock.calls.length, 1);
    });
  }

  for (const outcome of ['confirmed', 'rejected'] as const) {
    it(`unmounted pending Start ${outcome} cannot navigate or publish view feedback`, async () => {
      await mount();
      const pending = deferred<CycleConfig>(), capturedAction = oldAction();
      mocks.start.mockReturnValueOnce(pending.promise);
      await flush(capturedAction);
      await flush(() => { renderer!.unmount(); renderer = undefined; });
      const errors = vi.spyOn(console, 'error');
      try {
        await flush(() => {
          if (outcome === 'confirmed') pending.resolve({ ...storedConfig(), anchorISO: '2026-07-08' });
          else pending.reject(new Error('UNMOUNTED_START_FAILED'));
        });
        await flush(capturedAction);
        assert.equal(mocks.start.mock.calls.length, 1);
        assert.equal(mocks.replace.mock.calls.length, 0);
        assert.equal(mocks.success.mock.calls.length, 0);
        assert.equal(errors.mock.calls.length, 0);
      } finally {
        errors.mockRestore();
      }
      await mount();
      assert.equal(button('Start today').props.disabled, false);
      noStartFailure();
    });

    it(`same-authority remount retains its own pending Start after old ${outcome} settlement`, async () => {
      await mount();
      const predecessor = deferred<CycleConfig>(), successor = deferred<CycleConfig>();
      mocks.start.mockReturnValueOnce(predecessor.promise).mockReturnValueOnce(successor.promise);
      await flush(oldAction());
      await flush(() => { renderer!.unmount(); renderer = undefined; });
      await mount();
      assert.equal(button('Start today').props.disabled, false);
      await flush(oldAction());
      assert.equal(button('Starting...').props.disabled, true);
      await flush(() => {
        if (outcome === 'confirmed') predecessor.resolve({ ...storedConfig(), anchorISO: '2026-07-08' });
        else predecessor.reject(new Error('OLD_VIEW_START_FAILED'));
      });
      assert.equal(mocks.start.mock.calls.length, 2);
      assert.equal(button('Starting...').props.disabled, true);
      assert.equal(mocks.replace.mock.calls.length, 0);
      noStartFailure();
      await flush(() => successor.resolve({ ...storedConfig(), anchorISO: '2026-07-08' }));
      assert.equal(mocks.replace.mock.calls.length, 1);
      noStartFailure();
    });
  }

  it('current Start keeps the confirmed-config exception and navigates once for duplicate taps', async () => {
    await mount();
    const capturedPlan = latestPlan, capturedCycle = latestCycle;
    const pending = deferred<CycleConfig>();
    mocks.start.mockReturnValueOnce(pending.promise);
    const action = oldAction();
    await flush(() => { action(); action(); });
    assert.equal(mocks.start.mock.calls.length, 1);
    assert.equal(button('Starting...').props.disabled, true);
    await flush(() => pending.resolve({ ...storedConfig(), anchorISO: '2026-07-08' }));
    assert.equal(capturedPlan.isSourceCurrent(), true);
    assert.equal(capturedCycle.isSourceCurrent(), false, 'committed config replaced the old checklist snapshot');
    assert.equal(latestPlan.isSourceCurrent(), true);
    assert.equal(latestCycle.isSourceCurrent(), true);
    assert.equal(mocks.replace.mock.calls.length, 1);
    assert.deepEqual(mocks.replace.mock.calls[0], ['/today']);
    assert.equal(button('Start today').props.disabled, false);
    noStartFailure();
  });
});
