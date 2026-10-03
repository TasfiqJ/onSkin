import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { assertHealthDataWriteLease, captureHealthDataWriteLease } from '@/lib/consent/healthDataWriteAdmission';
import { clearActiveHealthProcessingEpoch, setActiveHealthProcessingEpoch } from '@/lib/consent/healthProcessingEpoch';
import {
  COMPLETION_LOG_INVALID,
  getCompletedSteps,
  getCompletionSummary,
  getCompletionSyncUnsynced,
  getPendingCompletionSyncOperations,
  recoverCompletionSyncUnsynced,
  subscribeCompletionSyncOutboxChanges,
  toggleCompletion,
} from './completionsStore';

// This is a private-KV boundary model, NOT native encryption/durability proof.
// The unchanged privateKV tests remain responsible for exact-byte rollback.
const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(), tail: Promise.resolve(), uuid: 0, writes: 0,
  beforeCommit: undefined as (() => Promise<void>) | undefined,
  afterCommit: undefined as (() => Promise<void>) | undefined,
  readFailure: false,
  rollbackOnFailure: true,
}));
vi.mock('expo-crypto', () => ({ randomUUID: () => {
  mocks.uuid += 1;
  return `00000000-0000-4000-8000-${mocks.uuid.toString(16).padStart(12, '0')}`;
} }));
vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: async (key: string) => {
    if (mocks.readFailure && key === 'layerwell.completions.v1') throw new Error('READ_FAILED');
    return mocks.storage.get(key) ?? null;
  },
  setPrivateItem: async (key: string, value: string) => { mocks.storage.set(key, value); },
  removePrivateItem: async (key: string) => { mocks.storage.delete(key); },
  updatePrivateItem: async (key: string, updater: (raw: string | null) => string | null) => {
    const lease = captureHealthDataWriteLease();
    const previous = mocks.tail;
    let release!: () => void;
    mocks.tail = new Promise<void>((done) => { release = done; });
    await previous;
    const original = mocks.storage.get(key) ?? null;
    let dispatched = false;
    try {
      if (mocks.readFailure && key === 'layerwell.completions.v1') throw new Error('READ_FAILED');
      assertHealthDataWriteLease(lease);
      const next = updater(original);
      await mocks.beforeCommit?.();
      assertHealthDataWriteLease(lease);
      if (next === original) return;
      if (next === null) mocks.storage.delete(key);
      else mocks.storage.set(key, next);
      dispatched = true;
      mocks.writes += 1;
      await mocks.afterCommit?.();
      assertHealthDataWriteLease(lease);
    } catch (error) {
      if (dispatched && mocks.rollbackOnFailure) {
        if (original === null) mocks.storage.delete(key);
        else mocks.storage.set(key, original);
      }
      throw error;
    } finally { release(); }
  },
}));
const KEY = 'layerwell.completions.v1';
const DAY = '2026-07-08';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const REMOTE = { source: 'real_plan', timezone: 'America/Toronto', stepOrder: 1 } as const;
const options = { ownerUserId: 't1-owner-a', accountGeneration: 0 };
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
function envelope() { return JSON.parse(mocks.storage.get(KEY)!); }

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-08T16:00:00.000Z'));
  mocks.storage.clear(); mocks.tail = Promise.resolve(); mocks.uuid = 0; mocks.writes = 0;
  mocks.beforeCommit = undefined; mocks.afterCommit = undefined;
  mocks.readFailure = false; mocks.rollbackOnFailure = true;
  clearActiveHealthProcessingEpoch();
  setActiveHealthProcessingEpoch(1, options);
});
afterEach(() => { vi.useRealTimers(); clearActiveHealthProcessingEpoch(); });

