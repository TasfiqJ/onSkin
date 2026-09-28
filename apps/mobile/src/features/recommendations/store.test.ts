import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  dismissRecommendation,
  loadDismissed,
  loadPreferences,
  REC_PREFERENCES_INVALID,
  REC_PREFERENCES_UNSUPPORTED_VERSION,
  savePreferences,
} from './store';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  tails: new Map<string, Promise<void>>(),
  updateFailure: null as Error | null,
  getUser: vi.fn(async () => ({ data: { user: null as { id: string } | null } })),
  runHealthDataWriteOperation: vi.fn(),
  rpc: vi.fn(async () => ({ error: null as { message: string } | null })),
}));

vi.mock('@/lib/consent/healthProcessingEpoch', () => ({
  activeHealthProcessingOwnerUserId: () => 'user-1',
}));

vi.mock('@/lib/consent/healthDataWriteAdmission', () => ({
  HEALTH_DATA_WRITE_ADMISSION_CLOSED: 'HEALTH_DATA_WRITE_ADMISSION_CLOSED',
  runHealthDataWriteOperation: mocks.runHealthDataWriteOperation,
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
  getPersistedSupabaseUser: mocks.getUser,
  supabase: {
    auth: {
      getUser: mocks.getUser,
    },
    rpc: mocks.rpc,
  },
}));

const PREF_KEY = 'layerwell.recPrefs.v1';
const DISMISSED_KEY = 'layerwell.recDismissed.v1';

describe('recommendation local store recovery', () => {
  beforeEach(() => {
    mocks.storage.clear();
    mocks.tails.clear();
    mocks.updateFailure = null;
    mocks.getUser.mockReset();
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    mocks.runHealthDataWriteOperation.mockReset();
    mocks.runHealthDataWriteOperation.mockImplementation(
      async (
        ownerUserId: string,
        operation: (lease: { ownerUserId: string; assertCurrent: () => void }) => unknown,
      ) => operation({ ownerUserId, assertCurrent: vi.fn() }),
    );
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({ error: null });
  });

  it('preserves malformed preference JSON and fails closed', async () => {
    const original = '{not-json';
    mocks.storage.set(PREF_KEY, original);

    await expect(loadPreferences()).rejects.toThrow(REC_PREFERENCES_INVALID);
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
    await savePreferences({
      values: ['fragrance_free', 'fragrance_free'],
      budget: 'mid',
      formats: ['cream', 'cream', ''],
    } as Parameters<typeof savePreferences>[0]);

    expect(JSON.parse(mocks.storage.get(PREF_KEY) ?? '{}')).toEqual({
      version: 1,
      preferences: {
        values: ['fragrance_free'],
        budget: 'mid',
        formats: ['cream'],
      },
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('uses the authenticated scalar RPC and closed format enum for the server mirror', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

    await savePreferences({
      values: ['fragrance_free'],
      budget: 'mid',
      formats: ['gel', 'cream'],
    });

    expect(mocks.rpc).toHaveBeenCalledWith('set_recommendation_preferences', {
      p_values_filters: ['fragrance_free'],
      p_budget_band: 'mid',
      p_format_prefs: ['gel', 'cream'],
    });
  });

  it('keeps the encrypted local preference authoritative when the remote mirror rejects', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.rpc.mockResolvedValueOnce({ error: { message: 'offline' } });

    await savePreferences({
      values: ['vegan'],
      budget: 'drugstore',
      formats: ['fluid'],
    });

    await expect(loadPreferences()).resolves.toEqual({
      values: ['vegan'],
      budget: 'drugstore',
      formats: ['fluid'],
    });
  });

  it('preserves malformed dismissed recommendation JSON and fails closed', async () => {
    const original = '{not-json';
    mocks.storage.set(DISMISSED_KEY, original);

    await expect(loadDismissed()).rejects.toThrow('PRIVATE_STRING_SET_INVALID');
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

    await expect(dismissRecommendation(' gap:spf ')).rejects.toThrow('PRIVATE_STRING_SET_INVALID');

    expect(mocks.storage.get(DISMISSED_KEY)).toBe(original);
  });

  it('preserves future preference versions and refuses to overwrite them', async () => {
    const original = JSON.stringify({ version: 2, preferences: {} });
    mocks.storage.set(PREF_KEY, original);

    await expect(loadPreferences()).rejects.toThrow(REC_PREFERENCES_UNSUPPORTED_VERSION);
    await expect(savePreferences({ values: [], budget: null, formats: [] })).rejects.toThrow(
      REC_PREFERENCES_UNSUPPORTED_VERSION,
    );

    expect(mocks.storage.get(PREF_KEY)).toBe(original);
  });

  it('rejects malformed current preferences without replacing their bytes', async () => {
    const original = JSON.stringify({
      version: 1,
      preferences: { values: ['bad-value'], budget: null, formats: [] },
    });
    mocks.storage.set(PREF_KEY, original);

    await expect(savePreferences({ values: [], budget: 'mid', formats: [] })).rejects.toThrow(
      REC_PREFERENCES_INVALID,
    );
    expect(mocks.storage.get(PREF_KEY)).toBe(original);
  });

  it('serializes simultaneous dismissals without losing a writer', async () => {
    const ids = Array.from({ length: 30 }, (_, index) => `gap:${index}`);

    await Promise.all(ids.map((id) => dismissRecommendation(id)));

    expect(new Set(await loadDismissed())).toEqual(new Set(ids));
    expect(JSON.parse(mocks.storage.get(DISMISSED_KEY) ?? '{}')).toMatchObject({ version: 1 });
  });

  it('keeps prior recommendation state intact on atomic write failure', async () => {
    await savePreferences({ values: ['vegan'], budget: 'mid', formats: ['gel'] });
    await dismissRecommendation('gap:spf');
    const prefs = mocks.storage.get(PREF_KEY);
    const dismissed = mocks.storage.get(DISMISSED_KEY);
    mocks.updateFailure = new Error('PRIVATE_WRITE_FAILED');

    await expect(savePreferences({ values: [], budget: null, formats: [] })).rejects.toThrow(
      'PRIVATE_WRITE_FAILED',
    );
    await expect(dismissRecommendation('gap:cleanser')).rejects.toThrow('PRIVATE_WRITE_FAILED');

    expect(mocks.storage.get(PREF_KEY)).toBe(prefs);
    expect(mocks.storage.get(DISMISSED_KEY)).toBe(dismissed);
  });
});
