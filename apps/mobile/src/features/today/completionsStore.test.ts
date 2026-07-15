import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

import {
  COMPLETION_LOG_INVALID,
  COMPLETION_LOG_UNSUPPORTED_VERSION,
  clearCompletions,
  getCompletedSteps,
  getCompletionSummary,
  getCountByDate,
  isBeyondBackfillCap,
  toggleCompletion,
} from './completionsStore';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  tails: new Map<string, Promise<void>>(),
  readFailures: new Map<string, Error>(),
  updateFailures: new Map<string, Error>(),
  reads: 0,
  writes: 0,
  readGate: null as Promise<void> | null,
  readStarted: null as (() => void) | null,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => {
    mocks.reads += 1;
    const failure = mocks.readFailures.get(key);
    if (failure) throw failure;
    mocks.readStarted?.();
    if (mocks.readGate) await mocks.readGate;
    return mocks.storage.get(key) ?? null;
  }),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    mocks.storage.set(key, value);
    mocks.writes += 1;
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

function storedDays(): Record<string, string[]> {
  const parsed = JSON.parse(mocks.storage.get(KEY) ?? '{}') as {
    version?: number;
    days?: Record<string, string[]>;
  };
  expect(parsed.version).toBe(1);
  return parsed.days ?? {};
}

describe('today completion persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mocks.storage.clear();
    mocks.tails.clear();
    mocks.readFailures.clear();
    mocks.updateFailures.clear();
    mocks.reads = 0;
    mocks.writes = 0;
    mocks.readGate = null;
    mocks.readStarted = null;
    vi.clearAllMocks();
    setActiveHealthProcessingEpoch(1, { ownerUserId: 'user-a', accountGeneration: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns an empty day without deleting malformed encrypted bytes', async () => {
    const original = '{not-json';
    mocks.storage.set(KEY, original);

    const completed = await getCompletedSteps(DAY);

    expect([...completed]).toEqual([]);
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
  });

  it('preserves an existing completion and does not re-fire first-ever activation', async () => {
    await expect(toggleCompletion('AM:cleanser', DAY)).resolves.toEqual({
      done: true,
      firstEver: true,
    });
    await expect(toggleCompletion('AM:cleanser', DAY)).resolves.toEqual({
      done: true,
      firstEver: false,
    });

    expect(mocks.storage.get(FIRST_COMPLETION_KEY)).toBe('true');
    await expect(getCompletedSteps(DAY)).resolves.toEqual(new Set(['AM:cleanser']));
    expect(storedDays()).toEqual({ [DAY]: ['AM:cleanser'] });
  });

  it('migrates a valid legacy log only inside an explicit atomic mutation', async () => {
    mocks.storage.set(KEY, JSON.stringify({ [DAY]: ['AM:cleanser'] }));

    await expect(toggleCompletion('AM:cleanser', DAY)).resolves.toEqual({
      done: true,
      firstEver: false,
    });

    expect(mocks.storage.get(FIRST_COMPLETION_KEY)).toBe('true');
    expect(storedDays()).toEqual({ [DAY]: ['AM:cleanser'] });
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

    await expect(getCompletedSteps(DAY)).resolves.toEqual(new Set());
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

  it('serializes simultaneous check-offs without losing a writer', async () => {
    const stepKeys = Array.from({ length: 40 }, (_, index) => `AM:item-${index}`);

    const results = await Promise.all(stepKeys.map((key) => toggleCompletion(key, DAY)));

    expect(new Set(storedDays()[DAY])).toEqual(new Set(stepKeys));
    expect(results.filter((result) => result.firstEver)).toHaveLength(1);
  });

  it('preserves future-version bytes and refuses to downgrade them', async () => {
    const original = JSON.stringify({ version: 2, days: { [DAY]: ['AM:cleanser'] } });
    mocks.storage.set(KEY, original);

    await expect(getCompletedSteps(DAY)).resolves.toEqual(new Set());
    await expect(toggleCompletion('PM:retinol', DAY)).rejects.toThrow(
      COMPLETION_LOG_UNSUPPORTED_VERSION,
    );

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.writes).toBe(0);
  });

  it('does not overwrite state when the private key is unavailable', async () => {
    const original = JSON.stringify({ version: 1, days: { [DAY]: ['AM:cleanser'] } });
    mocks.storage.set(KEY, original);
    mocks.readFailures.set(KEY, new Error('PRIVATE_KEY_UNAVAILABLE'));

    await expect(getCompletedSteps(DAY)).resolves.toEqual(new Set());
    expect(mocks.storage.get(KEY)).toBe(original);

    mocks.readFailures.delete(KEY);
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

  it('does not return account-A completion data after an A-to-B same-epoch switch', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify({ version: 1, days: { [DAY]: ['AM:account-a-secret'] } }),
    );
    let releaseRead!: () => void;
    let markReadStarted!: () => void;
    mocks.readGate = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const readStarted = new Promise<void>((resolve) => {
      markReadStarted = resolve;
    });
    mocks.readStarted = markReadStarted;

    const pending = getCompletedSteps(DAY);
    await readStarted;
    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(1, { ownerUserId: 'user-b', accountGeneration: 0 });
    releaseRead();

    await expect(pending).rejects.toThrow('HEALTH_DATA_WRITE_OWNER_MISMATCH');
  });

  it('keeps the deletion-only reset available after health processing closes', async () => {
    mocks.storage.set(KEY, JSON.stringify({ version: 1, days: { [DAY]: ['AM:cleanser'] } }));
    mocks.storage.set(FIRST_COMPLETION_KEY, 'true');
    clearActiveHealthProcessingEpoch();

    await expect(clearCompletions()).resolves.toBeUndefined();

    expect(mocks.storage.has(KEY)).toBe(false);
    expect(mocks.storage.has(FIRST_COMPLETION_KEY)).toBe(false);
  });
});
