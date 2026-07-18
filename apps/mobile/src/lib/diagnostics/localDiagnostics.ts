import {
  OPERATION_TIMING_NAMES,
  STARTUP_PHASE_NAMES,
  type OperationTimingName,
  type StartupPhaseName,
} from '@/lib/observability/operationTiming';

export const LOCAL_DIAGNOSTICS_SCHEMA_VERSION = 2 as const;

export type DiagnosticsAvailability =
  | 'absent'
  | 'available'
  | 'corrupt'
  | 'unavailable'
  | 'unsupported_version';

export type DiagnosticsSyncResult =
  | 'cancelled'
  | 'failed'
  | 'idle'
  | 'not_run'
  | 'pending'
  | 'signed_out'
  | 'synced';

export type DiagnosticsTimingAggregate = Readonly<{
  name: OperationTimingName;
  count: number;
  errorCount: number;
  p50Ms: number;
  p95Ms: number;
}>;

export type DiagnosticsStartupPhase = Readonly<{
  phase: StartupPhaseName;
  elapsedMs: number;
}>;

export type LocalDiagnosticsSnapshot = Readonly<{
  schemaVersion: typeof LOCAL_DIAGNOSTICS_SCHEMA_VERSION;
  capturedAt: string;
  build: Readonly<{
    environment: 'development' | 'staging';
    releaseVersion: string;
    buildVersion: string;
    runtimeVersion: string;
    symbolConfig: 'not_recorded' | 'not_uploaded' | 'uploaded';
  }>;
  accountGenerationPrefix: 'none' | 'unavailable' | string;
  vault: 'locked' | 'ready' | 'unavailable';
  appLock: 'disabled' | 'locked' | 'unavailable' | 'unlocked';
  outbox: Readonly<{
    model: 'transactional_outbox_v1';
    status: DiagnosticsAvailability;
    ready: number;
    inFlight: number;
    dead: number;
  }>;
  lastSync: Readonly<{
    result: DiagnosticsSyncResult;
    at: string | null;
  }>;
  photoJournal: Readonly<{
    status: DiagnosticsAvailability;
    pending: number;
  }>;
  storageFreeSpace: 'ample' | 'critical' | 'low' | 'unavailable';
  queryCache: Readonly<{
    total: number;
    active: number;
    fetching: number;
    stale: number;
  }>;
  notifications: Readonly<{
    permission: 'denied' | 'granted' | 'undetermined' | 'unavailable';
    schedule: 'healthy' | 'mismatch' | 'not_applicable' | 'unavailable';
  }>;
  catalogEndpoint: 'gateway_reachable' | 'gateway_unreachable' | 'not_configured';
  startupPhases: readonly DiagnosticsStartupPhase[];
  timings: readonly DiagnosticsTimingAggregate[];
}>;

type RawBuildDiagnostics = Readonly<{
  environment: unknown;
  releaseVersion: unknown;
  buildVersion: unknown;
  runtimeVersion: unknown;
  symbolConfig: unknown;
}>;

type RawCountDiagnostics = Readonly<{
  status: unknown;
  count: unknown;
}>;

type RawOutboxDiagnostics = Readonly<{
  status: unknown;
  ready: unknown;
  inFlight: unknown;
  dead: unknown;
}>;

type RawQueryCacheDiagnostics = Readonly<{
  total: unknown;
  active: unknown;
  fetching: unknown;
  stale: unknown;
}>;

type RawNotificationDiagnostics = Readonly<{
  permission: unknown;
  schedule: unknown;
}>;

type RawSyncDiagnostics = Readonly<{
  result: unknown;
  at: unknown;
}>;

export type LocalDiagnosticsDependencies = Readonly<{
  now: () => Date;
  readBuild: () => RawBuildDiagnostics;
  readAccountGenerationPrefix: () => Promise<unknown>;
  readVault: () => unknown;
  readAppLock: () => unknown;
  readOutbox: () => Promise<RawOutboxDiagnostics>;
  readLastSync: () => RawSyncDiagnostics;
  readPhotoJournal: () => Promise<RawCountDiagnostics>;
  readStorageFreeSpace: () => unknown;
  readQueryCache: () => RawQueryCacheDiagnostics;
  readNotifications: () => Promise<RawNotificationDiagnostics>;
  readCatalogEndpoint: () => Promise<unknown>;
  readStartupPhases: () => readonly unknown[];
  readTimings: () => readonly unknown[];
}>;

