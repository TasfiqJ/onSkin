import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as React from 'react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, vi } from 'vitest';

import TodayScreen from '@/app/(tabs)/today';
import PlanScreen from '@/app/routine/plan';
import { usePlan, type RecoverablePlanHookResult } from './usePlan';
import { routineOrderQueryKeyForLease } from './orderStore';
import type { HealthDataWriteLease, HealthDataWriteOperationLease } from '@/lib/consent/healthDataWriteAdmission';
import type { ToggleCompletionResult } from '../today/completionsStore';
import { completionActionStateForLease, completionQueryScope } from '../today/localCompletionAccess';

// Match the repo's existing G2 renderer convention without new dependencies.
type TestNode = {
  type: unknown; props: Record<string, unknown>; children: (TestNode | string)[];
  findAll: (predicate: (node: TestNode) => boolean) => TestNode[];
};
type Renderer = { root: TestNode; update: (element: React.ReactElement) => void; unmount: () => void };
const { act, create } = createRequire(import.meta.url)('react-test-renderer') as {
  act: (callback: () => void | Promise<void>) => PromiseLike<void>;
  create: (element: React.ReactElement) => Renderer;
};
const mocks = vi.hoisted(() => ({
  active: undefined as HealthDataWriteLease | undefined,
  disk: new Set<string>(), events: [] as string[],
  get: vi.fn(), unsynced: vi.fn(), toggle: vi.fn(), recover: vi.fn(), progressGet: vi.fn(),
  shelfRead: vi.fn(), profileRead: vi.fn(), orderRead: vi.fn(),
  success: vi.fn(), track: vi.fn(), review: vi.fn(), push: vi.fn(),
  phase: 'AM' as 'AM' | 'PM',
  replace: vi.fn(), back: vi.fn(), start: vi.fn(), cadence: false,
  cycleData: undefined as { cycle: object } | undefined,
  assert: (expected: HealthDataWriteLease | undefined): void => {
    if (!expected || !mocks.active) throw new Error('CLOSED');
    for (const key of ['generation', 'epoch', 'ownerUserId', 'accountGeneration'] as const) {
      if (expected[key] !== mocks.active[key]) throw new Error('STALE_TODAY');
    }
    if (expected.expiresAt !== null && Date.now() >= expected.expiresAt) throw new Error('EXPIRED');
  },
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' }, Pressable: 'Pressable', ScrollView: 'ScrollView', View: 'View',
  useWindowDimensions: () => ({ height: 844, width: 390 }),
}));
vi.mock('@/components/ui', () => ({ Button: 'Button', Screen: 'Screen', Text: 'Text', TodayFocusHeader: 'TodayFocusHeader', RouteIconButton: 'RouteIconButton' }));
vi.mock('@/components/navigation/DockMotion', () => ({ reportDockScroll: () => undefined }));
vi.mock('expo-router', () => ({ router: { push: mocks.push, replace: mocks.replace } }));
vi.mock('@/features/ask/AskTeaser', () => ({ AskTeaser: 'AskTeaser' }));
vi.mock('@/features/recommendations/RecommendationsTeaser', () => ({ RecommendationsTeaser: 'RecommendationsTeaser' }));
vi.mock('@/features/subscription/ReverseTrialBanner', () => ({ ReverseTrialBanner: 'ReverseTrialBanner' }));
// PLAN-R2: exercise the actual usePlan and real query observers. Only canonical
// IO and clinical generation are controlled here; readiness is never mocked.
vi.mock('@/features/shelf/useShelf', async () => {
  const { useQuery } = await import('@tanstack/react-query');
  return { useShelf: () => useQuery({
    queryKey: ['shelf'], networkMode: 'always', retry: false, staleTime: Infinity,
    queryFn: async () => {
      const lease = mocks.active;
      mocks.assert(lease);
      const data = await mocks.shelfRead();
      mocks.assert(lease);
      return data;
    },
  }) };
});
vi.mock('@/features/scheduler/profile', async () => {
  const { useQuery } = await import('@tanstack/react-query');
  return { useProfileBits: () => useQuery({
    queryKey: ['skinProfileBits'], networkMode: 'always', retry: false, staleTime: Infinity,
    queryFn: async () => {
      const lease = mocks.active;
      mocks.assert(lease);
      const data = await mocks.profileRead();
      mocks.assert(lease);
      return data;
    },
  }) };
});
vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: (...args: unknown[]) => mocks.orderRead(...args),
  updatePrivateItem: vi.fn(),
}));
vi.mock('@/lib/consent/healthProcessingEpoch', () => ({
  activeHealthProcessingLeaseSnapshot: () => {
    const active = mocks.active;
    return active && (active.expiresAt === null || Date.now() < active.expiresAt) ? active : null;
  },
  subscribeActiveHealthProcessingLeaseChanges: () => () => undefined,
}));
vi.mock('@/features/scheduler/profileMapping', () => ({ routinePlanProfileLabel: () => 'Your profile' }));
vi.mock('@/features/routine/generate', () => ({
  generatePlan: (products: { id: string; name: string }[]) => ({
    am: products.map((product, index) => ({
      productId: product.id, name: product.name, instruction: 'Use as directed.',
      order: index, cadence: 'stable', role: 'cleanser',
    })),
    // The existing awaited-start case needs an actual cycle-relevant fixture.
    pm: mocks.cadence && mocks.cycleData ? products.slice(0, 1).map((product) => ({
      productId: product.id, name: product.name, instruction: 'Use as directed.',
      order: 40, cadence: 'cycle', role: 'treatment',
    })) : [], cycle: null, ramp: [], safetyExclusions: [], cadenceWithheld: [],
    sequencingWithheld: [], unplacedProducts: [], gaps: [], conflicts: [],
    conflictCoverageStatus: 'compatible', unsupportedConflictPairs: [],
  }),
}));
vi.mock('@/features/routine/useProgress', async () => {
  const { useQuery } = await import('@tanstack/react-query');
  return { useProgress: () => {
    const now = new Date();
    const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    // Local controlled data, real QueryClient observer. No server implementation
    // is exercised or changed by these Today settlement tests.
    return useQuery({ queryKey: ['progress', day], queryFn: () => mocks.progressGet(day),
      networkMode: 'always', retry: false });
  } };
});
// Only this older suite's cycle IO is a fixture. Readiness comes from a real
// query; PLAN-R3's dedicated cycle suite uses the actual useCycle/useRamp too.
vi.mock('@/features/scheduler/useCycle', async () => {
  const { useQuery, useQueryClient } = await import('@tanstack/react-query');
  const { usePlan } = await import('./usePlan');
  return {
    useCycle: () => {
      const source = usePlan();
      const client = useQueryClient();
      const queryKey = ['test-cycle', source.orderLease];
      const query = useQuery({ queryKey, enabled: Boolean(mocks.cycleData) && source.sourceReady,
        queryFn: async () => mocks.cycleData ?? null, staleTime: Infinity, retry: false });
      const sourceReady = Boolean(query.data && !query.isPending && !query.isError && !query.isFetching);
      return { data: query.data, sourceReady, isLoading: query.isLoading, isError: query.isError,
        isRefreshing: query.isFetching, retry: query.refetch,
        isSourceCurrent: () => {
          const current = client.getQueryState(queryKey);
          return sourceReady && source.isSourceCurrent() && current?.status === 'success' &&
            current.fetchStatus === 'idle' && !current.isInvalidated && current.data === query.data;
        },
      };
    },
    useCycleMutations: () => ({ start: mocks.start }),
  };
});
vi.mock('@/features/scheduler/projection', () => ({ friendlyWeekday: () => '', slotLabel: () => '', cycleActiveSummaries: () => [], cycleRecoveryNightNumbers: () => [] }));
vi.mock('@/features/today/useRoutineClock', () => ({ useRoutineClock: () => {
  const now = new Date();
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return { now, localDate, phase: mocks.phase, clockLabel: '12:00 PM' };
} }));
vi.mock('@/features/today/useToday', () => ({
  localDateString: () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  },
  currentRoutineType: () => mocks.phase,
}));
vi.mock('@/features/today/completionsStore', () => ({
  getCompletedSteps: mocks.get, getCompletionSyncUnsynced: mocks.unsynced,
  recoverCompletionSyncUnsynced: mocks.recover, toggleCompletion: mocks.toggle,
  stepKey: (phase: string, id: string) => `${phase}:${id}`,
}));
vi.mock('@/features/today/completionSync', () => ({
  currentCompletionSyncTimezone: () => 'America/Toronto',
  completionSyncStepIdentity: () => ({ routineType: mocks.phase, userProductId: 'product' }),
}));
vi.mock('@/features/today/cycleCompletion', () => ({ shouldTrackCycleNightCompleted: () => false }));
vi.mock('@/lib/consent/healthDataWriteAdmission', () => ({
  HEALTH_DATA_WRITE_ADMISSION_CLOSED: 'CLOSED',
  captureHealthDataWriteLease: () => { mocks.assert(mocks.active); return { ...mocks.active! }; },
  assertHealthDataWriteLease: (lease: HealthDataWriteLease) => mocks.assert(lease),
  runCurrentHealthDataOperation: async <T,>(operation: (lease: HealthDataWriteOperationLease) => T | Promise<T>): Promise<T> => {
    const expected = mocks.active;
    mocks.assert(expected);
    const assertCurrent = () => mocks.assert(expected);
    const result = await operation({ ...expected!, signal: new AbortController().signal, assertCurrent });
    assertCurrent(); return result;
  },
}));
vi.mock('@/lib/analytics/track', () => ({ track: mocks.track }));
vi.mock('@/features/routine/activationAnalytics', () => ({ recordRoutinePlanAnalytics: vi.fn() }));
vi.mock('@/features/routine/firstInsight', () => ({ routineInsightCount: () => 0, routineFirstInsightCopy: () => null }));
vi.mock('@/features/scheduler/classes', () => ({ classLabel: () => '' }));
vi.mock('@/features/scheduler/CycleMutationError', () => ({ CycleMutationError: 'CycleMutationError' }));
vi.mock('@/features/routine/reviewGate', () => ({
  canUseRoutineCadence: () => mocks.cadence, canUseRoutineRecovery: () => mocks.cadence,
  canUseRoutineSequencing: () => false,
}));
vi.mock('@/features/review/prompt', () => ({ requestReviewAfterValue: mocks.review }));
vi.mock('@/lib/launch/phase7', () => ({ phase7Flags: { cloudAsk: false } }));
vi.mock('@/theme/haptics', () => ({ haptics: { success: mocks.success, select: () => undefined } }));
vi.mock('@/lib/navigation/safeBack', () => ({ APP_YOU_ROUTE: '/you', backOrReplace: mocks.back }));
vi.mock('@/theme/tokens', () => ({ colors: {} }));
vi.mock('@/lib/cn', () => ({ cn: (...values: unknown[]) => values.filter(Boolean).join(' ') }));

