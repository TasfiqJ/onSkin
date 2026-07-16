import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as privateKV from '@/lib/storage/privateKV';

import { localDateString } from '@/features/today/useToday';

import {
  applyToleranceToRamps,
  ensureRamp,
  getStoredRamps,
  MAX_RAMP_PRODUCT_ID_CHARS,
  MAX_RAMP_RECORD_CHARS,
  MAX_RAMP_RECORDS,
  readStoredRamps,
  RAMP_STATE_INVALID,
  RAMP_STATE_STALE,
  RAMP_STATE_UNAVAILABLE,
  RAMP_STATE_UNSUPPORTED_VERSION,
  stepUpRamp,
} from './rampStore';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  tails: new Map<string, Promise<void>>(),
  readStatus: null as null | 'unavailable' | 'corrupt' | 'unsupported_version',
  updateFailure: null as Error | null,
  updateFailureAfterCommit: null as Error | null,
  persistedWrites: 0,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  readPrivateItem: vi.fn(async (key: string) => {
    if (mocks.readStatus === 'unavailable') {
      return { status: 'unavailable', reason: 'storage_unavailable' };
    }
    if (mocks.readStatus === 'corrupt') {
      return { status: 'corrupt', reason: 'decryption_failed' };
    }
    if (mocks.readStatus === 'unsupported_version') return { status: 'unsupported_version' };
    const value = mocks.storage.get(key);
    return value === undefined ? { status: 'absent' } : { status: 'available', value };
  }),
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
        const current = mocks.storage.get(key) ?? null;
        const next = updater(current);
        if (next !== current) {
          mocks.persistedWrites += 1;
          if (next === null) mocks.storage.delete(key);
          else mocks.storage.set(key, next);
        }
        if (mocks.updateFailureAfterCommit) throw mocks.updateFailureAfterCommit;
      } finally {
        release();
        if (mocks.tails.get(key) === tail) mocks.tails.delete(key);
      }
    },
  ),
}));

const KEY = 'onskin.ramp.v1';
const runtime = globalThis as typeof globalThis & { __DEV__?: boolean };
const originalDev = runtime.__DEV__;

