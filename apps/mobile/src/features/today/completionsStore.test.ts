import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCompletedSteps, toggleCompletion } from './completionsStore';

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
});
