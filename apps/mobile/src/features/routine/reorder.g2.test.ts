import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, vi } from 'vitest';

import ReorderScreen from '@/app/routine/reorder';
import type { HealthDataWriteLease } from '@/lib/consent/healthDataWriteAdmission';
import type { GeneratedPlan, PlanStep } from './generate';
import { routineOrderQueryKeyForLease, type RoutineOrderSaveTransaction } from './orderStore';
import type { PlanHookResult } from './usePlan';

// The repo already supplies the matching renderer. Keep this small interface
// local rather than adding a dependency solely for test-renderer declarations.
type TestNode = {
  type: unknown;
  props: Record<string, unknown>;
  children: (TestNode | string)[];
  findAll: (predicate: (node: TestNode) => boolean) => TestNode[];
};
type Renderer = { root: TestNode; update: (element: React.ReactElement) => void; unmount: () => void };
const { act, create } = createRequire(import.meta.url)('react-test-renderer') as {
  act: (callback: () => void | Promise<void>) => PromiseLike<void>;
  create: (element: React.ReactElement) => Renderer;
};

const mocks = vi.hoisted(() => ({
  plan: undefined as PlanHookResult | undefined,
  active: undefined as HealthDataWriteLease | undefined,
  save: vi.fn(), cancelQueries: vi.fn(), setQueryData: vi.fn(),
  refetchQueries: vi.fn(), invalidateQueries: vi.fn(), back: vi.fn(),
  track: vi.fn(), success: vi.fn(), select: vi.fn(),
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' }, Pressable: 'Pressable', ScrollView: 'ScrollView', View: 'View',
}));
vi.mock('@/components/ui', () => ({ Screen: 'Screen', Text: 'Text' }));
vi.mock('expo-router', () => ({ router: {}, useLocalSearchParams: () => ({ phase: 'am' }) }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => mocks }));
vi.mock('@/features/routine/usePlan', () => ({ usePlan: () => mocks.plan }));
vi.mock('@/lib/storage/privateKV', () => ({ getPrivateItem: vi.fn(), updatePrivateItem: vi.fn() }));
vi.mock('@/lib/consent/healthDataWriteAdmission', () => ({
  assertHealthDataWriteLease: (lease: HealthDataWriteLease) => {
    if (!mocks.active) throw new Error('CLOSED');
    for (const key of ['generation', 'epoch', 'ownerUserId', 'accountGeneration'] as const) {
      if (lease[key] !== mocks.active[key]) throw new Error('STALE_EDITOR');
    }
  },
  runCurrentHealthDataOperation: vi.fn(),
}));
vi.mock('@/features/routine/orderStore', async (importOriginal) => ({
  ...await importOriginal<typeof import('./orderStore')>(),
  saveRoutineOrderOverrides: mocks.save,
}));
vi.mock('@/lib/analytics/track', () => ({ track: mocks.track }));
vi.mock('@/lib/cn', () => ({ cn: (...values: string[]) => values.join(' ') }));
vi.mock('@/lib/navigation/safeBack', () => ({ backOrReplace: mocks.back }));
vi.mock('@/theme/haptics', () => ({ haptics: { success: mocks.success, select: mocks.select } }));
vi.mock('@/theme/tokens', () => ({ colors: {} }));


const globals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean; React?: typeof React };
const previousActEnvironment = globals.IS_REACT_ACT_ENVIRONMENT;
const previousReact = globals.React;
beforeAll(() => {
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  // Supports the repo's native JSX transform when Vitest emits classic JSX.
  globals.React = React;
});
afterAll(() => {
  if (previousReact === undefined) Reflect.deleteProperty(globals, 'React');
  else globals.React = previousReact;
  if (previousActEnvironment === undefined) delete globals.IS_REACT_ACT_ENVIRONMENT;
  else globals.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
});

