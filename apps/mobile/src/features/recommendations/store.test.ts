import { beforeEach, describe, expect, it, vi } from 'vitest';

import { dismissRecommendation, loadDismissed, loadPreferences, savePreferences } from './store';

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
  multiRemovePrivateItems: vi.fn(async (keys: string[]) => {
    for (const key of keys) mocks.storage.delete(key);
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

const PREF_KEY = 'onskin.recPrefs.v1';
const DISMISSED_KEY = 'onskin.recDismissed.v1';

describe('recommendation local store recovery', () => {
  beforeEach(() => {
    mocks.storage.clear();
  });

  it('removes malformed preference JSON and returns defaults', async () => {
    mocks.storage.set(PREF_KEY, '{not-json');

    await expect(loadPreferences()).resolves.toEqual({
      values: [],
      budget: null,
      formats: [],
    });
    expect(mocks.storage.has(PREF_KEY)).toBe(false);
  });

  it('normalizes duplicate and invalid preferences', async () => {
    mocks.storage.set(
      PREF_KEY,
      JSON.stringify({
        values: [' fragrance_free ', 'bad-value', 'fragrance_free', 'vegan'],
        budget: 'luxury',
        formats: [' cream ', '', 'gel', 'cream', false],
      }),
    );

    await expect(loadPreferences()).resolves.toEqual({
      values: ['fragrance_free', 'vegan'],
      budget: null,
      formats: ['cream', 'gel'],
    });
    expect(JSON.parse(mocks.storage.get(PREF_KEY) ?? '{}')).toEqual({
      values: ['fragrance_free', 'vegan'],
      budget: null,
      formats: ['cream', 'gel'],
    });
  });

  it('saves only normalized preferences', async () => {
    await savePreferences({
      values: ['fragrance_free', 'fragrance_free'],
      budget: 'mid',
      formats: ['cream', 'cream', ''],
    });

    expect(JSON.parse(mocks.storage.get(PREF_KEY) ?? '{}')).toEqual({
      values: ['fragrance_free'],
      budget: 'mid',
      formats: ['cream'],
    });
  });

  it('removes malformed dismissed recommendation JSON', async () => {
    mocks.storage.set(DISMISSED_KEY, '{not-json');

    await expect(loadDismissed()).resolves.toEqual([]);
    expect(mocks.storage.has(DISMISSED_KEY)).toBe(false);
  });

  it('normalizes duplicate and invalid dismissed ids', async () => {
    mocks.storage.set(DISMISSED_KEY, JSON.stringify([' gap:spf ', '', 'gap:spf', false]));

    await expect(loadDismissed()).resolves.toEqual(['gap:spf']);
    expect(JSON.parse(mocks.storage.get(DISMISSED_KEY) ?? '[]')).toEqual(['gap:spf']);
  });

  it('writes clean dismissed state after malformed storage', async () => {
    mocks.storage.set(DISMISSED_KEY, JSON.stringify({ id: 'gap:spf' }));

    await dismissRecommendation(' gap:spf ');

    expect(JSON.parse(mocks.storage.get(DISMISSED_KEY) ?? '[]')).toEqual(['gap:spf']);
  });
});
