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
  OUTBOX_ENTITY_CONTRACT,
  OUTBOX_ENTITY_TYPES,
  type OutboxEntityType,
  type OutboxFlushCountKey,
} from './outboxEntities';
import {
  OUTBOX_INVALID,
  OUTBOX_STORAGE_KEY,
  OUTBOX_UNSUPPORTED_VERSION,
  decodeOutboxEnvelope,
  encodeOutboxEnvelope,
  leaseReadyOutboxRows,
  nextOutboxWakeAt,
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
const OUTBOX_WAKE_CLOCK_RECHECK_MS = 30_000;
const OUTBOX_WAKE_CLOCK_DRIFT_TOLERANCE_MS = 1_000;

export type OutboxRead =
  | { status: 'absent'; envelope: OutboxEnvelope }
  | { status: 'available'; envelope: OutboxEnvelope }
  | { status: 'corrupt' | 'unavailable' | 'unsupported_version'; envelope: null };

export type OutboxFlushResult = Readonly<{
  leased: number;
  flushed: number;
  dead: number;
  flushedByEntity: Readonly<Record<OutboxFlushCountKey, number>>;
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
  error_class: 'dependency' | 'validation' | null;
}>;

let activeFlush: Promise<OutboxFlushResult> | null = null;
let flushRerunRequested = false;
let outboxSchedulerActive = false;
let outboxWakeTimer: ReturnType<typeof setTimeout> | null = null;
let outboxWakeToken = 0;
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

function clearOutboxWakeTimer(): void {
  outboxWakeToken += 1;
  if (outboxWakeTimer !== null) {
    clearTimeout(outboxWakeTimer);
    outboxWakeTimer = null;
  }
}

function armOutboxWakeTimer(wakeAt: string | null): void {
  clearOutboxWakeTimer();
  if (!outboxSchedulerActive || wakeAt === null) return;
  const deadlineMs = Date.parse(wakeAt);
  const armedAtMs = Date.now();
  const delayMs = Math.min(Math.max(0, deadlineMs - armedAtMs), OUTBOX_WAKE_CLOCK_RECHECK_MS);
  const expectedWakeMs = armedAtMs + delayMs;
  const token = outboxWakeToken;
  outboxWakeTimer = setTimeout(() => {
    if (token !== outboxWakeToken || !outboxSchedulerActive) return;
    outboxWakeTimer = null;
    const observedNowMs = Date.now();
    const wallClockShifted =
      Math.abs(observedNowMs - expectedWakeMs) > OUTBOX_WAKE_CLOCK_DRIFT_TOLERANCE_MS;
    if (observedNowMs >= deadlineMs || wallClockShifted) {
      void flushOutbox().catch(() => undefined);
      return;
    }
    armOutboxWakeTimer(wakeAt);
  }, delayMs);
}

/**
 * Enables persisted-deadline wakes while the foreground sync surface is
 * active. Immediate explicit drains remain available while this gate is off.
 */
export function setOutboxSchedulerActive(active: boolean): void {
  if (outboxSchedulerActive === active) return;
  outboxSchedulerActive = active;
  if (!active) clearOutboxWakeTimer();
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

type MutableOutboxFlushCounts = {
  -readonly [Key in OutboxFlushCountKey]: number;
};

function createOutboxFlushCounts(): MutableOutboxFlushCounts {
  const counts = {} as MutableOutboxFlushCounts;
  for (const entityType of OUTBOX_ENTITY_TYPES) {
    counts[OUTBOX_ENTITY_CONTRACT[entityType].flushCountKey] = 0;
  }
  return counts;
}

function emptyFlushResult(): OutboxFlushResult {
  return Object.freeze({
    leased: 0,
    flushed: 0,
    dead: 0,
    flushedByEntity: Object.freeze(createOutboxFlushCounts()),
  });
}

function mergeFlushResults(current: OutboxFlushResult, next: OutboxFlushResult): OutboxFlushResult {
  const flushedByEntity = createOutboxFlushCounts();
  for (const entityType of OUTBOX_ENTITY_TYPES) {
    const countKey = OUTBOX_ENTITY_CONTRACT[entityType].flushCountKey;
    flushedByEntity[countKey] = current.flushedByEntity[countKey] + next.flushedByEntity[countKey];
  }
  return Object.freeze({
    leased: current.leased + next.leased,
    flushed: current.flushed + next.flushed,
    dead: next.dead,
    flushedByEntity: Object.freeze(flushedByEntity),
  });
}

function readOwnerOutboxStatus(
  scope: OwnerQueryScope,
  ownerId: string | null | undefined,
  entityTypes: readonly OutboxEntityType[],
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
    const statuses = entityTypes.map((entityType) =>
      selectOutboxOwnerStatus(state.envelope, { ownerHash, entityType }),
    );
    const pendingCount = statuses.reduce((total, status) => total + status.pendingCount, 0);
    const attentionCount = statuses.reduce((total, status) => total + status.attentionCount, 0);
    const kind: OutboxOwnerStatus['kind'] =
      attentionCount > 0
        ? 'needs_attention'
        : pendingCount === 0
          ? 'idle'
          : statuses.some((status) => status.kind === 'syncing')
            ? 'syncing'
            : 'saved_local';
    return {
      status: 'available',
      value: Object.freeze({ kind, pendingCount, attentionCount }),
    };
  });
}

