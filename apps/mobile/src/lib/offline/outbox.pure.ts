import {
  OUTBOX_ENTITY_CONTRACT,
  isOutboxEntityType,
  isOutboxOperationKind,
  type OutboxEntityType,
  type OutboxOperationKind,
} from './outboxEntities';

export type { OutboxEntityType, OutboxOperationKind } from './outboxEntities';

export const OUTBOX_STORAGE_KEY = 'onskin.outbox.v1';
export const OUTBOX_SCHEMA_VERSION = 5 as const;
export const OUTBOX_LEGACY_SCHEMA_VERSIONS = [1, 2, 3, 4] as const;
export const OUTBOX_ROW_SCHEMA_VERSION = 1 as const;
export const MAX_OUTBOX_ROWS = 512;
export const MAX_SHELF_SCAN_OUTBOX_ROWS = 128;
export const MAX_OUTBOX_REVISIONS = 1_024;
export const MAX_OUTBOX_PAYLOAD_BYTES = 64 * 1024;
export const MAX_OUTBOX_BATCH_SIZE = 25;
export const MAX_OUTBOX_ATTEMPTS = 8;
export const OUTBOX_LEASE_MS = 30_000;
export const OUTBOX_BASE_RETRY_MS = 1_000;
export const OUTBOX_MAX_RETRY_MS = 5 * 60_000;
export const NOTIFICATION_PREFERENCES_ENTITY_NAMESPACE = 'notification_preferences';
export const NOTIFICATION_DELIVERY_ENTITY_NAMESPACE = 'notification_delivery';
export const RECOMMENDATION_PREFERENCES_ENTITY_NAMESPACE = 'recommendation_preferences';
export const SHELF_SCAN_ENTITY_NAMESPACE = 'shelf_scan';
export const CONFLICT_CHOICE_ENTITY_NAMESPACE = 'conflict_choice';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
const TIMEZONE_TEXT = /^[A-Za-z0-9_+\-/.]+$/;
const EDGE_WHITESPACE = /(^\s)|(\s$)/u;
const NUMERIC_BARCODE = /^[0-9]{6,14}$/;

export type OutboxState = 'dead' | 'leased' | 'ready';
export type OutboxFailureClass =
  | 'authentication'
  | 'dependency'
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
  ownerHash: string | null;
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
  status: 'applied' | 'duplicate' | 'permanent' | 'retry' | 'stale';
  errorClass?: 'dependency' | 'validation';
}>;

export type OutboxOwnerStatus = Readonly<{
  kind: 'idle' | 'needs_attention' | 'saved_local' | 'syncing';
  pendingCount: number;
  attentionCount: number;
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

function validNotificationPreferencesPayload(value: unknown): value is OutboxPayload {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'am_reminder_time',
      'pm_reminder_time',
      'am_reminder_enabled',
      'pm_reminder_enabled',
      'streak_nudges',
      'replenishment_alerts',
      'capture_reminders',
      'quiet_hours_start',
      'quiet_hours_end',
      'timezone',
      'live_activity_enabled',
      'promotional_opt_in',
      'lockscreen_discreet',
    ])
  ) {
    return false;
  }
  const optionalTime = (candidate: unknown) => candidate === null || HH_MM.test(String(candidate));
  return (
    HH_MM.test(String(value.am_reminder_time)) &&
    HH_MM.test(String(value.pm_reminder_time)) &&
    optionalTime(value.quiet_hours_start) &&
    optionalTime(value.quiet_hours_end) &&
    typeof value.timezone === 'string' &&
    value.timezone.length > 0 &&
    value.timezone.length <= 128 &&
    TIMEZONE_TEXT.test(value.timezone) &&
    [
      value.am_reminder_enabled,
      value.pm_reminder_enabled,
      value.streak_nudges,
      value.replenishment_alerts,
      value.capture_reminders,
      value.live_activity_enabled,
      value.promotional_opt_in,
    ].every((candidate) => typeof candidate === 'boolean') &&
    value.lockscreen_discreet === true
  );
}

