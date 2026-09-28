import { HEALTH_PROCESSING_STATUS_LEASE_MS } from '@/lib/consent/healthProcessingEpoch';

export const ROUTINE_WIDGET_NAME = 'LayerwellToday';
export const ROUTINE_LIVE_ACTIVITY_NAME = 'LayerwellEvening';
export const ROUTINE_WIDGET_TODAY_DEEP_LINKS = {
  development: 'layerwell-development://today',
  staging: 'layerwell-staging://today',
  production: 'layerwell://today',
} as const;
export const ROUTINE_WIDGET_TODAY_DEEP_LINK = ROUTINE_WIDGET_TODAY_DEEP_LINKS.production;
export const ROUTINE_WIDGET_CHECK_OFF_TARGET = 'widget-action:complete-next' as const;
export const ROUTINE_WIDGET_SCHEMA_VERSION = 2 as const;
export const ROUTINE_WIDGET_MAX_STEPS = 32;

export type RoutineWidgetAppVariant = keyof typeof ROUTINE_WIDGET_TODAY_DEEP_LINKS;
export type RoutineWidgetTodayDeepLink =
  (typeof ROUTINE_WIDGET_TODAY_DEEP_LINKS)[RoutineWidgetAppVariant];

export type RoutineWidgetPhase = 'AM' | 'PM' | 'none';
export type RoutineWidgetStatus = 'disabled' | 'empty' | 'ready' | 'complete' | 'stale';

/**
 * The only data copied into the App Group. Tokens are random capabilities whose
 * step-key mapping stays in encrypted private storage. Product/user identifiers,
 * product names, profile answers, conflicts, photos, and health details are not
 * part of this contract.
 */
export type RoutineWidgetProps = {
  schemaVersion: typeof ROUTINE_WIDGET_SCHEMA_VERSION;
  ownerGeneration: string;
  snapshotNonce: string;
  status: RoutineWidgetStatus;
  phase: RoutineWidgetPhase;
  localDate: string;
  completedCount: number;
  totalCount: number;
  actionTokens: string[];
  pendingActionTokens: string[];
  interactionRevision: number;
  deepLink: RoutineWidgetTodayDeepLink;
  updatedAtMs: number;
  staleAtMs: number;
};

export type RoutineLiveActivityProps = {
  schemaVersion: typeof ROUTINE_WIDGET_SCHEMA_VERSION;
  ownerGeneration: string;
  snapshotNonce: string;
  status: 'in_progress' | 'complete' | 'stale';
  completedCount: number;
  totalCount: number;
  updatedAtMs: number;
  staleAtMs: number;
};

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXPECTED_KEYS = [
  'actionTokens',
  'completedCount',
  'deepLink',
  'interactionRevision',
  'localDate',
  'ownerGeneration',
  'pendingActionTokens',
  'phase',
  'schemaVersion',
  'snapshotNonce',
  'staleAtMs',
  'status',
  'totalCount',
  'updatedAtMs',
].sort();
const LIVE_ACTIVITY_EXPECTED_KEYS = [
  'completedCount',
  'ownerGeneration',
  'schemaVersion',
  'snapshotNonce',
  'staleAtMs',
  'status',
  'totalCount',
  'updatedAtMs',
].sort();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLocalDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (!DATE_RE.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function isSafeTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isBoundedInteger(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max;
}

function normalizedTokens(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > ROUTINE_WIDGET_MAX_STEPS) return null;
  const tokens: string[] = [];
  for (const candidate of value) {
    if (
      typeof candidate !== 'string' ||
      candidate !== candidate.toLowerCase() ||
      !TOKEN_RE.test(candidate)
    ) {
      return null;
    }
    if (tokens.includes(candidate)) return null;
    tokens.push(candidate);
  }
  return tokens;
}

export function normalizeRoutineWidgetOpaqueUuid(value: unknown): string | null {
  return typeof value === 'string' && value === value.toLowerCase() && TOKEN_RE.test(value)
    ? value
    : null;
}

