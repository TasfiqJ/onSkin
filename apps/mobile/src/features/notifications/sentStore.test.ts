import type { NotificationKind, NotificationTier } from '@onskin/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrivateKVReadResult } from '@/lib/storage/privateKV';
import {
  MAX_NOTIFICATION_DELIVERY_OUTBOX_ROWS,
  MAX_OUTBOX_ROWS,
  OUTBOX_STORAGE_KEY,
  decodeOutboxEnvelope,
  emptyOutboxEnvelope,
  encodeOutboxEnvelope,
  enqueueNotificationDeliveryOutboxOperation,
  enqueueShelfOutboxOperation,
  type OutboxEnvelope,
} from '@/lib/offline/outbox.pure';

import {
  confirmSentLocalDelivery,
  MAX_SENT_LEDGER_CHARS,
  MAX_SENT_LEDGER_RECORDS,
  readSentLedger,
  recordSentLocal,
  reserveSentLocal,
  SENT_LEDGER_INVALID,
  SENT_LEDGER_UNSUPPORTED_VERSION,
  SENT_LEDGER_WRITE_UNCERTAIN,
  sentThisWeekForTierLocal,
  type SentRecord,
} from './sentStore';

const mocks = vi.hoisted(() => ({
  hashOutboxOwner: vi.fn(async () => 'a'.repeat(64)),
  readFailure: null as Error | null,
  readOverride: null as PrivateKVReadResult | null,
  storage: new Map<string, string>(),
  tails: new Map<string, Promise<void>>(),
  updateFailure: null as Error | null,
  updateFailureAfterCommit: null as Error | null,
  updateCalls: 0,
  transactionFailureAfterCommit: null as Error | null,
  transactionFailureBeforeCommit: null as Error | null,
}));

vi.mock('@/lib/offline/outboxIdentity', () => ({
  hashOutboxOwner: mocks.hashOutboxOwner,
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
  updatePrivateItemsTransactionally: vi.fn(
    async (
      keys: readonly string[],
      updater: (current: ReadonlyMap<string, string | null>) => ReadonlyMap<string, string | null>,
    ) => {
      const current = new Map(keys.map((key) => [key, mocks.storage.get(key) ?? null]));
      const next = updater(current);
      if (mocks.transactionFailureBeforeCommit) throw mocks.transactionFailureBeforeCommit;
      for (const [key, value] of next) {
        if (value === null) mocks.storage.delete(key);
        else mocks.storage.set(key, value);
      }
      if (mocks.transactionFailureAfterCommit) throw mocks.transactionFailureAfterCommit;
    },
  ),
}));

const KEY = 'onskin.notiflog.v1';
const NOW = Date.parse('2026-07-07T12:00:00.000Z');
const OWNER_HASH = 'a'.repeat(64);
const FOREIGN_OWNER_HASH = 'b'.repeat(64);
const SHELF_PAYLOAD = {
  catalog_product_id: null,
  catalog_source_id: null,
  catalog_match_quality: 'manual',
  catalog_source_snapshot_date: null,
  manual_name: 'Capacity fixture',
  manual_brand: null,
  barcode: null,
  opened_at: null,
  pao_months: null,
  expiry_date: null,
  is_opened: false,
  pao_source: 'unknown',
  expiry_source: 'unknown',
  added_via: 'manual',
  source_disclosure_ack_at: null,
  status: 'active',
  finished_at: null,
} as const;

type LegacySentRecord = Omit<SentRecord, 'eventId' | 'state'>;

function v1(records: LegacySentRecord[]): string {
  return JSON.stringify({ version: 1, records });
}

function parseStoredRecords(): SentRecord[] {
  return (JSON.parse(mocks.storage.get(KEY) ?? '{}') as { records: SentRecord[] }).records;
}

function recordSummaries(records: readonly SentRecord[]): LegacySentRecord[] {
  return records.map(({ kind, tier, at }) => ({ kind, tier, at }));
}

function uuid(value: number): string {
  return `00000000-0000-4000-8000-${value.toString().padStart(12, '0')}`;
}

