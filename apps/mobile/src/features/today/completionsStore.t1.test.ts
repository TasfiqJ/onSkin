import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { assertHealthDataWriteLease, captureHealthDataWriteLease } from '@/lib/consent/healthDataWriteAdmission';
import { clearActiveHealthProcessingEpoch, setActiveHealthProcessingEpoch } from '@/lib/consent/healthProcessingEpoch';
import {
  COMPLETION_LOG_INVALID,
  acknowledgeCompletionSyncOperation,
  appendOptionalChange41,
  clearCompletions,
  deferCompletionSyncDependencyOperation,
  getCompletedSteps,
  getCompletionSummary,
  getCompletionSyncUnsynced,
  getPendingCompletionSyncOperations,
  getOptionalChanges41,
  rejectCompletionSyncOperation,
  recoverCompletionSyncUnsynced,
  subscribeCompletionSyncOutboxChanges,
  toggleCompletion,
} from './completionsStore';
import { OPTIONAL_CHANGE41_READBACK_UNCONFIRMED, type OptionalChangeInput41 } from './optionalChange41';

// This is a private-KV boundary model, NOT native encryption/durability proof.
// The unchanged privateKV tests remain responsible for exact-byte rollback.
const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(), tail: Promise.resolve(), uuid: 0, writes: 0,
  beforeCommit: undefined as (() => Promise<void>) | undefined,
  afterCommit: undefined as (() => Promise<void>) | undefined,
  readFailure: false,
  rollbackOnFailure: true,
  silentNoCommit: false,
  readHook: undefined as (() => void) | undefined,
}));
vi.mock('expo-crypto', () => ({ randomUUID: () => {
  mocks.uuid += 1;
  return `00000000-0000-4000-8000-${mocks.uuid.toString(16).padStart(12, '0')}`;
} }));
vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: async (key: string) => {
    if (mocks.readFailure && key === 'layerwell.completions.v1') throw new Error('READ_FAILED');
    mocks.readHook?.();
    return mocks.storage.get(key) ?? null;
  },
  setPrivateItem: async (key: string, value: string) => { mocks.storage.set(key, value); },
  removePrivateItem: async (key: string) => { mocks.storage.delete(key); },
  updatePrivateItem: async (key: string, updater: (raw: string | null) => string | null,
    additionalGuard?: () => void, beforeNative?: () => void) => {
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
      additionalGuard?.(); beforeNative?.();
      const next = updater(original);
      await mocks.beforeCommit?.();
      assertHealthDataWriteLease(lease);
      additionalGuard?.(); beforeNative?.();
      if (next === original) return;
      if (mocks.silentNoCommit) return;
      if (next === null) mocks.storage.delete(key);
      else mocks.storage.set(key, next);
      dispatched = true;
      mocks.writes += 1;
      await mocks.afterCommit?.();
      assertHealthDataWriteLease(lease);
      additionalGuard?.();
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
  mocks.silentNoCommit = false; mocks.readHook = undefined;
  clearActiveHealthProcessingEpoch();
  setActiveHealthProcessingEpoch(1, options);
});
afterEach(() => { vi.useRealTimers(); clearActiveHealthProcessingEpoch(); });

async function noteRequest41(patch: Partial<OptionalChangeInput41> = {}): Promise<OptionalChangeInput41> {
  const snapshot = await getOptionalChanges41(captureHealthDataWriteLease());
  return { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', expectedRevision: snapshot.revision,
    expectedSourceProof: snapshot.sourceProof, expectedSourceBytes: snapshot.sourceBytes,
    observedOn: DAY, category: 'personal_note', text: 'I noticed a factual difference.',
    kind: 'note', targetEventId: null, confirmation: true, ...patch };
}
function completionCore41() {
  const saved = envelope();
  return saved.version === 4 ? JSON.parse(saved.completionBytes ?? '{}') : saved;
}