const AVAILABILITY_VALUES = new Set<DiagnosticsAvailability>([
  'absent',
  'available',
  'corrupt',
  'unavailable',
  'unsupported_version',
]);
const SYNC_RESULTS = new Set<DiagnosticsSyncResult>([
  'cancelled',
  'failed',
  'idle',
  'not_run',
  'pending',
  'signed_out',
  'synced',
]);
const TIMING_NAMES = new Set<string>(OPERATION_TIMING_NAMES);
const STARTUP_PHASES = new Set<string>(STARTUP_PHASE_NAMES);
const SAFE_RELEASE_VERSION = /^\d+(?:\.\d+){0,3}(?:[-+][A-Za-z0-9.-]{1,32})?$/;
const SAFE_BUILD_VERSION = /^\d+(?:\.\d+){0,2}$/;
const SAFE_RUNTIME_VERSION =
  /^(?:[a-f0-9]{32,64}|exposdk:\d+(?:\.\d+){1,3}|fingerprint:[a-f0-9]{6,64}|\d+(?:\.\d+){0,3}(?:[-+][A-Za-z0-9.-]{1,32})?)$/i;
const ACCOUNT_GENERATION_PREFIX = /^[a-f0-9]{8}$/;
const MAX_DIAGNOSTIC_COUNT = 1_000_000;
const MAX_DIAGNOSTIC_DURATION_MS = 60 * 60 * 1000;
const DIAGNOSTIC_SOURCE_TIMEOUT_MS = 3_000;

function safeEnum<T extends string>(value: unknown, allowed: ReadonlySet<T>, fallback: T): T {
  return typeof value === 'string' && allowed.has(value as T) ? (value as T) : fallback;
}

function safeCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return 0;
  return Math.min(Math.max(value, 0), MAX_DIAGNOSTIC_COUNT);
}

function safeDuration(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  const bounded = Math.min(Math.max(value, 0), MAX_DIAGNOSTIC_DURATION_MS);
  return Math.round(bounded * 100) / 100;
}

function safeBuildValue(value: unknown, pattern: RegExp): string {
  if (typeof value !== 'string') return 'unknown';
  const candidate = value.trim();
  return candidate.length <= 64 && pattern.test(candidate) ? candidate : 'unknown';
}

function safeIso(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value ? value : null;
}

function safeCapturedAt(now: () => Date): string {
  try {
    const value = now();
    if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  } catch {
    // The fixed epoch remains content-free and makes clock failure explicit.
  }
  return '1970-01-01T00:00:00.000Z';
}

async function isolated<T>(operation: () => T | Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), DIAGNOSTIC_SOURCE_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return fallback;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function normalizeAvailability(value: unknown): DiagnosticsAvailability {
  return safeEnum(value, AVAILABILITY_VALUES, 'unavailable');
}

function normalizeTiming(value: unknown): DiagnosticsTimingAggregate | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.name !== 'string' || !TIMING_NAMES.has(record.name)) return null;
  const count = safeCount(record.count);
  if (count === 0) return null;
  return {
    name: record.name as OperationTimingName,
    count,
    errorCount: Math.min(safeCount(record.errorCount), count),
    p50Ms: safeDuration(record.p50Ms),
    p95Ms: safeDuration(record.p95Ms),
  };
}

function normalizeStartupPhase(value: unknown): DiagnosticsStartupPhase | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.phase !== 'string' || !STARTUP_PHASES.has(record.phase)) return null;
  return {
    phase: record.phase as StartupPhaseName,
    elapsedMs: safeDuration(record.elapsedMs),
  };
}

export function resolveLocalDiagnosticsAccess(development: boolean, environment: unknown): boolean {
  return development && (environment === 'development' || environment === 'staging');
}

export function classifyStorageFreeSpace(
  availableBytes: unknown,
): LocalDiagnosticsSnapshot['storageFreeSpace'] {
  if (
    typeof availableBytes !== 'number' ||
    !Number.isFinite(availableBytes) ||
    availableBytes < 0
  ) {
    return 'unavailable';
  }
  if (availableBytes < 100 * 1024 * 1024) return 'critical';
  if (availableBytes < 500 * 1024 * 1024) return 'low';
  return 'ample';
}