function validRecommendationPreferencesPayload(value: unknown): value is OutboxPayload {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['values_filters', 'budget_band', 'format_prefs']) ||
    !Array.isArray(value.values_filters) ||
    !Array.isArray(value.format_prefs)
  ) {
    return false;
  }
  const allowedValues = new Set([
    'fragrance_free',
    'vegan',
    'cruelty_free',
    'non_comedogenic',
    'sustainable',
  ]);
  const values = value.values_filters;
  const formats = value.format_prefs;
  return (
    values.length <= allowedValues.size &&
    values.every((candidate) => typeof candidate === 'string' && allowedValues.has(candidate)) &&
    new Set(values).size === values.length &&
    (value.budget_band === null ||
      value.budget_band === 'drugstore' ||
      value.budget_band === 'mid' ||
      value.budget_band === 'premium') &&
    formats.length <= 16 &&
    formats.every(
      (candidate) =>
        typeof candidate === 'string' &&
        Array.from(candidate).length > 0 &&
        Array.from(candidate).length <= 64 &&
        !EDGE_WHITESPACE.test(candidate),
    ) &&
    new Set(formats).size === formats.length
  );
}

function validNotificationDeliveryPayload(value: unknown): value is OutboxPayload {
  if (!isRecord(value) || !hasExactKeys(value, ['kind', 'tier', 'sent_at'])) return false;
  const tierByKind: Readonly<Record<string, string>> = Object.freeze({
    am_reminder: 'utility',
    pm_step: 'utility',
    capture: 'behavioural',
    replenishment: 'behavioural',
    rampup: 'behavioural',
    deescalation: 'behavioural',
    winback: 'promotional',
  });
  return (
    typeof value.kind === 'string' &&
    typeof value.tier === 'string' &&
    tierByKind[value.kind] === value.tier &&
    canonicalIso(value.sent_at) !== null
  );
}

function validShelfScanPayload(value: unknown): value is OutboxPayload {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['barcode', 'result', 'matched_product_id', 'scanned_at'])
  ) {
    return false;
  }
  const matchedProductId = value.matched_product_id;
  return (
    typeof value.barcode === 'string' &&
    NUMERIC_BARCODE.test(value.barcode) &&
    (value.result === 'matched' ||
      value.result === 'no_match' ||
      value.result === 'ambiguous' ||
      value.result === 'offline_queued') &&
    (matchedProductId === null ||
      (typeof matchedProductId === 'string' && UUID.test(matchedProductId))) &&
    (value.result === 'matched' || matchedProductId === null) &&
    canonicalIso(value.scanned_at) !== null
  );
}

function validConflictChoicePayload(value: unknown): value is OutboxPayload {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'rule_id',
      'product_a_id',
      'product_b_id',
      'computed_severity',
      'user_choice',
      'rule_version',
    ])
  ) {
    return false;
  }
  return (
    typeof value.rule_id === 'string' &&
    UUID.test(value.rule_id) &&
    typeof value.product_a_id === 'string' &&
    UUID.test(value.product_a_id) &&
    typeof value.product_b_id === 'string' &&
    UUID.test(value.product_b_id) &&
    value.product_a_id.toLowerCase() < value.product_b_id.toLowerCase() &&
    ['none', 'mild', 'moderate', 'high'].includes(String(value.computed_severity)) &&
    (value.user_choice === 'accept_suggested_timing' || value.user_choice === 'use_together') &&
    Number.isSafeInteger(value.rule_version) &&
    Number(value.rule_version) >= 1
  );
}

export function conflictChoiceIdentityHashInput(payload: OutboxPayload): string {
  if (!validConflictChoicePayload(payload)) fail();
  return [
    'onskin:conflict-choice-identity:v1',
    String(payload.rule_id).toLowerCase(),
    String(payload.product_a_id).toLowerCase(),
    String(payload.product_b_id).toLowerCase(),
  ].join('\n');
}

export function conflictChoicePayloadHashInput(payload: OutboxPayload): string {
  if (!validConflictChoicePayload(payload)) fail();
  return [
    'onskin:conflict-choice-payload:v1',
    String(payload.rule_id).toLowerCase(),
    String(payload.product_a_id).toLowerCase(),
    String(payload.product_b_id).toLowerCase(),
    String(payload.computed_severity),
    String(payload.user_choice),
    String(payload.rule_version),
  ].join('\n');
}