export function readShelfOutboxStatus(
  scope: OwnerQueryScope,
  ownerId?: string | null,
): Promise<ShelfOutboxStatusRead> {
  return readOwnerOutboxStatus(scope, ownerId, ['shelf_product', 'conflict_choice']);
}

export function readNotificationPreferencesOutboxStatus(
  scope: OwnerQueryScope,
  ownerId?: string | null,
): Promise<NotificationPreferencesOutboxStatusRead> {
  return readOwnerOutboxStatus(scope, ownerId, ['notification_preferences']);
}

export function readRecommendationPreferencesOutboxStatus(
  scope: OwnerQueryScope,
  ownerId?: string | null,
): Promise<RecommendationPreferencesOutboxStatusRead> {
  return readOwnerOutboxStatus(scope, ownerId, ['recommendation_preferences']);
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
      !['applied', 'duplicate', 'permanent', 'retry', 'stale'].includes(String(candidate.status)) ||
      (candidate.error_class !== null &&
        candidate.error_class !== 'dependency' &&
        candidate.error_class !== 'validation') ||
      (candidate.status === 'permanent' && candidate.error_class !== 'validation') ||
      (candidate.status === 'retry' && candidate.error_class !== 'dependency') ||
      (candidate.status !== 'permanent' &&
        candidate.status !== 'retry' &&
        candidate.error_class !== null)
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
  operationIds: readonly string[],
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
        operationIds,
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
  const rpc = OUTBOX_ENTITY_CONTRACT[entityType].rpc;
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

type OutboxDrainPass = Readonly<{
  result: OutboxFlushResult;
  hasRemainingRows: boolean;
  nextWakeAt: string | null;
}>;

async function flushOutboxOnce(): Promise<OutboxDrainPass> {
  if (!isSupabaseConfigured) {
    return Object.freeze({
      result: emptyFlushResult(),
      hasRemainingRows: false,
      nextWakeAt: null,
    });
  }

  return runAccountGenerationOperation(async (lease) => {
    const owner = await captureAuthenticatedAccountOwner(lease);
    if (!owner) {
      return Object.freeze({
        result: emptyFlushResult(),
        hasRemainingRows: false,
        nextWakeAt: null,
      });
    }
    const ownerHash = await hashOutboxOwner(owner.userId);
    lease.assertCurrent();

    let totalLeased = 0;
    let totalFlushed = 0;
    const flushedByEntity = createOutboxFlushCounts();
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
      let hadRequestFailure = false;
      for (const entityType of OUTBOX_ENTITY_TYPES) {
        const rows = leasedRows.filter((row) => row.entityType === entityType);
        if (rows.length === 0) continue;
        let entityResults: readonly OutboxServerResult[] = [];
        let requestFailure: RequestPolicyError | null = null;
        try {
          entityResults = await sendOutboxEntityBatch(lease, entityType, rows);
          results.push(...entityResults);
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
          hadRequestFailure = true;
        }
        await settleLease(
          leaseOwner,
          rows.map((row) => row.operationId),
          entityResults,
          requestFailure
            ? {
                errorClass: failureClass(requestFailure),
                retryAfterMs: requestFailure.retryAfterMs,
              }
            : undefined,
        );
        lease.assertCurrent();
      }
      const successfulIds = new Set(
        results
          .filter((result) => ['applied', 'duplicate', 'stale'].includes(result.status))
          .map((result) => result.operationId),
      );
      const successfulRows = leasedRows.filter((row) => successfulIds.has(row.operationId));
      totalFlushed += successfulRows.length;
      for (const row of successfulRows) {
        const countKey = OUTBOX_ENTITY_CONTRACT[row.entityType].flushCountKey;
        flushedByEntity[countKey] += 1;
      }
      if (hadRequestFailure) break;
    }

    const state = await readOutbox();
    lease.assertCurrent();
    const now = new Date().toISOString();
    const envelope =
      state.status === 'available' || state.status === 'absent' ? state.envelope : null;
    const ownerStatuses =
      envelope === null
        ? []
        : OUTBOX_ENTITY_TYPES.map((entityType) =>
            selectOutboxOwnerStatus(envelope, { ownerHash, entityType }),
          );
    const ownerDeadCount = ownerStatuses.reduce(
      (total, status) => total + status.attentionCount,
      0,
    );
    return Object.freeze({
      result: Object.freeze({
        leased: totalLeased,
        flushed: totalFlushed,
        dead: ownerDeadCount,
        flushedByEntity: Object.freeze(flushedByEntity),
      }),
      hasRemainingRows: ownerStatuses.some((status) => status.pendingCount > 0),
      nextWakeAt:
        envelope === null
          ? null
          : nextOutboxWakeAt(envelope, {
              ownerHash,
              now,
            }),
    });
  });
}