describe('T1 strict local completion persistence', () => {
  it.each(['AM:' + 'x'.repeat(513), 'AM:legacy\u0000product'])(
    'rejects an unreadable unsynced serialization before any write: %j', async (step) => {
      const prior = JSON.stringify({ version: 1, days: { [DAY]: ['AM:prior'] } });
      mocks.storage.set(KEY, prior);
      const wake = vi.fn(); const stop = subscribeCompletionSyncOutboxChanges(wake);
      try {
        await expect(toggleCompletion(step, DAY, undefined, {
          ...REMOTE, unavailableReason: 'COMPLETION_PRODUCT_IDENTITY_REPAIR_REQUIRED',
        })).rejects.toThrow(COMPLETION_LOG_INVALID);
        expect(mocks.storage.get(KEY)).toBe(prior);
        expect(mocks.writes).toBe(0); expect(wake).not.toHaveBeenCalled();
      } finally { stop(); }
    },
  );

  it('keeps identity-incompatible local evidence even when timezone is also unavailable', async () => {
    const step = 'AM:legacy-product';
    await toggleCompletion(step, DAY, undefined, {
      source: 'real_plan', timezone: null, stepOrder: 1,
      unavailableReason: 'COMPLETION_PRODUCT_IDENTITY_REPAIR_REQUIRED',
    });
    const raw = mocks.storage.get(KEY);
    await expect(getCompletedSteps(DAY)).resolves.toEqual(new Set([step]));
    await expect(getCompletionSyncUnsynced()).resolves.toMatchObject([{
      stepKey: step, disposition: 'terminal', timezoneEvidence: null,
    }]);
    await expect(recoverCompletionSyncUnsynced('America/Toronto')).resolves.toBe(0);
    await expect(getPendingCompletionSyncOperations()).resolves.toEqual([]);
    expect(mocks.storage.get(KEY)).toBe(raw);
  });

  it('a duplicate does not invent completion of a newly supplied or reduced PM schedule', async () => {
    const step = `PM:${A}`;
    await toggleCompletion(step, DAY, { phase: 'PM', stepKeys: [step, `PM:${B}`] }, REMOTE);
    const raw = mocks.storage.get(KEY);
    await expect(toggleCompletion(step, DAY, { phase: 'PM', stepKeys: [step] }, REMOTE))
      .resolves.toMatchObject({ done: true, inserted: false, firstEver: false, completionDayInserted: false });
    expect(mocks.storage.get(KEY)).toBe(raw);
    await expect(getCompletionSummary()).resolves.toMatchObject({ completedDates: new Set() });
  });

  it.each(['{bad', JSON.stringify({ version: 99, days: {} })])(
    'does not turn a corrupt or future record into empty data for an invalid date', async (raw) => {
      mocks.storage.set(KEY, raw);
      await expect(getCompletedSteps('not-a-date')).rejects.toThrow();
      await expect(toggleCompletion('AM:a', 'not-a-date')).rejects.toThrow();
      expect(mocks.storage.get(KEY)).toBe(raw); expect(mocks.writes).toBe(0);
    },
  );

  it('survives fresh module reads with exactly the same stable journal identities', async () => {
    const step = `PM:${A}`;
    const scheduled = { phase: 'PM', stepKeys: [step] } as const;
    await toggleCompletion(step, DAY, scheduled, REMOTE);
    const raw = mocks.storage.get(KEY);
    const pending = await getPendingCompletionSyncOperations();
    // New store module, same persisted bytes; not a physical process restart.
    vi.resetModules();
    const freshEpoch = await import('@/lib/consent/healthProcessingEpoch');
    freshEpoch.setActiveHealthProcessingEpoch(1, options);
    const fresh = await import('./completionsStore');
    await expect(fresh.getCompletedSteps(DAY)).resolves.toEqual(new Set([step]));
    await expect(fresh.getPendingCompletionSyncOperations()).resolves.toEqual(pending);
    expect(mocks.storage.get(KEY)).toBe(raw);
    // This test performs reads only after reset: the write mock still uses the
    // original authority module. Subsequent tests use the original store too.
    freshEpoch.clearActiveHealthProcessingEpoch();
  });

  it('concurrent real-plan duplicates create one event and one full-PM marker', async () => {
    const step = `PM:${A}`;
    const results = await Promise.all(Array.from({ length: 16 }, () =>
      toggleCompletion(step, DAY, { phase: 'PM', stepKeys: [step] }, REMOTE)));
    expect(results.filter((r) => r.inserted)).toHaveLength(1);
    expect(results.filter((r) => r.completionDayInserted)).toHaveLength(1);
    expect(envelope().sync.journal.map((op: { kind: string }) => op.kind)).toEqual(['step', 'routine_day']);
    await expect(getCompletedSteps(DAY)).resolves.toEqual(new Set([step]));
  });

  it('rejects a local semantic fact duplicated between journal and unsynced evidence', async () => {
    const step = `AM:${A}`;
    await toggleCompletion(step, DAY, undefined, REMOTE);
    const saved = envelope(); const op = saved.sync.journal[0];
    saved.sync.unsynced = [{
      eventId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', stepKey: step,
      routineType: 'AM', stepOrder: 1, completedAt: op.completedAt, completedDate: DAY,
      completionDayInserted: false, reason: 'COMPLETION_TIMEZONE_UNAVAILABLE',
      disposition: 'recoverable', timezoneEvidence: null,
    }];
    const raw = JSON.stringify(saved); mocks.storage.set(KEY, raw);
    await expect(getCompletedSteps(DAY)).rejects.toThrow(COMPLETION_LOG_INVALID);
    await expect(recoverCompletionSyncUnsynced('America/Toronto')).rejects.toThrow(COMPLETION_LOG_INVALID);
    expect(mocks.storage.get(KEY)).toBe(raw);
  });

  it('rejects reused UUIDs across internal provenance roles without rewriting them', async () => {
    await toggleCompletion(`AM:${A}`, DAY, undefined, REMOTE);
    const saved = envelope();
    saved.sync.journal[0].eventId = saved.sync.routineIds.AM;
    saved.sync.outbox[0] = saved.sync.routineIds.AM;
    const raw = JSON.stringify(saved); mocks.storage.set(KEY, raw);
    await expect(getCompletedSteps(DAY)).rejects.toThrow(COMPLETION_LOG_INVALID);
    expect(mocks.storage.get(KEY)).toBe(raw);
  });
});

