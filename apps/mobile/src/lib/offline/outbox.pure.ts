export const OUTBOX_STORAGE_KEY = 'onskin.outbox.v1';
export const OUTBOX_SCHEMA_VERSION = 1 as const;
export const OUTBOX_ROW_SCHEMA_VERSION = 1 as const;
export const MAX_OUTBOX_ROWS = 512;
export const MAX_OUTBOX_REVISIONS = 1_024;
export const MAX_OUTBOX_PAYLOAD_BYTES = 64 * 1024;
export const MAX_OUTBOX_BATCH_SIZE = 25;
export const MAX_OUTBOX_ATTEMPTS = 8;
export const OUTBOX_LEASE_MS = 30_000;
export const OUTBOX_BASE_RETRY_MS = 1_000;
export const OUTBOX_MAX_RETRY_MS = 5 * 60_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_HEX = /^[0-9a-f]{64}$/;

export type OutboxEntityType = 'shelf_product';
export type OutboxOperationKind = 'delete' | 'upsert';
export type OutboxState = 'dead' | 'leased' | 'ready';
export type OutboxFailureClass =
  | 'authentication'
  | 'offline'
  | 'rate_limit'
  | 'server'
  | 'timeout'
  | 'unknown'
  | 'validation';

export type OutboxPayload = Readonly<Record<string, unknown>>;

export type OutboxRow = Readonly<{
  schemaVersion: typeof OUTBOX_ROW_SCHEMA_VERSION;
  operationId: string;
  ownerHash: string;
  ownerGeneration: number;
  entityType: OutboxEntityType;
  entityId: string;
  operationKind: OutboxOperationKind;
  payload: OutboxPayload | null;
  clientRevision: number;
  idempotencyKey: string;
  dependencyGroupId: string;
  enqueuedAt: string;
  attemptCount: number;
  nextAttemptAt: string;
  lastErrorClass: OutboxFailureClass | null;
  tombstone: boolean;
  state: OutboxState;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
}>;

export type OutboxRevision = Readonly<{
  entityType: OutboxEntityType;
  entityId: string;
  revision: number;
}>;

export type OutboxEnvelope = Readonly<{
  version: typeof OUTBOX_SCHEMA_VERSION;
  rows: readonly OutboxRow[];
  revisions: readonly OutboxRevision[];
}>;

export type OutboxServerResult = Readonly<{
  operationId: string;
  status: 'applied' | 'duplicate' | 'permanent' | 'stale';
  errorClass?: 'validation';
}>;

export const OUTBOX_INVALID = 'OUTBOX_INVALID';
export const OUTBOX_UNSUPPORTED_VERSION = 'OUTBOX_UNSUPPORTED_VERSION';
export const OUTBOX_LIMIT_REACHED = 'OUTBOX_LIMIT_REACHED';

function fail(code = OUTBOX_INVALID): never {
  throw new Error(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === expected.length &&
    expected.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

function canonicalIso(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < 20 || value.length > 30) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  const canonical = new Date(timestamp).toISOString();
  return canonical === value ? canonical : null;
}

function utf8Bytes(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else bytes += 3;
  }
  return bytes;
}

function validPayload(value: unknown): value is OutboxPayload {
  if (!isRecord(value)) return false;
  const jsonSafe = (candidate: unknown, depth: number): boolean => {
    if (depth > 8) return false;
    if (candidate === null || typeof candidate === 'string' || typeof candidate === 'boolean') {
      return true;
    }
    if (typeof candidate === 'number') return Number.isFinite(candidate);
    if (Array.isArray(candidate)) return candidate.every((item) => jsonSafe(item, depth + 1));
    if (!isRecord(candidate)) return false;
    return Object.entries(candidate).every(([key, item]) => {
      const normalizedKey = key.replaceAll('_', '').toLowerCase();
      if (['accesstoken', 'authorization', 'ownerhash', 'userid'].includes(normalizedKey)) {
        return false;
      }
      return jsonSafe(item, depth + 1);
    });
  };
  if (!jsonSafe(value, 0)) return false;
  try {
    const serialized = JSON.stringify(value);
    return serialized !== undefined && utf8Bytes(serialized) <= MAX_OUTBOX_PAYLOAD_BYTES;
  } catch {
    return false;
  }
}

function entityIdentity(value: Pick<OutboxRow, 'entityType' | 'entityId'>): string {
  return `${value.entityType}:${value.entityId}`;
}

