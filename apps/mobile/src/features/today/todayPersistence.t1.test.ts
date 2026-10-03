import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as React from 'react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, vi } from 'vitest';

import TodayScreen from '@/app/(tabs)/today';
import type { HealthDataWriteLease, HealthDataWriteOperationLease } from '@/lib/consent/healthDataWriteAdmission';
import type { ToggleCompletionResult } from './completionsStore';
import { completionActionStateForLease, completionQueryScope } from './localCompletionAccess';

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
vi.mock('@/components/ui', () => ({ Button: 'Button', Screen: 'Screen', Text: 'Text', TodayFocusHeader: 'TodayFocusHeader' }));
vi.mock('@/components/navigation/DockMotion', () => ({ reportDockScroll: () => undefined }));
vi.mock('expo-router', () => ({ router: { push: mocks.push } }));
vi.mock('@/features/ask/AskTeaser', () => ({ AskTeaser: 'AskTeaser' }));
vi.mock('@/features/recommendations/RecommendationsTeaser', () => ({ RecommendationsTeaser: 'RecommendationsTeaser' }));
vi.mock('@/features/subscription/ReverseTrialBanner', () => ({ ReverseTrialBanner: 'ReverseTrialBanner' }));
// PLAN-R1: exercise the actual usePlan and real query observers. Only canonical
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
  activeHealthProcessingLeaseSnapshot: () => mocks.active ?? null,
  subscribeActiveHealthProcessingLeaseChanges: () => () => undefined,
}));
vi.mock('@/features/scheduler/profileMapping', () => ({ routinePlanProfileLabel: () => 'Your profile' }));
vi.mock('@/features/routine/generate', () => ({
  generatePlan: (products: { id: string; name: string }[]) => ({
    am: products.map((product, index) => ({
      productId: product.id, name: product.name, instruction: 'Use as directed.',
      order: index, cadence: 'stable', role: 'cleanser',
    })),
    pm: [], cycle: null, ramp: [], safetyExclusions: [], cadenceWithheld: [],
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
vi.mock('@/features/scheduler/useCycle', () => ({ useCycle: () => ({ data: undefined }) }));
vi.mock('@/features/scheduler/projection', () => ({ friendlyWeekday: () => '', slotLabel: () => '' }));
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
vi.mock('@/features/today/routineProjection', () => ({
  projectTodayRoutine: ({ completedStepKeys }: { completedStepKeys: Set<string> }) => {
    const projection = (phase: string) => {
      const key = `${phase}:product`;
      return { steps: [{ productId: 'product', name: 'Test product', instruction: 'Use as directed.' }],
        stepKeys: [key], firstUndoneKey: completedStepKeys.has(key) ? null : key,
        completedCount: completedStepKeys.has(key) ? 1 : 0 };
    };
    return { source: 'real', hasExamplePlan: false, hasRealRoutine: true,
      am: projection('AM'), pm: projection('PM'), safetyExclusionCount: 0,
      cadenceWithheldCount: 0, sequencingWithheldCount: 0,
      cycle: null, tonight: null, skippedTonight: false, recoveryActive: false,
      paused: false, tonightSlot: null, cycleStripNights: [], cycleActive: false };
  },
}));
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
vi.mock('@/features/review/prompt', () => ({ requestReviewAfterValue: mocks.review }));
vi.mock('@/lib/launch/phase7', () => ({ phase7Flags: { cloudAsk: false } }));
vi.mock('@/theme/haptics', () => ({ haptics: { success: mocks.success, select: () => undefined } }));
vi.mock('@/lib/navigation/safeBack', () => ({ APP_YOU_ROUTE: '/you', backOrReplace: vi.fn() }));
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
const element = () => React.createElement(QueryClientProvider, { client }, React.createElement(TodayScreen));
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

describe('T1 Today local persistence and recovery surface', () => {
  it('loads, checks off, and restores from local storage while React Query is offline', async () => {
    onlineManager.setOnline(false);
    await mount();
    assert.equal(control('Test product').props.disabled, false);
    await press('Test product');
    assert.equal(mocks.toggle.mock.calls.length, 1);
    assert.equal(control('Test product').props['aria-checked'], true);
    await flush(() => renderer!.unmount()); renderer = undefined;
    client.clear(); await mount();
    assert.equal(control('Test product').props['aria-checked'], true);
    assert.equal(mocks.toggle.mock.calls.length, 1);
  });

  it('publishes cache, haptic and analytics only after the local write resolves', async () => {
    const gate = deferred<ToggleCompletionResult>();
    mocks.toggle.mockReturnValueOnce(gate.promise);
    await mount(); mocks.events = [];
    await press('Test product');
    assert.ok(!mocks.events.includes('cache')); noSuccess();
    await flush(() => { mocks.disk.add('AM:product'); mocks.events.push('commit'); gate.resolve(result()); });
    assert.ok(mocks.events.indexOf('commit') < mocks.events.indexOf('cache'));
    assert.ok(mocks.events.indexOf('cache') < mocks.events.indexOf('haptic'));
    assert.ok(mocks.events.indexOf('haptic') < mocks.events.indexOf('analytics'));
  });

  it('ignores a second same-render tap before pending state can render', async () => {
    const gate = deferred<ToggleCompletionResult>(); mocks.toggle.mockReturnValueOnce(gate.promise);
    await mount(); const row = control('Test product');
    await flush(() => { click(row); click(row); });
    assert.equal(mocks.toggle.mock.calls.length, 1);
    await flush(() => { mocks.disk.add('AM:product'); gate.resolve(result()); });
    assert.equal(mocks.success.mock.calls.length, 1);
  });

  it('blocks failed writes and cannot clear recovery from retained React Query data', async () => {
    mocks.toggle.mockRejectedValueOnce(new Error('PRIVATE_WRITE_FAILED'));
    await mount(); const staleRow = control('Test product');
    const stalePress = staleRow.props.onPress as () => void;
    await flush(stalePress); noCompletionProjection(); noSuccess();
    await flush(stalePress); assert.equal(mocks.toggle.mock.calls.length, 1);
    mocks.get.mockRejectedValue(new Error('CORRUPT_LOCAL_READ'));
    await press('Try loading saved check-offs again');
    noCompletionProjection(); noSuccess();
    mocks.get.mockImplementation(async () => new Set(mocks.disk));
    await press('Try loading saved check-offs again');
    assert.equal(control('Test product').props['aria-checked'], false);
    await press('Test product'); assert.equal(mocks.toggle.mock.calls.length, 2);
  });

  it('keeps a slow recovery blocked and suppresses concurrent retry or stale checkoff handlers', async () => {
    mocks.toggle.mockRejectedValueOnce(new Error('AMBIGUOUS'));
    await mount(); const row = control('Test product');
    const rowPress = row.props.onPress as () => void;
    await flush(rowPress);
    const gate = deferred<Set<string>>(); mocks.get.mockReturnValueOnce(gate.promise);
    const retry = control('Try loading saved check-offs again');
    const reads = mocks.get.mock.calls.length;
    await flush(() => { click(retry); click(retry); rowPress(); });
    noCompletionProjection(); assert.equal(mocks.get.mock.calls.length, reads + 1);
    assert.equal(mocks.toggle.mock.calls.length, 1);
    await flush(() => gate.resolve(new Set()));
    assert.equal(control('Test product').props.disabled, false);
  });

  it('shows read-back of surviving ambiguous bytes without inventing a success event', async () => {
    mocks.toggle.mockImplementationOnce(async (step: string) => {
      mocks.disk.add(step); throw new Error('PRIVATE_KV_WRITE_ROLLBACK_FAILED');
    });
    await mount(); await press('Test product'); noCompletionProjection(); noSuccess();
    await press('Try loading saved check-offs again');
    assert.equal(control('Test product').props['aria-checked'], true); noSuccess();
    await press('Test product'); assert.equal(mocks.toggle.mock.calls.length, 1);
  });

  it.each(['COMPLETION_LOG_INVALID', 'COMPLETION_LOG_UNSUPPORTED_VERSION', 'PRIVATE_KV_DECRYPTION_FAILED'])(
    'does not render a zero-completion result for %s, even with retained cached data', async (error) => {
      client.setQueryData(key(), new Set(['AM:product']));
      mocks.get.mockRejectedValue(new Error(error));
      await mount();
      assert.equal(mocks.get.mock.calls.length, 1);
      const query = client.getQueryCache().find({ queryKey: key(), exact: true });
      assert.equal(query?.state.status, 'error');
      assert.equal(query?.state.fetchStatus, 'idle');
      assert.equal(query?.state.error?.message, error);
      assert.match(text(renderer!.root), /Check-offs aren't available right now/);
      assert.equal(control('Try loading saved check-offs again').props.disabled, undefined);
      noCompletionProjection(); noSuccess();
    },
  );

  it('does not treat an unreadable unsynced record as no unsynced work', async () => {
    mocks.unsynced.mockRejectedValue(new Error('UNREADABLE_UNSYNCED'));
    await mount();
    assert.equal(mocks.unsynced.mock.calls.length, 1);
    const query = client.getQueryCache().find({
      queryKey: ['completion-sync-unsynced', ...completionQueryScope(mocks.active)], exact: true,
    });
    assert.equal(query?.state.status, 'error');
    assert.equal(query?.state.fetchStatus, 'idle');
    assert.equal(query?.state.error?.message, 'UNREADABLE_UNSYNCED');
    assert.match(text(renderer!.root), /Check-offs aren't available right now/);
    assert.equal(control('Try loading saved check-offs again').props.disabled, undefined);
    noCompletionProjection(); noSuccess();
  });

  it.each(['switch', 'withdrawal', 'regrant'] as const)(
    'suppresses old callback cache, haptics and review after in-flight %s', async (transition) => {
      mocks.phase = 'PM';
      const gate = deferred<ToggleCompletionResult>(); mocks.toggle.mockReturnValueOnce(gate.promise);
      await mount(); const oldKey = key(); await press('Test product');
      const setsBefore = vi.mocked(client.setQueryData).mock.calls.length;
      mocks.active = transition === 'withdrawal' ? undefined : {
        ...mocks.active!, generation: 2, ownerUserId: transition === 'switch' ? 'owner-b' : 'owner-a',
      };
      await rerender();
      await flush(() => gate.resolve({ ...result('PM:product'), completedStepKeysAfter: new Set(['PM:product']) }));
      noSuccess();
      assert.equal(vi.mocked(client.setQueryData).mock.calls.length, setsBefore);
      assert.notDeepEqual(client.getQueryData(oldKey), new Set(['PM:product']));
    },
  );

  it('does not migrate an old ready handler into a new account', async () => {
    await mount(); const old = control('Test product');
    const oldPress = old.props.onPress as () => void;
    mocks.active = { ...mocks.active!, ownerUserId: 'owner-b', generation: 2 };
    await rerender(); await flush(oldPress);
    assert.equal(mocks.toggle.mock.calls.length, 0); noSuccess();
  });

  it('does not publish to an unmounted screen or request a review after it unmounts', async () => {
    mocks.phase = 'PM'; const gate = deferred<ToggleCompletionResult>(); mocks.toggle.mockReturnValueOnce(gate.promise);
    await mount(); await press('Test product');
    await flush(() => renderer!.unmount()); renderer = undefined;
    await flush(() => gate.resolve(result('PM:product'))); noSuccess();
  });

  it('rejects a stale local-day tap instead of relabeling it with a new day', async () => {
    await mount(); const old = control('Test product');
    const oldPress = old.props.onPress as () => void;
    vi.setSystemTime(new Date(2026, 6, 9, 0, 1));
    await flush(oldPress); assert.equal(mocks.toggle.mock.calls.length, 0); noSuccess();
  });

  it('an idempotent result refreshes cache without a duplicate haptic or analytics', async () => {
    mocks.toggle.mockImplementationOnce(async () => {
      mocks.disk.add('AM:product'); return result('AM:product', false);
    });
    await mount(); await press('Test product');
    assert.equal(control('Test product').props['aria-checked'], true); noSuccess();
  });

  it('a not-done result is recovery, never a success haptic', async () => {
    mocks.toggle.mockResolvedValueOnce({ ...result(), done: false, inserted: false, firstEver: false });
    await mount(); await press('Test product'); noCompletionProjection(); noSuccess();
  });

  it('a late cancelled pre-write read cannot overwrite the committed cache', async () => {
    await mount(); const oldRow = control('Test product'); const stale = deferred<Set<string>>();
    const oldPress = oldRow.props.onPress as () => void;
    mocks.get.mockReturnValueOnce(stale.promise);
    await flush(() => { void client.refetchQueries({ queryKey: key(), exact: true }); });
    await flush(oldPress);
    await flush(() => stale.resolve(new Set()));
    assert.deepEqual(client.getQueryData(key()), new Set(['AM:product']));
  });

  it('a local unsynced recovery write failure requires a fresh read-back', async () => {
    mocks.unsynced.mockResolvedValue([{ reason: 'COMPLETION_TIMEZONE_UNAVAILABLE' }]);
    mocks.recover.mockRejectedValueOnce(new Error('RECOVERY_WRITE_FAILED'));
    await mount(); await press('Try preparing saved check-offs for sync again');
    noCompletionProjection(); noSuccess();
    await press('Try loading saved check-offs again');
    assert.ok(control('Try preparing saved check-offs for sync again'));
  });

  it('downstream haptic failure does not reclassify a confirmed write as storage failure', async () => {
    mocks.success.mockImplementationOnce(() => { throw new Error('HAPTIC_UNAVAILABLE'); });
    await mount(); await press('Test product');
    assert.equal(control('Test product').props['aria-checked'], true);
    assert.equal(mocks.toggle.mock.calls.length, 1);
    assert.ok(!text(renderer!.root).includes("Check-offs aren't available"));
  });
});

// These tests render the actual TodayScreen with real React Query. Phase changes
// update the same mounted screen and QueryClient; retaining that cache is essential
// to reproducing the bug. Native/private-storage boundaries remain controlled mocks.
const RELOAD_CHECKOFFS = 'Try loading saved check-offs again';
function setPM() {
  vi.setSystemTime(new Date(2026, 6, 8, 17, 0, 0));
  mocks.phase = 'PM';
}
function pendingCheckoffHandler(): () => void {
  assert.ok(renderer);
  // Deliberately exercise the rendered CheckRow callback underneath the disabled
  // native Pressable too: same-frame callbacks must respect the synchronous gate.
  const rows = renderer.root.findAll((node) => typeof node.type === 'function' &&
    node.props.name === 'Test product' && typeof node.props.onPress === 'function');
  assert.equal(rows.length, 1);
  return rows[0]!.props.onPress as () => void;
}

describe('T1 phase-boundary persistence scope regressions', () => {
  it('AM failure stays latched in PM with retained cache until BOTH fresh private reads succeed', async () => {
    mocks.toggle.mockRejectedValueOnce(new Error('PRIVATE_WRITE_FAILED'));
    await mount();
    const oldAM = control('Test product');
    const oldAMPress = oldAM.props.onPress as () => void;
    await flush(oldAMPress);
    noCompletionProjection(); noSuccess();
    const readCount = mocks.get.mock.calls.length;
    const unsyncedReadCount = mocks.unsynced.mock.calls.length;
    const sameDayKey = key();
    assert.equal(client.getQueryState(sameDayKey)?.status, 'success');

    setPM(); await rerender();
    assert.deepEqual(key(), sameDayKey);
    assert.equal(mocks.get.mock.calls.length, readCount, 'phase alone must not stand in for a read');
    assert.equal(mocks.unsynced.mock.calls.length, unsyncedReadCount);
    noCompletionProjection(); noSuccess();
    await flush(oldAMPress);
    assert.equal(mocks.toggle.mock.calls.length, 1);

    // Even externally republished retained data cannot clear the action latch.
    await flush(() => client.setQueryData(sameDayKey, new Set<string>()));
    noCompletionProjection();
    const freshSteps = deferred<Set<string>>();
    const freshUnsynced = deferred<unknown[]>();
    mocks.get.mockReturnValueOnce(freshSteps.promise);
    mocks.unsynced.mockReturnValueOnce(freshUnsynced.promise);
    await press(RELOAD_CHECKOFFS);
    assert.equal(mocks.get.mock.calls.length, readCount + 1);
    assert.equal(mocks.unsynced.mock.calls.length, unsyncedReadCount + 1);
    await flush(() => freshSteps.resolve(new Set()));
    noCompletionProjection(); noSuccess(); // One successful read is not both.
    await flush(() => freshUnsynced.resolve([]));
    assert.equal(control('Test product').props.disabled, false);
    assert.equal(control('Test product').props['aria-checked'], false);
    noSuccess();
    await press('Test product');
    assert.equal(mocks.toggle.mock.calls.length, 2);
    assert.equal(mocks.toggle.mock.calls[1]![0], 'PM:product');
    assert.equal(mocks.toggle.mock.calls[1]![1], DAY);
  });

  it.each(['PRIVATE_WRITE_FAILED', 'PRIVATE_KV_WRITE_ROLLBACK_FAILED'])(
    'in-flight AM -> PM settlement %s retains recovery and blocks forced PM dispatch', async (error) => {
      const write = deferred<ToggleCompletionResult>();
      mocks.toggle.mockReturnValueOnce(write.promise);
      await mount(); await press('Test product');
      setPM(); await rerender();
      assert.equal(control('Test product').props.disabled, true);
      const stalePMDispatch = pendingCheckoffHandler();
      await flush(stalePMDispatch);
      assert.equal(mocks.toggle.mock.calls.length, 1);
      await flush(() => {
        if (error === 'PRIVATE_KV_WRITE_ROLLBACK_FAILED') mocks.disk.add('AM:product');
        write.reject(new Error(error));
      });
      noCompletionProjection(); noSuccess();
      assert.equal(vi.mocked(client.setQueryData).mock.calls.length, 0);
      await flush(stalePMDispatch);
      assert.equal(mocks.toggle.mock.calls.length, 1, 'failed latch must also block a captured PM handler');
      mocks.get.mockRejectedValueOnce(new Error('READ_BACK_FAILED'));
      await press(RELOAD_CHECKOFFS);
      noCompletionProjection(); noSuccess();
      await press(RELOAD_CHECKOFFS);
      assert.equal(control('Test product').props.disabled, false);
      assert.equal(control('Test product').props['aria-checked'], false);
      assert.deepEqual(client.getQueryData(key()), mocks.disk);
      noSuccess();
    },
  );

  it('latches a phase-crossing rejection even when settlement precedes the clock rerender', async () => {
    const write = deferred<ToggleCompletionResult>(); mocks.toggle.mockReturnValueOnce(write.promise);
    await mount(); await press('Test product');
    setPM(); // Do NOT call rerender: the old callback must publish recovery to PM.
    await flush(() => write.reject(new Error('AMBIGUOUS')));
    noCompletionProjection(); noSuccess();
    await rerender(); noCompletionProjection();
    await press(RELOAD_CHECKOFFS);
    assert.equal(control('Test product').props.disabled, false); noSuccess();
  });

  it('confirmed AM commit settling in PM reconciles same-day cache and reads without AM success effects', async () => {
    const write = deferred<ToggleCompletionResult>(); mocks.toggle.mockReturnValueOnce(write.promise);
    await mount(); await press('Test product');
    setPM(); await rerender();
    const freshSteps = deferred<Set<string>>(); mocks.get.mockReturnValueOnce(freshSteps.promise);
    const readsBeforeSettlement = mocks.get.mock.calls.length;
    await flush(() => {
      mocks.disk.add('AM:product');
      write.resolve(result('AM:product'));
    });
    assert.deepEqual(client.getQueryData(key()), new Set(['AM:product']));
    assert.equal(mocks.get.mock.calls.length, readsBeforeSettlement + 1);
    noCompletionProjection(); noSuccess();
    await flush(() => freshSteps.resolve(new Set(mocks.disk)));
    assert.equal(control('Test product').props.disabled, false, 'old finally must release the shared PM gate');
    assert.equal(control('Test product').props['aria-checked'], false);
    assert.equal(mocks.toggle.mock.calls.length, 1); noSuccess();
    await press('Test product');
    assert.equal(mocks.toggle.mock.calls.length, 2);
    assert.equal(mocks.success.mock.calls.length, 1, 'only the new PM action earns feedback');
    assert.equal(mocks.track.mock.calls.filter(([name]) => name === 'routine_checkoff_completed').length, 1);
    assert.ok(mocks.track.mock.calls.every(([, properties]) => properties.moment === 'pm'));
    await rerender();
    assert.equal(mocks.success.mock.calls.length, 1);
  });

  it('confirmed phase-crossing commit with unreadable refresh stays unavailable until read-back', async () => {
    const write = deferred<ToggleCompletionResult>(); mocks.toggle.mockReturnValueOnce(write.promise);
    await mount(); await press('Test product');
    setPM(); await rerender();
    mocks.get.mockRejectedValueOnce(new Error('PRIVATE_KV_DECRYPTION_FAILED'));
    await flush(() => { mocks.disk.add('AM:product'); write.resolve(result('AM:product')); });
    noCompletionProjection(); noSuccess();
    assert.deepEqual(client.getQueryData(key()), new Set(['AM:product']));
    await press(RELOAD_CHECKOFFS);
    assert.equal(control('Test product').props.disabled, false); noSuccess();
  });

  it.each(['success', 'failure'] as const)(
    'AM-started explicit read-back settling in PM handles %s under persistence currency', async (outcome) => {
      mocks.toggle.mockRejectedValueOnce(new Error('AMBIGUOUS'));
      await mount(); await press('Test product');
      const read = deferred<Set<string>>(); mocks.get.mockReturnValueOnce(read.promise);
      await press(RELOAD_CHECKOFFS);
      setPM(); await rerender(); noCompletionProjection();
      await flush(() => {
        if (outcome === 'success') read.resolve(new Set());
        else read.reject(new Error('PRIVATE_READ_FAILED'));
      });
      noSuccess();
      if (outcome === 'failure') {
        noCompletionProjection();
        await press(RELOAD_CHECKOFFS);
      }
      assert.equal(control('Test product').props.disabled, false);
      noSuccess();
    },
  );

  it('local unsynced recovery rejected across AM -> PM uses the same persistent read-back latch', async () => {
    mocks.unsynced.mockResolvedValue([{ reason: 'COMPLETION_TIMEZONE_UNAVAILABLE' }]);
    const recovery = deferred<number>(); mocks.recover.mockReturnValueOnce(recovery.promise);
    await mount(); await press('Try preparing saved check-offs for sync again');
    setPM(); await rerender();
    assert.equal(control('Test product').props.disabled, true);
    await flush(() => recovery.reject(new Error('RECOVERY_WRITE_AMBIGUOUS')));
    noCompletionProjection(); noSuccess();
    await press(RELOAD_CHECKOFFS);
    assert.equal(control('Test product').props.disabled, false); noSuccess();
    assert.equal(mocks.recover.mock.calls.length, 1);
  });

  it.each(['switch', 'withdrawal', 'regrant', 'account-generation'] as const)(
    'a phase-crossing old-scope rejection does not contaminate the new %s scope', async (transition) => {
      const write = deferred<ToggleCompletionResult>(); mocks.toggle.mockReturnValueOnce(write.promise);
      await mount(); const oldKey = key(); const oldLease = mocks.active!;
      await press('Test product');
      setPM();
      mocks.active = transition === 'withdrawal' ? undefined : {
        ...oldLease, generation: 2,
        ownerUserId: transition === 'switch' ? 'owner-b' : oldLease.ownerUserId,
        accountGeneration: transition === 'account-generation' ? 1 : oldLease.accountGeneration,
      };
      const newRead = deferred<Set<string>>(); mocks.get.mockReturnValueOnce(newRead.promise);
      await rerender(); noCompletionProjection();
      const cacheSets = vi.mocked(client.setQueryData).mock.calls.length;
      await flush(() => write.reject(new Error('OLD_AM_WRITE_AMBIGUOUS')));
      noCompletionProjection(); noSuccess();
      assert.equal(vi.mocked(client.setQueryData).mock.calls.length, cacheSets);
      assert.deepEqual(client.getQueryData(oldKey), new Set());
      if (transition === 'withdrawal') {
        mocks.active = { ...oldLease, generation: 3 };
        await rerender();
      }
      assert.notDeepEqual(key(), oldKey);
      await flush(() => newRead.resolve(new Set()));
      assert.equal(control('Test product').props.disabled, false, 'old failure must not latch successor authority');
      noSuccess();
    },
  );

  it('old AM catch/finally cannot release a successor owner PM mutation gate', async () => {
    const oldWrite = deferred<ToggleCompletionResult>();
    const newWrite = deferred<ToggleCompletionResult>();
    mocks.toggle.mockReturnValueOnce(oldWrite.promise).mockReturnValueOnce(newWrite.promise);
    await mount(); await press('Test product');
    setPM(); mocks.active = { ...mocks.active!, generation: 2, ownerUserId: 'owner-b' };
    await rerender(); await press('Test product');
    const successorDispatch = pendingCheckoffHandler();
    await flush(() => oldWrite.reject(new Error('OLD_AM_WRITE_FAILED')));
    assert.equal(control('Test product').props.disabled, true);
    await flush(successorDispatch);
    assert.equal(mocks.toggle.mock.calls.length, 2); noSuccess();
    await flush(() => newWrite.reject(new Error('NEW_PM_WRITE_FAILED')));
    noCompletionProjection(); noSuccess();
  });

  it('ordinary day rollover requires a fresh date-specific read even with warm cache and infinite global staleTime', async () => {
    client.setDefaultOptions({ queries: { retry: false, gcTime: Infinity, staleTime: Infinity } });
    await mount(); const oldRow = control('Test product');
    const oldPress = oldRow.props.onPress as () => void;
    const nextDay = '2026-07-09';
    const nextKey = ['completions', nextDay, ...completionQueryScope(mocks.active)] as const;
    client.setQueryData(nextKey, new Set(['AM:product']));
    const freshDay = deferred<Set<string>>(); mocks.get.mockReturnValueOnce(freshDay.promise);
    vi.setSystemTime(new Date(2026, 6, 9, 0, 1)); mocks.phase = 'AM';
    await rerender(); noCompletionProjection();
    assert.equal(mocks.get.mock.calls.at(-1)![0], nextDay);
    await flush(oldPress);
    assert.equal(mocks.toggle.mock.calls.length, 0);
    await flush(() => freshDay.resolve(new Set()));
    assert.equal(control('Test product').props['aria-checked'], false);
    assert.equal(control('Test product').props.disabled, false);
    assert.deepEqual(client.getQueryData(nextKey), new Set()); noSuccess();
  });

  it('a failed new-day read never promotes warm new-day cache to a confirmed empty or done view', async () => {
    await mount();
    const nextDay = '2026-07-09';
    const nextKey = ['completions', nextDay, ...completionQueryScope(mocks.active)] as const;
    client.setQueryData(nextKey, new Set(['AM:product']));
    mocks.get.mockRejectedValueOnce(new Error('NEW_DAY_READ_CORRUPT'));
    vi.setSystemTime(new Date(2026, 6, 9, 0, 1));
    await rerender(); noCompletionProjection(); noSuccess();
    await press(RELOAD_CHECKOFFS);
    assert.equal(mocks.get.mock.calls.at(-1)![0], nextDay);
    assert.equal(control('Test product').props['aria-checked'], false); noSuccess();
  });
});

// R3: one logical private record contains EVERY day's step set. A successful
// new-day query is deliberately allowed to finish before the old-day mutation.
// This is a controlled store boundary, not native encrypted-storage evidence.
const NEXT_DAY = '2026-07-09';
const completionKeyFor = (date: string, lease = mocks.active) =>
  ['completions', date, ...completionQueryScope(lease)] as const;
function nextDay() {
  vi.setSystemTime(new Date(2026, 6, 9, 0, 1));
  mocks.phase = 'AM';
}
function sharedRecord() {
  const days = new Map<string, Set<string>>();
  mocks.get.mockImplementation(async (date: string) => {
    mocks.events.push(`read:${date}`);
    return new Set(days.get(date) ?? []);
  });
  mocks.progressGet.mockImplementation(async (date: string) => ({
    streak: 6, referenceDay: date, locallyCompletedDays: days.size,
  }));
  return days;
}
function oldDayResult(): ToggleCompletionResult {
  return { done: true, inserted: true, firstEver: true, completionDayInserted: true,
    completedStepKeysAfter: new Set(['PM:product']) };
}
function readCountFor(date: string): number {
  return mocks.get.mock.calls.filter(([requested]) => requested === date).length;
}

describe('T1-R3 shared completion-storage midnight races', () => {
  it('an old-day ambiguous write owns the same pending gate after the new-day fresh read completes', async () => {
    sharedRecord(); mocks.phase = 'PM';
    const write = deferred<ToggleCompletionResult>(); mocks.toggle.mockReturnValueOnce(write.promise);
    await mount(); await press('Test product');
    nextDay(); await rerender();
    assert.equal(readCountFor(NEXT_DAY), 1, 'new-day private read actually finished before settlement');
    assert.equal(client.getQueryState(completionKeyFor(NEXT_DAY))?.fetchStatus, 'idle');
    assert.equal(client.getQueryState(completionKeyFor(NEXT_DAY))?.status, 'success');
    assert.equal(control('Test product').props.disabled, true);
    const forcedNewDayDispatch = pendingCheckoffHandler();
    await flush(forcedNewDayDispatch);
    assert.equal(mocks.toggle.mock.calls.length, 1); noSuccess();
    await flush(() => write.reject(new Error('PRIVATE_KV_WRITE_ROLLBACK_FAILED')));
    noCompletionProjection(); noSuccess();
    await flush(forcedNewDayDispatch);
    assert.equal(mocks.toggle.mock.calls.length, 1, 'old finally must not clear recovery for today');
  });

  it('new-day read first, then old-day ambiguous rejection requires BOTH post-settlement private reads', async () => {
    sharedRecord(); mocks.phase = 'PM';
    const write = deferred<ToggleCompletionResult>(); mocks.toggle.mockReturnValueOnce(write.promise);
    await mount(); await press('Test product');
    nextDay(); await rerender();
    const beforeSettlementReads = readCountFor(NEXT_DAY);
    assert.equal(beforeSettlementReads, 1);
    const forcedNewDayDispatch = pendingCheckoffHandler();
    await flush(() => write.reject(new Error('OLD_DAY_COMMIT_UNCONFIRMED')));
    noCompletionProjection(); noSuccess();
    await flush(() => client.setQueryData(completionKeyFor(NEXT_DAY), new Set<string>()));
    await flush(forcedNewDayDispatch);
    assert.equal(mocks.toggle.mock.calls.length, 1);
    assert.equal(readCountFor(NEXT_DAY), beforeSettlementReads, 'a failure must not assume read-back occurred');
    const freshSteps = deferred<Set<string>>(); const freshUnsynced = deferred<unknown[]>();
    mocks.get.mockReturnValueOnce(freshSteps.promise);
    mocks.unsynced.mockReturnValueOnce(freshUnsynced.promise);
    await press(RELOAD_CHECKOFFS);
    assert.equal(readCountFor(NEXT_DAY), beforeSettlementReads + 1);
    await flush(() => freshSteps.resolve(new Set()));
    noCompletionProjection(); noSuccess();
    await flush(() => freshUnsynced.resolve([]));
    assert.equal(control('Test product').props.disabled, false); noSuccess();
    await press('Test product');
    assert.equal(mocks.toggle.mock.calls.length, 2);
    assert.equal(mocks.toggle.mock.calls[1]![1], NEXT_DAY);
  });

  it('late pre-settlement new-day read cannot erase recovery after the old-day rejection', async () => {
    sharedRecord(); mocks.phase = 'PM';
    const write = deferred<ToggleCompletionResult>(); mocks.toggle.mockReturnValueOnce(write.promise);
    await mount(); await press('Test product');
    const oldRead = deferred<Set<string>>(); mocks.get.mockReturnValueOnce(oldRead.promise);
    nextDay(); await rerender(); noCompletionProjection();
    await flush(() => write.reject(new Error('AMBIGUOUS')));
    await flush(() => oldRead.resolve(new Set(['AM:unconfirmed'])));
    noCompletionProjection(); noSuccess();
    assert.notDeepEqual(client.getQueryData(completionKeyFor(NEXT_DAY)), new Set(['AM:unconfirmed']));
    await press(RELOAD_CHECKOFFS);
    assert.equal(control('Test product').props.disabled, false);
    assert.equal(control('Test product').props['aria-checked'], false); noSuccess();
  });

  it('old-day commit-then-reject surviving record is read back in today without synthetic success', async () => {
    const days = sharedRecord(); mocks.phase = 'PM';
    const write = deferred<ToggleCompletionResult>(); mocks.toggle.mockReturnValueOnce(write.promise);
    await mount(); await press('Test product');
    nextDay(); await rerender();
    assert.deepEqual(client.getQueryData(['progress', NEXT_DAY]), {
      streak: 6, referenceDay: NEXT_DAY, locallyCompletedDays: 0,
    });
    await flush(() => {
      days.set(DAY, new Set(['PM:product'])); // committed bytes survive the rejected write
      write.reject(new Error('PRIVATE_KV_WRITE_ROLLBACK_FAILED'));
    });
    noCompletionProjection(); noSuccess();
    mocks.get.mockRejectedValueOnce(new Error('READ_BACK_UNAVAILABLE'));
    await press(RELOAD_CHECKOFFS); noCompletionProjection(); noSuccess();
    await press(RELOAD_CHECKOFFS);
    assert.equal(mocks.get.mock.calls.at(-1)![0], NEXT_DAY);
    assert.equal(control('Test product').props['aria-checked'], false);
    assert.equal(control('Test product').props.disabled, false);
    assert.deepEqual(client.getQueryData(completionKeyFor(NEXT_DAY)), new Set());
    assert.deepEqual(client.getQueryData(['progress', NEXT_DAY]), {
      streak: 6, referenceDay: NEXT_DAY, locallyCompletedDays: 1,
    });
    assert.deepEqual(days.get(DAY), new Set(['PM:product']));
    assert.equal(mocks.toggle.mock.calls.length, 1); noSuccess();
  });

  it('confirmed old-day commit after the new-day read awaits a new today read and refreshes progress without old-day effects', async () => {
    const days = sharedRecord(); mocks.phase = 'PM';
    const write = deferred<ToggleCompletionResult>(); mocks.toggle.mockReturnValueOnce(write.promise);
    await mount(); const oldKey = completionKeyFor(DAY); await press('Test product');
    nextDay(); await rerender();
    const forcedNewDayDispatch = pendingCheckoffHandler();
    assert.equal(readCountFor(NEXT_DAY), 1);
    const fresh = deferred<Set<string>>(); mocks.get.mockReturnValueOnce(fresh.promise);
    await flush(() => { days.set(DAY, new Set(['PM:product'])); write.resolve(oldDayResult()); });
    assert.equal(readCountFor(NEXT_DAY), 2, 'must not refresh only the captured yesterday query');
    assert.deepEqual(client.getQueryData(oldKey), new Set(), 'stale-day result is not manually cached');
    noCompletionProjection(); noSuccess();
    await flush(forcedNewDayDispatch);
    assert.equal(mocks.toggle.mock.calls.length, 1, 'confirmed commit still owns gate during reconciliation');
    await flush(() => fresh.resolve(new Set()));
    assert.equal(control('Test product').props.disabled, false);
    assert.equal(control('Test product').props['aria-checked'], false);
    assert.equal(client.getQueryState(oldKey)?.isInvalidated, true);
    assert.deepEqual(client.getQueryData(['progress', NEXT_DAY]), {
      streak: 6, referenceDay: NEXT_DAY, locallyCompletedDays: 1,
    });
    assert.ok(mocks.progressGet.mock.calls.filter(([date]) => date === NEXT_DAY).length >= 2);
    noSuccess(); await rerender(); noSuccess();
  });

  it('confirmed old-day settlement cancels an unfinished pre-settlement today read before refreshing', async () => {
    const days = sharedRecord(); mocks.phase = 'PM';
    const write = deferred<ToggleCompletionResult>(); mocks.toggle.mockReturnValueOnce(write.promise);
    await mount(); await press('Test product');
    const staleRead = deferred<Set<string>>(); mocks.get.mockReturnValueOnce(staleRead.promise);
    nextDay(); await rerender(); noCompletionProjection();
    const freshRead = deferred<Set<string>>(); mocks.get.mockReturnValueOnce(freshRead.promise);
    await flush(() => { days.set(DAY, new Set(['PM:product'])); write.resolve(oldDayResult()); });
    assert.equal(readCountFor(NEXT_DAY), 2, 'cannot join a read that started before settlement');
    await flush(() => staleRead.resolve(new Set(['AM:stale'])));
    noCompletionProjection(); noSuccess();
    await flush(() => freshRead.resolve(new Set()));
    assert.deepEqual(client.getQueryData(completionKeyFor(NEXT_DAY)), new Set());
    assert.equal(control('Test product').props.disabled, false); noSuccess();
  });

  it('unreadable post-confirmation today refresh latches recovery rather than trusting its earlier successful read', async () => {
    sharedRecord(); mocks.phase = 'PM';
    const write = deferred<ToggleCompletionResult>(); mocks.toggle.mockReturnValueOnce(write.promise);
    await mount(); await press('Test product'); nextDay(); await rerender();
    mocks.get.mockRejectedValueOnce(new Error('POST_SETTLEMENT_READ_CORRUPT'));
    await flush(() => write.resolve(oldDayResult()));
    noCompletionProjection(); noSuccess();
    await flush(() => client.setQueryData(completionKeyFor(NEXT_DAY), new Set<string>()));
    noCompletionProjection();
    await press(RELOAD_CHECKOFFS);
    assert.equal(control('Test product').props.disabled, false); noSuccess();
  });

  it('old-day settlement before the clock rerender still publishes recovery to the current day', async () => {
    sharedRecord(); mocks.phase = 'PM';
    const write = deferred<ToggleCompletionResult>(); mocks.toggle.mockReturnValueOnce(write.promise);
    await mount(); await press('Test product');
    nextDay(); // no explicit rerender before the old continuation runs
    await flush(() => write.reject(new Error('MIDNIGHT_AMBIGUITY')));
    noCompletionProjection(); noSuccess();
    await rerender(); noCompletionProjection();
    await press(RELOAD_CHECKOFFS);
    assert.equal(mocks.get.mock.calls.at(-1)![0], NEXT_DAY);
    assert.equal(control('Test product').props.disabled, false); noSuccess();
  });

  it('a previously latched write failure is not reset by midnight or a successful new-day automatic read', async () => {
    sharedRecord(); mocks.phase = 'PM';
    mocks.toggle.mockRejectedValueOnce(new Error('FAILED_BEFORE_MIDNIGHT'));
    await mount(); await press('Test product'); noCompletionProjection();
    nextDay(); await rerender();
    assert.equal(client.getQueryState(completionKeyFor(NEXT_DAY))?.status, 'success');
    noCompletionProjection(); noSuccess();
    await press(RELOAD_CHECKOFFS);
    assert.equal(readCountFor(NEXT_DAY), 2);
    assert.equal(control('Test product').props.disabled, false); noSuccess();
  });

  it.each(['switch', 'withdrawal-regrant', 'consent-generation', 'account-generation'] as const)(
    'old-day catch/finally cannot release or contaminate a successor %s pending gate', async (transition) => {
      sharedRecord(); mocks.phase = 'PM';
      const oldWrite = deferred<ToggleCompletionResult>(); const newWrite = deferred<ToggleCompletionResult>();
      mocks.toggle.mockReturnValueOnce(oldWrite.promise).mockReturnValueOnce(newWrite.promise);
      await mount(); await press('Test product'); nextDay();
      const original = mocks.active!;
      if (transition === 'withdrawal-regrant') {
        mocks.active = undefined; await rerender(); noCompletionProjection();
      }
      mocks.active = { ...original, generation: 2,
        ownerUserId: transition === 'switch' ? 'owner-b' : original.ownerUserId,
        accountGeneration: transition === 'account-generation' ? 1 : original.accountGeneration };
      await rerender(); await press('Test product');
      const successorDispatch = pendingCheckoffHandler();
      const cancel = vi.spyOn(client, 'cancelQueries');
      const invalidate = vi.spyOn(client, 'invalidateQueries');
      const cacheSets = vi.mocked(client.setQueryData).mock.calls.length;
      await flush(() => oldWrite.reject(new Error('OLD_SCOPE_AMBIGUOUS')));
      assert.equal(control('Test product').props.disabled, true);
      await flush(successorDispatch);
      assert.equal(mocks.toggle.mock.calls.length, 2);
      assert.equal(vi.mocked(client.setQueryData).mock.calls.length, cacheSets);
      assert.equal(cancel.mock.calls.length, 0, 'old catch must not cancel the successor read');
      assert.equal(invalidate.mock.calls.length, 0); noSuccess();
      await flush(() => newWrite.reject(new Error('SUCCESSOR_WRITE_FAILED')));
      noCompletionProjection(); noSuccess();
    },
  );

  it('confirmed old-day continuation cannot refresh or seed a successor consent scope', async () => {
    sharedRecord(); mocks.phase = 'PM';
    const oldWrite = deferred<ToggleCompletionResult>(); mocks.toggle.mockReturnValueOnce(oldWrite.promise);
    await mount(); await press('Test product'); nextDay();
    mocks.active = { ...mocks.active!, generation: 2 };
    await rerender();
    const cancel = vi.spyOn(client, 'cancelQueries'); const invalidate = vi.spyOn(client, 'invalidateQueries');
    const cacheSets = vi.mocked(client.setQueryData).mock.calls.length;
    await flush(() => oldWrite.resolve(oldDayResult()));
    assert.equal(control('Test product').props.disabled, false);
    assert.equal(vi.mocked(client.setQueryData).mock.calls.length, cacheSets);
    assert.equal(cancel.mock.calls.length, 0); assert.equal(invalidate.mock.calls.length, 0); noSuccess();
  });

  it.each(['success', 'failure'] as const)(
    'explicit read-back crossing midnight repeats the date read before %s recovery settlement', async (outcome) => {
      sharedRecord(); mocks.phase = 'PM'; mocks.toggle.mockRejectedValueOnce(new Error('FAILED'));
      await mount(); await press('Test product');
      const oldRead = deferred<Set<string>>(); const newRead = deferred<Set<string>>();
      mocks.get.mockReturnValueOnce(oldRead.promise);
      await press(RELOAD_CHECKOFFS); nextDay(); await rerender();
      assert.equal(readCountFor(NEXT_DAY), 1, 'automatic new-day read is not the old retry result');
      noCompletionProjection();
      mocks.get.mockReturnValueOnce(newRead.promise);
      await flush(() => oldRead.resolve(new Set(['PM:product'])));
      assert.equal(readCountFor(NEXT_DAY), 2, 'must repeat for the newly current calendar day');
      noCompletionProjection(); noSuccess();
      await flush(() => outcome === 'success' ? newRead.resolve(new Set()) : newRead.reject(new Error('READ_BACK_FAILED')));
      if (outcome === 'failure') { noCompletionProjection(); await press(RELOAD_CHECKOFFS); }
      assert.equal(control('Test product').props.disabled, false);
      assert.equal(control('Test product').props['aria-checked'], false); noSuccess();
    },
  );

  it.each(['rejected', 'confirmed'] as const)(
    'local unsynced mutation settling %s after the new-day read uses the same shared-record gate', async (outcome) => {
      sharedRecord(); mocks.phase = 'PM';
      mocks.unsynced.mockResolvedValue([{ reason: 'COMPLETION_TIMEZONE_UNAVAILABLE' }]);
      const recovery = deferred<number>(); mocks.recover.mockReturnValueOnce(recovery.promise);
      await mount(); await press('Try preparing saved check-offs for sync again');
      nextDay(); await rerender();
      assert.equal(control('Test product').props.disabled, true);
      assert.equal(readCountFor(NEXT_DAY), 1);
      await flush(() => outcome === 'confirmed' ? recovery.resolve(1) : recovery.reject(new Error('AMBIGUOUS_RECOVERY')));
      if (outcome === 'rejected') { noCompletionProjection(); await press(RELOAD_CHECKOFFS); }
      assert.equal(readCountFor(NEXT_DAY), 2);
      assert.equal(control('Test product').props.disabled, false);
      assert.equal(mocks.recover.mock.calls.length, 1); noSuccess();
    },
  );
});

describe('T1-R4 same-authority remount gate lifetime regressions', () => {
  it('keeps a remounted Today screen blocked while the old same-record write is pending', async () => {
    mocks.phase = 'PM';
    const write = deferred<ToggleCompletionResult>();
    mocks.toggle.mockReturnValueOnce(write.promise);
    await mount(); await press('Test product');
    assert.equal(mocks.toggle.mock.calls.length, 1);

    await flush(() => { renderer!.unmount(); renderer = undefined; });
    const readsBeforeRemount = mocks.get.mock.calls.length;
    await mount();
    assert.ok(mocks.get.mock.calls.length > readsBeforeRemount);
    assert.equal(control('Test product').props.disabled, true);
    const forced = pendingCheckoffHandler();
    await flush(forced);
    assert.equal(mocks.toggle.mock.calls.length, 1);
    await flush(() => write.reject(new Error('REMOUNT_PENDING_WRITE')));
    noCompletionProjection(); noSuccess();
  });

  it('keeps a remounted screen in recovery after old commit-then-reject bytes survive', async () => {
    mocks.phase = 'PM';
    const write = deferred<ToggleCompletionResult>();
    mocks.toggle.mockReturnValueOnce(write.promise);
    await mount(); await press('Test product');
    await flush(() => { renderer!.unmount(); renderer = undefined; });
    const readsBeforeRemount = mocks.get.mock.calls.length;
    await mount();
    assert.ok(mocks.get.mock.calls.length > readsBeforeRemount);
    mocks.disk.add('PM:product');
    await flush(() => write.reject(new Error('REMOUNT_AMBIGUOUS')));
    noCompletionProjection(); noSuccess();
    const reads = mocks.get.mock.calls.length, unsyncedReads = mocks.unsynced.mock.calls.length;
    // Warm cache cannot acknowledge a write that settled after those reads.
    await flush(() => client.setQueryData(key(), new Set(['PM:product'])));
    noCompletionProjection();
    const steps = deferred<Set<string>>(), unsynced = deferred<never[]>();
    mocks.get.mockReturnValueOnce(steps.promise); mocks.unsynced.mockReturnValueOnce(unsynced.promise);
    await press(RELOAD_CHECKOFFS);
    assert.equal(mocks.get.mock.calls.length, reads + 1);
    assert.equal(mocks.unsynced.mock.calls.length, unsyncedReads + 1);
    await flush(() => steps.resolve(new Set(['PM:product'])));
    noCompletionProjection(); noSuccess();
    await flush(() => unsynced.resolve([]));
    assert.equal(control('Test product').props['aria-checked'], true);
    assert.equal(mocks.toggle.mock.calls.length, 1); noSuccess();
  });

  it('reconciles current reads when an old write confirms after same-authority remount', async () => {
    mocks.phase = 'PM';
    const write = deferred<ToggleCompletionResult>();
    mocks.toggle.mockReturnValueOnce(write.promise);
    await mount(); await press('Test product');
    await flush(() => { renderer!.unmount(); renderer = undefined; });
    await mount();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const reads = mocks.get.mock.calls.length, progressReads = mocks.progressGet.mock.calls.length;
    const unsyncedReads = mocks.unsynced.mock.calls.length;
    const fresh = deferred<Set<string>>(); mocks.get.mockReturnValueOnce(fresh.promise);
    await flush(() => { mocks.disk.add('PM:product'); write.resolve(oldDayResult()); });
    assert.ok(invalidate.mock.calls.length > 0);
    assert.equal(mocks.get.mock.calls.length, reads + 1);
    noCompletionProjection(); noSuccess();
    await flush(() => fresh.resolve(new Set(['PM:product'])));
    assert.ok(mocks.progressGet.mock.calls.length > progressReads);
    assert.ok(mocks.unsynced.mock.calls.length > unsyncedReads);
    assert.equal(control('Test product').props['aria-checked'], true);
    assert.equal(control('Test product').props.disabled, false);
    assert.equal(mocks.toggle.mock.calls.length, 1); noSuccess();
  });
});


describe('T1-R4 remount settlement, authority, and listener boundaries', () => {
  it.each(['confirmed', 'ambiguous'] as const)(
    'retains %s settlement while no Today screen is subscribed', async (outcome) => {
      const write = deferred<ToggleCompletionResult>(); mocks.toggle.mockReturnValueOnce(write.promise);
      await mount(); const oldPress = control('Test product').props.onPress as () => void;
      await press('Test product');
      await flush(() => { renderer!.unmount(); renderer = undefined; });
      await flush(() => {
        mocks.disk.add('AM:product');
        if (outcome === 'confirmed') write.resolve(result('AM:product'));
        else write.reject(new Error('NO_SUBSCRIBER_AMBIGUITY'));
      });
      await mount(); noSuccess();
      await flush(oldPress); assert.equal(mocks.toggle.mock.calls.length, 1);
      if (outcome === 'ambiguous') { noCompletionProjection(); await press(RELOAD_CHECKOFFS); }
      assert.equal(control('Test product').props['aria-checked'], true); noSuccess();
    },
  );

  it.each(['confirmed', 'ambiguous'] as const)(
    'keeps pending and %s settlement across BOTH midnight and same-authority remount', async (outcome) => {
      const days = sharedRecord(); mocks.phase = 'PM';
      const write = deferred<ToggleCompletionResult>(); mocks.toggle.mockReturnValueOnce(write.promise);
      await mount(); await press('Test product');
      await flush(() => { renderer!.unmount(); renderer = undefined; }); nextDay(); await mount();
      assert.equal(control('Test product').props.disabled, true);
      assert.equal(readCountFor(NEXT_DAY), 1);
      await flush(() => {
        days.set(DAY, new Set(['PM:product']));
        if (outcome === 'confirmed') write.resolve(oldDayResult()); else write.reject(new Error('AMBIGUOUS'));
      });
      if (outcome === 'ambiguous') { noCompletionProjection(); await press(RELOAD_CHECKOFFS); }
      assert.equal(control('Test product').props.disabled, false);
      assert.equal(control('Test product').props['aria-checked'], false);
      assert.equal(readCountFor(NEXT_DAY), 2);
      assert.deepEqual(client.getQueryData(['progress', NEXT_DAY]), {
        streak: 6, referenceDay: NEXT_DAY, locallyCompletedDays: 1,
      }); noSuccess();
    },
  );

  it.each(['success', 'failure'] as const)(
    'retains an in-flight explicit retry across remount and handles read-back %s', async (outcome) => {
      mocks.toggle.mockRejectedValueOnce(new Error('AMBIGUOUS'));
      await mount(); await press('Test product');
      const steps = deferred<Set<string>>(); mocks.get.mockReturnValueOnce(steps.promise);
      await press(RELOAD_CHECKOFFS);
      await flush(() => { renderer!.unmount(); renderer = undefined; }); await mount();
      noCompletionProjection();
      assert.equal(completionActionStateForLease(mocks.active).pendingKey, 'reload');
      await flush(() => outcome === 'success' ? steps.resolve(new Set()) : steps.reject(new Error('RETRY_READ_FAILED')));
      if (outcome === 'failure') { noCompletionProjection(); await press(RELOAD_CHECKOFFS); }
      assert.equal(control('Test product').props.disabled, false);
      assert.equal(mocks.toggle.mock.calls.length, 1); noSuccess();
    },
  );

  it.each(['confirmed', 'ambiguous'] as const)(
    'retains local unsynced-recovery %s settlement across same-authority remount', async (outcome) => {
      mocks.unsynced.mockResolvedValue([{ reason: 'COMPLETION_TIMEZONE_UNAVAILABLE' }]);
      const write = deferred<number>(); mocks.recover.mockReturnValueOnce(write.promise);
      await mount(); await press('Try preparing saved check-offs for sync again');
      await flush(() => { renderer!.unmount(); renderer = undefined; }); await mount();
      assert.equal(control('Test product').props.disabled, true);
      await flush(() => {
        mocks.unsynced.mockResolvedValue([]);
        if (outcome === 'confirmed') write.resolve(1); else write.reject(new Error('RECOVERY_AMBIGUOUS'));
      });
      if (outcome === 'ambiguous') { noCompletionProjection(); await press(RELOAD_CHECKOFFS); }
      assert.equal(control('Test product').props.disabled, false);
      assert.equal(mocks.recover.mock.calls.length, 1); noSuccess();
    },
  );

  it.each(['ownerUserId', 'generation', 'epoch', 'accountGeneration'] as const)(
    'old remounted settlement cannot refresh, fail, publish or unlock successor %s', async (field) => {
      const oldWrite = deferred<ToggleCompletionResult>(), nextWrite = deferred<ToggleCompletionResult>();
      mocks.toggle.mockReturnValueOnce(oldWrite.promise).mockReturnValueOnce(nextWrite.promise);
      await mount(); await press('Test product');
      await flush(() => { renderer!.unmount(); renderer = undefined; });
      const previous = mocks.active!;
      mocks.active = { ...previous, [field]: field === 'ownerUserId' ? 'owner-b' : Number(previous[field]) + 1 };
      await mount(); await press('Test product');
      const forced = pendingCheckoffHandler();
      const cancel = vi.spyOn(client, 'cancelQueries'), invalidate = vi.spyOn(client, 'invalidateQueries');
      const cacheWrites = vi.mocked(client.setQueryData).mock.calls.length;
      await flush(() => oldWrite.reject(new Error('OLD_AMBIGUOUS')));
      assert.equal(cancel.mock.calls.length, 0); assert.equal(invalidate.mock.calls.length, 0);
      assert.equal(vi.mocked(client.setQueryData).mock.calls.length, cacheWrites);
      assert.equal(control('Test product').props.disabled, true);
      await flush(forced); assert.equal(mocks.toggle.mock.calls.length, 2);
      await flush(() => nextWrite.reject(new Error('SUCCESSOR_OWN_FAILURE')));
      noCompletionProjection(); noSuccess();
    },
  );

  it('late confirmed settlement cannot reconcile a withdrawn-then-regranted replacement', async () => {
    const write = deferred<ToggleCompletionResult>(); mocks.toggle.mockReturnValueOnce(write.promise);
    await mount(); await press('Test product'); const oldLease = mocks.active!;
    await flush(() => { renderer!.unmount(); renderer = undefined; });
    mocks.active = undefined; await mount(); noCompletionProjection();
    await flush(() => { renderer!.unmount(); renderer = undefined; });
    mocks.active = { ...oldLease, generation: oldLease.generation + 1 }; await mount();
    const invalidate = vi.spyOn(client, 'invalidateQueries'), cancel = vi.spyOn(client, 'cancelQueries');
    const writes = vi.mocked(client.setQueryData).mock.calls.length;
    await flush(() => write.resolve(result('AM:product')));
    assert.equal(invalidate.mock.calls.length, 0); assert.equal(cancel.mock.calls.length, 0);
    assert.equal(vi.mocked(client.setQueryData).mock.calls.length, writes);
    assert.equal(control('Test product').props.disabled, false); noSuccess();
  });

  it('StrictMode setup/cleanup replay does not retire storage or duplicate success', async () => {
    await flush(() => { renderer = create(React.createElement(React.StrictMode, null, element())); });
    const write = deferred<ToggleCompletionResult>(); mocks.toggle.mockReturnValueOnce(write.promise);
    await press('Test product');
    await flush(() => { mocks.disk.add('AM:product'); write.resolve(result('AM:product')); });
    assert.equal(mocks.toggle.mock.calls.length, 1);
    assert.equal(mocks.success.mock.calls.length, 1);
    assert.equal(control('Test product').props['aria-checked'], true);
  });
});