const globals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean; React?: typeof React };
const previousReact = globals.React;
const previousActEnvironment = globals.IS_REACT_ACT_ENVIRONMENT;
beforeAll(() => { globals.React = React; globals.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => {
  if (previousReact === undefined) Reflect.deleteProperty(globals, 'React'); else globals.React = previousReact;
  if (previousActEnvironment === undefined) delete globals.IS_REACT_ACT_ENVIRONMENT;
  else globals.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
});
function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function result(key = `${mocks.phase}:product`, inserted = true): ToggleCompletionResult {
  return { done: true, inserted, firstEver: inserted,
    completionDayInserted: inserted && key.startsWith('PM:'),
    completedStepKeysAfter: new Set(mocks.disk) };
}
function text(node: TestNode | string): string {
  return typeof node === 'string' ? node : node.children.map(text).join('');
}
let renderer: Renderer | undefined;
let client: QueryClient;
const DAY = '2026-07-08';
const key = () => ['completions', DAY, ...completionQueryScope(mocks.active)] as const;
let route = PlanScreen;
let latest: RecoverablePlanHookResult;
function CaptureSource() {
  const source = usePlan();
  React.useEffect(() => { latest = source; }, [source]);
  return null;
}
function committedPlanSource(): RecoverablePlanHookResult {
  return latest;
}
const element = () => React.createElement(QueryClientProvider, { client },
  React.createElement(React.Fragment, null, React.createElement(route), React.createElement(CaptureSource)));
async function flush(operation: () => void = () => undefined) {
  await act(async () => { operation(); });
  await act(async () => {
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 16; j += 1) await Promise.resolve();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  });
}
async function mount() { await flush(() => { renderer = create(element()); }); }
async function rerender() { await flush(() => { renderer!.update(element()); }); }
function control(label: string): TestNode {
  assert.ok(renderer);
  const found = renderer.root.findAll((node) => node.type === 'Pressable' && node.props.accessibilityLabel === label);
  assert.equal(found.length, 1, `Expected one control: ${label}`); return found[0]!;
}
const click = (node: TestNode) => (node.props.onPress as () => void)();
async function press(label: string) { await flush(() => click(control(label))); }
function noCompletionProjection() {
  assert.ok(renderer);
  assert.equal(renderer.root.findAll((node) => node.type === 'TodayFocusHeader').length, 0);
  assert.equal(renderer.root.findAll((node) => node.props.accessibilityRole === 'checkbox').length, 0);
  assert.ok(!text(renderer.root).includes('0 of'));
  assert.ok(!text(renderer.root).includes('No routine yet'));
}
function noSuccess() {
  assert.equal(mocks.success.mock.calls.length, 0);
  assert.equal(mocks.track.mock.calls.length, 0);
  assert.equal(mocks.review.mock.calls.length, 0);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 6, 8, 12, 0, 0));
  onlineManager.setOnline(true);
  route = PlanScreen; mocks.cadence = false; mocks.cycleData = undefined;
  for (const mock of [mocks.replace, mocks.back, mocks.start]) mock.mockReset();
  mocks.start.mockResolvedValue(undefined);
  // Model a closed authority between tests; remounts inside a test do NOT reset it.
  mocks.active = undefined;
  completionActionStateForLease(undefined);
  mocks.active = { generation: 1, epoch: 1, ownerUserId: 'owner-a', accountGeneration: 0, expiresAt: null };
  mocks.disk = new Set(); mocks.events = []; mocks.phase = 'AM';
  for (const read of [mocks.shelfRead, mocks.profileRead, mocks.orderRead]) read.mockReset();
  mocks.shelfRead.mockResolvedValue({
    items: [{ id: 'product', engineProduct: { id: 'product', name: 'Test product', tags: [] } }],
    conflictChoices: [],
  });
  mocks.profileRead.mockResolvedValue({
    source: 'local', sensitivity: 'normal', pregnancy: false, pregnancyStatus: 'none', goals: [],
  });
  mocks.orderRead.mockResolvedValue(null);
  for (const mock of [mocks.get, mocks.unsynced, mocks.toggle, mocks.recover, mocks.progressGet, mocks.success, mocks.track, mocks.review, mocks.push]) mock.mockReset();
  mocks.get.mockImplementation(async () => { mocks.events.push('read'); return new Set(mocks.disk); });
  mocks.unsynced.mockResolvedValue([]);
  mocks.toggle.mockImplementation(async (step: string) => {
    const inserted = !mocks.disk.has(step); mocks.disk.add(step);
    mocks.events.push('commit'); return result(step, inserted);
  });
  mocks.recover.mockResolvedValue(0);
  mocks.progressGet.mockResolvedValue({ streak: 6 });
  mocks.success.mockImplementation(() => mocks.events.push('haptic'));
  mocks.track.mockImplementation(() => mocks.events.push('analytics'));
  mocks.review.mockResolvedValue(undefined);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  vi.spyOn(client, 'setQueryData');
  client.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && event.action.type === 'success' && event.action.manual) {
      mocks.events.push('cache');
    }
  });
});
afterEach(async () => {
  if (renderer) await flush(() => renderer?.unmount());
  renderer = undefined; client.clear(); onlineManager.setOnline(true); vi.useRealTimers();
});

