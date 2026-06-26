import { describe, expect, it } from 'vitest';

import { completionKey, isStale, withQueued, type PendingCompletion } from './completionQueue.pure';

const base: PendingCompletion = {
  userId: 'u1',
  routineId: 'r1',
  stepId: 's1',
  completedDate: '2026-06-25',
  enqueuedAt: '2026-06-25T08:00:00.000Z',
};

describe('offline completion queue (docs/01 §6)', () => {
  it('dedups an identical completion by (user, routine, step, day)', () => {
    const once = withQueued([], base);
    const twice = withQueued(once, { ...base, enqueuedAt: 'later' });
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
});
