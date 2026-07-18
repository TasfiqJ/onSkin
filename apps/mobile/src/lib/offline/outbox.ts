import * as Crypto from 'expo-crypto';

import type { Json } from '@onskin/types/database';
import {
  AccountGenerationLeaseError,
  runAccountGenerationOperation,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { captureAuthenticatedAccountOwner } from '@/lib/auth/authenticatedAccountOwner';
import { isSupabaseConfigured } from '@/lib/env';
import {
  RequestPolicyError,
  runRequestWithLease,
  supabaseRequestFailure,
} from '@/lib/network/requestPolicy';
import { supabase } from '@/lib/supabase/client';
import { runOwnerQueryOperation, type OwnerQueryScope } from '@/lib/query/queryKeys';
import { readPrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';

import { hashOutboxOwner } from './outboxIdentity';
import {
  OUTBOX_INVALID,
  OUTBOX_STORAGE_KEY,
  OUTBOX_UNSUPPORTED_VERSION,
  decodeOutboxEnvelope,
  encodeOutboxEnvelope,
  leaseReadyOutboxRows,
  outboxCounts,
  retryDeadOutboxRows,
  selectOutboxOwnerStatus,
  settleOutboxLease,
  type OutboxEnvelope,
  type OutboxEntityType,
  type OutboxFailureClass,
  type OutboxOwnerStatus,
  type OutboxRow,
  type OutboxServerResult,
} from './outbox.pure';

const MAX_BATCHES_PER_FLUSH = 4;

export type OutboxRead =
  | { status: 'absent'; envelope: OutboxEnvelope }
  | { status: 'available'; envelope: OutboxEnvelope }
  | { status: 'corrupt' | 'unavailable' | 'unsupported_version'; envelope: null };

export type OutboxFlushResult = Readonly<{
  leased: number;
  flushed: number;
  dead: number;
  flushedByEntity: Readonly<{
    notificationDeliveries: number;
    notificationPreferences: number;
    recommendationPreferences: number;
    shelfProducts: number;
  }>;
}>;

export type OwnerOutboxStatusRead =
  | { status: 'available'; value: OutboxOwnerStatus }
  | { status: 'corrupt' | 'unavailable' | 'unsupported_version'; value: null };

export type ShelfOutboxStatusRead = OwnerOutboxStatusRead;
export type NotificationPreferencesOutboxStatusRead = OwnerOutboxStatusRead;
export type RecommendationPreferencesOutboxStatusRead = OwnerOutboxStatusRead;

type ServerWireResult = Readonly<{
  operation_id: string;
  status: OutboxServerResult['status'];
  error_class: 'validation' | null;
}>;

let activeFlush: Promise<OutboxFlushResult> | null = null;
let flushRerunRequested = false;
let outboxChangeRevision = 0;
const outboxChangeListeners = new Set<() => void>();
let syncDiagnostics: Readonly<{
  result: 'cancelled' | 'failed' | 'idle' | 'not_run' | 'pending' | 'synced';
  at: string | null;
}> = Object.freeze({ result: 'not_run', at: null });

function publishOutboxChange(): void {
  outboxChangeRevision += 1;
  for (const listener of outboxChangeListeners) listener();
}

export function subscribeOutboxChanges(listener: () => void): () => void {
  outboxChangeListeners.add(listener);
  return () => outboxChangeListeners.delete(listener);
}

export function readOutboxChangeRevision(): number {
  return outboxChangeRevision;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return (
    actual.length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

export async function readOutbox(): Promise<OutboxRead> {
  const stored = await readPrivateItem(OUTBOX_STORAGE_KEY);
  if (stored.status === 'absent') {
    return { status: 'absent', envelope: decodeOutboxEnvelope(null) };
  }
  if (stored.status === 'unavailable') return { status: 'unavailable', envelope: null };
  if (stored.status === 'corrupt') return { status: 'corrupt', envelope: null };
  if (stored.status === 'unsupported_version') {
    return { status: 'unsupported_version', envelope: null };
  }
  try {
    return { status: 'available', envelope: decodeOutboxEnvelope(stored.value) };
  } catch (error) {
    return error instanceof Error && error.message === OUTBOX_UNSUPPORTED_VERSION
      ? { status: 'unsupported_version', envelope: null }
      : { status: 'corrupt', envelope: null };
  }
}

function emptyFlushResult(): OutboxFlushResult {
  return Object.freeze({
    leased: 0,
    flushed: 0,
    dead: 0,
    flushedByEntity: Object.freeze({
      notificationDeliveries: 0,
      notificationPreferences: 0,
      recommendationPreferences: 0,
      shelfProducts: 0,
    }),
  });
}

function mergeFlushResults(current: OutboxFlushResult, next: OutboxFlushResult): OutboxFlushResult {
  return Object.freeze({
    leased: current.leased + next.leased,
    flushed: current.flushed + next.flushed,
    dead: next.dead,
    flushedByEntity: Object.freeze({
      notificationDeliveries:
        current.flushedByEntity.notificationDeliveries +
        next.flushedByEntity.notificationDeliveries,
      notificationPreferences:
        current.flushedByEntity.notificationPreferences +
        next.flushedByEntity.notificationPreferences,
      recommendationPreferences:
        current.flushedByEntity.recommendationPreferences +
        next.flushedByEntity.recommendationPreferences,
      shelfProducts: current.flushedByEntity.shelfProducts + next.flushedByEntity.shelfProducts,
    }),
  });
}

function readOwnerOutboxStatus(
  scope: OwnerQueryScope,
  ownerId: string | null | undefined,
  entityType: OutboxEntityType,
): Promise<OwnerOutboxStatusRead> {
  return runOwnerQueryOperation(scope, async (lease) => {
    const normalizedOwnerId = ownerId?.trim();
    if (!normalizedOwnerId) {
      return {
        status: 'available',
        value: Object.freeze({ kind: 'idle', pendingCount: 0, attentionCount: 0 }),
      };
    }
    const ownerHash = await hashOutboxOwner(normalizedOwnerId);
    lease.assertCurrent();
    const state = await readOutbox();
    lease.assertCurrent();
    if (state.envelope === null) {
      return { status: state.status, value: null };
    }
    return {
      status: 'available',
      value: selectOutboxOwnerStatus(state.envelope, {
        ownerHash,
        entityType,
      }),
    };
  });
}

export function readShelfOutboxStatus(
  scope: OwnerQueryScope,
  ownerId?: string | null,
): Promise<ShelfOutboxStatusRead> {
  return readOwnerOutboxStatus(scope, ownerId, 'shelf_product');
}

export function readNotificationPreferencesOutboxStatus(
  scope: OwnerQueryScope,
  ownerId?: string | null,
): Promise<NotificationPreferencesOutboxStatusRead> {
  return readOwnerOutboxStatus(scope, ownerId, 'notification_preferences');
}

export function readRecommendationPreferencesOutboxStatus(
  scope: OwnerQueryScope,
  ownerId?: string | null,
): Promise<RecommendationPreferencesOutboxStatusRead> {
  return readOwnerOutboxStatus(scope, ownerId, 'recommendation_preferences');
}

function wireOperation(row: OutboxRow): Json {
  return {
    operation_id: row.operationId,
    entity_type: row.entityType,
    entity_id: row.entityId,
    operation_kind: row.operationKind,
    payload: row.payload as Json,
    client_revision: row.clientRevision,
    idempotency_key: row.idempotencyKey,
  };
}

function decodeServerResults(
  value: Json,
  leasedRows: readonly OutboxRow[],
): readonly OutboxServerResult[] {
  if (!Array.isArray(value) || value.length !== leasedRows.length) {
    throw new Error(OUTBOX_INVALID);
  }
  const expected = new Set(leasedRows.map((row) => row.operationId));
  const results = value.map((candidate): OutboxServerResult => {
    if (
      !isRecord(candidate) ||
      !hasExactKeys(candidate, ['operation_id', 'status', 'error_class']) ||
      typeof candidate.operation_id !== 'string' ||
      !expected.delete(candidate.operation_id) ||
      !['applied', 'duplicate', 'permanent', 'stale'].includes(String(candidate.status)) ||
      (candidate.error_class !== null && candidate.error_class !== 'validation') ||
      (candidate.status === 'permanent' && candidate.error_class !== 'validation') ||
      (candidate.status !== 'permanent' && candidate.error_class !== null)
    ) {
      throw new Error(OUTBOX_INVALID);
    }
    const wire = candidate as ServerWireResult;
    return Object.freeze({
      operationId: wire.operation_id,
      status: wire.status,
      ...(wire.error_class ? { errorClass: wire.error_class } : {}),
    });
  });
  if (expected.size !== 0) throw new Error(OUTBOX_INVALID);
  return Object.freeze(results);
}

function failureClass(error: RequestPolicyError): OutboxFailureClass {
  switch (error.kind) {
    case 'authentication':
      return 'authentication';
    case 'offline':
      return 'offline';
    case 'rate_limit':
      return 'rate_limit';
    case 'server':
      return 'server';
    case 'timeout':
      return 'timeout';
    case 'response_too_large':
    case 'validation':
      return 'validation';
    default:
      return 'unknown';
  }
}

async function settleLease(
  leaseOwner: string,
  results: readonly OutboxServerResult[],
  failure?: Readonly<{ errorClass: OutboxFailureClass; retryAfterMs: number | null }>,
): Promise<void> {
  const now = new Date().toISOString();
  await updatePrivateItem(OUTBOX_STORAGE_KEY, (current) =>
    encodeOutboxEnvelope(
      settleOutboxLease(decodeOutboxEnvelope(current), {
        leaseOwner,
        now,
        results,
        ...(failure
          ? {
              failureClass: failure.errorClass,
              retryAfterMs: failure.retryAfterMs,
              random: Math.random(),
            }
          : {}),
      }),
    ),
  );
  publishOutboxChange();
}

async function sendOutboxEntityBatch(
  lease: AccountGenerationLease,
  entityType: OutboxEntityType,
  rows: readonly OutboxRow[],
): Promise<readonly OutboxServerResult[]> {
  const rpc =
    entityType === 'shelf_product'
      ? 'apply_shelf_outbox_batch'
      : entityType === 'notification_delivery'
        ? 'apply_notification_delivery_outbox_batch'
        : entityType === 'notification_preferences'
          ? 'apply_notification_preferences_outbox_batch'
          : 'apply_recommendation_preferences_outbox_batch';
  const data = await runRequestWithLease(
    lease,
    {
      endpoint: 'outbox_sync',
      deadlineMs: 12_000,
      idempotent: true,
      maxAttempts: 2,
      maxResponseBytes: 64 * 1024,
      maxRetryAfterMs: 5 * 60_000,
    },
    async ({ signal }) => {
      const response = await supabase
        .rpc(rpc, { p_operations: rows.map(wireOperation) })
        .abortSignal(signal);
      if (response.error) throw supabaseRequestFailure(response.error, response.status);
      return response.data as Json;
    },
  );
  lease.assertCurrent();
  return decodeServerResults(data, rows);
}

async function flushOutboxOnce(): Promise<OutboxFlushResult> {
  if (!isSupabaseConfigured) return emptyFlushResult();

  return runAccountGenerationOperation(async (lease) => {
    const owner = await captureAuthenticatedAccountOwner(lease);
    if (!owner) return emptyFlushResult();
    const ownerHash = await hashOutboxOwner(owner.userId);
    lease.assertCurrent();

    let totalLeased = 0;
    let totalFlushed = 0;
    let notificationDeliveriesFlushed = 0;
    let notificationPreferencesFlushed = 0;
    let recommendationPreferencesFlushed = 0;
    let shelfProductsFlushed = 0;
    for (let batch = 0; batch < MAX_BATCHES_PER_FLUSH; batch += 1) {
      lease.assertCurrent();
      const leaseOwner = Crypto.randomUUID();
      let leasedRows: readonly OutboxRow[] = [];
      await updatePrivateItem(OUTBOX_STORAGE_KEY, (current) => {
        const leased = leaseReadyOutboxRows(decodeOutboxEnvelope(current), {
          ownerHash,
          leaseOwner,
          now: new Date().toISOString(),
        });
        leasedRows = leased.rows;
        return encodeOutboxEnvelope(leased.envelope);
      });
      lease.assertCurrent();
      if (leasedRows.length > 0) publishOutboxChange();
      if (leasedRows.length === 0) break;
      totalLeased += leasedRows.length;

      const results: OutboxServerResult[] = [];
      let requestFailure: RequestPolicyError | null = null;
      for (const entityType of [
        'shelf_product',
        'notification_delivery',
        'notification_preferences',
        'recommendation_preferences',
      ] as const) {
        const rows = leasedRows.filter((row) => row.entityType === entityType);
        if (rows.length === 0) continue;
        try {
          results.push(...(await sendOutboxEntityBatch(lease, entityType, rows)));
        } catch (error) {
          lease.assertCurrent();
          requestFailure =
            error instanceof RequestPolicyError
              ? error
              : new RequestPolicyError({
                  endpoint: 'outbox_sync',
                  kind: 'validation',
                  attemptCount: 1,
                  statusClass: 'unknown',
                });
          break;
        }
      }
      await settleLease(
        leaseOwner,
        results,
        requestFailure
          ? {
              errorClass: failureClass(requestFailure),
              retryAfterMs: requestFailure.retryAfterMs,
            }
          : undefined,
      );
      lease.assertCurrent();
      const successfulIds = new Set(
        results
          .filter((result) => result.status !== 'permanent')
          .map((result) => result.operationId),
      );
      const successfulRows = leasedRows.filter((row) => successfulIds.has(row.operationId));
      totalFlushed += successfulRows.length;
      shelfProductsFlushed += successfulRows.filter(
        (row) => row.entityType === 'shelf_product',
      ).length;
      notificationDeliveriesFlushed += successfulRows.filter(
        (row) => row.entityType === 'notification_delivery',
      ).length;
      notificationPreferencesFlushed += successfulRows.filter(
        (row) => row.entityType === 'notification_preferences',
      ).length;
      recommendationPreferencesFlushed += successfulRows.filter(
        (row) => row.entityType === 'recommendation_preferences',
      ).length;
      if (requestFailure) break;
    }

    const state = await readOutbox();
    lease.assertCurrent();
    return Object.freeze({
      leased: totalLeased,
      flushed: totalFlushed,
      dead:
        state.status === 'available' || state.status === 'absent'
          ? outboxCounts(state.envelope).dead
          : 0,
      flushedByEntity: Object.freeze({
        notificationDeliveries: notificationDeliveriesFlushed,
        notificationPreferences: notificationPreferencesFlushed,
        recommendationPreferences: recommendationPreferencesFlushed,
        shelfProducts: shelfProductsFlushed,
      }),
    });
  });
}

/** Single-flight drain used by mount, foreground, reconnect, and post-mutation triggers. */
export function flushOutbox(): Promise<OutboxFlushResult> {
  if (activeFlush) {
    flushRerunRequested = true;
    return activeFlush;
  }
  let resolveCurrent!: (result: OutboxFlushResult) => void;
  let rejectCurrent!: (error: unknown) => void;
  const current = new Promise<OutboxFlushResult>((resolve, reject) => {
    resolveCurrent = resolve;
    rejectCurrent = reject;
  });
  activeFlush = current;
  void (async () => {
    let result = emptyFlushResult();
    try {
      do {
        flushRerunRequested = false;
        result = mergeFlushResults(result, await flushOutboxOnce());
        syncDiagnostics = Object.freeze({
          result:
            result.leased > result.flushed ? 'pending' : result.flushed > 0 ? 'synced' : 'idle',
          at: new Date().toISOString(),
        });
        publishOutboxChange();
      } while (flushRerunRequested);
      // No async boundary exists between the final request check and releasing
      // ownership, so a later request either joins this loop or starts a new one.
      activeFlush = null;
      resolveCurrent(result);
    } catch (error: unknown) {
      syncDiagnostics = Object.freeze({
        result: error instanceof AccountGenerationLeaseError ? 'cancelled' : 'failed',
        at: new Date().toISOString(),
      });
      publishOutboxChange();
      const rerunRequested = flushRerunRequested;
      activeFlush = null;
      rejectCurrent(error);
      if (rerunRequested) void flushOutbox().catch(() => undefined);
    }
  })();
  return current;
}

export function scheduleOutboxFlush(): void {
  publishOutboxChange();
  if (activeFlush) {
    flushRerunRequested = true;
    return;
  }
  void flushOutbox().catch(() => undefined);
}

function retryOwnerOutbox(
  scope: OwnerQueryScope,
  ownerId: string | null | undefined,
  entityType: OutboxEntityType,
): Promise<OutboxFlushResult> {
  return runOwnerQueryOperation(scope, async (lease) => {
    const normalizedOwnerId = ownerId?.trim();
    if (!normalizedOwnerId) return emptyFlushResult();
    const ownerHash = await hashOutboxOwner(normalizedOwnerId);
    lease.assertCurrent();
    let retried = 0;
    await updatePrivateItem(OUTBOX_STORAGE_KEY, (current) => {
      const retry = retryDeadOutboxRows(decodeOutboxEnvelope(current), {
        ownerHash,
        entityType,
        now: new Date().toISOString(),
      });
      retried = retry.retried;
      return retry.retried > 0 ? encodeOutboxEnvelope(retry.envelope) : current;
    });
    lease.assertCurrent();
    if (retried > 0) publishOutboxChange();
    return flushOutbox();
  });
}

export function retryShelfOutbox(
  scope: OwnerQueryScope,
  ownerId?: string | null,
): Promise<OutboxFlushResult> {
  return retryOwnerOutbox(scope, ownerId, 'shelf_product');
}

export function retryNotificationPreferencesOutbox(
  scope: OwnerQueryScope,
  ownerId?: string | null,
): Promise<OutboxFlushResult> {
  return retryOwnerOutbox(scope, ownerId, 'notification_preferences');
}

export function retryRecommendationPreferencesOutbox(
  scope: OwnerQueryScope,
  ownerId?: string | null,
): Promise<OutboxFlushResult> {
  return retryOwnerOutbox(scope, ownerId, 'recommendation_preferences');
}

export function readOutboxSyncDiagnostics(): typeof syncDiagnostics {
  return { ...syncDiagnostics };
}

export function resetOutboxWorkerForTests(): void {
  activeFlush = null;
  flushRerunRequested = false;
  outboxChangeRevision = 0;
  outboxChangeListeners.clear();
  syncDiagnostics = Object.freeze({ result: 'not_run', at: null });
}

export { hashOutboxOwner } from './outboxIdentity';
