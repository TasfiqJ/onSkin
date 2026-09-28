import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

import {
  ATTEMPT_LEDGER_FAIL_CLOSED_COUNT,
  ATTEMPT_LEDGER_INVALID,
  ATTEMPT_LEDGER_UNSUPPORTED_VERSION,
  clearSentLocal,
  reserveNotificationSlotLocal,
  schedulingAttemptsThisWeekForTierLocal,
} from './sentStore';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  tails: new Map<string, Promise<void>>(),
  updateFailure: null as Error | null,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
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

const KEY = 'layerwell.notiflog.v1';
const NOW = Date.parse('2026-07-07T12:00:00.000Z');

describe('notification scheduling-attempt ledger', () => {
  beforeEach(() => {
    mocks.storage.clear();
    mocks.tails.clear();
    mocks.updateFailure = null;
    setActiveHealthProcessingEpoch(1, { ownerUserId: 'user-a', accountGeneration: 0 });
  });

  it('preserves unreadable local history and fails the frequency cap closed', async () => {
    const original = '{not-json';
    mocks.storage.set(KEY, original);

    await expect(schedulingAttemptsThisWeekForTierLocal('behavioural', NOW)).resolves.toBe(
      ATTEMPT_LEDGER_FAIL_CLOSED_COUNT,
    );
    await expect(reserveNotificationSlotLocal('capture', NOW)).rejects.toThrow(
      ATTEMPT_LEDGER_INVALID,
    );

    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('preserves unsupported future-version history', async () => {
    const original = JSON.stringify({ version: 2, records: [] });
    mocks.storage.set(KEY, original);

    await expect(schedulingAttemptsThisWeekForTierLocal('behavioural', NOW)).resolves.toBe(
      ATTEMPT_LEDGER_FAIL_CLOSED_COUNT,
    );
    await expect(reserveNotificationSlotLocal('capture', NOW)).rejects.toThrow(
      ATTEMPT_LEDGER_UNSUPPORTED_VERSION,
    );

    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('rejects the whole malformed legacy ledger instead of dropping rows', async () => {
    const original = JSON.stringify([
      { kind: 'replenishment', tier: 'promotional', at: NOW - 1_000 },
      { kind: 'unknown', tier: 'behavioural', at: NOW - 3_000 },
    ]);
    mocks.storage.set(KEY, original);

    await expect(schedulingAttemptsThisWeekForTierLocal('behavioural', NOW)).resolves.toBe(
      ATTEMPT_LEDGER_FAIL_CLOSED_COUNT,
    );
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('derives tiers from valid legacy rows without rewriting an ordinary read', async () => {
    const original = JSON.stringify([
      { kind: 'replenishment', tier: 'promotional', at: NOW - 1_000 },
      { kind: 'winback', tier: 'promotional', at: NOW - 2_000 },
    ]);
    mocks.storage.set(KEY, original);

    await expect(schedulingAttemptsThisWeekForTierLocal('behavioural', NOW)).resolves.toBe(1);
    await expect(schedulingAttemptsThisWeekForTierLocal('promotional', NOW)).resolves.toBe(1);
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('ignores future-dated rows in memory without repairing them during a read', async () => {
    const original = JSON.stringify([
      { kind: 'capture', tier: 'behavioural', at: NOW + 30 * 86_400_000 },
      { kind: 'replenishment', tier: 'behavioural', at: NOW - 1_000 },
    ]);
    mocks.storage.set(KEY, original);

    await expect(schedulingAttemptsThisWeekForTierLocal('behavioural', NOW)).resolves.toBe(1);

    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('prunes attempt history older than 30 days when reserving a slot', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify([
        { kind: 'capture', tier: 'behavioural', at: NOW - 31 * 86_400_000 },
        { kind: 'rampup', tier: 'behavioural', at: NOW - 2 * 86_400_000 },
      ]),
    );

    await expect(reserveNotificationSlotLocal('replenishment', NOW)).resolves.toBe(true);

    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      version: 1,
      records: [
        { kind: 'rampup', tier: 'behavioural', at: NOW - 2 * 86_400_000 },
        { kind: 'replenishment', tier: 'behavioural', at: NOW },
      ],
    });
  });

  it('serializes simultaneous attempt reservations without losing a cap entry', async () => {
    await expect(
      Promise.all([
        reserveNotificationSlotLocal('replenishment', NOW),
        reserveNotificationSlotLocal('rampup', NOW + 1),
        reserveNotificationSlotLocal('winback', NOW + 2),
      ]),
    ).resolves.toEqual([true, true, true]);

    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}').records).toHaveLength(3);
    await expect(schedulingAttemptsThisWeekForTierLocal('behavioural', NOW + 2)).resolves.toBe(2);
    await expect(schedulingAttemptsThisWeekForTierLocal('promotional', NOW + 2)).resolves.toBe(1);
  });

  it('atomically admits only the remaining behavioural slot under concurrency', async () => {
    await expect(reserveNotificationSlotLocal('replenishment', NOW - 2)).resolves.toBe(true);
    await expect(reserveNotificationSlotLocal('rampup', NOW - 1)).resolves.toBe(true);

    const admitted = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        reserveNotificationSlotLocal('replenishment', NOW + index),
      ),
    );

    expect(admitted.filter(Boolean)).toHaveLength(1);
    await expect(schedulingAttemptsThisWeekForTierLocal('behavioural', NOW + 10)).resolves.toBe(3);
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}').records).toHaveLength(3);
  });

  it('reserves at most one promotional attempt in seven days', async () => {
    const admitted = await Promise.all(
      Array.from({ length: 6 }, (_, index) => reserveNotificationSlotLocal('winback', NOW + index)),
    );

    expect(admitted.filter(Boolean)).toHaveLength(1);
    await expect(schedulingAttemptsThisWeekForTierLocal('promotional', NOW + 10)).resolves.toBe(1);
  });

  it('preserves malformed bytes and refuses a reservation before native scheduling', async () => {
    const original = '{not-json';
    mocks.storage.set(KEY, original);

    await expect(reserveNotificationSlotLocal('replenishment', NOW)).rejects.toThrow(
      ATTEMPT_LEDGER_INVALID,
    );

    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('leaves the prior ledger intact when an atomic write fails', async () => {
    await expect(reserveNotificationSlotLocal('capture', NOW)).resolves.toBe(true);
    const original = mocks.storage.get(KEY);
    mocks.updateFailure = new Error('PRIVATE_WRITE_FAILED');

    await expect(reserveNotificationSlotLocal('rampup', NOW + 1)).rejects.toThrow(
      'PRIVATE_WRITE_FAILED',
    );

    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('clears the attempt ledger after health processing closes', async () => {
    mocks.storage.set(KEY, JSON.stringify({ version: 1, records: [] }));
    clearActiveHealthProcessingEpoch();

    await clearSentLocal();

    expect(mocks.storage.has(KEY)).toBe(false);
  });
});