function decodeRow(value: unknown): OutboxRow {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'schemaVersion',
      'operationId',
      'ownerHash',
      'ownerGeneration',
      'entityType',
      'entityId',
      'operationKind',
      'payload',
      'clientRevision',
      'idempotencyKey',
      'dependencyGroupId',
      'enqueuedAt',
      'attemptCount',
      'nextAttemptAt',
      'lastErrorClass',
      'tombstone',
      'state',
      'leaseOwner',
      'leaseExpiresAt',
    ])
  ) {
    fail();
  }
  const entityType = value.entityType;
  const entityId = value.entityId;
  const operationKind = value.operationKind;
  const state = value.state;
  const lastErrorClass = value.lastErrorClass;
  const failureClasses = new Set<OutboxFailureClass>([
    'authentication',
    'offline',
    'rate_limit',
    'server',
    'timeout',
    'unknown',
    'validation',
  ]);
  if (
    value.schemaVersion !== OUTBOX_ROW_SCHEMA_VERSION ||
    typeof value.operationId !== 'string' ||
    !UUID.test(value.operationId) ||
    typeof value.ownerHash !== 'string' ||
    !SHA256_HEX.test(value.ownerHash) ||
    !Number.isSafeInteger(value.ownerGeneration) ||
    Number(value.ownerGeneration) < 0 ||
    entityType !== 'shelf_product' ||
    typeof entityId !== 'string' ||
    !UUID.test(entityId) ||
    (operationKind !== 'upsert' && operationKind !== 'delete') ||
    !Number.isSafeInteger(value.clientRevision) ||
    Number(value.clientRevision) < 1 ||
    typeof value.idempotencyKey !== 'string' ||
    value.idempotencyKey !== `${entityType}:${entityId}:${value.clientRevision}` ||
    value.dependencyGroupId !== `${entityType}:${entityId}` ||
    !canonicalIso(value.enqueuedAt) ||
    !Number.isSafeInteger(value.attemptCount) ||
    Number(value.attemptCount) < 0 ||
    Number(value.attemptCount) > MAX_OUTBOX_ATTEMPTS ||
    !canonicalIso(value.nextAttemptAt) ||
    (lastErrorClass !== null &&
      (typeof lastErrorClass !== 'string' ||
        !failureClasses.has(lastErrorClass as OutboxFailureClass))) ||
    typeof value.tombstone !== 'boolean' ||
    (state !== 'ready' && state !== 'leased' && state !== 'dead') ||
    (value.leaseOwner !== null &&
      (typeof value.leaseOwner !== 'string' || !UUID.test(value.leaseOwner))) ||
    (value.leaseExpiresAt !== null && !canonicalIso(value.leaseExpiresAt))
  ) {
    fail();
  }
  if (
    (operationKind === 'delete' && (value.payload !== null || value.tombstone !== true)) ||
    (operationKind === 'upsert' && (!validPayload(value.payload) || value.tombstone !== false)) ||
    (state === 'leased' && (!value.leaseOwner || !value.leaseExpiresAt)) ||
    (state !== 'leased' && (value.leaseOwner !== null || value.leaseExpiresAt !== null))
  ) {
    fail();
  }

  return Object.freeze({
    schemaVersion: OUTBOX_ROW_SCHEMA_VERSION,
    operationId: value.operationId,
    ownerHash: value.ownerHash,
    ownerGeneration: Number(value.ownerGeneration),
    entityType,
    entityId,
    operationKind,
    payload: value.payload as OutboxPayload | null,
    clientRevision: Number(value.clientRevision),
    idempotencyKey: value.idempotencyKey,
    dependencyGroupId: value.dependencyGroupId as string,
    enqueuedAt: value.enqueuedAt as string,
    attemptCount: Number(value.attemptCount),
    nextAttemptAt: value.nextAttemptAt as string,
    lastErrorClass: lastErrorClass as OutboxFailureClass | null,
    tombstone: value.tombstone,
    state,
    leaseOwner: value.leaseOwner as string | null,
    leaseExpiresAt: value.leaseExpiresAt as string | null,
  });
}

function decodeRevision(value: unknown): OutboxRevision {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['entityType', 'entityId', 'revision']) ||
    value.entityType !== 'shelf_product' ||
    typeof value.entityId !== 'string' ||
    !UUID.test(value.entityId) ||
    !Number.isSafeInteger(value.revision) ||
    Number(value.revision) < 1
  ) {
    fail();
  }
  return Object.freeze({
    entityType: value.entityType,
    entityId: value.entityId,
    revision: Number(value.revision),
  });
}

export function emptyOutboxEnvelope(): OutboxEnvelope {
  return Object.freeze({
    version: OUTBOX_SCHEMA_VERSION,
    rows: Object.freeze([]),
    revisions: Object.freeze([]),
  });
}

