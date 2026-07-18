import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';
import * as privateKV from '@/lib/storage/privateKV';

import {
  COMPLETION_QUEUE_INVALID,
  COMPLETION_QUEUE_UNAVAILABLE,
  COMPLETION_QUEUE_UNSUPPORTED_VERSION,
  enqueueCompletion,
  flushCompletions,
  getPendingCompletions,
  pendingStepIdsForDate,
  readCompletionQueue,
  readCompletionSyncDiagnostics,
  resetCompletionSyncDiagnosticsForTests,
} from './completionQueue';
import { completionKey, isStale, withQueued, type PendingCompletion } from './completionQueue.pure';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  tails: new Map<string, Promise<void>>(),
  readFailures: new Map<string, Error>(),
  updateFailures: new Map<string, Error>(),
  writes: 0,
  currentUserId: null as string | null,
  insertCalls: [] as Record<string, unknown>[],
  insertSignals: [] as AbortSignal[],
  insertGate: null as Promise<void> | null,
  onInsert: null as (() => void) | null,
  insertError: null as { code: string; message?: string } | null,
  insertStatus: 201,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  readPrivateItem: vi.fn(async (key: string) => {
    const failure = mocks.readFailures.get(key);
    if (failure) return { status: 'unavailable', reason: 'storage_unavailable' };
    const value = mocks.storage.get(key);
    return value === undefined ? { status: 'absent' } : { status: 'available', value };
  }),
  updatePrivateItem: vi.fn(
    async (key: string, updater: (current: string | null) => string | null) => {
      const previous = mocks.tails.get(key) ?? Promise.resolve();
      let release!: () => void;
      const ownTail = new Promise<void>((resolve) => {
        release = resolve;
      });
      mocks.tails.set(key, ownTail);
      await previous;
      try {
        const failure = mocks.updateFailures.get(key);
        if (failure) throw failure;
        const current = mocks.storage.get(key) ?? null;
        const next = updater(current);
        if (next === current) return;
        if (next === null) mocks.storage.delete(key);
        else mocks.storage.set(key, next);
        mocks.writes += 1;
      } finally {
        release();
        if (mocks.tails.get(key) === ownTail) mocks.tails.delete(key);
      }
    },
  ),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: mocks.currentUserId ? { id: mocks.currentUserId } : null },
      })),
    },
    from: vi.fn(() => ({
      insert: vi.fn((payload: Record<string, unknown>) => ({
        abortSignal: vi.fn(async (signal: AbortSignal) => {
          mocks.insertCalls.push(payload);
          mocks.insertSignals.push(signal);
          const error = mocks.insertError;
          const status = mocks.insertStatus;
          mocks.onInsert?.();
          if (mocks.insertGate) {
            await new Promise<void>((resolve, reject) => {
              const onAbort = () => reject(new Error('POSTGREST_ABORTED'));
              signal.addEventListener('abort', onAbort, { once: true });
              void mocks.insertGate?.then(() => {
                signal.removeEventListener('abort', onAbort);
                resolve();
              }, reject);
            });
          }
          return { error, status };
        }),
      })),
    })),
  },
}));

const KEY = 'onskin.completions.pending';

const base: PendingCompletion = {
  userId: 'u1',
  routineId: 'r1',
  stepId: 's1',
  completedDate: '2026-06-25',
  enqueuedAt: '2026-06-25T08:00:00.000Z',
};

let boundaryActive = false;

afterEach(() => {
  if (boundaryActive) {
    endAccountGenerationBoundary();
    boundaryActive = false;
  }
});

function storedItems(): PendingCompletion[] {
  const parsed = JSON.parse(mocks.storage.get(KEY) ?? '{}') as {
    version?: number;
    items?: PendingCompletion[];
  };
  expect(parsed.version).toBe(1);
  return parsed.items ?? [];
}

