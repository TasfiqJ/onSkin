import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';
import { createOwnerQueryScope } from '@/lib/query/queryKeys';

import {
  MAX_CYCLE_NIGHT_ANALYTICS_DATES,
  MAX_CYCLE_NIGHT_ANALYTICS_RECORD_CHARS,
  readCycleNightAnalyticsReceipts,
  reserveCycleNightCompletionAnalyticsForOwner,
  type CycleNightAnalyticsReservationInput,
} from './cycleNightAnalytics';

const KEY = 'onskin.cycleNightAnalytics.v1';
const DAY = '2026-07-15';

const mocks = vi.hoisted(() => ({
  mutationTail: Promise.resolve() as Promise<void>,
  readPrivateItem: vi.fn(),
  storage: new Map<string, string>(),
  updateFailure: null as Error | null,
  updatePrivateItem: vi.fn(),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  readPrivateItem: mocks.readPrivateItem,
  updatePrivateItem: mocks.updatePrivateItem,
}));

function input(
  overrides: Partial<CycleNightAnalyticsReservationInput> = {},
): CycleNightAnalyticsReservationInput {
  return {
    changed: true,
    completedAfter: new Set(['PM:cleanser']),
    cycleActive: true,
    localDate: DAY,
    phase: 'PM',
    scope: createOwnerQueryScope(),
    stepKeys: ['PM:cleanser'],
    ...overrides,
  };
}

function storedDates(): string[] {
  const parsed = JSON.parse(mocks.storage.get(KEY) ?? '{}') as {
    version?: number;
    completedLocalDates?: string[];
  };
  expect(parsed.version).toBe(1);
  return parsed.completedLocalDates ?? [];
}

function dateAt(index: number): string {
  return new Date(Date.UTC(2000, 0, 1 + index)).toISOString().slice(0, 10);
}

beforeEach(() => {
  mocks.mutationTail = Promise.resolve();
  mocks.storage.clear();
  mocks.updateFailure = null;
  mocks.readPrivateItem.mockReset();
  mocks.readPrivateItem.mockImplementation(async (key: string) => {
    const value = mocks.storage.get(key);
    return value === undefined ? { status: 'absent' } : { status: 'available', value };
  });
  mocks.updatePrivateItem.mockReset();
  mocks.updatePrivateItem.mockImplementation(
    (key: string, updater: (current: string | null) => string | null) => {
      const mutation = mocks.mutationTail.then(() => {
        if (mocks.updateFailure) throw mocks.updateFailure;
        const next = updater(mocks.storage.get(key) ?? null);
        if (next === null) mocks.storage.delete(key);
        else mocks.storage.set(key, next);
      });
      mocks.mutationTail = mutation.then(
        () => undefined,
        () => undefined,
      );
      return mutation;
    },
  );
});