export function decodeOutboxEnvelope(raw: string | null): OutboxEnvelope {
  if (raw === null) return emptyOutboxEnvelope();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    fail();
  }
  if (!isRecord(parsed)) fail();
  if (
    typeof parsed.version === 'number' &&
    Number.isSafeInteger(parsed.version) &&
    parsed.version > OUTBOX_SCHEMA_VERSION
  ) {
    fail(OUTBOX_UNSUPPORTED_VERSION);
  }
  if (
    parsed.version !== OUTBOX_SCHEMA_VERSION ||
    !hasExactKeys(parsed, ['version', 'rows', 'revisions']) ||
    !Array.isArray(parsed.rows) ||
    parsed.rows.length > MAX_OUTBOX_ROWS ||
    !Array.isArray(parsed.revisions) ||
    parsed.revisions.length > MAX_OUTBOX_REVISIONS
  ) {
    fail();
  }
  const rows = parsed.rows.map(decodeRow);
  const revisions = parsed.revisions.map(decodeRevision);
  if (
    new Set(rows.map((row) => row.operationId)).size !== rows.length ||
    new Set(revisions.map(entityIdentity)).size !== revisions.length ||
    rows.some((row) => {
      const revision = revisions.find(
        (candidate) => entityIdentity(candidate) === entityIdentity(row),
      );
      return !revision || revision.revision < row.clientRevision;
    })
  ) {
    fail();
  }
  return Object.freeze({
    version: OUTBOX_SCHEMA_VERSION,
    rows: Object.freeze(rows),
    revisions: Object.freeze(revisions),
  });
}

export function encodeOutboxEnvelope(envelope: OutboxEnvelope): string {
  return JSON.stringify(envelope);
}

function sortRows(rows: readonly OutboxRow[]): OutboxRow[] {
  return [...rows].sort(
    (left, right) =>
      left.enqueuedAt.localeCompare(right.enqueuedAt) ||
      left.clientRevision - right.clientRevision ||
      left.operationId.localeCompare(right.operationId),
  );
}

export function enqueueShelfOutboxOperation(
  envelope: OutboxEnvelope,
  input: Readonly<{
    operationId: string;
    ownerHash: string;
    ownerGeneration: number;
    entityId: string;
    operationKind: OutboxOperationKind;
    payload: OutboxPayload | null;
    enqueuedAt: string;
  }>,
): Readonly<{ envelope: OutboxEnvelope; row: OutboxRow }> {
  const identity = `shelf_product:${input.entityId}`;
  const previousRevision =
    envelope.revisions.find((revision) => entityIdentity(revision) === identity)?.revision ?? 0;
  const clientRevision = previousRevision + 1;
  const row = decodeRow({
    schemaVersion: OUTBOX_ROW_SCHEMA_VERSION,
    operationId: input.operationId,
    ownerHash: input.ownerHash,
    ownerGeneration: input.ownerGeneration,
    entityType: 'shelf_product',
    entityId: input.entityId,
    operationKind: input.operationKind,
    payload: input.payload,
    clientRevision,
    idempotencyKey: `${identity}:${clientRevision}`,
    dependencyGroupId: identity,
    enqueuedAt: input.enqueuedAt,
    attemptCount: 0,
    nextAttemptAt: input.enqueuedAt,
    lastErrorClass: null,
    tombstone: input.operationKind === 'delete',
    state: 'ready',
    leaseOwner: null,
    leaseExpiresAt: null,
  });
  const rows = envelope.rows.filter(
    (existing) => entityIdentity(existing) !== identity || existing.state !== 'ready',
  );
  rows.push(row);
  if (rows.length > MAX_OUTBOX_ROWS) fail(OUTBOX_LIMIT_REACHED);
  const revisions = envelope.revisions.filter((revision) => entityIdentity(revision) !== identity);
  revisions.push({
    entityType: 'shelf_product',
    entityId: input.entityId,
    revision: clientRevision,
  });
  if (revisions.length > MAX_OUTBOX_REVISIONS) fail(OUTBOX_LIMIT_REACHED);
  return {
    row,
    envelope: Object.freeze({
      version: OUTBOX_SCHEMA_VERSION,
      rows: Object.freeze(sortRows(rows)),
      revisions: Object.freeze(
        revisions.sort((a, b) => entityIdentity(a).localeCompare(entityIdentity(b))),
      ),
    }),
  };
}

function expired(row: OutboxRow, now: string): boolean {
  return row.state === 'leased' && row.leaseExpiresAt !== null && row.leaseExpiresAt <= now;
}

