import { randomUUID } from 'node:crypto';
import { close26, grant26, ports26, profile26, reset26 } from '@/features/shelf/firstValue26TestPorts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { addProduct, loadShelf, removeProduct, updateProduct } from '@/features/shelf/store';
import { updateStoredPregnancyStatus } from '@/features/onboarding/skinProfileStore';
import { HEALTH_DATA_CONSENT } from '@/features/onboarding/consentCopy';
import { setHealthDataCollectionConsentLocal } from '@/features/onboarding/healthConsentStore';
import { setConflictOverride } from '@/features/intelligence/overrides';
import { beginAccountGenerationBoundary, endAccountGenerationBoundary } from '@/lib/auth/accountGeneration';
import { clearLocalDataCleanupRequired, decodeHistoryIntentMarker45, isLocalDataCleanupRequiredInMemory, markLocalDataCleanupRequired } from '@/lib/auth/localAccountIsolation';
import { captureHealthDataWriteLease } from '@/lib/consent/healthDataWriteAdmission';
import { activeHealthProcessingLeaseSnapshot, clearActiveHealthProcessingEpoch, setActiveHealthProcessingEpoch } from '@/lib/consent/healthProcessingEpoch';
import { clearPrivateKVContentKey, getPrivateItem, removePrivateItem, setPrivateItem, updatePrivateItem, waitForPrivateKVWritesToSettle } from '@/lib/storage/privateKV';
import { PRIVATE_KV_CONTENT_KEY_NAME } from '@/lib/storage/privateKVContentKey';

import { loadRoutineOrderOverrides, saveRoutineOrderOverrides } from './orderStore';
import { appendPlanHistoryWithSources44, capturePlanSource44, PLAN_SOURCE44_STALE, type PlanSourceSnapshot44 } from './planSourceFence44';
import { decodePlanHistory45, loadPlanHistory45, PLAN_HISTORY45_CAPACITY_REACHED, PLAN_HISTORY45_KEY as HISTORY, PLAN_HISTORY45_RETRY_CONFLICT, savePlanHistory45 } from './planHistory45';

// Genuine encryption/content key/domain codecs/admission/queues. Only the
// native platform adapters above are synthetic; no store or lease is mocked.
const SHELF = 'layerwell.shelf.v1';
const PROFILE = 'layerwell.skinprofile.v1';
const CONSENT = 'layerwell.healthDataCollectionConsent.v1';
const ORDER = 'layerwell.routineOrder.v1';
const CHOICES = 'layerwell.conflict.overrides';
let client: QueryClient;
let productId: string;
const releases = new Set<() => void>();
const request = () => Object.freeze({ id: randomUUID(), createdAt: new Date().toISOString() });

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function holdRead(keyToHold: string, occurrence = 1) {
  const entered = deferred(); const gate = deferred();
  releases.add(gate.resolve);
  const native = AsyncStorage.getItem;
  let count = 0;
  vi.spyOn(AsyncStorage, 'getItem').mockImplementation(async (key) => {
    const raw = await native(key);
    if (key === keyToHold && ++count === occurrence) { entered.resolve(); await gate.promise; }
    return raw;
  });
  return { entered: entered.promise, release: gate.resolve };
}

function holdWrite(keyToHold: string = HISTORY) {
  const entered = deferred(); const gate = deferred();
  releases.add(gate.resolve);
  const native = AsyncStorage.setItem;
  let held = false;
  vi.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, raw) => {
    if (key === keyToHold && !held) { held = true; entered.resolve(); await gate.promise; }
    await native(key, raw);
  });
  return { entered: entered.promise, release: gate.resolve };
}

async function writeOrder() {
  const lease = captureHealthDataWriteLease();
  return saveRoutineOrderOverrides({ previous: await loadRoutineOrderOverrides(lease),
    next: { schemaVersion: 1, am: [productId], pm: [] } }, lease);
}

async function prepared() {
  const lease = captureHealthDataWriteLease();
  return { lease, snapshot: await capturePlanSource44(lease) };
}