describe('cycle-night analytics reservations', () => {
  it('reserves one owner/date across route remounts and expanded step sets', async () => {
    const scope = createOwnerQueryScope();

    await expect(
      reserveCycleNightCompletionAnalyticsForOwner(
        input({ completedAfter: new Set(['PM:a']), scope, stepKeys: ['PM:a'] }),
      ),
    ).resolves.toEqual({ status: 'reserved' });
    await expect(
      reserveCycleNightCompletionAnalyticsForOwner(
        input({
          completedAfter: new Set(['PM:a', 'PM:b']),
          scope,
          stepKeys: ['PM:a', 'PM:b'],
        }),
      ),
    ).resolves.toEqual({ status: 'already_reserved' });

    expect(storedDates()).toEqual([DAY]);
    expect(mocks.updatePrivateItem).toHaveBeenCalledTimes(2);
  });

  it('atomically lets only one simultaneous candidate reserve the same night', async () => {
    const scope = createOwnerQueryScope();
    const results = await Promise.all([
      reserveCycleNightCompletionAnalyticsForOwner(input({ scope })),
      reserveCycleNightCompletionAnalyticsForOwner(input({ scope })),
      reserveCycleNightCompletionAnalyticsForOwner(input({ scope })),
    ]);

    expect(results.filter((result) => result.status === 'reserved')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'already_reserved')).toHaveLength(2);
    expect(storedDates()).toEqual([DAY]);
  });

  it('honors an existing durable receipt after a process restart', async () => {
    const stored = JSON.stringify({ version: 1, completedLocalDates: [DAY] });
    mocks.storage.set(KEY, stored);

    await expect(reserveCycleNightCompletionAnalyticsForOwner(input())).resolves.toEqual({
      status: 'already_reserved',
    });
    expect(mocks.storage.get(KEY)).toBe(stored);
  });

  it('reserves distinct local dates independently without returning either date', async () => {
    const scope = createOwnerQueryScope();
    const first = await reserveCycleNightCompletionAnalyticsForOwner(input({ scope }));
    const second = await reserveCycleNightCompletionAnalyticsForOwner(
      input({ localDate: '2026-07-16', scope }),
    );

    expect(first).toEqual({ status: 'reserved' });
    expect(second).toEqual({ status: 'reserved' });
    expect(storedDates()).toEqual([DAY, '2026-07-16']);
  });

  it.each([
    { changed: false },
    { cycleActive: false },
    { phase: 'AM' as const },
    { stepKeys: [] },
    { completedAfter: new Set<string>() },
  ])('does not touch private storage for a non-candidate: %#', async (overrides) => {
    await expect(reserveCycleNightCompletionAnalyticsForOwner(input(overrides))).resolves.toEqual({
      status: 'not_candidate',
    });
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('rejects a stale owner before invoking the atomic writer', async () => {
    const staleScope = createOwnerQueryScope();
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();

    await expect(
      reserveCycleNightCompletionAnalyticsForOwner(input({ scope: staleScope })),
    ).resolves.toEqual({ status: 'cancelled' });
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('fails closed when an otherwise valid atomic write is unavailable', async () => {
    mocks.updateFailure = new Error('storage unavailable');

    await expect(reserveCycleNightCompletionAnalyticsForOwner(input())).resolves.toEqual({
      status: 'unavailable',
    });
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it.each(['', ' 2026-07-15', '2026-7-15', '2026-02-31'])(
    'fails closed before writing a non-canonical local date: %s',
    async (localDate) => {
      await expect(
        reserveCycleNightCompletionAnalyticsForOwner(input({ localDate })),
      ).resolves.toEqual({ status: 'unavailable' });
      expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
    },
  );

  it.each([
    '{',
    '[]',
    JSON.stringify({ version: 1, completedLocalDates: [DAY], extra: true }),
    JSON.stringify({ version: 1, completedLocalDates: ['2026-02-31'] }),
    JSON.stringify({ version: 1, completedLocalDates: [DAY, DAY] }),
    JSON.stringify({ version: 1, completedLocalDates: ['2026-07-16', DAY] }),
    JSON.stringify({ version: 2, completedLocalDates: [] }),
    'x'.repeat(MAX_CYCLE_NIGHT_ANALYTICS_RECORD_CHARS + 1),
  ])('preserves uncertain bytes and suppresses the event reservation', async (stored) => {
    mocks.storage.set(KEY, stored);

    await expect(reserveCycleNightCompletionAnalyticsForOwner(input())).resolves.toEqual({
      status: 'unavailable',
    });
    expect(mocks.storage.get(KEY)).toBe(stored);
  });

  it('fails closed without pruning once the durable ledger reaches capacity', async () => {
    const completedLocalDates = Array.from(
      { length: MAX_CYCLE_NIGHT_ANALYTICS_DATES },
      (_, index) => dateAt(index),
    );
    const stored = JSON.stringify({ version: 1, completedLocalDates });
    expect(stored.length).toBeLessThanOrEqual(MAX_CYCLE_NIGHT_ANALYTICS_RECORD_CHARS);
    mocks.storage.set(KEY, stored);

    await expect(
      reserveCycleNightCompletionAnalyticsForOwner(input({ localDate: '2099-01-01' })),
    ).resolves.toEqual({ status: 'unavailable' });
    expect(mocks.storage.get(KEY)).toBe(stored);
  });

  it('classifies typed absent, available, corrupt, and future reads without rewriting', async () => {
    await expect(readCycleNightAnalyticsReceipts()).resolves.toEqual({
      status: 'absent',
      completedLocalDates: [],
    });

    await reserveCycleNightCompletionAnalyticsForOwner(input());
    const current = mocks.storage.get(KEY);
    await expect(readCycleNightAnalyticsReceipts()).resolves.toEqual({
      status: 'available',
      completedLocalDates: [DAY],
    });
    expect(mocks.storage.get(KEY)).toBe(current);

    mocks.storage.set(KEY, '{');
    await expect(readCycleNightAnalyticsReceipts()).resolves.toEqual({
      status: 'corrupt',
      completedLocalDates: null,
      reason: 'invalid_payload',
    });
    expect(mocks.storage.get(KEY)).toBe('{');

    const future = JSON.stringify({ version: 2, completedLocalDates: [] });
    mocks.storage.set(KEY, future);
    await expect(readCycleNightAnalyticsReceipts()).resolves.toEqual({
      status: 'unsupported_version',
      completedLocalDates: null,
    });
    expect(mocks.storage.get(KEY)).toBe(future);
  });

  it.each([
    [
      { status: 'unavailable', reason: 'content_key_missing' },
      { status: 'unavailable', completedLocalDates: null, reason: 'content_key_missing' },
    ],
    [
      { status: 'corrupt', reason: 'decryption_failed' },
      { status: 'corrupt', completedLocalDates: null, reason: 'decryption_failed' },
    ],
    [
      { status: 'unsupported_version' },
      { status: 'unsupported_version', completedLocalDates: null },
    ],
  ])('preserves the private-KV read taxonomy for %#', async (stored, expected) => {
    mocks.readPrivateItem.mockResolvedValueOnce(stored);
    await expect(readCycleNightAnalyticsReceipts()).resolves.toEqual(expected);
  });
});
