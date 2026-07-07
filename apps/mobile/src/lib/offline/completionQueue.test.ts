import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enqueueCompletion, getPendingCompletions, pendingStepIdsForDate } from './completionQueue';
import { completionKey, isStale, withQueued, type PendingCompletion } from './completionQueue.pure';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    mocks.storage.set(key, value);
  }),
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.storage.delete(key);
  }),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null } })),
    },
    from: vi.fn(),
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

describe('offline completion queue (docs/01 §6)', () => {
  beforeEach(() => {
    mocks.storage.clear();
  });

  it('dedups an identical completion by (user, routine, step, day)', () => {
    const once = withQueued([], base);
    const twice = withQueued(once, { ...base, enqueuedAt: '2026-06-25T09:00:00.000Z' });
    expect(once).toHaveLength(1);
    expect(twice).toHaveLength(1); // same key → not re-added
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
    const now = new Date(2026, 5, 25); // 2026-06-25 local
    expect(isStale('2026-06-25', now)).toBe(false); // today
    expect(isStale('2026-06-24', now)).toBe(false); // -1d, within the cap
    expect(isStale('2026-06-23', now)).toBe(false); // -2d, the boundary (server allows >= today-2)
    expect(isStale('2026-06-22', now)).toBe(true); // -3d, past the cap → drop
  });

  it('treats impossible completion dates as stale', () => {
    expect(isStale('2026-02-31', new Date(2026, 1, 28))).toBe(true);
  });

  it('treats completions beyond the timezone-tolerant future window as stale', () => {
    const now = new Date(2026, 5, 25, 9);
    expect(isStale('2026-06-26', now)).toBe(false);
    expect(isStale('2026-06-27', now)).toBe(true);
  });

  it('clears malformed persisted queues and returns no pending completions', async () => {
    mocks.storage.set(KEY, '{not-json');

    await expect(getPendingCompletions()).resolves.toEqual([]);
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('replaces wrong-shaped persisted queues on enqueue', async () => {
    mocks.storage.set(KEY, JSON.stringify({ pending: [base] }));

    await enqueueCompletion(base);

    expect(JSON.parse(mocks.storage.get(KEY) ?? '[]')).toEqual([base]);
  });

  it('drops malformed queued rows and normalizes valid rows before syncing reads them', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify([
        {
          userId: ' u1 ',
          routineId: ' r1 ',
          stepId: ' s1 ',
          completedDate: ' 2026-06-25 ',
          enqueuedAt: '2026-06-25T08:00:00.000Z',
        },
        { ...base, stepId: '' },
        { ...base, completedDate: '2026-02-31' },
        { ...base, enqueuedAt: 'not-a-date' },
      ]),
    );

    await expect(getPendingCompletions()).resolves.toEqual([base]);

    expect(JSON.parse(mocks.storage.get(KEY) ?? '[]')).toEqual([base]);
  });

  it('does not enqueue blank ids or impossible completion dates', async () => {
    await enqueueCompletion({ ...base, userId: '   ' });
    await enqueueCompletion({ ...base, completedDate: '2026-02-31' });

    expect(JSON.parse(mocks.storage.get(KEY) ?? '[]')).toEqual([]);
  });

  it('normalizes pending-read dates before matching queued step ids', async () => {
    mocks.storage.set(KEY, JSON.stringify([base]));

    await expect(pendingStepIdsForDate(' 2026-06-25 ')).resolves.toEqual(new Set(['s1']));
    await expect(pendingStepIdsForDate('2026-02-31')).resolves.toEqual(new Set());
  });
});
