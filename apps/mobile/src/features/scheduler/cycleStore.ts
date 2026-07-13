import type { CycleVariant, DisruptionReason } from '@onskin/types';

import { getCycleAnchor } from '@/features/routine/cycleAnchor';
import { localDateString } from '@/features/today/useToday';
import {
  runAccountGenerationOperation,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { getPrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';

import {
  customCycleProductIds,
  normalizeCustomCycleDefinition,
  type CustomCycleDefinition,
} from './customCycle';
import { addDays } from './projection';

// Local-first cycle configuration (docs/05 sections 3 and 7). The generated
// per-night schedule remains derived from the shelf; this store holds only the
// user's persistent choices and disruption state on top of that schedule.
const KEY = 'routinekind.cycle.v2';
const LEGACY_KEY = 'onskin.cycle.v1';
const CYCLE_CONFIG_SCHEMA_VERSION = 1 as const;

export const CYCLE_CONFIG_INVALID = 'CYCLE_CONFIG_INVALID';
export const CYCLE_CONFIG_UNSUPPORTED_VERSION = 'CYCLE_CONFIG_UNSUPPORTED_VERSION';
export const CYCLE_CONFIG_UNAVAILABLE = 'CYCLE_CONFIG_UNAVAILABLE';

export type RecoveryReason = Extract<DisruptionReason, 'procedure' | 'irritation'>;

export type RecoveryState = {
  startISO: string;
  days: number;
  reason: RecoveryReason;
};

export type CycleConfig = {
  schemaVersion: typeof CYCLE_CONFIG_SCHEMA_VERSION;
  /** 'auto' picks the variant from the profile; otherwise this is the user's choice. */
  variant: CycleVariant | 'auto';
  anchorISO: string;
  pausedFrom: string | null;
  pauseReason: DisruptionReason | null;
  recovery: RecoveryState | null;
  skips: string[];
  /** Product ids the user chose to introduce now instead of staging. */
  stagingOverrides: string[];
  /** Stable product-id intent for the user's authored Custom cycle. */
  customCycle: CustomCycleDefinition | null;
};

export type CycleConfigRead =
  | { status: 'missing'; config: CycleConfig; source: 'default' }
  | { status: 'available'; config: CycleConfig; source: 'current' | 'legacy' }
  | { status: 'unavailable' | 'corrupt' | 'unsupported_version'; config: null };

const CURRENT_CONFIG_KEYS = [
  'schemaVersion',
  'variant',
  'anchorISO',
  'pausedFrom',
  'pauseReason',
  'recovery',
  'skips',
  'stagingOverrides',
  'customCycle',
] as const;

const CYCLE_VARIANTS = new Set<CycleConfig['variant']>([
  'auto',
  'gentle',
  'classic',
  'advanced',
  'custom',
]);
const DISRUPTION_REASONS = new Set<DisruptionReason>([
  'procedure',
  'irritation',
  'travel',
  'break',
]);
const RECOVERY_REASONS = new Set<RecoveryReason>(['procedure', 'irritation']);

function defaults(anchorISO: string): CycleConfig {
  return {
    schemaVersion: CYCLE_CONFIG_SCHEMA_VERSION,
    variant: 'auto',
    anchorISO,
    pausedFrom: null,
    pauseReason: null,
    recovery: null,
    skips: [],
    stagingOverrides: [],
    customCycle: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && !Array.isArray(value) && typeof value === 'object';
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function cycleConfigError(code: string): Error {
  return new Error(code);
}

function normalizeLocalDateISO(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? text
    : null;
}

function normalizeDateArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const dates: string[] = [];
  for (const item of value) {
    const normalized = normalizeLocalDateISO(item);
    if (!normalized) return null;
    dates.push(normalized);
  }
  return [...new Set(dates)];
}

function normalizeIdArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return null;
  return [...new Set(value.map((item) => (item as string).trim()).filter(Boolean))];
}

function isDisruptionReason(value: unknown): value is DisruptionReason {
  return typeof value === 'string' && DISRUPTION_REASONS.has(value as DisruptionReason);
}

function isRecoveryReason(value: unknown): value is RecoveryReason {
  return typeof value === 'string' && RECOVERY_REASONS.has(value as RecoveryReason);
}

function normalizeRecovery(value: unknown): RecoveryState | null | undefined {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) return undefined;
  const days = value.days;
  const startISO = normalizeLocalDateISO(value.startISO);
  if (
    !startISO ||
    typeof days !== 'number' ||
    !Number.isSafeInteger(days) ||
    days <= 0 ||
    !isRecoveryReason(value.reason)
  ) {
    return undefined;
  }
  return { startISO, days, reason: value.reason };
}

/** Pure compatibility normalizer. Current records are accepted only when this
 * normalized form is structurally identical; legacy records may be normalized
 * in memory and upgraded by a later explicit mutation. */
function normalizeStoredConfig(
  value: unknown,
  fallbackAnchorISO: string,
  allowMissingSchemaVersion: boolean,
): CycleConfig | null {
  if (!isRecord(value)) return null;
  const base = defaults(fallbackAnchorISO);
  const schemaVersion =
    value.schemaVersion ?? (allowMissingSchemaVersion ? CYCLE_CONFIG_SCHEMA_VERSION : undefined);
  const variant = value.variant ?? base.variant;
  const anchorISO = normalizeLocalDateISO(value.anchorISO ?? base.anchorISO);
  const pausedFromValue = value.pausedFrom ?? base.pausedFrom;
  const pausedFrom = pausedFromValue === null ? null : normalizeLocalDateISO(pausedFromValue);
  const pauseReasonValue = value.pauseReason ?? base.pauseReason;
  const recovery = normalizeRecovery(value.recovery);
  const skips = normalizeDateArray(value.skips ?? base.skips);
  const stagingOverrides = normalizeIdArray(value.stagingOverrides ?? base.stagingOverrides);
  const customCycleValue = value.customCycle ?? base.customCycle;
  const customCycle =
    customCycleValue === null ? null : normalizeCustomCycleDefinition(customCycleValue);

  if (schemaVersion !== CYCLE_CONFIG_SCHEMA_VERSION) return null;
  if (!CYCLE_VARIANTS.has(variant as CycleConfig['variant'])) return null;
  if (!anchorISO) return null;
  if (pausedFrom === null && pausedFromValue !== null) return null;
  if (!(pauseReasonValue === null || isDisruptionReason(pauseReasonValue))) return null;
  if (
    recovery === undefined ||
    !skips ||
    !stagingOverrides ||
    (customCycleValue !== null && !customCycle)
  ) {
    return null;
  }

  const pauseReason = pausedFrom
    ? isDisruptionReason(pauseReasonValue)
      ? pauseReasonValue
      : 'break'
    : null;

  return {
    schemaVersion: CYCLE_CONFIG_SCHEMA_VERSION,
    variant: variant as CycleConfig['variant'],
    anchorISO,
    pausedFrom,
    pauseReason,
    recovery,
    skips,
    stagingOverrides,
    customCycle,
  };
}

function parseStoredJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw cycleConfigError(CYCLE_CONFIG_INVALID);
  }
}

