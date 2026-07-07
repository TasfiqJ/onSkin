import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getStoredSkinProfile, isOnboardedLocal, setStoredSkinProfile } from './skinProfileStore';
import type { SkinProfileResult } from './quiz';

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
  });

  it('removes malformed skin profile JSON', async () => {
    mocks.storage.set(KEY, '{not-json');

    await expect(getStoredSkinProfile()).resolves.toBeNull();
    await expect(isOnboardedLocal()).resolves.toBe(false);
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('removes wrong-shaped skin profile records', async () => {
    mocks.storage.set(KEY, JSON.stringify({ goals: ['clear_skin'], completedAt: '2026-07-07' }));

    await expect(getStoredSkinProfile()).resolves.toBeNull();
    expect(mocks.storage.has(KEY)).toBe(false);
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
    expect(mocks.storage.has(KEY)).toBe(false);
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
    expect(mocks.storage.has(KEY)).toBe(false);
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
});
