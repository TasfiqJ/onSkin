import { describe, expect, it } from 'vitest';

import {
  OUTBOX_INVALID,
  OUTBOX_LEGACY_SCHEMA_VERSIONS,
  OUTBOX_LIMIT_REACHED,
  OUTBOX_SCHEMA_VERSION,
  OUTBOX_UNSUPPORTED_VERSION,
  MAX_OUTBOX_REVISIONS,
  MAX_OUTBOX_ROWS,
  MAX_SHELF_SCAN_OUTBOX_ROWS,
  decodeOutboxEnvelope,
  conflictChoiceIdentityHashInput,
  conflictChoicePayloadHashInput,
  discardConflictChoiceOutboxDependencies,
  emptyOutboxEnvelope,
  encodeOutboxEnvelope,
  enqueueNotificationDeliveryOutboxOperation,
  enqueueNotificationPreferencesOutboxOperation,
  enqueueRecommendationPreferencesOutboxOperation,
  enqueueShelfScanOutboxOperation,
  enqueueShelfOutboxOperation,
  enqueueConflictChoiceOutboxOperation,
  leaseReadyOutboxRows,
  nextOutboxWakeAt,
  outboxCounts,
  outboxEntityIdFromSha256,
  retryDeadOutboxRows,
  selectOutboxOwnerStatus,
  shelfScanPayloadHashInput,
  settleOutboxLease,
  type OutboxEnvelope,
} from './outbox.pure';