export function isRoutineWidgetDeepLink(value: unknown): value is RoutineWidgetTodayDeepLink {
  return (
    value === ROUTINE_WIDGET_TODAY_DEEP_LINKS.development ||
    value === ROUTINE_WIDGET_TODAY_DEEP_LINKS.staging ||
    value === ROUTINE_WIDGET_TODAY_DEEP_LINKS.production
  );
}

export function routineWidgetTodayDeepLinkForVariant(
  value: unknown,
): RoutineWidgetTodayDeepLink | null {
  if (value === 'development' || value === 'staging' || value === 'production') {
    return ROUTINE_WIDGET_TODAY_DEEP_LINKS[value];
  }
  return null;
}

/** Decode App Group bytes as untrusted input and reject unknown fields. */
export function normalizeRoutineWidgetProps(value: unknown): RoutineWidgetProps | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value).sort();
  if (
    keys.length !== EXPECTED_KEYS.length ||
    keys.some((key, index) => key !== EXPECTED_KEYS[index])
  ) {
    return null;
  }
  if (value.schemaVersion !== ROUTINE_WIDGET_SCHEMA_VERSION) return null;
  const ownerGeneration = normalizeRoutineWidgetOpaqueUuid(value.ownerGeneration);
  const snapshotNonce = normalizeRoutineWidgetOpaqueUuid(value.snapshotNonce);
  if (!ownerGeneration || !snapshotNonce || ownerGeneration === snapshotNonce) return null;
  if (
    typeof value.status !== 'string' ||
    !['disabled', 'empty', 'ready', 'complete', 'stale'].includes(value.status)
  ) {
    return null;
  }
  if (typeof value.phase !== 'string' || !['AM', 'PM', 'none'].includes(value.phase)) return null;
  if (!isLocalDate(value.localDate) || !isRoutineWidgetDeepLink(value.deepLink)) return null;
  if (
    !isBoundedInteger(value.completedCount, ROUTINE_WIDGET_MAX_STEPS) ||
    !isBoundedInteger(value.totalCount, ROUTINE_WIDGET_MAX_STEPS) ||
    value.completedCount > value.totalCount ||
    !isBoundedInteger(value.interactionRevision, 10_000) ||
    !isSafeTimestamp(value.updatedAtMs) ||
    !isSafeTimestamp(value.staleAtMs) ||
    value.staleAtMs <= value.updatedAtMs ||
    value.staleAtMs - value.updatedAtMs > HEALTH_PROCESSING_STATUS_LEASE_MS
  ) {
    return null;
  }
  const actionTokens = normalizedTokens(value.actionTokens);
  const pendingActionTokens = normalizedTokens(value.pendingActionTokens);
  if (!actionTokens || !pendingActionTokens) return null;
  if (actionTokens.length + pendingActionTokens.length > ROUTINE_WIDGET_MAX_STEPS) return null;
  if (actionTokens.some((token) => pendingActionTokens.includes(token))) return null;

  const status = value.status as RoutineWidgetStatus;
  const phase = value.phase as RoutineWidgetPhase;
  const completedCount = value.completedCount;
  const totalCount = value.totalCount;
  if (status === 'empty' && (completedCount !== 0 || totalCount !== 0 || actionTokens.length > 0)) {
    return null;
  }
  if (
    (status === 'disabled' || status === 'stale') &&
    (phase !== 'none' || completedCount !== 0 || totalCount !== 0 || actionTokens.length > 0)
  ) {
    return null;
  }
  if (
    status === 'ready' &&
    (phase === 'none' || totalCount === 0 || completedCount >= totalCount)
  ) {
    return null;
  }
  if (
    status === 'complete' &&
    (phase === 'none' ||
      totalCount === 0 ||
      completedCount !== totalCount ||
      actionTokens.length > 0)
  ) {
    return null;
  }
  if (
    (status === 'ready' || status === 'complete') &&
    actionTokens.length !== totalCount - completedCount
  ) {
    return null;
  }
  if (
    (status === 'ready' || status === 'complete') &&
    pendingActionTokens.length > completedCount
  ) {
    return null;
  }

  return {
    schemaVersion: ROUTINE_WIDGET_SCHEMA_VERSION,
    ownerGeneration,
    snapshotNonce,
    status,
    phase,
    localDate: value.localDate,
    completedCount,
    totalCount,
    actionTokens,
    pendingActionTokens,
    interactionRevision: value.interactionRevision,
    deepLink: value.deepLink,
    updatedAtMs: value.updatedAtMs,
    staleAtMs: value.staleAtMs,
  };
}