function withOutboxState(envelope: OutboxEnvelope, state: 'dead' | 'leased' | 'ready'): string {
  const persisted = JSON.parse(encodeOutboxEnvelope(envelope)) as {
    rows: {
      state: string;
      lastErrorClass: string | null;
      leaseOwner: string | null;
      leaseExpiresAt: string | null;
    }[];
  };
  for (const row of persisted.rows) {
    row.state = state;
    row.lastErrorClass = state === 'dead' ? 'validation' : null;
    row.leaseOwner = state === 'leased' ? uuid(900_000) : null;
    row.leaseExpiresAt = state === 'leased' ? new Date(NOW + 30_000).toISOString() : null;
  }
  return encodeOutboxEnvelope(decodeOutboxEnvelope(JSON.stringify(persisted)));
}

function saturatedNotificationDeliveryOutbox(
  state: 'dead' | 'leased' | 'ready',
  ownerHash = OWNER_HASH,
): string {
  let envelope = emptyOutboxEnvelope();
  for (let index = 0; index < MAX_NOTIFICATION_DELIVERY_OUTBOX_ROWS; index += 1) {
    const sentAt = new Date(NOW - MAX_NOTIFICATION_DELIVERY_OUTBOX_ROWS + index).toISOString();
    envelope = enqueueNotificationDeliveryOutboxOperation(envelope, {
      operationId: uuid(100_000 + index),
      ownerHash,
      ownerGeneration: 7,
      entityId: uuid(200_000 + index),
      payload: {
        kind: 'capture',
        tier: 'behavioural',
        sent_at: sentAt,
      },
      enqueuedAt: sentAt,
    }).envelope;
  }
  return withOutboxState(envelope, state);
}

function saturatedDeadMutableOutbox(): string {
  let envelope = emptyOutboxEnvelope();
  for (let index = 0; index < MAX_OUTBOX_ROWS; index += 1) {
    envelope = enqueueShelfOutboxOperation(envelope, {
      operationId: uuid(300_000 + index),
      ownerHash: OWNER_HASH,
      ownerGeneration: 7,
      entityId: uuid(400_000 + index),
      operationKind: 'upsert',
      payload: SHELF_PAYLOAD,
      enqueuedAt: new Date(NOW - MAX_OUTBOX_ROWS + index).toISOString(),
    }).envelope;
  }
  return withOutboxState(envelope, 'dead');
}

