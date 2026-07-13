import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AccountGenerationLeaseError,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';
import * as privateKV from '@/lib/storage/privateKV';
import type { PrivateKVReadResult } from '@/lib/storage/privateKV';

import {
  COMPLETION_FIRST_MARKER_UNAVAILABLE,
  COMPLETION_LOG_INVALID,
  COMPLETION_LOG_UNAVAILABLE,
  COMPLETION_LOG_UNSUPPORTED_VERSION,
  clearCompletions,
  getCompletedSteps,
  getCompletionSummary,
  getCountByDate,
  isBeyondBackfillCap,
  readCompletionLog,
  toggleCompletion,
} from './completionsStore';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  tails: new Map<string, Promise<void>>(),
  readOverrides: new Map<string, PrivateKVReadResult>(),
  updateFailures: new Map<string, Error>(),
  reads: 0,
  writes: 0,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  readPrivateItem: vi.fn(async (key: string) => {
    mocks.reads += 1;
    const override = mocks.readOverrides.get(key);
    if (override) return override;
    const value = mocks.storage.get(key);
    return value === undefined ? { status: 'absent' } : { status: 'available', value };
  }),
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.storage.delete(key);
    mocks.writes += 1;
  }),
  updatePrivateItem: vi.fn(
    async (key: string, updater: (current: string | null) => string | null) => {
      const previous = mocks.tails.get(key) ?? Promise.resolve();
      let release!: () => void;
      const ownTail = new Promise<void>((resolve) => {
        release = resolve;
      });
      mocks.tails.set(key, ownTail);
      await previous;
      try {
        const failure = mocks.updateFailures.get(key);
        if (failure) throw failure;
        const current = mocks.storage.get(key) ?? null;
        const next = updater(current);
        if (next === current) return;
        if (next === null) mocks.storage.delete(key);
        else mocks.storage.set(key, next);
        mocks.writes += 1;
      } finally {
        release();
        if (mocks.tails.get(key) === ownTail) mocks.tails.delete(key);
      }
    },
  ),
}));

const KEY = 'onskin.completions.v1';
const FIRST_COMPLETION_KEY = 'onskin.completions.firstCompletion.v1';
const DAY = '2026-07-07';
const NOW = new Date('2026-07-08T16:00:00.000Z');
const runtime = globalThis as typeof globalThis & { __DEV__?: boolean };
const originalDev = runtime.__DEV__;

function storedDays(): Record<string, string[]> {
  const parsed = JSON.parse(mocks.storage.get(KEY) ?? '{}') as {
    version?: number;
    days?: Record<string, string[]>;
    firstCompletionRecorded?: boolean;
  };
  expect(parsed.version).toBe(2);
  expect(parsed.firstCompletionRecorded).toBe(true);
  return parsed.days ?? {};
}

