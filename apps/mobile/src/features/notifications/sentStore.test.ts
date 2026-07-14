import type { NotificationKind, NotificationTier } from '@onskin/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrivateKVReadResult } from '@/lib/storage/privateKV';

import {
  MAX_SENT_LEDGER_CHARS,
  MAX_SENT_LEDGER_RECORDS,
  readSentLedger,
  recordSentLocal,
  SENT_LEDGER_INVALID,
  SENT_LEDGER_UNSUPPORTED_VERSION,
  SENT_LEDGER_WRITE_UNCERTAIN,
  sentThisWeekForTierLocal,
  type SentRecord,
} from './sentStore';

const mocks = vi.hoisted(() => ({
  readFailure: null as Error | null,
  readOverride: null as PrivateKVReadResult | null,
  storage: new Map<string, string>(),
  tails: new Map<string, Promise<void>>(),
  updateFailure: null as Error | null,
  updateFailureAfterCommit: null as Error | null,
  updateCalls: 0,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  readPrivateItem: vi.fn(async (key: string): Promise<PrivateKVReadResult> => {
    if (mocks.readFailure) throw mocks.readFailure;
    if (mocks.readOverride) return mocks.readOverride;
    const value = mocks.storage.get(key);
    return value === undefined ? { status: 'absent' } : { status: 'available', value };
  }),
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.storage.delete(key);
  }),
  updatePrivateItem: vi.fn(
    async (key: string, updater: (current: string | null) => string | null) => {
      mocks.updateCalls += 1;
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
        if (mocks.updateFailureAfterCommit) throw mocks.updateFailureAfterCommit;
      } finally {
        release();
        if (mocks.tails.get(key) === tail) mocks.tails.delete(key);
      }
    },
  ),
}));

const KEY = 'onskin.notiflog.v1';
const NOW = Date.parse('2026-07-07T12:00:00.000Z');

function v1(records: SentRecord[]): string {
  return JSON.stringify({ version: 1, records });
}

function parseStoredRecords(): SentRecord[] {
  return (JSON.parse(mocks.storage.get(KEY) ?? '{}') as { records: SentRecord[] }).records;
}

