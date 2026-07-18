import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RequestPolicyError } from '@/lib/network/requestPolicy';

import {
  flushOutbox,
  hashOutboxOwner,
  readOutbox,
  readOutboxChangeRevision,
  readShelfOutboxStatus,
  resetOutboxWorkerForTests,
  retryShelfOutbox,
  subscribeOutboxChanges,
} from './outbox';
import {
  OUTBOX_STORAGE_KEY,
  decodeOutboxEnvelope,
  emptyOutboxEnvelope,
  encodeOutboxEnvelope,
  enqueueShelfOutboxOperation,
  type OutboxEnvelope,
} from './outbox.pure';

const mocks = vi.hoisted(() => ({
  assertCurrent: vi.fn(),
  captureOwner: vi.fn(),
  digestStringAsync: vi.fn(),
  lease: null as null | Readonly<{
    assertCurrent: () => void;
    generation: number;
    signal: AbortSignal;
  }>,
  nextUuid: 1,
  ownerCurrent: true,
  randomUUID: vi.fn(),
  readOverride: null as null | Readonly<Record<string, unknown>>,
  rpc: vi.fn(),
  rpcHandler: null as null | ((operations: readonly Record<string, unknown>[]) => Promise<unknown>),
  runOwnerOperation: vi.fn(),
  runRequestWithLease: vi.fn(),
  storage: new Map<string, string>(),
  tails: new Map<string, Promise<void>>(),
  updateCalls: 0,
}));

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: mocks.digestStringAsync,
  randomUUID: mocks.randomUUID,
}));

vi.mock('@/lib/auth/accountGeneration', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/accountGeneration')>()),
  runAccountGenerationOperation: mocks.runOwnerOperation,
}));

vi.mock('@/lib/auth/authenticatedAccountOwner', () => ({
  captureAuthenticatedAccountOwner: mocks.captureOwner,
}));

vi.mock('@/lib/env', () => ({ isSupabaseConfigured: true }));

vi.mock('@/lib/network/requestPolicy', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/network/requestPolicy')>()),
  runRequestWithLease: mocks.runRequestWithLease,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  readPrivateItem: vi.fn(async (key: string) => {
    if (mocks.readOverride) return mocks.readOverride;
    const value = mocks.storage.get(key);
    return value === undefined ? { status: 'absent' } : { status: 'available', value };
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
        const current = mocks.storage.get(key) ?? null;
        const next = updater(current);
        if (next === null) mocks.storage.delete(key);
        else mocks.storage.set(key, next);
      } finally {
        release();
        if (mocks.tails.get(key) === tail) mocks.tails.delete(key);
      }
    },
  ),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: { rpc: mocks.rpc },
}));

const NOW = '2026-07-18T16:00:00.000Z';
const OWNER_HASH = 'a'.repeat(64);

function uuid(sequence: number): string {
  return `00000000-0000-4000-8000-${sequence.toString(16).padStart(12, '0')}`;
}

function seedRows(count: number): OutboxEnvelope {
  let envelope = emptyOutboxEnvelope();
  for (let index = 1; index <= count; index += 1) {
    envelope = enqueueShelfOutboxOperation(envelope, {
      operationId: uuid(10_000 + index),
      ownerHash: OWNER_HASH,
      ownerGeneration: 7,
      entityId: uuid(index),
      operationKind: 'upsert',
      payload: { name: `Product ${index}`, status: 'active' },
      enqueuedAt: NOW,
    }).envelope;
  }
  mocks.storage.set(OUTBOX_STORAGE_KEY, encodeOutboxEnvelope(envelope));
  return envelope;
}

function storedEnvelope(): OutboxEnvelope {
  return decodeOutboxEnvelope(mocks.storage.get(OUTBOX_STORAGE_KEY) ?? null);
}

function successfulResults(operations: readonly Record<string, unknown>[]) {
  return operations.map((operation) => ({
    operation_id: operation.operation_id,
    status: 'applied',
    error_class: null,
  }));
}