describe('notification sent ledger', () => {
  beforeEach(() => {
    mocks.readFailure = null;
    mocks.readOverride = null;
    mocks.hashOutboxOwner.mockClear();
    mocks.hashOutboxOwner.mockResolvedValue('a'.repeat(64));
    mocks.storage.clear();
    mocks.tails.clear();
    mocks.updateFailure = null;
    mocks.updateFailureAfterCommit = null;
    mocks.updateCalls = 0;
    mocks.transactionFailureAfterCommit = null;
    mocks.transactionFailureBeforeCommit = null;
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
  ])(
    'propagates the private five-state read result without inventing history',
    async (testCase) => {
      const original = v1([{ kind: 'rampup', tier: 'behavioural', at: NOW }]);
      mocks.storage.set(KEY, original);
      mocks.readOverride = testCase.stored;

      await expect(readSentLedger()).resolves.toEqual(testCase.ledger);
      await expect(sentThisWeekForTierLocal('behavioural', NOW)).resolves.toEqual(testCase.count);
      expect(mocks.storage.get(KEY)).toBe(original);
    },
  );

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
        JSON.stringify({ version: 3, records: [] }),
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

    const result = await readSentLedger();
    expect(result.status).toBe('available');
    if (result.status !== 'available') throw new Error('expected available ledger');
    expect(result.format).toBe('v0');
    expect(recordSummaries(result.records)).toEqual([
      { kind: 'replenishment', tier: 'behavioural', at: NOW - 1_000 },
      { kind: 'winback', tier: 'promotional', at: NOW - 2_000 },
    ]);
    expect(result.records.every((record) => record.state === 'delivered')).toBe(true);
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

  it('requires unique UUID event identity and exact reserved/delivered state in v2', async () => {
    const eventId = '00000000-0000-4000-8000-000000000120';
    const valid = {
      eventId,
      kind: 'rampup',
      tier: 'behavioural',
      at: NOW,
      state: 'reserved',
    };
    for (const records of [
      [{ ...valid, eventId: 'not-a-uuid' }],
      [{ ...valid, state: 'unknown' }],
      [valid, { ...valid }],
      [{ ...valid, extra: true }],
    ]) {
      const raw = JSON.stringify({ version: 2, records });
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
    expect(recordSummaries(parseStoredRecords())).toEqual([
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
      version: 2,
      records: expect.arrayContaining([
        expect.objectContaining({
          kind: 'rampup',
          tier: 'behavioural',
          at: NOW - 2 * 86_400_000,
          state: 'delivered',
        }),
        expect.objectContaining({
          kind: 'replenishment',
          tier: 'behavioural',
          at: NOW,
          state: 'delivered',
        }),
      ]),
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
    expect(records.at(-1)).toMatchObject({
      kind: 'replenishment',
      tier: 'behavioural',
      at: NOW,
      state: 'delivered',
    });
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
    expect(result.format).toBe('v2');
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

  it('counts reserved rows and transitions only the exact event after native acceptance', async () => {
    const eventId = '00000000-0000-4000-8000-000000000111';
    await reserveSentLocal(eventId, 'replenishment', NOW);

    await expect(sentThisWeekForTierLocal('behavioural', NOW)).resolves.toEqual({
      status: 'available',
      count: 1,
    });
    expect(parseStoredRecords()).toEqual([
      {
        eventId,
        kind: 'replenishment',
        tier: 'behavioural',
        at: NOW,
        state: 'reserved',
      },
    ]);

    await expect(
      confirmSentLocalDelivery({
        eventId,
        operationId: '00000000-0000-4000-8000-000000000211',
        kind: 'replenishment',
        at: NOW,
      }),
    ).resolves.toEqual({ changed: true, outboxQueued: false });
    expect(parseStoredRecords()[0]).toMatchObject({ eventId, state: 'delivered' });
  });

  it('atomically confirms an authenticated delivery with one exact content-free outbox event', async () => {
    const eventId = '00000000-0000-4000-8000-000000000112';
    const operationId = '00000000-0000-4000-8000-000000000212';
    const owner = { ownerId: 'owner-a', ownerGeneration: 7, assertCurrent: vi.fn() };
    await reserveSentLocal(eventId, 'winback', NOW);

    await expect(
      confirmSentLocalDelivery({ eventId, operationId, kind: 'winback', at: NOW, owner }),
    ).resolves.toEqual({ changed: true, outboxQueued: true });

    expect(parseStoredRecords()[0]).toMatchObject({ eventId, state: 'delivered' });
    expect(decodeOutboxEnvelope(mocks.storage.get(OUTBOX_STORAGE_KEY) ?? null).rows).toEqual([
      expect.objectContaining({
        operationId,
        ownerHash: 'a'.repeat(64),
        ownerGeneration: 7,
        entityType: 'notification_delivery',
        entityId: eventId,
        clientRevision: 1,
        idempotencyKey: `notification_delivery:${operationId}:winback:${new Date(NOW).toISOString()}`,
        payload: {
          kind: 'winback',
          tier: 'promotional',
          sent_at: new Date(NOW).toISOString(),
        },
      }),
    ]);

    const ledgerBefore = mocks.storage.get(KEY);
    const outboxBefore = mocks.storage.get(OUTBOX_STORAGE_KEY);
    await expect(
      confirmSentLocalDelivery({
        eventId,
        operationId: '00000000-0000-4000-8000-000000000213',
        kind: 'winback',
        at: NOW,
        owner,
      }),
    ).resolves.toEqual({ changed: false, outboxQueued: false });
    expect(mocks.storage.get(KEY)).toBe(ledgerBefore);
    expect(mocks.storage.get(OUTBOX_STORAGE_KEY)).toBe(outboxBefore);
  });

  it('atomically confirms delivery by reclaiming the oldest current-owner dead immutable event at the exact cap', async () => {
    const eventId = '00000000-0000-4000-8000-000000000117';
    const operationId = '00000000-0000-4000-8000-000000000218';
    const oldestOperationId = uuid(100_000);
    await reserveSentLocal(eventId, 'rampup', NOW);
    mocks.storage.set(OUTBOX_STORAGE_KEY, saturatedNotificationDeliveryOutbox('dead'));

    await expect(
      confirmSentLocalDelivery({
        eventId,
        operationId,
        kind: 'rampup',
        at: NOW,
        owner: { ownerId: 'owner-a', ownerGeneration: 7 },
      }),
    ).resolves.toEqual({ changed: true, outboxQueued: true });

    expect(parseStoredRecords()).toEqual([
      expect.objectContaining({ eventId, state: 'delivered' }),
    ]);
    const persisted = decodeOutboxEnvelope(mocks.storage.get(OUTBOX_STORAGE_KEY) ?? null);
    expect(persisted.rows).toHaveLength(MAX_NOTIFICATION_DELIVERY_OUTBOX_ROWS);
    expect(persisted.revisions).toHaveLength(MAX_NOTIFICATION_DELIVERY_OUTBOX_ROWS);
    expect(persisted.rows.some((row) => row.operationId === oldestOperationId)).toBe(false);
    expect(persisted.rows).toContainEqual(
      expect.objectContaining({
        operationId,
        ownerHash: OWNER_HASH,
        ownerGeneration: 7,
        entityType: 'notification_delivery',
        entityId: eventId,
        clientRevision: 1,
        state: 'ready',
        payload: {
          kind: 'rampup',
          tier: 'behavioural',
          sent_at: new Date(NOW).toISOString(),
        },
      }),
    );
  });

  it.each([
    {
      saturation: 'live current-owner immutable events',
      fixture: () => saturatedNotificationDeliveryOutbox('ready'),
    },
    {
      saturation: 'leased current-owner immutable events',
      fixture: () => saturatedNotificationDeliveryOutbox('leased'),
    },
    {
      saturation: 'foreign dead immutable events',
      fixture: () => saturatedNotificationDeliveryOutbox('dead', FOREIGN_OWNER_HASH),
    },
    {
      saturation: 'current-owner dead mutable rows',
      fixture: saturatedDeadMutableOutbox,
    },
  ])(
    'preserves reserved-ledger and outbox bytes under non-reclaimable $saturation',
    async ({ fixture }) => {
      const eventId = '00000000-0000-4000-8000-000000000118';
      const operationId = '00000000-0000-4000-8000-000000000219';
      await reserveSentLocal(eventId, 'capture', NOW);
      mocks.storage.set(OUTBOX_STORAGE_KEY, fixture());
      const ledgerBefore = mocks.storage.get(KEY);
      const outboxBefore = mocks.storage.get(OUTBOX_STORAGE_KEY);

      await expect(
        confirmSentLocalDelivery({
          eventId,
          operationId,
          kind: 'capture',
          at: NOW,
          owner: { ownerId: 'owner-a', ownerGeneration: 7 },
        }),
      ).rejects.toThrow(SENT_LEDGER_WRITE_UNCERTAIN);

      expect(mocks.storage.get(KEY)).toBe(ledgerBefore);
      expect(mocks.storage.get(OUTBOX_STORAGE_KEY)).toBe(outboxBefore);
      expect(parseStoredRecords()).toEqual([
        expect.objectContaining({ eventId, state: 'reserved' }),
      ]);
      expect(
        decodeOutboxEnvelope(mocks.storage.get(OUTBOX_STORAGE_KEY) ?? null).rows.some(
          (row) => row.operationId === operationId,
        ),
      ).toBe(false);
    },
  );

  it('confirms an authenticated commit only when both transaction values match after response loss', async () => {
    const eventId = '00000000-0000-4000-8000-000000000113';
    await reserveSentLocal(eventId, 'rampup', NOW);
    mocks.transactionFailureAfterCommit = new Error('PRIVATE_TRANSACTION_RESULT_UNKNOWN');

    await expect(
      confirmSentLocalDelivery({
        eventId,
        operationId: '00000000-0000-4000-8000-000000000214',
        kind: 'rampup',
        at: NOW,
        owner: { ownerId: 'owner-a', ownerGeneration: 7 },
      }),
    ).resolves.toEqual({ changed: true, outboxQueued: true });
    expect(parseStoredRecords()[0]).toMatchObject({ state: 'delivered' });
    expect(decodeOutboxEnvelope(mocks.storage.get(OUTBOX_STORAGE_KEY) ?? null).rows).toHaveLength(
      1,
    );
  });

  it('rejects a stale owner before hashing or changing reserved/outbox bytes', async () => {
    const eventId = '00000000-0000-4000-8000-000000000114';
    const stale = new Error('ACCOUNT_GENERATION_CHANGED');
    const assertCurrent = vi.fn(() => {
      throw stale;
    });
    await reserveSentLocal(eventId, 'rampup', NOW);
    const ledgerBefore = mocks.storage.get(KEY);

    await expect(
      confirmSentLocalDelivery({
        eventId,
        operationId: '00000000-0000-4000-8000-000000000215',
        kind: 'rampup',
        at: NOW,
        owner: { ownerId: 'owner-a', ownerGeneration: 7, assertCurrent },
      }),
    ).rejects.toBe(stale);

    expect(mocks.hashOutboxOwner).not.toHaveBeenCalled();
    expect(mocks.storage.get(KEY)).toBe(ledgerBefore);
    expect(parseStoredRecords()[0]).toMatchObject({ state: 'reserved' });
    expect(mocks.storage.has(OUTBOX_STORAGE_KEY)).toBe(false);
  });

  it('rechecks the owner inside the transaction before changing either key', async () => {
    const eventId = '00000000-0000-4000-8000-000000000115';
    const stale = new Error('ACCOUNT_GENERATION_CHANGED');
    const assertCurrent = vi
      .fn()
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => {
        throw stale;
      });
    await reserveSentLocal(eventId, 'rampup', NOW);
    const ledgerBefore = mocks.storage.get(KEY);

    await expect(
      confirmSentLocalDelivery({
        eventId,
        operationId: '00000000-0000-4000-8000-000000000216',
        kind: 'rampup',
        at: NOW,
        owner: { ownerId: 'owner-a', ownerGeneration: 7, assertCurrent },
      }),
    ).rejects.toBe(stale);

    expect(mocks.hashOutboxOwner).toHaveBeenCalledOnce();
    expect(mocks.storage.get(KEY)).toBe(ledgerBefore);
    expect(parseStoredRecords()[0]).toMatchObject({ state: 'reserved' });
    expect(mocks.storage.has(OUTBOX_STORAGE_KEY)).toBe(false);
  });

  it('keeps the reserved row and prior outbox when the two-key commit fails', async () => {
    const eventId = '00000000-0000-4000-8000-000000000116';
    await reserveSentLocal(eventId, 'replenishment', NOW);
    const ledgerBefore = mocks.storage.get(KEY);
    const outboxBefore = mocks.storage.get(OUTBOX_STORAGE_KEY);
    mocks.transactionFailureBeforeCommit = new Error('PRIVATE_TRANSACTION_FAILED');

    await expect(
      confirmSentLocalDelivery({
        eventId,
        operationId: '00000000-0000-4000-8000-000000000217',
        kind: 'replenishment',
        at: NOW,
        owner: { ownerId: 'owner-a', ownerGeneration: 7 },
      }),
    ).rejects.toThrow(SENT_LEDGER_WRITE_UNCERTAIN);

    expect(mocks.storage.get(KEY)).toBe(ledgerBefore);
    expect(parseStoredRecords()[0]).toMatchObject({ state: 'reserved' });
    expect(mocks.storage.get(OUTBOX_STORAGE_KEY)).toBe(outboxBefore);
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

    expect(recordSummaries(parseStoredRecords())).toEqual([
      { kind: 'rampup', tier: 'behavioural', at: NOW },
    ]);
  });

  it.each([
    { status: 'available', value: v1([]) } as const,
    { status: 'unavailable', reason: 'storage_unavailable' } as const,
  ])('reports write uncertainty for non-matching commit readback %#', async (readback) => {
    mocks.updateFailureAfterCommit = new Error('PRIVATE_WRITE_RESULT_UNKNOWN');
    mocks.readOverride = readback;

    await expect(recordSentLocal('rampup', NOW)).rejects.toThrow(SENT_LEDGER_WRITE_UNCERTAIN);
  });

  it('rejects future-version mutation without replacing its bytes', async () => {
    const original = JSON.stringify({ version: 3, records: [] });
    mocks.storage.set(KEY, original);

    await expect(recordSentLocal('capture', NOW)).rejects.toThrow(SENT_LEDGER_UNSUPPORTED_VERSION);
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