function assertSupportedSchema(value: unknown, allowMissing: boolean): void {
  if (!isRecord(value)) throw cycleConfigError(CYCLE_CONFIG_INVALID);
  if (allowMissing && !hasOwn(value, 'schemaVersion')) return;
  if (value.schemaVersion === CYCLE_CONFIG_SCHEMA_VERSION) return;
  if (
    typeof value.schemaVersion === 'number' &&
    Number.isSafeInteger(value.schemaVersion) &&
    value.schemaVersion > CYCLE_CONFIG_SCHEMA_VERSION
  ) {
    throw cycleConfigError(CYCLE_CONFIG_UNSUPPORTED_VERSION);
  }
  throw cycleConfigError(CYCLE_CONFIG_INVALID);
}

function decodeCurrentConfig(raw: string): CycleConfig {
  const parsed = parseStoredJson(raw);
  assertSupportedSchema(parsed, false);
  if (!isRecord(parsed) || !hasExactKeys(parsed, CURRENT_CONFIG_KEYS)) {
    throw cycleConfigError(CYCLE_CONFIG_INVALID);
  }
  const anchorISO = normalizeLocalDateISO(parsed.anchorISO);
  if (!anchorISO) throw cycleConfigError(CYCLE_CONFIG_INVALID);
  const config = normalizeStoredConfig(parsed, anchorISO, false);
  if (!config || canonicalJson(parsed) !== canonicalJson(config)) {
    throw cycleConfigError(CYCLE_CONFIG_INVALID);
  }
  return config;
}

function embeddedLegacyAnchor(value: unknown): string | null {
  return isRecord(value) ? normalizeLocalDateISO(value.anchorISO) : null;
}

