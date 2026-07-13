import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';
import { createOwnerQueryScope } from '@/lib/query/queryKeys';

import {
  dismissRecommendation,
  loadDismissed,
  loadPreferences,
  REC_PREFERENCES_INVALID,
  REC_PREFERENCES_UNSUPPORTED_VERSION,
  savePreferences,
} from './store';

const mocks = vi.hoisted(() => ({
  abortSignal: vi.fn(async () => ({ error: null })),
  storage: new Map<string, string>(),
  tails: new Map<string, Promise<void>>(),
  updateFailure: null as Error | null,
  getUser: vi.fn(async () => ({ data: { user: null as { id: string } | null } })),
  upsert: vi.fn(),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
  multiRemovePrivateItems: vi.fn(async (keys: string[]) => {
    for (const key of keys) mocks.storage.delete(key);
  }),
  updatePrivateItem: vi.fn(
    async (key: string, updater: (current: string | null) => string | null) => {
      const previous = mocks.tails.get(key) ?? Promise.resolve();
      let release!: () => void;
      const tail = new Promise<void>((resolve) => {
        release = resolve;
      });
      mocks.tails.set(key, tail);
      await previous;
      try {
        if (mocks.updateFailure) throw mocks.updateFailure;
        const next = updater(mocks.storage.get(key) ?? null);
        if (next === null) mocks.storage.delete(key);
        else mocks.storage.set(key, next);
      } finally {
        release();
        if (mocks.tails.get(key) === tail) mocks.tails.delete(key);
      }
    },
  ),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: mocks.getUser,
    },
    from: vi.fn(() => ({ upsert: mocks.upsert })),
  },
}));

const PREF_KEY = 'onskin.recPrefs.v1';
const DISMISSED_KEY = 'onskin.recDismissed.v1';

function ownerScope() {
  return createOwnerQueryScope();
}

