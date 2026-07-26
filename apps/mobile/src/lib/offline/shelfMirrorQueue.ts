import {
  acknowledgeShelfMirrorOperation,
  getPendingShelfMirrorOperations,
  rejectShelfMirrorOperation,
  type ShelfMirrorOperation,
  type ShelfMirrorTerminalCode,
  type ShelfMirrorUpsertPayload,
} from '@/features/shelf/store';
import {
  captureHealthDataWriteLease,
  runHealthDataOperation,
  type HealthDataWriteLease,
} from '@/lib/consent/healthDataWriteAdmission';
import { getPersistedSupabaseUser, supabase } from '@/lib/supabase/client';

export const SHELF_MIRROR_RESPONSE_INVALID = 'SHELF_MIRROR_RESPONSE_INVALID';

type ShelfMirrorRpcArguments = Readonly<{
  p_operation_id: string;
  p_operation_kind: ShelfMirrorOperation['kind'];
  p_enqueued_at: string;
  p_product_id: string;
  p_payload: ShelfMirrorUpsertPayload | null;
}>;

type ShelfMirrorRpcResponse =
  | Readonly<{
      version: 1;
      operation_id: string;
      status: 'accepted' | 'idempotent';
      code: null;
    }>
  | Readonly<{
      version: 1;
      operation_id: string;
      status: 'retryable';
      code: 'SHELF_SYNC_RETRY_LATER';
    }>
  | Readonly<{
      version: 1;
      operation_id: string;
      status: 'terminal';
      code: ShelfMirrorTerminalCode;
    }>;

type ShelfMirrorRpcError = Readonly<{
  code?: string;
  message?: string;
}> | null;

type ShelfMirrorRpc = (
  functionName: 'sync_shelf_product',
  args: ShelfMirrorRpcArguments,
) => Promise<{ data: unknown; error: ShelfMirrorRpcError }>;

export type ShelfMirrorFlushResult = Readonly<{
  flushed: number;
  terminal: number;
  remaining: number;
  retryable: boolean;
}>;