describe('T1 in-flight private write boundary', () => {
  it('refuses writes after health withdrawal without substituting an empty log', async () => {
    const prior = JSON.stringify({ version: 1, days: { [DAY]: ['AM:prior'] } });
    mocks.storage.set(KEY, prior);
    mocks.beforeCommit = async () => { clearActiveHealthProcessingEpoch(); };
    await expect(toggleCompletion(`AM:${A}`, DAY, undefined, REMOTE)).rejects.toThrow();
    expect(mocks.storage.get(KEY)).toBe(prior); expect(mocks.writes).toBe(0);
  });

  it('preserves private bytes and rejects both reads and writes on a private read failure', async () => {
    const prior = JSON.stringify({ version: 1, days: { [DAY]: ['AM:prior'] } });
    mocks.storage.set(KEY, prior); mocks.readFailure = true;
    await expect(getCompletedSteps(DAY)).rejects.toThrow('READ_FAILED');
    await expect(toggleCompletion(`AM:${A}`, DAY, undefined, REMOTE)).rejects.toThrow('READ_FAILED');
    expect(mocks.storage.get(KEY)).toBe(prior); expect(mocks.writes).toBe(0);
  });

  it.each(['before', 'after'] as const)('suppresses success across an owner change %s native dispatch', async (where) => {
    const started = deferred(); const gate = deferred();
    const pause = async () => { started.resolve(); await gate.promise; };
    if (where === 'before') mocks.beforeCommit = pause; else mocks.afterCommit = pause;
    const wake = vi.fn(); const stop = subscribeCompletionSyncOutboxChanges(wake);
    try {
      const pending = toggleCompletion(`AM:${A}`, DAY, undefined, REMOTE);
      const rejected = expect(pending).rejects.toThrow();
      await started.promise;
      clearActiveHealthProcessingEpoch();
      setActiveHealthProcessingEpoch(1, { ...options, ownerUserId: 't1-owner-b' });
      gate.resolve(); await rejected;
      expect(mocks.storage.has(KEY)).toBe(false);
      expect(wake).not.toHaveBeenCalled();
    } finally { stop(); }
  });

  it('rejects a same-owner same-epoch consent re-grant during a write', async () => {
    mocks.beforeCommit = async () => {
      clearActiveHealthProcessingEpoch(); setActiveHealthProcessingEpoch(1, options);
    };
    await expect(toggleCompletion(`AM:${A}`, DAY, undefined, REMOTE)).rejects.toThrow();
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('a rejected compensated write retains prior state and a safe retry creates one fact', async () => {
    const prior = JSON.stringify({ version: 1, days: { [DAY]: ['AM:prior'] } });
    mocks.storage.set(KEY, prior);
    mocks.afterCommit = async () => { throw new Error('COMMIT_THEN_REJECT'); };
    await expect(toggleCompletion(`AM:${A}`, DAY, undefined, REMOTE)).rejects.toThrow('COMMIT_THEN_REJECT');
    expect(mocks.storage.get(KEY)).toBe(prior);
    mocks.afterCommit = undefined;
    await expect(toggleCompletion(`AM:${A}`, DAY, undefined, REMOTE)).resolves.toMatchObject({ inserted: true });
    expect(envelope().sync.journal).toHaveLength(1);
  });

  it('never reports ambiguous surviving bytes as mutation success; fresh recovery remains idempotent', async () => {
    mocks.rollbackOnFailure = false;
    mocks.afterCommit = async () => { throw new Error('PRIVATE_KV_WRITE_ROLLBACK_FAILED'); };
    const wake = vi.fn(); const stop = subscribeCompletionSyncOutboxChanges(wake);
    try {
      await expect(toggleCompletion(`AM:${A}`, DAY, undefined, REMOTE)).rejects.toThrow('PRIVATE_KV_WRITE_ROLLBACK_FAILED');
      expect(wake).not.toHaveBeenCalled();
      mocks.afterCommit = undefined;
      const raw = mocks.storage.get(KEY);
      await expect(getCompletedSteps(DAY)).resolves.toEqual(new Set([`AM:${A}`]));
      await expect(toggleCompletion(`AM:${A}`, DAY, undefined, REMOTE)).resolves.toMatchObject({ inserted: false, firstEver: false });
      expect(envelope().sync.journal).toHaveLength(1);
      expect(mocks.storage.get(KEY)).toBe(raw);
    } finally { stop(); }
  });
});