describe('recommendation local store recovery', () => {
  beforeEach(() => {
    mocks.storage.clear();
    mocks.tails.clear();
    mocks.updateFailure = null;
    mocks.getUser.mockClear();
    mocks.upsert.mockClear();
    mocks.abortSignal.mockClear();
    mocks.upsert.mockReturnValue({ abortSignal: mocks.abortSignal });
  });

  it('preserves malformed preference JSON and returns defaults', async () => {
    const original = '{not-json';
    mocks.storage.set(PREF_KEY, original);

    await expect(loadPreferences()).resolves.toEqual({
      values: [],
      budget: null,
      formats: [],
    });
    expect(mocks.storage.get(PREF_KEY)).toBe(original);
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
    expect(JSON.parse(mocks.storage.get(PREF_KEY) ?? '{}')).toMatchObject({ budget: 'luxury' });
  });

  it('saves only normalized preferences', async () => {
    await savePreferences(ownerScope(), {
      values: ['fragrance_free', 'fragrance_free'],
      budget: 'mid',
      formats: ['cream', 'cream', ''],
    });

    expect(JSON.parse(mocks.storage.get(PREF_KEY) ?? '{}')).toEqual({
      version: 1,
      preferences: {
        values: ['fragrance_free'],
        budget: 'mid',
        formats: ['cream'],
      },
    });
  });

  it('pins the best-effort preference mirror to its owner lease signal', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: 'owner-a' } } });

    await savePreferences(ownerScope(), {
      values: ['vegan'],
      budget: 'mid',
      formats: ['gel'],
    });
    await waitForAccountGenerationOperationsToSettle();

    expect(mocks.upsert).toHaveBeenCalledWith({
      user_id: 'owner-a',
      values_filters: ['vegan'],
      budget_band: 'mid',
      format_prefs: ['gel'],
    });
    expect(mocks.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('preserves malformed dismissed recommendation JSON', async () => {
    const original = '{not-json';
    mocks.storage.set(DISMISSED_KEY, original);

    await expect(loadDismissed()).resolves.toEqual([]);
    expect(mocks.storage.get(DISMISSED_KEY)).toBe(original);
  });

  it('normalizes duplicate and invalid dismissed ids', async () => {
    mocks.storage.set(DISMISSED_KEY, JSON.stringify([' gap:spf ', '', 'gap:spf', false]));

    await expect(loadDismissed()).resolves.toEqual(['gap:spf']);
    expect(JSON.parse(mocks.storage.get(DISMISSED_KEY) ?? '[]')).toEqual([
      ' gap:spf ',
      '',
      'gap:spf',
      false,
    ]);
  });

  it('refuses to overwrite malformed dismissed storage', async () => {
    const original = JSON.stringify({ id: 'gap:spf' });
    mocks.storage.set(DISMISSED_KEY, original);

    await expect(dismissRecommendation(ownerScope(), ' gap:spf ')).rejects.toThrow(
      'PRIVATE_STRING_SET_INVALID',
    );

    expect(mocks.storage.get(DISMISSED_KEY)).toBe(original);
  });

  it('preserves future preference versions and refuses to overwrite them', async () => {
    const original = JSON.stringify({ version: 2, preferences: {} });
    mocks.storage.set(PREF_KEY, original);

    await expect(loadPreferences()).resolves.toEqual({ values: [], budget: null, formats: [] });
    await expect(
      savePreferences(ownerScope(), { values: [], budget: null, formats: [] }),
    ).rejects.toThrow(REC_PREFERENCES_UNSUPPORTED_VERSION);

    expect(mocks.storage.get(PREF_KEY)).toBe(original);
  });

  it('rejects malformed current preferences without replacing their bytes', async () => {
    const original = JSON.stringify({
      version: 1,
      preferences: { values: ['bad-value'], budget: null, formats: [] },
    });
    mocks.storage.set(PREF_KEY, original);

    await expect(
      savePreferences(ownerScope(), { values: [], budget: 'mid', formats: [] }),
    ).rejects.toThrow(REC_PREFERENCES_INVALID);
    expect(mocks.storage.get(PREF_KEY)).toBe(original);
  });

  it('serializes simultaneous dismissals without losing a writer', async () => {
    const ids = Array.from({ length: 30 }, (_, index) => `gap:${index}`);

    const scope = ownerScope();
    await Promise.all(ids.map((id) => dismissRecommendation(scope, id)));

    expect(new Set(await loadDismissed())).toEqual(new Set(ids));
    expect(JSON.parse(mocks.storage.get(DISMISSED_KEY) ?? '{}')).toMatchObject({ version: 1 });
  });

  it('keeps prior recommendation state intact on atomic write failure', async () => {
    await savePreferences(ownerScope(), { values: ['vegan'], budget: 'mid', formats: ['gel'] });
    await dismissRecommendation(ownerScope(), 'gap:spf');
    const prefs = mocks.storage.get(PREF_KEY);
    const dismissed = mocks.storage.get(DISMISSED_KEY);
    mocks.updateFailure = new Error('PRIVATE_WRITE_FAILED');

    await expect(
      savePreferences(ownerScope(), { values: [], budget: null, formats: [] }),
    ).rejects.toThrow('PRIVATE_WRITE_FAILED');
    await expect(dismissRecommendation(ownerScope(), 'gap:cleanser')).rejects.toThrow(
      'PRIVATE_WRITE_FAILED',
    );

    expect(mocks.storage.get(PREF_KEY)).toBe(prefs);
    expect(mocks.storage.get(DISMISSED_KEY)).toBe(dismissed);
  });

  it('rejects delayed owner-A preference and dismissal payloads after an A-to-B boundary', async () => {
    const staleScope = ownerScope();
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();

    await expect(
      savePreferences(staleScope, { values: ['vegan'], budget: 'mid', formats: ['gel'] }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    await expect(dismissRecommendation(staleScope, 'gap:spf')).rejects.toMatchObject({
      code: 'ACCOUNT_GENERATION_CHANGED',
    });

    expect(mocks.storage.has(PREF_KEY)).toBe(false);
    expect(mocks.storage.has(DISMISSED_KEY)).toBe(false);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