const OWNER = 'a'.repeat(64);
const OWNER_B = 'b'.repeat(64);
const ENTITY_A = '00000000-0000-4000-8000-000000000001';
const ENTITY_B = '00000000-0000-4000-8000-000000000002';
const OP_A1 = '00000000-0000-4000-8000-000000000101';
const OP_A2 = '00000000-0000-4000-8000-000000000102';
const OP_B1 = '00000000-0000-4000-8000-000000000201';
const WORKER_A = '00000000-0000-4000-8000-000000000301';
const WORKER_B = '00000000-0000-4000-8000-000000000302';
const NOW = '2026-07-18T15:00:00.000Z';
const SHELF_PAYLOAD = {
  catalog_product_id: null,
  catalog_source_id: null,
  catalog_match_quality: 'manual',
  catalog_source_snapshot_date: null,
  manual_name: 'Cleanser',
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
const NOTIFICATION_PAYLOAD = {
  am_reminder_time: '07:30',
  pm_reminder_time: '21:30',
  am_reminder_enabled: true,
  pm_reminder_enabled: true,
  streak_nudges: false,
  replenishment_alerts: false,
  capture_reminders: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00',
  timezone: 'America/Toronto',
  live_activity_enabled: false,
  promotional_opt_in: false,
  lockscreen_discreet: true,
} as const;
const RECOMMENDATION_PAYLOAD = {
  values_filters: ['fragrance_free', 'vegan'],
  budget_band: 'mid',
  format_prefs: ['gel', 'cream'],
} as const;
const DELIVERY_PAYLOAD = {
  kind: 'replenishment',
  tier: 'behavioural',
  sent_at: NOW,
} as const;
const SCAN_PAYLOAD_HASH = 'c'.repeat(64);
const SCAN_PAYLOAD = {
  barcode: '1234567890123',
  result: 'matched',
  matched_product_id: '00000000-0000-4000-8000-000000000043',
  scanned_at: NOW,
} as const;
const CONFLICT_IDENTITY_HASH = 'd'.repeat(64);
const CONFLICT_PAYLOAD_HASH = 'e'.repeat(64);
const CONFLICT_ENTITY_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CONFLICT_PAYLOAD = {
  rule_id: '00000000-0000-4000-8000-000000000001',
  product_a_id: '00000000-0000-4000-8000-000000000041',
  product_b_id: '00000000-0000-4000-8000-000000000042',
  computed_severity: 'moderate',
  user_choice: 'use_together',
  rule_version: 1,
} as const;

function uuid(value: number): string {
  return `00000000-0000-4000-8000-${value.toString().padStart(12, '0')}`;
}

function enqueue(
  envelope: OutboxEnvelope,
  input: {
    operationId: string;
    entityId: string;
    operationKind?: 'delete' | 'upsert';
    payload?: Record<string, unknown> | null;
    enqueuedAt?: string;
  },
) {
  const operationKind = input.operationKind ?? 'upsert';
  return enqueueShelfOutboxOperation(envelope, {
    operationId: input.operationId,
    ownerHash: OWNER,
    ownerGeneration: 7,
    entityId: input.entityId,
    operationKind,
    payload: operationKind === 'delete' ? null : (input.payload ?? SHELF_PAYLOAD),
    enqueuedAt: input.enqueuedAt ?? NOW,
  });
}

function enqueueScan(
  envelope: OutboxEnvelope,
  input: {
    index: number;
    ownerHash?: string;
    enqueuedAt?: string;
  },
): OutboxEnvelope {
  const enqueuedAt = input.enqueuedAt ?? new Date(Date.parse(NOW) + input.index).toISOString();
  return enqueueShelfScanOutboxOperation(envelope, {
    operationId: uuid(30_000 + input.index),
    ownerHash: input.ownerHash ?? OWNER,
    ownerGeneration: 7,
    entityId: uuid(40_000 + input.index),
    payload: { ...SCAN_PAYLOAD, scanned_at: enqueuedAt },
    payloadHash: SCAN_PAYLOAD_HASH,
    enqueuedAt,
  }).envelope;
}

function markShelfScansDead(
  envelope: OutboxEnvelope,
  operationIds: readonly string[] = envelope.rows
    .filter((row) => row.entityType === 'shelf_scan')
    .map((row) => row.operationId),
): OutboxEnvelope {
  const selected = new Set(operationIds);
  const persisted = JSON.parse(encodeOutboxEnvelope(envelope)) as {
    rows: {
      operationId: string;
      state: string;
      lastErrorClass: string | null;
      leaseOwner: string | null;
      leaseExpiresAt: string | null;
    }[];
  };
  for (const row of persisted.rows) {
    if (!selected.has(row.operationId)) continue;
    row.state = 'dead';
    row.lastErrorClass = 'validation';
    row.leaseOwner = null;
    row.leaseExpiresAt = null;
  }
  return decodeOutboxEnvelope(JSON.stringify(persisted));
}

describe('transactional outbox model', () => {
  it('strictly roundtrips the current envelope and preserves future/corrupt bytes', () => {
    const queued = enqueue(emptyOutboxEnvelope(), {
      operationId: OP_A1,
      entityId: ENTITY_A,
    }).envelope;
    expect(decodeOutboxEnvelope(encodeOutboxEnvelope(queued))).toEqual(queued);
    expect(OUTBOX_LEGACY_SCHEMA_VERSIONS).toEqual([1, 2, 3, 4]);
    for (const version of OUTBOX_LEGACY_SCHEMA_VERSIONS) {
      const legacy = JSON.parse(encodeOutboxEnvelope(queued)) as {
        version: number;
        revisions: Record<string, unknown>[];
      };
      legacy.version = version;
      if (version === 1) {
        legacy.revisions = legacy.revisions.map(
          ({ ownerHash: _ownerHash, ...revision }) => revision,
        );
      }
      expect(decodeOutboxEnvelope(JSON.stringify(legacy))).toEqual(queued);
    }
    expect(() => decodeOutboxEnvelope('{bad-json')).toThrow(OUTBOX_INVALID);
    expect(() =>
      decodeOutboxEnvelope(
        JSON.stringify({ version: OUTBOX_SCHEMA_VERSION + 1, rows: [], revisions: [] }),
      ),
    ).toThrow(OUTBOX_UNSUPPORTED_VERSION);
  });

  it('rejects identity or credential material inside an otherwise valid payload', () => {
    expect(() =>
      enqueue(emptyOutboxEnvelope(), {
        operationId: OP_A1,
        entityId: ENTITY_A,
        payload: { ...SHELF_PAYLOAD, user_id: 'raw-owner' },
      }),
    ).toThrow(OUTBOX_INVALID);
  });

  it('accepts the exact Shelf RPC payload at its UTF-8, UUID, date, and PAO boundaries', () => {
    expect(() =>
      enqueue(emptyOutboxEnvelope(), {
        operationId: OP_A1,
        entityId: ENTITY_A,
        payload: {
          ...SHELF_PAYLOAD,
          catalog_product_id: ENTITY_A,
          catalog_source_id: ENTITY_B,
          catalog_match_quality: 'verified',
          catalog_source_snapshot_date: '2024-02-29',
          manual_name: '🧴'.repeat(128),
          manual_brand: 'é'.repeat(256),
          barcode: '1'.repeat(128),
          opened_at: '2026-07-18',
          pao_months: 1200,
          expiry_date: '2027-07-18',
          is_opened: true,
          pao_source: 'catalog',
          expiry_source: 'pao_computed',
          added_via: 'barcode',
          source_disclosure_ack_at: NOW,
          status: 'finished',
          finished_at: '2026-07-18',
        },
      }),
    ).not.toThrow();
  });

  it.each([
    [
      'missing key',
      (() => {
        const payload: Record<string, unknown> = { ...SHELF_PAYLOAD };
        delete payload.finished_at;
        return payload;
      })(),
    ],
    ['extra key', { ...SHELF_PAYLOAD, category: 'cleanser' }],
    ['empty name', { ...SHELF_PAYLOAD, manual_name: '' }],
    ['oversized UTF-8 name', { ...SHELF_PAYLOAD, manual_name: '🧴'.repeat(129) }],
    ['empty brand', { ...SHELF_PAYLOAD, manual_brand: '' }],
    ['oversized UTF-8 brand', { ...SHELF_PAYLOAD, manual_brand: 'é'.repeat(257) }],
    ['empty barcode', { ...SHELF_PAYLOAD, barcode: '' }],
    ['oversized UTF-8 barcode', { ...SHELF_PAYLOAD, barcode: 'é'.repeat(65) }],
    ['invalid catalog product UUID', { ...SHELF_PAYLOAD, catalog_product_id: 'catalog-1' }],
    ['invalid catalog source UUID', { ...SHELF_PAYLOAD, catalog_source_id: 'source-1' }],
    ['invalid quality', { ...SHELF_PAYLOAD, catalog_match_quality: 'trusted' }],
    ['impossible snapshot date', { ...SHELF_PAYLOAD, catalog_source_snapshot_date: '2026-02-29' }],
    ['impossible opened date', { ...SHELF_PAYLOAD, opened_at: '2026-04-31' }],
    ['invalid PAO zero', { ...SHELF_PAYLOAD, pao_months: 0 }],
    ['invalid fractional PAO', { ...SHELF_PAYLOAD, pao_months: 1.5 }],
    ['invalid PAO maximum', { ...SHELF_PAYLOAD, pao_months: 1201 }],
    ['impossible expiry date', { ...SHELF_PAYLOAD, expiry_date: '2027-02-29' }],
    ['invalid opened flag', { ...SHELF_PAYLOAD, is_opened: 1 }],
    ['invalid PAO source', { ...SHELF_PAYLOAD, pao_source: 'user' }],
    ['invalid expiry source', { ...SHELF_PAYLOAD, expiry_source: 'manual' }],
    ['invalid intake source', { ...SHELF_PAYLOAD, added_via: 'import' }],
    ['invalid disclosure timestamp', { ...SHELF_PAYLOAD, source_disclosure_ack_at: 'today' }],
    ['invalid status', { ...SHELF_PAYLOAD, status: 'deleted' }],
    ['impossible finished date', { ...SHELF_PAYLOAD, finished_at: '2026-02-30' }],
  ])('rejects a Shelf payload with %s', (_label, payload) => {
    expect(() =>
      enqueue(emptyOutboxEnvelope(), {
        operationId: OP_A1,
        entityId: ENTITY_A,
        payload,
      }),
    ).toThrow(OUTBOX_INVALID);
  });

  it('keeps notification deliveries as strict unique revision-one events', () => {
    const first = enqueueNotificationDeliveryOutboxOperation(emptyOutboxEnvelope(), {
      operationId: OP_A1,
      ownerHash: OWNER,
      ownerGeneration: 7,
      entityId: ENTITY_A,
      payload: DELIVERY_PAYLOAD,
      enqueuedAt: NOW,
    }).envelope;
    const second = enqueueNotificationDeliveryOutboxOperation(first, {
      operationId: OP_B1,
      ownerHash: OWNER,
      ownerGeneration: 7,
      entityId: ENTITY_B,
      payload: { kind: 'winback', tier: 'promotional', sent_at: NOW },
      enqueuedAt: NOW,
    }).envelope;

    expect(second.rows).toHaveLength(2);
    expect(second.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityType: 'notification_delivery',
          entityId: ENTITY_A,
          clientRevision: 1,
          idempotencyKey: `notification_delivery:${OP_A1}:replenishment:${NOW}`,
          payload: DELIVERY_PAYLOAD,
        }),
        expect.objectContaining({ entityId: ENTITY_B, clientRevision: 1 }),
      ]),
    );
    expect(() =>
      enqueueNotificationDeliveryOutboxOperation(second, {
        operationId: OP_A2,
        ownerHash: OWNER,
        ownerGeneration: 7,
        entityId: ENTITY_A,
        payload: DELIVERY_PAYLOAD,
        enqueuedAt: NOW,
      }),
    ).toThrow(OUTBOX_INVALID);

    const replayWithDifferentPayload = JSON.parse(encodeOutboxEnvelope(first)) as {
      rows: { payload: Record<string, unknown> }[];
    };
    replayWithDifferentPayload.rows[0]!.payload = {
      kind: 'rampup',
      tier: 'behavioural',
      sent_at: NOW,
    };
    expect(() => decodeOutboxEnvelope(JSON.stringify(replayWithDifferentPayload))).toThrow(
      OUTBOX_INVALID,
    );
  });

  it.each([
    { kind: 'replenishment', tier: 'promotional', sent_at: NOW },
    { kind: 'unknown', tier: 'behavioural', sent_at: NOW },
    { kind: 'replenishment', tier: 'behavioural', sent_at: 'not-an-iso' },
    { ...DELIVERY_PAYLOAD, user_id: 'owner-a' },
  ])('rejects a malformed notification delivery payload %#', (payload) => {
    expect(() =>
      enqueueNotificationDeliveryOutboxOperation(emptyOutboxEnvelope(), {
        operationId: OP_A1,
        ownerHash: OWNER,
        ownerGeneration: 7,
        entityId: ENTITY_A,
        payload,
        enqueuedAt: NOW,
      }),
    ).toThrow(OUTBOX_INVALID);
  });

  it('binds immutable event payload time to enqueue time and the SQL timestamp grammar', () => {
    const differentTime = '2026-07-18T15:00:00.001Z';
    expect(() =>
      enqueueNotificationDeliveryOutboxOperation(emptyOutboxEnvelope(), {
        operationId: OP_A1,
        ownerHash: OWNER,
        ownerGeneration: 7,
        entityId: ENTITY_A,
        payload: DELIVERY_PAYLOAD,
        enqueuedAt: differentTime,
      }),
    ).toThrow(OUTBOX_INVALID);
    expect(() =>
      enqueueShelfScanOutboxOperation(emptyOutboxEnvelope(), {
        operationId: OP_A1,
        ownerHash: OWNER,
        ownerGeneration: 7,
        entityId: ENTITY_A,
        payload: SCAN_PAYLOAD,
        payloadHash: SCAN_PAYLOAD_HASH,
        enqueuedAt: differentTime,
      }),
    ).toThrow(OUTBOX_INVALID);

    for (const timestamp of ['0000-01-01T00:00:00.000Z', '+010000-01-01T00:00:00.000Z']) {
      expect(() =>
        enqueueNotificationDeliveryOutboxOperation(emptyOutboxEnvelope(), {
          operationId: OP_A1,
          ownerHash: OWNER,
          ownerGeneration: 7,
          entityId: ENTITY_A,
          payload: { ...DELIVERY_PAYLOAD, sent_at: timestamp },
          enqueuedAt: timestamp,
        }),
      ).toThrow(OUTBOX_INVALID);
      expect(() =>
        enqueueShelfScanOutboxOperation(emptyOutboxEnvelope(), {
          operationId: OP_A1,
          ownerHash: OWNER,
          ownerGeneration: 7,
          entityId: ENTITY_A,
          payload: { ...SCAN_PAYLOAD, scanned_at: timestamp },
          payloadHash: SCAN_PAYLOAD_HASH,
          enqueuedAt: timestamp,
        }),
      ).toThrow(OUTBOX_INVALID);
    }
  });

  it('keeps Shelf scans as payload-bound unique revision-one events', () => {
    const first = enqueueShelfScanOutboxOperation(emptyOutboxEnvelope(), {
      operationId: OP_A1,
      ownerHash: OWNER,
      ownerGeneration: 7,
      entityId: ENTITY_A,
      payload: SCAN_PAYLOAD,
      payloadHash: SCAN_PAYLOAD_HASH,
      enqueuedAt: NOW,
    }).envelope;

    expect(first.rows[0]).toMatchObject({
      entityType: 'shelf_scan',
      entityId: ENTITY_A,
      clientRevision: 1,
      idempotencyKey: `shelf_scan:${OP_A1}:${SCAN_PAYLOAD_HASH}`,
      payload: SCAN_PAYLOAD,
    });
    expect(shelfScanPayloadHashInput(SCAN_PAYLOAD)).toBe(
      [
        'onskin:shelf-scan-payload:v1',
        SCAN_PAYLOAD.barcode,
        SCAN_PAYLOAD.result,
        SCAN_PAYLOAD.matched_product_id,
        NOW,
      ].join('\n'),
    );
    expect(() =>
      enqueueShelfScanOutboxOperation(first, {
        operationId: OP_A2,
        ownerHash: OWNER,
        ownerGeneration: 7,
        entityId: ENTITY_A,
        payload: SCAN_PAYLOAD,
        payloadHash: SCAN_PAYLOAD_HASH,
        enqueuedAt: NOW,
      }),
    ).toThrow(OUTBOX_INVALID);
  });

  it('coalesces canonical conflict-choice state and binds identity plus payload hashes', () => {
    expect(outboxEntityIdFromSha256(CONFLICT_IDENTITY_HASH)).toBe(CONFLICT_ENTITY_ID);
    expect(conflictChoiceIdentityHashInput(CONFLICT_PAYLOAD)).toContain(
      CONFLICT_PAYLOAD.product_a_id,
    );
    expect(conflictChoicePayloadHashInput(CONFLICT_PAYLOAD)).toContain('use_together');
    const first = enqueueConflictChoiceOutboxOperation(emptyOutboxEnvelope(), {
      operationId: OP_A1,
      ownerHash: OWNER,
      ownerGeneration: 7,
      entityId: CONFLICT_ENTITY_ID,
      payload: CONFLICT_PAYLOAD,
      identityHash: CONFLICT_IDENTITY_HASH,
      payloadHash: CONFLICT_PAYLOAD_HASH,
      enqueuedAt: NOW,
    }).envelope;
    const secondPayload = {
      ...CONFLICT_PAYLOAD,
      user_choice: 'accept_suggested_timing',
    } as const;
    const second = enqueueConflictChoiceOutboxOperation(first, {
      operationId: OP_A2,
      ownerHash: OWNER,
      ownerGeneration: 7,
      entityId: CONFLICT_ENTITY_ID,
      payload: secondPayload,
      identityHash: CONFLICT_IDENTITY_HASH,
      payloadHash: 'f'.repeat(64),
      enqueuedAt: NOW,
    }).envelope;

    expect(second.rows).toHaveLength(1);
    expect(second.rows[0]).toMatchObject({
      entityType: 'conflict_choice',
      clientRevision: 2,
      payload: secondPayload,
      idempotencyKey: `conflict_choice:${OP_A2}:${CONFLICT_IDENTITY_HASH}:${'f'.repeat(64)}`,
    });
    const tampered = JSON.parse(encodeOutboxEnvelope(second)) as {
      rows: { payload: Record<string, unknown> }[];
    };
    tampered.rows[0]!.payload.product_a_id = CONFLICT_PAYLOAD.product_b_id;
    expect(() => decodeOutboxEnvelope(JSON.stringify(tampered))).toThrow(OUTBOX_INVALID);
  });

  it('canonicalizes UUID identity casing and prunes conflicts whose Shelf dependency is deleted', () => {
    const queued = enqueueConflictChoiceOutboxOperation(emptyOutboxEnvelope(), {
      operationId: OP_A1,
      ownerHash: OWNER,
      ownerGeneration: 7,
      entityId: CONFLICT_ENTITY_ID.toUpperCase(),
      payload: CONFLICT_PAYLOAD,
      identityHash: CONFLICT_IDENTITY_HASH,
      payloadHash: CONFLICT_PAYLOAD_HASH,
      enqueuedAt: NOW,
    }).envelope;

    expect(queued.rows[0]?.entityId).toBe(CONFLICT_ENTITY_ID);
    const discarded = discardConflictChoiceOutboxDependencies(queued, {
      ownerHash: OWNER,
      productIds: [CONFLICT_PAYLOAD.product_a_id.toUpperCase()],
    });

    expect(discarded.discarded).toBe(1);
    expect(discarded.envelope.rows).toEqual([]);
    expect(discarded.envelope.revisions).toEqual(queued.revisions);
  });

  it('prioritizes Shelf dependencies before conflict state and retries dependency results', () => {
    let envelope = enqueueNotificationPreferencesOutboxOperation(emptyOutboxEnvelope(), {
      operationId: OP_B1,
      ownerHash: OWNER,
      ownerGeneration: 7,
      payload: NOTIFICATION_PAYLOAD,
      enqueuedAt: NOW,
    }).envelope;
    envelope = enqueueConflictChoiceOutboxOperation(envelope, {
      operationId: OP_A2,
      ownerHash: OWNER,
      ownerGeneration: 7,
      entityId: CONFLICT_ENTITY_ID,
      payload: CONFLICT_PAYLOAD,
      identityHash: CONFLICT_IDENTITY_HASH,
      payloadHash: CONFLICT_PAYLOAD_HASH,
      enqueuedAt: NOW,
    }).envelope;
    envelope = enqueue(envelope, { operationId: OP_A1, entityId: ENTITY_A }).envelope;

    const leased = leaseReadyOutboxRows(envelope, {
      ownerHash: OWNER,
      leaseOwner: WORKER_A,
      now: NOW,
      limit: 1,
    });
    expect(leased.rows.map((row) => row.entityType)).toEqual(['shelf_product']);
    const shelf = leased.rows[0]!;
    const shelfSettled = settleOutboxLease(leased.envelope, {
      leaseOwner: WORKER_A,
      now: NOW,
      operationIds: [shelf.operationId],
      results: [{ operationId: shelf.operationId, status: 'applied' }],
      random: 0,
    });
    const conflictLease = leaseReadyOutboxRows(shelfSettled, {
      ownerHash: OWNER,
      leaseOwner: WORKER_B,
      now: NOW,
      limit: 1,
    });
    expect(conflictLease.rows.map((row) => row.entityType)).toEqual(['conflict_choice']);
    const conflict = conflictLease.rows[0]!;
    const settled = settleOutboxLease(conflictLease.envelope, {
      leaseOwner: WORKER_B,
      now: NOW,
      operationIds: [conflict.operationId],
      results: [{ operationId: conflict.operationId, status: 'retry', errorClass: 'dependency' }],
      random: 0,
    });
    expect(settled.rows.find((row) => row.operationId === conflict.operationId)).toMatchObject({
      state: 'ready',
      lastErrorClass: 'dependency',
      attemptCount: 1,
    });
  });

  it.each([
    { ...SCAN_PAYLOAD, barcode: '123-456' },
    { ...SCAN_PAYLOAD, barcode: '123456789012345' },
    { ...SCAN_PAYLOAD, result: 'unknown' },
    { ...SCAN_PAYLOAD, result: 'ambiguous', matched_product_id: ENTITY_A },
    { ...SCAN_PAYLOAD, matched_product_id: 'not-a-uuid' },
    { ...SCAN_PAYLOAD, scanned_at: 'not-an-iso' },
    { ...SCAN_PAYLOAD, user_id: 'raw-owner' },
  ])('rejects a malformed Shelf scan payload %#', (payload) => {
    expect(() =>
      enqueueShelfScanOutboxOperation(emptyOutboxEnvelope(), {
        operationId: OP_A1,
        ownerHash: OWNER,
        ownerGeneration: 7,
        entityId: ENTITY_A,
        payload,
        payloadHash: SCAN_PAYLOAD_HASH,
        enqueuedAt: NOW,
      }),
    ).toThrow(OUTBOX_INVALID);
  });

  it('rejects a new scan when all 128 retained scan rows are live', () => {
    let envelope = emptyOutboxEnvelope();
    for (let index = 1; index <= MAX_SHELF_SCAN_OUTBOX_ROWS; index += 1) {
      envelope = enqueueScan(envelope, { index, enqueuedAt: NOW });
    }
    const before = encodeOutboxEnvelope(envelope);
    expect(() =>
      enqueueShelfScanOutboxOperation(envelope, {
        operationId: uuid(50_001),
        ownerHash: OWNER,
        ownerGeneration: 7,
        entityId: uuid(50_002),
        payload: SCAN_PAYLOAD,
        payloadHash: SCAN_PAYLOAD_HASH,
        enqueuedAt: NOW,
      }),
    ).toThrow(OUTBOX_LIMIT_REACHED);
    expect(encodeOutboxEnvelope(envelope)).toBe(before);

    const withState = enqueue(envelope, {
      operationId: OP_A1,
      entityId: ENTITY_A,
      enqueuedAt: '2026-07-18T15:00:01.000Z',
    }).envelope;
    const leased = leaseReadyOutboxRows(withState, {
      ownerHash: OWNER,
      leaseOwner: WORKER_A,
      now: '2026-07-18T15:00:02.000Z',
      limit: 1,
    });
    expect(leased.rows[0]?.entityType).toBe('shelf_product');
  });

  it('evicts the oldest dead scan and its revision to admit a new immutable event', () => {
    let envelope = emptyOutboxEnvelope();
    for (let index = 1; index <= MAX_SHELF_SCAN_OUTBOX_ROWS; index += 1) {
      envelope = enqueueScan(envelope, { index, enqueuedAt: NOW });
    }
    const dead = markShelfScansDead(envelope);
    const oldest = dead.rows[0]!;
    const firstRetained = dead.rows[1]!;
    const admittedInput = {
      operationId: uuid(50_001),
      ownerHash: OWNER,
      ownerGeneration: 8,
      entityId: uuid(50_002),
      payload: { ...SCAN_PAYLOAD, scanned_at: '2026-07-18T15:00:01.000Z' },
      payloadHash: 'f'.repeat(64),
      enqueuedAt: '2026-07-18T15:00:01.000Z',
    } as const;

    const admitted = enqueueShelfScanOutboxOperation(dead, admittedInput).envelope;

    expect(admitted.rows).toHaveLength(MAX_SHELF_SCAN_OUTBOX_ROWS);
    expect(admitted.rows.some((row) => row.operationId === oldest.operationId)).toBe(false);
    expect(
      admitted.revisions.some(
        (revision) =>
          revision.ownerHash === oldest.ownerHash &&
          revision.entityType === oldest.entityType &&
          revision.entityId === oldest.entityId,
      ),
    ).toBe(false);
    expect(admitted.rows.find((row) => row.operationId === firstRetained.operationId)).toEqual(
      firstRetained,
    );
    expect(
      admitted.rows.find((row) => row.operationId === admittedInput.operationId),
    ).toMatchObject({
      ownerHash: OWNER,
      entityType: 'shelf_scan',
      entityId: admittedInput.entityId,
      clientRevision: 1,
      idempotencyKey: `shelf_scan:${admittedInput.operationId}:${admittedInput.payloadHash}`,
      payload: admittedInput.payload,
      enqueuedAt: admittedInput.enqueuedAt,
      state: 'ready',
    });
    expect(decodeOutboxEnvelope(encodeOutboxEnvelope(admitted))).toEqual(admitted);

    const retried = retryDeadOutboxRows(admitted, {
      ownerHash: OWNER,
      entityType: 'shelf_scan',
      now: '2026-07-18T15:00:02.000Z',
    });
    const retriedRetained = retried.envelope.rows.find(
      (row) => row.operationId === firstRetained.operationId,
    );
    const stillNew = retried.envelope.rows.find(
      (row) => row.operationId === admittedInput.operationId,
    );
    expect(retried.retried).toBe(MAX_SHELF_SCAN_OUTBOX_ROWS - 1);
    expect(retriedRetained).toMatchObject({
      operationId: firstRetained.operationId,
      ownerHash: firstRetained.ownerHash,
      entityType: firstRetained.entityType,
      entityId: firstRetained.entityId,
      clientRevision: 1,
      idempotencyKey: firstRetained.idempotencyKey,
      payload: firstRetained.payload,
      enqueuedAt: firstRetained.enqueuedAt,
      state: 'ready',
    });
    expect(stillNew).toEqual(
      admitted.rows.find((row) => row.operationId === admittedInput.operationId),
    );

    const beforeReplay = encodeOutboxEnvelope(admitted);
    expect(() => enqueueShelfScanOutboxOperation(admitted, admittedInput)).toThrow(OUTBOX_INVALID);
    expect(encodeOutboxEnvelope(admitted)).toBe(beforeReplay);
  });

  it('evicts the current owners dead scan even when a foreign dead scan is older', () => {
    let envelope = emptyOutboxEnvelope();
    for (let index = 1; index <= MAX_SHELF_SCAN_OUTBOX_ROWS; index += 1) {
      envelope = enqueueScan(envelope, {
        index,
        ownerHash: index === 2 ? OWNER_B : OWNER,
      });
    }
    const oldestLive = envelope.rows[0]!;
    const foreignDead = envelope.rows[1]!;
    const ownDead = envelope.rows[2]!;
    envelope = markShelfScansDead(envelope, [foreignDead.operationId, ownDead.operationId]);
    envelope = enqueue(envelope, {
      operationId: OP_A1,
      entityId: ENTITY_A,
      enqueuedAt: '2026-07-18T15:00:01.000Z',
    }).envelope;
    const nonScanRow = envelope.rows.find((row) => row.operationId === OP_A1)!;
    const nonScanRevision = envelope.revisions.find(
      (revision) =>
        revision.ownerHash === OWNER &&
        revision.entityType === 'shelf_product' &&
        revision.entityId === ENTITY_A,
    )!;

    const admitted = enqueueShelfScanOutboxOperation(envelope, {
      operationId: uuid(50_001),
      ownerHash: OWNER,
      ownerGeneration: 8,
      entityId: uuid(50_002),
      payload: { ...SCAN_PAYLOAD, scanned_at: '2026-07-18T15:00:02.000Z' },
      payloadHash: 'f'.repeat(64),
      enqueuedAt: '2026-07-18T15:00:02.000Z',
    }).envelope;

    expect(admitted.rows.filter((row) => row.entityType === 'shelf_scan')).toHaveLength(
      MAX_SHELF_SCAN_OUTBOX_ROWS,
    );
    expect(admitted.rows).toHaveLength(MAX_SHELF_SCAN_OUTBOX_ROWS + 1);
    expect(admitted.rows.find((row) => row.operationId === oldestLive.operationId)).toEqual(
      oldestLive,
    );
    expect(admitted.rows.find((row) => row.operationId === foreignDead.operationId)).toEqual(
      envelope.rows.find((row) => row.operationId === foreignDead.operationId),
    );
    expect(admitted.rows.some((row) => row.operationId === ownDead.operationId)).toBe(false);
    expect(admitted.rows.find((row) => row.operationId === OP_A1)).toEqual(nonScanRow);
    expect(admitted.revisions).toContainEqual(nonScanRevision);
    expect(
      admitted.revisions.some(
        (revision) =>
          revision.ownerHash === OWNER_B &&
          revision.entityType === 'shelf_scan' &&
          revision.entityId === foreignDead.entityId,
      ),
    ).toBe(true);
    expect(
      admitted.revisions.some(
        (revision) =>
          revision.ownerHash === OWNER &&
          revision.entityType === 'shelf_scan' &&
          revision.entityId === ownDead.entityId,
      ),
    ).toBe(false);
  });

  it('rejects without mutation when only a foreign owner has a dead scan', () => {
    let envelope = emptyOutboxEnvelope();
    for (let index = 1; index <= MAX_SHELF_SCAN_OUTBOX_ROWS; index += 1) {
      envelope = enqueueScan(envelope, {
        index,
        ownerHash: index === 1 ? OWNER_B : OWNER,
        enqueuedAt: NOW,
      });
    }
    envelope = markShelfScansDead(envelope, [uuid(30_001)]);
    const before = encodeOutboxEnvelope(envelope);

    expect(() =>
      enqueueShelfScanOutboxOperation(envelope, {
        operationId: uuid(50_001),
        ownerHash: OWNER,
        ownerGeneration: 8,
        entityId: uuid(50_002),
        payload: { ...SCAN_PAYLOAD, scanned_at: '2026-07-18T15:00:02.000Z' },
        payloadHash: 'f'.repeat(64),
        enqueuedAt: '2026-07-18T15:00:02.000Z',
      }),
    ).toThrow(OUTBOX_LIMIT_REACHED);
    expect(encodeOutboxEnvelope(envelope)).toBe(before);
  });

  it('breaks equal scan timestamps deterministically by operation id', () => {
    let envelope = emptyOutboxEnvelope();
    for (let index = 1; index <= MAX_SHELF_SCAN_OUTBOX_ROWS; index += 1) {
      envelope = enqueueScan(envelope, { index, enqueuedAt: NOW });
    }
    const lowerOperationId = uuid(30_002);
    const higherOperationId = uuid(30_003);
    envelope = markShelfScansDead(envelope, [higherOperationId, lowerOperationId]);

    const admitted = enqueueShelfScanOutboxOperation(envelope, {
      operationId: uuid(50_001),
      ownerHash: OWNER,
      ownerGeneration: 8,
      entityId: uuid(50_002),
      payload: { ...SCAN_PAYLOAD, scanned_at: '2026-07-18T15:00:02.000Z' },
      payloadHash: 'f'.repeat(64),
      enqueuedAt: '2026-07-18T15:00:02.000Z',
    }).envelope;

    expect(admitted.rows.some((row) => row.operationId === lowerOperationId)).toBe(false);
    expect(admitted.rows.some((row) => row.operationId === higherOperationId)).toBe(true);
    expect(
      admitted.revisions.some(
        (revision) =>
          revision.ownerHash === OWNER &&
          revision.entityType === 'shelf_scan' &&
          revision.entityId === uuid(40_002),
      ),
    ).toBe(false);
    expect(
      admitted.revisions.some(
        (revision) =>
          revision.ownerHash === OWNER &&
          revision.entityType === 'shelf_scan' &&
          revision.entityId === uuid(40_003),
      ),
    ).toBe(true);
  });

  it('reclaims a same-owner dead scan at the exact global row boundary', () => {
    let envelope = emptyOutboxEnvelope();
    for (let index = 1; index < MAX_SHELF_SCAN_OUTBOX_ROWS; index += 1) {
      envelope = enqueueScan(envelope, { index, enqueuedAt: NOW });
    }
    const victim = envelope.rows[0]!;
    envelope = markShelfScansDead(envelope, [victim.operationId]);
    const otherRowCount = MAX_OUTBOX_ROWS - envelope.rows.length;
    for (let index = 1; index <= otherRowCount; index += 1) {
      envelope = enqueue(envelope, {
        operationId: uuid(100_000 + index),
        entityId: uuid(200_000 + index),
      }).envelope;
    }
    expect(envelope.rows).toHaveLength(MAX_OUTBOX_ROWS);

    const admitted = enqueueShelfScanOutboxOperation(envelope, {
      operationId: uuid(50_001),
      ownerHash: OWNER,
      ownerGeneration: 8,
      entityId: uuid(50_002),
      payload: { ...SCAN_PAYLOAD, scanned_at: '2026-07-18T15:00:02.000Z' },
      payloadHash: 'f'.repeat(64),
      enqueuedAt: '2026-07-18T15:00:02.000Z',
    }).envelope;

    expect(admitted.rows).toHaveLength(MAX_OUTBOX_ROWS);
    expect(admitted.rows.some((row) => row.operationId === victim.operationId)).toBe(false);
    expect(admitted.rows.some((row) => row.operationId === uuid(50_001))).toBe(true);
    expect(admitted.rows.filter((row) => row.entityType === 'shelf_product')).toHaveLength(
      otherRowCount,
    );
    expect(
      admitted.revisions.some(
        (revision) =>
          revision.ownerHash === victim.ownerHash &&
          revision.entityType === victim.entityType &&
          revision.entityId === victim.entityId,
      ),
    ).toBe(false);
  });

  it('reclaims a same-owner dead scan at the exact global revision boundary', () => {
    let envelope = enqueueScan(emptyOutboxEnvelope(), { index: 1, enqueuedAt: NOW });
    const victim = envelope.rows[0]!;
    envelope = markShelfScansDead(envelope);
    envelope = decodeOutboxEnvelope(
      JSON.stringify({
        ...envelope,
        revisions: [
          ...envelope.revisions,
          ...Array.from({ length: MAX_OUTBOX_REVISIONS - 1 }, (_, index) => ({
            ownerHash: OWNER,
            entityType: 'shelf_product',
            entityId: uuid(300_000 + index),
            revision: 1,
          })),
        ],
      }),
    );
    expect(envelope.revisions).toHaveLength(MAX_OUTBOX_REVISIONS);

    const admitted = enqueueShelfScanOutboxOperation(envelope, {
      operationId: uuid(50_001),
      ownerHash: OWNER,
      ownerGeneration: 8,
      entityId: uuid(50_002),
      payload: { ...SCAN_PAYLOAD, scanned_at: '2026-07-18T15:00:02.000Z' },
      payloadHash: 'f'.repeat(64),
      enqueuedAt: '2026-07-18T15:00:02.000Z',
    }).envelope;

    expect(admitted.rows).toHaveLength(1);
    expect(admitted.rows[0]?.operationId).toBe(uuid(50_001));
    expect(admitted.revisions).toHaveLength(MAX_OUTBOX_REVISIONS);
    expect(
      admitted.revisions.some(
        (revision) =>
          revision.ownerHash === victim.ownerHash &&
          revision.entityType === victim.entityType &&
          revision.entityId === victim.entityId,
      ),
    ).toBe(false);
  });

  it('continues past a victim whose shared legacy revision is still referenced', () => {
    let envelope = emptyOutboxEnvelope();
    envelope = enqueueScan(envelope, { index: 1, enqueuedAt: NOW });
    envelope = enqueueScan(envelope, { index: 2, enqueuedAt: NOW });
    envelope = markShelfScansDead(envelope);
    const sharedEntityId = envelope.rows[0]!.entityId;
    const legacyRows = envelope.rows.map((row) => ({
      ...row,
      entityId: sharedEntityId,
      dependencyGroupId: `shelf_scan:${sharedEntityId}`,
    }));
    const legacyRevisionCapped = decodeOutboxEnvelope(
      JSON.stringify({
        version: 1,
        rows: legacyRows,
        revisions: [
          { entityType: 'shelf_scan', entityId: sharedEntityId, revision: 1 },
          ...Array.from({ length: MAX_OUTBOX_REVISIONS - 1 }, (_, index) => ({
            entityType: 'shelf_product',
            entityId: uuid(300_000 + index),
            revision: 1,
          })),
        ],
      }),
    );

    const admitted = enqueueShelfScanOutboxOperation(legacyRevisionCapped, {
      operationId: uuid(50_001),
      ownerHash: OWNER,
      ownerGeneration: 8,
      entityId: uuid(50_002),
      payload: { ...SCAN_PAYLOAD, scanned_at: '2026-07-18T15:00:02.000Z' },
      payloadHash: 'f'.repeat(64),
      enqueuedAt: '2026-07-18T15:00:02.000Z',
    }).envelope;

    expect(admitted.rows).toHaveLength(1);
    expect(admitted.rows[0]?.operationId).toBe(uuid(50_001));
    expect(admitted.revisions).toHaveLength(MAX_OUTBOX_REVISIONS);
    expect(
      admitted.revisions.some(
        (revision) => revision.entityType === 'shelf_scan' && revision.entityId === sharedEntityId,
      ),
    ).toBe(false);
  });

  it('keeps global row and revision caps fail-closed during scan admission', () => {
    let rowCapped = emptyOutboxEnvelope();
    for (let index = 1; index <= MAX_OUTBOX_ROWS; index += 1) {
      rowCapped = enqueue(rowCapped, {
        operationId: uuid(100_000 + index),
        entityId: uuid(200_000 + index),
      }).envelope;
    }
    const rowCappedBytes = encodeOutboxEnvelope(rowCapped);
    expect(() =>
      enqueueScan(rowCapped, {
        index: 500_001,
        enqueuedAt: '2026-07-18T15:00:03.000Z',
      }),
    ).toThrow(OUTBOX_LIMIT_REACHED);
    expect(encodeOutboxEnvelope(rowCapped)).toBe(rowCappedBytes);

    const revisionCapped = decodeOutboxEnvelope(
      JSON.stringify({
        version: OUTBOX_SCHEMA_VERSION,
        rows: [],
        revisions: Array.from({ length: MAX_OUTBOX_REVISIONS }, (_, index) => ({
          ownerHash: OWNER,
          entityType: 'shelf_product',
          entityId: uuid(300_000 + index),
          revision: 1,
        })),
      }),
    );
    const revisionCappedBytes = encodeOutboxEnvelope(revisionCapped);
    expect(() =>
      enqueueScan(revisionCapped, {
        index: 500_002,
        enqueuedAt: '2026-07-18T15:00:04.000Z',
      }),
    ).toThrow(OUTBOX_LIMIT_REACHED);
    expect(encodeOutboxEnvelope(revisionCapped)).toBe(revisionCappedBytes);
  });

  it('reclaims settled immutable event revisions beyond the global revision bound', () => {
    let envelope = emptyOutboxEnvelope();
    for (let index = 1; index <= 1_025; index += 1) {
      const operationId = uuid(10_000 + index);
      envelope =
        index % 2 === 0
          ? enqueueShelfScanOutboxOperation(envelope, {
              operationId,
              ownerHash: OWNER,
              ownerGeneration: 7,
              entityId: uuid(20_000 + index),
              payload: SCAN_PAYLOAD,
              payloadHash: SCAN_PAYLOAD_HASH,
              enqueuedAt: NOW,
            }).envelope
          : enqueueNotificationDeliveryOutboxOperation(envelope, {
              operationId,
              ownerHash: OWNER,
              ownerGeneration: 7,
              entityId: uuid(20_000 + index),
              payload: DELIVERY_PAYLOAD,
              enqueuedAt: NOW,
            }).envelope;
      envelope = leaseReadyOutboxRows(envelope, {
        ownerHash: OWNER,
        leaseOwner: WORKER_A,
        now: NOW,
      }).envelope;
      envelope = settleOutboxLease(envelope, {
        leaseOwner: WORKER_A,
        now: NOW,
        results: [{ operationId, status: 'applied' }],
      });
    }

    expect(envelope.rows).toEqual([]);
    expect(envelope.revisions).toEqual([]);
  });

  it('increments per-entity revisions and coalesces only unleased state mirrors', () => {
    const first = enqueue(emptyOutboxEnvelope(), {
      operationId: OP_A1,
      entityId: ENTITY_A,
      payload: { ...SHELF_PAYLOAD, manual_name: 'First' },
    }).envelope;
    const second = enqueue(first, {
      operationId: OP_A2,
      entityId: ENTITY_A,
      payload: { ...SHELF_PAYLOAD, manual_name: 'Second' },
    }).envelope;

    expect(second.rows).toHaveLength(1);
    expect(second.rows[0]).toMatchObject({ operationId: OP_A2, clientRevision: 2 });
    expect(second.revisions).toEqual([
      { ownerHash: OWNER, entityType: 'shelf_product', entityId: ENTITY_A, revision: 2 },
    ]);
  });

  it('lets an expired duplicate worker take the latest revision without stale settlement loss', () => {
    const first = enqueue(emptyOutboxEnvelope(), {
      operationId: OP_A1,
      entityId: ENTITY_A,
    }).envelope;
    const leasedA = leaseReadyOutboxRows(first, {
      ownerHash: OWNER,
      leaseOwner: WORKER_A,
      now: NOW,
    });
    const second = enqueue(leasedA.envelope, {
      operationId: OP_A2,
      entityId: ENTITY_A,
      payload: { ...SHELF_PAYLOAD, manual_name: 'Newer' },
      enqueuedAt: '2026-07-18T15:00:01.000Z',
    }).envelope;
    const leasedB = leaseReadyOutboxRows(second, {
      ownerHash: OWNER,
      leaseOwner: WORKER_B,
      now: '2026-07-18T15:00:31.000Z',
    });

    expect(leasedB.rows.map((row) => row.operationId)).toEqual([OP_A2]);
    expect(leasedB.envelope.rows).toHaveLength(1);
    const staleWorkerSettlement = settleOutboxLease(leasedB.envelope, {
      leaseOwner: WORKER_A,
      now: '2026-07-18T15:00:32.000Z',
      results: [{ operationId: OP_A1, status: 'applied' }],
    });
    expect(staleWorkerSettlement.rows).toHaveLength(1);
    expect(
      settleOutboxLease(staleWorkerSettlement, {
        leaseOwner: WORKER_B,
        now: '2026-07-18T15:00:33.000Z',
        results: [{ operationId: OP_A2, status: 'duplicate' }],
      }).rows,
    ).toEqual([]);
  });

  it('repairs impossible future retry time without changing immutable event identity', () => {
    const future = '2027-07-18T15:00:00.000Z';
    const payload = { ...SCAN_PAYLOAD, scanned_at: future };
    let queued = enqueueShelfScanOutboxOperation(emptyOutboxEnvelope(), {
      operationId: OP_A1,
      ownerHash: OWNER,
      ownerGeneration: 7,
      entityId: ENTITY_A,
      payload,
      payloadHash: SCAN_PAYLOAD_HASH,
      enqueuedAt: future,
    }).envelope;
    queued = enqueueShelfOutboxOperation(queued, {
      operationId: OP_B1,
      ownerHash: OWNER_B,
      ownerGeneration: 8,
      entityId: ENTITY_B,
      operationKind: 'upsert',
      payload: SHELF_PAYLOAD,
      enqueuedAt: future,
    }).envelope;
    const otherOwnerRow = queued.rows.find((row) => row.ownerHash === OWNER_B)!;

    const leased = leaseReadyOutboxRows(queued, {
      ownerHash: OWNER,
      leaseOwner: WORKER_A,
      now: NOW,
    });

    expect(leased.rows).toHaveLength(1);
    expect(leased.rows[0]).toMatchObject({
      operationId: OP_A1,
      ownerHash: OWNER,
      ownerGeneration: 7,
      entityType: 'shelf_scan',
      entityId: ENTITY_A,
      enqueuedAt: future,
      nextAttemptAt: NOW,
      payload,
      clientRevision: 1,
      idempotencyKey: `shelf_scan:${OP_A1}:${SCAN_PAYLOAD_HASH}`,
      dependencyGroupId: `shelf_scan:${ENTITY_A}`,
      attemptCount: 1,
      leaseOwner: WORKER_A,
    });
    expect(leased.envelope.rows.find((row) => row.ownerHash === OWNER_B)).toEqual(otherOwnerRow);
    expect(leased.envelope.version).toBe(OUTBOX_SCHEMA_VERSION);
  });

  it('reclaims an impossible future orphan lease while preserving exact legal horizons', () => {
    const future = '2027-07-18T15:00:00.000Z';
    const queued = enqueue(emptyOutboxEnvelope(), {
      operationId: OP_A1,
      entityId: ENTITY_A,
      enqueuedAt: future,
    }).envelope;
    const oldLease = leaseReadyOutboxRows(queued, {
      ownerHash: OWNER,
      leaseOwner: WORKER_A,
      now: future,
    });
    const repaired = leaseReadyOutboxRows(oldLease.envelope, {
      ownerHash: OWNER,
      leaseOwner: WORKER_B,
      now: NOW,
    });

    expect(repaired.rows).toEqual([
      expect.objectContaining({
        operationId: OP_A1,
        enqueuedAt: future,
        nextAttemptAt: NOW,
        attemptCount: 2,
        leaseOwner: WORKER_B,
        leaseExpiresAt: '2026-07-18T15:00:30.000Z',
      }),
    ]);
    expect(
      settleOutboxLease(repaired.envelope, {
        leaseOwner: WORKER_A,
        now: '2026-07-18T15:00:01.000Z',
        results: [{ operationId: OP_A1, status: 'applied' }],
      }),
    ).toEqual(repaired.envelope);

    const exactRetryBoundary = enqueue(emptyOutboxEnvelope(), {
      operationId: OP_A2,
      entityId: ENTITY_B,
      enqueuedAt: '2026-07-18T15:05:00.000Z',
    }).envelope;
    const deferred = leaseReadyOutboxRows(exactRetryBoundary, {
      ownerHash: OWNER,
      leaseOwner: WORKER_A,
      now: NOW,
    });
    expect(deferred.rows).toEqual([]);
    expect(deferred.envelope).toEqual(exactRetryBoundary);

    const exactLeaseBoundary = leaseReadyOutboxRows(
      enqueue(emptyOutboxEnvelope(), {
        operationId: OP_A2,
        entityId: ENTITY_B,
        enqueuedAt: NOW,
      }).envelope,
      {
        ownerHash: OWNER,
        leaseOwner: WORKER_A,
        now: NOW,
      },
    ).envelope;
    const preserved = leaseReadyOutboxRows(exactLeaseBoundary, {
      ownerHash: OWNER,
      leaseOwner: WORKER_B,
      now: NOW,
    });
    expect(preserved.rows).toEqual([]);
    expect(preserved.envelope).toEqual(exactLeaseBoundary);
  });

  it('selects canonical owner-scoped retry deadlines and repairs only impossible horizons', () => {
    let envelope = enqueue(emptyOutboxEnvelope(), {
      operationId: OP_A1,
      entityId: ENTITY_A,
      enqueuedAt: '2026-07-18T15:05:00.000Z',
    }).envelope;
    envelope = enqueue(envelope, {
      operationId: OP_A2,
      entityId: ENTITY_B,
      enqueuedAt: '2026-07-18T15:01:00.000Z',
    }).envelope;
    envelope = enqueueShelfOutboxOperation(envelope, {
      operationId: OP_B1,
      ownerHash: OWNER_B,
      ownerGeneration: 8,
      entityId: CONFLICT_PAYLOAD.product_a_id,
      operationKind: 'upsert',
      payload: SHELF_PAYLOAD,
      enqueuedAt: NOW,
    }).envelope;

    expect(nextOutboxWakeAt(envelope, { ownerHash: OWNER, now: NOW })).toBe(
      '2026-07-18T15:01:00.000Z',
    );
    expect(nextOutboxWakeAt(envelope, { ownerHash: OWNER_B, now: NOW })).toBe(NOW);
    expect(
      nextOutboxWakeAt(
        enqueue(emptyOutboxEnvelope(), {
          operationId: OP_A1,
          entityId: ENTITY_A,
          enqueuedAt: '2026-07-18T15:05:00.000Z',
        }).envelope,
        { ownerHash: OWNER, now: NOW },
      ),
    ).toBe('2026-07-18T15:05:00.000Z');
    expect(
      nextOutboxWakeAt(
        enqueue(emptyOutboxEnvelope(), {
          operationId: OP_A1,
          entityId: ENTITY_A,
          enqueuedAt: '2026-07-18T15:05:00.001Z',
        }).envelope,
        { ownerHash: OWNER, now: NOW },
      ),
    ).toBe(NOW);
    expect(nextOutboxWakeAt(emptyOutboxEnvelope(), { ownerHash: OWNER, now: NOW })).toBeNull();
    expect(() =>
      nextOutboxWakeAt(emptyOutboxEnvelope(), { ownerHash: 'A'.repeat(64), now: NOW }),
    ).toThrow(OUTBOX_INVALID);
    expect(() =>
      nextOutboxWakeAt(emptyOutboxEnvelope(), {
        ownerHash: OWNER,
        now: '2026-07-18T11:00:00.000-04:00',
      }),
    ).toThrow(OUTBOX_INVALID);
  });

  it('uses lease expiry instead of busy-looping on a newer ready row with the same identity', () => {
    const first = enqueue(emptyOutboxEnvelope(), {
      operationId: OP_A1,
      entityId: ENTITY_A,
    }).envelope;
    const leased = leaseReadyOutboxRows(first, {
      ownerHash: OWNER,
      leaseOwner: WORKER_A,
      now: NOW,
    }).envelope;
    const newer = enqueue(leased, {
      operationId: OP_A2,
      entityId: ENTITY_A,
      enqueuedAt: '2026-07-18T15:00:01.000Z',
    }).envelope;

    expect(
      nextOutboxWakeAt(newer, {
        ownerHash: OWNER,
        now: '2026-07-18T15:00:01.000Z',
      }),
    ).toBe('2026-07-18T15:00:30.000Z');
    expect(
      nextOutboxWakeAt(newer, {
        ownerHash: OWNER,
        now: '2026-07-18T15:00:30.000Z',
      }),
    ).toBe('2026-07-18T15:00:30.000Z');

    const rolledBackLease = leaseReadyOutboxRows(
      enqueue(emptyOutboxEnvelope(), {
        operationId: OP_A1,
        entityId: ENTITY_A,
        enqueuedAt: '2027-07-18T15:00:00.000Z',
      }).envelope,
      {
        ownerHash: OWNER,
        leaseOwner: WORKER_A,
        now: '2027-07-18T15:00:00.000Z',
      },
    ).envelope;
    expect(nextOutboxWakeAt(rolledBackLease, { ownerHash: OWNER, now: NOW })).toBe(NOW);
  });

  it('mirrors latest-ready compaction without allowing another owner to affect the deadline', () => {
    const oldReady = enqueue(emptyOutboxEnvelope(), {
      operationId: OP_A1,
      entityId: ENTITY_A,
    }).envelope;
    const leasedOld = leaseReadyOutboxRows(oldReady, {
      ownerHash: OWNER,
      leaseOwner: WORKER_A,
      now: NOW,
    }).envelope;
    let persisted = enqueue(leasedOld, {
      operationId: OP_A2,
      entityId: ENTITY_A,
      enqueuedAt: '2026-07-18T15:02:00.000Z',
    }).envelope;
    persisted = decodeOutboxEnvelope(
      JSON.stringify({
        ...persisted,
        rows: persisted.rows.map((row) =>
          row.operationId === OP_A1
            ? {
                ...row,
                state: 'ready',
                leaseOwner: null,
                leaseExpiresAt: null,
              }
            : row,
        ),
      }),
    );
    persisted = enqueueShelfOutboxOperation(persisted, {
      operationId: OP_B1,
      ownerHash: OWNER_B,
      ownerGeneration: 8,
      entityId: ENTITY_B,
      operationKind: 'upsert',
      payload: SHELF_PAYLOAD,
      enqueuedAt: NOW,
    }).envelope;

    expect(nextOutboxWakeAt(persisted, { ownerHash: OWNER, now: NOW })).toBe(
      '2026-07-18T15:02:00.000Z',
    );
  });

  it.each(['offline', 'authentication', 'validation'] as const)(
    'waits for an external signal after a %s failure',
    (failureClass) => {
      const queued = enqueue(emptyOutboxEnvelope(), {
        operationId: OP_A1,
        entityId: ENTITY_A,
      }).envelope;
      const leased = leaseReadyOutboxRows(queued, {
        ownerHash: OWNER,
        leaseOwner: WORKER_A,
        now: NOW,
      }).envelope;
      const failed = settleOutboxLease(leased, {
        leaseOwner: WORKER_A,
        now: NOW,
        results: [],
        failureClass,
        random: 0,
      });

      expect(nextOutboxWakeAt(failed, { ownerHash: OWNER, now: NOW })).toBeNull();
    },
  );

  it('does not arm a future timer for request-level validation recovery', () => {
    const queued = enqueue(emptyOutboxEnvelope(), {
      operationId: OP_A1,
      entityId: ENTITY_A,
    }).envelope;
    const leased = leaseReadyOutboxRows(queued, {
      ownerHash: OWNER,
      leaseOwner: WORKER_A,
      now: NOW,
    }).envelope;
    const failed = settleOutboxLease(leased, {
      leaseOwner: WORKER_A,
      now: NOW,
      results: [],
      failureClass: 'validation',
      retryAfterMs: 60_000,
    });

    expect(failed.rows[0]).toMatchObject({
      state: 'ready',
      lastErrorClass: 'validation',
      nextAttemptAt: '2026-07-18T15:01:00.000Z',
    });
    expect(nextOutboxWakeAt(failed, { ownerHash: OWNER, now: NOW })).toBeNull();
  });

  it('ignores dead rows and wakes for the Shelf retry that blocks a due conflict choice', () => {
    let envelope = enqueueShelfOutboxOperation(emptyOutboxEnvelope(), {
      operationId: OP_A1,
      ownerHash: OWNER,
      ownerGeneration: 7,
      entityId: CONFLICT_PAYLOAD.product_a_id,
      operationKind: 'upsert',
      payload: SHELF_PAYLOAD,
      enqueuedAt: '2026-07-18T15:01:00.000Z',
    }).envelope;
    envelope = enqueueConflictChoiceOutboxOperation(envelope, {
      operationId: OP_A2,
      ownerHash: OWNER,
      ownerGeneration: 7,
      entityId: CONFLICT_ENTITY_ID,
      payload: CONFLICT_PAYLOAD,
      identityHash: CONFLICT_IDENTITY_HASH,
      payloadHash: CONFLICT_PAYLOAD_HASH,
      enqueuedAt: NOW,
    }).envelope;

    expect(nextOutboxWakeAt(envelope, { ownerHash: OWNER, now: NOW })).toBe(
      '2026-07-18T15:01:00.000Z',
    );

    const deadQueued = enqueue(emptyOutboxEnvelope(), {
      operationId: OP_B1,
      entityId: ENTITY_B,
    }).envelope;
    const deadLeased = leaseReadyOutboxRows(deadQueued, {
      ownerHash: OWNER,
      leaseOwner: WORKER_A,
      now: NOW,
    }).envelope;
    const dead = settleOutboxLease(deadLeased, {
      leaseOwner: WORKER_A,
      now: NOW,
      results: [{ operationId: OP_B1, status: 'permanent', errorClass: 'validation' }],
    });
    expect(nextOutboxWakeAt(dead, { ownerHash: OWNER, now: NOW })).toBeNull();
  });

  it('does not busy-loop when a conflict dependency needs connectivity or manual repair', () => {
    let envelope = enqueueShelfOutboxOperation(emptyOutboxEnvelope(), {
      operationId: OP_A1,
      ownerHash: OWNER,
      ownerGeneration: 7,
      entityId: CONFLICT_PAYLOAD.product_a_id,
      operationKind: 'upsert',
      payload: SHELF_PAYLOAD,
      enqueuedAt: NOW,
    }).envelope;
    envelope = enqueueConflictChoiceOutboxOperation(envelope, {
      operationId: OP_A2,
      ownerHash: OWNER,
      ownerGeneration: 7,
      entityId: CONFLICT_ENTITY_ID,
      payload: CONFLICT_PAYLOAD,
      identityHash: CONFLICT_IDENTITY_HASH,
      payloadHash: CONFLICT_PAYLOAD_HASH,
      enqueuedAt: NOW,
    }).envelope;
    const shelfLease = leaseReadyOutboxRows(envelope, {
      ownerHash: OWNER,
      leaseOwner: WORKER_A,
      now: NOW,
      limit: 1,
    });
    expect(nextOutboxWakeAt(shelfLease.envelope, { ownerHash: OWNER, now: NOW })).toBe(
      '2026-07-18T15:00:30.000Z',
    );

    const offlineShelf = settleOutboxLease(shelfLease.envelope, {
      leaseOwner: WORKER_A,
      operationIds: [OP_A1],
      now: NOW,
      results: [],
      failureClass: 'offline',
      random: 0,
    });
    expect(nextOutboxWakeAt(offlineShelf, { ownerHash: OWNER, now: NOW })).toBeNull();

    const deadShelf = settleOutboxLease(shelfLease.envelope, {
      leaseOwner: WORKER_A,
      operationIds: [OP_A1],
      now: NOW,
      results: [{ operationId: OP_A1, status: 'permanent', errorClass: 'validation' }],
    });
    expect(nextOutboxWakeAt(deadShelf, { ownerHash: OWNER, now: NOW })).toBeNull();
  });

  it('dead-letters one permanent poison row without blocking an independent success', () => {
    let envelope = enqueue(emptyOutboxEnvelope(), {
      operationId: OP_A1,
      entityId: ENTITY_A,
    }).envelope;
    envelope = enqueue(envelope, {
      operationId: OP_B1,
      entityId: ENTITY_B,
      enqueuedAt: '2026-07-18T15:00:01.000Z',
    }).envelope;
    const leased = leaseReadyOutboxRows(envelope, {
      ownerHash: OWNER,
      leaseOwner: WORKER_A,
      now: '2026-07-18T15:00:02.000Z',
    });
    const settled = settleOutboxLease(leased.envelope, {
      leaseOwner: WORKER_A,
      now: '2026-07-18T15:00:03.000Z',
      results: [
        { operationId: OP_A1, status: 'permanent', errorClass: 'validation' },
        { operationId: OP_B1, status: 'applied' },
      ],
    });

    expect(settled.rows).toHaveLength(1);
    expect(settled.rows[0]).toMatchObject({ operationId: OP_A1, state: 'dead' });
    expect(outboxCounts(settled)).toEqual({ ready: 0, inFlight: 0, dead: 1 });
  });

  it('settles only the explicit operation scope within a shared lease', () => {
    let envelope = enqueue(emptyOutboxEnvelope(), {
      operationId: OP_A1,
      entityId: ENTITY_A,
    }).envelope;
    envelope = enqueue(envelope, {
      operationId: OP_B1,
      entityId: ENTITY_B,
      enqueuedAt: '2026-07-18T15:00:01.000Z',
    }).envelope;
    const leased = leaseReadyOutboxRows(envelope, {
      ownerHash: OWNER,
      leaseOwner: WORKER_A,
      now: '2026-07-18T15:00:02.000Z',
    }).envelope;

    const firstSettled = settleOutboxLease(leased, {
      leaseOwner: WORKER_A,
      operationIds: [OP_A1],
      now: '2026-07-18T15:00:03.000Z',
      results: [{ operationId: OP_A1, status: 'applied' }],
    });
    expect(firstSettled.rows).toEqual([
      expect.objectContaining({ operationId: OP_B1, state: 'leased', leaseOwner: WORKER_A }),
    ]);

    const secondSettled = settleOutboxLease(firstSettled, {
      leaseOwner: WORKER_A,
      operationIds: [OP_B1],
      now: '2026-07-18T15:00:04.000Z',
      results: [],
      failureClass: 'server',
      random: 0,
    });
    expect(secondSettled.rows).toEqual([
      expect.objectContaining({
        operationId: OP_B1,
        state: 'ready',
        leaseOwner: null,
        lastErrorClass: 'server',
      }),
    ]);
    expect(() =>
      settleOutboxLease(leased, {
        leaseOwner: WORKER_A,
        operationIds: [OP_A1],
        now: '2026-07-18T15:00:03.000Z',
        results: [{ operationId: OP_B1, status: 'applied' }],
      }),
    ).toThrow(OUTBOX_INVALID);
  });

  it('derives owner-scoped saved, syncing, and needs-attention states and retries only that owner', () => {
    const queued = enqueue(emptyOutboxEnvelope(), {
      operationId: OP_A1,
      entityId: ENTITY_A,
    }).envelope;
    expect(
      selectOutboxOwnerStatus(queued, {
        ownerHash: OWNER,
        entityType: 'shelf_product',
      }),
    ).toEqual({
      kind: 'saved_local',
      pendingCount: 1,
      attentionCount: 0,
    });
    expect(
      selectOutboxOwnerStatus(queued, {
        ownerHash: 'b'.repeat(64),
        entityType: 'shelf_product',
      }),
    ).toEqual({ kind: 'idle', pendingCount: 0, attentionCount: 0 });

    const leased = leaseReadyOutboxRows(queued, {
      ownerHash: OWNER,
      leaseOwner: WORKER_A,
      now: NOW,
    }).envelope;
    expect(
      selectOutboxOwnerStatus(leased, {
        ownerHash: OWNER,
        entityType: 'shelf_product',
      }),
    ).toEqual({
      kind: 'syncing',
      pendingCount: 1,
      attentionCount: 0,
    });

    const dead = settleOutboxLease(leased, {
      leaseOwner: WORKER_A,
      now: NOW,
      results: [{ operationId: OP_A1, status: 'permanent', errorClass: 'validation' }],
    });
    expect(
      selectOutboxOwnerStatus(dead, {
        ownerHash: OWNER,
        entityType: 'shelf_product',
      }),
    ).toEqual({
      kind: 'needs_attention',
      pendingCount: 1,
      attentionCount: 1,
    });

    const wrongOwnerRetry = retryDeadOutboxRows(dead, {
      ownerHash: 'b'.repeat(64),
      entityType: 'shelf_product',
      now: '2026-07-18T15:01:00.000Z',
    });
    expect(wrongOwnerRetry).toEqual({ envelope: dead, retried: 0 });

    const retry = retryDeadOutboxRows(dead, {
      ownerHash: OWNER,
      entityType: 'shelf_product',
      now: '2026-07-18T15:01:00.000Z',
    });
    expect(retry.retried).toBe(1);
    expect(retry.envelope.rows[0]).toMatchObject({
      state: 'ready',
      attemptCount: 0,
      nextAttemptAt: '2026-07-18T15:01:00.000Z',
      lastErrorClass: null,
    });
  });

  it('persists full-jitter backoff and honors a bounded Retry-After', () => {
    const queued = enqueue(emptyOutboxEnvelope(), {
      operationId: OP_A1,
      entityId: ENTITY_A,
    }).envelope;
    const leased = leaseReadyOutboxRows(queued, {
      ownerHash: OWNER,
      leaseOwner: WORKER_A,
      now: NOW,
    });
    const retried = settleOutboxLease(leased.envelope, {
      leaseOwner: WORKER_A,
      now: NOW,
      results: [],
      failureClass: 'rate_limit',
      retryAfterMs: 45_000,
      random: 0,
    });

    expect(retried.rows[0]).toMatchObject({
      state: 'ready',
      attemptCount: 1,
      lastErrorClass: 'rate_limit',
      nextAttemptAt: '2026-07-18T15:00:45.000Z',
    });
    expect(
      leaseReadyOutboxRows(retried, {
        ownerHash: OWNER,
        leaseOwner: WORKER_B,
        now: '2026-07-18T15:00:44.999Z',
      }).rows,
    ).toEqual([]);
  });

  it('keeps notification streams strict, entity-scoped, restart-durable, and ordered', () => {
    const first = enqueueNotificationPreferencesOutboxOperation(emptyOutboxEnvelope(), {
      operationId: OP_A1,
      ownerHash: OWNER,
      ownerGeneration: 7,
      payload: NOTIFICATION_PAYLOAD,
      enqueuedAt: NOW,
    }).envelope;
    expect(first.rows[0]).toMatchObject({
      entityType: 'notification_preferences',
      entityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      idempotencyKey: `notification_preferences:${OP_A1}`,
    });
    expect(
      selectOutboxOwnerStatus(first, {
        ownerHash: OWNER,
        entityType: 'shelf_product',
      }),
    ).toEqual({ kind: 'idle', pendingCount: 0, attentionCount: 0 });
    const restarted = decodeOutboxEnvelope(encodeOutboxEnvelope(first));
    const leased = leaseReadyOutboxRows(restarted, {
      ownerHash: OWNER,
      leaseOwner: WORKER_A,
      now: NOW,
    });
    expect(leased.rows[0]).toMatchObject({ operationId: OP_A1, ownerGeneration: 7 });
    const newer = enqueueNotificationPreferencesOutboxOperation(leased.envelope, {
      operationId: OP_A2,
      ownerHash: OWNER,
      ownerGeneration: 8,
      payload: { ...NOTIFICATION_PAYLOAD, pm_reminder_enabled: false },
      enqueuedAt: '2026-07-18T15:00:01.000Z',
    }).envelope;
    expect(newer.revisions).toEqual([
      {
        ownerHash: OWNER,
        entityType: 'notification_preferences',
        entityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        revision: 2,
      },
    ]);
    expect(
      leaseReadyOutboxRows(newer, {
        ownerHash: OWNER,
        leaseOwner: WORKER_B,
        now: '2026-07-18T15:00:29.999Z',
      }).rows,
    ).toEqual([]);
    expect(
      leaseReadyOutboxRows(newer, {
        ownerHash: OWNER,
        leaseOwner: WORKER_B,
        now: '2026-07-18T15:00:30.000Z',
      }).rows.map((row) => row.operationId),
    ).toEqual([OP_A2]);
  });

  it('never lets another owner compact or lease-block the current owner stream', () => {
    const ownerA = enqueueNotificationPreferencesOutboxOperation(emptyOutboxEnvelope(), {
      operationId: OP_A1,
      ownerHash: OWNER,
      ownerGeneration: 7,
      payload: NOTIFICATION_PAYLOAD,
      enqueuedAt: NOW,
    }).envelope;
    const leasedOwnerA = leaseReadyOutboxRows(ownerA, {
      ownerHash: OWNER,
      leaseOwner: WORKER_A,
      now: NOW,
    }).envelope;
    const ownerB = enqueueNotificationPreferencesOutboxOperation(leasedOwnerA, {
      operationId: OP_B1,
      ownerHash: OWNER_B,
      ownerGeneration: 8,
      payload: { ...NOTIFICATION_PAYLOAD, am_reminder_enabled: false },
      enqueuedAt: '2026-07-18T15:00:01.000Z',
    }).envelope;

    const leasedOwnerB = leaseReadyOutboxRows(ownerB, {
      ownerHash: OWNER_B,
      leaseOwner: WORKER_B,
      now: '2026-07-18T15:00:01.000Z',
    });

    expect(leasedOwnerB.rows.map((row) => row.operationId)).toEqual([OP_B1]);
    expect(leasedOwnerB.envelope.rows.map((row) => row.operationId)).toEqual([OP_A1, OP_B1]);
  });

  it('keeps same-entity revisions and settlement isolated across owners', () => {
    const ownerA = enqueueShelfOutboxOperation(emptyOutboxEnvelope(), {
      operationId: OP_A1,
      ownerHash: OWNER,
      ownerGeneration: 7,
      entityId: ENTITY_A,
      operationKind: 'upsert',
      payload: { ...SHELF_PAYLOAD, manual_name: 'Owner A first' },
      enqueuedAt: NOW,
    }).envelope;
    const bothOwners = enqueueShelfOutboxOperation(ownerA, {
      operationId: OP_B1,
      ownerHash: OWNER_B,
      ownerGeneration: 8,
      entityId: ENTITY_A,
      operationKind: 'upsert',
      payload: { ...SHELF_PAYLOAD, manual_name: 'Owner B' },
      enqueuedAt: '2026-07-18T15:00:01.000Z',
    }).envelope;
    const leasedA = leaseReadyOutboxRows(bothOwners, {
      ownerHash: OWNER,
      leaseOwner: WORKER_A,
      now: '2026-07-18T15:00:01.000Z',
    }).envelope;
    const newerA = enqueueShelfOutboxOperation(leasedA, {
      operationId: OP_A2,
      ownerHash: OWNER,
      ownerGeneration: 7,
      entityId: ENTITY_A,
      operationKind: 'upsert',
      payload: { ...SHELF_PAYLOAD, manual_name: 'Owner A newer' },
      enqueuedAt: '2026-07-18T15:00:02.000Z',
    }).envelope;
    const leasedB = leaseReadyOutboxRows(newerA, {
      ownerHash: OWNER_B,
      leaseOwner: WORKER_B,
      now: '2026-07-18T15:00:02.000Z',
    }).envelope;
    const settledA = settleOutboxLease(leasedB, {
      leaseOwner: WORKER_A,
      now: '2026-07-18T15:00:03.000Z',
      results: [{ operationId: OP_A1, status: 'permanent', errorClass: 'validation' }],
    });

    expect(settledA.rows.map((row) => row.operationId).sort()).toEqual([OP_A2, OP_B1].sort());
    expect(
      selectOutboxOwnerStatus(settledA, { ownerHash: OWNER, entityType: 'shelf_product' }),
    ).toMatchObject({ kind: 'saved_local', pendingCount: 1 });
    expect(
      selectOutboxOwnerStatus(settledA, { ownerHash: OWNER_B, entityType: 'shelf_product' }),
    ).toMatchObject({ kind: 'syncing', pendingCount: 1 });
    expect(settledA.revisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ownerHash: OWNER, revision: 2 }),
        expect.objectContaining({ ownerHash: OWNER_B, revision: 1 }),
      ]),
    );
  });

  it('retains ready notification snapshots for two owners and leases only the current owner', () => {
    const ownerA = enqueueNotificationPreferencesOutboxOperation(emptyOutboxEnvelope(), {
      operationId: OP_A1,
      ownerHash: OWNER,
      ownerGeneration: 7,
      payload: NOTIFICATION_PAYLOAD,
      enqueuedAt: NOW,
    }).envelope;
    const bothOwners = enqueueNotificationPreferencesOutboxOperation(ownerA, {
      operationId: OP_B1,
      ownerHash: OWNER_B,
      ownerGeneration: 8,
      payload: { ...NOTIFICATION_PAYLOAD, am_reminder_enabled: false },
      enqueuedAt: '2026-07-18T15:00:01.000Z',
    }).envelope;

    expect(bothOwners.rows).toHaveLength(2);
    expect(bothOwners.revisions).toHaveLength(2);
    expect(new Set(bothOwners.rows.map((row) => row.entityId)).size).toBe(2);

    const leasedOwnerB = leaseReadyOutboxRows(bothOwners, {
      ownerHash: OWNER_B,
      leaseOwner: WORKER_B,
      now: '2026-07-18T15:00:01.000Z',
    });
    expect(leasedOwnerB.rows.map((row) => row.operationId)).toEqual([OP_B1]);
    expect(leasedOwnerB.envelope.rows).toHaveLength(2);
    expect(leasedOwnerB.envelope.rows.find((row) => row.operationId === OP_A1)?.state).toBe(
      'ready',
    );
  });

  it('keeps recommendation preference snapshots strict, owner-scoped, and restart-durable', () => {
    const first = enqueueRecommendationPreferencesOutboxOperation(emptyOutboxEnvelope(), {
      operationId: OP_A1,
      ownerHash: OWNER,
      ownerGeneration: 7,
      payload: RECOMMENDATION_PAYLOAD,
      enqueuedAt: NOW,
    }).envelope;
    expect(first.rows[0]).toMatchObject({
      entityType: 'recommendation_preferences',
      entityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      idempotencyKey: `recommendation_preferences:${OP_A1}`,
      payload: RECOMMENDATION_PAYLOAD,
    });
    expect(
      selectOutboxOwnerStatus(first, {
        ownerHash: OWNER,
        entityType: 'recommendation_preferences',
      }),
    ).toEqual({ kind: 'saved_local', pendingCount: 1, attentionCount: 0 });
    expect(
      selectOutboxOwnerStatus(first, {
        ownerHash: OWNER,
        entityType: 'notification_preferences',
      }),
    ).toEqual({ kind: 'idle', pendingCount: 0, attentionCount: 0 });

    const restarted = decodeOutboxEnvelope(encodeOutboxEnvelope(first));
    expect(
      leaseReadyOutboxRows(restarted, {
        ownerHash: OWNER,
        leaseOwner: WORKER_A,
        now: NOW,
      }).rows.map((row) => row.operationId),
    ).toEqual([OP_A1]);

    for (const payload of [
      { ...RECOMMENDATION_PAYLOAD, values_filters: ['vegan', 'vegan'] },
      { ...RECOMMENDATION_PAYLOAD, budget_band: 'luxury' },
      { ...RECOMMENDATION_PAYLOAD, format_prefs: [' gel'] },
      { ...RECOMMENDATION_PAYLOAD, format_prefs: ['\tgel'] },
      { ...RECOMMENDATION_PAYLOAD, commission_weight: 1 },
    ]) {
      expect(() =>
        enqueueRecommendationPreferencesOutboxOperation(emptyOutboxEnvelope(), {
          operationId: OP_A2,
          ownerHash: OWNER,
          ownerGeneration: 8,
          payload,
          enqueuedAt: NOW,
        }),
      ).toThrow(OUTBOX_INVALID);
    }

    expect(
      enqueueRecommendationPreferencesOutboxOperation(emptyOutboxEnvelope(), {
        operationId: OP_A2,
        ownerHash: OWNER,
        ownerGeneration: 8,
        payload: { ...RECOMMENDATION_PAYLOAD, format_prefs: ['é'.repeat(64)] },
        enqueuedAt: NOW,
      }).row.payload,
    ).toMatchObject({ format_prefs: ['é'.repeat(64)] });
  });

  it('serializes newer recommendation snapshots and never coalesces another owner', () => {
    const ownerA = enqueueRecommendationPreferencesOutboxOperation(emptyOutboxEnvelope(), {
      operationId: OP_A1,
      ownerHash: OWNER,
      ownerGeneration: 7,
      payload: RECOMMENDATION_PAYLOAD,
      enqueuedAt: NOW,
    }).envelope;
    const leasedA = leaseReadyOutboxRows(ownerA, {
      ownerHash: OWNER,
      leaseOwner: WORKER_A,
      now: NOW,
    }).envelope;
    const newerA = enqueueRecommendationPreferencesOutboxOperation(leasedA, {
      operationId: OP_A2,
      ownerHash: OWNER,
      ownerGeneration: 8,
      payload: { ...RECOMMENDATION_PAYLOAD, budget_band: 'premium' },
      enqueuedAt: '2026-07-18T15:00:01.000Z',
    }).envelope;
    const bothOwners = enqueueRecommendationPreferencesOutboxOperation(newerA, {
      operationId: OP_B1,
      ownerHash: OWNER_B,
      ownerGeneration: 9,
      payload: { ...RECOMMENDATION_PAYLOAD, values_filters: ['sustainable'] },
      enqueuedAt: '2026-07-18T15:00:02.000Z',
    }).envelope;

    expect(
      leaseReadyOutboxRows(bothOwners, {
        ownerHash: OWNER,
        leaseOwner: WORKER_B,
        now: '2026-07-18T15:00:29.999Z',
      }).rows,
    ).toEqual([]);
    expect(
      leaseReadyOutboxRows(bothOwners, {
        ownerHash: OWNER_B,
        leaseOwner: WORKER_B,
        now: '2026-07-18T15:00:02.000Z',
      }).rows.map((row) => row.operationId),
    ).toEqual([OP_B1]);
    expect(
      leaseReadyOutboxRows(bothOwners, {
        ownerHash: OWNER,
        leaseOwner: WORKER_B,
        now: '2026-07-18T15:00:30.000Z',
      }).rows.map((row) => row.operationId),
    ).toEqual([OP_A2]);
  });

  it('never retries an obsolete dead recommendation snapshot after a newer save', () => {
    const first = enqueueRecommendationPreferencesOutboxOperation(emptyOutboxEnvelope(), {
      operationId: OP_A1,
      ownerHash: OWNER,
      ownerGeneration: 7,
      payload: RECOMMENDATION_PAYLOAD,
      enqueuedAt: NOW,
    }).envelope;
    const leasedFirst = leaseReadyOutboxRows(first, {
      ownerHash: OWNER,
      leaseOwner: WORKER_A,
      now: NOW,
    }).envelope;
    const deadFirst = settleOutboxLease(leasedFirst, {
      leaseOwner: WORKER_A,
      now: '2026-07-18T15:00:01.000Z',
      results: [{ operationId: OP_A1, status: 'permanent', errorClass: 'validation' }],
    });
    const newer = enqueueRecommendationPreferencesOutboxOperation(deadFirst, {
      operationId: OP_A2,
      ownerHash: OWNER,
      ownerGeneration: 7,
      payload: { ...RECOMMENDATION_PAYLOAD, budget_band: 'premium' },
      enqueuedAt: '2026-07-18T15:00:02.000Z',
    }).envelope;

    expect(newer.rows.map((row) => row.operationId)).toEqual([OP_A2]);
    const leasedNewer = leaseReadyOutboxRows(newer, {
      ownerHash: OWNER,
      leaseOwner: WORKER_B,
      now: '2026-07-18T15:00:02.000Z',
    }).envelope;
    const synced = settleOutboxLease(leasedNewer, {
      leaseOwner: WORKER_B,
      now: '2026-07-18T15:00:03.000Z',
      results: [{ operationId: OP_A2, status: 'applied' }],
    });
    const manualRetry = retryDeadOutboxRows(synced, {
      ownerHash: OWNER,
      entityType: 'recommendation_preferences',
      now: '2026-07-18T15:01:00.000Z',
    });

    expect(manualRetry).toEqual({ envelope: synced, retried: 0 });
    expect(manualRetry.envelope.rows).toEqual([]);
  });

  it('ignores a pre-fix obsolete dead row fenced by a newer persisted revision', () => {
    const first = enqueueRecommendationPreferencesOutboxOperation(emptyOutboxEnvelope(), {
      operationId: OP_A1,
      ownerHash: OWNER,
      ownerGeneration: 7,
      payload: RECOMMENDATION_PAYLOAD,
      enqueuedAt: NOW,
    }).envelope;
    const leased = leaseReadyOutboxRows(first, {
      ownerHash: OWNER,
      leaseOwner: WORKER_A,
      now: NOW,
    }).envelope;
    const dead = settleOutboxLease(leased, {
      leaseOwner: WORKER_A,
      now: '2026-07-18T15:00:01.000Z',
      results: [{ operationId: OP_A1, status: 'permanent', errorClass: 'validation' }],
    });
    const persisted = decodeOutboxEnvelope(
      JSON.stringify({
        ...dead,
        revisions: dead.revisions.map((revision) => ({ ...revision, revision: 2 })),
      }),
    );

    expect(
      selectOutboxOwnerStatus(persisted, {
        ownerHash: OWNER,
        entityType: 'recommendation_preferences',
      }),
    ).toEqual({ kind: 'idle', pendingCount: 0, attentionCount: 0 });
    expect(
      retryDeadOutboxRows(persisted, {
        ownerHash: OWNER,
        entityType: 'recommendation_preferences',
        now: '2026-07-18T15:01:00.000Z',
      }),
    ).toEqual({ envelope: persisted, retried: 0 });
  });

  it('drops an older leased snapshot when a newer full snapshot can take over', () => {
    const first = enqueueRecommendationPreferencesOutboxOperation(emptyOutboxEnvelope(), {
      operationId: OP_A1,
      ownerHash: OWNER,
      ownerGeneration: 7,
      payload: RECOMMENDATION_PAYLOAD,
      enqueuedAt: NOW,
    }).envelope;
    const leasedFirst = leaseReadyOutboxRows(first, {
      ownerHash: OWNER,
      leaseOwner: WORKER_A,
      now: NOW,
    }).envelope;
    const newer = enqueueRecommendationPreferencesOutboxOperation(leasedFirst, {
      operationId: OP_A2,
      ownerHash: OWNER,
      ownerGeneration: 7,
      payload: { ...RECOMMENDATION_PAYLOAD, format_prefs: ['fluid'] },
      enqueuedAt: '2026-07-18T15:00:01.000Z',
    }).envelope;
    const settledOlder = settleOutboxLease(newer, {
      leaseOwner: WORKER_A,
      now: '2026-07-18T15:00:02.000Z',
      results: [{ operationId: OP_A1, status: 'permanent', errorClass: 'validation' }],
    });

    expect(settledOlder.rows.map((row) => row.operationId)).toEqual([OP_A2]);
    expect(settledOlder.rows[0]).toMatchObject({ state: 'ready', clientRevision: 2 });
  });
});