const TERMINAL_CODES = new Set<ShelfMirrorTerminalCode>([
  'SHELF_PRODUCT_ID_INVALID',
  'SHELF_PRODUCT_PAYLOAD_INVALID',
  'SHELF_PRODUCT_PROVENANCE_INVALID',
  'SHELF_PRODUCT_OWNERSHIP_CONFLICT',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function decodeShelfMirrorRpcResponse(
  value: unknown,
  expectedOperationId: string,
): ShelfMirrorRpcResponse {
  if (!isRecord(value)) throw new Error(SHELF_MIRROR_RESPONSE_INVALID);
  const keys = Object.keys(value).sort();
  if (
    keys.length !== 4 ||
    keys[0] !== 'code' ||
    keys[1] !== 'operation_id' ||
    keys[2] !== 'status' ||
    keys[3] !== 'version' ||
    value.version !== 1 ||
    value.operation_id !== expectedOperationId ||
    (value.status !== 'accepted' &&
      value.status !== 'idempotent' &&
      value.status !== 'retryable' &&
      value.status !== 'terminal')
  ) {
    throw new Error(SHELF_MIRROR_RESPONSE_INVALID);
  }

  const status = value.status;
  if (status === 'accepted' || status === 'idempotent') {
    if (value.code !== null) throw new Error(SHELF_MIRROR_RESPONSE_INVALID);
    return {
      version: 1,
      operation_id: expectedOperationId,
      status,
      code: null,
    };
  }
  if (status === 'retryable') {
    if (value.code !== 'SHELF_SYNC_RETRY_LATER') {
      throw new Error(SHELF_MIRROR_RESPONSE_INVALID);
    }
    return {
      version: 1,
      operation_id: expectedOperationId,
      status,
      code: value.code,
    };
  }
  if (
    typeof value.code !== 'string' ||
    !TERMINAL_CODES.has(value.code as ShelfMirrorTerminalCode)
  ) {
    throw new Error(SHELF_MIRROR_RESPONSE_INVALID);
  }
  return {
    version: 1,
    operation_id: expectedOperationId,
    status,
    code: value.code as ShelfMirrorTerminalCode,
  };
}

function rpcArguments(operation: ShelfMirrorOperation): ShelfMirrorRpcArguments {
  return {
    p_operation_id: operation.operationId,
    p_operation_kind: operation.kind,
    p_enqueued_at: operation.enqueuedAt,
    p_product_id: operation.kind === 'upsert' ? operation.payload.id : operation.productId,
    p_payload: operation.kind === 'upsert' ? operation.payload : null,
  };
}

function shelfMirrorLeaseKey(lease: HealthDataWriteLease): string {
  return [lease.ownerUserId, lease.generation, lease.epoch, lease.accountGeneration].join('|');
}

async function runShelfMirrorFlush(
  initialLease: HealthDataWriteLease,
): Promise<ShelfMirrorFlushResult> {
  return runHealthDataOperation(initialLease.ownerUserId, async (lease) => {
    if (
      lease.generation !== initialLease.generation ||
      lease.epoch !== initialLease.epoch ||
      lease.accountGeneration !== initialLease.accountGeneration
    ) {
      throw new Error('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    }
    lease.assertCurrent();
    const pending = await getPendingShelfMirrorOperations();
    lease.assertCurrent();
    if (pending.length === 0) {
      return { flushed: 0, terminal: 0, remaining: 0, retryable: false };
    }

    const { data } = await getPersistedSupabaseUser();
    lease.assertCurrent();
    if (data.user?.id === undefined) {
      return {
        flushed: 0,
        terminal: 0,
        remaining: pending.length,
        retryable: true,
      };
    }
    if (data.user.id !== lease.ownerUserId) {
      throw new Error('HEALTH_DATA_WRITE_OWNER_MISMATCH');
    }

    let flushed = 0;
    let terminal = 0;
    let retryable = false;
    for (const operation of pending) {
      lease.assertCurrent();
      let result: Awaited<ReturnType<ShelfMirrorRpc>>;
      try {
        result = await supabase.rpc('sync_shelf_product', rpcArguments(operation));
      } catch {
        lease.assertCurrent();
        retryable = true;
        break;
      }
      lease.assertCurrent();
      if (result.error !== null) {
        retryable = true;
        break;
      }

      const response = decodeShelfMirrorRpcResponse(result.data, operation.operationId);
      if (response.status === 'retryable') {
        retryable = true;
        break;
      }
      if (response.status === 'terminal') {
        if (!(await rejectShelfMirrorOperation(operation.operationId, response.code))) {
          retryable = true;
          break;
        }
        terminal += 1;
        lease.assertCurrent();
        continue;
      }
      if (!(await acknowledgeShelfMirrorOperation(operation.operationId))) {
        retryable = true;
        break;
      }
      flushed += 1;
      lease.assertCurrent();
    }

    const remaining = (await getPendingShelfMirrorOperations()).length;
    lease.assertCurrent();
    return { flushed, terminal, remaining, retryable };
  });
}

type ShelfMirrorFlushEntry = {
  dirty: boolean;
  promise: Promise<ShelfMirrorFlushResult>;
};

let shelfMirrorFlushTail: Promise<void> = Promise.resolve();
const shelfMirrorFlushesByLease = new Map<string, ShelfMirrorFlushEntry>();

/**
 * Single-flight FIFO replay for the encrypted Shelf v3 outbox.
 *
 * `sync_shelf_product` derives its owner from Auth and must soft-remove a
 * deleted Shelf row (for example with a server tombstone) rather than directly
 * deleting `user_products`; routine references and adherence history survive.
 * Network, authorization, protocol, and malformed-response ambiguity retain
 * the head. Only exact accepted/idempotent dispositions acknowledge it.
 */
export function flushShelfMirrorQueue(): Promise<ShelfMirrorFlushResult> {
  let lease: HealthDataWriteLease;
  try {
    lease = captureHealthDataWriteLease();
  } catch (error) {
    return Promise.reject(error);
  }
  const leaseKey = shelfMirrorLeaseKey(lease);
  const existing = shelfMirrorFlushesByLease.get(leaseKey);
  if (existing !== undefined) {
    existing.dirty = true;
    return existing.promise;
  }

  const entry: ShelfMirrorFlushEntry = {
    dirty: false,
    promise: Promise.resolve({
      flushed: 0,
      terminal: 0,
      remaining: 0,
      retryable: false,
    }),
  };
  const pending = shelfMirrorFlushTail.then(async () => {
    let flushed = 0;
    let terminal = 0;
    let remaining = 0;
    let retryable = false;
    do {
      entry.dirty = false;
      const result = await runShelfMirrorFlush(lease);
      flushed += result.flushed;
      terminal += result.terminal;
      remaining = result.remaining;
      retryable = result.retryable;
    } while (entry.dirty);
    return { flushed, terminal, remaining, retryable };
  });
  entry.promise = pending;
  shelfMirrorFlushTail = pending.then(
    () => undefined,
    () => undefined,
  );
  shelfMirrorFlushesByLease.set(leaseKey, entry);
  const release = () => {
    if (shelfMirrorFlushesByLease.get(leaseKey) === entry) {
      shelfMirrorFlushesByLease.delete(leaseKey);
    }
  };
  void pending.then(release, release);
  return pending;
}