describe('today completion persistence', () => {
  let boundaryActive = false;

  beforeEach(() => {
    delete runtime.__DEV__;
    delete process.env.EXPO_PUBLIC_E2E_COMPLETION_STORAGE_FAILURE;
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mocks.storage.clear();
    mocks.tails.clear();
    mocks.readOverrides.clear();
    mocks.updateFailures.clear();
    mocks.reads = 0;
    mocks.writes = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
    vi.useRealTimers();
    if (!boundaryActive) return;
    endAccountGenerationBoundary();
    boundaryActive = false;
  });

  it('fails closed without deleting malformed encrypted bytes', async () => {
    const original = '{not-json';
    mocks.storage.set(KEY, original);

    await expect(readCompletionLog()).resolves.toEqual({ status: 'corrupt', days: null });
    await expect(getCompletedSteps(DAY)).rejects.toThrow(COMPLETION_LOG_INVALID);
    await expect(getCompletionSummary()).rejects.toThrow(COMPLETION_LOG_INVALID);
    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('exposes the dev storage-failure fixture without reading or changing private bytes', async () => {
    const original = JSON.stringify({ version: 1, days: { [DAY]: ['AM:cleanser'] } });
    mocks.storage.set(KEY, original);
    runtime.__DEV__ = true;
    process.env.EXPO_PUBLIC_E2E_COMPLETION_STORAGE_FAILURE = 'always';

    await expect(readCompletionLog()).resolves.toEqual({ status: 'unavailable', days: null });
    await expect(getCompletedSteps(DAY)).rejects.toThrow(COMPLETION_LOG_UNAVAILABLE);

    expect(privateKV.readPrivateItem).not.toHaveBeenCalled();
    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('ignores the storage-failure fixture outside development builds', async () => {
    const original = JSON.stringify({ version: 1, days: { [DAY]: ['AM:cleanser'] } });
    mocks.storage.set(KEY, original);
    runtime.__DEV__ = false;
    process.env.EXPO_PUBLIC_E2E_COMPLETION_STORAGE_FAILURE = 'always';

    await expect(readCompletionLog()).resolves.toMatchObject({ status: 'available' });

    expect(privateKV.readPrivateItem).toHaveBeenCalledWith(KEY);
    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('rejects a mutation over malformed state without replacing the original bytes', async () => {
    const original = JSON.stringify({ [DAY]: 'AM:cleanser' });
    mocks.storage.set(KEY, original);

    await expect(toggleCompletion('AM:cleanser', DAY)).rejects.toThrow(COMPLETION_LOG_INVALID);

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('persists a normal check-off in the versioned envelope across fresh Today reads', async () => {
    await expect(toggleCompletion('AM:cleanser', DAY)).resolves.toEqual({
      done: true,
      firstEver: true,
    });

    await expect(getCompletedSteps(DAY)).resolves.toEqual(new Set(['AM:cleanser']));
    await expect(getCompletedSteps(DAY)).resolves.toEqual(new Set(['AM:cleanser']));
    expect(storedDays()).toEqual({ [DAY]: ['AM:cleanser'] });
    expect(mocks.storage.has(FIRST_COMPLETION_KEY)).toBe(false);
  });

  it('preserves an existing completion and does not re-fire first-ever activation', async () => {
    await expect(toggleCompletion('AM:cleanser', DAY)).resolves.toEqual({
      done: true,
      firstEver: true,
    });
    const writesAfterFirstCompletion = mocks.writes;
    await expect(toggleCompletion('AM:cleanser', DAY)).resolves.toEqual({
      done: true,
      firstEver: false,
    });

    expect(mocks.storage.has(FIRST_COMPLETION_KEY)).toBe(false);
    expect(mocks.writes).toBe(writesAfterFirstCompletion);
    await expect(getCompletedSteps(DAY)).resolves.toEqual(new Set(['AM:cleanser']));
    expect(storedDays()).toEqual({ [DAY]: ['AM:cleanser'] });
  });

  it('migrates a valid legacy log only inside an explicit atomic mutation', async () => {
    mocks.storage.set(KEY, JSON.stringify({ [DAY]: ['AM:cleanser'] }));

    await expect(toggleCompletion('AM:cleanser', DAY)).resolves.toEqual({
      done: true,
      firstEver: false,
    });

    expect(mocks.storage.has(FIRST_COMPLETION_KEY)).toBe(false);
    expect(storedDays()).toEqual({ [DAY]: ['AM:cleanser'] });
    expect(mocks.writes).toBe(1);

    await expect(toggleCompletion('AM:cleanser', DAY)).resolves.toEqual({
      done: true,
      firstEver: false,
    });
    expect(mocks.writes).toBe(1);
  });

  it('recovers a legacy marker whose old log write is absent without firing first-ever again', async () => {
    mocks.storage.set(FIRST_COMPLETION_KEY, 'true');

    await expect(toggleCompletion('AM:cleanser', DAY)).resolves.toEqual({
      done: true,
      firstEver: false,
    });

    expect(storedDays()).toEqual({ [DAY]: ['AM:cleanser'] });
    expect(mocks.storage.get(FIRST_COMPLETION_KEY)).toBe('true');
    expect(mocks.writes).toBe(1);
  });

  it('preserves a legacy marker when the atomic log migration fails', async () => {
    mocks.storage.set(FIRST_COMPLETION_KEY, 'true');
    mocks.updateFailures.set(KEY, new Error('PRIVATE_WRITE_FAILED'));

    await expect(toggleCompletion('AM:cleanser', DAY)).rejects.toThrow('PRIVATE_WRITE_FAILED');

    expect(mocks.storage.has(KEY)).toBe(false);
    expect(mocks.storage.get(FIRST_COMPLETION_KEY)).toBe('true');
    expect(mocks.writes).toBe(0);
  });

  it('blocks an empty legacy migration when its marker is unavailable', async () => {
    mocks.readOverrides.set(FIRST_COMPLETION_KEY, {
      status: 'unavailable',
      reason: 'content_key_missing',
    });

    await expect(toggleCompletion('AM:cleanser', DAY)).rejects.toThrow(
      COMPLETION_FIRST_MARKER_UNAVAILABLE,
    );

    expect(mocks.storage.has(KEY)).toBe(false);
    expect(mocks.writes).toBe(0);
  });

  it('recovers a committed legacy log even when its separate marker is unavailable', async () => {
    mocks.storage.set(KEY, JSON.stringify({ version: 1, days: { [DAY]: ['AM:cleanser'] } }));
    mocks.readOverrides.set(FIRST_COMPLETION_KEY, {
      status: 'unavailable',
      reason: 'content_key_missing',
    });

    await expect(toggleCompletion('AM:cleanser', DAY)).resolves.toEqual({
      done: true,
      firstEver: false,
    });

    expect(storedDays()).toEqual({ [DAY]: ['AM:cleanser'] });
    expect(mocks.writes).toBe(1);
  });

  it('uses the embedded v2 first-completion state without trusting a corrupt legacy marker', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify({
        version: 2,
        days: { [DAY]: ['AM:cleanser'] },
        firstCompletionRecorded: true,
      }),
    );
    mocks.storage.set(FIRST_COMPLETION_KEY, 'not-a-boolean');

    await expect(toggleCompletion('PM:retinol', DAY)).resolves.toEqual({
      done: true,
      firstEver: false,
    });

    expect(storedDays()).toEqual({ [DAY]: ['AM:cleanser', 'PM:retinol'] });
    expect(mocks.storage.get(FIRST_COMPLETION_KEY)).toBe('not-a-boolean');
  });

  it('normalizes valid legacy whitespace and duplicates in memory without rewriting reads', async () => {
    const original = JSON.stringify({
      [` ${DAY} `]: [' AM:cleanser ', 'AM:cleanser', 'PM:retinol'],
    });
    mocks.storage.set(KEY, original);

    await expect(getCompletedSteps(DAY)).resolves.toEqual(new Set(['AM:cleanser', 'PM:retinol']));

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('rejects an entire legacy log containing a malformed row and preserves it', async () => {
    const original = JSON.stringify({
      [DAY]: ['AM:cleanser'],
      '2026-02-31': ['PM:bad-date'],
    });
    mocks.storage.set(KEY, original);

    await expect(getCompletedSteps(DAY)).rejects.toThrow(COMPLETION_LOG_INVALID);
    await expect(getCompletionSummary()).rejects.toThrow(COMPLETION_LOG_INVALID);
    await expect(toggleCompletion('PM:retinol', DAY)).rejects.toThrow(COMPLETION_LOG_INVALID);

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('merges completion rows when padded legacy dates normalize to the same day', async () => {
    const original = JSON.stringify({
      [` ${DAY} `]: ['AM:cleanser'],
      [DAY]: ['PM:retinol'],
    });
    mocks.storage.set(KEY, original);

    await expect(getCompletedSteps(DAY)).resolves.toEqual(new Set(['AM:cleanser', 'PM:retinol']));
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('serializes 100 simultaneous first check-offs with exactly one activation', async () => {
    const stepKeys = Array.from({ length: 100 }, (_, index) => `AM:item-${index}`);

    const results = await Promise.all(stepKeys.map((key) => toggleCompletion(key, DAY)));

    expect(new Set(storedDays()[DAY])).toEqual(new Set(stepKeys));
    expect(results.filter((result) => result.firstEver)).toHaveLength(1);
    expect(mocks.storage.has(FIRST_COMPLETION_KEY)).toBe(false);
  });

  it('cancels a delayed owner-A marker read before any owner-B log write or result', async () => {
    let releaseMarker!: () => void;
    vi.mocked(privateKV.readPrivateItem).mockImplementationOnce(
      () =>
        new Promise<PrivateKVReadResult>((resolve) => {
          releaseMarker = () => resolve({ status: 'absent' });
        }),
    );

    const completion = toggleCompletion('AM:cleanser', DAY);
    await vi.waitFor(() => expect(privateKV.readPrivateItem).toHaveBeenCalledOnce());

    beginAccountGenerationBoundary();
    boundaryActive = true;

    await expect(completion).resolves.toEqual({ done: false, firstEver: false });
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.storage.has(KEY)).toBe(false);
    expect(mocks.storage.has(FIRST_COMPLETION_KEY)).toBe(false);
    expect(mocks.writes).toBe(0);

    releaseMarker();
    await Promise.resolve();
  });

  it('never removes owner-B marker state after a boundary interrupts owner-A clear', async () => {
    mocks.storage.set(KEY, JSON.stringify({ version: 1, days: { [DAY]: ['AM:cleanser'] } }));
    mocks.storage.set(FIRST_COMPLETION_KEY, 'true');
    let releaseFirstRemoval!: () => void;
    vi.mocked(privateKV.removePrivateItem).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseFirstRemoval = () => {
            mocks.storage.delete(KEY);
            mocks.writes += 1;
            resolve();
          };
        }),
    );

    const clear = clearCompletions();
    await vi.waitFor(() => expect(privateKV.removePrivateItem).toHaveBeenCalledOnce());

    beginAccountGenerationBoundary();
    boundaryActive = true;
    releaseFirstRemoval();

    await expect(clear).rejects.toBeInstanceOf(AccountGenerationLeaseError);
    expect(privateKV.removePrivateItem).toHaveBeenCalledTimes(1);
    expect(mocks.storage.has(KEY)).toBe(false);
    expect(mocks.storage.get(FIRST_COMPLETION_KEY)).toBe('true');
  });

  it('preserves future-version bytes and refuses to downgrade them', async () => {
    const original = JSON.stringify({
      version: 3,
      days: { [DAY]: ['AM:cleanser'] },
      firstCompletionRecorded: true,
    });
    mocks.storage.set(KEY, original);

    await expect(readCompletionLog()).resolves.toEqual({
      status: 'unsupported_version',
      days: null,
    });
    await expect(getCompletedSteps(DAY)).rejects.toThrow(COMPLETION_LOG_UNSUPPORTED_VERSION);
    await expect(getCompletionSummary()).rejects.toThrow(COMPLETION_LOG_UNSUPPORTED_VERSION);
    await expect(toggleCompletion('PM:retinol', DAY)).rejects.toThrow(
      COMPLETION_LOG_UNSUPPORTED_VERSION,
    );

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('preserves a malformed v2 envelope instead of inferring first-completion state', async () => {
    const original = JSON.stringify({ version: 2, days: { [DAY]: ['AM:cleanser'] } });
    mocks.storage.set(KEY, original);

    await expect(readCompletionLog()).resolves.toEqual({ status: 'corrupt', days: null });
    await expect(getCompletedSteps(DAY)).rejects.toThrow(COMPLETION_LOG_INVALID);
    await expect(getCompletionSummary()).rejects.toThrow(COMPLETION_LOG_INVALID);
    await expect(toggleCompletion('PM:retinol', DAY)).rejects.toThrow(COMPLETION_LOG_INVALID);

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('does not overwrite state when the private key is unavailable', async () => {
    const original = JSON.stringify({ version: 1, days: { [DAY]: ['AM:cleanser'] } });
    mocks.storage.set(KEY, original);
    mocks.readOverrides.set(KEY, { status: 'unavailable', reason: 'content_key_missing' });

    await expect(readCompletionLog()).resolves.toEqual({ status: 'unavailable', days: null });
    await expect(getCompletedSteps(DAY)).rejects.toThrow(COMPLETION_LOG_UNAVAILABLE);
    await expect(getCompletionSummary()).rejects.toThrow(COMPLETION_LOG_UNAVAILABLE);
    expect(mocks.storage.get(KEY)).toBe(original);

    mocks.readOverrides.delete(KEY);
    mocks.updateFailures.set(KEY, new Error('PRIVATE_KEY_UNAVAILABLE'));
    await expect(toggleCompletion('PM:retinol', DAY)).rejects.toThrow('PRIVATE_KEY_UNAVAILABLE');

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('leaves the prior log intact when the atomic write fails', async () => {
    const original = JSON.stringify({ version: 1, days: { [DAY]: ['AM:cleanser'] } });
    mocks.storage.set(KEY, original);
    mocks.updateFailures.set(KEY, new Error('PRIVATE_WRITE_FAILED'));

    await expect(toggleCompletion('PM:retinol', DAY)).rejects.toThrow('PRIVATE_WRITE_FAILED');

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('does not persist empty step keys or invalid completion dates', async () => {
    await expect(toggleCompletion('   ', DAY)).resolves.toEqual({
      done: false,
      firstEver: false,
    });
    await expect(toggleCompletion('AM:cleanser', '2026-02-31')).resolves.toEqual({
      done: false,
      firstEver: false,
    });

    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('treats invalid dates as beyond the backfill cap', () => {
    expect(isBeyondBackfillCap('2026-02-31', DAY)).toBe(true);
    expect(isBeyondBackfillCap(DAY, 'not-a-day')).toBe(true);
  });

  it('rejects dates beyond the timezone-tolerant future window', () => {
    expect(isBeyondBackfillCap('2026-07-08', DAY)).toBe(false);
    expect(isBeyondBackfillCap('2026-07-09', DAY)).toBe(true);
  });

  it('uses normalized completion rows for heat-map counts without rewriting reads', async () => {
    const original = JSON.stringify({
      [DAY]: ['AM:cleanser', ' AM:cleanser ', 'PM:retinol'],
    });
    mocks.storage.set(KEY, original);

    const counts = await getCountByDate();

    expect(counts.get(DAY)).toBe(2);
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('derives streak dates and heat-map counts from one atomic storage read', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify({
        version: 1,
        days: {
          [DAY]: ['AM:cleanser', 'PM:retinol'],
          '2026-07-06': ['PM:cleanser'],
        },
      }),
    );

    const summary = await getCompletionSummary();

    expect(summary.completedDates).toEqual(new Set([DAY, '2026-07-06']));
    expect(summary.countByDate).toEqual(
      new Map([
        [DAY, 2],
        ['2026-07-06', 1],
      ]),
    );
    expect(mocks.reads).toBe(1);
  });
});
