import { beforeEach, describe, expect, it, vi } from 'vitest';

import { localDateString } from '@/features/today/useToday';

import { ensureRamp, getStoredRamps } from './rampStore';

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

const KEY = 'onskin.ramp.v1';

describe('routine ramp persistence', () => {
  beforeEach(() => {
    mocks.storage.clear();
  });

  it('removes unreadable ramp state and returns an empty log', async () => {
    mocks.storage.set(KEY, '{not-json');

    await expect(getStoredRamps()).resolves.toEqual({});
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('keeps valid ramp entries while dropping malformed product records', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify({
        retinol: {
          freqPerWeek: 2,
          targetPerWeek: 3,
          toleranceState: 'building',
          startedAt: '2026-01-01',
          lastStepUp: null,
        },
        acid: {
          freqPerWeek: 8,
          targetPerWeek: 3,
          toleranceState: 'fast',
          startedAt: 'soon',
        },
      }),
    );

    await expect(getStoredRamps()).resolves.toEqual({
      retinol: {
        freqPerWeek: 2,
        targetPerWeek: 3,
        toleranceState: 'building',
        startedAt: '2026-01-01',
        lastStepUp: null,
      },
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      retinol: {
        freqPerWeek: 2,
        targetPerWeek: 3,
        toleranceState: 'building',
        startedAt: '2026-01-01',
        lastStepUp: null,
      },
    });
  });

  it('seeds a clean ramp after malformed local state', async () => {
    mocks.storage.set(KEY, JSON.stringify(['bad']));

    await expect(
      ensureRamp('retinol', { freqPerWeek: 2, targetPerWeek: 3, toleranceState: 'building' }),
    ).resolves.toMatchObject({
      freqPerWeek: 2,
      targetPerWeek: 3,
      toleranceState: 'building',
      startedAt: localDateString(),
      lastStepUp: null,
    });

    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toHaveProperty('retinol');
  });
});
