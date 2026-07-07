import { beforeEach, describe, expect, it, vi } from 'vitest';

import { recordSentLocal, sentThisWeekForTierLocal } from './sentStore';

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

const KEY = 'onskin.notiflog.v1';
const NOW = Date.parse('2026-07-07T12:00:00.000Z');

describe('notification sent ledger', () => {
  beforeEach(() => {
    mocks.storage.clear();
  });

  it('removes unreadable local send history and treats the cap as empty', async () => {
    mocks.storage.set(KEY, '{not-json');

    await expect(sentThisWeekForTierLocal('behavioural', NOW)).resolves.toBe(0);

    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('removes wrong-shaped local send history and treats the cap as empty', async () => {
    mocks.storage.set(KEY, JSON.stringify({ kind: 'capture', at: NOW }));

    await expect(sentThisWeekForTierLocal('behavioural', NOW)).resolves.toBe(0);

    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('drops malformed rows and derives the tier from each valid notification kind', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify([
        { kind: 'replenishment', tier: 'promotional', at: NOW - 1_000 },
        { kind: 'winback', tier: 'promotional', at: NOW - 2_000 },
        { kind: 'unknown', tier: 'behavioural', at: NOW - 3_000 },
        { kind: 'capture', tier: 'behavioural', at: 'later' },
      ]),
    );

    await expect(sentThisWeekForTierLocal('behavioural', NOW)).resolves.toBe(1);
    await expect(sentThisWeekForTierLocal('promotional', NOW)).resolves.toBe(1);

    expect(JSON.parse(mocks.storage.get(KEY) ?? '[]')).toEqual([
      { kind: 'replenishment', tier: 'behavioural', at: NOW - 1_000 },
      { kind: 'winback', tier: 'promotional', at: NOW - 2_000 },
    ]);
  });

  it('drops future-dated rows so corrupted clocks cannot suppress a tier indefinitely', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify([
        { kind: 'capture', tier: 'behavioural', at: NOW + 30 * 86_400_000 },
        { kind: 'replenishment', tier: 'behavioural', at: NOW - 1_000 },
      ]),
    );

    await expect(sentThisWeekForTierLocal('behavioural', NOW)).resolves.toBe(1);

    expect(JSON.parse(mocks.storage.get(KEY) ?? '[]')).toEqual([
      { kind: 'replenishment', tier: 'behavioural', at: NOW - 1_000 },
    ]);
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

    expect(JSON.parse(mocks.storage.get(KEY) ?? '[]')).toEqual([
      { kind: 'rampup', tier: 'behavioural', at: NOW - 2 * 86_400_000 },
      { kind: 'replenishment', tier: 'behavioural', at: NOW },
    ]);
  });
});
