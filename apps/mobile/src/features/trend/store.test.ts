import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearTrendStore,
  deleteTrendState,
  readTrendInsightsLocal,
  setTrendInsightsLocal,
} from './store';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
  readPrivateItem: vi.fn(async (key: string) => {
    const value = mocks.storage.get(key);
    return value === undefined ? { status: 'absent' } : { status: 'available', value };
  }),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    mocks.storage.set(key, value);
  }),
  updatePrivateItem: vi.fn(
    async (key: string, updater: (current: string | null) => string | null) => {
      const next = updater(mocks.storage.get(key) ?? null);
      if (next === null) mocks.storage.delete(key);
      else mocks.storage.set(key, next);
    },
  ),
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.storage.delete(key);
  }),
  multiRemovePrivateItems: vi.fn(async (keys: readonly string[]) => {
    for (const key of keys) mocks.storage.delete(key);
  }),
}));

const CONSENT_KEY = 'onskin.trendInsights.v1';
const STATE_KEY = 'onskin.trendState.v1';

describe('trend insight store', () => {
  beforeEach(() => {
    mocks.storage.clear();
  });

  it('reads legacy trend grants without repair and writes versioned flags', async () => {
    mocks.storage.set(CONSENT_KEY, 'TRUE');

    await expect(readTrendInsightsLocal()).resolves.toEqual({
      status: 'available',
      value: true,
      format: 'legacy',
    });
    expect(mocks.storage.get(CONSENT_KEY)).toBe('TRUE');

    await setTrendInsightsLocal(false);
    expect(mocks.storage.get(CONSENT_KEY)).toBe('v1:0');
  });

  it('classifies and preserves malformed trend consent values', async () => {
    mocks.storage.set(CONSENT_KEY, 'enabled');

    await expect(readTrendInsightsLocal()).resolves.toEqual({
      status: 'corrupt',
      reason: 'invalid_value',
    });

    expect(mocks.storage.get(CONSENT_KEY)).toBe('enabled');
  });

  it('deletes derived trend state without changing the consent gate', async () => {
    mocks.storage.set(CONSENT_KEY, '1');
    mocks.storage.set(STATE_KEY, 'derived-state');

    await deleteTrendState();

    expect(mocks.storage.get(CONSENT_KEY)).toBe('1');
    expect(mocks.storage.has(STATE_KEY)).toBe(false);
  });

  it('clears trend consent and derived trend state for seed/test reset', async () => {
    mocks.storage.set(CONSENT_KEY, '1');
    mocks.storage.set(STATE_KEY, 'derived-state');

    await clearTrendStore();

    expect(mocks.storage.has(CONSENT_KEY)).toBe(false);
    expect(mocks.storage.has(STATE_KEY)).toBe(false);
  });
});
