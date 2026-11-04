import { randomUUID } from 'node:crypto';
import { setImmediate as nextEventLoopTurn } from 'node:timers';
// Register native adapters before importing any Expo/native dependency.
import { close26, grant26, ports26, profile26, reset26 } from '@/features/shelf/firstValue26TestPorts';
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultScheduler, notifyManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Only native ports are synthetic. The component, hooks, Query, codecs,
// encrypted store, C44 proof and original owner/health admission all execute.
import { addProduct, updateProduct } from '@/features/shelf/store';
import { assertOriginalHealthDataWriteLease, captureHealthDataWriteLease } from '@/lib/consent/healthDataWriteAdmission';
import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';
import {
  getPrivateItem,
  removePrivateItem,
  waitForPrivateKVWritesToSettle,
} from '@/lib/storage/privateKV';

import { PlanHistoryPanel45 } from './PlanHistoryPanel45';
import { loadPlanHistory45, PLAN_HISTORY45_KEY, savePlanHistory45 } from './planHistory45';
import { appendPlanHistoryWithSources44, capturePlanSource44 } from './planSourceFence44';
import { usePlan, type RecoverablePlanHookResult } from './usePlan';

let client: QueryClient;
let renderer: ReactTestRenderer | undefined;
let latest: RecoverablePlanHookResult;
let productId: string;
let allowSave: boolean;
let notificationClock: { pending: number; schedule: typeof defaultScheduler };
const releases = new Set<() => void>();

function Harness() {
  const source = usePlan();
  React.useLayoutEffect(() => { latest = source; }, [source]);
  return React.createElement(PlanHistoryPanel45, { source, canSave: allowSave });
}
const element = () => React.createElement(QueryClientProvider, { client }, React.createElement(Harness));
function text(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(text).join('');
}
function button(label: string): ReactTestInstance {
  const matches = renderer!.root.findAll((node) => String(node.type) === 'Pressable' &&
    node.props.accessibilityRole === 'button' && text(node) === label);
  expect(matches).toHaveLength(1);
  return matches[0]!;
}
function readinessDiagnostic() {
  let authorityCurrent = false;
  try {
    if (latest?.orderLease) {
      assertOriginalHealthDataWriteLease(latest.orderLease);
      authorityCurrent = true;
    }
  } catch { /* Booleans only; never print owner, lease or source facts. */ }
  const saveControl = renderer?.root.findAll((node) => String(node.type) === 'Pressable' &&
    node.props.accessibilityRole === 'button' && text(node) === 'Save this plan')[0];
  return {
    authorityCurrent,
    source: latest ? {
      present: latest.data !== undefined, ready: latest.sourceReady,
      current: latest.isSourceCurrent(), loading: latest.isLoading,
      refreshing: latest.isRefreshing, error: latest.isError, example: latest.isExample,
      activeCount: latest.data?.activeProductIds.length ?? 0,
      amCount: latest.data?.plan.am.length ?? 0, pmCount: latest.data?.plan.pm.length ?? 0,
    } : null,
    saveControlPresent: saveControl !== undefined,
    renderedSaveDisabled: saveControl?.props.disabled ?? null,
    activeFetches: client.isFetching(),
    queuedQueryNotifications: notificationClock?.pending ?? 0,
    queries: client.getQueryCache().getAll().map((query) => ({
      kind: query.queryKey[0], status: query.state.status, fetchStatus: query.state.fetchStatus,
      invalidated: query.state.isInvalidated, dataPresent: query.state.data !== undefined,
      errorCode: query.state.error instanceof Error && /^[A-Z0-9_:]+$/u.test(query.state.error.message)
        ? query.state.error.message : query.state.error ? 'UNCLASSIFIED_ERROR' : null,
    })),
  };
}
async function untilObserved(label: string, condition: () => boolean, deliverTimers?: () => void) {
  const deadline = performance.now() + 3_000;
  do {
    // Yield an event-loop turn for the real Query notification timers and let
    // React commit their result. No fixed sleep certifies readiness.
    await act(async () => {
      deliverTimers?.();
      await new Promise<void>((resolve) => { nextEventLoopTurn(resolve); });
    });
    if (condition()) return;
  } while (performance.now() < deadline);
  throw new Error(`C45_UI_OBSERVATION_TIMEOUT:${label}:${JSON.stringify(readinessDiagnostic())}`);
}
async function settle() {
  await untilObserved('committed source/history/capture view', () => {
    if (client.isFetching() || notificationClock.pending || latest.isLoading || latest.isRefreshing) return false;
    const visible = renderer ? text(renderer.root) : '';
    if (['Loading saved plans…', 'Confirming this plan for saving…', 'Saving plan…', 'Refreshing plan…']
      .some((label) => visible.includes(label))) return false;
    const active = client.getQueryCache().getAll().filter((query) => query.getObserversCount() > 0);
    if (latest.orderLease && active.some((query) =>
      query.queryKey[0] === 'planHistory45' && query.state.status === 'pending')) return false;
    const needsCapture = allowSave && latest.sourceReady && latest.isSourceCurrent() &&
      !latest.isExample && (latest.data?.plan.am.length ?? 0) + (latest.data?.plan.pm.length ?? 0) > 0;
    return !needsCapture || active.every((query) =>
      query.queryKey[0] !== 'planHistorySource45' || query.state.status !== 'pending');
  });
}
async function mount() {
  await act(async () => { renderer = create(element()); });
  await settle();
}
async function press(label: string) {
  await act(async () => { button(label).props.onPress({}); });
  await settle();
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  releases.add(resolve);
  return { promise, resolve };
}
async function seedSaved(count = 1) {
  const lease = captureHealthDataWriteLease();
  const snapshot = await capturePlanSource44(lease);
  for (let index = 0; index < count; index += 1) {
    await savePlanHistory45(snapshot, lease, { id: randomUUID(), createdAt: new Date().toISOString() });
  }
}