function step(productId: string): PlanStep {
  return { productId, name: productId, instruction: 'Use as directed.', order: 10, cadence: 'stable', role: 'toner' };
}
function plan(am: PlanStep[], pm: PlanStep[]): GeneratedPlan {
  return {
    am, pm, cycle: null, ramp: [], safetyExclusions: [], cadenceWithheld: [],
    sequencingWithheld: [], unplacedProducts: [], gaps: [], conflicts: [],
    conflictCoverageStatus: 'compatible', unsupportedConflictPairs: [],
  };
}
function ready(): PlanHookResult {
  const canonicalPlan = plan([step('a'), step('b')], [step('p'), step('q')]);
  return {
    orderLease: mocks.active, isLoading: false, isError: false, sourceReady: true, isExample: false,
    data: {
      plan: canonicalPlan, canonicalPlan, isExample: false, profileLabel: 'Test',
      orderOverrides: { schemaVersion: 1, am: [], pm: ['hidden', 'p', 'q', 'removed'] },
      orderPersistenceUnavailable: false, activeProductIds: ['a', 'b', 'p', 'q', 'hidden'],
    },
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function text(node: TestNode | string): string {
  return typeof node === 'string' ? node : node.children.map(text).join('');
}
let renderer: Renderer | undefined;
async function flush(operation: () => void = () => undefined) {
  await act(async () => {
    operation();
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
  });
}
async function mount() { await flush(() => { renderer = create(React.createElement(ReorderScreen)); }); }
function button(label: string): TestNode {
  assert.ok(renderer);
  const found = renderer.root.findAll((node) => node.type === 'Pressable' && (
    node.props.accessibilityLabel === label || text(node).trim() === label
  ));
  assert.equal(found.length, 1, `Expected one control: ${label}`);
  return found[0]!;
}
async function press(label: string) {
  const node = button(label);
  assert.notEqual(node.props.disabled, true, `${label} must be enabled`);
  await flush(() => { (node.props.onPress as () => void)(); });
}
function visibleOrder(): string[] {
  assert.ok(renderer);
  return renderer.root.findAll((node) => node.type === 'Pressable' && (
    node.props.accessibilityHint === 'Select to reveal Earlier and Later controls'
  )).map((node) => String(node.props.accessibilityLabel).split('. Step ')[0]!);
}
async function reverseAM() {
  await press('a. Step 1 of 2');
  await press('Move a later');
  assert.deepEqual(visibleOrder(), ['b', 'a']);
}
function noSuccess() {
  assert.equal(mocks.setQueryData.mock.calls.length, 0);
  assert.equal(mocks.track.mock.calls.length, 0);
  assert.equal(mocks.success.mock.calls.length, 0);
  assert.equal(mocks.back.mock.calls.length, 0);
}

beforeEach(() => {
  for (const mock of [mocks.save, mocks.cancelQueries, mocks.setQueryData, mocks.refetchQueries,
    mocks.invalidateQueries, mocks.back, mocks.track, mocks.success, mocks.select]) mock.mockReset();
  mocks.active = { generation: 1, epoch: 1, ownerUserId: 'a', accountGeneration: 0, expiresAt: null };
  mocks.plan = ready();
  mocks.cancelQueries.mockResolvedValue(undefined);
  mocks.refetchQueries.mockResolvedValue(undefined);
  mocks.invalidateQueries.mockResolvedValue(undefined);
  mocks.save.mockImplementation(async (transaction: RoutineOrderSaveTransaction) => transaction.next);
});
afterEach(async () => {
  if (renderer) await flush(() => { renderer?.unmount(); });
  renderer = undefined;
});

describe('G2 routine reorder editor behavior', () => {
  it('disables Save during initial loading, including a forced stale handler invocation', async () => {
    mocks.plan = { ...ready(), data: undefined, isLoading: true, sourceReady: false };
    await mount();
    assert.equal(button('Save').props.disabled, true);
    await flush(() => { (button('Save').props.onPress as () => void)(); });
    assert.equal(mocks.save.mock.calls.length, 0);
    noSuccess();
  });

  it('refuses edits when cached canonical inputs are not authoritative', async () => {
    mocks.plan = { ...ready(), sourceReady: false, isError: true };
    await mount();
    assert.equal(button('Save').props.disabled, true);
    assert.equal(button('a. Step 1 of 2').props.disabled, true);
    await flush(() => { (button('Save').props.onPress as () => void)(); });
    assert.equal(mocks.save.mock.calls.length, 0);
  });

  it('Cancel abandons the local draft without any persistence', async () => {
    await mount();
    await reverseAM();
    await press('Cancel');
    assert.equal(mocks.save.mock.calls.length, 0);
    assert.equal(mocks.setQueryData.mock.calls.length, 0);
    assert.equal(mocks.back.mock.calls.length, 1);
  });

  it('sends original untouched PM intent, including hidden/removed anchors, for an AM-only edit', async () => {
    const previous = mocks.plan!.data!.orderOverrides;
    await mount();
    await reverseAM();
    await press('Save');
    const [transaction, lease] = mocks.save.mock.calls[0] as [RoutineOrderSaveTransaction, HealthDataWriteLease];
    assert.deepEqual(transaction.previous, previous);
    assert.deepEqual(transaction.next.am, ['b', 'a']);
    assert.deepEqual(transaction.next.pm, previous.pm);
    assert.deepEqual(lease, mocks.active);
    assert.deepEqual(mocks.setQueryData.mock.calls[0]![0], routineOrderQueryKeyForLease(lease));
  });

  it('keeps the draft and original previous snapshot when another phase refreshes in cache', async () => {
    const originalPrevious = mocks.plan!.data!.orderOverrides;
    await mount();
    await reverseAM();
    const current = mocks.plan!;
    mocks.plan = { ...current, data: {
      ...current.data!,
      plan: { ...current.data!.plan, pm: [step('q'), step('p')] },
      orderOverrides: { schemaVersion: 1, am: [], pm: ['q', 'p'] },
    } };
    await flush(() => { renderer!.update(React.createElement(ReorderScreen)); });
    assert.deepEqual(visibleOrder(), ['b', 'a']);
    await press('Save');
    const transaction = mocks.save.mock.calls[0]![0] as RoutineOrderSaveTransaction;
    assert.deepEqual(transaction.previous, originalPrevious);
    assert.deepEqual(transaction.next.pm, originalPrevious.pm);
  });

  it('an explicit reset clears only the edited phase override', async () => {
    const current = ready();
    mocks.plan = { ...current, data: { ...current.data!,
      plan: { ...current.data!.plan, am: [step('b'), step('a')] },
      orderOverrides: { ...current.data!.orderOverrides, am: ['b', 'a'] },
    } };
    await mount();
    await press('Fix the order');
    await press('Save');
    const transaction = mocks.save.mock.calls[0]![0] as RoutineOrderSaveTransaction;
    assert.deepEqual(transaction.next.am, []);
    assert.deepEqual(transaction.next.pm, transaction.previous.pm);
  });

  it('a failed write retains the draft and never publishes success; explicit retry can succeed', async () => {
    mocks.save.mockRejectedValueOnce(new Error('WRITE_FAILED'));
    await mount();
    await reverseAM();
    await press('Save');
    noSuccess();
    assert.deepEqual(visibleOrder(), ['b', 'a']);
    assert.ok(text(renderer!.root).includes('Order not saved'));
    await press('Reload saved order');
    assert.equal(mocks.refetchQueries.mock.calls.length, 1);
    assert.deepEqual(visibleOrder(), ['b', 'a']);
    await press('Save');
    assert.equal(mocks.save.mock.calls.length, 2);
    assert.equal(mocks.back.mock.calls.length, 1);
    assert.equal(mocks.success.mock.calls.length, 1);
  });

  it('suppresses double dispatch and locks controls while persistence is pending', async () => {
    const pending = deferred<unknown>();
    mocks.save.mockReturnValueOnce(pending.promise);
    await mount();
    await reverseAM();
    const saveHandler = button('Save').props.onPress as () => void;
    await flush(() => { saveHandler(); saveHandler(); });
    assert.equal(mocks.save.mock.calls.length, 1);
    assert.equal(button('Cancel').props.disabled, true);
    assert.equal(button('Saving').props.disabled, true);
    noSuccess();
    await flush(() => { pending.resolve({ schemaVersion: 1, am: ['b', 'a'], pm: [] }); });
    assert.equal(mocks.back.mock.calls.length, 1);
  });

  it('rejects a stale mounted editor before any dispatch when the owner changes', async () => {
    await mount();
    await reverseAM();
    mocks.active = { ...mocks.active!, generation: 2, ownerUserId: 'b', accountGeneration: 1 };
    await press('Save');
    assert.equal(mocks.cancelQueries.mock.calls.length, 0);
    assert.equal(mocks.save.mock.calls.length, 0);
    noSuccess();
  });

  it('does not dispatch if authority changes while cancelling an old read', async () => {
    const pending = deferred<void>();
    mocks.cancelQueries.mockReturnValueOnce(pending.promise);
    await mount();
    await reverseAM();
    await press('Save');
    mocks.active = { ...mocks.active!, generation: 2 };
    await flush(() => { pending.resolve(); });
    assert.equal(mocks.save.mock.calls.length, 0);
    noSuccess();
  });

  it('a completed old-owner save cannot publish cache, success, or navigation', async () => {
    const pending = deferred<unknown>();
    mocks.save.mockReturnValueOnce(pending.promise);
    await mount();
    await reverseAM();
    await press('Save');
    mocks.active = { ...mocks.active!, generation: 2, ownerUserId: 'b', accountGeneration: 1 };
    await flush(() => { pending.resolve({ schemaVersion: 1, am: ['b', 'a'], pm: [] }); });
    noSuccess();
    assert.equal(mocks.invalidateQueries.mock.calls.length, 0);
  });

  it('a same-owner completion after unmount invalidates only its scope without UI success', async () => {
    const pending = deferred<unknown>();
    mocks.save.mockReturnValueOnce(pending.promise);
    const expectedKey = routineOrderQueryKeyForLease(mocks.active);
    await mount();
    await reverseAM();
    await press('Save');
    await flush(() => { renderer!.unmount(); });
    renderer = undefined;
    await flush(() => { pending.resolve({ schemaVersion: 1, am: ['b', 'a'], pm: [] }); });
    noSuccess();
    assert.deepEqual(mocks.invalidateQueries.mock.calls[0]![0], { queryKey: expectedKey, exact: true });
  });

  it('a failed recovery read neither saves nor discards an existing draft', async () => {
    mocks.save.mockRejectedValueOnce(new Error('WRITE_FAILED'));
    mocks.refetchQueries.mockRejectedValueOnce(new Error('READ_FAILED'));
    await mount();
    await reverseAM();
    await press('Save');
    await press('Reload saved order');
    assert.equal(mocks.save.mock.calls.length, 1);
    assert.deepEqual(visibleOrder(), ['b', 'a']);
    noSuccess();
  });
});
