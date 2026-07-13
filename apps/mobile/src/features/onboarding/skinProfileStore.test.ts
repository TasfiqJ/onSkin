import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getStoredSkinProfile,
  isOnboardedLocal,
  readStoredSkinProfile,
  setStoredSkinProfile,
  SKIN_PROFILE_INVALID,
  SKIN_PROFILE_UNSUPPORTED_VERSION,
  type StoredSkinProfile,
  updateStoredPregnancyStatus,
} from './skinProfileStore';
import type { SkinProfileResult } from './quiz';

const mocks = vi.hoisted(() => {
  const storage = new Map<string, string>();
  return {
    storage,
    getPrivateItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    tails: new Map<string, Promise<void>>(),
    updateFailure: null as Error | null,
  };
});

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: mocks.getPrivateItem,
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.storage.delete(key);
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

const KEY = 'onskin.skinprofile.v1';
const RESULT: SkinProfileResult = {
  axes: {
    oily_dry: 0.25,
    sensitive_resistant: 0.75,
    pigmented_non: 0.5,
    wrinkled_tight: 0.4,
  },
  axisScores: {
    oily_dry: -2,
    sensitive_resistant: 2,
    pigmented_non: 0,
    wrinkled_tight: -1,
  },
  dspt: 'DSNT',
  fitzpatrick: 3,
  monkTone: 5,
  sensitivities: ['fragrance'],
  pregnancyStatus: 'none',
};

