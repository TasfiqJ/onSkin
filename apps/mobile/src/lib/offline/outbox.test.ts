import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RequestPolicyError } from '@/lib/network/requestPolicy';

import {
  flushOutbox,
  hashOutboxOwner,
  readNotificationPreferencesOutboxStatus,
  readOutbox,
  readOutboxChangeRevision,
  readRecommendationPreferencesOutboxStatus,
  readShelfOutboxStatus,
  resetOutboxWorkerForTests,
  retryRecommendationPreferencesOutbox,
  retryShelfOutbox,
  scheduleOutboxFlush,
  subscribeOutboxChanges,
} from './outbox';
import {
  OUTBOX_STORAGE_KEY,
  decodeOutboxEnvelope,
  emptyOutboxEnvelope,
  encodeOutboxEnvelope,
  enqueueConflictChoiceOutboxOperation,
  enqueueNotificationDeliveryOutboxOperation,
  enqueueNotificationPreferencesOutboxOperation,
  enqueueRecommendationPreferencesOutboxOperation,
  enqueueShelfScanOutboxOperation,
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
  afterUpdate: null as null | (() => void),
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
        mocks.afterUpdate?.();
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
      payload: { ...SHELF_PAYLOAD, manual_name: `Product ${index}` },
      enqueuedAt: NOW,
    }).envelope;
  }
  mocks.storage.set(OUTBOX_STORAGE_KEY, encodeOutboxEnvelope(envelope));
  return envelope;
}

