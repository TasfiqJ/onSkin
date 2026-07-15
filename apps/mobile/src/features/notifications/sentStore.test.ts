import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

import {
  clearSentLocal,
  recordSentLocal,
  SENT_LEDGER_FAIL_CLOSED_COUNT,
  SENT_LEDGER_INVALID,
  SENT_LEDGER_UNSUPPORTED_VERSION,
  sentThisWeekForTierLocal,
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

const KEY = 'onskin.notiflog.v1';
const NOW = Date.parse('2026-07-07T12:00:00.000Z');

describe('notification sent ledger', () => {
  beforeEach(() => {
    mocks.storage.clear();
    mocks.tails.clear();
    mocks.updateFailure = null;
    setActiveHealthProcessingEpoch(1, { ownerUserId: 'user-a', accountGeneration: 0 });
  });

  it('preserves unreadable local history and fails the frequency cap closed', async () => {
    const original = '{not-json';
    mocks.storage.set(KEY, original);

    await expect(sentThisWeekForTierLocal('behavioural', NOW)).resolves.toBe(
      SENT_LEDGER_FAIL_CLOSED_COUNT,
    );
    await expect(recordSentLocal('capture', NOW)).rejects.toThrow(SENT_LEDGER_INVALID);

    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('preserves unsupported future-version history', async () => {
    const original = JSON.stringify({ version: 2, records: [] });
    mocks.storage.set(KEY, original);

    await expect(sentThisWeekForTierLocal('behavioural', NOW)).resolves.toBe(
      SENT_LEDGER_FAIL_CLOSED_COUNT,
    );
    await expect(recordSentLocal('capture', NOW)).rejects.toThrow(SENT_LEDGER_UNSUPPORTED_VERSION);

    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('rejects the whole malformed legacy ledger instead of dropping rows', async () => {
    const original = JSON.stringify([
      { kind: 'replenishment', tier: 'promotional', at: NOW - 1_000 },
      { kind: 'unknown', tier: 'behavioural', at: NOW - 3_000 },
    ]);
    mocks.storage.set(KEY, original);

    await expect(sentThisWeekForTierLocal('behavioural', NOW)).resolves.toBe(
      SENT_LEDGER_FAIL_CLOSED_COUNT,
    );
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('derives tiers from valid legacy rows without rewriting an ordinary read', async () => {
    const original = JSON.stringify([
      { kind: 'replenishment', tier: 'promotional', at: NOW - 1_000 },
      { kind: 'winback', tier: 'promotional', at: NOW - 2_000 },
    ]);
    mocks.storage.set(KEY, original);

    await expect(sentThisWeekForTierLocal('behavioural', NOW)).resolves.toBe(1);
    await expect(sentThisWeekForTierLocal('promotional', NOW)).resolves.toBe(1);
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('ignores future-dated rows in memory without repairing them during a read', async () => {
    const original = JSON.stringify([
      { kind: 'capture', tier: 'behavioural', at: NOW + 30 * 86_400_000 },
      { kind: 'replenishment', tier: 'behavioural', at: NOW - 1_000 },
    ]);
    mocks.storage.set(KEY, original);

    await expect(sentThisWeekForTierLocal('behavioural', NOW)).resolves.toBe(1);

    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('prunes send history older than 30 days when recording a new notification', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify([
        { kind: 'capture', tier: 'behavioural', at: NOW - 31 * 86_400_000 },
        { kind: 'rampup', tier: 'behavioural', at: NOW - 2 * 86_400_000 },
      ]),
    );

    await recordSentLocal('replenishment', NOW);

    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      version: 1,
      records: [
        { kind: 'rampup', tier: 'behavioural', at: NOW - 2 * 86_400_000 },
        { kind: 'replenishment', tier: 'behavioural', at: NOW },
      ],
    });
  });

  it('serializes simultaneous sent records without losing a cap entry', async () => {
    await Promise.all([
      recordSentLocal('replenishment', NOW),
      recordSentLocal('rampup', NOW + 1),
      recordSentLocal('winback', NOW + 2),
    ]);

    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}').records).toHaveLength(3);
    await expect(sentThisWeekForTierLocal('behavioural', NOW + 2)).resolves.toBe(2);
    await expect(sentThisWeekForTierLocal('promotional', NOW + 2)).resolves.toBe(1);
  });

  it('leaves the prior ledger intact when an atomic write fails', async () => {
    await recordSentLocal('capture', NOW);
    const original = mocks.storage.get(KEY);
    mocks.updateFailure = new Error('PRIVATE_WRITE_FAILED');

    await expect(recordSentLocal('rampup', NOW + 1)).rejects.toThrow('PRIVATE_WRITE_FAILED');

    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('clears the sent ledger after health processing closes', async () => {
    mocks.storage.set(KEY, JSON.stringify({ version: 1, records: [] }));
    clearActiveHealthProcessingEpoch();

    await clearSentLocal();

    expect(mocks.storage.has(KEY)).toBe(false);
  });
});