beforeEach(async () => {
  vi.stubGlobal('__DEV__', true);
  vi.stubGlobal('React', React);
  client = await reset26();
  const clock = { pending: 0, schedule: defaultScheduler };
  notificationClock = clock;
  notifyManager.setScheduler((callback) => {
    clock.pending += 1;
    clock.schedule(() => {
      try { callback(); } finally { clock.pending -= 1; }
    });
  });
  await (await import('@/lib/auth/sessionOwner')).claimLocalDataOwnership('synthetic-first-value-a');
  await profile26();
  productId = (await addProduct({ operationId: randomUUID(), name: 'C45 owner cleanser',
    category: 'cleanser', addedVia: 'manual' })).id;
  allowSave = true;
});
afterEach(async (context) => {
  if (context.task.result?.state === 'fail') {
    console.log('C45_REACT_FAILURE_STATE', JSON.stringify(readinessDiagnostic()));
  }
  notifyManager.setScheduler(defaultScheduler);
  for (const release of releases) release();
  releases.clear();
  if (renderer) await act(async () => renderer!.unmount());
  renderer = undefined;
  await waitForPrivateKVWritesToSettle();
  vi.restoreAllMocks();
  vi.useRealTimers();
  await close26(client);
  vi.unstubAllGlobals();
});

