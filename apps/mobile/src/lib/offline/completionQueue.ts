import {
  acknowledgeCompletionSyncOperation,
  deferCompletionSyncDependencyOperation,
  getPendingCompletionSyncOperations,
  recoverCompletionSyncUnsynced,
  rejectCompletionSyncOperation,
} from '@/features/today/completionsStore';
import { hasUnresolvedTerminalShelfMirrorOperationForProduct } from '@/features/shelf/store';
import {
  remoteTerminalCompletionSyncCode,
  retryableCompletionSyncCode,
  currentCompletionSyncTimezone,
  type CompletionSyncOperation,
  type CompletionSyncRemoteTerminalCode,
} from '@/features/today/completionSync';
import {
  captureHealthDataWriteLease,
  runHealthDataOperation,
  type HealthDataWriteLease,
} from '@/lib/consent/healthDataWriteAdmission';
import { getPersistedSupabaseUser, supabase } from '@/lib/supabase/client';

export const COMPLETION_SYNC_RESPONSE_INVALID = 'COMPLETION_SYNC_RESPONSE_INVALID';

type CompletionRpcArguments = Readonly<{
  p_event_id: string;
  p_routine_id: string;
  p_routine_type: CompletionSyncOperation['routineType'];
  p_step_id: string | null;
  p_user_product_id: string | null;
  p_step_order: number | null;
  p_completed_at: string;
  p_completed_date: string;
  p_timezone: string;
}>;

type CompletionRpcResponse =
  | Readonly<{
      version: 1;
      event_id: string;
      status: 'accepted' | 'idempotent';
      code: null;
    }>
  | Readonly<{
      version: 1;
      event_id: string;
      status: 'retryable';
      code: 'COMPLETION_PRODUCT_RETRY_LATER';
    }>
  | Readonly<{
      version: 1;
      event_id: string;
      status: 'terminal';
      code: CompletionSyncRemoteTerminalCode;
    }>;

type CompletionRpcError = Readonly<{
  code?: string;
  message?: string;
}> | null;

type CompletionRpc = (
  functionName: 'record_routine_completion',
  args: CompletionRpcArguments,
) => Promise<{ data: unknown; error: CompletionRpcError }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function decodeCompletionRpcResponse(
  value: unknown,
  expectedEventId: string,
): CompletionRpcResponse {
  if (!isRecord(value)) throw new Error(COMPLETION_SYNC_RESPONSE_INVALID);
  const keys = Object.keys(value).sort();
  if (
    keys.length !== 4 ||
    keys[0] !== 'code' ||
    keys[1] !== 'event_id' ||
    keys[2] !== 'status' ||
    keys[3] !== 'version' ||
    value.version !== 1 ||
    value.event_id !== expectedEventId ||
    (value.status !== 'accepted' &&
      value.status !== 'idempotent' &&
      value.status !== 'retryable' &&
      value.status !== 'terminal')
  ) {
    throw new Error(COMPLETION_SYNC_RESPONSE_INVALID);
  }
  const status = value.status;
  if (status === 'accepted' || status === 'idempotent') {
    if (value.code !== null) throw new Error(COMPLETION_SYNC_RESPONSE_INVALID);
    return { version: 1, event_id: expectedEventId, status, code: null };
  }
  if (status === 'retryable') {
    const code = retryableCompletionSyncCode(value.code);
    if (code === null) throw new Error(COMPLETION_SYNC_RESPONSE_INVALID);
    return { version: 1, event_id: expectedEventId, status, code };
  }
  const code = remoteTerminalCompletionSyncCode(value.code);
  if (code === null) throw new Error(COMPLETION_SYNC_RESPONSE_INVALID);
  return { version: 1, event_id: expectedEventId, status, code };
}

function rpcArguments(operation: CompletionSyncOperation): CompletionRpcArguments {
  return {
    p_event_id: operation.eventId,
    p_routine_id: operation.routineId,
    p_routine_type: operation.routineType,
    p_step_id: operation.stepId,
    p_user_product_id: operation.userProductId,
    p_step_order: operation.stepOrder,
    p_completed_at: operation.completedAt,
    p_completed_date: operation.completedDate,
    p_timezone: operation.timezone,
  };
}

type CompletionFlushResult = {
  flushed: number;
  terminal: number;
  remaining: number;
};

let completionFlushTail: Promise<void> = Promise.resolve();
type CompletionFlushEntry = {
  dirty: boolean;
  promise: Promise<CompletionFlushResult>;
};
const completionFlushesByLease = new Map<string, CompletionFlushEntry>();

function completionFlushLeaseKey(lease: HealthDataWriteLease): string {
  return [lease.ownerUserId, lease.generation, lease.epoch, lease.accountGeneration].join('|');
}