describe('notification sent ledger', () => {
  beforeEach(() => {
    mocks.readFailure = null;
    mocks.readOverride = null;
    mocks.storage.clear();
    mocks.tails.clear();
    mocks.updateFailure = null;
    mocks.updateFailureAfterCommit = null;
    mocks.updateCalls = 0;
  });

  it('distinguishes an absent ledger from an available empty ledger', async () => {
    await expect(readSentLedger()).resolves.toEqual({ status: 'absent', records: [] });
    await expect(sentThisWeekForTierLocal('behavioural', NOW)).resolves.toEqual({
      status: 'absent',
      count: 0,
    });

    mocks.storage.set(KEY, v1([]));
    await expect(readSentLedger()).resolves.toEqual({
      status: 'available',
      records: [],
      format: 'v1',
    });
    await expect(sentThisWeekForTierLocal('behavioural', NOW)).resolves.toEqual({
      status: 'available',
      count: 0,
    });
  });

  it.each([
    {
      stored: { status: 'unavailable', reason: 'content_key_missing' } as const,
      ledger: {
        status: 'unavailable',
        records: null,
        reason: 'content_key_missing',
      },
      count: {
        status: 'unavailable',
        count: null,
        reason: 'content_key_missing',
      },
    },
    {
      stored: { status: 'corrupt', reason: 'decryption_failed' } as const,
      ledger: { status: 'corrupt', records: null, reason: 'decryption_failed' },
      count: { status: 'corrupt', count: null, reason: 'decryption_failed' },
    },
    {
      stored: { status: 'unsupported_version' } as const,
      ledger: { status: 'unsupported_version', records: null },
      count: { status: 'unsupported_version', count: null },
    },
  ])('propagates the private five-state read result without inventing history', async (testCase) => {
    const original = v1([{ kind: 'rampup', tier: 'behavioural', at: NOW }]);
    mocks.storage.set(KEY, original);
    mocks.readOverride = testCase.stored;

    await expect(readSentLedger()).resolves.toEqual(testCase.ledger);
    await expect(sentThisWeekForTierLocal('behavioural', NOW)).resolves.toEqual(testCase.count);
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('maps an unexpected typed-read rejection to unavailable without changing bytes', async () => {
    const original = v1([{ kind: 'rampup', tier: 'behavioural', at: NOW }]);
    mocks.storage.set(KEY, original);
    mocks.readFailure = new Error('native storage interrupted');

    await expect(readSentLedger()).resolves.toEqual({
      status: 'unavailable',
      records: null,
      reason: 'storage_unavailable',
    });
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('preserves malformed and future-version bytes with distinct typed results', async () => {
    for (const [raw, expected, expectedCount] of [
      [
        '{not-json',
        { status: 'corrupt', records: null, reason: 'invalid_payload' },
        { status: 'corrupt', count: null, reason: 'invalid_payload' },
      ],
      [
        JSON.stringify({ version: 2, records: [] }),
        { status: 'unsupported_version', records: null },
        { status: 'unsupported_version', count: null },
      ],
    ] as const) {
      mocks.storage.set(KEY, raw);

      await expect(readSentLedger()).resolves.toEqual(expected);
      await expect(sentThisWeekForTierLocal('behavioural', NOW)).resolves.toEqual(expectedCount);
      expect(mocks.storage.get(KEY)).toBe(raw);
    }
  });

  it('reads strict v0 arrays without rewriting and canonicalizes a valid legacy tier', async () => {
    const original = JSON.stringify([
      { kind: 'replenishment', tier: 'promotional', at: NOW - 1_000 },
      { kind: 'winback', tier: 'promotional', at: NOW - 2_000 },
    ]);
    mocks.storage.set(KEY, original);

    await expect(readSentLedger()).resolves.toEqual({
      status: 'available',
      format: 'v0',
      records: [
        { kind: 'replenishment', tier: 'behavioural', at: NOW - 1_000 },
        { kind: 'winback', tier: 'promotional', at: NOW - 2_000 },
      ],
    });
    await expect(sentThisWeekForTierLocal('behavioural', NOW)).resolves.toEqual({
      status: 'available',
      count: 1,
    });
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it.each([
    [{ kind: 'unknown', tier: 'behavioural', at: NOW }],
    [{ kind: 'rampup', tier: 'unknown', at: NOW }],
    [{ kind: 'rampup', tier: 'behavioural', at: -1 }],
    [{ kind: 'rampup', tier: 'behavioural', at: NOW + 0.5 }],
    [{ kind: 'rampup', tier: 'behavioural', at: NOW, extra: true }],
  ])('rejects a malformed v0 record atomically', async (records) => {
    const original = JSON.stringify(records);
    mocks.storage.set(KEY, original);

    await expect(readSentLedger()).resolves.toEqual({
      status: 'corrupt',
      records: null,
      reason: 'invalid_payload',
    });
    await expect(recordSentLocal('capture', NOW)).rejects.toThrow(SENT_LEDGER_INVALID);
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('requires canonical tiers and exact records in the v1 envelope', async () => {
    for (const raw of [
      v1([{ kind: 'replenishment', tier: 'promotional', at: NOW }]),
      JSON.stringify({
        version: 1,
        records: [{ kind: 'rampup', tier: 'behavioural', at: NOW, extra: true }],
      }),
    ]) {
      mocks.storage.set(KEY, raw);
      await expect(readSentLedger()).resolves.toEqual({
        status: 'corrupt',
        records: null,
        reason: 'invalid_payload',
      });
      expect(mocks.storage.get(KEY)).toBe(raw);
    }
  });

  it('ignores future rows on a read and prunes them only during an explicit append', async () => {
    const original = v1([
      { kind: 'capture', tier: 'behavioural', at: NOW + 30 * 86_400_000 },
      { kind: 'replenishment', tier: 'behavioural', at: NOW - 1_000 },
    ]);
    mocks.storage.set(KEY, original);

    await expect(sentThisWeekForTierLocal('behavioural', NOW)).resolves.toEqual({
      status: 'available',
      count: 1,
    });
    expect(mocks.storage.get(KEY)).toBe(original);

    await recordSentLocal('rampup', NOW);
    expect(parseStoredRecords()).toEqual([
      { kind: 'replenishment', tier: 'behavioural', at: NOW - 1_000 },
      { kind: 'rampup', tier: 'behavioural', at: NOW },
    ]);
  });

  it('prunes old rows and migrates v0 only inside an explicit atomic append', async () => {
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

  it('keeps the newest bounded history when appending at the record ceiling', async () => {
    const existing = Array.from({ length: MAX_SENT_LEDGER_RECORDS }, (_, index) => ({
      kind: 'rampup' as const,
      tier: 'behavioural' as const,
      at: NOW - (MAX_SENT_LEDGER_RECORDS - index),
    }));
    mocks.storage.set(KEY, v1(existing));

    await recordSentLocal('replenishment', NOW);

    const records = parseStoredRecords();
    expect(records).toHaveLength(MAX_SENT_LEDGER_RECORDS);
    expect(records[0]?.at).toBe(NOW - (MAX_SENT_LEDGER_RECORDS - 1));
    expect(records.at(-1)).toEqual({ kind: 'replenishment', tier: 'behavioural', at: NOW });
  });

  it('rejects oversized record counts and payloads without repairing them', async () => {
    const tooMany = v1(
      Array.from({ length: MAX_SENT_LEDGER_RECORDS + 1 }, (_, index) => ({
        kind: 'rampup' as const,
        tier: 'behavioural' as const,
        at: NOW - index,
      })),
    );
    const oversizedText = ` ${'x'.repeat(MAX_SENT_LEDGER_CHARS)}`;

    for (const raw of [tooMany, oversizedText]) {
      mocks.storage.set(KEY, raw);
      await expect(readSentLedger()).resolves.toEqual({
        status: 'corrupt',
        records: null,
        reason: 'invalid_payload',
      });
      expect(mocks.storage.get(KEY)).toBe(raw);
    }
  });

  it('serializes 100 simultaneous appends without losing or exceeding a writer', async () => {
    const kinds: NotificationKind[] = ['replenishment', 'rampup', 'winback', 'capture'];

    await Promise.all(
      Array.from({ length: 100 }, (_, index) => {
        return recordSentLocal(kinds[index % kinds.length]!, NOW + index);
      }),
    );

    const result = await readSentLedger();
    expect(result.status).toBe('available');
    if (result.status !== 'available') throw new Error('expected available sent ledger');
    expect(result.format).toBe('v1');
    expect(result.records).toHaveLength(100);
    expect(new Set(result.records.map((record) => record.at))).toHaveLength(100);
    await expect(sentThisWeekForTierLocal('behavioural', NOW + 100)).resolves.toEqual({
      status: 'available',
      count: 75,
    });
    await expect(sentThisWeekForTierLocal('promotional', NOW + 100)).resolves.toEqual({
      status: 'available',
      count: 25,
    });
  });

  it('leaves prior bytes intact when an atomic write fails', async () => {
    await recordSentLocal('capture', NOW);
    const original = mocks.storage.get(KEY);
    mocks.updateFailure = new Error('PRIVATE_WRITE_FAILED');

    await expect(recordSentLocal('rampup', NOW + 1)).rejects.toThrow('PRIVATE_WRITE_FAILED');

    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('reconciles a lost commit response only from exact plaintext readback', async () => {
    mocks.updateFailureAfterCommit = new Error('PRIVATE_WRITE_RESULT_UNKNOWN');

    await expect(recordSentLocal('rampup', NOW)).resolves.toBeUndefined();

    expect(parseStoredRecords()).toEqual([
      { kind: 'rampup', tier: 'behavioural', at: NOW },
    ]);
  });

  it.each([
    { status: 'available', value: v1([]) } as const,
    { status: 'unavailable', reason: 'storage_unavailable' } as const,
  ])('reports write uncertainty for non-matching commit readback %#', async (readback) => {
    mocks.updateFailureAfterCommit = new Error('PRIVATE_WRITE_RESULT_UNKNOWN');
    mocks.readOverride = readback;

    await expect(recordSentLocal('rampup', NOW)).rejects.toThrow(
      SENT_LEDGER_WRITE_UNCERTAIN,
    );
  });

  it('rejects future-version mutation without replacing its bytes', async () => {
    const original = JSON.stringify({ version: 2, records: [] });
    mocks.storage.set(KEY, original);

    await expect(recordSentLocal('capture', NOW)).rejects.toThrow(
      SENT_LEDGER_UNSUPPORTED_VERSION,
    );
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('validates public kind, tier, and time inputs before starting a write', async () => {
    const invalidTier = 'unknown' as NotificationTier;
    const invalidKind = 'toString' as NotificationKind;

    await expect(recordSentLocal(invalidKind, NOW)).rejects.toThrow(SENT_LEDGER_INVALID);
    await expect(recordSentLocal('rampup', -1)).rejects.toThrow(SENT_LEDGER_INVALID);
    await expect(recordSentLocal('rampup', NOW + 0.5)).rejects.toThrow(SENT_LEDGER_INVALID);
    await expect(sentThisWeekForTierLocal(invalidTier, NOW)).rejects.toThrow(SENT_LEDGER_INVALID);
    await expect(sentThisWeekForTierLocal('behavioural', Number.NaN)).rejects.toThrow(
      SENT_LEDGER_INVALID,
    );

    expect(mocks.updateCalls).toBe(0);
    expect(mocks.storage.has(KEY)).toBe(false);
  });
});