function decodeLegacyConfig(value: unknown, fallbackAnchorISO: string): CycleConfig {
  assertSupportedSchema(value, true);
  const config = normalizeStoredConfig(value, fallbackAnchorISO, true);
  if (!config) throw cycleConfigError(CYCLE_CONFIG_INVALID);
  return config;
}

function normalizeMutationConfig(value: unknown): CycleConfig {
  if (!isRecord(value) || !hasExactKeys(value, CURRENT_CONFIG_KEYS)) {
    throw cycleConfigError(CYCLE_CONFIG_INVALID);
  }
  const anchorISO = normalizeLocalDateISO(value.anchorISO);
  if (!anchorISO) throw cycleConfigError(CYCLE_CONFIG_INVALID);
  const normalized = normalizeStoredConfig(value, anchorISO, false);
  if (!normalized || canonicalJson(value) !== canonicalJson(normalized)) {
    throw cycleConfigError(CYCLE_CONFIG_INVALID);
  }
  return normalized;
}

function encodeCycleConfig(config: CycleConfig): string {
  const customCycle = config.customCycle
    ? {
        schemaVersion: config.customCycle.schemaVersion,
        lengthNights: config.customCycle.lengthNights,
        nights: config.customCycle.nights.map((night) => ({ productId: night.productId })),
      }
    : null;
  return JSON.stringify({
    schemaVersion: CYCLE_CONFIG_SCHEMA_VERSION,
    variant: config.variant,
    anchorISO: config.anchorISO,
    pausedFrom: config.pausedFrom,
    pauseReason: config.pauseReason,
    recovery: config.recovery ? { ...config.recovery } : null,
    skips: [...config.skips],
    stagingOverrides: [...config.stagingOverrides],
    customCycle,
  } satisfies CycleConfig);
}

function parseLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((parseLocal(toISO).getTime() - parseLocal(fromISO).getTime()) / 86_400_000);
}

function shiftAnchor(config: CycleConfig, days: number): CycleConfig {
  return days > 0 ? { ...config, anchorISO: addDays(config.anchorISO, days) } : config;
}

function finishPauseAt(config: CycleConfig, todayISO: string): CycleConfig {
  if (!config.pausedFrom) return config;
  const pausedDays = Math.max(0, daysBetween(config.pausedFrom, todayISO));
  return {
    ...shiftAnchor(config, pausedDays),
    pausedFrom: null,
    pauseReason: null,
  };
}

function finishRecoveryAt(config: CycleConfig, todayISO: string): CycleConfig {
  if (!config.recovery) return config;
  const elapsedDays = Math.max(0, daysBetween(config.recovery.startISO, todayISO));
  const recoveryDays = Math.min(config.recovery.days, elapsedDays);
  return { ...shiftAnchor(config, recoveryDays), recovery: null };
}

function reconcileStoredConfig(config: CycleConfig, todayISO: string): CycleConfig {
  let next = config;

  // Older builds could store pause and recovery together. Recovery takes over
  // when it started later; a newer or same-date open-ended pause wins otherwise.
  if (next.pausedFrom && next.recovery) {
    if (next.pausedFrom < next.recovery.startISO) {
      const pauseEnd = next.recovery.startISO < todayISO ? next.recovery.startISO : todayISO;
      const pausedDays = Math.max(0, daysBetween(next.pausedFrom, pauseEnd));
      next = {
        ...shiftAnchor(next, pausedDays),
        pausedFrom: null,
        pauseReason: null,
      };
    } else {
      next = finishRecoveryAt(next, next.pausedFrom);
    }
  }

  if (next.recovery && daysBetween(next.recovery.startISO, todayISO) >= next.recovery.days) {
    next = {
      ...shiftAnchor(next, next.recovery.days),
      recovery: null,
    };
  }

  const currentAndFutureSkips = next.skips.filter((date) => date >= todayISO);
  if (currentAndFutureSkips.length !== next.skips.length) {
    next = { ...next, skips: currentAndFutureSkips };
  }
  return next;
}

function classifyCycleConfigError(error: unknown): CycleConfigRead {
  const message = error instanceof Error ? error.message : '';
  if (message === CYCLE_CONFIG_UNSUPPORTED_VERSION || message.includes('UNSUPPORTED')) {
    return { status: 'unsupported_version', config: null };
  }
  if (
    message === CYCLE_CONFIG_INVALID ||
    message === 'CYCLE_ANCHOR_INVALID' ||
    message === 'PRIVATE_KV_ENVELOPE_INVALID' ||
    message === 'PRIVATE_KV_DECRYPTION_FAILED'
  ) {
    return { status: 'corrupt', config: null };
  }
  return { status: 'unavailable', config: null };
}