describe('offline completion queue (docs/01 §6)', () => {
  beforeEach(() => {
    mocks.storage.clear();
    mocks.tails.clear();
    mocks.readFailures.clear();
    mocks.updateFailures.clear();
    mocks.writes = 0;
    mocks.currentUserId = null;
    mocks.insertCalls = [];
    mocks.insertSignals = [];
    mocks.insertGate = null;
    mocks.onInsert = null;
    mocks.insertError = null;
    mocks.insertStatus = 201;
    resetCompletionSyncDiagnosticsForTests();
    vi.clearAllMocks();
  });

  it('dedups an identical completion by (user, routine, step, day)', () => {
    const once = withQueued([], base);
    const twice = withQueued(once, { ...base, enqueuedAt: '2026-06-25T09:00:00.000Z' });
    expect(once).toHaveLength(1);
    expect(twice).toHaveLength(1);
  });

  it('keeps distinct steps and distinct days', () => {
    let list: PendingCompletion[] = [];
    list = withQueued(list, base);
    list = withQueued(list, { ...base, stepId: 's2' });
    list = withQueued(list, { ...base, completedDate: '2026-06-24' });
    expect(list).toHaveLength(3);
  });

  it('treats a routine-level (null step) completion as its own key', () => {
    expect(completionKey({ ...base, stepId: null })).not.toBe(completionKey(base));
  });

  it('marks a completion stale once it is older than the ~48h server backfill cap', () => {
    const now = new Date(2026, 5, 25);
    expect(isStale('2026-06-25', now)).toBe(false);
    expect(isStale('2026-06-24', now)).toBe(false);
    expect(isStale('2026-06-23', now)).toBe(false);
    expect(isStale('2026-06-22', now)).toBe(true);
  });

  it('treats impossible completion dates as stale', () => {
    expect(isStale('2026-02-31', new Date(2026, 1, 28))).toBe(true);
  });

  it('treats completions beyond the timezone-tolerant future window as stale', () => {
    const now = new Date(2026, 5, 25, 9);
    expect(isStale('2026-06-26', now)).toBe(false);
    expect(isStale('2026-06-27', now)).toBe(true);
  });

  it('distinguishes an absent queue from an available queue without writing', async () => {
    await expect(readCompletionQueue()).resolves.toEqual({ status: 'absent', items: [] });
    await expect(getPendingCompletions()).resolves.toEqual([]);

    const original = JSON.stringify({ version: 1, items: [base] });
    mocks.storage.set(KEY, original);

    await expect(readCompletionQueue()).resolves.toEqual({ status: 'available', items: [base] });
    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('returns typed corruption and rejects convenience reads without deleting malformed bytes', async () => {
    const original = '{not-json';
    mocks.storage.set(KEY, original);

    await expect(readCompletionQueue()).resolves.toEqual({ status: 'corrupt', items: null });
    await expect(getPendingCompletions()).rejects.toThrow(COMPLETION_QUEUE_INVALID);

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('rejects enqueue over wrong-shaped state without replacing the original bytes', async () => {
    const original = JSON.stringify({ pending: [base] });
    mocks.storage.set(KEY, original);

    await expect(enqueueCompletion(base)).rejects.toThrow(COMPLETION_QUEUE_INVALID);

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('rejects the entire queue when any legacy row is malformed', async () => {
    const original = JSON.stringify([base, { ...base, stepId: '' }]);
    mocks.storage.set(KEY, original);

    await expect(readCompletionQueue()).resolves.toEqual({ status: 'corrupt', items: null });
    await expect(getPendingCompletions()).rejects.toThrow(COMPLETION_QUEUE_INVALID);
    await expect(enqueueCompletion({ ...base, stepId: 's2' })).rejects.toThrow(
      COMPLETION_QUEUE_INVALID,
    );

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it.each([
    [
      'extra envelope field',
      { version: 1, items: [base], extra: true },
    ],
    [
      'duplicate current identity',
      { version: 1, items: [base, { ...base, enqueuedAt: '2026-06-25T09:00:00.000Z' }] },
    ],
    [
      'noncanonical current row',
      {
        version: 1,
        items: [{ ...base, userId: ' u1 ', enqueuedAt: '2026-06-25T08:00:00Z' }],
      },
    ],
    [
      'extra current row field',
      { version: 1, items: [{ ...base, extra: true }] },
    ],
  ])('preserves strict-current corruption with %s', async (_label, value) => {
    const original = JSON.stringify(value);
    mocks.storage.set(KEY, original);

    await expect(readCompletionQueue()).resolves.toEqual({ status: 'corrupt', items: null });
    await expect(enqueueCompletion({ ...base, stepId: 's2' })).rejects.toThrow(
      COMPLETION_QUEUE_INVALID,
    );

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('normalizes a valid legacy queue in memory without rewriting a read', async () => {
    const original = JSON.stringify([
      {
        userId: ' u1 ',
        routineId: ' r1 ',
        stepId: ' s1 ',
        completedDate: ' 2026-06-25 ',
        enqueuedAt: '2026-06-25T08:00:00Z',
      },
    ]);
    mocks.storage.set(KEY, original);

    await expect(getPendingCompletions()).resolves.toEqual([base]);

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('migrates a valid legacy queue only inside an explicit atomic enqueue', async () => {
    mocks.storage.set(KEY, JSON.stringify([base]));
    const next = { ...base, stepId: 's2' };

    await enqueueCompletion(next);

    expect(storedItems()).toEqual([base, next]);
  });

  it('serializes 100 simultaneous enqueues without losing a writer', async () => {
    const rows = Array.from({ length: 100 }, (_, index) => ({
      ...base,
      stepId: `s${index}`,
    }));

    await Promise.all(rows.map((row) => enqueueCompletion(row)));

    expect(new Set(storedItems().map(completionKey))).toEqual(new Set(rows.map(completionKey)));
    expect(mocks.writes).toBe(100);
  });

  it.each([
    ['legacy', JSON.stringify([base])],
    ['current', JSON.stringify({ version: 1, items: [base] })],
  ])('does zero persisted writes for an identical %s enqueue', async (_format, original) => {
    mocks.storage.set(KEY, original);

    await enqueueCompletion({ ...base, enqueuedAt: '2026-06-25T09:00:00.000Z' });

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('preserves an enqueue that lands while an older flush is in flight', async () => {
    mocks.storage.set(KEY, JSON.stringify({ version: 1, items: [base] }));
    mocks.currentUserId = 'u1';
    let releaseInsert!: () => void;
    mocks.insertGate = new Promise<void>((resolve) => {
      releaseInsert = resolve;
    });
    let signalInsertStarted!: () => void;
    const insertStarted = new Promise<void>((resolve) => {
      signalInsertStarted = resolve;
    });
    mocks.onInsert = signalInsertStarted;

    const flushing = flushCompletions(new Date(2026, 5, 25, 9));
    await insertStarted;
    const concurrent = { ...base, stepId: 's2' };
    await enqueueCompletion(concurrent);
    releaseInsert();

    await expect(flushing).resolves.toEqual({ flushed: 1, remaining: 1 });
    await expect(getPendingCompletions()).resolves.toEqual([concurrent]);
  });

  it('keeps owner-A queue bytes when a delayed flush crosses into owner B', async () => {
    const original = JSON.stringify({ version: 1, items: [base] });
    mocks.storage.set(KEY, original);
    mocks.currentUserId = 'u1';
    mocks.insertGate = new Promise<void>(() => undefined);
    let signalInsertStarted!: () => void;
    const insertStarted = new Promise<void>((resolve) => {
      signalInsertStarted = resolve;
    });
    mocks.onInsert = signalInsertStarted;

    const flushing = flushCompletions(new Date(2026, 5, 25, 9));
    await insertStarted;
    beginAccountGenerationBoundary();
    boundaryActive = true;

    await expect(flushing).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    expect(mocks.insertSignals).toHaveLength(1);
    expect(mocks.insertSignals[0]?.aborted).toBe(true);
    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('does zero persisted writes when a transient flush removes no legacy rows', async () => {
    const original = JSON.stringify([base]);
    mocks.storage.set(KEY, original);
    mocks.currentUserId = 'u1';
    mocks.insertError = { code: 'TEMPORARY_NETWORK_FAILURE' };

    await expect(flushCompletions(new Date(2026, 5, 25, 9))).resolves.toEqual({
      flushed: 0,
      remaining: 1,
    });

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
    expect(readCompletionSyncDiagnostics()).toMatchObject({ result: 'pending' });
  });

  it('retries one transient insert and treats the durable uniqueness receipt as success', async () => {
    const original = JSON.stringify({ version: 1, items: [base] });
    mocks.storage.set(KEY, original);
    mocks.currentUserId = 'u1';
    mocks.insertError = {
      code: 'TEMPORARY_NETWORK_FAILURE',
      message: 'temporary server failure',
    };
    mocks.insertStatus = 503;
    let attempts = 0;
    mocks.onInsert = () => {
      attempts += 1;
      if (attempts === 1) {
        mocks.insertError = { code: '23505' };
        mocks.insertStatus = 409;
      }
    };
    vi.spyOn(Math, 'random').mockReturnValue(0);

    await expect(flushCompletions(new Date(2026, 5, 25, 9))).resolves.toEqual({
      flushed: 1,
      remaining: 0,
    });

    expect(mocks.insertCalls).toHaveLength(2);
    expect(storedItems()).toEqual([]);
    expect(readCompletionSyncDiagnostics()).toMatchObject({ result: 'synced' });
    vi.restoreAllMocks();
  });

  it('records only a content-free sync result and timestamp', async () => {
    expect(readCompletionSyncDiagnostics()).toEqual({ result: 'not_run', at: null });

    await expect(flushCompletions(new Date(2026, 5, 25, 9))).resolves.toEqual({
      flushed: 0,
      remaining: 0,
    });

    const diagnostics = readCompletionSyncDiagnostics();
    expect(diagnostics.result).toBe('idle');
    expect(new Date(diagnostics.at ?? '').toISOString()).toBe(diagnostics.at);
    expect(Object.keys(diagnostics).sort()).toEqual(['at', 'result']);
  });

  it('preserves future-version bytes and refuses to downgrade them', async () => {
    const original = JSON.stringify({ version: 2, items: [base] });
    mocks.storage.set(KEY, original);

    await expect(readCompletionQueue()).resolves.toEqual({
      status: 'unsupported_version',
      items: null,
    });
    await expect(getPendingCompletions()).rejects.toThrow(COMPLETION_QUEUE_UNSUPPORTED_VERSION);
    await expect(enqueueCompletion({ ...base, stepId: 's2' })).rejects.toThrow(
      COMPLETION_QUEUE_UNSUPPORTED_VERSION,
    );

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('does not overwrite queue state when the private key is unavailable', async () => {
    const original = JSON.stringify({ version: 1, items: [base] });
    mocks.storage.set(KEY, original);
    mocks.readFailures.set(KEY, new Error('PRIVATE_KEY_UNAVAILABLE'));

    await expect(readCompletionQueue()).resolves.toEqual({ status: 'unavailable', items: null });
    await expect(getPendingCompletions()).rejects.toThrow(COMPLETION_QUEUE_UNAVAILABLE);
    await expect(flushCompletions()).rejects.toThrow(COMPLETION_QUEUE_UNAVAILABLE);
    expect(mocks.storage.get(KEY)).toBe(original);

    mocks.readFailures.delete(KEY);
    mocks.updateFailures.set(KEY, new Error('PRIVATE_KEY_UNAVAILABLE'));
    await expect(enqueueCompletion({ ...base, stepId: 's2' })).rejects.toThrow(
      'PRIVATE_KEY_UNAVAILABLE',
    );

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('leaves the prior queue intact when the atomic write fails', async () => {
    const original = JSON.stringify({ version: 1, items: [base] });
    mocks.storage.set(KEY, original);
    mocks.updateFailures.set(KEY, new Error('PRIVATE_WRITE_FAILED'));

    await expect(enqueueCompletion({ ...base, stepId: 's2' })).rejects.toThrow(
      'PRIVATE_WRITE_FAILED',
    );

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('keeps public behavior for invalid enqueue inputs without inventing rows', async () => {
    await enqueueCompletion({ ...base, userId: '   ' });
    await enqueueCompletion({ ...base, completedDate: '2026-02-31' });

    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.storage.has(KEY)).toBe(false);
    expect(mocks.writes).toBe(0);
  });

  it('normalizes pending-read dates before matching queued step ids', async () => {
    mocks.storage.set(KEY, JSON.stringify([base]));

    await expect(pendingStepIdsForDate(' 2026-06-25 ')).resolves.toEqual(new Set(['s1']));
    await expect(pendingStepIdsForDate('2026-02-31')).resolves.toEqual(new Set());
  });
});
