import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { localDateString } from '@/features/today/useToday';
import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';
import { ROUTINE_CADENCE_MUTATION_ADMISSION_CLOSED } from '@/features/scheduler/cycleStore';

import {
  applyToleranceToRamps,
  clearRamps,
  ensureRamp,
  getStoredRamps,
  RAMP_STATE_INVALID,
  RAMP_STATE_UNSUPPORTED_VERSION,
  stepUpRamp,
} from './rampStore';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  tails: new Map<string, Promise<void>>(),
  updateFailure: null as Error | null,
  updatePrivateItem: vi.fn(),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.storage.delete(key);
  }),
  updatePrivateItem: mocks.updatePrivateItem,
}));

const KEY = 'onskin.ramp.v1';
const runtime = globalThis as { __DEV__?: boolean };
const originalDev = runtime.__DEV__;

describe('routine ramp persistence', () => {
  beforeEach(() => {
    runtime.__DEV__ = true;
    delete process.env.EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE;
    process.env.EXPO_PUBLIC_E2E_ROUTINE_RECOVERY_REVIEW_GATE = 'open_fixture';
    mocks.storage.clear();
    mocks.tails.clear();
    mocks.updateFailure = null;
    mocks.updatePrivateItem.mockReset();
    mocks.updatePrivateItem.mockImplementation(
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
    );
    setActiveHealthProcessingEpoch(1, { ownerUserId: 'user-a', accountGeneration: 0 });
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE;
    delete process.env.EXPO_PUBLIC_E2E_ROUTINE_RECOVERY_REVIEW_GATE;
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
  });

  it('refuses ramp writes before private storage when cadence admission is closed', async () => {
    const before = JSON.stringify({
      version: 1,
      ramps: {
        retinol: {
          freqPerWeek: 2,
          targetPerWeek: 3,
          toleranceState: 'building',
          startedAt: localDateString(),
          lastStepUp: null,
        },
      },
    });
    mocks.storage.set(KEY, before);
    process.env.EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE = 'closed';

    const mutations: (() => Promise<unknown>)[] = [
      () =>
        ensureRamp('acid', {
          freqPerWeek: 1,
          targetPerWeek: 2,
          toleranceState: 'building',
        }),
      () => stepUpRamp('retinol'),
      () => applyToleranceToRamps('comfortable'),
    ];

    for (const mutate of mutations) {
      await expect(mutate()).rejects.toThrow(ROUTINE_CADENCE_MUTATION_ADMISSION_CLOSED);
    }

    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.storage.get(KEY)).toBe(before);
  });

  it('preserves unreadable ramp state and returns a fail-closed empty view', async () => {
    const original = '{not-json';
    mocks.storage.set(KEY, original);

    await expect(getStoredRamps()).resolves.toEqual({});
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('rejects the whole malformed log without dropping individual product records', async () => {
    const original = JSON.stringify({
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
    });
    mocks.storage.set(KEY, original);

    await expect(getStoredRamps()).resolves.toEqual({});
    await expect(
      ensureRamp('vitamin-c', { freqPerWeek: 2, targetPerWeek: 3, toleranceState: 'building' }),
    ).rejects.toThrow(RAMP_STATE_INVALID);
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('preserves malformed prior state instead of overwriting it on a write path', async () => {
    const malformed = JSON.stringify(['bad']);
    mocks.storage.set(KEY, malformed);

    await expect(
      ensureRamp('retinol', { freqPerWeek: 2, targetPerWeek: 3, toleranceState: 'building' }),
    ).rejects.toThrow(RAMP_STATE_INVALID);

    expect(mocks.storage.get(KEY)).toBe(malformed);
  });

  it('preserves future-version bytes and refuses to downgrade them', async () => {
    const original = JSON.stringify({ version: 2, ramps: {} });
    mocks.storage.set(KEY, original);

    await expect(getStoredRamps()).resolves.toEqual({});
    await expect(
      ensureRamp('retinol', { freqPerWeek: 2, targetPerWeek: 3, toleranceState: 'building' }),
    ).rejects.toThrow(RAMP_STATE_UNSUPPORTED_VERSION);

    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('serializes simultaneous product seeds without losing a writer', async () => {
    const productIds = Array.from({ length: 30 }, (_, index) => `product-${index}`);

    await Promise.all(
      productIds.map((productId) =>
        ensureRamp(productId, {
          freqPerWeek: 2,
          targetPerWeek: 4,
          toleranceState: 'building',
        }),
      ),
    );

    const stored = await getStoredRamps();
    expect(Object.keys(stored)).toHaveLength(productIds.length);
    expect(new Set(Object.keys(stored))).toEqual(new Set(productIds));
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({ version: 1 });
  });

  it('leaves the prior envelope intact when an atomic write fails', async () => {
    await ensureRamp('retinol', {
      freqPerWeek: 2,
      targetPerWeek: 4,
      toleranceState: 'building',
    });
    const original = mocks.storage.get(KEY);
    mocks.updateFailure = new Error('PRIVATE_WRITE_FAILED');

    await expect(stepUpRamp('retinol')).rejects.toThrow('PRIVATE_WRITE_FAILED');

    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('does not lower an irritation-paused ramp again when a retry repeats the answer', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify({
        version: 1,
        ramps: {
          retinol: {
            freqPerWeek: 3,
            targetPerWeek: 4,
            toleranceState: 'building',
            startedAt: localDateString(),
            lastStepUp: null,
          },
        },
      }),
    );

    await applyToleranceToRamps('irritated');
    await applyToleranceToRamps('irritated');

    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}').ramps.retinol).toMatchObject({
      freqPerWeek: 2,
      targetPerWeek: 4,
      toleranceState: 'paused_irritation',
    });
  });

  it('keeps valid legacy logs readable until an explicit mutation migrates them', async () => {
    const legacy = JSON.stringify({
      retinol: {
        freqPerWeek: 3,
        targetPerWeek: 4,
        toleranceState: 'building',
        startedAt: '2026-01-01',
        lastStepUp: null,
      },
    });
    mocks.storage.set(KEY, legacy);

    await expect(getStoredRamps()).resolves.toMatchObject({ retinol: { freqPerWeek: 3 } });
    expect(mocks.storage.get(KEY)).toBe(legacy);

    await stepUpRamp('retinol');

    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
      version: 1,
      ramps: { retinol: { freqPerWeek: 4 } },
    });
  });

  it('clears ramp bytes after health processing closes', async () => {
    mocks.storage.set(KEY, JSON.stringify({ version: 1, ramps: {} }));
    process.env.EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE = 'closed';
    clearActiveHealthProcessingEpoch();

    await clearRamps();

    expect(mocks.storage.has(KEY)).toBe(false);
  });
});