function button(label: string): TestNode {
  const buttons = renderer!.root.findAll((node) => node.type === 'Button' && node.props.label === label);
  assert.equal(buttons.length, 1, `Expected button: ${label}`);
  return buttons[0]!;
}
function noPlanPublication() {
  const content = text(renderer!.root);
  assert.ok(!content.includes('Test product'));
  assert.ok(!content.includes('No routine yet'));
  assert.ok(!content.includes('Your routine, in order.'));
  assert.equal(renderer!.root.findAll((node) => node.props.label === 'Start today').length, 0);
  assert.equal(renderer!.root.findAll((node) => node.props.label === 'Add products').length, 0);
  noCompletionProjection();
}
function inputKey(input: 'shelf' | 'profile' | 'order') {
  if (input === 'shelf') return ['shelf'];
  if (input === 'profile') return ['skinProfileBits'];
  return routineOrderQueryKeyForLease(mocks.active);
}
function inputReader(input: 'shelf' | 'profile' | 'order') {
  return input === 'shelf' ? mocks.shelfRead : input === 'profile' ? mocks.profileRead : mocks.orderRead;
}
async function failInput(input: 'shelf' | 'profile' | 'order') {
  inputReader(input).mockRejectedValueOnce(new Error(`FAILED_${input}`));
  await flush(() => { void client.refetchQueries({ queryKey: inputKey(input), exact: true }); });
}