async function readCycleConfigValue(): Promise<
  | { status: 'missing'; config: CycleConfig; source: 'default' }
  | { status: 'available'; config: CycleConfig; source: 'current' | 'legacy' }
> {
  const today = localDateString();
  const raw = await getPrivateItem(KEY);
  if (raw !== null) {
    return {
      status: 'available',
      source: 'current',
      config: reconcileStoredConfig(decodeCurrentConfig(raw), today),
    };
  }

  const legacyRaw = await getPrivateItem(LEGACY_KEY);
  if (legacyRaw !== null) {
    const parsed = parseStoredJson(legacyRaw);
    const fallbackAnchor = embeddedLegacyAnchor(parsed) ?? (await getCycleAnchor());
    return {
      status: 'available',
      source: 'legacy',
      config: reconcileStoredConfig(decodeLegacyConfig(parsed, fallbackAnchor), today),
    };
  }

  const fallbackAnchor = await getCycleAnchor();
  return { status: 'missing', source: 'default', config: defaults(fallbackAnchor) };
}

/** Read and reconcile only in memory. Ordinary reads never migrate, normalize,
 * repair, delete, or persist date rollover changes. */
export async function readCycleConfig(): Promise<CycleConfigRead> {
  try {
    return await readCycleConfigValue();
  } catch (error) {
    return classifyCycleConfigError(error);
  }
}

/** Query-facing compatibility API: valid missing state receives defaults; every
 * unreadable state throws a typed fail-closed error. */
export async function loadCycleConfig(): Promise<CycleConfig> {
  const result = await readCycleConfig();
  if (result.status === 'available' || result.status === 'missing') return result.config;
  if (result.status === 'unsupported_version') {
    throw cycleConfigError(CYCLE_CONFIG_UNSUPPORTED_VERSION);
  }
  if (result.status === 'corrupt') throw cycleConfigError(CYCLE_CONFIG_INVALID);
  throw cycleConfigError(CYCLE_CONFIG_UNAVAILABLE);
}

async function prepareMissingCurrentConfig(
  lease: AccountGenerationLease,
): Promise<CycleConfig | null> {
  const observedCurrent = await getPrivateItem(KEY);
  lease.assertCurrent();
  if (observedCurrent !== null) return null;

  const legacyRaw = await getPrivateItem(LEGACY_KEY);
  lease.assertCurrent();
  if (legacyRaw !== null) {
    const parsed = parseStoredJson(legacyRaw);
    const fallbackAnchor = embeddedLegacyAnchor(parsed) ?? (await getCycleAnchor());
    lease.assertCurrent();
    return decodeLegacyConfig(parsed, fallbackAnchor);
  }
  const fallbackAnchor = await getCycleAnchor();
  lease.assertCurrent();
  return defaults(fallbackAnchor);
}

let devCycleConfigWriteFailureUsed = false;

async function maybeRejectDevCycleConfigWrite(): Promise<void> {
  const enabled =
    typeof __DEV__ !== 'undefined' &&
    __DEV__ &&
    process.env.EXPO_PUBLIC_E2E_CYCLE_CONFIG_SAVE_FAILURE === 'once';
  if (!enabled || devCycleConfigWriteFailureUsed) return;
  devCycleConfigWriteFailureUsed = true;
  await new Promise((resolve) => setTimeout(resolve, 600));
  throw new Error('E2E_CYCLE_CONFIG_PRIVATE_WRITE_FAILURE');
}

async function mutateCycleConfig(
  transform: (current: CycleConfig, todayISO: string) => CycleConfig,
): Promise<CycleConfig> {
  return runAccountGenerationOperation(async (lease) => {
    const today = localDateString();
    const missingCurrent = await prepareMissingCurrentConfig(lease);
    let next: CycleConfig | null = null;

    await maybeRejectDevCycleConfigWrite();
    lease.assertCurrent();
    await updatePrivateItem(KEY, (raw) => {
      const stored = raw === null ? missingCurrent : decodeCurrentConfig(raw);
      if (!stored) throw cycleConfigError(CYCLE_CONFIG_UNAVAILABLE);
      const current = reconcileStoredConfig(stored, today);
      const candidate = normalizeMutationConfig(transform(current, today));
      next = reconcileStoredConfig(candidate, today);
      const encoded = encodeCycleConfig(next);
      return raw !== null && canonicalJson(stored) === canonicalJson(next) ? raw : encoded;
    });
    lease.assertCurrent();

    if (!next) throw cycleConfigError(CYCLE_CONFIG_UNAVAILABLE);
    return next;
  });
}

