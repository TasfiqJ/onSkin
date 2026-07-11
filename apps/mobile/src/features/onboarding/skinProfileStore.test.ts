import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getStoredSkinProfile,
  isOnboardedLocal,
  readStoredSkinProfile,
  setStoredSkinProfile,
  updateStoredPregnancyStatus,
} from './skinProfileStore';
import type { SkinProfileResult } from './quiz';

const mocks = vi.hoisted(() => {
  const storage = new Map<string, string>();
  return {
    storage,
    getPrivateItem: vi.fn(async (key: string) => storage.get(key) ?? null),
  };
});

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: mocks.getPrivateItem,
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    mocks.storage.set(key, value);
  }),
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.storage.delete(key);
  }),
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
      result: { dspt: 'DSNT', sensitivities: ['fragrance'], pregnancyStatus: 'none' },
      goals: ['clear_skin', 'hydration'],
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
});