export function createRoutineWidgetProps(input: {
  ownerGeneration: string;
  snapshotNonce: string;
  status?: 'disabled' | 'empty' | 'stale';
  phase?: Exclude<RoutineWidgetPhase, 'none'>;
  localDate: string;
  completedCount?: number;
  totalCount?: number;
  actionTokens?: readonly string[];
  deepLink: RoutineWidgetTodayDeepLink;
  updatedAtMs: number;
  staleAtMs: number;
}): RoutineWidgetProps {
  const completedCount = input.completedCount ?? 0;
  const totalCount = input.totalCount ?? 0;
  const actionTokens = [...(input.actionTokens ?? [])];
  const derivedStatus: RoutineWidgetStatus =
    input.status ??
    (totalCount === 0 ? 'empty' : completedCount === totalCount ? 'complete' : 'ready');
  const candidate: RoutineWidgetProps = {
    schemaVersion: ROUTINE_WIDGET_SCHEMA_VERSION,
    ownerGeneration: input.ownerGeneration,
    snapshotNonce: input.snapshotNonce,
    status: derivedStatus,
    phase:
      derivedStatus === 'disabled' || derivedStatus === 'stale' ? 'none' : (input.phase ?? 'AM'),
    localDate: input.localDate,
    completedCount: derivedStatus === 'disabled' || derivedStatus === 'stale' ? 0 : completedCount,
    totalCount: derivedStatus === 'disabled' || derivedStatus === 'stale' ? 0 : totalCount,
    actionTokens: derivedStatus === 'disabled' || derivedStatus === 'stale' ? [] : actionTokens,
    pendingActionTokens: [],
    interactionRevision: 0,
    deepLink: input.deepLink,
    updatedAtMs: input.updatedAtMs,
    staleAtMs: input.staleAtMs,
  };
  const normalized = normalizeRoutineWidgetProps(candidate);
  if (!normalized) throw new Error('ROUTINE_WIDGET_PROPS_INVALID');
  return normalized;
}

export function pendingRoutineWidgetActionTokens(
  entries: readonly { props?: unknown }[],
): string[] {
  const tokens: string[] = [];
  for (const entry of entries) {
    const props = normalizeRoutineWidgetProps(entry.props);
    if (!props) continue;
    for (const token of props.pendingActionTokens) {
      if (!tokens.includes(token)) tokens.push(token);
    }
  }
  return tokens;
}

/**
 * Mirrors the killed-app AppIntent transition used by the iOS widget. A
 * pending token is an outbox entry, so it is intentionally independent from
 * the remaining-action invariant.
 */
export function applyRoutineWidgetOptimisticCheckOff(
  value: unknown,
  pressedAtMs: number,
): RoutineWidgetProps | null {
  const props = normalizeRoutineWidgetProps(value);
  if (!props || !isSafeTimestamp(pressedAtMs)) return null;
  if (props.status !== 'ready') return props;

  if (pressedAtMs < props.updatedAtMs || pressedAtMs >= props.staleAtMs) {
    return normalizeRoutineWidgetProps({
      schemaVersion: ROUTINE_WIDGET_SCHEMA_VERSION,
      ownerGeneration: props.ownerGeneration,
      snapshotNonce: props.snapshotNonce,
      status: 'stale',
      phase: 'none',
      localDate: props.localDate,
      completedCount: 0,
      totalCount: 0,
      actionTokens: [],
      pendingActionTokens: props.pendingActionTokens,
      interactionRevision: props.interactionRevision,
      deepLink: props.deepLink,
      updatedAtMs: props.updatedAtMs,
      staleAtMs: props.staleAtMs,
    });
  }

  const nextToken = props.actionTokens[0];
  if (!nextToken) return null;
  const completedCount = props.completedCount + 1;
  return normalizeRoutineWidgetProps({
    schemaVersion: ROUTINE_WIDGET_SCHEMA_VERSION,
    ownerGeneration: props.ownerGeneration,
    snapshotNonce: props.snapshotNonce,
    status: completedCount === props.totalCount ? 'complete' : 'ready',
    phase: props.phase,
    localDate: props.localDate,
    completedCount,
    totalCount: props.totalCount,
    actionTokens: props.actionTokens.slice(1),
    pendingActionTokens: [...props.pendingActionTokens, nextToken],
    interactionRevision: props.interactionRevision + 1,
    deepLink: props.deepLink,
    updatedAtMs: pressedAtMs,
    staleAtMs: props.staleAtMs,
  });
}