beforeEach(async () => {
  vi.stubGlobal('__DEV__', true);
  client = await reset26(); await profile26();
  await (await import('@/lib/auth/sessionOwner')).claimLocalDataOwnership('synthetic-first-value-a');
  productId = (await addProduct({ operationId: randomUUID(), name: 'Synthetic45 cleanser', category: 'cleanser', addedVia: 'manual' })).id;
});
afterEach(async () => {
  for (const release of releases) release(); releases.clear();
  await waitForPrivateKVWritesToSettle();
  vi.restoreAllMocks();
  await removePrivateItem(HISTORY);
  await clearPrivateKVContentKey();
  await markLocalDataCleanupRequired();
  await clearLocalDataCleanupRequired();
  await close26(client);
  vi.unstubAllGlobals();
});

describe('Campaign45 genuine encrypted owner plan history', () => {
  it('persists exact factual original-source bytes, idempotently retries and reloads without filler or egress', async () => {
    const { lease, snapshot } = await prepared(); const intent = request();
    const beforeKeys = [...ports26.bytes.keys()];
    const first = await savePlanHistory45(snapshot, lease, intent);
    const ciphertext = ports26.bytes.get(HISTORY)!;
    expect(JSON.parse(ciphertext).version).toBe('xchacha20poly1305:v1');
    expect(ciphertext).not.toContain('Synthetic45');
    expect([...ports26.bytes.keys()].sort()).toEqual([...beforeKeys, HISTORY].sort());
    expect(first.versions).toEqual([{ ...intent, sequence: 1, sourceHash: snapshot.sourceHash, am: snapshot.am, pm: snapshot.pm }]);
    expect(await savePlanHistory45(snapshot, lease, intent)).toEqual(first);
    expect(ports26.bytes.get(HISTORY)).toBe(ciphertext);
    expect(await loadPlanHistory45(captureHealthDataWriteLease())).toEqual(first);
    await expect(savePlanHistory45(snapshot, lease, { ...intent, createdAt: '2020-01-01T00:00:00.000Z' })).rejects.toThrow(PLAN_HISTORY45_RETRY_CONFLICT);
    expect(ports26.bytes.get(HISTORY)).toBe(ciphertext);
    expect(ports26.track).not.toHaveBeenCalled();
  });

  it('refuses generic history writers and source-less mutation before native dispatch', async () => {
    const { lease } = await prepared();
    const calls = vi.spyOn(AsyncStorage, 'setItem');
    await expect(setPrivateItem(HISTORY, 'unfenced')).rejects.toThrow('PRIVATE_KV_SOURCE_TRANSFORM_INVALID');
    await expect(updatePrivateItem(HISTORY, () => 'unfenced')).rejects.toThrow('PRIVATE_KV_SOURCE_TRANSFORM_INVALID');
    const { updatePrivateItemWithSources } = await import('@/lib/storage/privateKV');
    await expect(updatePrivateItemWithSources(HISTORY, [], () => 'unfenced', () => {
      expect(lease.ownerUserId).toBe('synthetic-first-value-a');
    })).rejects.toThrow('PRIVATE_KV_SOURCE_TRANSFORM_INVALID');
    expect(calls.mock.calls.filter(([key]) => key === HISTORY)).toHaveLength(0);
    expect(ports26.bytes.has(HISTORY)).toBe(false);
    expect(ports26.bytes.has('layerwell.localDataCleanupRequired.v1')).toBe(false);
  });

  it('retains all previous facts across ordinary source mutations', async () => {
    const { lease, snapshot } = await prepared();
    const first = await savePlanHistory45(snapshot, lease, request());
    const raw = ports26.bytes.get(HISTORY);
    await updateProduct(productId, { name: 'Synthetic45 new current name' });
    await updateStoredPregnancyStatus('pregnant');
    await writeOrder();
    expect(ports26.bytes.get(HISTORY)).toBe(raw);
    expect(await loadPlanHistory45(lease)).toEqual(first);
  });

  it('refuses copied/forged snapshots and copied/different original lease capabilities with no ciphertext', async () => {
    const { lease, snapshot } = await prepared();
    for (const fake of [{ ...snapshot }, JSON.parse(JSON.stringify(snapshot)) as PlanSourceSnapshot44]) {
      await expect(savePlanHistory45(fake, lease, request())).rejects.toThrow(PLAN_SOURCE44_STALE);
    }
    await expect(savePlanHistory45(snapshot, { ...lease }, request())).rejects.toThrow();
    await expect(savePlanHistory45(snapshot, captureHealthDataWriteLease(), request())).rejects.toThrow(PLAN_SOURCE44_STALE);
    const copiedLease = { ...lease };
    const copiedLeaseSnapshot = await capturePlanSource44(copiedLease);
    await expect(savePlanHistory45(copiedLeaseSnapshot, copiedLease, request())).rejects.toThrow();
    expect(ports26.bytes.has(HISTORY)).toBe(false);
  });

  for (const transition of ['successor', 'withdraw-regrant', 'changed-epoch', 'account-reopen', 'expired'] as const) {
    it(`refuses old save/read authority across ${transition} and prevents owner leakage`, async () => {
      let authority = await prepared();
      if (transition === 'expired') {
        const current = activeHealthProcessingLeaseSnapshot()!;
        setActiveHealthProcessingEpoch(current.epoch, { ownerUserId: current.ownerUserId!, accountGeneration: current.accountGeneration!, serverVerifiedAt: new Date().toISOString() });
        authority = await prepared();
      }
      await savePlanHistory45(authority.snapshot, authority.lease, request());
      const raw = ports26.bytes.get(HISTORY);
      if (transition === 'expired') vi.spyOn(Date, 'now').mockReturnValue(authority.lease.expiresAt!);
      else if (transition === 'account-reopen') {
        beginAccountGenerationBoundary(); endAccountGenerationBoundary(); await grant26();
      } else if (transition === 'changed-epoch') {
        setActiveHealthProcessingEpoch(26, { ownerUserId: authority.lease.ownerUserId, accountGeneration: authority.lease.accountGeneration });
      } else await grant26(transition === 'successor' ? 'synthetic45-successor' : authority.lease.ownerUserId);
      await expect(savePlanHistory45(authority.snapshot, authority.lease, request())).rejects.toThrow();
      await expect(loadPlanHistory45(authority.lease)).rejects.toThrow();
      expect(ports26.bytes.get(HISTORY)).toBe(raw);
      if (transition === 'successor') await expect(loadPlanHistory45(captureHealthDataWriteLease())).rejects.toThrow('PLAN_HISTORY45_OWNER_MISMATCH');
    });
  }

  it('rejects previous-owner pending read after successor admission before returning any facts', async () => {
    const { lease, snapshot } = await prepared(); await savePlanHistory45(snapshot, lease, request());
    const barrier = holdRead(HISTORY);
    const reading = loadPlanHistory45(lease).catch((error: Error) => error);
    await barrier.entered; await grant26('synthetic45-successor'); barrier.release();
    expect(await reading).toBeInstanceOf(Error);
  });

  for (const change of ['remove', 'status', 'ingredient', 'whole-key-metadata', 'pregnancy', 'profile', 'choice', 'consent', 'order'] as const) {
    it(`refuses ${change} between captured input and append, with zero native history invocation`, async () => {
      if (change === 'choice') await updatePrivateItem(CHOICES, () => JSON.stringify([`synthetic-rule:${productId}+synthetic45-other-product`]));
      const { lease, snapshot } = await prepared();
      if (change === 'remove') await removeProduct(productId);
      if (change === 'status') await updateProduct(productId, { status: 'finished' });
      if (change === 'ingredient') await updateProduct(productId, { ingredients: ['Synthetic retinol'] });
      if (change === 'whole-key-metadata') await updatePrivateItem(SHELF, (raw) => JSON.stringify({ ...JSON.parse(raw!), unrelated45: 'changed' }));
      if (change === 'pregnancy') await updateStoredPregnancyStatus('pregnant');
      if (change === 'profile') await updatePrivateItem(PROFILE, (raw) => JSON.stringify({ ...JSON.parse(raw!), unrelated45: 'changed' }));
      if (change === 'choice') await setConflictOverride(`synthetic-rule:${productId}+synthetic45-other-product`, false);
      if (change === 'consent') await setHealthDataCollectionConsentLocal({ granted: false, version: HEALTH_DATA_CONSENT.version, consentText: HEALTH_DATA_CONSENT.declineText });
      if (change === 'order') await writeOrder();
      const native = vi.spyOn(AsyncStorage, 'setItem');
      await expect(savePlanHistory45(snapshot, lease, request())).rejects.toThrow();
      expect(native.mock.calls.filter(([key]) => key === HISTORY)).toHaveLength(0);
      expect(ports26.bytes.has(HISTORY)).toBe(false);
    });
  }

  for (const key of [SHELF, PROFILE]) {
    it(`C42 successor: captures before queued ${key} change, then refuses historical append after it completes`, async () => {
      const lease = captureHealthDataWriteLease(); const barrier = holdRead(key);
      const capturing = capturePlanSource44(lease);
      await barrier.entered;
      const mutation = key === SHELF ? removeProduct(productId) : updateStoredPregnancyStatus('pregnant');
      barrier.release(); const snapshot = await capturing; await mutation;
      await expect(savePlanHistory45(snapshot, lease, request())).rejects.toThrow(PLAN_SOURCE44_STALE);
      expect(ports26.bytes.has(HISTORY)).toBe(false);
    });
    it(`detects native ${key} mutation DURING original capture preparation`, async () => {
      const before = ports26.bytes.get(key)!;
      if (key === SHELF) await updateProduct(productId, { brand: 'Synthetic45 changed during preparation' });
      else await updateStoredPregnancyStatus('pregnant');
      const changed = ports26.bytes.get(key)!; ports26.bytes.set(key, before);
      const barrier = holdRead(key, 2);
      const capturing = capturePlanSource44(captureHealthDataWriteLease()).catch((error: Error) => error);
      await barrier.entered; ports26.bytes.set(key, changed); barrier.release();
      expect(await capturing).toBeInstanceOf(Error);
      expect(ports26.bytes.has(HISTORY)).toBe(false);
    });
  }

  it('serializes two distinct saves with no lost/duplicate/reordered versions or global starvation', async () => {
    const { lease, snapshot } = await prepared(); const first = request(); const second = request();
    const barrier = holdWrite();
    const savingFirst = savePlanHistory45(snapshot, lease, first);
    await barrier.entered;
    const savingSecond = savePlanHistory45(snapshot, lease, second);
    await setPrivateItem('layerwell.synthetic45.unrelated', 'unrelated native queue progresses');
    expect(ports26.bytes.has('layerwell.synthetic45.unrelated')).toBe(true);
    barrier.release(); await Promise.all([savingFirst, savingSecond]);
    const history = await loadPlanHistory45(lease);
    expect(history.versions.map(({ id, sequence }) => [id, sequence])).toEqual([[first.id, 1], [second.id, 2]]);
  });

  for (const key of [SHELF, PROFILE, ORDER]) {
    it(`keeps later ordinary ${key} writer behind save/readback without self-deadlock`, async () => {
      const { lease, snapshot } = await prepared(); const barrier = holdRead(HISTORY, 4);
      const events: string[] = [];
      const saving = savePlanHistory45(snapshot, lease, request()).then(() => { events.push('saved'); });
      await barrier.entered;
      const mutation = (key === SHELF ? updateProduct(productId, { brand: 'Synthetic45 later writer' }) :
        key === PROFILE ? updateStoredPregnancyStatus('pregnant') :
          writeOrder()).then(() => { events.push('writer'); });
      barrier.release(); await Promise.all([saving, mutation]);
      expect(events).toEqual(['saved', 'writer']);
      expect((await loadPlanHistory45(lease)).versions).toHaveLength(1);
    });
  }

  for (const mode of ['reject-before', 'commit-reject', 'omit', 'stale-readback'] as const) {
    for (const hasPrior of [false, true]) {
      it(`preserves exact ${hasPrior ? 'existing' : 'absent'} ciphertext after native ${mode}`, async () => {
        const { lease, snapshot } = await prepared();
        if (hasPrior) await savePlanHistory45(snapshot, lease, request());
        const before = ports26.bytes.get(HISTORY);
        const nativeSet = AsyncStorage.setItem; const nativeGet = AsyncStorage.getItem;
        let attempted = false; let stale = mode === 'stale-readback';
        vi.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, raw) => {
          if (key === HISTORY && !attempted) {
            attempted = true;
            if (mode === 'reject-before') throw new Error('SYNTHETIC45_REJECT_BEFORE');
            if (mode === 'omit') return;
            await nativeSet(key, raw);
            if (mode === 'commit-reject') throw new Error('SYNTHETIC45_COMMIT_THEN_REJECT');
            return;
          }
          await nativeSet(key, raw);
        });
        vi.spyOn(AsyncStorage, 'getItem').mockImplementation(async (key) => {
          if (key === HISTORY && attempted && stale) { stale = false; return 'synthetic45-stale-native-read'; }
          return nativeGet(key);
        });
        await expect(savePlanHistory45(snapshot, lease, request())).rejects.toThrow();
        expect(ports26.bytes.get(HISTORY)).toBe(before);
      });
    }
  }

  it('rolls back commit-then-reject crossed by consent revocation and never publishes tentative ciphertext', async () => {
    const { lease, snapshot } = await prepared(); const original = AsyncStorage.setItem;
    vi.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, raw) => {
      await original(key, raw);
      if (key === HISTORY) { clearActiveHealthProcessingEpoch(); throw new Error('SYNTHETIC45_REVOKED_COMMIT'); }
    });
    await expect(savePlanHistory45(snapshot, lease, request())).rejects.toThrow();
    expect(ports26.bytes.has(HISTORY)).toBe(false);
  });

  it('quarantines a foreign concurrent ambiguity without overwriting its bytes or returning success', async () => {
    const { lease, snapshot } = await prepared(); const original = AsyncStorage.setItem;
    vi.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, raw) => {
      await original(key, raw);
      if (key === HISTORY) { ports26.bytes.set(HISTORY, 'synthetic45-foreign-ambiguity'); throw new Error('SYNTHETIC45_CONCURRENT'); }
    });
    await expect(savePlanHistory45(snapshot, lease, request())).rejects.toThrow('PRIVATE_KV_WRITE_ROLLBACK_FAILED');
    expect(ports26.bytes.get(HISTORY)).toBe('synthetic45-foreign-ambiguity');
    expect(activeHealthProcessingLeaseSnapshot()).toBeNull();
    expect(isLocalDataCleanupRequiredInMemory()).toBe(false);
    expect(decodeHistoryIntentMarker45(ports26.bytes.get('layerwell.localDataCleanupRequired.v1')!).kind).toBe('routine-plan-history');
    await grant26();
    await expect(loadPlanHistory45(captureHealthDataWriteLease())).rejects.toThrow('PRIVATE_KV_RECOVERY_REQUIRED');
  });

  it('retains recovery quarantine after rollback removal rejects rather than exposing unconfirmed record', async () => {
    const { lease, snapshot } = await prepared(); const original = AsyncStorage.setItem;
    vi.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, raw) => {
      await original(key, raw);
      if (key === HISTORY) throw new Error('SYNTHETIC45_AMBIGUOUS_COMMIT');
    });
    vi.spyOn(AsyncStorage, 'removeItem').mockImplementation(async (key) => {
      if (key === HISTORY) throw new Error('SYNTHETIC45_ROLLBACK_REFUSED');
      ports26.bytes.delete(key);
    });
    await expect(savePlanHistory45(snapshot, lease, request())).rejects.toThrow('PRIVATE_KV_WRITE_ROLLBACK_FAILED');
    await grant26();
    await expect(loadPlanHistory45(captureHealthDataWriteLease())).rejects.toThrow('PRIVATE_KV_RECOVERY_REQUIRED');
    expect(decodeHistoryIntentMarker45(ports26.bytes.get('layerwell.localDataCleanupRequired.v1')!).kind).toBe('routine-plan-history');
  });

  for (const bad of ['malformed', 'future', 'wrong-owner', 'oversized', 'duplicate-id', 'bad-time', 'sequence', 'bad-am-pm']) {
    it(`refuses genuine encrypted ${bad} history on read and append without rewriting`, async () => {
      const { lease, snapshot } = await prepared();
      const valid = await savePlanHistory45(snapshot, lease, request());
      const row = JSON.parse(JSON.stringify(valid));
      if (bad === 'future') row.schemaVersion = 99;
      if (bad === 'wrong-owner') row.ownerUserId = 'synthetic45-successor';
      if (bad === 'duplicate-id') row.versions.push({ ...row.versions[0], sequence: 2 });
      if (bad === 'bad-time') row.versions[0].createdAt = '2026-02-30T00:00:00.000Z';
      if (bad === 'sequence') row.versions[0].sequence = 2;
      if (bad === 'bad-am-pm') row.versions[0].pm = {};
      await appendPlanHistoryWithSources44(snapshot, lease, () =>
        bad === 'malformed' ? '{invalid' : bad === 'oversized' ? 'x'.repeat(1_048_577) : JSON.stringify(row));
      const before = ports26.bytes.get(HISTORY);
      await expect(loadPlanHistory45(lease)).rejects.toThrow();
      await expect(savePlanHistory45(snapshot, lease, request())).rejects.toThrow();
      expect(ports26.bytes.get(HISTORY)).toBe(before);
    });
  }

  for (const bad of ['unauthenticated-plaintext', 'corrupt-envelope', 'future-envelope', 'missing-content-key']) {
    it(`fails closed on ${bad}, preserving the exact native record`, async () => {
      const { lease, snapshot } = await prepared(); await savePlanHistory45(snapshot, lease, request());
      if (bad === 'unauthenticated-plaintext') ports26.bytes.set(HISTORY, (await getPrivateItem(HISTORY))!);
      if (bad === 'corrupt-envelope') {
        const envelope = JSON.parse(ports26.bytes.get(HISTORY)!); envelope.ciphertextHex = '00'.repeat(16); ports26.bytes.set(HISTORY, JSON.stringify(envelope));
      }
      if (bad === 'future-envelope') ports26.bytes.set(HISTORY, '{"version":"xchacha20poly1305:v99","nonceHex":"00","ciphertextHex":"00"}');
      if (bad === 'missing-content-key') ports26.bytes.delete(PRIVATE_KV_CONTENT_KEY_NAME);
      const before = ports26.bytes.get(HISTORY);
      await expect(loadPlanHistory45(lease)).rejects.toThrow();
      await expect(savePlanHistory45(snapshot, lease, request())).rejects.toThrow();
      expect(ports26.bytes.get(HISTORY)).toBe(before);
      if (bad === 'missing-content-key') expect(ports26.bytes.has(PRIVATE_KV_CONTENT_KEY_NAME)).toBe(false);
    });
  }

  for (const key of [SHELF, PROFILE, CONSENT]) {
    it(`refuses source absence ${key} before any encrypted destination invocation`, async () => {
      await removePrivateItem(key);
      await expect(capturePlanSource44(captureHealthDataWriteLease())).rejects.toThrow();
      expect(ports26.bytes.has(HISTORY)).toBe(false);
    });
  }


  for (const key of [SHELF, PROFILE, CHOICES, CONSENT, ORDER]) {
    it(`refuses actual authenticated ${key} bytes changed during append preparation BEFORE native history invocation`, async () => {
      const { lease, snapshot } = await prepared();
      const originalRaw = ports26.bytes.get(key);
      if (key === SHELF) await updateProduct(productId, { brand: 'Synthetic45 prep metadata' });
      if (key === PROFILE) await updateStoredPregnancyStatus('pregnant');
      if (key === CHOICES) await updatePrivateItem(CHOICES, () => JSON.stringify([`synthetic-rule:${productId}+synthetic45-other-product`]));
      if (key === CONSENT) await setHealthDataCollectionConsentLocal({ granted: false, version: HEALTH_DATA_CONSENT.version, consentText: HEALTH_DATA_CONSENT.declineText });
      if (key === ORDER) await writeOrder();
      const changedRaw = ports26.bytes.get(key)!;
      if (originalRaw === undefined) ports26.bytes.delete(key); else ports26.bytes.set(key, originalRaw);
      const nativeSet = vi.spyOn(AsyncStorage, 'setItem');
      // Initial destination read, then the first source preflight. For keys
      // sorted before history this changes bytes AFTER that preflight saw them;
      // the final under-lock preparation check must still prevent invocation.
      const barrier = holdRead(HISTORY, 2);
      const saving = savePlanHistory45(snapshot, lease, request()).catch((error: Error) => error);
      await barrier.entered; ports26.bytes.set(key, changedRaw); barrier.release();
      expect(await saving).toBeInstanceOf(Error);
      expect(nativeSet.mock.calls.filter(([candidate]) => candidate === HISTORY)).toHaveLength(0);
      expect(ports26.bytes.has(HISTORY)).toBe(false);
    });
  }

  for (const key of [SHELF, PROFILE, ORDER]) {
    it(`drains already-entered ordinary ${key} writer before refusing old history source`, async () => {
      const { lease, snapshot } = await prepared(); const barrier = holdWrite(key);
      const mutation = key === SHELF ? updateProduct(productId, { brand: 'Synthetic45 queued metadata' }) :
        key === PROFILE ? updateStoredPregnancyStatus('pregnant') : writeOrder();
      await barrier.entered;
      const saving = savePlanHistory45(snapshot, lease, request()).catch((error: Error) => error);
      barrier.release(); await mutation;
      expect(await saving).toBeInstanceOf(Error);
      expect(ports26.bytes.has(HISTORY)).toBe(false);
    });
  }

  it('queues history readers behind native commit/readback and failed compensation', async () => {
    const { lease, snapshot } = await prepared(); const barrier = holdWrite();
    const saving = savePlanHistory45(snapshot, lease, request());
    await barrier.entered;
    let returned = false;
    const reading = loadPlanHistory45(lease).then((value) => { returned = true; return value; });
    await Promise.resolve(); expect(returned).toBe(false);
    barrier.release(); const saved = await saving;
    expect(await reading).toEqual(saved);
  });

  it('reaches capacity100 without eviction, accepts identical retry at capacity and refuses changed/new retry', async () => {
    const { lease, snapshot } = await prepared();
    const intents = Array.from({ length: 100 }, request);
    let last;
    for (const intent of intents) last = await savePlanHistory45(snapshot, lease, intent);
    const before = ports26.bytes.get(HISTORY);
    expect(last!.versions.map(({ sequence }) => sequence)).toEqual(Array.from({ length: 100 }, (_, index) => index + 1));
    expect(await savePlanHistory45(snapshot, lease, intents[99]!)).toEqual(last);
    await expect(savePlanHistory45(snapshot, lease, request())).rejects.toThrow(PLAN_HISTORY45_CAPACITY_REACHED);
    await expect(savePlanHistory45(snapshot, lease, { ...intents[99]!, createdAt: '2020-01-01T00:00:00.000Z' })).rejects.toThrow(PLAN_HISTORY45_RETRY_CONFLICT);
    expect(ports26.bytes.get(HISTORY)).toBe(before);
    expect(decodePlanHistory45((await getPrivateItem(HISTORY))!, lease.ownerUserId).versions).toHaveLength(100);
    expect((await loadShelf())[0]!.id).toBe(productId);
  }, 20_000);
});