export function outboxEntityIdFromSha256(hash: string): string {
  if (!SHA256_HEX.test(hash)) fail();
  const hex = hash.slice(0, 32).split('');
  hex[12] = '4';
  hex[16] = '8';
  const compact = hex.join('');
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}

function notificationDeliveryIdempotencyKey(operationId: unknown, payload: unknown): string | null {
  if (typeof operationId !== 'string' || !UUID.test(operationId)) return null;
  if (!validNotificationDeliveryPayload(payload)) return null;
  return `${NOTIFICATION_DELIVERY_ENTITY_NAMESPACE}:${operationId}:${String(payload.kind)}:${String(payload.sent_at)}`;
}

function shelfScanIdempotencyKey(operationId: unknown, value: unknown): string | null {
  if (typeof operationId !== 'string' || !UUID.test(operationId) || typeof value !== 'string') {
    return null;
  }
  return new RegExp(`^${SHELF_SCAN_ENTITY_NAMESPACE}:${operationId}:[0-9a-f]{64}$`, 'i').test(value)
    ? value.toLowerCase()
    : null;
}

function conflictChoiceIdempotencyKey(
  operationId: unknown,
  entityId: unknown,
  value: unknown,
): string | null {
  if (
    typeof operationId !== 'string' ||
    !UUID.test(operationId) ||
    typeof entityId !== 'string' ||
    !UUID.test(entityId) ||
    typeof value !== 'string'
  ) {
    return null;
  }
  const match = new RegExp(
    `^${CONFLICT_CHOICE_ENTITY_NAMESPACE}:${operationId}:([0-9a-f]{64}):([0-9a-f]{64})$`,
    'i',
  ).exec(value);
  if (!match || outboxEntityIdFromSha256(match[1]!.toLowerCase()) !== entityId.toLowerCase()) {
    return null;
  }
  return value.toLowerCase();
}

export function shelfScanPayloadHashInput(payload: OutboxPayload): string {
  if (!validShelfScanPayload(payload)) fail();
  return [
    'onskin:shelf-scan-payload:v1',
    String(payload.barcode),
    String(payload.result),
    payload.matched_product_id === null ? '-' : String(payload.matched_product_id).toLowerCase(),
    String(payload.scanned_at),
  ].join('\n');
}

function isImmutableEventEntityType(entityType: OutboxEntityType): boolean {
  return OUTBOX_ENTITY_CONTRACT[entityType].immutableEvent;
}

function entityIdentity(value: Pick<OutboxRow, 'entityType' | 'entityId'>): string {
  return `${value.entityType}:${value.entityId.toLowerCase()}`;
}

function ownerEntityIdentity(
  value: Pick<OutboxRow, 'ownerHash' | 'entityType' | 'entityId'>,
): string {
  return `${value.ownerHash}:${entityIdentity(value)}`;
}

function revisionIdentity(revision: OutboxRevision): string {
  return `${revision.ownerHash ?? 'legacy'}:${entityIdentity(revision)}`;
}