describe('Campaign41 opt-in encrypted completion extension', () => {
  it.each([
    '{"2026-07-08":["AM:legacy"]}',
    '{ "version": 1, "days": { "2026-07-08": ["AM:legacy"] } }',
    '{"version":2,"days":{"2026-07-08":["PM:legacy"]},"completedDays":["2026-07-08"]}',
    '{"version":3,"days":{},"completedDays":[],"sync":{"routineIds":{"AM":null,"PM":null},"stepIds":{},"journal":[],"outbox":[],"terminal":[]}}',
  ])('reads legacy bytes unchanged and upgrades only on an explicit note write', async (original) => {
    mocks.storage.set(KEY, original);
    const lease = captureHealthDataWriteLease();
    const snapshot = await getOptionalChanges41(lease);
    await getCompletedSteps(DAY); await getCompletionSummary(); await getPendingCompletionSyncOperations();
    expect(snapshot).toMatchObject({ revision: 0, events: [], sourceBytes: original });
    expect(mocks.storage.get(KEY)).toBe(original); expect(mocks.writes).toBe(0);
    const request = await noteRequest41();
    await expect(appendOptionalChange41(request, lease)).resolves.toMatchObject({ revision: 1 });
    expect(envelope().version).toBe(4); expect(envelope().completionBytes).toBe(original);
    const prior = mocks.storage.get(KEY);
    await getCompletedSteps(DAY); await getCompletionSummary(); await getOptionalChanges41(lease);
    expect(mocks.storage.get(KEY)).toBe(prior);
    expect([...mocks.storage.keys()]).toEqual([KEY]);
  });

  it('check-offs remain v3 and create no optional event or inferred no-change record', async () => {
    await toggleCompletion(`AM:${A}`, DAY, undefined, REMOTE);
    expect(envelope().version).toBe(3); expect(envelope().changes).toBeUndefined();
    expect((await getOptionalChanges41(captureHealthDataWriteLease())).events).toEqual([]);
  });

  it('preserves completed-day proofs, identities, journal, FIFO, terminal/unsynced state through note and later original operations', async () => {
    const step = `PM:${A}`;
    await toggleCompletion(step, DAY, { phase: 'PM', stepKeys: [step] }, REMOTE);
    const terminal = (await getPendingCompletionSyncOperations())[0]!;
    await rejectCompletionSyncOperation(terminal.eventId, 'COMPLETION_IDENTITY_CONFLICT');
    await toggleCompletion(`AM:${A}`, DAY, undefined, REMOTE);
    await toggleCompletion(`AM:${B}`, DAY, undefined, REMOTE);
    await toggleCompletion('AM:legacy-product', DAY, undefined, {
      source: 'real_plan', timezone: null, stepOrder: 1, unavailableReason: 'COMPLETION_PRODUCT_IDENTITY_REPAIR_REQUIRED',
    });
    const core = mocks.storage.get(KEY)!;
    const pending = await getPendingCompletionSyncOperations();
    const summary = await getCompletionSummary();
    const unsynced = await getCompletionSyncUnsynced();
    const wake = vi.fn(); const stop = subscribeCompletionSyncOutboxChanges(wake);
    try {
      const saved = await appendOptionalChange41(await noteRequest41(), captureHealthDataWriteLease());
      expect(envelope().completionBytes).toBe(core); expect(wake).not.toHaveBeenCalled();
      expect(await getPendingCompletionSyncOperations()).toEqual(pending);
      expect(await getCompletionSummary()).toEqual(summary);
      expect(await getCompletionSyncUnsynced()).toEqual(unsynced);
      const oldCore = JSON.parse(core);
      await toggleCompletion(`PM:${B}`, DAY, undefined, { ...REMOTE, stepOrder: 2 });
      const after = completionCore41();
      expect(after.completedDays).toEqual(oldCore.completedDays);
      expect(after.sync.journal.slice(0, oldCore.sync.journal.length)).toEqual(oldCore.sync.journal);
      expect(after.sync.routineIds).toEqual(oldCore.sync.routineIds);
      expect(after.sync.stepIds[`PM:${A}`]).toEqual(oldCore.sync.stepIds[`PM:${A}`]);
      expect(after.sync.terminal).toEqual(oldCore.sync.terminal);
      expect(after.sync.unsynced).toEqual(oldCore.sync.unsynced);
      expect((await getOptionalChanges41(captureHealthDataWriteLease())).events).toEqual(saved.events);
      await deferCompletionSyncDependencyOperation(pending[0]!.eventId, A);
      const reordered = await getPendingCompletionSyncOperations();
      expect(reordered.at(-1)?.eventId).toBe(pending[0]!.eventId);
      await acknowledgeCompletionSyncOperation(reordered[0]!.eventId);
      await recoverCompletionSyncUnsynced('America/Toronto');
      expect((await getOptionalChanges41(captureHealthDataWriteLease())).events).toEqual(saved.events);
      expect(completionCore41().sync.terminal).toEqual(oldCore.sync.terminal);
      expect(completionCore41().sync.unsynced).toEqual(oldCore.sync.unsynced);
    } finally { stop(); }
  });

  it('later original timezone recovery works on v4 and retains the complete optional history', async () => {
    await toggleCompletion(`AM:${A}`, DAY, undefined, { source: 'real_plan', timezone: null, stepOrder: 1,
      unavailableReason: 'COMPLETION_TIMEZONE_UNAVAILABLE' });
    const eventId = (await getCompletionSyncUnsynced())[0]!.eventId;
    const saved = await appendOptionalChange41(await noteRequest41(), captureHealthDataWriteLease());
    expect(await recoverCompletionSyncUnsynced('America/Toronto')).toBe(1);
    expect((await getPendingCompletionSyncOperations())[0]!.eventId).toBe(eventId);
    expect((await getOptionalChanges41(captureHealthDataWriteLease())).events).toEqual(saved.events);
  });

  it.each(['{broken', '{"version":99,"days":{}}',
    '{"version":4,"completionBytes":"{broken","changes":{}}',
    '{"version":4,"completionBytes":"{\\"version\\":4}","changes":{}}'])('retains corrupt/future bytes and refuses notes and original operations', async (raw) => {
    mocks.storage.set(KEY, raw);
    await expect(getOptionalChanges41(captureHealthDataWriteLease())).rejects.toThrow();
    await expect(getCompletedSteps(DAY)).rejects.toThrow();
    await expect(toggleCompletion(`AM:${A}`, DAY)).rejects.toThrow();
    expect(mocks.storage.get(KEY)).toBe(raw); expect(mocks.writes).toBe(0);
  });

  it('appends immutable corrections, no-change and retractions and reloads the exact lineage', async () => {
    const lease = captureHealthDataWriteLease();
    const first = await appendOptionalChange41(await noteRequest41(), lease);
    const original = first.events[0]!;
    const second = await appendOptionalChange41(await noteRequest41({ id: B, kind: 'correction', targetEventId: original.id,
      category: 'no_change', text: '' }), lease);
    const third = await appendOptionalChange41(await noteRequest41({ id: A, kind: 'retraction', targetEventId: B,
      text: 'I retract my previous statement.' }), lease);
    expect(third.events[0]).toEqual(original); expect(second.events[1]!.category).toBe('no_change');
    expect((await getOptionalChanges41(lease)).events).toEqual(third.events);
    expect((await getOptionalChanges41(lease)).events.map((event) => event.targetEventId)).toEqual([null, original.id, B]);
  });

  it('identical concurrent/retried taps append once without waking remote sync', async () => {
    const input = await noteRequest41(); const lease = captureHealthDataWriteLease();
    const wake = vi.fn(); const stop = subscribeCompletionSyncOutboxChanges(wake);
    try {
      const results = await Promise.all(Array.from({ length: 8 }, () => appendOptionalChange41(input, lease)));
      expect(results.every((result) => result.revision === 1)).toBe(true);
      expect((await getOptionalChanges41(lease)).events).toHaveLength(1);
      expect(mocks.writes).toBe(1); expect(wake).not.toHaveBeenCalled();
      await expect(appendOptionalChange41({ ...input, text: 'Different' }, lease)).rejects.toThrow();
    } finally { stop(); }
  });

  it('a changed completion source or stale revision cannot save or counterfeit an idempotent retry', async () => {
    const input = await noteRequest41(); const lease = captureHealthDataWriteLease();
    await toggleCompletion(`AM:${A}`, DAY);
    await expect(appendOptionalChange41(input, lease)).rejects.toThrow();
    const current = await noteRequest41(); await appendOptionalChange41(current, lease);
    await toggleCompletion(`AM:${B}`, DAY);
    await expect(appendOptionalChange41(current, lease)).rejects.toThrow();
    const next = await noteRequest41({ id: B, expectedRevision: 0 });
    await expect(appendOptionalChange41(next, lease)).rejects.toThrow();
    expect((await getOptionalChanges41(lease)).events).toHaveLength(1);
  });

  it.each(['withdrawal', 'owner', 'regrant', 'expired', 'account'] as const)(
    'an old callback cannot borrow authority after %s', async (transition) => {
      const input = await noteRequest41(); const lease = captureHealthDataWriteLease();
      if (transition === 'expired') {
        setActiveHealthProcessingEpoch(1, { ...options, serverVerifiedAt: '2026-07-08T15:59:00.000Z' });
      } else {
        clearActiveHealthProcessingEpoch();
        if (transition !== 'withdrawal') setActiveHealthProcessingEpoch(1, { ...options,
          ownerUserId: transition === 'owner' ? 'other-owner' : options.ownerUserId,
          accountGeneration: transition === 'account' ? 1 : 0 });
      }
      await expect(appendOptionalChange41(input, lease)).rejects.toThrow();
      await expect(getOptionalChanges41(lease)).rejects.toThrow();
      expect(mocks.storage.has(KEY)).toBe(false);
    },
  );

  it('foreign-owned v4 records cannot be shown, overwritten or rebound', async () => {
    await appendOptionalChange41(await noteRequest41(), captureHealthDataWriteLease());
    const original = mocks.storage.get(KEY);
    clearActiveHealthProcessingEpoch(); setActiveHealthProcessingEpoch(1, { ...options, ownerUserId: 'other-owner' });
    await expect(getOptionalChanges41(captureHealthDataWriteLease())).rejects.toThrow();
    await expect(toggleCompletion(`AM:${A}`, DAY)).rejects.toThrow();
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('full completion deletion erases all notes and stale source cannot resurrect history', async () => {
    await appendOptionalChange41(await noteRequest41(), captureHealthDataWriteLease());
    const stale = await noteRequest41({ id: B });
    await clearCompletions();
    expect(mocks.storage.has(KEY)).toBe(false);
    await expect(appendOptionalChange41(stale, captureHealthDataWriteLease())).rejects.toThrow();
    expect((await getOptionalChanges41(captureHealthDataWriteLease())).events).toEqual([]);
  });

  it('requires explicit confirmation, and cancellation before native dispatch keeps exact prior bytes', async () => {
    const input = await noteRequest41(); const lease = captureHealthDataWriteLease();
    await expect(appendOptionalChange41({ ...input, confirmation: false } as never, lease)).rejects.toThrow();
    let editorActive = true;
    mocks.beforeCommit = async () => { editorActive = false; };
    await expect(appendOptionalChange41(input, lease, () => {
      if (!editorActive) throw new Error('EDITOR_CANCELED');
    })).rejects.toThrow('EDITOR_CANCELED');
    expect(mocks.storage.has(KEY)).toBe(false); expect(mocks.writes).toBe(0);
  });

  it('captures caller input synchronously so mutation across the storage await cannot replace factual content', async () => {
    const original = await noteRequest41();
    const mutable = { ...original }; const lease = captureHealthDataWriteLease();
    const pending = appendOptionalChange41(mutable, lease);
    mutable.text = 'Substituted after dispatch';
    mutable.confirmation = false as never;
    expect((await pending).events[0]!.text).toBe(original.text);
  });

  it('captures expected lease synchronously so a caller cannot adopt a later grant by mutating its object', async () => {
    const requested = await noteRequest41(); const lease = { ...captureHealthDataWriteLease() };
    mocks.beforeCommit = async () => {
      clearActiveHealthProcessingEpoch(); setActiveHealthProcessingEpoch(1, options);
      Object.assign(lease, captureHealthDataWriteLease());
    };
    await expect(appendOptionalChange41(requested, lease)).rejects.toThrow();
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('canceled idempotent retry cannot bypass the editor guard through a no-op transform', async () => {
    const requested = await noteRequest41(); const lease = captureHealthDataWriteLease();
    await appendOptionalChange41(requested, lease);
    const prior = mocks.storage.get(KEY); let calls = 0;
    await expect(appendOptionalChange41(requested, lease, () => {
      calls += 1; if (calls > 1) throw new Error('EDITOR_CANCELED');
    })).rejects.toThrow('EDITOR_CANCELED');
    expect(mocks.storage.get(KEY)).toBe(prior);
  });

  it('unavailable reads and silent no-commit never become save success', async () => {
    const input = await noteRequest41(); const lease = captureHealthDataWriteLease();
    mocks.readFailure = true;
    await expect(getOptionalChanges41(lease)).rejects.toThrow('READ_FAILED');
    await expect(appendOptionalChange41(input, lease)).rejects.toThrow('READ_FAILED');
    mocks.readFailure = false; mocks.silentNoCommit = true;
    await expect(appendOptionalChange41(input, lease)).rejects.toThrow(OPTIONAL_CHANGE41_READBACK_UNCONFIRMED);
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it.each(['before', 'after'] as const)('interrupted %s-commit writes retain prior bytes and retry once', async (phase) => {
    await toggleCompletion(`AM:${A}`, DAY); const original = mocks.storage.get(KEY);
    const input = await noteRequest41(); const lease = captureHealthDataWriteLease();
    const fail = async () => { throw new Error('INTERRUPTED'); };
    if (phase === 'before') mocks.beforeCommit = fail; else mocks.afterCommit = fail;
    await expect(appendOptionalChange41(input, lease)).rejects.toThrow('INTERRUPTED');
    expect(mocks.storage.get(KEY)).toBe(original);
    mocks.beforeCommit = undefined; mocks.afterCommit = undefined;
    expect((await appendOptionalChange41(input, lease)).events).toHaveLength(1);
  });

  it('readback failure preserves committed history without claiming success and exact retry stays idempotent', async () => {
    const input = await noteRequest41(); const lease = captureHealthDataWriteLease();
    mocks.afterCommit = async () => { mocks.readFailure = true; };
    await expect(appendOptionalChange41(input, lease)).rejects.toThrow('READ_FAILED');
    const committed = mocks.storage.get(KEY);
    mocks.afterCommit = undefined; mocks.readFailure = false;
    expect((await appendOptionalChange41(input, lease)).events).toHaveLength(1);
    expect(mocks.storage.get(KEY)).toBe(committed); expect(mocks.writes).toBe(1);
  });

  it('unstable canonical readback refuses ambiguous source bytes', async () => {
    const lease = captureHealthDataWriteLease();
    await appendOptionalChange41(await noteRequest41(), lease);
    const source = mocks.storage.get(KEY)!; let reads = 0;
    mocks.readHook = () => { reads += 1; if (reads === 2) mocks.storage.set(KEY, source + ' '); };
    await expect(getOptionalChanges41(lease)).rejects.toThrow(OPTIONAL_CHANGE41_READBACK_UNCONFIRMED);
  });

  it.each(['withdrawal', 'owner', 'regrant'] as const)('a %s during a note write rolls back without any sync notification', async (transition) => {
    const input = await noteRequest41(); const lease = captureHealthDataWriteLease();
    mocks.afterCommit = async () => {
      clearActiveHealthProcessingEpoch();
      if (transition !== 'withdrawal') setActiveHealthProcessingEpoch(1, { ...options,
        ownerUserId: transition === 'owner' ? 'other-owner' : options.ownerUserId });
    };
    const wake = vi.fn(); const stop = subscribeCompletionSyncOutboxChanges(wake);
    try {
      await expect(appendOptionalChange41(input, lease)).rejects.toThrow();
      expect(mocks.storage.has(KEY)).toBe(false); expect(wake).not.toHaveBeenCalled();
    } finally { stop(); }
  });
});

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
