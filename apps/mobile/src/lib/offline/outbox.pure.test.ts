import { describe, expect, it } from 'vitest';

import {
  OUTBOX_INVALID,
  OUTBOX_UNSUPPORTED_VERSION,
  decodeOutboxEnvelope,
  emptyOutboxEnvelope,
  encodeOutboxEnvelope,
  enqueueShelfOutboxOperation,
  leaseReadyOutboxRows,
  outboxCounts,
  settleOutboxLease,
  type OutboxEnvelope,
} from './outbox.pure';

const OWNER = 'a'.repeat(64);
const ENTITY_A = '00000000-0000-4000-8000-000000000001';
const ENTITY_B = '00000000-0000-4000-8000-000000000002';
const OP_A1 = '00000000-0000-4000-8000-000000000101';
const OP_A2 = '00000000-0000-4000-8000-000000000102';
const OP_B1 = '00000000-0000-4000-8000-000000000201';
const WORKER_A = '00000000-0000-4000-8000-000000000301';
const WORKER_B = '00000000-0000-4000-8000-000000000302';
const NOW = '2026-07-18T15:00:00.000Z';

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
    expect(() => decodeOutboxEnvelope('{bad-json')).toThrow(OUTBOX_INVALID);
    expect(() =>
      decodeOutboxEnvelope(JSON.stringify({ version: 2, rows: [], revisions: [] })),
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
      { entityType: 'shelf_product', entityId: ENTITY_A, revision: 2 },
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
});