function seedEveryEntity(): OutboxEnvelope {
  let envelope = seedRows(1);
  envelope = enqueueNotificationPreferencesOutboxOperation(envelope, {
    operationId: uuid(40_011),
    ownerHash: OWNER_HASH,
    ownerGeneration: 7,
    payload: {
      am_reminder_time: '07:30',
      pm_reminder_time: '21:30',
      am_reminder_enabled: true,
      pm_reminder_enabled: false,
      streak_nudges: false,
      replenishment_alerts: false,
      capture_reminders: false,
      quiet_hours_start: '22:00',
      quiet_hours_end: '07:00',
      timezone: 'America/Toronto',
      live_activity_enabled: false,
      promotional_opt_in: false,
      lockscreen_discreet: true,
    },
    enqueuedAt: NOW,
  }).envelope;
  envelope = enqueueRecommendationPreferencesOutboxOperation(envelope, {
    operationId: uuid(40_012),
    ownerHash: OWNER_HASH,
    ownerGeneration: 7,
    payload: {
      values_filters: ['fragrance_free'],
      budget_band: 'mid',
      format_prefs: ['gel'],
    },
    enqueuedAt: NOW,
  }).envelope;
  envelope = enqueueNotificationDeliveryOutboxOperation(envelope, {
    operationId: uuid(40_013),
    ownerHash: OWNER_HASH,
    ownerGeneration: 7,
    entityId: uuid(40_014),
    payload: { kind: 'replenishment', tier: 'behavioural', sent_at: NOW },
    enqueuedAt: NOW,
  }).envelope;
  envelope = enqueueShelfScanOutboxOperation(envelope, {
    operationId: uuid(40_015),
    ownerHash: OWNER_HASH,
    ownerGeneration: 7,
    entityId: uuid(40_016),
    payload: {
      barcode: '1234567890123',
      result: 'no_match',
      matched_product_id: null,
      scanned_at: NOW,
    },
    payloadHash: 'c'.repeat(64),
    enqueuedAt: NOW,
  }).envelope;
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

function flushResult(
  leased: number,
  flushed: number,
  dead: number,
  notificationPreferences = 0,
  recommendationPreferences = 0,
  notificationDeliveries = 0,
  shelfScans = 0,
  conflictChoices = 0,
) {
  return {
    leased,
    flushed,
    dead,
    flushedByEntity: {
      conflictChoices,
      notificationDeliveries,
      notificationPreferences,
      recommendationPreferences,
      shelfScans,
      shelfProducts:
        flushed -
        notificationDeliveries -
        notificationPreferences -
        recommendationPreferences -
        shelfScans -
        conflictChoices,
    },
  };
}

describe('transactional outbox runtime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    resetOutboxWorkerForTests();
    mocks.storage.clear();
    mocks.tails.clear();
    mocks.afterUpdate = null;
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
      [JSON.stringify({ version: 6, rows: [], revisions: [] }), 'unsupported_version'],
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

    await expect(first).resolves.toEqual(flushResult(2, 2, 0));
    expect(storedEnvelope().rows).toEqual([]);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it('reruns after a post-mutation wake-up lands while the active drain is finishing', async () => {
    seedRows(1);
    let queuedDuringFinalEmptyLease = false;
    mocks.afterUpdate = () => {
      if (queuedDuringFinalEmptyLease || mocks.updateCalls !== 3) return;
      const current = storedEnvelope();
      if (current.rows.length !== 0) return;
      queuedDuringFinalEmptyLease = true;
      const next = enqueueRecommendationPreferencesOutboxOperation(current, {
        operationId: uuid(40_004),
        ownerHash: OWNER_HASH,
        ownerGeneration: 7,
        payload: {
          values_filters: ['vegan'],
          budget_band: 'premium',
          format_prefs: ['fluid'],
        },
        enqueuedAt: NOW,
      }).envelope;
      mocks.storage.set(OUTBOX_STORAGE_KEY, encodeOutboxEnvelope(next));
      scheduleOutboxFlush();
    };

    const active = flushOutbox();
    expect(flushOutbox()).toBe(active);
    await expect(active).resolves.toEqual(flushResult(2, 2, 0, 0, 1));
    expect(storedEnvelope().rows).toEqual([]);
    expect(queuedDuringFinalEmptyLease).toBe(true);
    expect(mocks.rpc.mock.calls[1]?.[0]).toBe('apply_recommendation_preferences_outbox_batch');
  });

  it('keeps the active promise open for a wake-up from terminal publication', async () => {
    seedRows(1);
    let queuedFromTerminalPublish = false;
    const unsubscribe = subscribeOutboxChanges(() => {
      if (
        queuedFromTerminalPublish ||
        mocks.rpc.mock.calls.length !== 1 ||
        mocks.updateCalls !== 3 ||
        storedEnvelope().rows.length !== 0
      ) {
        return;
      }
      queuedFromTerminalPublish = true;
      const next = enqueueRecommendationPreferencesOutboxOperation(storedEnvelope(), {
        operationId: uuid(40_005),
        ownerHash: OWNER_HASH,
        ownerGeneration: 7,
        payload: {
          values_filters: ['sustainable'],
          budget_band: 'mid',
          format_prefs: ['gel'],
        },
        enqueuedAt: NOW,
      }).envelope;
      mocks.storage.set(OUTBOX_STORAGE_KEY, encodeOutboxEnvelope(next));
      scheduleOutboxFlush();
    });

    await expect(flushOutbox()).resolves.toEqual(flushResult(2, 2, 0, 0, 1));
    expect(queuedFromTerminalPublish).toBe(true);
    expect(storedEnvelope().rows).toEqual([]);
    unsubscribe();
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

    await expect(
      readShelfOutboxStatus({ generation: 7 }, 'raw-owner@example.com'),
    ).resolves.toEqual({
      status: 'available',
      value: { kind: 'saved_local', pendingCount: 1, attentionCount: 0 },
    });
    const flush = flushOutbox();
    await vi.waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(1));
    await expect(
      readShelfOutboxStatus({ generation: 7 }, 'raw-owner@example.com'),
    ).resolves.toEqual({
      status: 'available',
      value: { kind: 'syncing', pendingCount: 1, attentionCount: 0 },
    });

    release(successfulResults(mocks.rpc.mock.calls[0]?.[1].p_operations));
    await expect(flush).resolves.toEqual(flushResult(1, 1, 0));
    await expect(
      readShelfOutboxStatus({ generation: 7 }, 'raw-owner@example.com'),
    ).resolves.toEqual({
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

    await expect(flushOutbox()).resolves.toEqual(flushResult(1, 0, 0));
    expect(storedEnvelope().rows[0]).toMatchObject({
      state: 'ready',
      attemptCount: 1,
      lastErrorClass: 'rate_limit',
      nextAttemptAt: '2026-07-18T16:00:45.000Z',
      leaseOwner: null,
      leaseExpiresAt: null,
    });

    await expect(flushOutbox()).resolves.toEqual(flushResult(0, 0, 0));
    expect(mocks.rpc).toHaveBeenCalledTimes(0);

    vi.setSystemTime(new Date('2026-07-18T16:00:46.000Z'));
    await expect(flushOutbox()).resolves.toEqual(flushResult(1, 1, 0));
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(storedEnvelope().rows).toEqual([]);
  });

  it('dead-letters a permanent poison row while committing the independent result', async () => {
    seedRows(2);
    mocks.rpcHandler = async (operations) => [
      { operation_id: operations[0]?.operation_id, status: 'permanent', error_class: 'validation' },
      { operation_id: operations[1]?.operation_id, status: 'applied', error_class: null },
    ];

    await expect(flushOutbox()).resolves.toEqual(flushResult(2, 1, 1));
    expect(storedEnvelope().rows).toEqual([
      expect.objectContaining({
        operationId: uuid(10_001),
        state: 'dead',
        lastErrorClass: 'validation',
        leaseOwner: null,
      }),
    ]);

    await expect(
      readShelfOutboxStatus({ generation: 7 }, 'raw-owner@example.com'),
    ).resolves.toEqual({
      status: 'available',
      value: { kind: 'needs_attention', pendingCount: 1, attentionCount: 1 },
    });
    mocks.rpcHandler = async (operations) => successfulResults(operations);
    await expect(retryShelfOutbox({ generation: 7 }, 'raw-owner@example.com')).resolves.toEqual(
      flushResult(1, 1, 0),
    );
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

    await expect(flushOutbox()).resolves.toEqual(flushResult(30, 30, 0));
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc.mock.calls[0]?.[1].p_operations).toHaveLength(25);
    expect(mocks.rpc.mock.calls[1]?.[1].p_operations).toHaveLength(5);
    expect(storedEnvelope().rows).toEqual([]);
  });

  it('dispatches mixed entities to exact RPCs and reports domain-specific convergence', async () => {
    let envelope = seedRows(1);
    envelope = enqueueNotificationPreferencesOutboxOperation(envelope, {
      operationId: uuid(40_001),
      ownerHash: OWNER_HASH,
      ownerGeneration: 7,
      payload: {
        am_reminder_time: '07:30',
        pm_reminder_time: '21:30',
        am_reminder_enabled: true,
        pm_reminder_enabled: false,
        streak_nudges: false,
        replenishment_alerts: false,
        capture_reminders: false,
        quiet_hours_start: '22:00',
        quiet_hours_end: '07:00',
        timezone: 'America/Toronto',
        live_activity_enabled: false,
        promotional_opt_in: false,
        lockscreen_discreet: true,
      },
      enqueuedAt: NOW,
    }).envelope;
    mocks.storage.set(OUTBOX_STORAGE_KEY, encodeOutboxEnvelope(envelope));

    await expect(
      readNotificationPreferencesOutboxStatus({ generation: 7 }, 'raw-owner@example.com'),
    ).resolves.toMatchObject({ value: { kind: 'saved_local', pendingCount: 1 } });
    await expect(flushOutbox()).resolves.toEqual(flushResult(2, 2, 0, 1));

    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc.mock.calls.map((call) => call[0])).toEqual([
      'apply_shelf_outbox_batch',
      'apply_notification_preferences_outbox_batch',
    ]);
    expect(mocks.rpc.mock.calls[0]?.[1].p_operations).toHaveLength(1);
    expect(mocks.rpc.mock.calls[1]?.[1].p_operations).toEqual([
      expect.objectContaining({
        entity_type: 'notification_preferences',
        idempotency_key: `notification_preferences:${uuid(40_001)}`,
      }),
    ]);
  });

  it.each([
    ['shelf_product', flushResult(5, 4, 0, 1, 1, 1, 1)],
    ['shelf_scan', flushResult(5, 4, 0, 1, 1, 1, 0)],
  ] as const)(
    'isolates a %s endpoint failure while later entities still converge',
    async (failedEntityType, expectedResult) => {
      seedEveryEntity();
      mocks.rpcHandler = async (operations) => {
        if (operations[0]?.entity_type === failedEntityType) {
          throw new RequestPolicyError({
            endpoint: 'outbox_sync',
            kind: 'server',
            attemptCount: 2,
            statusClass: '5xx',
          });
        }
        return successfulResults(operations);
      };

      await expect(flushOutbox()).resolves.toEqual(expectedResult);
      expect(mocks.rpc.mock.calls.map((call) => call[0])).toEqual([
        'apply_shelf_outbox_batch',
        'apply_notification_preferences_outbox_batch',
        'apply_recommendation_preferences_outbox_batch',
        'apply_notification_delivery_outbox_batch',
        'apply_shelf_scan_outbox_batch',
      ]);
      expect(storedEnvelope().rows).toEqual([
        expect.objectContaining({
          entityType: failedEntityType,
          state: 'ready',
          attemptCount: 1,
          lastErrorClass: 'server',
          leaseOwner: null,
          leaseExpiresAt: null,
        }),
      ]);
    },
  );

  it('dispatches recommendation preferences to their exact RPC without contaminating Shelf', async () => {
    const envelope = enqueueRecommendationPreferencesOutboxOperation(emptyOutboxEnvelope(), {
      operationId: uuid(40_003),
      ownerHash: OWNER_HASH,
      ownerGeneration: 7,
      payload: {
        values_filters: ['fragrance_free', 'vegan'],
        budget_band: 'mid',
        format_prefs: ['gel'],
      },
      enqueuedAt: NOW,
    }).envelope;
    mocks.storage.set(OUTBOX_STORAGE_KEY, encodeOutboxEnvelope(envelope));

    await expect(flushOutbox()).resolves.toEqual(flushResult(1, 1, 0, 0, 1));
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith('apply_recommendation_preferences_outbox_batch', {
      p_operations: [
        expect.objectContaining({
          entity_type: 'recommendation_preferences',
          idempotency_key: `recommendation_preferences:${uuid(40_003)}`,
          payload: {
            values_filters: ['fragrance_free', 'vegan'],
            budget_band: 'mid',
            format_prefs: ['gel'],
          },
        }),
      ],
    });
  });

  it('dispatches one content-free notification delivery event without coalescing it', async () => {
    const eventId = uuid(905);
    const operationId = uuid(906);
    const envelope = enqueueNotificationDeliveryOutboxOperation(emptyOutboxEnvelope(), {
      operationId,
      ownerHash: OWNER_HASH,
      ownerGeneration: 7,
      entityId: eventId,
      payload: { kind: 'replenishment', tier: 'behavioural', sent_at: NOW },
      enqueuedAt: NOW,
    }).envelope;
    mocks.storage.set(OUTBOX_STORAGE_KEY, encodeOutboxEnvelope(envelope));

    await expect(flushOutbox()).resolves.toEqual(flushResult(1, 1, 0, 0, 0, 1));
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith('apply_notification_delivery_outbox_batch', {
      p_operations: [
        {
          operation_id: operationId,
          entity_type: 'notification_delivery',
          entity_id: eventId,
          operation_kind: 'upsert',
          payload: { kind: 'replenishment', tier: 'behavioural', sent_at: NOW },
          client_revision: 1,
          idempotency_key: `notification_delivery:${operationId}:replenishment:${NOW}`,
        },
      ],
    });
    expect(storedEnvelope().rows).toEqual([]);
  });

  it('dispatches one payload-bound Shelf scan event to its exact RPC', async () => {
    const eventId = uuid(907);
    const operationId = uuid(908);
    const payloadHash = 'c'.repeat(64);
    const envelope = enqueueShelfScanOutboxOperation(emptyOutboxEnvelope(), {
      operationId,
      ownerHash: OWNER_HASH,
      ownerGeneration: 7,
      entityId: eventId,
      payload: {
        barcode: '1234567890123',
        result: 'matched',
        matched_product_id: uuid(43),
        scanned_at: NOW,
      },
      payloadHash,
      enqueuedAt: NOW,
    }).envelope;
    mocks.storage.set(OUTBOX_STORAGE_KEY, encodeOutboxEnvelope(envelope));

    await expect(flushOutbox()).resolves.toEqual(flushResult(1, 1, 0, 0, 0, 0, 1));
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith('apply_shelf_scan_outbox_batch', {
      p_operations: [
        {
          operation_id: operationId,
          entity_type: 'shelf_scan',
          entity_id: eventId,
          operation_kind: 'upsert',
          payload: {
            barcode: '1234567890123',
            result: 'matched',
            matched_product_id: uuid(43),
            scanned_at: NOW,
          },
          client_revision: 1,
          idempotency_key: `shelf_scan:${operationId}:${payloadHash}`,
        },
      ],
    });
    expect(storedEnvelope().rows).toEqual([]);
  });

  it('settles receipt-backed clock-skew events as successful terminal no-ops', async () => {
    let envelope = enqueueNotificationDeliveryOutboxOperation(emptyOutboxEnvelope(), {
      operationId: uuid(909),
      ownerHash: OWNER_HASH,
      ownerGeneration: 7,
      entityId: uuid(910),
      payload: { kind: 'replenishment', tier: 'behavioural', sent_at: NOW },
      enqueuedAt: NOW,
    }).envelope;
    envelope = enqueueShelfScanOutboxOperation(envelope, {
      operationId: uuid(911),
      ownerHash: OWNER_HASH,
      ownerGeneration: 7,
      entityId: uuid(912),
      payload: {
        barcode: '1234567890123',
        result: 'no_match',
        matched_product_id: null,
        scanned_at: NOW,
      },
      payloadHash: 'c'.repeat(64),
      enqueuedAt: NOW,
    }).envelope;
    mocks.storage.set(OUTBOX_STORAGE_KEY, encodeOutboxEnvelope(envelope));
    mocks.rpcHandler = async (operations) =>
      operations.map((operation) => ({
        operation_id: operation.operation_id,
        status: 'stale',
        error_class: null,
      }));

    await expect(flushOutbox()).resolves.toEqual(flushResult(2, 2, 0, 0, 0, 1, 1));
    expect(mocks.rpc.mock.calls.map((call) => call[0])).toEqual([
      'apply_notification_delivery_outbox_batch',
      'apply_shelf_scan_outbox_batch',
    ]);
    expect(storedEnvelope().rows).toEqual([]);
  });

  it('dispatches conflict state only after its Shelf dependency batch succeeds', async () => {
    const identityHash = 'd'.repeat(64);
    const payloadHash = 'e'.repeat(64);
    let envelope = seedRows(2);
    envelope = enqueueConflictChoiceOutboxOperation(envelope, {
      operationId: uuid(41_001),
      ownerHash: OWNER_HASH,
      ownerGeneration: 7,
      entityId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      payload: {
        rule_id: uuid(1),
        product_a_id: uuid(1),
        product_b_id: uuid(2),
        computed_severity: 'moderate',
        user_choice: 'use_together',
        rule_version: 1,
      },
      identityHash,
      payloadHash,
      enqueuedAt: NOW,
    }).envelope;
    mocks.storage.set(OUTBOX_STORAGE_KEY, encodeOutboxEnvelope(envelope));

    await expect(flushOutbox()).resolves.toEqual(flushResult(3, 3, 0, 0, 0, 0, 0, 1));
    expect(mocks.rpc.mock.calls.map((call) => call[0])).toEqual([
      'apply_shelf_outbox_batch',
      'apply_conflict_choice_outbox_batch',
    ]);
    expect(mocks.rpc.mock.calls[1]?.[1].p_operations).toEqual([
      expect.objectContaining({
        entity_type: 'conflict_choice',
        idempotency_key: `conflict_choice:${uuid(41_001)}:${identityHash}:${payloadHash}`,
      }),
    ]);
  });

  it('backs conflict state off as a dependency without calling its RPC after Shelf failure', async () => {
    let envelope = seedRows(2);
    envelope = enqueueConflictChoiceOutboxOperation(envelope, {
      operationId: uuid(41_002),
      ownerHash: OWNER_HASH,
      ownerGeneration: 7,
      entityId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      payload: {
        rule_id: uuid(1),
        product_a_id: uuid(1),
        product_b_id: uuid(2),
        computed_severity: 'moderate',
        user_choice: 'accept_suggested_timing',
        rule_version: 1,
      },
      identityHash: 'd'.repeat(64),
      payloadHash: 'f'.repeat(64),
      enqueuedAt: NOW,
    }).envelope;
    mocks.storage.set(OUTBOX_STORAGE_KEY, encodeOutboxEnvelope(envelope));
    mocks.rpcHandler = async () => {
      throw new RequestPolicyError({
        endpoint: 'outbox_sync',
        kind: 'server',
        attemptCount: 2,
        statusClass: '5xx',
        retryAfterMs: 5 * 60_000,
      });
    };

    await expect(flushOutbox()).resolves.toEqual(flushResult(2, 0, 0));
    expect(mocks.rpc.mock.calls.map((call) => call[0])).toEqual(['apply_shelf_outbox_batch']);
    expect(storedEnvelope().rows.find((row) => row.entityType === 'conflict_choice')).toMatchObject(
      {
        state: 'ready',
        lastErrorClass: null,
        attemptCount: 0,
      },
    );
    for (let trigger = 0; trigger < 10; trigger += 1) {
      await expect(flushOutbox()).resolves.toEqual(flushResult(0, 0, 0));
    }
    expect(storedEnvelope().rows.find((row) => row.entityType === 'conflict_choice')).toMatchObject(
      {
        state: 'ready',
        attemptCount: 0,
      },
    );

    vi.setSystemTime(new Date(Date.parse(NOW) + 5 * 60_000));
    mocks.rpc.mockClear();
    mocks.rpcHandler = async (operations) => successfulResults(operations);
    await expect(flushOutbox()).resolves.toEqual(flushResult(3, 3, 0, 0, 0, 0, 0, 1));
    expect(mocks.rpc.mock.calls.map((call) => call[0])).toEqual([
      'apply_shelf_outbox_batch',
      'apply_conflict_choice_outbox_batch',
    ]);
  });

  it('still dispatches an unrelated conflict when a different Shelf request fails', async () => {
    let envelope = seedRows(1);
    envelope = enqueueConflictChoiceOutboxOperation(envelope, {
      operationId: uuid(41_004),
      ownerHash: OWNER_HASH,
      ownerGeneration: 7,
      entityId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      payload: {
        rule_id: uuid(1),
        product_a_id: uuid(101),
        product_b_id: uuid(102),
        computed_severity: 'moderate',
        user_choice: 'use_together',
        rule_version: 1,
      },
      identityHash: 'd'.repeat(64),
      payloadHash: 'a'.repeat(64),
      enqueuedAt: NOW,
    }).envelope;
    mocks.storage.set(OUTBOX_STORAGE_KEY, encodeOutboxEnvelope(envelope));
    mocks.rpcHandler = async (operations) => {
      if (operations[0]?.entity_type === 'shelf_product') {
        throw new RequestPolicyError({
          endpoint: 'outbox_sync',
          kind: 'server',
          attemptCount: 2,
          statusClass: '5xx',
        });
      }
      return successfulResults(operations);
    };

    await expect(flushOutbox()).resolves.toEqual(flushResult(2, 1, 0, 0, 0, 0, 0, 1));
    expect(mocks.rpc.mock.calls.map((call) => call[0])).toEqual([
      'apply_shelf_outbox_batch',
      'apply_conflict_choice_outbox_batch',
    ]);
    expect(storedEnvelope().rows).toEqual([
      expect.objectContaining({ entityType: 'shelf_product', state: 'ready', attemptCount: 1 }),
    ]);
  });

  it('surfaces and retries a dead conflict projection through Shelf sync status', async () => {
    const queued = enqueueConflictChoiceOutboxOperation(emptyOutboxEnvelope(), {
      operationId: uuid(41_003),
      ownerHash: OWNER_HASH,
      ownerGeneration: 7,
      entityId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      payload: {
        rule_id: uuid(1),
        product_a_id: uuid(1),
        product_b_id: uuid(2),
        computed_severity: 'moderate',
        user_choice: 'use_together',
        rule_version: 1,
      },
      identityHash: 'd'.repeat(64),
      payloadHash: 'e'.repeat(64),
      enqueuedAt: NOW,
    }).envelope;
    const dead: OutboxEnvelope = {
      ...queued,
      rows: queued.rows.map((row) => ({
        ...row,
        state: 'dead' as const,
        attemptCount: 1,
        lastErrorClass: 'dependency' as const,
      })),
    };
    mocks.storage.set(OUTBOX_STORAGE_KEY, encodeOutboxEnvelope(dead));

    await expect(
      readShelfOutboxStatus({ generation: 7 }, 'raw-owner@example.com'),
    ).resolves.toEqual({
      status: 'available',
      value: { kind: 'needs_attention', pendingCount: 1, attentionCount: 1 },
    });
    await expect(retryShelfOutbox({ generation: 7 }, 'raw-owner@example.com')).resolves.toEqual(
      flushResult(1, 1, 0, 0, 0, 0, 0, 1),
    );
    expect(mocks.rpc.mock.calls.map((call) => call[0])).toEqual([
      'apply_conflict_choice_outbox_batch',
    ]);
  });

  it('retries only the current owner recommendation dead row through the runtime API', async () => {
    const envelope = enqueueRecommendationPreferencesOutboxOperation(emptyOutboxEnvelope(), {
      operationId: uuid(40_006),
      ownerHash: OWNER_HASH,
      ownerGeneration: 7,
      payload: {
        values_filters: ['vegan'],
        budget_band: 'mid',
        format_prefs: ['cream'],
      },
      enqueuedAt: NOW,
    }).envelope;
    mocks.storage.set(OUTBOX_STORAGE_KEY, encodeOutboxEnvelope(envelope));
    mocks.rpcHandler = async (operations) =>
      operations.map((operation) => ({
        operation_id: operation.operation_id,
        status: 'permanent',
        error_class: 'validation',
      }));

    await expect(flushOutbox()).resolves.toEqual(flushResult(1, 0, 1));
    await expect(
      readRecommendationPreferencesOutboxStatus({ generation: 7 }, 'raw-owner@example.com'),
    ).resolves.toMatchObject({ value: { kind: 'needs_attention', attentionCount: 1 } });

    mocks.rpcHandler = async (operations) => successfulResults(operations);
    await expect(
      retryRecommendationPreferencesOutbox({ generation: 7 }, 'raw-owner@example.com'),
    ).resolves.toEqual(flushResult(1, 1, 0, 0, 1));
    expect(storedEnvelope().rows).toEqual([]);
  });
});
