import {
  normalizeRoutineWidgetOpaqueUuid,
  normalizeRoutineWidgetProps,
  type RoutineWidgetProps,
} from './contract';

export const ROUTINE_WIDGET_NATIVE_LIFECYCLE_VERSION = 1 as const;
export const ROUTINE_WIDGET_NATIVE_JSON_MAX_BYTES = 64 * 1024;
export const ROUTINE_WIDGET_NATIVE_UNAVAILABLE = 'ROUTINE_WIDGET_NATIVE_UNAVAILABLE';
export const ROUTINE_WIDGET_NATIVE_RESPONSE_INVALID = 'ROUTINE_WIDGET_NATIVE_RESPONSE_INVALID';

const AUTHORITY_KEYS = ['authorityNonce', 'enabled', 'ownerGeneration', 'schemaVersion'].sort();
const OUTBOX_KEYS = ['authorityNonce', 'records', 'schemaVersion'].sort();
const OUTBOX_RECORD_KEYS = [
  'actionToken',
  'createdAtMs',
  'localDate',
  'ownerGeneration',
  'phase',
  'revision',
  'snapshotNonce',
  'staleAtMs',
].sort();
const CLEANUP_KEYS = ['authority', 'endedActivities', 'schemaVersion'].sort();
const CLOSE_ADMISSION_KEYS = ['schemaVersion', 'status'].sort();
const PUBLICATION_KEYS = ['status'];
const QUIESCENCE_KEYS = [
  'outbox',
  'ownerGeneration',
  'quiescenceNonce',
  'schemaVersion',
  'status',
].sort();
const RECONCILIATION_KEYS = ['status'];
const TIMELINE_ENTRY_KEYS = ['props', 'timestamp'];
const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/u;

export type RoutineWidgetNativeAuthority = Readonly<{
  schemaVersion: typeof ROUTINE_WIDGET_NATIVE_LIFECYCLE_VERSION;
  authorityNonce: string;
  enabled: boolean;
  ownerGeneration: string | null;
}>;

export type RoutineWidgetNativeOutboxRecord = Readonly<{
  actionToken: string;
  createdAtMs: number;
  localDate: string;
  ownerGeneration: string;
  phase: 'AM' | 'PM';
  revision: number;
  snapshotNonce: string;
  staleAtMs: number;
}>;

export type RoutineWidgetNativeOutbox = Readonly<{
  schemaVersion: typeof ROUTINE_WIDGET_NATIVE_LIFECYCLE_VERSION;
  authorityNonce: string;
  records: readonly RoutineWidgetNativeOutboxRecord[];
}>;

export type RoutineWidgetNativeCleanupResult = Readonly<{
  status: 'cleared' | 'not_configured';
  authority: RoutineWidgetNativeAuthority | null;
  endedActivities: number;
}>;

export type RoutineWidgetNativeAdmissionResult = Readonly<{
  status: 'closed' | 'not_configured';
}>;

export type RoutineWidgetNativePublicationResult = Readonly<{
  status: 'outbox_pending' | 'published';
}>;

export type RoutineWidgetNativeQuiescenceResult =
  | Readonly<{
      status: 'quiesced';
      outbox: RoutineWidgetNativeOutbox;
      ownerGeneration: string;
      quiescenceNonce: string;
    }>
  | Readonly<{
      status: 'not_configured';
      outbox: null;
    }>;

export type RoutineWidgetNativeReconciliationResult = Readonly<{
  status: 'committed' | 'redacted';
}>;

export type RoutineWidgetTimelineEntry = Readonly<{
  timestamp: number;
  props: RoutineWidgetProps;
}>;

function invalid(): never {
  throw new Error(ROUTINE_WIDGET_NATIVE_RESPONSE_INVALID);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === keys[index]);
}

function safeInteger(value: unknown, { positive = false } = {}): value is number {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && (positive ? value > 0 : value >= 0)
  );
}