/** Decode Live Activity state as untrusted input and reject unknown fields. */
export function normalizeRoutineLiveActivityProps(value: unknown): RoutineLiveActivityProps | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value).sort();
  if (
    keys.length !== LIVE_ACTIVITY_EXPECTED_KEYS.length ||
    keys.some((key, index) => key !== LIVE_ACTIVITY_EXPECTED_KEYS[index])
  ) {
    return null;
  }
  if (value.schemaVersion !== ROUTINE_WIDGET_SCHEMA_VERSION) return null;
  const ownerGeneration = normalizeRoutineWidgetOpaqueUuid(value.ownerGeneration);
  const snapshotNonce = normalizeRoutineWidgetOpaqueUuid(value.snapshotNonce);
  if (!ownerGeneration || !snapshotNonce || ownerGeneration === snapshotNonce) return null;
  if (
    typeof value.status !== 'string' ||
    !['in_progress', 'complete', 'stale'].includes(value.status)
  ) {
    return null;
  }
  if (
    !isBoundedInteger(value.completedCount, ROUTINE_WIDGET_MAX_STEPS) ||
    !isBoundedInteger(value.totalCount, ROUTINE_WIDGET_MAX_STEPS) ||
    value.completedCount > value.totalCount ||
    !isSafeTimestamp(value.updatedAtMs) ||
    !isSafeTimestamp(value.staleAtMs) ||
    value.staleAtMs <= value.updatedAtMs ||
    value.staleAtMs - value.updatedAtMs > HEALTH_PROCESSING_STATUS_LEASE_MS
  ) {
    return null;
  }
  if (value.status === 'stale' && (value.completedCount !== 0 || value.totalCount !== 0)) {
    return null;
  }
  if (
    value.status === 'in_progress' &&
    (value.totalCount === 0 || value.completedCount >= value.totalCount)
  ) {
    return null;
  }
  if (
    value.status === 'complete' &&
    (value.totalCount === 0 || value.completedCount !== value.totalCount)
  ) {
    return null;
  }

  return {
    schemaVersion: ROUTINE_WIDGET_SCHEMA_VERSION,
    ownerGeneration,
    snapshotNonce,
    status: value.status as RoutineLiveActivityProps['status'],
    completedCount: value.completedCount,
    totalCount: value.totalCount,
    updatedAtMs: value.updatedAtMs,
    staleAtMs: value.staleAtMs,
  };
}

export function routineLiveActivityProps(
  props: RoutineWidgetProps,
  nowMs: number,
): RoutineLiveActivityProps | null {
  if (!isSafeTimestamp(nowMs) || props.phase !== 'PM' || props.totalCount === 0) return null;
  const stale = nowMs < props.updatedAtMs || nowMs >= props.staleAtMs;
  const status = stale
    ? 'stale'
    : props.completedCount === props.totalCount
      ? 'complete'
      : 'in_progress';
  return normalizeRoutineLiveActivityProps({
    schemaVersion: ROUTINE_WIDGET_SCHEMA_VERSION,
    ownerGeneration: props.ownerGeneration,
    snapshotNonce: props.snapshotNonce,
    status,
    completedCount: stale ? 0 : props.completedCount,
    totalCount: stale ? 0 : props.totalCount,
    updatedAtMs: props.updatedAtMs,
    staleAtMs: props.staleAtMs,
  });
}