export async function loadLocalDiagnostics(
  deps: LocalDiagnosticsDependencies,
): Promise<LocalDiagnosticsSnapshot> {
  const [
    build,
    accountPrefix,
    vault,
    appLock,
    outbox,
    lastSync,
    photoJournal,
    storageFreeSpace,
    queryCache,
    notifications,
    catalogEndpoint,
    startupPhases,
    timings,
  ] = await Promise.all([
    isolated(deps.readBuild, {
      environment: 'development',
      releaseVersion: 'unknown',
      buildVersion: 'unknown',
      runtimeVersion: 'unknown',
      symbolConfig: 'not_recorded',
    }),
    isolated(deps.readAccountGenerationPrefix, 'unavailable'),
    isolated(deps.readVault, 'unavailable'),
    isolated(deps.readAppLock, 'unavailable'),
    isolated(deps.readOutbox, {
      status: 'unavailable',
      ready: 0,
      inFlight: 0,
      dead: 0,
    }),
    isolated(deps.readLastSync, { result: 'not_run', at: null }),
    isolated(deps.readPhotoJournal, { status: 'unavailable', count: 0 }),
    isolated(deps.readStorageFreeSpace, Number.NaN),
    isolated(deps.readQueryCache, { total: 0, active: 0, fetching: 0, stale: 0 }),
    isolated(deps.readNotifications, { permission: 'unavailable', schedule: 'unavailable' }),
    isolated(deps.readCatalogEndpoint, 'gateway_unreachable'),
    isolated(deps.readStartupPhases, []),
    isolated(deps.readTimings, []),
  ]);

  const buildRecord = build as RawBuildDiagnostics;
  const rawOutbox = outbox as RawOutboxDiagnostics;
  const rawSync = lastSync as RawSyncDiagnostics;
  const rawPhotoJournal = photoJournal as RawCountDiagnostics;
  const rawQueryCache = queryCache as RawQueryCacheDiagnostics;
  const rawNotifications = notifications as RawNotificationDiagnostics;
  const normalizedTimings = Array.isArray(timings)
    ? timings.flatMap((timing) => {
        const normalized = normalizeTiming(timing);
        return normalized ? [normalized] : [];
      })
    : [];
  const normalizedStartupByPhase = new Map<StartupPhaseName, DiagnosticsStartupPhase>();
  if (Array.isArray(startupPhases)) {
    for (const value of startupPhases) {
      const normalized = normalizeStartupPhase(value);
      if (normalized && !normalizedStartupByPhase.has(normalized.phase)) {
        normalizedStartupByPhase.set(normalized.phase, normalized);
      }
    }
  }

  return {
    schemaVersion: LOCAL_DIAGNOSTICS_SCHEMA_VERSION,
    capturedAt: safeCapturedAt(deps.now),
    build: {
      environment: buildRecord.environment === 'staging' ? 'staging' : 'development',
      releaseVersion: safeBuildValue(buildRecord.releaseVersion, SAFE_RELEASE_VERSION),
      buildVersion: safeBuildValue(buildRecord.buildVersion, SAFE_BUILD_VERSION),
      runtimeVersion: safeBuildValue(buildRecord.runtimeVersion, SAFE_RUNTIME_VERSION),
      symbolConfig: safeEnum(
        buildRecord.symbolConfig,
        new Set(['not_recorded', 'not_uploaded', 'uploaded'] as const),
        'not_recorded',
      ),
    },
    accountGenerationPrefix:
      accountPrefix === 'none'
        ? 'none'
        : typeof accountPrefix === 'string' && ACCOUNT_GENERATION_PREFIX.test(accountPrefix)
          ? accountPrefix
          : 'unavailable',
    vault: safeEnum(vault, new Set(['locked', 'ready', 'unavailable'] as const), 'unavailable'),
    appLock: safeEnum(
      appLock,
      new Set(['disabled', 'locked', 'unavailable', 'unlocked'] as const),
      'unavailable',
    ),
    outbox: {
      model: 'transactional_outbox_v1',
      status: normalizeAvailability(rawOutbox.status),
      ready: safeCount(rawOutbox.ready),
      inFlight: safeCount(rawOutbox.inFlight),
      dead: safeCount(rawOutbox.dead),
    },
    lastSync: {
      result: safeEnum(rawSync.result, SYNC_RESULTS, 'not_run'),
      at: safeIso(rawSync.at),
    },
    photoJournal: {
      status: normalizeAvailability(rawPhotoJournal.status),
      pending: safeCount(rawPhotoJournal.count),
    },
    storageFreeSpace: classifyStorageFreeSpace(storageFreeSpace),
    queryCache: {
      total: safeCount(rawQueryCache.total),
      active: safeCount(rawQueryCache.active),
      fetching: safeCount(rawQueryCache.fetching),
      stale: safeCount(rawQueryCache.stale),
    },
    notifications: {
      permission: safeEnum(
        rawNotifications.permission,
        new Set(['denied', 'granted', 'undetermined', 'unavailable'] as const),
        'unavailable',
      ),
      schedule: safeEnum(
        rawNotifications.schedule,
        new Set(['healthy', 'mismatch', 'not_applicable', 'unavailable'] as const),
        'unavailable',
      ),
    },
    catalogEndpoint: safeEnum(
      catalogEndpoint,
      new Set(['gateway_reachable', 'gateway_unreachable', 'not_configured'] as const),
      'gateway_unreachable',
    ),
    startupPhases: STARTUP_PHASE_NAMES.flatMap((phase) => {
      const sample = normalizedStartupByPhase.get(phase);
      return sample ? [sample] : [];
    }),
    timings: normalizedTimings,
  };
}
