import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getOverriddenKeys, setConflictOverride } from './overrides';

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

const KEY = 'onskin.conflict.overrides';

describe('conflict override persistence', () => {
  beforeEach(() => {
    mocks.storage.clear();
  });

  it('removes malformed override state and returns an empty set', async () => {
    mocks.storage.set(KEY, '{not-json');

    await expect(getOverriddenKeys()).resolves.toEqual(new Set());
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('normalizes duplicate and invalid override keys', async () => {
    mocks.storage.set(KEY, JSON.stringify(['rule-a', '', 'rule-a', false, 'rule-b']));

    await expect(getOverriddenKeys()).resolves.toEqual(new Set(['rule-a', 'rule-b']));
    expect(JSON.parse(mocks.storage.get(KEY) ?? '[]')).toEqual(['rule-a', 'rule-b']);
  });

  it('writes clean override state after malformed storage', async () => {
    mocks.storage.set(KEY, JSON.stringify({ key: 'rule-a' }));

    await setConflictOverride('rule-a', true);

    expect(JSON.parse(mocks.storage.get(KEY) ?? '[]')).toEqual(['rule-a']);
  });
});