function localDate(value: unknown): value is string {
  if (typeof value !== 'string' || !LOCAL_DATE_RE.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}

function parseJSON(json: unknown): unknown {
  if (
    typeof json !== 'string' ||
    new TextEncoder().encode(json).byteLength > ROUTINE_WIDGET_NATIVE_JSON_MAX_BYTES
  ) {
    invalid();
  }
  try {
    return JSON.parse(json);
  } catch {
    invalid();
  }
}

export function decodeRoutineWidgetNativeAuthority(value: unknown): RoutineWidgetNativeAuthority {
  if (!isRecord(value) || !exactKeys(value, AUTHORITY_KEYS)) invalid();
  const authorityNonce = normalizeRoutineWidgetOpaqueUuid(value.authorityNonce);
  const ownerGeneration =
    value.ownerGeneration === null ? null : normalizeRoutineWidgetOpaqueUuid(value.ownerGeneration);
  if (
    value.schemaVersion !== ROUTINE_WIDGET_NATIVE_LIFECYCLE_VERSION ||
    !authorityNonce ||
    typeof value.enabled !== 'boolean' ||
    (value.ownerGeneration !== null && !ownerGeneration) ||
    (value.enabled && ownerGeneration === null) ||
    (!value.enabled && ownerGeneration !== null) ||
    authorityNonce === ownerGeneration
  ) {
    invalid();
  }
  return Object.freeze({
    schemaVersion: ROUTINE_WIDGET_NATIVE_LIFECYCLE_VERSION,
    authorityNonce,
    enabled: value.enabled,
    ownerGeneration,
  });
}

export function decodeRoutineWidgetNativeAuthorityJSON(
  json: unknown,
): RoutineWidgetNativeAuthority {
  return decodeRoutineWidgetNativeAuthority(parseJSON(json));
}

export function decodeRoutineWidgetNativeOutboxJSON(json: unknown): RoutineWidgetNativeOutbox {
  const value = parseJSON(json);
  if (!isRecord(value) || !exactKeys(value, OUTBOX_KEYS)) invalid();
  const authorityNonce = normalizeRoutineWidgetOpaqueUuid(value.authorityNonce);
  if (
    value.schemaVersion !== ROUTINE_WIDGET_NATIVE_LIFECYCLE_VERSION ||
    !authorityNonce ||
    !Array.isArray(value.records) ||
    value.records.length > 32
  ) {
    invalid();
  }
  const identities = new Set<string>();
  let priorRevision = 0;
  const records = value.records.map((candidate): RoutineWidgetNativeOutboxRecord => {
    if (!isRecord(candidate) || !exactKeys(candidate, OUTBOX_RECORD_KEYS)) invalid();
    const actionToken = normalizeRoutineWidgetOpaqueUuid(candidate.actionToken);
    const ownerGeneration = normalizeRoutineWidgetOpaqueUuid(candidate.ownerGeneration);
    const snapshotNonce = normalizeRoutineWidgetOpaqueUuid(candidate.snapshotNonce);
    if (
      !actionToken ||
      !ownerGeneration ||
      !snapshotNonce ||
      ownerGeneration === snapshotNonce ||
      !safeInteger(candidate.createdAtMs) ||
      !safeInteger(candidate.staleAtMs, { positive: true }) ||
      candidate.createdAtMs >= candidate.staleAtMs ||
      !safeInteger(candidate.revision, { positive: true }) ||
      candidate.revision > 10_000 ||
      candidate.revision <= priorRevision ||
      !localDate(candidate.localDate) ||
      (candidate.phase !== 'AM' && candidate.phase !== 'PM')
    ) {
      invalid();
    }
    const identity = `${ownerGeneration}\u0000${snapshotNonce}\u0000${actionToken}`;
    if (identities.has(identity)) invalid();
    identities.add(identity);
    priorRevision = candidate.revision;
    return Object.freeze({
      actionToken,
      createdAtMs: candidate.createdAtMs,
      localDate: candidate.localDate,
      ownerGeneration,
      phase: candidate.phase,
      revision: candidate.revision,
      snapshotNonce,
      staleAtMs: candidate.staleAtMs,
    });
  });
  return Object.freeze({
    schemaVersion: ROUTINE_WIDGET_NATIVE_LIFECYCLE_VERSION,
    authorityNonce,
    records: Object.freeze(records),
  });
}

export function decodeRoutineWidgetNativeCleanupJSON(
  json: unknown,
): RoutineWidgetNativeCleanupResult {
  const value = parseJSON(json);
  if (
    !isRecord(value) ||
    !exactKeys(value, CLEANUP_KEYS) ||
    value.schemaVersion !== ROUTINE_WIDGET_NATIVE_LIFECYCLE_VERSION ||
    !safeInteger(value.endedActivities)
  ) {
    invalid();
  }
  const authority = decodeRoutineWidgetNativeAuthority(value.authority);
  if (authority.enabled) invalid();
  return Object.freeze({
    status: 'cleared',
    authority,
    endedActivities: value.endedActivities,
  });
}

export function decodeRoutineWidgetNativeCloseAdmissionJSON(
  json: unknown,
): RoutineWidgetNativeAdmissionResult {
  const value = parseJSON(json);
  if (
    !isRecord(value) ||
    !exactKeys(value, CLOSE_ADMISSION_KEYS) ||
    value.schemaVersion !== ROUTINE_WIDGET_NATIVE_LIFECYCLE_VERSION ||
    value.status !== 'closed'
  ) {
    invalid();
  }
  return Object.freeze({ status: 'closed' });
}

export function decodeRoutineWidgetNativePublicationJSON(
  json: unknown,
): RoutineWidgetNativePublicationResult {
  const value = parseJSON(json);
  if (
    !isRecord(value) ||
    !exactKeys(value, PUBLICATION_KEYS) ||
    (value.status !== 'published' && value.status !== 'outbox_pending')
  ) {
    invalid();
  }
  return Object.freeze({ status: value.status });
}

export function decodeRoutineWidgetNativeQuiescenceJSON(
  json: unknown,
  expectedAuthorityNonceValue: unknown,
  expectedOwnerGenerationValue: unknown,
): RoutineWidgetNativeQuiescenceResult {
  const value = parseJSON(json);
  if (
    !isRecord(value) ||
    !exactKeys(value, QUIESCENCE_KEYS) ||
    value.schemaVersion !== ROUTINE_WIDGET_NATIVE_LIFECYCLE_VERSION ||
    value.status !== 'quiesced'
  ) {
    invalid();
  }
  let outbox: RoutineWidgetNativeOutbox;
  try {
    outbox = decodeRoutineWidgetNativeOutboxJSON(JSON.stringify(value.outbox));
  } catch {
    invalid();
  }
  const expectedAuthorityNonce = normalizeRoutineWidgetOpaqueUuid(expectedAuthorityNonceValue);
  const expectedOwnerGeneration = normalizeRoutineWidgetOpaqueUuid(expectedOwnerGenerationValue);
  const ownerGeneration = normalizeRoutineWidgetOpaqueUuid(value.ownerGeneration);
  const quiescenceNonce = normalizeRoutineWidgetOpaqueUuid(value.quiescenceNonce);
  if (
    expectedAuthorityNonce === null ||
    expectedOwnerGeneration === null ||
    ownerGeneration !== expectedOwnerGeneration ||
    quiescenceNonce === null ||
    outbox.authorityNonce !== expectedAuthorityNonce ||
    expectedAuthorityNonce === expectedOwnerGeneration ||
    quiescenceNonce === expectedAuthorityNonce ||
    quiescenceNonce === expectedOwnerGeneration ||
    outbox.records.some((record) => record.ownerGeneration !== expectedOwnerGeneration)
  ) {
    invalid();
  }
  return Object.freeze({ status: 'quiesced', outbox, ownerGeneration, quiescenceNonce });
}

export function decodeRoutineWidgetNativeReconciliationJSON(
  json: unknown,
): RoutineWidgetNativeReconciliationResult {
  const value = parseJSON(json);
  if (
    !isRecord(value) ||
    !exactKeys(value, RECONCILIATION_KEYS) ||
    (value.status !== 'committed' && value.status !== 'redacted')
  ) {
    invalid();
  }
  return Object.freeze({ status: value.status });
}

export function encodeRoutineWidgetNativeTimeline(
  entries: readonly RoutineWidgetTimelineEntry[],
): string {
  if (entries.length !== 2) invalid();
  const normalized = entries.map((entry) => {
    if (
      !isRecord(entry) ||
      !exactKeys(entry, TIMELINE_ENTRY_KEYS) ||
      !safeInteger(entry.timestamp)
    ) {
      invalid();
    }
    const props = normalizeRoutineWidgetProps(entry.props);
    if (!props) invalid();
    return { timestamp: entry.timestamp, props };
  });
  const [current, stale] = normalized;
  if (
    current.timestamp !== current.props.updatedAtMs ||
    stale.timestamp !== current.props.staleAtMs ||
    current.props.interactionRevision !== 0 ||
    current.props.pendingActionTokens.length !== 0 ||
    current.props.status === 'disabled' ||
    current.props.status === 'stale' ||
    stale.props.status !== 'stale' ||
    stale.props.ownerGeneration !== current.props.ownerGeneration ||
    stale.props.snapshotNonce !== current.props.snapshotNonce ||
    stale.props.localDate !== current.props.localDate ||
    stale.props.deepLink !== current.props.deepLink ||
    stale.props.updatedAtMs !== current.props.updatedAtMs ||
    stale.props.staleAtMs !== current.props.staleAtMs ||
    stale.props.interactionRevision !== 0 ||
    stale.props.pendingActionTokens.length !== 0
  ) {
    invalid();
  }
  const json = JSON.stringify(normalized);
  if (new TextEncoder().encode(json).byteLength > ROUTINE_WIDGET_NATIVE_JSON_MAX_BYTES) invalid();
  return json;
}

export function encodeRoutineWidgetNativeReconciliation(input: {
  acceptedTokens: readonly string[];
  expectedAuthorityNonce: string;
  expectedRevision: number;
  ownerGeneration: string;
  snapshotNonce: string;
}): string {
  const expectedAuthorityNonce = normalizeRoutineWidgetOpaqueUuid(input.expectedAuthorityNonce);
  const ownerGeneration = normalizeRoutineWidgetOpaqueUuid(input.ownerGeneration);
  const snapshotNonce = normalizeRoutineWidgetOpaqueUuid(input.snapshotNonce);
  const acceptedTokens = input.acceptedTokens.map(normalizeRoutineWidgetOpaqueUuid);
  if (
    !expectedAuthorityNonce ||
    !ownerGeneration ||
    !snapshotNonce ||
    ownerGeneration === snapshotNonce ||
    !safeInteger(input.expectedRevision, { positive: true }) ||
    input.expectedRevision > 10_000 ||
    acceptedTokens.some((token) => token === null) ||
    new Set(acceptedTokens).size !== acceptedTokens.length ||
    acceptedTokens.length > 32
  ) {
    invalid();
  }
  return JSON.stringify({
    acceptedTokens,
    expectedAuthorityNonce,
    expectedRevision: input.expectedRevision,
    ownerGeneration,
    snapshotNonce,
  });
}

export function encodeRoutineWidgetNativeQuiescedReconciliation(input: {
  acceptedTokens: readonly string[];
  expectedAuthorityNonce: string;
  expectedRevision: number;
  ownerGeneration: string;
  quiescenceNonce: string;
  snapshotNonce: string;
}): string {
  const base = JSON.parse(encodeRoutineWidgetNativeReconciliation(input)) as Record<
    string,
    unknown
  >;
  const quiescenceNonce = normalizeRoutineWidgetOpaqueUuid(input.quiescenceNonce);
  if (
    quiescenceNonce === null ||
    quiescenceNonce === base.expectedAuthorityNonce ||
    quiescenceNonce === base.ownerGeneration ||
    quiescenceNonce === base.snapshotNonce
  ) {
    invalid();
  }
  return JSON.stringify({ ...base, quiescenceNonce });
}
