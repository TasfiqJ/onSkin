import { randomUUID } from 'node:crypto';
import { createElement, useEffect } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Only existing native platform/transport ports are synthetic. Encryption,
// codecs, domain stores, Query, generation and all owner/health leases are real.
import { close26, flush26, ports26, profile26, reset26 } from '@/features/shelf/firstValue26TestPorts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addProduct, loadShelf, removeProduct, updateProduct } from '@/features/shelf/store';
import { HEALTH_DATA_CONSENT } from '@/features/onboarding/consentCopy';
import { setHealthDataCollectionConsentLocal } from '@/features/onboarding/healthConsentStore';
import { updateStoredPregnancyStatus } from '@/features/onboarding/skinProfileStore';
import { previewDetectConflicts } from '@/features/intelligence/engine';
import { STARTER_RULES } from '@/features/intelligence/rules';
import { setConflictChoice, setConflictOverride } from '@/features/intelligence/overrides';
import { beginAccountGenerationBoundary, endAccountGenerationBoundary, runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { captureHealthDataWriteLease } from '@/lib/consent/healthDataWriteAdmission';
import { clearActiveHealthProcessingEpoch, setActiveHealthProcessingEpoch } from '@/lib/consent/healthProcessingEpoch';
import { getPrivateItem, removePrivateItem, updatePrivateItem, waitForPrivateKVWritesToSettle } from '@/lib/storage/privateKV';

import { capturePlanSource44, PLAN_SOURCE44_STALE, savePlanOrderWithSource44 } from './planSourceFence44';
import { usePlan, type RecoverablePlanHookResult } from './usePlan';

const ORDER = 'layerwell.routineOrder.v1';
const SHELF = 'layerwell.shelf.v1';
const PROFILE = 'layerwell.skinprofile.v1';
const CHOICES = 'layerwell.conflict.overrides';
const CONSENT = 'layerwell.healthDataCollectionConsent.v1';
const releases = new Set<() => void>();
let client: QueryClient;
let productId: string;
let secondId: string;
let renderer: ReactTestRenderer | undefined;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function holdNativeWrite(keyToHold: string) {
  const entered = deferred();
  const gate = deferred();
  releases.add(gate.resolve);
  const original = AsyncStorage.setItem;
  const writes: string[] = [];
  let held = false;
  vi.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, raw) => {
    if (key === keyToHold && !held) {
      held = true;
      entered.resolve();
      await gate.promise;
    }
    await original(key, raw);
    writes.push(key);
  });
  return { entered: entered.promise, release: gate.resolve, writes };
}

function holdNativeRead(keyToHold: string, occurrence = 1) {
  const entered = deferred();
  const gate = deferred();
  releases.add(gate.resolve);
  const original = AsyncStorage.getItem;
  let held = false;
  let reads = 0;
  vi.spyOn(AsyncStorage, 'getItem').mockImplementation(async (key) => {
    const observed = await original(key);
    if (key === keyToHold && !held && ++reads === occurrence) {
      held = true;
      entered.resolve();
      await gate.promise;
    }
    return observed;
  });
  return { entered: entered.promise, release: gate.resolve };
}

function nextOrder() {
  return { schemaVersion: 1 as const, am: [secondId, productId], pm: [productId, secondId] };
}

beforeEach(async () => {
  vi.stubGlobal('__DEV__', true);
  client = await reset26();
  await profile26();
  productId = (await addProduct({ operationId: randomUUID(), name: 'Synthetic44 cleanser A', category: 'cleanser', addedVia: 'manual' })).id;
  secondId = (await addProduct({ operationId: randomUUID(), name: 'Synthetic44 cleanser B', category: 'cleanser', addedVia: 'manual' })).id;
});

afterEach(async () => {
  for (const release of releases) release();
  releases.clear();
  await waitForPrivateKVWritesToSettle();
  if (renderer) await act(async () => renderer!.unmount());
  renderer = undefined;
  vi.restoreAllMocks();
  await close26(client);
  vi.unstubAllGlobals();
});

