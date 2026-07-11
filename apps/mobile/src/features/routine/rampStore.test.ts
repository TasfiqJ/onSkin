import { beforeEach, describe, expect, it, vi } from 'vitest';

import { localDateString } from '@/features/today/useToday';

import { applyToleranceToRamps, ensureRamp, getStoredRamps } from './rampStore';

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

  it('preserves malformed prior state instead of overwriting it on a write path', async () => {
    const malformed = JSON.stringify(['bad']);
    mocks.storage.set(KEY, malformed);

    await expect(
      ensureRamp('retinol', { freqPerWeek: 2, targetPerWeek: 3, toleranceState: 'building' }),
    ).rejects.toThrow('RAMP_STATE_INVALID');

    expect(mocks.storage.get(KEY)).toBe(malformed);
  });

  it('does not lower an irritation-paused ramp again when a retry repeats the answer', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify({
        retinol: {
          freqPerWeek: 3,
          targetPerWeek: 4,
          toleranceState: 'building',
          startedAt: localDateString(),
          lastStepUp: null,
        },
      }),
    );

    await applyToleranceToRamps('irritated');
    await applyToleranceToRamps('irritated');

    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}').retinol).toMatchObject({
      freqPerWeek: 2,
      targetPerWeek: 4,
      toleranceState: 'paused_irritation',
    });
  });
});
