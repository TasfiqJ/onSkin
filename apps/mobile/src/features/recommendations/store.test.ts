import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';
import { createOwnerQueryScope } from '@/lib/query/queryKeys';
import * as privateKV from '@/lib/storage/privateKV';

import {
  clearRecState,
  dismissRecommendation,
  loadDismissed,
  loadPreferences,
  loadRecommendationInputs,
  readDismissedRecommendations,
  readRecommendationPreferences,
  REC_DISMISSED_INVALID,
  REC_DISMISSED_UNAVAILABLE,
  REC_DISMISSED_UNSUPPORTED_VERSION,
  REC_PREFERENCES_INVALID,
  REC_PREFERENCES_UNAVAILABLE,
  REC_PREFERENCES_UNSUPPORTED_VERSION,
  savePreferences,
} from './store';

const mocks = vi.hoisted(() => ({
  abortSignal: vi.fn<() => Promise<{ error: unknown }>>(),
  storage: new Map<string, string>(),
  readOverrides: new Map<string, unknown>(),
  readError: null as Error | null,
  tails: new Map<string, Promise<void>>(),
  updateFailure: null as Error | null,
  writes: 0,
  getUser: vi.fn(async () => ({ data: { user: null as { id: string } | null } })),
  upsert: vi.fn(),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  readPrivateItem: vi.fn(async (key: string) => {
    if (mocks.readError) throw mocks.readError;
    const override = mocks.readOverrides.get(key);
    if (override) return override;
    const value = mocks.storage.get(key);
    return value === undefined ? { status: 'absent' } : { status: 'available', value };
  }),
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
        const current = mocks.storage.get(key) ?? null;
        const next = updater(current);
        if (next !== current) {
          mocks.writes += 1;
          if (next === null) mocks.storage.delete(key);
          else mocks.storage.set(key, next);
        }
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
const runtime = globalThis as typeof globalThis & { __DEV__?: boolean };
const originalDev = runtime.__DEV__;

const DEFAULTS = { values: [], budget: null, formats: [] };

function ownerScope() {
  return createOwnerQueryScope();
}

function currentPreferences(
  preferences: {
    values: string[];
    budget: 'drugstore' | 'mid' | 'premium' | null;
    formats: string[];
  } = { values: ['vegan'], budget: 'mid', formats: ['gel'] },
): string {
  return JSON.stringify({ version: 1, preferences });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('recommendation local store recovery', () => {
  beforeEach(async () => {
    delete process.env.EXPO_PUBLIC_E2E_RECOMMENDATION_READ_FAILURE;
    delete process.env.EXPO_PUBLIC_E2E_RECOMMENDATION_READ_DELAY_MS;
    delete process.env.EXPO_PUBLIC_E2E_RECOMMENDATION_DISMISS_FAILURE;
    await waitForAccountGenerationOperationsToSettle();
    mocks.storage.clear();
    mocks.readOverrides.clear();
    mocks.readError = null;
    mocks.tails.clear();
    mocks.updateFailure = null;
    mocks.writes = 0;
    mocks.getUser.mockReset();
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    mocks.upsert.mockReset();
    mocks.abortSignal.mockReset();
    mocks.abortSignal.mockResolvedValue({ error: null });
    mocks.upsert.mockReturnValue({ abortSignal: mocks.abortSignal });
    vi.mocked(privateKV.readPrivateItem).mockClear();
    vi.mocked(privateKV.multiRemovePrivateItems).mockClear();
    vi.mocked(privateKV.updatePrivateItem).mockClear();
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_E2E_RECOMMENDATION_READ_FAILURE;
    delete process.env.EXPO_PUBLIC_E2E_RECOMMENDATION_READ_DELAY_MS;
    delete process.env.EXPO_PUBLIC_E2E_RECOMMENDATION_DISMISS_FAILURE;
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
  });

  it('distinguishes genuine absence from unavailable private state', async () => {
    await expect(readRecommendationPreferences()).resolves.toEqual({
      status: 'absent',
      preferences: DEFAULTS,
    });
    await expect(readDismissedRecommendations()).resolves.toEqual({
      status: 'absent',
      dismissed: [],
    });
    await expect(loadRecommendationInputs()).resolves.toEqual({ prefs: DEFAULTS, dismissed: [] });

    mocks.readOverrides.set(PREF_KEY, {
      status: 'unavailable',
      reason: 'content_key_missing',
    });
    mocks.readOverrides.set(DISMISSED_KEY, {
      status: 'unavailable',
      reason: 'content_key_storage_unavailable',
    });

    await expect(readRecommendationPreferences()).resolves.toEqual({
      status: 'unavailable',
      preferences: null,
      reason: 'content_key_missing',
    });
    await expect(readDismissedRecommendations()).resolves.toEqual({
      status: 'unavailable',
      dismissed: null,
      reason: 'content_key_storage_unavailable',
    });
    await expect(loadPreferences()).rejects.toThrow(REC_PREFERENCES_UNAVAILABLE);
    await expect(loadDismissed()).rejects.toThrow(REC_DISMISSED_UNAVAILABLE);
  });

  it('returns fresh defaults for each genuinely absent preference read', async () => {
    const first = await readRecommendationPreferences();
    expect(first.status).toBe('absent');
    if (first.status !== 'absent') throw new Error('expected absent preferences');
    first.preferences.values.push('vegan');
    first.preferences.formats.push('gel');

    await expect(readRecommendationPreferences()).resolves.toEqual({
      status: 'absent',
      preferences: DEFAULTS,
    });
  });

  it('reads strict current records without rewriting bytes', async () => {
    const preferences = currentPreferences();
    const dismissed = JSON.stringify({ version: 1, values: ['gap:spf'] });
    mocks.storage.set(PREF_KEY, preferences);
    mocks.storage.set(DISMISSED_KEY, dismissed);

    await expect(readRecommendationPreferences()).resolves.toEqual({
      status: 'available',
      format: 'current',
      preferences: { values: ['vegan'], budget: 'mid', formats: ['gel'] },
    });
    await expect(readDismissedRecommendations()).resolves.toEqual({
      status: 'available',
      format: 'current',
      dismissed: ['gap:spf'],
    });
    expect(mocks.storage.get(PREF_KEY)).toBe(preferences);
    expect(mocks.storage.get(DISMISSED_KEY)).toBe(dismissed);
    expect(mocks.writes).toBe(0);
  });

  it('normalizes the documented legacy preference shape without read-time migration', async () => {
    const original = JSON.stringify({
      values: [' fragrance_free ', 'bad-value', 'fragrance_free', 'vegan'],
      budget: 'luxury',
      formats: [' cream ', '', 'gel', 'cream', false],
    });
    mocks.storage.set(PREF_KEY, original);

    await expect(readRecommendationPreferences()).resolves.toEqual({
      status: 'available',
      format: 'legacy',
      preferences: {
        values: ['fragrance_free', 'vegan'],
        budget: null,
        formats: ['cream', 'gel'],
      },
    });
    expect(mocks.storage.get(PREF_KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('does not classify an arbitrary legacy object as default preferences', async () => {
    const original = '{}';
    mocks.storage.set(PREF_KEY, original);

    await expect(readRecommendationPreferences()).resolves.toEqual({
      status: 'corrupt',
      preferences: null,
      reason: 'invalid_payload',
    });
    await expect(loadPreferences()).rejects.toThrow(REC_PREFERENCES_INVALID);
    expect(mocks.storage.get(PREF_KEY)).toBe(original);
  });

  it('preserves malformed preference and dismissal bytes behind typed corruption', async () => {
    const preferences = '{not-json';
    const dismissed = JSON.stringify([' gap:spf ', '', 'gap:spf', false]);
    mocks.storage.set(PREF_KEY, preferences);
    mocks.storage.set(DISMISSED_KEY, dismissed);

    await expect(readRecommendationPreferences()).resolves.toMatchObject({
      status: 'corrupt',
      preferences: null,
      reason: 'invalid_payload',
    });
    await expect(readDismissedRecommendations()).resolves.toMatchObject({
      status: 'corrupt',
      dismissed: null,
      reason: 'invalid_payload',
    });
    await expect(loadPreferences()).rejects.toThrow(REC_PREFERENCES_INVALID);
    await expect(loadDismissed()).rejects.toThrow(REC_DISMISSED_INVALID);
    expect(mocks.storage.get(PREF_KEY)).toBe(preferences);
    expect(mocks.storage.get(DISMISSED_KEY)).toBe(dismissed);
  });

  it('reads strict legacy dismissed ids and upgrades only during an explicit mutation', async () => {
    const original = JSON.stringify(['gap:spf']);
    mocks.storage.set(DISMISSED_KEY, original);

    await expect(readDismissedRecommendations()).resolves.toEqual({
      status: 'available',
      format: 'legacy',
      dismissed: ['gap:spf'],
    });
    expect(mocks.storage.get(DISMISSED_KEY)).toBe(original);

    await dismissRecommendation(ownerScope(), 'gap:cleanser');
    expect(JSON.parse(mocks.storage.get(DISMISSED_KEY) ?? '{}')).toEqual({
      version: 1,
      values: ['gap:spf', 'gap:cleanser'],
    });
  });

  it('preserves future domain versions and refuses to overwrite them', async () => {
    const preferences = JSON.stringify({ version: 2, preferences: {} });
    const dismissed = JSON.stringify({ version: 2, values: [] });
    mocks.storage.set(PREF_KEY, preferences);
    mocks.storage.set(DISMISSED_KEY, dismissed);

    await expect(readRecommendationPreferences()).resolves.toEqual({
      status: 'unsupported_version',
      preferences: null,
    });
    await expect(readDismissedRecommendations()).resolves.toEqual({
      status: 'unsupported_version',
      dismissed: null,
    });
    await expect(loadPreferences()).rejects.toThrow(REC_PREFERENCES_UNSUPPORTED_VERSION);
    await expect(loadDismissed()).rejects.toThrow(REC_DISMISSED_UNSUPPORTED_VERSION);
    await expect(savePreferences(ownerScope(), DEFAULTS)).rejects.toThrow(
      REC_PREFERENCES_UNSUPPORTED_VERSION,
    );
    await expect(dismissRecommendation(ownerScope(), 'gap:spf')).rejects.toThrow(
      REC_DISMISSED_UNSUPPORTED_VERSION,
    );
    expect(mocks.storage.get(PREF_KEY)).toBe(preferences);
    expect(mocks.storage.get(DISMISSED_KEY)).toBe(dismissed);
  });

  it.each([
    [
      { status: 'corrupt', reason: 'decryption_failed' },
      { status: 'corrupt', reason: 'decryption_failed' },
    ],
    [{ status: 'unsupported_version' }, { status: 'unsupported_version' }],
  ] as const)(
    'forwards private-KV %s state without consulting the domain codec',
    async (stored, expected) => {
      mocks.readOverrides.set(PREF_KEY, stored);
      mocks.readOverrides.set(DISMISSED_KEY, stored);

      await expect(readRecommendationPreferences()).resolves.toMatchObject({
        ...expected,
        preferences: null,
      });
      await expect(readDismissedRecommendations()).resolves.toMatchObject({
        ...expected,
        dismissed: null,
      });
    },
  );

  it('maps an unexpected typed-boundary rejection to storage unavailable', async () => {
    mocks.readError = new Error('transport failed');

    await expect(readRecommendationPreferences()).resolves.toEqual({
      status: 'unavailable',
      preferences: null,
      reason: 'storage_unavailable',
    });
    await expect(readDismissedRecommendations()).resolves.toEqual({
      status: 'unavailable',
      dismissed: null,
      reason: 'storage_unavailable',
    });
  });

  it('uses non-mutating dev-only persistent and one-shot read fixtures', async () => {
    runtime.__DEV__ = true;
    mocks.storage.set(PREF_KEY, currentPreferences());
    mocks.storage.set(DISMISSED_KEY, JSON.stringify({ version: 1, values: ['gap:spf'] }));
    process.env.EXPO_PUBLIC_E2E_RECOMMENDATION_READ_FAILURE = 'always';

    await expect(readRecommendationPreferences()).resolves.toMatchObject({
      status: 'unavailable',
      preferences: null,
    });
    await expect(readDismissedRecommendations()).resolves.toMatchObject({
      status: 'unavailable',
      dismissed: null,
    });
    expect(privateKV.readPrivateItem).not.toHaveBeenCalled();
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();

    process.env.EXPO_PUBLIC_E2E_RECOMMENDATION_READ_FAILURE = 'once';
    await expect(loadRecommendationInputs()).rejects.toThrow(REC_PREFERENCES_UNAVAILABLE);
    await expect(loadRecommendationInputs()).resolves.toEqual({
      prefs: { values: ['vegan'], budget: 'mid', formats: ['gel'] },
      dismissed: ['gap:spf'],
    });
    expect(mocks.storage.get(PREF_KEY)).toBe(currentPreferences());

    delete process.env.EXPO_PUBLIC_E2E_RECOMMENDATION_READ_FAILURE;
    await expect(loadRecommendationInputs()).resolves.toEqual({
      prefs: { values: ['vegan'], budget: 'mid', formats: ['gel'] },
      dismissed: ['gap:spf'],
    });
    process.env.EXPO_PUBLIC_E2E_RECOMMENDATION_READ_FAILURE = 'once';
    await expect(loadRecommendationInputs()).rejects.toThrow(REC_PREFERENCES_UNAVAILABLE);
  });

  it('supports a targeted dismissed one-shot fixture without consuming preference reads', async () => {
    runtime.__DEV__ = true;
    mocks.storage.set(PREF_KEY, currentPreferences());
    mocks.storage.set(DISMISSED_KEY, JSON.stringify({ version: 1, values: ['gap:spf'] }));
    process.env.EXPO_PUBLIC_E2E_RECOMMENDATION_READ_FAILURE = 'dismissed_once';

    await expect(loadRecommendationInputs()).rejects.toThrow(REC_DISMISSED_UNAVAILABLE);
    await expect(loadRecommendationInputs()).resolves.toEqual({
      prefs: { values: ['vegan'], budget: 'mid', formats: ['gel'] },
      dismissed: ['gap:spf'],
    });
  });

  it('provides a bounded dev-only read delay for deterministic loading evidence', async () => {
    runtime.__DEV__ = true;
    process.env.EXPO_PUBLIC_E2E_RECOMMENDATION_READ_DELAY_MS = '9999';
    vi.useFakeTimers();
    try {
      const pending = loadRecommendationInputs();
      await Promise.resolve();
      expect(privateKV.readPrivateItem).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(2_999);
      expect(privateKV.readPrivateItem).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);

      await expect(pending).resolves.toEqual({ prefs: DEFAULTS, dismissed: [] });
      expect(privateKV.readPrivateItem).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores the E2E read fixture outside development builds', async () => {
    mocks.storage.set(PREF_KEY, currentPreferences());
    process.env.EXPO_PUBLIC_E2E_RECOMMENDATION_READ_FAILURE = 'always';
    runtime.__DEV__ = false;
    await expect(readRecommendationPreferences()).resolves.toMatchObject({
      status: 'available',
      format: 'current',
    });
  });

  it('simulates a dev-only one-shot dismissal failure without touching bytes', async () => {
    runtime.__DEV__ = true;
    process.env.EXPO_PUBLIC_E2E_RECOMMENDATION_DISMISS_FAILURE = 'once';

    await expect(dismissRecommendation(ownerScope(), 'gap:spf')).rejects.toThrow(
      'E2E_RECOMMENDATION_DISMISS_FAILURE',
    );
    expect(mocks.storage.has(DISMISSED_KEY)).toBe(false);
    await expect(dismissRecommendation(ownerScope(), 'gap:spf')).resolves.toBeUndefined();
    await expect(loadDismissed()).resolves.toEqual(['gap:spf']);
  });

  it('does not let a stale owner consume the one-shot dismissal fixture', async () => {
    runtime.__DEV__ = true;
    process.env.EXPO_PUBLIC_E2E_RECOMMENDATION_DISMISS_FAILURE = 'once';
    const staleScope = ownerScope();
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();

    await expect(dismissRecommendation(staleScope, 'gap:stale')).rejects.toMatchObject({
      code: 'ACCOUNT_GENERATION_CHANGED',
    });
    await expect(dismissRecommendation(ownerScope(), 'gap:current')).rejects.toThrow(
      'E2E_RECOMMENDATION_DISMISS_FAILURE',
    );
    await expect(loadDismissed()).resolves.toEqual([]);
  });

  it('saves strict preferences and performs identical current saves as true no-ops', async () => {
    const scope = ownerScope();
    await savePreferences(scope, {
      values: ['fragrance_free'],
      budget: 'mid',
      formats: ['cream'],
    });
    await waitForAccountGenerationOperationsToSettle();

    expect(JSON.parse(mocks.storage.get(PREF_KEY) ?? '{}')).toEqual({
      version: 1,
      preferences: {
        values: ['fragrance_free'],
        budget: 'mid',
        formats: ['cream'],
      },
    });
    expect(mocks.writes).toBe(1);
    expect(mocks.getUser).toHaveBeenCalledTimes(1);

    await savePreferences(scope, {
      values: ['fragrance_free'],
      budget: 'mid',
      formats: ['cream'],
    });
    await waitForAccountGenerationOperationsToSettle();
    expect(mocks.writes).toBe(1);
    expect(mocks.getUser).toHaveBeenCalledTimes(1);
  });

  it('performs an identical legacy preference save as an exact zero-write no-op', async () => {
    const legacy = JSON.stringify({
      values: ['fragrance_free'],
      budget: 'mid',
      formats: ['cream'],
    });
    mocks.storage.set(PREF_KEY, legacy);

    await savePreferences(ownerScope(), {
      values: ['fragrance_free'],
      budget: 'mid',
      formats: ['cream'],
    });
    await waitForAccountGenerationOperationsToSettle();

    expect(mocks.storage.get(PREF_KEY)).toBe(legacy);
    expect(mocks.writes).toBe(0);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('serializes 100 full-snapshot preference saves in invocation order', async () => {
    const scope = ownerScope();
    const snapshots: Parameters<typeof savePreferences>[1][] = Array.from(
      { length: 100 },
      (_, index) => ({
        values: index % 2 === 0 ? ['vegan'] : ['fragrance_free'],
        budget: index % 3 === 0 ? ('drugstore' as const) : ('mid' as const),
        formats: [`format-${index}`],
      }),
    );

    await Promise.all(snapshots.map((snapshot) => savePreferences(scope, snapshot)));

    expect(mocks.writes).toBe(100);
    expect(JSON.parse(mocks.storage.get(PREF_KEY) ?? '{}')).toEqual({
      version: 1,
      preferences: snapshots.at(-1),
    });
    await vi.waitFor(() => expect(mocks.getUser).toHaveBeenCalledTimes(100));
  });

  it('rejects malformed runtime preference mutations without normalizing over prior bytes', async () => {
    const original = currentPreferences();
    mocks.storage.set(PREF_KEY, original);

    await expect(
      savePreferences(ownerScope(), {
        values: ['vegan', 'vegan'],
        budget: 'mid',
        formats: [' gel '],
      }),
    ).rejects.toThrow(REC_PREFERENCES_INVALID);

    expect(mocks.storage.get(PREF_KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('refuses preference and dismissal mutations over malformed domain bytes', async () => {
    const preferences = '{not-json';
    const dismissed = JSON.stringify([' gap:spf ']);
    mocks.storage.set(PREF_KEY, preferences);
    mocks.storage.set(DISMISSED_KEY, dismissed);

    await expect(savePreferences(ownerScope(), DEFAULTS)).rejects.toThrow(REC_PREFERENCES_INVALID);
    await expect(dismissRecommendation(ownerScope(), 'gap:cleanser')).rejects.toThrow(
      REC_DISMISSED_INVALID,
    );

    expect(mocks.storage.get(PREF_KEY)).toBe(preferences);
    expect(mocks.storage.get(DISMISSED_KEY)).toBe(dismissed);
    expect(mocks.writes).toBe(0);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('performs repeated dismissal of the same id as a true no-op', async () => {
    const scope = ownerScope();
    await dismissRecommendation(scope, 'gap:spf');
    await dismissRecommendation(scope, 'gap:spf');

    expect(await loadDismissed()).toEqual(['gap:spf']);
    expect(mocks.writes).toBe(1);
  });

  it('serializes 100 simultaneous dismissals without losing a writer', async () => {
    const ids = Array.from({ length: 100 }, (_, index) => `gap:${index}`);
    const scope = ownerScope();

    await Promise.all(ids.map((id) => dismissRecommendation(scope, id)));

    expect(new Set(await loadDismissed())).toEqual(new Set(ids));
    expect(JSON.parse(mocks.storage.get(DISMISSED_KEY) ?? '{}')).toMatchObject({ version: 1 });
  });

  it('rejects oversized preference and dismissal records without replacing bytes', async () => {
    const preferences = currentPreferences();
    const dismissed = JSON.stringify({
      version: 1,
      values: Array.from({ length: 1_025 }, (_, index) => `replacement:${index}`),
    });
    mocks.storage.set(PREF_KEY, preferences);
    mocks.storage.set(DISMISSED_KEY, dismissed);

    await expect(
      savePreferences(ownerScope(), {
        values: [],
        budget: null,
        formats: Array.from({ length: 17 }, (_, index) => `format-${index}`),
      }),
    ).rejects.toThrow(REC_PREFERENCES_INVALID);
    await expect(readDismissedRecommendations()).resolves.toMatchObject({
      status: 'corrupt',
      dismissed: null,
    });
    await expect(dismissRecommendation(ownerScope(), 'x'.repeat(257))).rejects.toThrow(
      REC_DISMISSED_INVALID,
    );
    expect(mocks.storage.get(PREF_KEY)).toBe(preferences);
    expect(mocks.storage.get(DISMISSED_KEY)).toBe(dismissed);
  });

  it('rejects a blank dismissal id without publishing success or touching bytes', async () => {
    const original = JSON.stringify({ version: 1, values: ['gap:spf'] });
    mocks.storage.set(DISMISSED_KEY, original);

    await expect(dismissRecommendation(ownerScope(), '   ')).rejects.toThrow(REC_DISMISSED_INVALID);

    expect(mocks.storage.get(DISMISSED_KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('never writes an escape-expanded dismissal payload that its own reader rejects', async () => {
    const ids: string[] = [];
    let next = '';
    while (true) {
      next = `${ids.length.toString().padStart(4, '0')}:${'\0'.repeat(251)}`;
      const candidate = JSON.stringify({ version: 1, values: [...ids, next] });
      if (candidate.length > 524_288) break;
      ids.push(next);
    }
    const original = JSON.stringify({ version: 1, values: ids });
    expect(ids.length).toBeLessThan(1_024);
    expect(original.length).toBeLessThanOrEqual(524_288);
    mocks.storage.set(DISMISSED_KEY, original);

    await expect(dismissRecommendation(ownerScope(), next)).rejects.toThrow(REC_DISMISSED_INVALID);

    expect(mocks.storage.get(DISMISSED_KEY)).toBe(original);
    await expect(readDismissedRecommendations()).resolves.toMatchObject({
      status: 'available',
      dismissed: ids,
    });
  });

  it('does not clear corrupt or future recommendation state', async () => {
    const preferences = '{not-json';
    const dismissed = JSON.stringify({ version: 2, values: [] });
    mocks.storage.set(PREF_KEY, preferences);
    mocks.storage.set(DISMISSED_KEY, dismissed);

    await expect(clearRecState()).rejects.toThrow(REC_PREFERENCES_INVALID);

    expect(privateKV.multiRemovePrivateItems).not.toHaveBeenCalled();
    expect(mocks.storage.get(PREF_KEY)).toBe(preferences);
    expect(mocks.storage.get(DISMISSED_KEY)).toBe(dismissed);
  });

  it('clears only when both recommendation domains are readable', async () => {
    mocks.storage.set(PREF_KEY, currentPreferences());
    mocks.storage.set(DISMISSED_KEY, JSON.stringify(['gap:spf']));

    await expect(clearRecState()).resolves.toBeUndefined();

    expect(privateKV.multiRemovePrivateItems).toHaveBeenCalledWith([PREF_KEY, DISMISSED_KEY]);
    expect(mocks.storage.has(PREF_KEY)).toBe(false);
    expect(mocks.storage.has(DISMISSED_KEY)).toBe(false);
  });

  it.each([
    [
      currentPreferences(),
      JSON.stringify({ version: 2, values: [] }),
      REC_DISMISSED_UNSUPPORTED_VERSION,
    ],
    [
      JSON.stringify({ version: 2, preferences: {} }),
      JSON.stringify({ version: 1, values: ['gap:spf'] }),
      REC_PREFERENCES_UNSUPPORTED_VERSION,
    ],
  ] as const)(
    'preserves every key when either recommendation domain has a future version',
    async (preferences, dismissed, expectedError) => {
      mocks.storage.set(PREF_KEY, preferences);
      mocks.storage.set(DISMISSED_KEY, dismissed);

      await expect(clearRecState()).rejects.toThrow(expectedError);

      expect(privateKV.multiRemovePrivateItems).not.toHaveBeenCalled();
      expect(mocks.storage.get(PREF_KEY)).toBe(preferences);
      expect(mocks.storage.get(DISMISSED_KEY)).toBe(dismissed);
    },
  );

  it('preserves every key when either recommendation domain is unavailable', async () => {
    const preferences = currentPreferences();
    const dismissed = JSON.stringify({ version: 1, values: ['gap:spf'] });
    mocks.storage.set(PREF_KEY, preferences);
    mocks.storage.set(DISMISSED_KEY, dismissed);
    mocks.readOverrides.set(DISMISSED_KEY, {
      status: 'unavailable',
      reason: 'storage_unavailable',
    });

    await expect(clearRecState()).rejects.toThrow(REC_DISMISSED_UNAVAILABLE);

    expect(privateKV.multiRemovePrivateItems).not.toHaveBeenCalled();
    expect(mocks.storage.get(PREF_KEY)).toBe(preferences);
    expect(mocks.storage.get(DISMISSED_KEY)).toBe(dismissed);
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

  it('serializes mirrors so an older preference upsert cannot finish last', async () => {
    const firstResponse = deferred<{ error: null }>();
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'owner-a' } } });
    mocks.abortSignal
      .mockImplementationOnce(() => firstResponse.promise)
      .mockResolvedValue({ error: null });
    const scope = ownerScope();

    await savePreferences(scope, { values: ['vegan'], budget: 'mid', formats: ['gel'] });
    await vi.waitFor(() => expect(mocks.upsert).toHaveBeenCalledTimes(1));
    await savePreferences(scope, {
      values: ['fragrance_free'],
      budget: 'premium',
      formats: ['cream'],
    });
    expect(mocks.upsert).toHaveBeenCalledTimes(1);

    firstResponse.resolve({ error: null });
    await vi.waitFor(() => expect(mocks.upsert).toHaveBeenCalledTimes(2));
    await waitForAccountGenerationOperationsToSettle();

    expect(mocks.upsert.mock.calls.map(([value]) => value)).toEqual([
      {
        user_id: 'owner-a',
        values_filters: ['vegan'],
        budget_band: 'mid',
        format_prefs: ['gel'],
      },
      {
        user_id: 'owner-a',
        values_filters: ['fragrance_free'],
        budget_band: 'premium',
        format_prefs: ['cream'],
      },
    ]);
  });

  it('drops queued owner-A mirrors after an A-to-B boundary', async () => {
    const firstResponse = deferred<{ error: null }>();
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'owner-a' } } });
    mocks.abortSignal.mockImplementationOnce(() => firstResponse.promise);
    const scopeA = ownerScope();

    await savePreferences(scopeA, { values: ['vegan'], budget: 'mid', formats: ['gel'] });
    await vi.waitFor(() => expect(mocks.upsert).toHaveBeenCalledTimes(1));
    await savePreferences(scopeA, {
      values: ['fragrance_free'],
      budget: 'premium',
      formats: ['cream'],
    });
    expect(mocks.upsert).toHaveBeenCalledTimes(1);

    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    firstResponse.resolve({ error: null });
    await waitForAccountGenerationOperationsToSettle();

    expect(mocks.getUser).toHaveBeenCalledTimes(1);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
  });

  it('releases a queued mirror after the prior mirror returns an error', async () => {
    const firstResponse = deferred<{ error: { message: string } }>();
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'owner-a' } } });
    mocks.abortSignal
      .mockImplementationOnce(() => firstResponse.promise)
      .mockResolvedValue({ error: null });
    const scope = ownerScope();

    await savePreferences(scope, { values: ['vegan'], budget: 'mid', formats: ['gel'] });
    await vi.waitFor(() => expect(mocks.upsert).toHaveBeenCalledTimes(1));
    await savePreferences(scope, {
      values: ['fragrance_free'],
      budget: 'premium',
      formats: ['cream'],
    });

    firstResponse.resolve({ error: { message: 'offline' } });
    await vi.waitFor(() => expect(mocks.upsert).toHaveBeenCalledTimes(2));
    await waitForAccountGenerationOperationsToSettle();

    expect(mocks.upsert.mock.calls.at(-1)?.[0]).toEqual({
      user_id: 'owner-a',
      values_filters: ['fragrance_free'],
      budget_band: 'premium',
      format_prefs: ['cream'],
    });
  });

  it('keeps committed local preferences when the best-effort mirror returns an error', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'owner-a' } } });
    mocks.abortSignal.mockResolvedValue({ error: { message: 'offline' } });

    await expect(
      savePreferences(ownerScope(), { values: ['vegan'], budget: 'mid', formats: ['gel'] }),
    ).resolves.toBeUndefined();
    await waitForAccountGenerationOperationsToSettle();
    await expect(loadPreferences()).resolves.toEqual({
      values: ['vegan'],
      budget: 'mid',
      formats: ['gel'],
    });
  });

  it('keeps prior recommendation state intact on atomic write failure', async () => {
    await savePreferences(ownerScope(), {
      values: ['vegan'],
      budget: 'mid',
      formats: ['gel'],
    });
    await dismissRecommendation(ownerScope(), 'gap:spf');
    const preferences = mocks.storage.get(PREF_KEY);
    const dismissed = mocks.storage.get(DISMISSED_KEY);
    mocks.updateFailure = new Error('PRIVATE_WRITE_FAILED');

    await expect(savePreferences(ownerScope(), DEFAULTS)).rejects.toThrow('PRIVATE_WRITE_FAILED');
    await expect(dismissRecommendation(ownerScope(), 'gap:cleanser')).rejects.toThrow(
      'PRIVATE_WRITE_FAILED',
    );
    expect(mocks.storage.get(PREF_KEY)).toBe(preferences);
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