describe('Campaign44 actual local plan-source adapter', () => {
  it('captures real current quiz/Shelf facts with successful absent choice/order defaults, then writes only encrypted existing order', async () => {
    const snapshot = await capturePlanSource44(captureHealthDataWriteLease());
    expect(snapshot.source).toBe('local');
    expect(snapshot.sourceHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(snapshot.activeProductIds).toEqual(expect.arrayContaining([productId, secondId]));
    expect(snapshot.am).toContainEqual({ productId, name: 'Synthetic44 cleanser A' });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.am[0])).toBe(true);
    expect(await getPrivateItem(CHOICES)).toBeNull();
    expect(await getPrivateItem(ORDER)).toBeNull();
    const keysBefore = [...ports26.bytes.keys()].sort();
    const saved = await savePlanOrderWithSource44(snapshot, nextOrder());
    expect(saved).toEqual(nextOrder());
    expect(JSON.parse((await getPrivateItem(ORDER))!)).toEqual(saved);
    expect(ports26.bytes.get(ORDER)).not.toContain('Synthetic44');
    expect(JSON.parse(ports26.bytes.get(ORDER)!).version).toBe('xchacha20poly1305:v1');
    expect([...ports26.bytes.keys()].sort()).toEqual([...keysBefore, ORDER].sort());
    expect(ports26.track).not.toHaveBeenCalled();
  });

  for (const change of ['removed-Shelf-product', 'pregnancy-profile', 'profile-after-readback'] as const) {
    it(`refuses a captured source after actual ${change} completes, before any destination write`, async () => {
      const snapshot = await capturePlanSource44(captureHealthDataWriteLease());
      const before = ports26.bytes.get(ORDER);
      if (change === 'removed-Shelf-product') await removeProduct(productId);
      else await updateStoredPregnancyStatus('pregnant');
      const write = vi.spyOn(AsyncStorage, 'setItem');
      await expect(savePlanOrderWithSource44(snapshot, nextOrder())).rejects.toThrow(PLAN_SOURCE44_STALE);
      expect(write.mock.calls.filter(([key]) => key === ORDER)).toHaveLength(0);
      expect(ports26.bytes.get(ORDER)).toBe(before);
    });
  }

  for (const key of [SHELF, PROFILE]) {
    it(`waits for an already begun real ${key} mutation before refusing stale capture`, async () => {
      const snapshot = await capturePlanSource44(captureHealthDataWriteLease());
      const gate = holdNativeWrite(key);
      const mutation = key === SHELF ? removeProduct(productId) : updateStoredPregnancyStatus('pregnant');
      await gate.entered;
      const refused = expect(savePlanOrderWithSource44(snapshot, nextOrder())).rejects.toThrow(PLAN_SOURCE44_STALE);
      gate.release();
      await mutation;
      await refused;
      expect(gate.writes).not.toContain(ORDER);
    });

    it(`orders a real ${key} mutation queued behind a held destination write AFTER the truthful snapshot`, async () => {
      const snapshot = await capturePlanSource44(captureHealthDataWriteLease());
      const gate = holdNativeWrite(ORDER);
      const saved = savePlanOrderWithSource44(snapshot, nextOrder());
      await gate.entered;
      const mutation = key === SHELF ? removeProduct(productId) : updateStoredPregnancyStatus('pregnant');
      gate.release();
      await saved;
      await mutation;
      expect(gate.writes.indexOf(ORDER)).toBeLessThan(gate.writes.indexOf(key));
      expect(gate.writes.indexOf(key)).toBeGreaterThanOrEqual(0);
      // This is a point-in-time claim: a later source mutation is allowed.
      expect(JSON.parse((await getPrivateItem(ORDER))!)).toEqual(nextOrder());
      await expect(savePlanOrderWithSource44(snapshot, nextOrder())).rejects.toThrow(PLAN_SOURCE44_STALE);
    });
  }

  it('holds the source reservation through an async native read, ordering a later Shelf mutation after commit', async () => {
    const snapshot = await capturePlanSource44(captureHealthDataWriteLease());
    const gate = holdNativeRead(SHELF);
    const saved = savePlanOrderWithSource44(snapshot, nextOrder());
    await gate.entered;
    const mutation = updateProduct(productId, { name: 'Synthetic44 changed after snapshot' });
    gate.release();
    await saved;
    await mutation;
    expect((await loadShelf()).find((product) => product.id === productId)?.name).toBe('Synthetic44 changed after snapshot');
    await expect(savePlanOrderWithSource44(snapshot, nextOrder())).rejects.toThrow(PLAN_SOURCE44_STALE);
  });

  it('retains source reservations during actual post-write native readback', async () => {
    const snapshot = await capturePlanSource44(captureHealthDataWriteLease());
    // Initial source authentication, prewrite conflict read, then readback.
    const gate = holdNativeRead(SHELF, 3);
    const events: string[] = [];
    const saved = savePlanOrderWithSource44(snapshot, nextOrder()).then(() => { events.push('snapshot'); });
    await gate.entered;
    expect(JSON.parse((await getPrivateItem(ORDER))!)).toEqual(nextOrder());
    const mutation = removeProduct(productId).then(() => { events.push('source'); });
    gate.release();
    await Promise.all([saved, mutation]);
    expect(events).toEqual(['snapshot', 'source']);
  });

  it('keeps conflict admission closed, and invalidates on real dormant-choice removal and unrelated whole-Shelf metadata', async () => {
    const conflict = previewDetectConflicts([
      { id: productId, name: 'Retinol', tags: ['retinoid'] },
      { id: secondId, name: 'Glycolic', tags: ['aha'] },
    ], { sensitivity: 'sensitive', reproductiveStatus: 'none' }, STARTER_RULES)[0]!;
    await expect(setConflictChoice(conflict, 'accept_suggested_timing')).rejects.toThrow('CONFLICT_CHOICE_NOT_ELIGIBLE');
    // Genuine accepted legacy bytes stay dormant. The public compatibility
    // writer can erase them, but this test never grants a clinical review gate.
    const legacyKey = `${conflict.rule.id}:${[productId, secondId].sort().join('+')}`;
    await updatePrivateItem(CHOICES, () => JSON.stringify([legacyKey]));
    const snapshot = await capturePlanSource44(captureHealthDataWriteLease());
    await setConflictOverride(legacyKey, false);
    await expect(savePlanOrderWithSource44(snapshot, nextOrder())).rejects.toThrow(PLAN_SOURCE44_STALE);
    const fresh = await capturePlanSource44(captureHealthDataWriteLease());
    await updateProduct(productId, { brand: 'Synthetic44 mirror-only metadata' });
    await expect(savePlanOrderWithSource44(fresh, nextOrder())).rejects.toThrow(PLAN_SOURCE44_STALE);
  });

  it('reserves local consent as a source even when a low-level decline has not closed the health epoch', async () => {
    const snapshot = await capturePlanSource44(captureHealthDataWriteLease());
    await setHealthDataCollectionConsentLocal({ granted: false, version: HEALTH_DATA_CONSENT.version, consentText: HEALTH_DATA_CONSENT.declineText });
    await expect(savePlanOrderWithSource44(snapshot, nextOrder())).rejects.toThrow(PLAN_SOURCE44_STALE);
    await expect(capturePlanSource44(captureHealthDataWriteLease())).rejects.toThrow();
    expect(ports26.bytes.has(ORDER)).toBe(false);
  });

  for (const owner of ['synthetic-first-value-a', 'synthetic-owner44-b']) {
    it(`cannot borrow fresh authority after withdrawal/regrant to ${owner}`, async () => {
      const snapshot = await capturePlanSource44(captureHealthDataWriteLease());
      const generation = await runAccountGenerationOperation((lease) => lease.generation);
      clearActiveHealthProcessingEpoch();
      setActiveHealthProcessingEpoch(25, { ownerUserId: owner, accountGeneration: generation });
      await expect(savePlanOrderWithSource44(snapshot, nextOrder())).rejects.toThrow();
      expect(ports26.bytes.has(ORDER)).toBe(false);
    });
  }

  it('refuses changed account generation and changed epoch without replacing the original authority', async () => {
    const snapshot = await capturePlanSource44(captureHealthDataWriteLease());
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    const generation = await runAccountGenerationOperation((lease) => lease.generation);
    setActiveHealthProcessingEpoch(25, { ownerUserId: 'synthetic-first-value-a', accountGeneration: generation });
    await expect(savePlanOrderWithSource44(snapshot, nextOrder())).rejects.toThrow();
    const current = await capturePlanSource44(captureHealthDataWriteLease());
    setActiveHealthProcessingEpoch(26, { ownerUserId: 'synthetic-first-value-a', accountGeneration: generation });
    await expect(savePlanOrderWithSource44(current, nextOrder())).rejects.toThrow();
    expect(ports26.bytes.has(ORDER)).toBe(false);
  });

  it('refuses a genuinely expiring health lease at its exact deadline', async () => {
    const generation = await runAccountGenerationOperation((lease) => lease.generation);
    const bounded = setActiveHealthProcessingEpoch(25, {
      ownerUserId: 'synthetic-first-value-a', accountGeneration: generation,
      serverVerifiedAt: new Date().toISOString(),
    });
    const snapshot = await capturePlanSource44(captureHealthDataWriteLease());
    expect(bounded.expiresAt).not.toBeNull();
    vi.spyOn(Date, 'now').mockReturnValue(bounded.expiresAt!);
    await expect(savePlanOrderWithSource44(snapshot, nextOrder())).rejects.toThrow();
    expect(ports26.bytes.has(ORDER)).toBe(false);
  });

  it('does not trust a copied snapshot or malformed/foreign-product order', async () => {
    const snapshot = await capturePlanSource44(captureHealthDataWriteLease());
    await expect(savePlanOrderWithSource44({ ...snapshot }, nextOrder())).rejects.toThrow(PLAN_SOURCE44_STALE);
    for (const next of [
      { schemaVersion: 1, am: [productId, productId], pm: [] },
      { schemaVersion: 1, am: ['foreign-product'], pm: [] },
      { schemaVersion: 2, am: [], pm: [] },
    ]) {
      await expect(savePlanOrderWithSource44(snapshot, next as ReturnType<typeof nextOrder>)).rejects.toThrow();
    }
    expect(ports26.bytes.has(ORDER)).toBe(false);
  });

  for (const [key, future] of [
    [SHELF, '{"version":99,"products":[]}'],
    [PROFILE, '{"version":99,"profile":{}}'],
    [CHOICES, '{"schemaVersion":99,"choices":{}}'],
    [CONSENT, '{"schemaVersion":99,"consent":{}}'],
    [ORDER, '{"schemaVersion":99,"am":[],"pm":[]}'],
  ]) {
    for (const raw of ['{malformed', future!]) {
      it(`refuses actual encrypted invalid/future source ${key}: ${raw}`, async () => {
        await updatePrivateItem(key!, () => raw);
        const before = new Map(ports26.bytes);
        await expect(capturePlanSource44(captureHealthDataWriteLease())).rejects.toThrow();
        expect(ports26.bytes).toEqual(before);
      });
    }
  }

  for (const key of [SHELF, PROFILE, CONSENT]) {
    it(`refuses missing required local ${key}, without a server fallback or replacing bytes`, async () => {
      await removePrivateItem(key);
      const before = new Map(ports26.bytes);
      await expect(capturePlanSource44(captureHealthDataWriteLease())).rejects.toThrow();
      expect(ports26.bytes).toEqual(before);
      expect(ports26.track).not.toHaveBeenCalled();
    });
  }

  it('refuses a failed source read rather than inheriting the conflict render fallback', async () => {
    ports26.failRead = CHOICES;
    const before = new Map(ports26.bytes);
    await expect(capturePlanSource44(captureHealthDataWriteLease())).rejects.toThrow();
    expect(ports26.bytes).toEqual(before);
  });

  it('preserves prior ciphertext when native destination commit rejects ambiguously', async () => {
    const initial = await capturePlanSource44(captureHealthDataWriteLease());
    await savePlanOrderWithSource44(initial, { schemaVersion: 1, am: [productId], pm: [] });
    const before = ports26.bytes.get(ORDER);
    const snapshot = await capturePlanSource44(captureHealthDataWriteLease());
    const original = AsyncStorage.setItem;
    let rejected = false;
    vi.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, raw) => {
      await original(key, raw);
      if (key === ORDER && !rejected) {
        rejected = true;
        throw new Error('SYNTHETIC44_COMMIT_THEN_REJECT');
      }
    });
    await expect(savePlanOrderWithSource44(snapshot, nextOrder())).rejects.toThrow();
    expect(ports26.bytes.get(ORDER)).toBe(before);
  });

  it('refuses an old captured source while actual usePlan cache remains unchanged and sourceReady', async () => {
    let source: RecoverablePlanHookResult | undefined;
    function Capture() {
      const value = usePlan();
      useEffect(() => { source = value; }, [value]);
      return null;
    }
    await act(async () => {
      renderer = create(createElement(QueryClientProvider, { client }, createElement(Capture)));
    });
    for (let index = 0; index < 12 && !source?.sourceReady; index += 1) await flush26();
    expect(source?.sourceReady).toBe(true);
    const snapshot = await capturePlanSource44(captureHealthDataWriteLease());
    const cachedShelf = client.getQueryData(['shelf']);
    await removeProduct(productId);
    expect(client.getQueryData(['shelf'])).toBe(cachedShelf);
    expect(source?.isSourceCurrent()).toBe(true);
    await expect(savePlanOrderWithSource44(snapshot, nextOrder())).rejects.toThrow(PLAN_SOURCE44_STALE);
    expect(ports26.bytes.has(ORDER)).toBe(false);
    expect(ports26.track).not.toHaveBeenCalled();
  });
});