/** Single-flight drain used by mount, foreground, reconnect, and post-mutation triggers. */
export function flushOutbox(): Promise<OutboxFlushResult> {
  clearOutboxWakeTimer();
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
    let hasRemainingRows = false;
    let nextWakeAt: string | null = null;
    try {
      do {
        flushRerunRequested = false;
        const pass = await flushOutboxOnce();
        result = mergeFlushResults(result, pass.result);
        hasRemainingRows = pass.hasRemainingRows;
        nextWakeAt = pass.nextWakeAt;
        syncDiagnostics = Object.freeze({
          result: hasRemainingRows ? 'pending' : result.flushed > 0 ? 'synced' : 'idle',
          at: new Date().toISOString(),
        });
        publishOutboxChange();
      } while (flushRerunRequested);
      // No async boundary exists between the final request check and releasing
      // ownership, so a later request either joins this loop or starts a new one.
      activeFlush = null;
      armOutboxWakeTimer(nextWakeAt);
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
  clearOutboxWakeTimer();
  publishOutboxChange();
  if (!outboxSchedulerActive) return;
  if (activeFlush) {
    flushRerunRequested = true;
    return;
  }
  void flushOutbox().catch(() => undefined);
}

function retryOwnerOutbox(
  scope: OwnerQueryScope,
  ownerId: string | null | undefined,
  entityTypes: readonly OutboxEntityType[],
): Promise<OutboxFlushResult> {
  return runOwnerQueryOperation(scope, async (lease) => {
    const normalizedOwnerId = ownerId?.trim();
    if (!normalizedOwnerId) return emptyFlushResult();
    const ownerHash = await hashOutboxOwner(normalizedOwnerId);
    lease.assertCurrent();
    let retried = 0;
    await updatePrivateItem(OUTBOX_STORAGE_KEY, (current) => {
      let envelope = decodeOutboxEnvelope(current);
      for (const entityType of entityTypes) {
        const retry = retryDeadOutboxRows(envelope, {
          ownerHash,
          entityType,
          now: new Date().toISOString(),
        });
        envelope = retry.envelope;
        retried += retry.retried;
      }
      return retried > 0 ? encodeOutboxEnvelope(envelope) : current;
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
  return retryOwnerOutbox(scope, ownerId, ['shelf_product', 'conflict_choice']);
}

export function retryNotificationPreferencesOutbox(
  scope: OwnerQueryScope,
  ownerId?: string | null,
): Promise<OutboxFlushResult> {
  return retryOwnerOutbox(scope, ownerId, ['notification_preferences']);
}

export function retryRecommendationPreferencesOutbox(
  scope: OwnerQueryScope,
  ownerId?: string | null,
): Promise<OutboxFlushResult> {
  return retryOwnerOutbox(scope, ownerId, ['recommendation_preferences']);
}

export function readOutboxSyncDiagnostics(): typeof syncDiagnostics {
  return { ...syncDiagnostics };
}

export function resetOutboxWorkerForTests(): void {
  outboxSchedulerActive = false;
  clearOutboxWakeTimer();
  activeFlush = null;
  flushRerunRequested = false;
  outboxChangeRevision = 0;
  outboxChangeListeners.clear();
  syncDiagnostics = Object.freeze({ result: 'not_run', at: null });
}

export { hashOutboxOwner } from './outboxIdentity';