export async function updateCycleConfig(
  patch: Partial<Omit<CycleConfig, 'schemaVersion'>>,
): Promise<CycleConfig> {
  return mutateCycleConfig((current) => ({ ...current, ...patch }));
}

/** Save the complete authored cycle and any explicit phased-introduction choices atomically. */
export async function saveCustomCycleDefinition(
  definition: CustomCycleDefinition,
): Promise<CycleConfig> {
  const customCycle = normalizeCustomCycleDefinition(definition);
  if (!customCycle) throw new Error('CUSTOM_CYCLE_INVALID');
  const selectedProductIds = customCycleProductIds(customCycle);
  return mutateCycleConfig((current) => ({
    ...current,
    variant: 'custom',
    customCycle,
    stagingOverrides: [...new Set([...current.stagingOverrides, ...selectedProductIds])],
  }));
}

/** Pause the cycle. If recovery was active, preserve its elapsed rest first. */
export async function pauseCycle(reason: DisruptionReason): Promise<CycleConfig> {
  if (!isDisruptionReason(reason)) throw new Error('CYCLE_PAUSE_REASON_INVALID');
  return mutateCycleConfig((current, today) => {
    if (current.pausedFrom) return { ...current, pauseReason: reason };
    const settled = finishRecoveryAt(current, today);
    return { ...settled, pausedFrom: today, pauseReason: reason };
  });
}

/** Resume where the cycle paused by shifting the anchor by elapsed pause days. */
export async function resumeCycle(): Promise<CycleConfig> {
  return mutateCycleConfig((current, today) => finishPauseAt(current, today));
}

/** Start or restart at night zero today and clear disruption state. */
export async function startCycleToday(): Promise<CycleConfig> {
  return mutateCycleConfig((current, today) => ({
    ...current,
    anchorISO: today,
    pausedFrom: null,
    pauseReason: null,
    recovery: null,
    skips: current.skips.filter((date) => date !== today),
  }));
}

/** Skip one night without moving the cycle anchor. */
export async function skipTonight(): Promise<CycleConfig> {
  return mutateCycleConfig((current, today) =>
    current.skips.includes(today) ? current : { ...current, skips: [...current.skips, today] },
  );
}

/** Introduce all selected staged products in one atomic cycle-config write. */
export async function overrideStagingProducts(productIds: readonly string[]): Promise<CycleConfig> {
  const normalizedIds = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))];
  if (normalizedIds.length === 0) throw new Error('CYCLE_STAGING_PRODUCTS_INVALID');
  return mutateCycleConfig((current) => ({
    ...current,
    stagingOverrides: [...new Set([...current.stagingOverrides, ...normalizedIds])],
  }));
}

/** Begin a recovery window after settling any existing suspension through today. */
export async function startRecovery(days: number, reason: RecoveryReason): Promise<CycleConfig> {
  if (!Number.isInteger(days) || days <= 0 || !isRecoveryReason(reason)) {
    throw new Error('CYCLE_RECOVERY_INPUT_INVALID');
  }
  return mutateCycleConfig((current, today) => {
    const settled = finishRecoveryAt(finishPauseAt(current, today), today);
    return { ...settled, recovery: { startISO: today, days, reason } };
  });
}

/** Finish recovery early and resume at the night where recovery began. */
export async function endRecovery(): Promise<CycleConfig> {
  return mutateCycleConfig((current, today) => finishRecoveryAt(current, today));
}

/** Recovery is active while today is within [start, start + days). */
export function recoveryProgress(
  recovery: RecoveryState | null,
  todayISO: string,
): { active: boolean; day: number; days: number } {
  if (!recovery) return { active: false, day: 0, days: 0 };
  const elapsed = daysBetween(recovery.startISO, todayISO);
  const active = elapsed >= 0 && elapsed < recovery.days;
  return {
    active,
    day: Math.max(0, Math.min(recovery.days, elapsed + 1)),
    days: recovery.days,
  };
}