describe('Campaign45 real encrypted owner Plan panel', () => {
  it.each(['one-at-a-time', 'batched'] as const)('waits for native completion and committed query delivery (%s), then reloads one explicit append', async (delivery) => {
    const notifications: (() => void)[] = [];
    notificationClock.schedule = (callback) => { notifications.push(callback); };
    const entered = deferred();
    const release = deferred();
    const releaseCapture = deferred();
    const original = AsyncStorage.getItem;
    let held = false;
    let captureHeld = false;
    const deliverNotifications = () => {
      if (delivery === 'one-at-a-time') notifications.shift()?.();
      else for (const callback of notifications.splice(0)) callback();
    };
    vi.spyOn(AsyncStorage, 'getItem').mockImplementation(async (key) => {
      const raw = await original(key);
      if (key === PLAN_HISTORY45_KEY && !held) {
        held = true;
        entered.resolve();
        await release.promise;
      }
      if (key === 'layerwell.shelf.v1' && !captureHeld && client.getQueryCache().getAll().some((query) =>
        query.queryKey[0] === 'planHistorySource45' && query.getObserversCount() > 0 &&
        query.state.fetchStatus === 'fetching')) {
        captureHeld = true;
        await releaseCapture.promise;
      }
      return raw;
    });
    try {
      await act(async () => { renderer = create(element()); });
      await untilObserved('native history read entered', () => held);
      expect(button('Save this plan').props.disabled).toBe(true);
      expect(ports26.bytes.has(PLAN_HISTORY45_KEY)).toBe(false);
      await act(async () => release.resolve());
      await untilObserved('native query cache is idle', () => client.isFetching() === 0);
      const premature = readinessDiagnostic();
      console.log('C45_REACT_IDLE_READY_COUNTEREXAMPLE', JSON.stringify({
        heldQueryNotifications: notifications.length, ...premature,
      }));
      // The original helper returned here. It did not establish a committed
      // source render or dispatch the source-admitted C44 capture query.
      expect(premature.activeFetches).toBe(0);
      expect(premature.queuedQueryNotifications).toBeGreaterThan(0);
      expect(premature.source?.current).toBe(false);
      expect(button('Save this plan').props.disabled).toBe(true);
      expect(ports26.bytes.has(PLAN_HISTORY45_KEY)).toBe(false);
      await untilObserved('native C44 source capture entered', () => captureHeld, deliverNotifications);
      expect(latest.isSourceCurrent()).toBe(true);
      expect(client.getQueryCache().getAll().some((query) =>
        query.queryKey[0] === 'planHistorySource45' && query.state.fetchStatus === 'fetching')).toBe(true);
      expect(button('Save this plan').props.disabled).toBe(true);
      expect(ports26.bytes.has(PLAN_HISTORY45_KEY)).toBe(false);
      await act(async () => releaseCapture.resolve());
      await untilObserved('current source and capture rendered', () =>
        latest.isSourceCurrent() && button('Save this plan').props.disabled === false,
      deliverNotifications);
      expect(button('Save this plan').props.disabled).toBe(false);
      expect(latest.isSourceCurrent()).toBe(true);
      expect(ports26.bytes.has(PLAN_HISTORY45_KEY)).toBe(false);
      notificationClock.schedule = defaultScheduler;
      await act(async () => { for (const callback of notifications.splice(0)) callback(); });
      await press('Save this plan');
      expect(text(renderer!.root)).toContain('Plan saved on this device.');
      expect((await loadPlanHistory45(captureHealthDataWriteLease())).versions).toHaveLength(1);
      const ciphertext = ports26.bytes.get(PLAN_HISTORY45_KEY);
      await act(async () => renderer!.unmount());
      renderer = undefined;
      await mount();
      expect(text(renderer!.root)).toContain('Plan 1');
      expect((await loadPlanHistory45(captureHealthDataWriteLease())).versions).toHaveLength(1);
      expect(ports26.bytes.get(PLAN_HISTORY45_KEY)).toBe(ciphertext);
    } finally {
      release.resolve();
      releaseCapture.resolve();
      notificationClock.schedule = defaultScheduler;
      await act(async () => { for (const callback of notifications.splice(0)) callback(); });
    }
  });

  it('requires an explicit press, shows only committed dated facts, and reloads without appending', async () => {
    await mount();
    expect(text(renderer!.root)).toContain('No saved plans yet.');
    expect(text(renderer!.root)).toContain('not current advice');
    expect(button('Save this plan').props.disabled, JSON.stringify(readinessDiagnostic())).toBe(false);
    expect(ports26.bytes.has(PLAN_HISTORY45_KEY)).toBe(false);
    await press('Save this plan');
    expect(text(renderer!.root)).toContain('Plan saved on this device.');
    const saved = await loadPlanHistory45(captureHealthDataWriteLease());
    expect(saved.versions).toHaveLength(1);
    expect(saved.versions[0]!.am).toEqual([{ productId, name: 'C45 owner cleanser' }]);
    expect(ports26.bytes.get(PLAN_HISTORY45_KEY)).not.toContain('C45 owner cleanser');
    const row = renderer!.root.findByProps({ accessibilityLabel:
      `Saved plan 1, ${saved.versions[0]!.createdAt}` });
    await act(async () => row.props.onPress());
    expect(text(renderer!.root)).toContain('Morning snapshot1. C45 owner cleanser');
    expect(text(renderer!.root)).not.toMatch(/Maya|Cream cleanser|Ceramide/i);
    await act(async () => renderer!.unmount());
    renderer = undefined;
    // Preserve the actual Query cache: a remount mints a new original lease
    // object and must not borrow the predecessor snapshot's WeakMap proof.
    await mount();
    expect(text(renderer!.root)).toContain('Plan 1');
    await press('Save this plan');
    expect((await loadPlanHistory45(captureHealthDataWriteLease())).versions).toHaveLength(2);
    expect(ports26.track).not.toHaveBeenCalled();
  });

  it('retains factual history while current profile is missing, with save disabled', async () => {
    await seedSaved();
    await mount();
    await removePrivateItem('layerwell.skinprofile.v1');
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['skinProfileBits'] });
      await client.invalidateQueries({ queryKey: ['shelf'] });
    });
    await settle();
    expect(latest.sourceReady).toBe(false);
    expect(button('Save this plan').props.disabled).toBe(true);
    expect(text(renderer!.root)).toContain('Plan 1');
    expect((await loadPlanHistory45(captureHealthDataWriteLease())).versions).toHaveLength(1);
  });

  it('refuses an authentic stale source and refreshes for a new explicit decision', async () => {
    await mount();
    const previousCiphertext = ports26.bytes.get(PLAN_HISTORY45_KEY);
    // Real writer without a cache invalidation: the render still looks ready.
    await updateProduct(productId, { name: 'C45 changed cleanser' });
    expect(latest.isSourceCurrent()).toBe(true);
    await press('Save this plan');
    expect(ports26.bytes.get(PLAN_HISTORY45_KEY)).toBe(previousCiphertext);
    expect(text(renderer!.root)).toContain('Refresh it, review the current plan');
    expect(text(renderer!.root)).not.toContain('Plan saved on this device.');
    await press('Refresh plan');
    expect(ports26.bytes.has(PLAN_HISTORY45_KEY)).toBe(false);
    expect(button('Save this plan').props.disabled).toBe(false);
    await press('Save this plan');
    const saved = await loadPlanHistory45(captureHealthDataWriteLease());
    expect(saved.versions).toHaveLength(1);
    expect(saved.versions[0]!.am[0]!.name).toBe('C45 changed cleanser');
  });

  it('freezes the original retry identity and publishes no success after native refusal', async () => {
    await mount();
    const uuid = vi.spyOn(Crypto, 'randomUUID');
    ports26.failWrite = PLAN_HISTORY45_KEY;
    await press('Save this plan');
    expect(text(renderer!.root)).toContain('We could not confirm this save.');
    expect(text(renderer!.root)).not.toContain('Plan saved on this device.');
    expect(ports26.bytes.has(PLAN_HISTORY45_KEY)).toBe(false);
    ports26.failWrite = null;
    await press('Retry same save');
    const saved = await loadPlanHistory45(captureHealthDataWriteLease());
    expect(saved.versions).toHaveLength(1);
    // Marker capabilities have independent nonces. The plan retry retains the
    // original explicit-save ID, rather than consuming another version ID.
    expect(saved.versions[0]!.id).toBe(uuid.mock.results[0]!.value);
    expect(uuid.mock.results.filter((result) => result.value === saved.versions[0]!.id)).toHaveLength(1);
    expect(text(renderer!.root)).toContain('Plan saved on this device.');
  });

  it('joins repeated presses and waits for native canonical readback before success', async () => {
    await mount();
    const entered = deferred();
    const release = deferred();
    const original = AsyncStorage.setItem;
    let held = false;
    vi.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, raw) => {
      if (key === PLAN_HISTORY45_KEY && !held) {
        held = true;
        entered.resolve();
        await release.promise;
      }
      await original(key, raw);
    });
    const captured = button('Save this plan').props.onPress;
    await act(async () => { captured({}); captured({}); });
    await untilObserved('native history write entered', () => held);
    expect(text(renderer!.root)).toContain('Saving plan…');
    expect(text(renderer!.root)).not.toContain('Plan saved on this device.');
    expect(ports26.bytes.has(PLAN_HISTORY45_KEY)).toBe(false);
    await act(async () => release.resolve());
    await settle();
    await waitForPrivateKVWritesToSettle();
    await settle();
    expect((await loadPlanHistory45(captureHealthDataWriteLease())).versions).toHaveLength(1);
    expect(text(renderer!.root)).toContain('Plan saved on this device.');
  });

  it('refuses native identifier failure without leaving the action stuck or committing', async () => {
    await mount();
    vi.spyOn(Crypto, 'randomUUID').mockImplementationOnce(() => { throw new Error('NATIVE_RANDOM_REFUSED'); });
    await press('Save this plan');
    expect(text(renderer!.root)).toContain('could not be prepared for saving');
    expect(text(renderer!.root)).not.toContain('Plan saved on this device.');
    expect(ports26.bytes.has(PLAN_HISTORY45_KEY)).toBe(false);
    expect(button('Save this plan').props.disabled).toBe(false);
    await press('Save this plan');
    expect((await loadPlanHistory45(captureHealthDataWriteLease())).versions).toHaveLength(1);
  });

  it('hides predecessor details and rejects old callbacks at owner change and regrant', async () => {
    await seedSaved();
    await mount();
    const oldSave = button('Save this plan').props.onPress;
    const saved = await loadPlanHistory45(captureHealthDataWriteLease());
    await act(async () => renderer!.root.findByProps({ accessibilityLabel:
      `Saved plan 1, ${saved.versions[0]!.createdAt}` }).props.onPress());
    expect(text(renderer!.root)).toContain('C45 owner cleanser');
    await act(async () => { await grant26('synthetic-c45-successor'); });
    await settle();
    expect(text(renderer!.root)).not.toContain('C45 owner cleanser');
    expect(text(renderer!.root)).not.toContain('Plan 1');
    const before = ports26.bytes.get(PLAN_HISTORY45_KEY);
    await act(async () => oldSave({}));
    await settle();
    expect(ports26.bytes.get(PLAN_HISTORY45_KEY)).toBe(before);
    expect(text(renderer!.root)).not.toContain('Plan saved on this device.');
    await act(async () => { clearActiveHealthProcessingEpoch(); await grant26(); });
    await settle();
    await act(async () => oldSave({}));
    await settle();
    expect((await loadPlanHistory45(captureHealthDataWriteLease())).versions).toHaveLength(1);
  });

  it('shows loading and read refusal, retries without replacing ciphertext', async () => {
    await seedSaved();
    const originalRaw = ports26.bytes.get(PLAN_HISTORY45_KEY);
    ports26.holdRead = PLAN_HISTORY45_KEY;
    await act(async () => { renderer = create(element()); });
    await untilObserved('native saved-history read held', () => ports26.release !== null);
    expect(text(renderer!.root)).toContain('Loading saved plans…');
    expect(text(renderer!.root)).not.toContain('Plan 1');
    await act(async () => { ports26.release?.(); ports26.release = null; });
    await settle();
    ports26.failRead = PLAN_HISTORY45_KEY;
    await act(async () => { await client.refetchQueries({ queryKey: ['planHistory45'] }); });
    await settle();
    expect(text(renderer!.root)).toContain('Saved plans are unavailable.');
    expect(text(renderer!.root)).not.toContain('Plan 1');
    ports26.failRead = null;
    await press('Retry saved plans');
    expect(text(renderer!.root)).toContain('Plan 1');
    expect(ports26.bytes.get(PLAN_HISTORY45_KEY)).toBe(originalRaw);
  });

  it('never renders invalid encrypted history as empty or leaks its payload', async () => {
    const lease = captureHealthDataWriteLease();
    await appendPlanHistoryWithSources44(await capturePlanSource44(lease), lease, () =>
      '{"schemaVersion":99,"secret":"C45 forbidden plaintext"}');
    const originalRaw = ports26.bytes.get(PLAN_HISTORY45_KEY);
    await mount();
    expect(text(renderer!.root)).toContain('Saved plans are unavailable.');
    expect(text(renderer!.root)).not.toContain('No saved plans yet.');
    expect(text(renderer!.root)).not.toContain('C45 forbidden plaintext');
    expect(button('Save this plan').props.disabled).toBe(true);
    await press('Retry saved plans');
    expect(ports26.bytes.get(PLAN_HISTORY45_KEY)).toBe(originalRaw);
  });

  it('keeps history bounded at capacity and expands the list intentionally', async () => {
    await seedSaved(100);
    const originalRaw = ports26.bytes.get(PLAN_HISTORY45_KEY);
    await mount();
    expect(button('Save this plan').props.disabled).toBe(true);
    expect(text(renderer!.root)).toContain('limit of 100 saved plans');
    const rows = () => renderer!.root.findAll((node) => String(node.type) === 'Pressable' &&
      typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.startsWith('Saved plan '));
    expect(rows()).toHaveLength(5);
    await press('Show more saved plans');
    expect(rows()).toHaveLength(10);
    expect(ports26.bytes.get(PLAN_HISTORY45_KEY)).toBe(originalRaw);
  });

  it('disables sample, refresh and errored canonical sources without automatic writes', async () => {
    await mount();
    allowSave = false;
    await act(async () => renderer!.update(element()));
    expect(button('Save this plan').props.disabled).toBe(true);
    allowSave = true;
    ports26.failRead = 'layerwell.skinprofile.v1';
    await act(async () => { await client.refetchQueries({ queryKey: ['skinProfileBits'] }); });
    await settle();
    expect(button('Save this plan').props.disabled).toBe(true);
    expect(ports26.bytes.has(PLAN_HISTORY45_KEY)).toBe(false);
    ports26.failRead = null;
    await removePrivateItem('layerwell.shelf.v1');
    await act(async () => { await latest.retry(); });
    await settle();
    expect(latest.isExample).toBe(true);
    expect(button('Save this plan').props.disabled).toBe(true);
    expect(text(renderer!.root)).not.toMatch(/Maya|Cream cleanser/);
    expect(ports26.bytes.has(PLAN_HISTORY45_KEY)).toBe(false);
  });

  it('expires visible history and refuses a previously captured save callback', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const initial = Date.now();
    setActiveHealthProcessingEpoch(25, {
      ownerUserId: 'synthetic-first-value-a', accountGeneration: captureHealthDataWriteLease().accountGeneration,
      serverVerifiedAt: new Date(initial).toISOString(),
    });
    await seedSaved();
    await mount();
    const oldSave = button('Save this plan').props.onPress;
    const originalRaw = ports26.bytes.get(PLAN_HISTORY45_KEY);
    vi.setSystemTime(initial + 6 * 60 * 1_000);
    await act(async () => renderer!.update(element()));
    expect(text(renderer!.root)).not.toContain('Plan 1');
    expect(text(renderer!.root)).toContain('current account and health consent are required');
    await act(async () => oldSave({}));
    expect(ports26.bytes.get(PLAN_HISTORY45_KEY)).toBe(originalRaw);
    await expect(Promise.resolve().then(() => getPrivateItem(PLAN_HISTORY45_KEY)))
      .rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
  });
});
