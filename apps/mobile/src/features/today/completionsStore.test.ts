import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getCompletedSteps,
  getCountByDate,
  isBeyondBackfillCap,
  toggleCompletion,
} from './completionsStore';

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

const KEY = 'onskin.completions.v1';
const FIRST_COMPLETION_KEY = 'onskin.completions.firstCompletion.v1';
const DAY = '2026-07-07';

describe('today completion persistence', () => {
  beforeEach(() => {
    mocks.storage.clear();
  });

  it('clears malformed completion logs and returns an empty day', async () => {
    mocks.storage.set(KEY, '{not-json');

    const completed = await getCompletedSteps(DAY);

    expect([...completed]).toEqual([]);
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('replaces wrong-shaped completion logs on the next check-off', async () => {
    mocks.storage.set(KEY, JSON.stringify({ [DAY]: 'AM:cleanser' }));

    await expect(toggleCompletion('AM:cleanser', DAY)).resolves.toEqual({
      done: true,
      firstEver: true,
    });

    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({ [DAY]: ['AM:cleanser'] });
  });

  it('persists a normal check-off across fresh Today reads', async () => {
    await expect(toggleCompletion('AM:cleanser', DAY)).resolves.toEqual({
      done: true,
      firstEver: true,
    });

    await expect(getCompletedSteps(DAY)).resolves.toEqual(new Set(['AM:cleanser']));
    await expect(getCompletedSteps(DAY)).resolves.toEqual(new Set(['AM:cleanser']));
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({ [DAY]: ['AM:cleanser'] });
  });

  it('does not re-fire first-ever activation after the user undoes every completion', async () => {
    await expect(toggleCompletion('AM:cleanser', DAY)).resolves.toEqual({
      done: true,
      firstEver: true,
    });
    await expect(toggleCompletion('AM:cleanser', DAY)).resolves.toEqual({
      done: false,
      firstEver: false,
    });
    await expect(toggleCompletion('AM:cleanser', DAY)).resolves.toEqual({
      done: true,
      firstEver: false,
    });

    expect(mocks.storage.get(FIRST_COMPLETION_KEY)).toBe('true');
  });

  it('marks legacy completion logs as already activated before future toggles', async () => {
    mocks.storage.set(KEY, JSON.stringify({ [DAY]: ['AM:cleanser'] }));

    await expect(toggleCompletion('AM:cleanser', DAY)).resolves.toEqual({
      done: false,
      firstEver: false,
    });
    await expect(toggleCompletion('AM:cleanser', DAY)).resolves.toEqual({
      done: true,
      firstEver: false,
    });

    expect(mocks.storage.get(FIRST_COMPLETION_KEY)).toBe('true');
  });

  it('normalizes padded and duplicate step keys before Today reads them', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify({
        [` ${DAY} `]: [' AM:cleanser ', '', 'AM:cleanser', 7, 'PM:retinol'],
        '2026-02-31': ['PM:bad-date'],
        '2026-07-06': 'wrong-shape',
      }),
    );

    await expect(getCompletedSteps(DAY)).resolves.toEqual(new Set(['AM:cleanser', 'PM:retinol']));

    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      [DAY]: ['AM:cleanser', 'PM:retinol'],
    });
  });

  it('merges completion rows when padded legacy dates normalize to the same day', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify({
        [` ${DAY} `]: ['AM:cleanser'],
        [DAY]: ['PM:retinol'],
      }),
    );

    await expect(getCompletedSteps(DAY)).resolves.toEqual(new Set(['AM:cleanser', 'PM:retinol']));
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      [DAY]: ['AM:cleanser', 'PM:retinol'],
    });
  });

  it('does not persist empty step keys or invalid completion dates', async () => {
    await expect(toggleCompletion('   ', DAY)).resolves.toEqual({
      done: false,
      firstEver: false,
    });
    await expect(toggleCompletion('AM:cleanser', '2026-02-31')).resolves.toEqual({
      done: false,
      firstEver: false,
    });

    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('treats invalid dates as beyond the backfill cap', () => {
    expect(isBeyondBackfillCap('2026-02-31', DAY)).toBe(true);
    expect(isBeyondBackfillCap(DAY, 'not-a-day')).toBe(true);
  });

  it('rejects dates beyond the timezone-tolerant future window', () => {
    expect(isBeyondBackfillCap('2026-07-08', DAY)).toBe(false);
    expect(isBeyondBackfillCap('2026-07-09', DAY)).toBe(true);
  });

  it('uses normalized completion rows for heat-map counts', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify({
        [DAY]: ['AM:cleanser', ' AM:cleanser ', 'PM:retinol'],
      }),
    );

    const counts = await getCountByDate();

    expect(counts.get(DAY)).toBe(2);
  });
});
