import { randomUUID } from 'node:crypto';
// Register native adapters before importing any Expo/native dependency.
import { close26, flush26, grant26, ports26, profile26, reset26 } from '@/features/shelf/firstValue26TestPorts';
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Only native ports are synthetic. The component, hooks, Query, codecs,
// encrypted store, C44 proof and original owner/health admission all execute.
import { addProduct, updateProduct } from '@/features/shelf/store';
import { captureHealthDataWriteLease } from '@/lib/consent/healthDataWriteAdmission';
import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';
import {
  getPrivateItem,
  removePrivateItem,
  setPrivateItem,
  waitForPrivateKVWritesToSettle,
} from '@/lib/storage/privateKV';

import { PlanHistoryPanel45 } from './PlanHistoryPanel45';
import { loadPlanHistory45, PLAN_HISTORY45_KEY, savePlanHistory45 } from './planHistory45';
import { capturePlanSource44 } from './planSourceFence44';
import { usePlan, type RecoverablePlanHookResult } from './usePlan';

let client: QueryClient;
let renderer: ReactTestRenderer | undefined;
let latest: RecoverablePlanHookResult;
let productId: string;
let allowSave: boolean;
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
async function settle() {
  for (let count = 0; count < 20; count += 1) {
    await flush26();
    if (!client.isFetching()) return;
  }
  throw new Error('C45_UI_QUERIES_DID_NOT_SETTLE');
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
  await profile26();
  productId = (await addProduct({ operationId: randomUUID(), name: 'C45 owner cleanser',
    category: 'cleanser', addedVia: 'manual' })).id;
  allowSave = true;
});
afterEach(async () => {
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
  it('requires an explicit press, shows only committed dated facts, and reloads without appending', async () => {
    await mount();
    expect(text(renderer!.root)).toContain('No saved plans yet.');
    expect(text(renderer!.root)).toContain('not current advice');
    expect(button('Save this plan').props.disabled).toBe(false);
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
    expect(uuid).toHaveBeenCalledTimes(1);
    expect((await loadPlanHistory45(captureHealthDataWriteLease())).versions).toHaveLength(1);
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
    await act(async () => { captured({}); captured({}); await entered.promise; });
    expect(text(renderer!.root)).toContain('Saving plan…');
    expect(text(renderer!.root)).not.toContain('Plan saved on this device.');
    expect(ports26.bytes.has(PLAN_HISTORY45_KEY)).toBe(false);
    await act(async () => release.resolve());
    await settle();
    await waitForPrivateKVWritesToSettle();
    await flush26();
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
    await flush26();
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
    await setPrivateItem(PLAN_HISTORY45_KEY, '{"schemaVersion":99,"secret":"C45 forbidden plaintext"}');
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