describe('routine ramp persistence', () => {
  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_E2E_RAMP_STORAGE_FAILURE;
    mocks.storage.clear();
    mocks.tails.clear();
    mocks.readStatus = null;
    mocks.updateFailure = null;
    mocks.updateFailureAfterCommit = null;
    mocks.persistedWrites = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_E2E_RAMP_STORAGE_FAILURE;
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
  });

  it('distinguishes an absent ramp from private storage unavailability', async () => {
    await expect(readStoredRamps()).resolves.toEqual({ status: 'absent', ramps: {} });
    await expect(getStoredRamps()).resolves.toEqual({});

    mocks.readStatus = 'unavailable';
    await expect(readStoredRamps()).resolves.toEqual({ status: 'unavailable', ramps: null });
    await expect(getStoredRamps()).rejects.toThrow(RAMP_STATE_UNAVAILABLE);
  });

  it('exposes the dev-only unavailable fixture without consulting storage', async () => {
    runtime.__DEV__ = true;
    process.env.EXPO_PUBLIC_E2E_RAMP_STORAGE_FAILURE = 'always';

    await expect(readStoredRamps()).resolves.toEqual({ status: 'unavailable', ramps: null });

    expect(privateKV.readPrivateItem).not.toHaveBeenCalled();
  });

  it('ignores the unavailable fixture outside development builds', async () => {
    runtime.__DEV__ = false;
    process.env.EXPO_PUBLIC_E2E_RAMP_STORAGE_FAILURE = 'always';

    await expect(readStoredRamps()).resolves.toEqual({ status: 'absent', ramps: {} });

    expect(privateKV.readPrivateItem).toHaveBeenCalledWith(KEY);
  });

  it('makes the development one-shot failure recover on an explicit retry', async () => {
    runtime.__DEV__ = true;
    process.env.EXPO_PUBLIC_E2E_RAMP_STORAGE_FAILURE = 'once';

    await expect(readStoredRamps()).resolves.toEqual({ status: 'unavailable', ramps: null });
    await expect(readStoredRamps()).resolves.toEqual({ status: 'absent', ramps: {} });

    expect(privateKV.readPrivateItem).toHaveBeenCalledOnce();
  });

  it('preserves unreadable ramp state and reports typed corruption', async () => {
    const original = '{not-json';
    mocks.storage.set(KEY, original);

    await expect(readStoredRamps()).resolves.toEqual({ status: 'corrupt', ramps: null });
    await expect(getStoredRamps()).rejects.toThrow(RAMP_STATE_INVALID);
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

    await expect(readStoredRamps()).resolves.toEqual({ status: 'corrupt', ramps: null });
    await expect(getStoredRamps()).rejects.toThrow(RAMP_STATE_INVALID);
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

  it('rejects noncanonical legacy rows without inventing dates or dropping fields', async () => {
    const missingDates = JSON.stringify({
      retinol: {
        freqPerWeek: 2,
        targetPerWeek: 3,
        toleranceState: 'building',
      },
    });
    mocks.storage.set(KEY, missingDates);
    await expect(readStoredRamps()).resolves.toEqual({ status: 'corrupt', ramps: null });
    expect(mocks.storage.get(KEY)).toBe(missingDates);

    const extraField = JSON.stringify({
      retinol: {
        freqPerWeek: 2,
        targetPerWeek: 3,
        toleranceState: 'building',
        startedAt: '2026-01-01',
        lastStepUp: null,
        invented: true,
      },
    });
    mocks.storage.set(KEY, extraField);
    await expect(readStoredRamps()).resolves.toEqual({ status: 'corrupt', ramps: null });
    await expect(stepUpRamp('retinol', 3)).rejects.toThrow(RAMP_STATE_INVALID);
    expect(mocks.storage.get(KEY)).toBe(extraField);
    expect(mocks.persistedWrites).toBe(0);
  });

  it('preserves future-version bytes and refuses to downgrade them', async () => {
    const original = JSON.stringify({ version: 2, ramps: {} });
    mocks.storage.set(KEY, original);

    await expect(readStoredRamps()).resolves.toEqual({
      status: 'unsupported_version',
      ramps: null,
    });
    await expect(getStoredRamps()).rejects.toThrow(RAMP_STATE_UNSUPPORTED_VERSION);
    await expect(
      ensureRamp('retinol', { freqPerWeek: 2, targetPerWeek: 3, toleranceState: 'building' }),
    ).rejects.toThrow(RAMP_STATE_UNSUPPORTED_VERSION);

    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it.each([
    ['corrupt', '{not-json', RAMP_STATE_INVALID],
    ['future', JSON.stringify({ version: 2, ramps: {} }), RAMP_STATE_UNSUPPORTED_VERSION],
  ])('refuses every normal mutation over %s ramp bytes', async (_kind, original, errorCode) => {
    mocks.storage.set(KEY, original);

    await expect(stepUpRamp('retinol', 3)).rejects.toThrow(errorCode);
    expect(mocks.storage.get(KEY)).toBe(original);
    await expect(applyToleranceToRamps('comfortable')).rejects.toThrow(errorCode);
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('rejects invalid mutation input before private storage I/O', async () => {
    const oversizedId = 'x'.repeat(MAX_RAMP_PRODUCT_ID_CHARS + 1);

    await expect(
      ensureRamp(oversizedId, {
        freqPerWeek: 2,
        targetPerWeek: 3,
        toleranceState: 'building',
      }),
    ).rejects.toThrow(RAMP_STATE_INVALID);
    await expect(
      ensureRamp('retinol', {
        freqPerWeek: 8,
        targetPerWeek: 3,
        toleranceState: 'building',
      }),
    ).rejects.toThrow(RAMP_STATE_INVALID);
    await expect(stepUpRamp(oversizedId, 3)).rejects.toThrow(RAMP_STATE_INVALID);
    await expect(
      applyToleranceToRamps('unknown' as Parameters<typeof applyToleranceToRamps>[0]),
    ).rejects.toThrow(RAMP_STATE_INVALID);

    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.persistedWrites).toBe(0);
  });

  it('preserves oversized and over-limit current records as corruption', async () => {
    const oversized = 'x'.repeat(MAX_RAMP_RECORD_CHARS + 1);
    mocks.storage.set(KEY, oversized);
    await expect(readStoredRamps()).resolves.toEqual({ status: 'corrupt', ramps: null });
    await expect(stepUpRamp('retinol', 3)).rejects.toThrow(RAMP_STATE_INVALID);
    expect(mocks.storage.get(KEY)).toBe(oversized);

    const overLimit = JSON.stringify({
      version: 1,
      ramps: Object.fromEntries(
        Array.from({ length: MAX_RAMP_RECORDS + 1 }, (_, index) => [
          `product-${index}`,
          {
            freqPerWeek: 2,
            targetPerWeek: 3,
            toleranceState: 'building',
            startedAt: '2026-01-01',
            lastStepUp: null,
          },
        ]),
      ),
    });
    mocks.storage.set(KEY, overLimit);
    await expect(readStoredRamps()).resolves.toEqual({ status: 'corrupt', ramps: null });
    await expect(applyToleranceToRamps('a_bit_dry')).rejects.toThrow(RAMP_STATE_INVALID);
    expect(mocks.storage.get(KEY)).toBe(overLimit);
    expect(mocks.persistedWrites).toBe(0);
  });

  it('preserves a full valid log instead of evicting an existing ramp', async () => {
    const ramps = Object.fromEntries(
      Array.from({ length: MAX_RAMP_RECORDS }, (_, index) => [
        `product-${index}`,
        {
          freqPerWeek: 2,
          targetPerWeek: 3,
          toleranceState: 'building',
          startedAt: '2026-01-01',
          lastStepUp: null,
        },
      ]),
    );
    const original = JSON.stringify({ version: 1, ramps });
    mocks.storage.set(KEY, original);

    await expect(
      ensureRamp('product-over-limit', {
        freqPerWeek: 2,
        targetPerWeek: 3,
        toleranceState: 'building',
      }),
    ).rejects.toThrow(RAMP_STATE_INVALID);

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.persistedWrites).toBe(0);
  });

  it('serializes 100 simultaneous product seeds without losing a writer', async () => {
    const productIds = Array.from({ length: 100 }, (_, index) => `product-${index}`);

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
    expect(mocks.persistedWrites).toBe(100);
  });

  it('performs zero writes when ensure finds a current or legacy ramp', async () => {
    const ramp = {
      freqPerWeek: 2,
      targetPerWeek: 3,
      toleranceState: 'building',
      startedAt: '2026-01-01',
      lastStepUp: null,
    } as const;
    const current = JSON.stringify({ version: 1, ramps: { retinol: ramp } });
    mocks.storage.set(KEY, current);
    await expect(
      ensureRamp('retinol', {
        freqPerWeek: 7,
        targetPerWeek: 7,
        toleranceState: 'steady',
      }),
    ).resolves.toEqual(ramp);
    expect(mocks.storage.get(KEY)).toBe(current);
    expect(mocks.persistedWrites).toBe(0);

    const legacy = JSON.stringify({ retinol: ramp });
    mocks.storage.set(KEY, legacy);
    await expect(
      ensureRamp('retinol', {
        freqPerWeek: 7,
        targetPerWeek: 7,
        toleranceState: 'steady',
      }),
    ).resolves.toEqual(ramp);
    expect(mocks.storage.get(KEY)).toBe(legacy);
    expect(mocks.persistedWrites).toBe(0);
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

  it('retries an ambiguously committed desired step-up without a second write', async () => {
    await ensureRamp('retinol', {
      freqPerWeek: 2,
      targetPerWeek: 4,
      toleranceState: 'building',
    });
    mocks.updateFailureAfterCommit = new Error('PRIVATE_WRITE_RESULT_UNKNOWN');

    await expect(stepUpRamp('retinol', 3)).rejects.toThrow('PRIVATE_WRITE_RESULT_UNKNOWN');
    expect(mocks.persistedWrites).toBe(2);

    mocks.updateFailureAfterCommit = null;
    await expect(stepUpRamp('retinol', 3)).resolves.toBeUndefined();
    await expect(getStoredRamps()).resolves.toMatchObject({
      retinol: { freqPerWeek: 3, targetPerWeek: 4, toleranceState: 'steady' },
    });
    expect(mocks.persistedWrites).toBe(2);
  });

  it('retries one offered step-up idempotently at the exact desired frequency', async () => {
    await ensureRamp('retinol', {
      freqPerWeek: 2,
      targetPerWeek: 4,
      toleranceState: 'building',
    });

    await stepUpRamp('retinol', 3);
    const afterFirstStepUp = mocks.storage.get(KEY);
    await stepUpRamp('retinol', 3);

    await expect(getStoredRamps()).resolves.toMatchObject({
      retinol: { freqPerWeek: 3, targetPerWeek: 4, toleranceState: 'steady' },
    });
    expect(mocks.storage.get(KEY)).toBe(afterFirstStepUp);
    expect(mocks.persistedWrites).toBe(2);
  });

  it('never raises a paused ramp through the legacy no-desired-frequency API', async () => {
    await ensureRamp('retinol', {
      freqPerWeek: 1,
      targetPerWeek: 4,
      toleranceState: 'paused_irritation',
    });
    const original = mocks.storage.get(KEY);

    await expect(stepUpRamp('retinol')).rejects.toThrow(RAMP_STATE_STALE);

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.persistedWrites).toBe(1);
  });

  it('refuses a stale desired step-up after a concurrent de-escalation', async () => {
    await ensureRamp('retinol', {
      freqPerWeek: 1,
      targetPerWeek: 4,
      toleranceState: 'paused_irritation',
    });
    const original = mocks.storage.get(KEY);

    await expect(stepUpRamp('retinol', 3)).rejects.toThrow(RAMP_STATE_STALE);

    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('never raises an irritation-paused ramp from the one-night floor', async () => {
    await ensureRamp('retinol', {
      freqPerWeek: 1,
      targetPerWeek: 4,
      toleranceState: 'building',
    });
    await applyToleranceToRamps('irritated');
    const paused = mocks.storage.get(KEY);

    await expect(stepUpRamp('retinol', 2)).rejects.toThrow(RAMP_STATE_STALE);

    expect(mocks.storage.get(KEY)).toBe(paused);
    await expect(getStoredRamps()).resolves.toMatchObject({
      retinol: { freqPerWeek: 1, toleranceState: 'paused_irritation' },
    });
  });

  it('does not replay a successful step-up over a later irritation de-escalation', async () => {
    await ensureRamp('retinol', {
      freqPerWeek: 2,
      targetPerWeek: 4,
      toleranceState: 'building',
    });
    await stepUpRamp('retinol', 3);
    await applyToleranceToRamps('irritated');
    const paused = mocks.storage.get(KEY);

    await expect(stepUpRamp('retinol', 3)).rejects.toThrow(RAMP_STATE_STALE);

    expect(mocks.storage.get(KEY)).toBe(paused);
    await expect(getStoredRamps()).resolves.toMatchObject({
      retinol: { freqPerWeek: 2, toleranceState: 'paused_irritation' },
    });
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
    const afterFirstAnswer = mocks.storage.get(KEY);
    await applyToleranceToRamps('irritated');

    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}').ramps.retinol).toMatchObject({
      freqPerWeek: 2,
      targetPerWeek: 4,
      toleranceState: 'paused_irritation',
    });
    expect(mocks.storage.get(KEY)).toBe(afterFirstAnswer);
    expect(mocks.persistedWrites).toBe(1);
  });

  it('performs zero writes for unchanged tolerance answers in current and legacy records', async () => {
    const ramp = {
      freqPerWeek: 2,
      targetPerWeek: 3,
      toleranceState: 'building',
      startedAt: '2026-01-01',
      lastStepUp: null,
    } as const;
    const current = JSON.stringify({ version: 1, ramps: { retinol: ramp } });
    mocks.storage.set(KEY, current);
    await applyToleranceToRamps('a_bit_dry');
    expect(mocks.storage.get(KEY)).toBe(current);
    expect(mocks.persistedWrites).toBe(0);

    const legacy = JSON.stringify({ retinol: ramp });
    mocks.storage.set(KEY, legacy);
    await applyToleranceToRamps('a_bit_dry');
    expect(mocks.storage.get(KEY)).toBe(legacy);
    expect(mocks.persistedWrites).toBe(0);
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

    await expect(readStoredRamps()).resolves.toMatchObject({
      status: 'available',
      format: 'legacy',
      ramps: { retinol: { freqPerWeek: 3 } },
    });
    await expect(getStoredRamps()).resolves.toMatchObject({ retinol: { freqPerWeek: 3 } });
    expect(mocks.storage.get(KEY)).toBe(legacy);

    await stepUpRamp('retinol');

    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
      version: 1,
      ramps: { retinol: { freqPerWeek: 4 } },
    });
  });

  it('forwards private envelope corruption and future-version status', async () => {
    mocks.readStatus = 'corrupt';
    await expect(readStoredRamps()).resolves.toEqual({ status: 'corrupt', ramps: null });

    mocks.readStatus = 'unsupported_version';
    await expect(readStoredRamps()).resolves.toEqual({
      status: 'unsupported_version',
      ramps: null,
    });
  });

  it('reports a strict current envelope without rewriting it', async () => {
    const current = JSON.stringify({
      version: 1,
      ramps: {
        retinol: {
          freqPerWeek: 2,
          targetPerWeek: 4,
          toleranceState: 'building',
          startedAt: '2026-01-01',
          lastStepUp: null,
        },
      },
    });
    mocks.storage.set(KEY, current);

    await expect(readStoredRamps()).resolves.toMatchObject({
      status: 'available',
      format: 'current',
      ramps: { retinol: { freqPerWeek: 2 } },
    });

    expect(mocks.storage.get(KEY)).toBe(current);
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    expect(privateKV.removePrivateItem).not.toHaveBeenCalled();
  });
});