describe('PLAN-R2 actual hook / Plan / Today recovery boundary', () => {
  for (const [name, screen] of [['Plan', PlanScreen], ['Today', TodayScreen]] as const) {
    it(`${name}: initial order loading cannot publish or navigate`, async () => {
      route = screen;
      const read = deferred<null>(); mocks.orderRead.mockReturnValue(read.promise);
      await mount(); noPlanPublication();
      assert.match(text(renderer!.root), /Loading your routine/);
      assert.equal(latest.sourceReady, false);
      assert.equal(mocks.replace.mock.calls.length, 0);
      await flush(() => read.resolve(null));
      assert.equal(latest.sourceReady, true);
      assert.equal(latest.isSourceCurrent(), true);
      assert.ok(text(renderer!.root).includes('Test product'));
    });

    it(`${name}: order error without cache has retry and back, not absence`, async () => {
      route = screen;
      mocks.orderRead.mockRejectedValue(new Error('PRIVATE_READ_FAILED'));
      await mount(); noPlanPublication();
      assert.equal(latest.isError, true);
      assert.equal(latest.data, undefined);
      assert.match(text(renderer!.root), /Your routine is unavailable/);
      await flush(() => click(button('Back')));
      assert.equal(mocks.back.mock.calls.length, 1);
      mocks.orderRead.mockResolvedValue(null);
      await flush(() => click(button('Retry routine')));
      assert.equal(latest.isSourceCurrent(), true);
      assert.ok(text(renderer!.root).includes('Test product'));
      assert.equal(mocks.replace.mock.calls.length, 0);
    });

    for (const input of ['shelf', 'profile', 'order'] as const) {
      it(`${name}: ${input} refetch failure cannot publish retained real plan`, async () => {
        route = screen; await mount();
        const stale = screen === PlanScreen ? button('Start today') : control('Test product');
        const stalePress = stale.props.onPress as () => void;
        await failInput(input);
        assert.ok(latest.data, 'hook intentionally retains data: readiness, not nullness, must gate');
        assert.equal(latest.isError, true);
        assert.equal(latest.sourceReady, false);
        noPlanPublication();
        await flush(stalePress);
        assert.equal(mocks.replace.mock.calls.length, 0);
        assert.equal(mocks.toggle.mock.calls.length, 0);
        await flush(() => click(button('Retry routine')));
        assert.equal(latest.isSourceCurrent(), true);
        assert.ok(text(renderer!.root).includes('Test product'));
      });
    }

    it(`${name}: retry remains closed until ALL canonical reads settle`, async () => {
      route = screen; await mount(); await failInput('order');
      const shelf = deferred<unknown>(), profile = deferred<unknown>(), order = deferred<null>();
      const shelfData = client.getQueryData(['shelf']);
      const profileData = client.getQueryData(['skinProfileBits']);
      const reads = [mocks.shelfRead, mocks.profileRead, mocks.orderRead].map((read) => read.mock.calls.length);
      mocks.shelfRead.mockReturnValueOnce(shelf.promise);
      mocks.profileRead.mockReturnValueOnce(profile.promise);
      mocks.orderRead.mockReturnValueOnce(order.promise);
      await flush(() => click(button('Retry routine'))); noPlanPublication();
      assert.deepEqual([mocks.shelfRead, mocks.profileRead, mocks.orderRead].map((read) => read.mock.calls.length), reads.map((n) => n + 1));
      await flush(() => order.resolve(null)); noPlanPublication();
      await flush(() => shelf.resolve(shelfData)); noPlanPublication();
      await flush(() => profile.resolve(profileData));
      assert.equal(latest.isSourceCurrent(), true);
      assert.ok(text(renderer!.root).includes('Test product'));
    });

    it(`${name}: a failed retry stays unavailable`, async () => {
      route = screen; await mount(); await failInput('order');
      mocks.profileRead.mockRejectedValueOnce(new Error('STILL_UNREADABLE'));
      await flush(() => click(button('Retry routine')));
      noPlanPublication(); assert.match(text(renderer!.root), /Your routine is unavailable/);
      assert.ok(button('Retry routine'));
    });
  }

  it('successfully current empty Shelf preserves the Plan example and Today empty UX', async () => {
    mocks.shelfRead.mockResolvedValue({ items: [], conflictChoices: [] });
    await mount();
    assert.equal(latest.isExample, true); assert.equal(latest.sourceReady, true);
    assert.ok(text(renderer!.root).includes('Cream cleanser'));
    assert.ok(button('Start today'));
    await flush(() => { renderer!.unmount(); renderer = undefined; });
    route = TodayScreen; await mount();
    assert.match(text(renderer!.root), /No routine yet/);
    assert.ok(button('Add products'));
    assert.equal(renderer!.root.findAll((node) => node.props.accessibilityRole === 'checkbox').length, 0);
  });

  it('Today does not label an initial failed Shelf read as an empty example', async () => {
    route = TodayScreen;
    mocks.shelfRead.mockRejectedValue(new Error('NO_SHELF_READ'));
    await mount(); noPlanPublication();
    assert.equal(latest.data, undefined, 'unconfirmed authority must not supply example or draft data');
    assert.equal(latest.sourceReady, false);
    assert.match(text(renderer!.root), /Your routine is unavailable/);
  });

  it('a closed health lease cannot publish cached input data', async () => {
    await mount();
    mocks.active = undefined;
    await rerender();
    noPlanPublication();
    assert.equal(latest.sourceReady, false);
    await assert.rejects(latest.retry);
    assert.equal(mocks.replace.mock.calls.length, 0);
  });

  it('profile unavailable sentinel stays closed even when its query succeeded', async () => {
    mocks.profileRead.mockResolvedValue({ source: 'unavailable' });
    await mount(); noPlanPublication(); assert.equal(latest.isError, false);
    await flush(() => click(button('Retry routine')));
    noPlanPublication(); assert.equal(latest.sourceReady, false);
  });

  it('rejects a captured Start callback immediately after invalidation, before rerender', async () => {
    await mount(); const old = button('Start today');
    await flush(() => {
      void client.invalidateQueries({ queryKey: ['shelf'], exact: true, refetchType: 'none' });
      click(old);
    });
    assert.equal(mocks.replace.mock.calls.length, 0);
    await rerender(); noPlanPublication();
  });

  it('does not navigate after an awaited start when canonical source failed meanwhile', async () => {
    mocks.cadence = true; mocks.cycleData = { cycle: {} };
    const start = deferred<void>(); mocks.start.mockReturnValueOnce(start.promise);
    await mount(); await flush(() => click(button('Start today')));
    assert.equal(mocks.start.mock.calls.length, 1);
    await failInput('order'); noPlanPublication();
    await flush(() => start.resolve());
    assert.equal(mocks.replace.mock.calls.length, 0);
  });

  it('Today plan retry cannot clear independent T1 completion recovery', async () => {
    route = TodayScreen;
    mocks.orderRead.mockRejectedValue(new Error('ORDER_UNREADABLE'));
    mocks.get.mockRejectedValueOnce(new Error('COMPLETIONS_UNREADABLE'));
    await mount(); noPlanPublication();
    mocks.orderRead.mockResolvedValue(null);
    await flush(() => click(button('Retry routine')));
    assert.equal(latest.isSourceCurrent(), true);
    assert.match(text(renderer!.root), /Check-offs aren't available right now/);
    noCompletionProjection(); noSuccess();
    await press('Try loading saved check-offs again');
    assert.equal(control('Test product').props.disabled, false);
    assert.deepEqual(client.getQueryData(key()), new Set()); noSuccess();
  });

  it.each(['ownerUserId', 'generation', 'epoch', 'accountGeneration'] as const)(
    'old retry cannot restore old data or dispatch reads into successor %s', async (field) => {
      await mount(); await failInput('order');
      const oldRetry = latest.retry;
      const oldOrder = deferred<null>(); mocks.orderRead.mockReturnValueOnce(oldOrder.promise);
      let settlement: Promise<void>;
      await flush(() => { settlement = oldRetry().catch(() => undefined); });
      noPlanPublication();
      const oldLease = mocks.active!;
      await flush(() => { renderer!.unmount(); renderer = undefined; });
      // Deliberately preserve every cache entry across this authority transition.
      mocks.active = {
        ...oldLease, generation: oldLease.generation + 1,
        [field]: field === 'ownerUserId' ? 'owner-b' : Number(oldLease[field]) + 1,
      };
      mocks.shelfRead.mockResolvedValue({
        items: [{ id: 'successor', engineProduct: { id: 'successor', name: 'Successor product', tags: [] } }],
        conflictChoices: [],
      });
      await mount(); assert.match(text(renderer!.root), /Successor product/);
      const reads = [mocks.shelfRead, mocks.profileRead, mocks.orderRead].map((read) => read.mock.calls.length);
      await assert.rejects(oldRetry);
      assert.deepEqual([mocks.shelfRead, mocks.profileRead, mocks.orderRead].map((read) => read.mock.calls.length), reads);
      await flush(() => oldOrder.resolve(null)); await settlement!;
      assert.match(text(renderer!.root), /Successor product/);
      assert.ok(!text(renderer!.root).includes('Test product'));
      assert.equal(latest.isSourceCurrent(), true);
      assert.equal(mocks.replace.mock.calls.length, 0);
    },
  );
});

function successorShelf() {
  return {
    items: [{ id: 'successor', engineProduct: { id: 'successor', name: 'Successor product', tags: [] } }],
    conflictChoices: [],
  };
}
function successorProfile() {
  return {
    source: 'local', sensitivity: 'sensitive', pregnancy: false,
    pregnancyStatus: 'prefer_not', goals: [],
  };
}
function readCounts() {
  return [mocks.shelfRead, mocks.profileRead, mocks.orderRead].map((read) => read.mock.calls.length);
}

// No cache clear between predecessor and successor in any regression below.
// Source reads, cancellation and cache notifications are real TanStack operations;
// private IO and clinical generation remain controlled boundary fixtures.
describe('PLAN-R2 exact-authority canonical freshness', () => {
  for (const [name, screen] of [['Plan', PlanScreen], ['Today', TodayScreen]] as const) {
    it.each(['generation', 'ownerUserId', 'epoch', 'accountGeneration'] as const)(
      `${name}: warm caches cannot cross %s change; order finishes first`, async (field) => {
        route = screen; await mount();
        assert.equal(latest.isSourceCurrent(), true);
        assert.match(text(renderer!.root), /Test product/);
        const old = latest;
        const oldShelfQuery = client.getQueryCache().find({ queryKey: ['shelf'], exact: true });
        const unrelated = { retained: 'not a plan input' };
        client.setQueryData(['plan-r2-unrelated'], unrelated);
        const before = readCounts();
        const shelf = deferred<ReturnType<typeof successorShelf>>();
        const profile = deferred<ReturnType<typeof successorProfile>>();
        const order = deferred<string>();
        mocks.shelfRead.mockReturnValue(shelf.promise);
        mocks.profileRead.mockReturnValue(profile.promise);
        mocks.orderRead.mockReturnValue(order.promise);
        const previous = mocks.active!;
        mocks.active = {
          ...previous, generation: previous.generation + 1,
          [field]: field === 'ownerUserId' ? 'owner-b' : Number(previous[field]) + 1,
        };
        await rerender(); noPlanPublication();
        assert.equal(old.isSourceCurrent(), false);
        assert.equal(mocks.shelfRead.mock.calls.length, before[0]! + 1);
        assert.equal(mocks.profileRead.mock.calls.length, before[1]! + 1);
        assert.ok(mocks.orderRead.mock.calls.length > before[2]!);
        await flush(() => order.resolve('{"schemaVersion":1,"am":["successor"],"pm":[]}'));
        assert.deepEqual(client.getQueryData(inputKey('order')), { schemaVersion: 1, am: ['successor'], pm: [] });
        assert.equal(latest.sourceReady, false);
        assert.equal(latest.isSourceCurrent(), false);
        noPlanPublication();
        await flush(() => shelf.resolve(successorShelf()));
        noPlanPublication(); assert.equal(latest.sourceReady, false);
        await flush(() => profile.resolve(successorProfile()));
        assert.equal(latest.sourceReady, true); assert.equal(latest.isSourceCurrent(), true);
        assert.match(text(renderer!.root), /Successor product/);
        assert.ok(!text(renderer!.root).includes('Test product'));
        assert.deepEqual(client.getQueryData(['skinProfileBits']), successorProfile());
        assert.equal(client.getQueryCache().find({ queryKey: ['shelf'], exact: true }), oldShelfQuery);
        assert.equal(client.getQueryData(['plan-r2-unrelated']), unrelated);
        const reads = readCounts();
        await assert.rejects(old.retry);
        assert.deepEqual(readCounts(), reads, 'an old handler cannot borrow successor authority');
      },
    );

    it.each(['shelf', 'profile', 'order'] as const)(
      `${name}: old %s retry result settling last cannot replace successor`, async (input) => {
        route = screen; await mount();
        const old = latest;
        const oldData = client.getQueryData(inputKey(input));
        const delayed = deferred<unknown>();
        inputReader(input).mockReturnValueOnce(delayed.promise);
        let oldSettlement: Promise<void> = Promise.resolve();
        await flush(() => { oldSettlement = old.retry().catch(() => undefined); });
        noPlanPublication();
        mocks.active = { ...mocks.active!, generation: mocks.active!.generation + 1 };
        mocks.shelfRead.mockResolvedValue(successorShelf());
        mocks.profileRead.mockResolvedValue(successorProfile());
        mocks.orderRead.mockResolvedValue(null);
        await rerender();
        assert.equal(latest.isSourceCurrent(), true);
        assert.match(text(renderer!.root), /Successor product/);
        const reads = readCounts();
        const cancellations = vi.spyOn(client, 'cancelQueries');
        await flush(() => delayed.resolve(input === 'order' ? JSON.stringify(oldData) : oldData));
        await oldSettlement;
        assert.deepEqual(readCounts(), reads);
        assert.equal(cancellations.mock.calls.length, 0, 'old finally must only detach its listener');
        assert.equal(latest.isSourceCurrent(), true);
        assert.match(text(renderer!.root), /Successor product/);
        assert.ok(!text(renderer!.root).includes('Test product'));
      },
    );

    it(`${name}: withdrawal/regrant preserves caches but requires fresh empty-source confirmation`, async () => {
      route = screen; await mount();
      const previous = mocks.active!;
      const cachedShelf = client.getQueryData(['shelf']);
      mocks.active = undefined;
      await rerender(); noPlanPublication();
      assert.equal(client.getQueryData(['shelf']), cachedShelf);
      const shelf = deferred<{ items: never[]; conflictChoices: never[] }>();
      const profile = deferred<ReturnType<typeof successorProfile>>();
      mocks.shelfRead.mockReturnValue(shelf.promise);
      mocks.profileRead.mockReturnValue(profile.promise);
      mocks.active = { ...previous, generation: previous.generation + 1 };
      await rerender(); noPlanPublication();
      await flush(() => shelf.resolve({ items: [], conflictChoices: [] }));
      noPlanPublication();
      await flush(() => profile.resolve(successorProfile()));
      assert.equal(latest.sourceReady, true); assert.equal(latest.isExample, true);
      if (screen === PlanScreen) {
        assert.match(text(renderer!.root), /Cream cleanser/); assert.ok(button('Start today'));
      } else {
        assert.match(text(renderer!.root), /No routine yet/); assert.ok(button('Add products'));
        assert.equal(renderer!.root.findAll((node) => node.props.accessibilityRole === 'checkbox').length, 0);
      }
    });

    it.each(['shelf', 'profile', 'order'] as const)(
      `${name}: background %s refetch blocks a captured action before observer notification`, async (input) => {
        route = screen; await mount();
        const old = screen === PlanScreen ? button('Start today') : control('Test product');
        const delayed = deferred<unknown>();
        const data = client.getQueryData(inputKey(input));
        inputReader(input).mockReturnValueOnce(delayed.promise);
        await flush(() => {
          void client.refetchQueries({ queryKey: inputKey(input), exact: true });
          click(old);
        });
        noPlanPublication();
        assert.equal(mocks.replace.mock.calls.length, 0);
        assert.equal(mocks.toggle.mock.calls.length, 0);
        await flush(() => delayed.resolve(input === 'order' ? JSON.stringify(data) : data));
        assert.equal(latest.isSourceCurrent(), true);
      },
    );
  }

  it.each([false, true])('a cancelled warm read cannot certify cache (manual replacement=%s)', async (manual) => {
    await mount();
    const shelf = deferred<unknown>(), profile = deferred<unknown>();
    mocks.shelfRead.mockReturnValue(shelf.promise);
    mocks.profileRead.mockReturnValue(profile.promise);
    mocks.active = { ...mocks.active!, generation: mocks.active!.generation + 1 };
    await rerender(); noPlanPublication();
    await act(async () => { await client.cancelQueries({ queryKey: ['shelf'], exact: true }); });
    if (manual) client.setQueryData(['shelf'], successorShelf());
    await flush(() => profile.resolve(successorProfile()));
    assert.equal(client.getQueryState(['shelf'])?.status, 'success', 'warm cancellation can look successful');
    assert.equal(client.getQueryState(['shelf'])?.fetchStatus, 'idle');
    assert.equal(latest.sourceReady, false); assert.equal(latest.isSourceCurrent(), false);
    noPlanPublication(); assert.ok(button('Retry routine'));
    mocks.shelfRead.mockResolvedValue(successorShelf());
    await flush(() => click(button('Retry routine')));
    assert.equal(latest.isSourceCurrent(), true);
    await flush(() => shelf.resolve({ items: [], conflictChoices: [] }));
    assert.match(text(renderer!.root), /Successor product/);
  });

  it('replacement of a certified query cannot inherit its proof through copied cache', async () => {
    await mount();
    const data = client.getQueryData(['shelf']);
    await flush(() => {
      client.removeQueries({ queryKey: ['shelf'], exact: true });
      client.setQueryData(['shelf'], data);
    });
    await rerender(); noPlanPublication();
    assert.equal(latest.isSourceCurrent(), false);
    await flush(() => click(button('Retry routine')));
    assert.equal(latest.isSourceCurrent(), true);
  });

  it('a new-authority draft receives no predecessor data even when product IDs stay identical', async () => {
    await mount();
    const original = client.getQueryData<{ items: { id: string; engineProduct: { id: string; name: string; tags: string[] } }[] }>(['shelf'])!;
    const fresh = { ...original, items: original.items.map((item) => ({
      ...item, engineProduct: { ...item.engineProduct, name: 'Successor same-ID product' },
    })) };
    const read = deferred<typeof fresh>(); mocks.shelfRead.mockReturnValue(read.promise);
    mocks.active = { ...mocks.active!, generation: mocks.active!.generation + 1 };
    await rerender();
    assert.equal(client.getQueryState(inputKey('order'))?.status, 'success');
    assert.equal(latest.sourceReady, false); assert.equal(latest.data, undefined);
    await flush(() => read.resolve(fresh));
    const successor = committedPlanSource();
    assert.equal(successor.isSourceCurrent(), true);
    assert.ok(successor.data);
    assert.equal(successor.data.plan.am[0]?.name, 'Successor same-ID product');
  });

  it('expiry during retry cannot restore a cached plan or start new reads', async () => {
    const expiresAt = Date.now() + 60_000;
    mocks.active = { ...mocks.active!, expiresAt };
    await mount();
    const old = latest;
    const delayed = deferred<null>(); mocks.orderRead.mockReturnValueOnce(delayed.promise);
    let settlement: Promise<void> = Promise.resolve();
    await flush(() => { settlement = old.retry().catch(() => undefined); });
    vi.setSystemTime(expiresAt + 1);
    assert.equal(old.isSourceCurrent(), false);
    await rerender(); noPlanPublication();
    const reads = readCounts();
    await assert.rejects(old.retry); assert.deepEqual(readCounts(), reads);
    await flush(() => delayed.resolve(null)); await settlement;
    noPlanPublication(); assert.equal(latest.sourceReady, false);
  });
});
