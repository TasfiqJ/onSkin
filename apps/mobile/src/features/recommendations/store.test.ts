import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  getAccountGeneration,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';
import { OUTBOX_STORAGE_KEY, decodeOutboxEnvelope } from '@/lib/offline/outbox.pure';
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
  REC_PREFERENCES_WRITE_UNCERTAIN,
  savePreferences,
} from './store';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  readOverrides: new Map<string, unknown>(),
  readError: null as Error | null,
  tails: new Map<string, Promise<void>>(),
  updateFailure: null as Error | null,
  transactionFailureBeforeTransform: null as Error | null,
  transactionFailureAfterTransform: null as Error | null,
  transactionFailureAfterCommit: null as Error | null,
  writes: 0,
  nextUuid: 1,
  digestStringAsync: vi.fn(),
  randomUUID: vi.fn(),
  scheduleOutboxFlush: vi.fn(),
}));

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: mocks.digestStringAsync,
  randomUUID: mocks.randomUUID,
}));

vi.mock('@/lib/offline/outbox', () => ({
  scheduleOutboxFlush: mocks.scheduleOutboxFlush,
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
  updatePrivateItemsTransactionally: vi.fn(
    async (
      keys: readonly string[],
      updater: (current: ReadonlyMap<string, string | null>) => ReadonlyMap<string, string | null>,
    ) => {
      const queueKey = 'transaction';
      const previous = mocks.tails.get(queueKey) ?? Promise.resolve();
      let release!: () => void;
      const tail = new Promise<void>((resolve) => {
        release = resolve;
      });
      mocks.tails.set(queueKey, tail);
      await previous;
      try {
        if (mocks.transactionFailureBeforeTransform) throw mocks.transactionFailureBeforeTransform;
        const current = new Map(keys.map((key) => [key, mocks.storage.get(key) ?? null]));
        const next = updater(current);
        if (mocks.transactionFailureAfterTransform) throw mocks.transactionFailureAfterTransform;
        for (const key of keys) {
          const value = next.get(key) ?? null;
          if (value === current.get(key)) continue;
          mocks.writes += 1;
          if (value === null) mocks.storage.delete(key);
          else mocks.storage.set(key, value);
        }
        if (mocks.transactionFailureAfterCommit) throw mocks.transactionFailureAfterCommit;
      } finally {
        release();
        if (mocks.tails.get(queueKey) === tail) mocks.tails.delete(queueKey);
      }
    },
  ),
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
    mocks.transactionFailureBeforeTransform = null;
    mocks.transactionFailureAfterTransform = null;
    mocks.transactionFailureAfterCommit = null;
    mocks.writes = 0;
    mocks.nextUuid = 1;
    mocks.digestStringAsync.mockReset();
    mocks.digestStringAsync.mockResolvedValue('a'.repeat(64));
    mocks.randomUUID.mockReset();
    mocks.randomUUID.mockImplementation(
      () => `00000000-0000-4000-8000-${(mocks.nextUuid++).toString(16).padStart(12, '0')}`,
    );
    mocks.scheduleOutboxFlush.mockClear();
    vi.mocked(privateKV.readPrivateItem).mockClear();
    vi.mocked(privateKV.multiRemovePrivateItems).mockClear();
    vi.mocked(privateKV.updatePrivateItem).mockClear();
    vi.mocked(privateKV.updatePrivateItemsTransactionally).mockClear();
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
    expect(mocks.scheduleOutboxFlush).not.toHaveBeenCalled();

    await savePreferences(scope, {
      values: ['fragrance_free'],
      budget: 'mid',
      formats: ['cream'],
    });
    await waitForAccountGenerationOperationsToSettle();
    expect(mocks.writes).toBe(1);
    expect(mocks.scheduleOutboxFlush).not.toHaveBeenCalled();
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
    expect(mocks.scheduleOutboxFlush).not.toHaveBeenCalled();
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
    expect(mocks.scheduleOutboxFlush).not.toHaveBeenCalled();
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
    expect(mocks.scheduleOutboxFlush).not.toHaveBeenCalled();
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
    expect(mocks.scheduleOutboxFlush).not.toHaveBeenCalled();
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

  it('atomically commits an authenticated preference snapshot and sanitized outbox intent', async () => {
    await expect(
      savePreferences(
        ownerScope(),
        { values: ['vegan'], budget: 'mid', formats: ['gel'] },
        'owner-a',
      ),
    ).resolves.toBeUndefined();

    expect(JSON.parse(mocks.storage.get(PREF_KEY) ?? '{}')).toEqual({
      version: 1,
      preferences: { values: ['vegan'], budget: 'mid', formats: ['gel'] },
    });
    const outbox = decodeOutboxEnvelope(mocks.storage.get(OUTBOX_STORAGE_KEY) ?? null);
    expect(outbox.rows).toHaveLength(1);
    expect(outbox.rows[0]).toMatchObject({
      entityType: 'recommendation_preferences',
      ownerGeneration: getAccountGeneration(),
      operationKind: 'upsert',
      clientRevision: 1,
      payload: {
        values_filters: ['vegan'],
        budget_band: 'mid',
        format_prefs: ['gel'],
      },
    });
    expect(JSON.stringify(outbox.rows[0]?.payload)).not.toMatch(
      /user_id|owner|commission|affiliate|ranking/i,
    );
    expect(privateKV.updatePrivateItemsTransactionally).toHaveBeenCalledWith(
      [PREF_KEY, OUTBOX_STORAGE_KEY],
      expect.any(Function),
    );
    expect(mocks.scheduleOutboxFlush).toHaveBeenCalledOnce();
  });

  it('keeps an authenticated semantic legacy no-op byte-identical and queues nothing', async () => {
    const legacy = JSON.stringify({ values: ['vegan'], budget: 'mid', formats: ['gel'] });
    mocks.storage.set(PREF_KEY, legacy);

    await savePreferences(
      ownerScope(),
      { values: ['vegan'], budget: 'mid', formats: ['gel'] },
      'owner-a',
    );

    expect(mocks.storage.get(PREF_KEY)).toBe(legacy);
    expect(mocks.storage.has(OUTBOX_STORAGE_KEY)).toBe(false);
    expect(mocks.writes).toBe(0);
    expect(mocks.scheduleOutboxFlush).not.toHaveBeenCalled();
  });

  it('coalesces 100 authenticated saves into the latest full preference snapshot', async () => {
    const snapshots: Parameters<typeof savePreferences>[1][] = Array.from(
      { length: 100 },
      (_, index) => ({
        values: index % 2 === 0 ? ['vegan'] : ['fragrance_free'],
        budget: index % 3 === 0 ? ('drugstore' as const) : ('premium' as const),
        formats: [`format-${index}`],
      }),
    );
    const scope = ownerScope();

    await Promise.all(snapshots.map((snapshot) => savePreferences(scope, snapshot, 'owner-a')));

    expect(JSON.parse(mocks.storage.get(PREF_KEY) ?? '{}')).toEqual({
      version: 1,
      preferences: snapshots.at(-1),
    });
    const outbox = decodeOutboxEnvelope(mocks.storage.get(OUTBOX_STORAGE_KEY) ?? null);
    expect(outbox.rows).toHaveLength(1);
    expect(outbox.rows[0]).toMatchObject({
      entityType: 'recommendation_preferences',
      clientRevision: 100,
      payload: {
        values_filters: snapshots.at(-1)?.values,
        budget_band: snapshots.at(-1)?.budget,
        format_prefs: snapshots.at(-1)?.formats,
      },
    });
    expect(mocks.scheduleOutboxFlush).toHaveBeenCalledTimes(100);
  });

  it('preserves invocation order when the first native owner hash is delayed', async () => {
    const firstHash = deferred<string>();
    mocks.digestStringAsync
      .mockImplementationOnce(() => firstHash.promise)
      .mockResolvedValue('a'.repeat(64));
    const scope = ownerScope();
    const first = savePreferences(
      scope,
      { values: ['vegan'], budget: 'mid', formats: ['gel'] },
      'owner-a',
    );
    await vi.waitFor(() => expect(mocks.digestStringAsync).toHaveBeenCalledTimes(1));
    const second = savePreferences(
      scope,
      { values: ['sustainable'], budget: 'premium', formats: ['fluid'] },
      'owner-a',
    );
    await Promise.resolve();
    expect(mocks.digestStringAsync).toHaveBeenCalledTimes(1);

    firstHash.resolve('a'.repeat(64));
    await Promise.all([first, second]);

    expect(mocks.digestStringAsync).toHaveBeenCalledTimes(2);
    expect(JSON.parse(mocks.storage.get(PREF_KEY) ?? '{}')).toEqual({
      version: 1,
      preferences: { values: ['sustainable'], budget: 'premium', formats: ['fluid'] },
    });
    expect(
      decodeOutboxEnvelope(mocks.storage.get(OUTBOX_STORAGE_KEY) ?? null).rows[0]?.payload,
    ).toEqual({
      values_filters: ['sustainable'],
      budget_band: 'premium',
      format_prefs: ['fluid'],
    });
  });

  it('preserves both prior keys when an authenticated transaction cannot commit', async () => {
    const original = currentPreferences();
    mocks.storage.set(PREF_KEY, original);
    mocks.transactionFailureAfterTransform = new Error('PRIVATE_TRANSACTION_FAILED');

    await expect(savePreferences(ownerScope(), DEFAULTS, 'owner-a')).rejects.toThrow(
      REC_PREFERENCES_WRITE_UNCERTAIN,
    );

    expect(mocks.storage.get(PREF_KEY)).toBe(original);
    expect(mocks.storage.has(OUTBOX_STORAGE_KEY)).toBe(false);
    expect(mocks.writes).toBe(0);
    expect(mocks.scheduleOutboxFlush).not.toHaveBeenCalled();
  });

  it('confirms both exact values after an authenticated commit response is lost', async () => {
    mocks.transactionFailureAfterCommit = new Error('PRIVATE_WRITE_RESULT_UNKNOWN');

    await expect(
      savePreferences(
        ownerScope(),
        { values: ['sustainable'], budget: 'premium', formats: ['cream'] },
        'owner-a',
      ),
    ).resolves.toBeUndefined();

    expect(privateKV.readPrivateItem).toHaveBeenCalledTimes(2);
    await expect(loadPreferences()).resolves.toEqual({
      values: ['sustainable'],
      budget: 'premium',
      formats: ['cream'],
    });
    expect(decodeOutboxEnvelope(mocks.storage.get(OUTBOX_STORAGE_KEY) ?? null).rows).toHaveLength(
      1,
    );
    expect(mocks.scheduleOutboxFlush).toHaveBeenCalledOnce();
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
      savePreferences(
        staleScope,
        { values: ['vegan'], budget: 'mid', formats: ['gel'] },
        'owner-a',
      ),
    ).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    await expect(dismissRecommendation(staleScope, 'gap:spf')).rejects.toMatchObject({
      code: 'ACCOUNT_GENERATION_CHANGED',
    });
    expect(mocks.storage.has(PREF_KEY)).toBe(false);
    expect(mocks.storage.has(DISMISSED_KEY)).toBe(false);
    expect(mocks.scheduleOutboxFlush).not.toHaveBeenCalled();
  });
});