async function runCompletionFlush(
  initialLease: HealthDataWriteLease,
): Promise<CompletionFlushResult> {
  return runHealthDataOperation(initialLease.ownerUserId, async (lease) => {
    if (
      lease.generation !== initialLease.generation ||
      lease.epoch !== initialLease.epoch ||
      lease.accountGeneration !== initialLease.accountGeneration
    ) {
      throw new Error('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    }
    lease.assertCurrent();
    // Historical v1 transport bytes cannot be safely promoted because they do
    // not carry the v3 event/provenance contract. They remain encrypted,
    // purpose-limited `legacy_pending_completion_sync` export evidence until an
    // explicit retention purge (health withdrawal/account deletion). A replay
    // wake must never destroy them, including before a server session exists.
    await recoverCompletionSyncUnsynced(currentCompletionSyncTimezone());
    lease.assertCurrent();
    const pending = await getPendingCompletionSyncOperations();
    lease.assertCurrent();
    if (pending.length === 0) return { flushed: 0, terminal: 0, remaining: 0 };

    const { data } = await getPersistedSupabaseUser();
    lease.assertCurrent();
    if (data.user?.id === undefined) {
      return { flushed: 0, terminal: 0, remaining: pending.length };
    }
    if (data.user.id !== lease.ownerUserId) {
      throw new Error('HEALTH_DATA_WRITE_OWNER_MISMATCH');
    }

    let flushed = 0;
    let terminal = 0;
    let replaySnapshot = pending;
    let snapshotIndex = 0;
    let replayBudget = pending.length;
    while (snapshotIndex < replaySnapshot.length && replayBudget > 0) {
      const operation = replaySnapshot[snapshotIndex]!;
      lease.assertCurrent();
      let result: Awaited<ReturnType<CompletionRpc>>;
      try {
        result = await supabase.rpc('record_routine_completion', rpcArguments(operation));
      } catch {
        lease.assertCurrent();
        break;
      }
      lease.assertCurrent();
      if (result.error !== null) break;

      const response = decodeCompletionRpcResponse(result.data, operation.eventId);
      if (response.status === 'retryable') {
        if (
          operation.kind === 'step' &&
          operation.userProductId !== null &&
          (await hasUnresolvedTerminalShelfMirrorOperationForProduct(operation.userProductId))
        ) {
          lease.assertCurrent();
          const disposition = await deferCompletionSyncDependencyOperation(
            operation.eventId,
            operation.userProductId,
          );
          lease.assertCurrent();
          if (!disposition.deferred) break;
          replayBudget -= disposition.moved;
          replaySnapshot = await getPendingCompletionSyncOperations();
          lease.assertCurrent();
          snapshotIndex = 0;
          continue;
        }
        break;
      }
      if (response.status === 'terminal') {
        if (await rejectCompletionSyncOperation(operation.eventId, response.code)) {
          terminal += 1;
        }
        // A terminal final-step rejection may atomically quarantine its bound
        // routine-day marker. Stop this stale snapshot and re-read durable state
        // before any later RPC dispatch.
        break;
      }
      if (!(await acknowledgeCompletionSyncOperation(operation.eventId))) break;
      flushed += 1;
      replayBudget -= 1;
      snapshotIndex += 1;
      lease.assertCurrent();
    }

    const remaining = (await getPendingCompletionSyncOperations()).length;
    lease.assertCurrent();
    return { flushed, terminal, remaining };
  });
}

/**
 * Single-flight FIFO replay of the encrypted v3 completion outbox. The RPC
 * derives the owner from Auth, validates exact routine/Shelf ownership and
 * returns a versioned disposition. Network, authorization, and protocol
 * ambiguity retain the operation; only exact accepted/idempotent responses
 * acknowledge it, and only an explicit terminal response quarantines it.
 */
export function flushCompletions(): Promise<{
  flushed: number;
  terminal: number;
  remaining: number;
}> {
  let lease: HealthDataWriteLease;
  try {
    lease = captureHealthDataWriteLease();
  } catch (error) {
    return Promise.reject(error);
  }
  const leaseKey = completionFlushLeaseKey(lease);
  const existing = completionFlushesByLease.get(leaseKey);
  if (existing !== undefined) {
    // A wake means the durable outbox may have changed after the active worker
    // took its snapshot. Coalesce callers onto one promise but retain one dirty
    // rerun so work appended during the RPC cannot be stranded.
    existing.dirty = true;
    return existing.promise;
  }

  const entry = {
    dirty: false,
    promise: Promise.resolve({
      flushed: 0,
      terminal: 0,
      remaining: 0,
    }),
  } satisfies CompletionFlushEntry;
  const pending = completionFlushTail.then(async () => {
    let flushed = 0;
    let terminal = 0;
    let remaining = 0;
    do {
      entry.dirty = false;
      const result = await runCompletionFlush(lease);
      flushed += result.flushed;
      terminal += result.terminal;
      remaining = result.remaining;
    } while (entry.dirty);
    return { flushed, terminal, remaining };
  });
  entry.promise = pending;
  completionFlushTail = pending.then(
    () => undefined,
    () => undefined,
  );
  completionFlushesByLease.set(leaseKey, entry);
  const release = () => {
    if (completionFlushesByLease.get(leaseKey) === entry) {
      completionFlushesByLease.delete(leaseKey);
    }
  };
  void pending.then(release, release);
  return pending;
}