describe('skin profile local onboarding gate store', () => {
  beforeEach(() => {
    mocks.storage.clear();
    mocks.getPrivateItem.mockReset();
    mocks.getPrivateItem.mockImplementation(async (key: string) => mocks.storage.get(key) ?? null);
    mocks.tails.clear();
    mocks.updateFailure = null;
  });

  it('preserves malformed skin profile JSON for explicit recovery', async () => {
    mocks.storage.set(KEY, '{not-json');

    await expect(getStoredSkinProfile()).resolves.toBeNull();
    await expect(isOnboardedLocal()).resolves.toBe(false);
    expect(mocks.storage.get(KEY)).toBe('{not-json');
    await expect(readStoredSkinProfile()).resolves.toEqual({ status: 'invalid', profile: null });
  });

  it('preserves wrong-shaped skin profile records for explicit recovery', async () => {
    mocks.storage.set(KEY, JSON.stringify({ goals: ['clear_skin'], completedAt: '2026-07-07' }));

    await expect(getStoredSkinProfile()).resolves.toBeNull();
    expect(mocks.storage.has(KEY)).toBe(true);
  });

  it('normalizes goals and sensitivities before marking onboarding complete', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify({
        result: {
          ...RESULT,
          dspt: ' dsnt ',
          sensitivities: [' fragrance ', '', 'fragrance', false],
          pregnancyStatus: ' none ',
        },
        goals: [' clear_skin ', 'bad-goal', 'clear_skin', 'hydration'],
        completedAt: '2026-07-07T00:00:00.000Z',
      }),
    );

    await expect(getStoredSkinProfile()).resolves.toMatchObject({
      result: { dspt: 'DSNT', sensitivities: ['fragrance'], pregnancyStatus: 'none' },
      goals: ['clear_skin', 'hydration'],
      completedAt: '2026-07-07T00:00:00.000Z',
    });
    await expect(isOnboardedLocal()).resolves.toBe(true);
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
      result: { dspt: ' dsnt ' },
      goals: [' clear_skin ', 'bad-goal', 'clear_skin', 'hydration'],
    });
  });

  it('rejects invalid DSPT codes instead of inventing a profile', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify({
        result: { ...RESULT, dspt: 'XXXX' },
        goals: ['clear_skin'],
        completedAt: '2026-07-07T00:00:00.000Z',
      }),
    );

    await expect(getStoredSkinProfile()).resolves.toBeNull();
    await expect(isOnboardedLocal()).resolves.toBe(false);
    expect(mocks.storage.has(KEY)).toBe(true);
  });

  it('rejects records with no approved onboarding goals', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify({
        result: RESULT,
        goals: ['bad-goal'],
        completedAt: '2026-07-07T00:00:00.000Z',
      }),
    );

    await expect(getStoredSkinProfile()).resolves.toBeNull();
    await expect(isOnboardedLocal()).resolves.toBe(false);
    expect(mocks.storage.has(KEY)).toBe(true);
  });

  it('distinguishes a private-storage read failure from an absent profile', async () => {
    mocks.getPrivateItem.mockRejectedValueOnce(new Error('secure storage unavailable'));

    await expect(readStoredSkinProfile()).resolves.toEqual({
      status: 'unavailable',
      profile: null,
    });
    await expect(readStoredSkinProfile()).resolves.toEqual({ status: 'missing', profile: null });
  });

  it('saves only valid skin profile records', async () => {
    await setStoredSkinProfile({
      result: RESULT,
      goals: ['clear_skin'],
      completedAt: '2026-07-07T00:00:00.000Z',
    });

    await expect(getStoredSkinProfile()).resolves.toMatchObject({
      result: RESULT,
      goals: ['clear_skin'],
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
      version: 1,
      profile: { result: RESULT, goals: ['clear_skin'] },
    });
  });

  it('updates pregnancy status without changing the rest of the local profile', async () => {
    await setStoredSkinProfile({
      result: RESULT,
      goals: ['clear_skin'],
      completedAt: '2026-07-07T00:00:00.000Z',
    });

    await expect(updateStoredPregnancyStatus('breastfeeding')).resolves.toMatchObject({
      result: { ...RESULT, pregnancyStatus: 'breastfeeding' },
      goals: ['clear_skin'],
      completedAt: '2026-07-07T00:00:00.000Z',
    });
    await expect(getStoredSkinProfile()).resolves.toMatchObject({
      result: { pregnancyStatus: 'breastfeeding' },
    });
  });

  it('refuses a status update when the authoritative local profile is unavailable', async () => {
    await expect(updateStoredPregnancyStatus('pregnant')).rejects.toThrow(
      'SKIN_PROFILE_UNAVAILABLE',
    );
  });

  it('preserves future-version and malformed current-envelope bytes', async () => {
    const validProfile: StoredSkinProfile = {
      result: RESULT,
      goals: ['clear_skin'],
      completedAt: '2026-07-07T00:00:00.000Z',
    };
    for (const [raw, status, code] of [
      [
        JSON.stringify({ version: 2, profile: validProfile }),
        'unsupported_version',
        SKIN_PROFILE_UNSUPPORTED_VERSION,
      ],
      [
        JSON.stringify({ version: 1, profile: { ...validProfile, extra: true } }),
        'invalid',
        SKIN_PROFILE_INVALID,
      ],
    ] as const) {
      mocks.storage.set(KEY, raw);

      await expect(readStoredSkinProfile()).resolves.toEqual({ status, profile: null });
      await expect(setStoredSkinProfile(validProfile)).rejects.toThrow(code);
      await expect(updateStoredPregnancyStatus('pregnant')).rejects.toThrow(code);
      expect(mocks.storage.get(KEY)).toBe(raw);
    }
  });

  it('serializes a profile replacement and pregnancy edit without stale read overwrite', async () => {
    await setStoredSkinProfile({
      result: RESULT,
      goals: ['clear_skin'],
      completedAt: '2026-07-07T00:00:00.000Z',
    });

    await Promise.all([
      setStoredSkinProfile({
        result: RESULT,
        goals: ['hydration'],
        completedAt: '2026-07-08T00:00:00.000Z',
      }),
      updateStoredPregnancyStatus('breastfeeding'),
    ]);

    await expect(getStoredSkinProfile()).resolves.toMatchObject({
      result: { pregnancyStatus: 'breastfeeding' },
      goals: ['hydration'],
      completedAt: '2026-07-08T00:00:00.000Z',
    });
  });

  it('keeps the prior profile intact when an atomic write fails', async () => {
    await setStoredSkinProfile({
      result: RESULT,
      goals: ['clear_skin'],
      completedAt: '2026-07-07T00:00:00.000Z',
    });
    const original = mocks.storage.get(KEY);
    mocks.updateFailure = new Error('PRIVATE_WRITE_FAILED');

    await expect(updateStoredPregnancyStatus('pregnant')).rejects.toThrow('PRIVATE_WRITE_FAILED');

    expect(mocks.storage.get(KEY)).toBe(original);
  });
});