export function leaseReadyOutboxRows(
  envelope: OutboxEnvelope,
  input: Readonly<{
    ownerHash: string;
    leaseOwner: string;
    now: string;
    limit?: number;
  }>,
): Readonly<{ envelope: OutboxEnvelope; rows: readonly OutboxRow[] }> {
  if (
    !SHA256_HEX.test(input.ownerHash) ||
    !UUID.test(input.leaseOwner) ||
    !canonicalIso(input.now)
  ) {
    fail();
  }
  const limit = Math.min(
    MAX_OUTBOX_BATCH_SIZE,
    Number.isSafeInteger(input.limit) && Number(input.limit) > 0
      ? Number(input.limit)
      : MAX_OUTBOX_BATCH_SIZE,
  );
  const reclaimed = envelope.rows.map(
    (row): OutboxRow =>
      expired(row, input.now)
        ? { ...row, state: 'ready', leaseOwner: null, leaseExpiresAt: null }
        : row,
  );
  const latestReady = new Map<string, OutboxRow>();
  for (const row of reclaimed) {
    if (row.state !== 'ready') continue;
    const identity = entityIdentity(row);
    const existing = latestReady.get(identity);
    if (!existing || existing.clientRevision < row.clientRevision) latestReady.set(identity, row);
  }
  const supersededReadyIds = new Set(
    reclaimed
      .filter(
        (row) =>
          row.state === 'ready' &&
          latestReady.get(entityIdentity(row))?.operationId !== row.operationId,
      )
      .map((row) => row.operationId),
  );
  const compacted = reclaimed.filter((row) => !supersededReadyIds.has(row.operationId));
  const eligible = sortRows(compacted).filter(
    (row) =>
      row.ownerHash === input.ownerHash && row.state === 'ready' && row.nextAttemptAt <= input.now,
  );
  const selected = new Set(eligible.slice(0, limit).map((row) => row.operationId));
  const leaseExpiresAt = new Date(Date.parse(input.now) + OUTBOX_LEASE_MS).toISOString();
  const leasedRows: OutboxRow[] = [];
  const rows = compacted.map((row): OutboxRow => {
    if (!selected.has(row.operationId)) return row;
    if (row.attemptCount >= MAX_OUTBOX_ATTEMPTS) {
      return {
        ...row,
        state: 'dead',
        lastErrorClass: 'unknown',
        leaseOwner: null,
        leaseExpiresAt: null,
      };
    }
    const leased = Object.freeze({
      ...row,
      state: 'leased' as const,
      attemptCount: row.attemptCount + 1,
      leaseOwner: input.leaseOwner,
      leaseExpiresAt,
    });
    leasedRows.push(leased);
    return leased;
  });
  return {
    rows: Object.freeze(leasedRows),
    envelope: Object.freeze({ ...envelope, rows: Object.freeze(sortRows(rows)) }),
  };
}

function retryAt(
  now: string,
  attemptCount: number,
  random: number,
  retryAfterMs: number | null,
): string {
  const cap = Math.min(
    OUTBOX_MAX_RETRY_MS,
    OUTBOX_BASE_RETRY_MS * 2 ** Math.max(0, attemptCount - 1),
  );
  const jitter = Math.floor(Math.max(0, Math.min(1, random)) * cap);
  const delay = retryAfterMs === null ? jitter : Math.min(OUTBOX_MAX_RETRY_MS, retryAfterMs);
  return new Date(Date.parse(now) + delay).toISOString();
}

export function settleOutboxLease(
  envelope: OutboxEnvelope,
  input: Readonly<{
    leaseOwner: string;
    now: string;
    results: readonly OutboxServerResult[];
    failureClass?: OutboxFailureClass;
    retryAfterMs?: number | null;
    random?: number;
  }>,
): OutboxEnvelope {
  if (!UUID.test(input.leaseOwner) || !canonicalIso(input.now)) fail();
  const resultByOperation = new Map(input.results.map((result) => [result.operationId, result]));
  if (resultByOperation.size !== input.results.length) fail();
  const random = input.random ?? 0.5;
  const rows = envelope.rows.flatMap((row): OutboxRow[] => {
    if (row.state !== 'leased' || row.leaseOwner !== input.leaseOwner) return [row];
    const result = resultByOperation.get(row.operationId);
    if (result && ['applied', 'duplicate', 'stale'].includes(result.status)) return [];
    if (result?.status === 'permanent') {
      return [
        {
          ...row,
          state: 'dead',
          lastErrorClass: result.errorClass ?? 'validation',
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      ];
    }
    const failureClass = input.failureClass ?? 'unknown';
    if (row.attemptCount >= MAX_OUTBOX_ATTEMPTS) {
      return [
        {
          ...row,
          state: 'dead',
          lastErrorClass: failureClass,
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      ];
    }
    return [
      {
        ...row,
        state: 'ready',
        lastErrorClass: failureClass,
        nextAttemptAt: retryAt(input.now, row.attemptCount, random, input.retryAfterMs ?? null),
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    ];
  });
  return Object.freeze({ ...envelope, rows: Object.freeze(sortRows(rows)) });
}

export function outboxCounts(envelope: OutboxEnvelope): Readonly<{
  ready: number;
  inFlight: number;
  dead: number;
}> {
  return Object.freeze({
    ready: envelope.rows.filter((row) => row.state === 'ready').length,
    inFlight: envelope.rows.filter((row) => row.state === 'leased').length,
    dead: envelope.rows.filter((row) => row.state === 'dead').length,
  });
}
