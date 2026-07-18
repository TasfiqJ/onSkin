import * as Crypto from 'expo-crypto';

import type { Json } from '@onskin/types/database';
import {
  AccountGenerationLeaseError,
  runAccountGenerationOperation,
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
}>;

export type ShelfOutboxStatusRead =
  | { status: 'available'; value: OutboxOwnerStatus }
  | { status: 'corrupt' | 'unavailable' | 'unsupported_version'; value: null };

type ServerWireResult = Readonly<{
  operation_id: string;
  status: OutboxServerResult['status'];
  error_class: 'validation' | null;
}>;

let activeFlush: Promise<OutboxFlushResult> | null = null;
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

export function readShelfOutboxStatus(scope: OwnerQueryScope): Promise<ShelfOutboxStatusRead> {
  return runOwnerQueryOperation(scope, async (lease) => {
    const owner = await captureAuthenticatedAccountOwner(lease);
    if (!owner) {
      return {
        status: 'available',
        value: Object.freeze({ kind: 'idle', pendingCount: 0, attentionCount: 0 }),
      };
    }
    const ownerHash = await hashOutboxOwner(owner.userId);
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
        ownerGeneration: lease.generation,
      }),
    };
  });
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

async function flushOutboxOnce(): Promise<OutboxFlushResult> {
  if (!isSupabaseConfigured) return Object.freeze({ leased: 0, flushed: 0, dead: 0 });

  return runAccountGenerationOperation(async (lease) => {
    const owner = await captureAuthenticatedAccountOwner(lease);
    if (!owner) return Object.freeze({ leased: 0, flushed: 0, dead: 0 });
    const ownerHash = await hashOutboxOwner(owner.userId);
    lease.assertCurrent();

    let totalLeased = 0;
    let totalFlushed = 0;
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

      try {
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
              .rpc('apply_shelf_outbox_batch', {
                p_operations: leasedRows.map(wireOperation),
              })
              .abortSignal(signal);
            if (response.error) {
              throw supabaseRequestFailure(response.error, response.status);
            }
            return response.data;
          },
        );
        lease.assertCurrent();
        const results = decodeServerResults(data, leasedRows);
        await settleLease(leaseOwner, results);
        lease.assertCurrent();
        totalFlushed += results.filter((result) => result.status !== 'permanent').length;
      } catch (error) {
        lease.assertCurrent();
        const requestError =
          error instanceof RequestPolicyError
            ? error
            : new RequestPolicyError({
                endpoint: 'outbox_sync',
                kind: 'validation',
                attemptCount: 1,
                statusClass: 'unknown',
              });
        await settleLease(leaseOwner, [], {
          errorClass: failureClass(requestError),
          retryAfterMs: requestError.retryAfterMs,
        });
        lease.assertCurrent();
        break;
      }
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
    });
  });
}

/** Single-flight drain used by mount, foreground, reconnect, and post-mutation triggers. */
export function flushOutbox(): Promise<OutboxFlushResult> {
  if (activeFlush) return activeFlush;
  const current = flushOutboxOnce()
    .then((result) => {
      syncDiagnostics = Object.freeze({
        result: result.leased > result.flushed ? 'pending' : result.flushed > 0 ? 'synced' : 'idle',
        at: new Date().toISOString(),
      });
      publishOutboxChange();
      return result;
    })
    .catch((error: unknown) => {
      syncDiagnostics = Object.freeze({
        result: error instanceof AccountGenerationLeaseError ? 'cancelled' : 'failed',
        at: new Date().toISOString(),
      });
      publishOutboxChange();
      throw error;
    })
    .finally(() => {
      if (activeFlush === current) activeFlush = null;
    });
  activeFlush = current;
  return current;
}

export function scheduleOutboxFlush(): void {
  publishOutboxChange();
  void flushOutbox().catch(() => undefined);
}

export function retryShelfOutbox(scope: OwnerQueryScope): Promise<OutboxFlushResult> {
  return runOwnerQueryOperation(scope, async (lease) => {
    const owner = await captureAuthenticatedAccountOwner(lease);
    if (!owner) return Object.freeze({ leased: 0, flushed: 0, dead: 0 });
    const ownerHash = await hashOutboxOwner(owner.userId);
    lease.assertCurrent();
    let retried = 0;
    await updatePrivateItem(OUTBOX_STORAGE_KEY, (current) => {
      const retry = retryDeadOutboxRows(decodeOutboxEnvelope(current), {
        ownerHash,
        ownerGeneration: lease.generation,
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

export function readOutboxSyncDiagnostics(): typeof syncDiagnostics {
  return { ...syncDiagnostics };
}

export function resetOutboxWorkerForTests(): void {
  activeFlush = null;
  outboxChangeRevision = 0;
  outboxChangeListeners.clear();
  syncDiagnostics = Object.freeze({ result: 'not_run', at: null });
}

export { hashOutboxOwner } from './outboxIdentity';