function notificationPreferencesEntityId(ownerHash: string): string {
  if (!SHA256_HEX.test(ownerHash)) fail();
  const hex = ownerHash.slice(0, 32).split('');
  hex[12] = '4';
  hex[16] = '8';
  const compact = hex.join('');
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
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
    'dependency',
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
    !isOutboxEntityType(entityType) ||
    typeof entityId !== 'string' ||
    !UUID.test(entityId) ||
    !isOutboxOperationKind(entityType, operationKind) ||
    !Number.isSafeInteger(value.clientRevision) ||
    Number(value.clientRevision) < 1 ||
    typeof value.idempotencyKey !== 'string' ||
    value.idempotencyKey !==
      (entityType === 'conflict_choice'
        ? conflictChoiceIdempotencyKey(value.operationId, entityId, value.idempotencyKey)
        : entityType === 'notification_preferences'
          ? `${NOTIFICATION_PREFERENCES_ENTITY_NAMESPACE}:${value.operationId}`
          : entityType === 'notification_delivery'
            ? notificationDeliveryIdempotencyKey(value.operationId, value.payload)
            : entityType === 'shelf_scan'
              ? shelfScanIdempotencyKey(value.operationId, value.idempotencyKey)
              : entityType === 'recommendation_preferences'
                ? `${RECOMMENDATION_PREFERENCES_ENTITY_NAMESPACE}:${value.operationId}`
                : `${entityType}:${entityId}:${value.clientRevision}`) ||
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
    (entityType === 'shelf_product' &&
      ((operationKind === 'delete' && (value.payload !== null || value.tombstone !== true)) ||
        (operationKind === 'upsert' &&
          (!validPayload(value.payload) || value.tombstone !== false)))) ||
    (entityType === 'conflict_choice' &&
      (operationKind !== 'upsert' ||
        !validConflictChoicePayload(value.payload) ||
        value.tombstone !== false)) ||
    (entityType === 'notification_preferences' &&
      (operationKind !== 'upsert' ||
        !validNotificationPreferencesPayload(value.payload) ||
        value.tombstone !== false)) ||
    (entityType === 'notification_delivery' &&
      (operationKind !== 'upsert' ||
        !validNotificationDeliveryPayload(value.payload) ||
        value.clientRevision !== 1 ||
        value.tombstone !== false)) ||
    (entityType === 'shelf_scan' &&
      (operationKind !== 'upsert' ||
        !validShelfScanPayload(value.payload) ||
        value.clientRevision !== 1 ||
        value.tombstone !== false)) ||
    (entityType === 'recommendation_preferences' &&
      (operationKind !== 'upsert' ||
        !validRecommendationPreferencesPayload(value.payload) ||
        value.tombstone !== false)) ||
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
    !hasExactKeys(value, ['ownerHash', 'entityType', 'entityId', 'revision']) ||
    typeof value.ownerHash !== 'string' ||
    !SHA256_HEX.test(value.ownerHash) ||
    !isOutboxEntityType(value.entityType) ||
    typeof value.entityId !== 'string' ||
    !UUID.test(value.entityId) ||
    !Number.isSafeInteger(value.revision) ||
    Number(value.revision) < 1
  ) {
    fail();
  }
  return Object.freeze({
    ownerHash: value.ownerHash,
    entityType: value.entityType,
    entityId: value.entityId,
    revision: Number(value.revision),
  });
}