describe('transactional outbox runtime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    resetOutboxWorkerForTests();
    mocks.storage.clear();
    mocks.tails.clear();
    mocks.updateCalls = 0;
    mocks.readOverride = null;
    mocks.nextUuid = 1;
    mocks.ownerCurrent = true;
    mocks.assertCurrent.mockReset();
    mocks.assertCurrent.mockImplementation(() => {
      if (!mocks.ownerCurrent) throw new Error('ACCOUNT_GENERATION_LEASE_EXPIRED');
    });
    mocks.lease = Object.freeze({
      assertCurrent: mocks.assertCurrent,
      generation: 7,
      signal: new AbortController().signal,
    });
    mocks.runOwnerOperation.mockReset();
    mocks.runOwnerOperation.mockImplementation(
      async (operation: (lease: NonNullable<typeof mocks.lease>) => unknown) =>
        operation(mocks.lease!),
    );
    mocks.captureOwner.mockReset();
    mocks.captureOwner.mockResolvedValue({ userId: 'raw-owner@example.com', generation: 7 });
    mocks.digestStringAsync.mockReset();
    mocks.digestStringAsync.mockResolvedValue(OWNER_HASH);
    mocks.randomUUID.mockReset();
    mocks.randomUUID.mockImplementation(() => uuid(20_000 + mocks.nextUuid++));
    mocks.rpcHandler = async (operations) => successfulResults(operations);
    mocks.rpc.mockReset();
    mocks.rpc.mockImplementation(
      (_name: string, args: { p_operations: readonly Record<string, unknown>[] }) => ({
        abortSignal: vi.fn(async () => ({
          data: await mocks.rpcHandler!(args.p_operations),
          error: null,
          status: 200,
        })),
      }),
    );
    mocks.runRequestWithLease.mockReset();
    mocks.runRequestWithLease.mockImplementation(
      async (
        _lease: unknown,
        _policy: unknown,
        operation: (context: { signal: AbortSignal }) => Promise<unknown>,
      ) => operation({ signal: new AbortController().signal }),
    );
  });

  it('strictly reports corrupt, future, and unavailable reads without changing persisted bytes', async () => {
    for (const [raw, status] of [
      ['{not-json', 'corrupt'],
      [JSON.stringify({ version: 2, rows: [], revisions: [] }), 'unsupported_version'],
    ] as const) {
      mocks.storage.set(OUTBOX_STORAGE_KEY, raw);
      await expect(readOutbox()).resolves.toEqual({ status, envelope: null });
      expect(mocks.storage.get(OUTBOX_STORAGE_KEY)).toBe(raw);
    }

    const original = mocks.storage.get(OUTBOX_STORAGE_KEY);
    mocks.readOverride = { status: 'unavailable', reason: 'storage_unavailable' };
    await expect(readOutbox()).resolves.toEqual({ status: 'unavailable', envelope: null });
    expect(mocks.storage.get(OUTBOX_STORAGE_KEY)).toBe(original);
    expect(mocks.updateCalls).toBe(0);
  });

  it('uses an owner-domain hash and never sends raw owner identity in the RPC batch', async () => {
    seedRows(1);

    await expect(hashOutboxOwner(' raw-owner@example.com ')).resolves.toBe(OWNER_HASH);
    await expect(flushOutbox()).resolves.toMatchObject({ leased: 1, flushed: 1 });

    expect(mocks.digestStringAsync).toHaveBeenCalledWith(
      'SHA-256',
      'onskin:outbox-owner:v1:raw-owner@example.com',
    );
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith('apply_shelf_outbox_batch', {
      p_operations: [
        expect.objectContaining({
          operation_id: uuid(10_001),
          entity_type: 'shelf_product',
          entity_id: uuid(1),
          operation_kind: 'upsert',
          client_revision: 1,
          idempotency_key: `shelf_product:${uuid(1)}:1`,
        }),
      ],
    });
    const wire = JSON.stringify(mocks.rpc.mock.calls[0]);
    expect(wire).not.toContain('raw-owner@example.com');
    expect(wire).not.toContain('ownerHash');
    expect(wire).not.toContain('ownerGeneration');
  });

  it('coalesces concurrent drains into one in-flight RPC and removes applied or duplicate rows', async () => {
    seedRows(2);
    let release!: (value: unknown) => void;
    const pending = new Promise<unknown>((resolve) => {
      release = resolve;
    });
    mocks.rpcHandler = async () => pending;

    const first = flushOutbox();
    const second = flushOutbox();
    expect(second).toBe(first);
    await vi.waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(1));
    const operations = mocks.rpc.mock.calls[0]?.[1].p_operations as readonly Record<
      string,
      unknown
    >[];
    release([
      { operation_id: operations[0]?.operation_id, status: 'applied', error_class: null },
      { operation_id: operations[1]?.operation_id, status: 'duplicate', error_class: null },
    ]);

    await expect(first).resolves.toEqual({ leased: 2, flushed: 2, dead: 0 });
    expect(storedEnvelope().rows).toEqual([]);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it('publishes owner-scoped saved, syncing, and synced status around one single-flight drain', async () => {
    seedRows(1);
    const publishedRevisions: number[] = [];
    const unsubscribe = subscribeOutboxChanges(() => {
      publishedRevisions.push(readOutboxChangeRevision());
    });
    let release!: (value: unknown) => void;
    const pending = new Promise<unknown>((resolve) => {
      release = resolve;
    });
    mocks.rpcHandler = async () => pending;

    await expect(readShelfOutboxStatus({ generation: 7 })).resolves.toEqual({
      status: 'available',
      value: { kind: 'saved_local', pendingCount: 1, attentionCount: 0 },
    });
    const flush = flushOutbox();
    await vi.waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(1));
    await expect(readShelfOutboxStatus({ generation: 7 })).resolves.toEqual({
      status: 'available',
      value: { kind: 'syncing', pendingCount: 1, attentionCount: 0 },
    });

    release(successfulResults(mocks.rpc.mock.calls[0]?.[1].p_operations));
    await expect(flush).resolves.toEqual({ leased: 1, flushed: 1, dead: 0 });
    await expect(readShelfOutboxStatus({ generation: 7 })).resolves.toEqual({
      status: 'available',
      value: { kind: 'idle', pendingCount: 0, attentionCount: 0 },
    });
    expect(publishedRevisions.length).toBeGreaterThanOrEqual(3);
    expect(publishedRevisions).toEqual([...publishedRevisions].sort((a, b) => a - b));
    unsubscribe();
  });

  it('persists Retry-After backoff and drains the same ready row after reconnect time', async () => {
    seedRows(1);
    mocks.runRequestWithLease.mockRejectedValueOnce(
      new RequestPolicyError({
        endpoint: 'outbox_sync',
        kind: 'rate_limit',
        attemptCount: 2,
        statusClass: '4xx',
        retryAfterMs: 45_000,
      }),
    );

    await expect(flushOutbox()).resolves.toEqual({ leased: 1, flushed: 0, dead: 0 });
    expect(storedEnvelope().rows[0]).toMatchObject({
      state: 'ready',
      attemptCount: 1,
      lastErrorClass: 'rate_limit',
      nextAttemptAt: '2026-07-18T16:00:45.000Z',
      leaseOwner: null,
      leaseExpiresAt: null,
    });

    await expect(flushOutbox()).resolves.toEqual({ leased: 0, flushed: 0, dead: 0 });
    expect(mocks.rpc).toHaveBeenCalledTimes(0);

    vi.setSystemTime(new Date('2026-07-18T16:00:46.000Z'));
    await expect(flushOutbox()).resolves.toEqual({ leased: 1, flushed: 1, dead: 0 });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(storedEnvelope().rows).toEqual([]);
  });

  it('dead-letters a permanent poison row while committing the independent result', async () => {
    seedRows(2);
    mocks.rpcHandler = async (operations) => [
      { operation_id: operations[0]?.operation_id, status: 'permanent', error_class: 'validation' },
      { operation_id: operations[1]?.operation_id, status: 'applied', error_class: null },
    ];

    await expect(flushOutbox()).resolves.toEqual({ leased: 2, flushed: 1, dead: 1 });
    expect(storedEnvelope().rows).toEqual([
      expect.objectContaining({
        operationId: uuid(10_001),
        state: 'dead',
        lastErrorClass: 'validation',
        leaseOwner: null,
      }),
    ]);

    await expect(readShelfOutboxStatus({ generation: 7 })).resolves.toEqual({
      status: 'available',
      value: { kind: 'needs_attention', pendingCount: 1, attentionCount: 1 },
    });
    mocks.rpcHandler = async (operations) => successfulResults(operations);
    await expect(retryShelfOutbox({ generation: 7 })).resolves.toEqual({
      leased: 1,
      flushed: 1,
      dead: 0,
    });
    expect(storedEnvelope().rows).toEqual([]);
  });

  it('does not stale-settle a leased batch after the account generation changes', async () => {
    seedRows(1);
    mocks.runRequestWithLease.mockImplementationOnce(
      async (
        _lease: unknown,
        _policy: unknown,
        operation: (context: { signal: AbortSignal }) => Promise<unknown>,
      ) => {
        const result = await operation({ signal: new AbortController().signal });
        mocks.ownerCurrent = false;
        return result;
      },
    );

    await expect(flushOutbox()).rejects.toThrow('ACCOUNT_GENERATION_LEASE_EXPIRED');
    expect(storedEnvelope().rows[0]).toMatchObject({
      state: 'leased',
      attemptCount: 1,
      leaseOwner: expect.any(String),
      leaseExpiresAt: '2026-07-18T16:00:30.000Z',
    });
  });

  it('uses bounded 25-row batches while draining more than one batch', async () => {
    seedRows(30);

    await expect(flushOutbox()).resolves.toEqual({ leased: 30, flushed: 30, dead: 0 });
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc.mock.calls[0]?.[1].p_operations).toHaveLength(25);
    expect(mocks.rpc.mock.calls[1]?.[1].p_operations).toHaveLength(5);
    expect(storedEnvelope().rows).toEqual([]);
  });
});
