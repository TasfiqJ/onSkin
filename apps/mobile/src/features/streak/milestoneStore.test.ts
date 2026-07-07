import { beforeEach, describe, expect, it, vi } from 'vitest';

import { markMilestoneSeen } from './milestoneStore';

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

const KEY = 'onskin.milestones.v1';

describe('streak milestone store', () => {
  beforeEach(() => {
    mocks.storage.clear();
  });

  it('recovers from unreadable local milestone JSON on the next seen marker', async () => {
    mocks.storage.set(KEY, '{not-json');

    await expect(markMilestoneSeen('d7')).resolves.toBe(true);

    expect(JSON.parse(mocks.storage.get(KEY) ?? '[]')).toEqual(['d7']);
  });

  it('recovers from wrong-shaped local milestone records on the next seen marker', async () => {
    mocks.storage.set(KEY, JSON.stringify({ key: 'd7' }));

    await expect(markMilestoneSeen('d30')).resolves.toBe(true);

    expect(JSON.parse(mocks.storage.get(KEY) ?? '[]')).toEqual(['d30']);
  });

  it('normalizes duplicate and padded milestone keys before checking freshness', async () => {
    mocks.storage.set(KEY, JSON.stringify([' d7 ', '', 'd7', 7]));

    await expect(markMilestoneSeen('d7')).resolves.toBe(false);

    expect(JSON.parse(mocks.storage.get(KEY) ?? '[]')).toEqual(['d7']);
  });

  it('ignores empty milestone keys', async () => {
    await expect(markMilestoneSeen('   ')).resolves.toBe(false);

    expect(mocks.storage.has(KEY)).toBe(false);
  });
});