function decodeLegacyRevision(value: unknown, rows: readonly OutboxRow[]): OutboxRevision {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['entityType', 'entityId', 'revision']) ||
    !isOutboxEntityType(value.entityType) ||
    typeof value.entityId !== 'string' ||
    !UUID.test(value.entityId) ||
    !Number.isSafeInteger(value.revision) ||
    Number(value.revision) < 1
  ) {
    fail();
  }
  const owners = new Set(
    rows
      .filter((row) => row.entityType === value.entityType && row.entityId === value.entityId)
      .map((row) => row.ownerHash),
  );
  return Object.freeze({
    ownerHash: owners.size === 1 ? [...owners][0]! : null,
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

function isSupportedOutboxSchemaVersion(value: unknown): boolean {
  return (
    value === OUTBOX_SCHEMA_VERSION ||
    OUTBOX_LEGACY_SCHEMA_VERSIONS.some((version) => version === value)
  );
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
    !isSupportedOutboxSchemaVersion(parsed.version) ||
    !hasExactKeys(parsed, ['version', 'rows', 'revisions']) ||
    !Array.isArray(parsed.rows) ||
    parsed.rows.length > MAX_OUTBOX_ROWS ||
    !Array.isArray(parsed.revisions) ||
    parsed.revisions.length > MAX_OUTBOX_REVISIONS
  ) {
    fail();
  }
  const rows = parsed.rows.map(decodeRow);
  const revisions =
    parsed.version === 1
      ? parsed.revisions.map((revision) => decodeLegacyRevision(revision, rows))
      : parsed.revisions.map(decodeRevision);
  if (
    new Set(rows.map((row) => row.operationId)).size !== rows.length ||
    new Set(revisions.map(revisionIdentity)).size !== revisions.length ||
    rows.some((row) => {
      const revision = revisions.find(
        (candidate) =>
          (candidate.ownerHash === null || candidate.ownerHash === row.ownerHash) &&
          entityIdentity(candidate) === entityIdentity(row),
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
  return enqueueOutboxOperation(envelope, {
    ...input,
    entityType: 'shelf_product',
  });
}

export function enqueueNotificationPreferencesOutboxOperation(
  envelope: OutboxEnvelope,
  input: Readonly<{
    operationId: string;
    ownerHash: string;
    ownerGeneration: number;
    payload: OutboxPayload;
    enqueuedAt: string;
  }>,
): Readonly<{ envelope: OutboxEnvelope; row: OutboxRow }> {
  return enqueueOutboxOperation(envelope, {
    ...input,
    entityId: notificationPreferencesEntityId(input.ownerHash),
    entityType: 'notification_preferences',
    operationKind: 'upsert',
  });
}

export function enqueueRecommendationPreferencesOutboxOperation(
  envelope: OutboxEnvelope,
  input: Readonly<{
    operationId: string;
    ownerHash: string;
    ownerGeneration: number;
    payload: OutboxPayload;
    enqueuedAt: string;
  }>,
): Readonly<{ envelope: OutboxEnvelope; row: OutboxRow }> {
  return enqueueOutboxOperation(envelope, {
    ...input,
    entityId: notificationPreferencesEntityId(input.ownerHash),
    entityType: 'recommendation_preferences',
    operationKind: 'upsert',
  });
}

export function enqueueNotificationDeliveryOutboxOperation(
  envelope: OutboxEnvelope,
  input: Readonly<{
    operationId: string;
    ownerHash: string;
    ownerGeneration: number;
    entityId: string;
    payload: OutboxPayload;
    enqueuedAt: string;
  }>,
): Readonly<{ envelope: OutboxEnvelope; row: OutboxRow }> {
  return enqueueOutboxOperation(envelope, {
    ...input,
    entityType: 'notification_delivery',
    operationKind: 'upsert',
  });
}

export function enqueueShelfScanOutboxOperation(
  envelope: OutboxEnvelope,
  input: Readonly<{
    operationId: string;
    ownerHash: string;
    ownerGeneration: number;
    entityId: string;
    payload: OutboxPayload;
    payloadHash: string;
    enqueuedAt: string;
  }>,
): Readonly<{ envelope: OutboxEnvelope; row: OutboxRow }> {
  if (!SHA256_HEX.test(input.payloadHash)) fail();
  if (
    envelope.rows.filter((row) => row.entityType === 'shelf_scan').length >=
    MAX_SHELF_SCAN_OUTBOX_ROWS
  ) {
    fail(OUTBOX_LIMIT_REACHED);
  }
  return enqueueOutboxOperation(envelope, {
    ...input,
    entityType: 'shelf_scan',
    operationKind: 'upsert',
    idempotencyKey: `${SHELF_SCAN_ENTITY_NAMESPACE}:${input.operationId}:${input.payloadHash}`,
  });
}

export function enqueueConflictChoiceOutboxOperation(
  envelope: OutboxEnvelope,
  input: Readonly<{
    operationId: string;
    ownerHash: string;
    ownerGeneration: number;
    entityId: string;
    payload: OutboxPayload;
    identityHash: string;
    payloadHash: string;
    enqueuedAt: string;
  }>,
): Readonly<{ envelope: OutboxEnvelope; row: OutboxRow }> {
  if (
    !SHA256_HEX.test(input.identityHash) ||
    !SHA256_HEX.test(input.payloadHash) ||
    outboxEntityIdFromSha256(input.identityHash) !== input.entityId.toLowerCase()
  ) {
    fail();
  }
  return enqueueOutboxOperation(envelope, {
    ...input,
    entityType: 'conflict_choice',
    operationKind: 'upsert',
    idempotencyKey: `${CONFLICT_CHOICE_ENTITY_NAMESPACE}:${input.operationId}:${input.identityHash}:${input.payloadHash}`,
  });
}

function enqueueOutboxOperation(
  envelope: OutboxEnvelope,
  input: Readonly<{
    operationId: string;
    ownerHash: string;
    ownerGeneration: number;
    entityType: OutboxEntityType;
    entityId: string;
    operationKind: OutboxOperationKind;
    payload: OutboxPayload | null;
    idempotencyKey?: string;
    enqueuedAt: string;
  }>,
): Readonly<{ envelope: OutboxEnvelope; row: OutboxRow }> {
  const normalizedEntityId = input.entityId.toLowerCase();
  const identity = `${input.entityType}:${normalizedEntityId}`;
  const dependencyIdentity = identity;
  const previousRevision = Math.max(
    0,
    ...envelope.revisions
      .filter(
        (revision) =>
          (revision.ownerHash === null || revision.ownerHash === input.ownerHash) &&
          entityIdentity(revision) === identity,
      )
      .map((revision) => revision.revision),
  );
  if (isImmutableEventEntityType(input.entityType) && previousRevision !== 0) fail();
  const clientRevision = previousRevision + 1;
  const row = decodeRow({
    schemaVersion: OUTBOX_ROW_SCHEMA_VERSION,
    operationId: input.operationId,
    ownerHash: input.ownerHash,
    ownerGeneration: input.ownerGeneration,
    entityType: input.entityType,
    entityId: normalizedEntityId,
    operationKind: input.operationKind,
    payload: input.payload,
    clientRevision,
    idempotencyKey:
      input.entityType === 'conflict_choice'
        ? (conflictChoiceIdempotencyKey(
            input.operationId,
            normalizedEntityId,
            input.idempotencyKey,
          ) ?? '')
        : input.entityType === 'notification_preferences'
          ? `${NOTIFICATION_PREFERENCES_ENTITY_NAMESPACE}:${input.operationId}`
          : input.entityType === 'notification_delivery'
            ? (notificationDeliveryIdempotencyKey(input.operationId, input.payload) ?? '')
            : input.entityType === 'shelf_scan'
              ? (shelfScanIdempotencyKey(input.operationId, input.idempotencyKey) ?? '')
              : input.entityType === 'recommendation_preferences'
                ? `${RECOMMENDATION_PREFERENCES_ENTITY_NAMESPACE}:${input.operationId}`
                : `${dependencyIdentity}:${clientRevision}`,
    dependencyGroupId: dependencyIdentity,
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
    (existing) =>
      ownerEntityIdentity(existing) !== `${input.ownerHash}:${identity}` ||
      existing.state === 'leased',
  );
  rows.push(row);
  if (rows.length > MAX_OUTBOX_ROWS) fail(OUTBOX_LIMIT_REACHED);
  const revisions = envelope.revisions.filter(
    (revision) => revision.ownerHash !== input.ownerHash || entityIdentity(revision) !== identity,
  );
  revisions.push({
    ownerHash: input.ownerHash,
    entityType: input.entityType,
    entityId: normalizedEntityId,
    revision: clientRevision,
  });
  if (revisions.length > MAX_OUTBOX_REVISIONS) fail(OUTBOX_LIMIT_REACHED);
  return {
    row,
    envelope: Object.freeze({
      version: OUTBOX_SCHEMA_VERSION,
      rows: Object.freeze(sortRows(rows)),
      revisions: Object.freeze(
        revisions.sort((a, b) => revisionIdentity(a).localeCompare(revisionIdentity(b))),
      ),
    }),
  };
}

/** Remove obsolete conflict projections in the same transaction that queues a
 * referenced Shelf deletion. Revisions remain as replay fences for any worker
 * that had already sent the removed row. */
export function discardConflictChoiceOutboxDependencies(
  envelope: OutboxEnvelope,
  input: Readonly<{ ownerHash: string; productIds: readonly string[] }>,
): Readonly<{ envelope: OutboxEnvelope; discarded: number }> {
  if (!SHA256_HEX.test(input.ownerHash) || input.productIds.length === 0) fail();
  const productIds = new Set(
    input.productIds.map((productId) => {
      if (!UUID.test(productId)) fail();
      return productId.toLowerCase();
    }),
  );
  const rows = envelope.rows.filter(
    (row) =>
      row.ownerHash !== input.ownerHash ||
      row.entityType !== 'conflict_choice' ||
      row.payload === null ||
      ![row.payload.product_a_id, row.payload.product_b_id].some(
        (productId) => typeof productId === 'string' && productIds.has(productId.toLowerCase()),
      ),
  );
  return Object.freeze({
    discarded: envelope.rows.length - rows.length,
    envelope: Object.freeze({ ...envelope, rows: Object.freeze(sortRows(rows)) }),
  });
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
      row.ownerHash === input.ownerHash && expired(row, input.now)
        ? { ...row, state: 'ready', leaseOwner: null, leaseExpiresAt: null }
        : row,
  );
  const latestReady = new Map<string, OutboxRow>();
  for (const row of reclaimed) {
    if (row.state !== 'ready') continue;
    const identity = ownerEntityIdentity(row);
    const existing = latestReady.get(identity);
    if (!existing || existing.clientRevision < row.clientRevision) latestReady.set(identity, row);
  }
  const supersededReadyIds = new Set(
    reclaimed
      .filter(
        (row) =>
          row.state === 'ready' &&
          latestReady.get(ownerEntityIdentity(row))?.operationId !== row.operationId,
      )
      .map((row) => row.operationId),
  );
  const compacted = reclaimed.filter((row) => !supersededReadyIds.has(row.operationId));
  const leasedIdentities = new Set(
    compacted.filter((row) => row.state === 'leased').map(ownerEntityIdentity),
  );
  const pendingShelfEntities = new Set(
    compacted
      .filter((row) => row.entityType === 'shelf_product')
      .map((row) => `${row.ownerHash}:${row.entityId.toLowerCase()}`),
  );
  const eligible = sortRows(compacted)
    .sort(
      (left, right) =>
        OUTBOX_ENTITY_CONTRACT[left.entityType].priority -
        OUTBOX_ENTITY_CONTRACT[right.entityType].priority,
    )
    .filter(
      (row) =>
        row.ownerHash === input.ownerHash &&
        row.state === 'ready' &&
        !leasedIdentities.has(ownerEntityIdentity(row)) &&
        !(
          row.entityType === 'conflict_choice' &&
          row.payload !== null &&
          [row.payload.product_a_id, row.payload.product_b_id].some(
            (productId) =>
              typeof productId === 'string' &&
              pendingShelfEntities.has(`${row.ownerHash}:${productId.toLowerCase()}`),
          )
        ) &&
        row.nextAttemptAt <= input.now,
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
    operationIds?: readonly string[];
    failureClass?: OutboxFailureClass;
    retryAfterMs?: number | null;
    random?: number;
  }>,
): OutboxEnvelope {
  if (!UUID.test(input.leaseOwner) || !canonicalIso(input.now)) fail();
  const resultByOperation = new Map(input.results.map((result) => [result.operationId, result]));
  if (resultByOperation.size !== input.results.length) fail();
  const operationIds = input.operationIds ? new Set(input.operationIds) : null;
  if (
    operationIds &&
    (operationIds.size !== input.operationIds?.length ||
      [...operationIds].some((operationId) => !UUID.test(operationId)) ||
      [...resultByOperation.keys()].some((operationId) => !operationIds.has(operationId)))
  ) {
    fail();
  }
  const random = input.random ?? 0.5;
  const latestRevisionByOwnerEntity = new Map<string, number>(
    envelope.revisions.flatMap((revision) =>
      revision.ownerHash === null
        ? []
        : [[`${revision.ownerHash}:${entityIdentity(revision)}`, revision.revision] as const],
    ),
  );
  const rows = envelope.rows.flatMap((row): OutboxRow[] => {
    if (row.state !== 'leased' || row.leaseOwner !== input.leaseOwner) return [row];
    if (operationIds && !operationIds.has(row.operationId)) return [row];
    if (
      (latestRevisionByOwnerEntity.get(ownerEntityIdentity(row)) ?? row.clientRevision) >
      row.clientRevision
    ) {
      return [];
    }
    const result = resultByOperation.get(row.operationId);
    if (result && ['applied', 'duplicate', 'stale'].includes(result.status)) return [];
    if (result?.status === 'retry') {
      return [
        {
          ...row,
          state: row.attemptCount >= MAX_OUTBOX_ATTEMPTS ? 'dead' : 'ready',
          lastErrorClass: result.errorClass ?? 'dependency',
          nextAttemptAt: retryAt(input.now, row.attemptCount, random, input.retryAfterMs ?? null),
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      ];
    }
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
  const revisions = envelope.revisions.filter((revision) => {
    if (!isImmutableEventEntityType(revision.entityType)) return true;
    return rows.some(
      (row) =>
        row.entityType === revision.entityType &&
        row.entityId === revision.entityId &&
        (revision.ownerHash === null || row.ownerHash === revision.ownerHash),
    );
  });
  return Object.freeze({
    ...envelope,
    rows: Object.freeze(sortRows(rows)),
    revisions: Object.freeze(revisions),
  });
}

function assertOwnerHash(ownerHash: string): void {
  if (!SHA256_HEX.test(ownerHash)) fail();
}

function assertEntityType(entityType: OutboxEntityType): void {
  if (!isOutboxEntityType(entityType)) fail();
}

export function selectOutboxOwnerStatus(
  envelope: OutboxEnvelope,
  input: Readonly<{
    ownerHash: string;
    entityType: OutboxEntityType;
  }>,
): OutboxOwnerStatus {
  assertOwnerHash(input.ownerHash);
  assertEntityType(input.entityType);
  const latestRevisionByOwnerEntity = new Map<string, number>(
    envelope.revisions.flatMap((revision) =>
      revision.ownerHash === null
        ? []
        : [[`${revision.ownerHash}:${entityIdentity(revision)}`, revision.revision] as const],
    ),
  );
  const rows = envelope.rows.filter(
    (row) =>
      row.ownerHash === input.ownerHash &&
      row.entityType === input.entityType &&
      !(
        row.state === 'dead' &&
        (latestRevisionByOwnerEntity.get(ownerEntityIdentity(row)) ?? row.clientRevision) >
          row.clientRevision
      ),
  );
  const attentionCount = rows.filter((row) => row.state === 'dead').length;
  const syncingCount = rows.filter((row) => row.state === 'leased').length;
  const savedCount = rows.filter((row) => row.state === 'ready').length;
  const kind =
    attentionCount > 0
      ? 'needs_attention'
      : syncingCount > 0
        ? 'syncing'
        : savedCount > 0
          ? 'saved_local'
          : 'idle';
  return Object.freeze({
    kind,
    pendingCount: rows.length,
    attentionCount,
  });
}

export function retryDeadOutboxRows(
  envelope: OutboxEnvelope,
  input: Readonly<{
    ownerHash: string;
    entityType: OutboxEntityType;
    now: string;
  }>,
): Readonly<{ envelope: OutboxEnvelope; retried: number }> {
  assertOwnerHash(input.ownerHash);
  assertEntityType(input.entityType);
  if (!canonicalIso(input.now)) fail();

  const latestRevisionByOwnerEntity = new Map<string, number>(
    envelope.revisions.flatMap((revision) =>
      revision.ownerHash === null
        ? []
        : [[`${revision.ownerHash}:${entityIdentity(revision)}`, revision.revision] as const],
    ),
  );
  let retried = 0;
  const rows = envelope.rows.map((row): OutboxRow => {
    if (
      row.ownerHash !== input.ownerHash ||
      row.entityType !== input.entityType ||
      row.state !== 'dead' ||
      (latestRevisionByOwnerEntity.get(ownerEntityIdentity(row)) ?? row.clientRevision) >
        row.clientRevision
    ) {
      return row;
    }
    retried += 1;
    return Object.freeze({
      ...row,
      state: 'ready' as const,
      attemptCount: 0,
      nextAttemptAt: input.now,
      lastErrorClass: null,
      leaseOwner: null,
      leaseExpiresAt: null,
    });
  });
  if (retried === 0) return Object.freeze({ envelope, retried: 0 });
  return Object.freeze({
    envelope: Object.freeze({ ...envelope, rows: Object.freeze(sortRows(rows)) }),
    retried,
  });
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
