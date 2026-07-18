import { describe, expect, it } from 'vitest';

import {
  OUTBOX_INVALID,
  OUTBOX_LIMIT_REACHED,
  OUTBOX_UNSUPPORTED_VERSION,
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
    payload: operationKind === 'delete' ? null : (input.payload ?? { name: 'Cleanser' }),
    enqueuedAt: input.enqueuedAt ?? NOW,
  });
}

describe('transactional outbox model', () => {
  it('strictly roundtrips the current envelope and preserves future/corrupt bytes', () => {
    const queued = enqueue(emptyOutboxEnvelope(), {
      operationId: OP_A1,
      entityId: ENTITY_A,
    }).envelope;
    expect(decodeOutboxEnvelope(encodeOutboxEnvelope(queued))).toEqual(queued);
    const legacy = JSON.parse(encodeOutboxEnvelope(queued)) as {
      version: number;
      revisions: Record<string, unknown>[];
    };
    legacy.version = 1;
    legacy.revisions = legacy.revisions.map(({ ownerHash: _ownerHash, ...revision }) => revision);
    expect(decodeOutboxEnvelope(JSON.stringify(legacy))).toEqual(queued);
    const previous = JSON.parse(encodeOutboxEnvelope(queued)) as { version: number };
    previous.version = 2;
    expect(decodeOutboxEnvelope(JSON.stringify(previous))).toEqual(queued);
    previous.version = 3;
    expect(decodeOutboxEnvelope(JSON.stringify(previous))).toEqual(queued);
    previous.version = 4;
    expect(decodeOutboxEnvelope(JSON.stringify(previous))).toEqual(queued);
    expect(() => decodeOutboxEnvelope('{bad-json')).toThrow(OUTBOX_INVALID);
    expect(() =>
      decodeOutboxEnvelope(JSON.stringify({ version: 6, rows: [], revisions: [] })),
    ).toThrow(OUTBOX_UNSUPPORTED_VERSION);
  });

  it('rejects identity or credential material inside an otherwise valid payload', () => {
    expect(() =>
      enqueue(emptyOutboxEnvelope(), {
        operationId: OP_A1,
        entityId: ENTITY_A,
        payload: { name: 'Cleanser', user_id: 'raw-owner' },
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

  it('caps scan telemetry and leases state mirrors before older immutable events', () => {
    let envelope = emptyOutboxEnvelope();
    for (let index = 1; index <= MAX_SHELF_SCAN_OUTBOX_ROWS; index += 1) {
      envelope = enqueueShelfScanOutboxOperation(envelope, {
        operationId: uuid(30_000 + index),
        ownerHash: OWNER,
        ownerGeneration: 7,
        entityId: uuid(40_000 + index),
        payload: { ...SCAN_PAYLOAD, scanned_at: NOW },
        payloadHash: SCAN_PAYLOAD_HASH,
        enqueuedAt: NOW,
      }).envelope;
    }
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
      payload: { name: 'First' },
    }).envelope;
    const second = enqueue(first, {
      operationId: OP_A2,
      entityId: ENTITY_A,
      payload: { name: 'Second' },
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
      payload: { name: 'Newer' },
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
      payload: { name: 'Owner A first' },
      enqueuedAt: NOW,
    }).envelope;
    const bothOwners = enqueueShelfOutboxOperation(ownerA, {
      operationId: OP_B1,
      ownerHash: OWNER_B,
      ownerGeneration: 8,
      entityId: ENTITY_A,
      operationKind: 'upsert',
      payload: { name: 'Owner B' },
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
      payload: { name: 'Owner A newer' },
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
