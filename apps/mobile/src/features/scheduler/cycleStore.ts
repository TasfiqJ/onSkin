import type { CycleVariant, DisruptionReason } from '@onskin/types';

import { canUseRoutineCadence, canUseRoutineRecovery } from '@/features/routine/reviewGate';
import { getCycleAnchor } from '@/features/routine/cycleAnchor';
import { shippableRoutineCadencePolicy } from '@/features/routine/sequencing';
import { localDateString } from '@/features/today/useToday';
import {
  runCurrentHealthDataOperation,
  type HealthDataWriteOperationLease,
} from '@/lib/consent/healthDataWriteAdmission';
import { getPrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';

import { addDays } from './projection';
import {
  customCycleProductIds,
  normalizeCustomCycleDefinition,
  type CustomCycleDefinition,
} from './customCycle';

// Local-first cycle configuration (docs/05 sections 3 and 7). The generated
// per-night schedule remains derived from the shelf; this store holds only the
// user's persistent choices and disruption state on top of that schedule.
const KEY = 'routinekind.cycle.v2';
const LEGACY_KEY = 'onskin.cycle.v1';
const LEGACY_ANCHOR_KEY = 'onskin.cycleAnchor';
const CYCLE_CONFIG_SCHEMA_VERSION = 1 as const;
export const ROUTINE_CADENCE_MUTATION_ADMISSION_CLOSED =
  'ROUTINE_CADENCE_MUTATION_ADMISSION_CLOSED';
export const ROUTINE_RECOVERY_ADMISSION_CLOSED = 'ROUTINE_RECOVERY_ADMISSION_CLOSED';

/**
 * Cycle configuration is clinical-policy state, not a generic preference store.
 * Keep this assertion at both the hook boundary and the storage boundary so a
 * direct route/deep link or a future non-React caller cannot persist unreviewed
 * cadence, recovery, staging, or disruption decisions.
 */
export function assertRoutineCadenceMutationAdmission(): void {
  if (!canUseRoutineCadence()) {
    throw new Error(ROUTINE_CADENCE_MUTATION_ADMISSION_CLOSED);
  }
}

export function assertRoutineRecoveryAvailable(): void {
  assertRoutineCadenceMutationAdmission();
  if (!canUseRoutineRecovery()) {
    throw new Error(ROUTINE_RECOVERY_ADMISSION_CLOSED);
  }
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && !Array.isArray(value) && typeof value === 'object';
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
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
    !Number.isInteger(days) ||
    days <= 0 ||
    !isRecoveryReason(value.reason)
  ) {
    return undefined;
  }
  return { startISO, days, reason: value.reason };
}

function normalizeStoredConfig(
  value: unknown,
  fallbackAnchorISO: string,
  allowMissingSchemaVersion = false,
): CycleConfig | null {
  if (!isRecord(value)) return null;
  if (!allowMissingSchemaVersion) {
    const expectedKeys = [
      'anchorISO',
      'customCycle',
      'pausedFrom',
      'pauseReason',
      'recovery',
      'schemaVersion',
      'skips',
      'stagingOverrides',
      'variant',
    ].sort();
    const actualKeys = Object.keys(value).sort();
    if (
      actualKeys.length !== expectedKeys.length ||
      expectedKeys.some((key, index) => actualKeys[index] !== key || !hasOwn(value, key))
    ) {
      return null;
    }
  }
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

function parseStoredConfig(
  raw: string,
  fallbackAnchorISO: string,
  allowMissingSchemaVersion = false,
): {
  parsed: unknown;
  config: CycleConfig;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('CYCLE_CONFIG_INVALID');
  }
  const config = normalizeStoredConfig(parsed, fallbackAnchorISO, allowMissingSchemaVersion);
  if (!config) throw new Error('CYCLE_CONFIG_INVALID');
  return { parsed, config };
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

function reconcileStoredConfig(
  config: CycleConfig,
  todayISO: string,
  allowRecoveryReconciliation: boolean,
): CycleConfig {
  let next = config;

  if (allowRecoveryReconciliation) {
    // Legacy builds could store pause and recovery together. Recovery takes over
    // when it started later; a newer open-ended pause takes over from recovery.
    // This preserves the last dated transition without counting overlap twice.
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
  }

  const currentAndFutureSkips = next.skips.filter((date) => date >= todayISO);
  if (currentAndFutureSkips.length !== next.skips.length) {
    next = { ...next, skips: currentAndFutureSkips };
  }
  return next;
}

async function normalizeLatestStoredConfig(
  fallbackAnchorISO: string,
  todayISO: string,
  lease: HealthDataWriteOperationLease,
): Promise<CycleConfig | null> {
  let latest: CycleConfig | null = null;
  assertRoutineCadenceMutationAdmission();
  lease.assertCurrent();
  await updatePrivateItem(KEY, (currentRaw) => {
    lease.assertCurrent();
    if (!currentRaw) return null;
    const { config: current } = parseStoredConfig(currentRaw, fallbackAnchorISO);
    const recoveryAllowed = canUseRoutineRecovery();
    if (current.recovery && !recoveryAllowed) {
      latest = current;
      return currentRaw;
    }
    latest = reconcileStoredConfig(current, todayISO, recoveryAllowed);
    return JSON.stringify(latest);
  });
  lease.assertCurrent();
  return latest;
}

async function migrateLegacyConfig(
  fallbackAnchorISO: string,
  todayISO: string,
  lease: HealthDataWriteOperationLease,
): Promise<CycleConfig | null> {
  lease.assertCurrent();
  const legacyRaw = await getPrivateItem(LEGACY_KEY);
  lease.assertCurrent();
  if (!legacyRaw) return null;
  const legacyStored = parseStoredConfig(legacyRaw, fallbackAnchorISO, true).config;
  if (legacyStored.recovery && !canUseRoutineRecovery()) return legacyStored;
  let migrated: CycleConfig | null = null;

  // The old key is intentionally retained for account cleanup and downgrade
  // isolation. Once v2 exists, older builds can no longer overwrite this state.
  assertRoutineCadenceMutationAdmission();
  lease.assertCurrent();
  await updatePrivateItem(KEY, (currentRaw) => {
    lease.assertCurrent();
    const recoveryAllowed = canUseRoutineRecovery();
    if (currentRaw) {
      const current = parseStoredConfig(currentRaw, fallbackAnchorISO).config;
      if (current.recovery && !recoveryAllowed) {
        migrated = current;
        return currentRaw;
      }
      migrated = reconcileStoredConfig(current, todayISO, recoveryAllowed);
      return JSON.stringify(migrated);
    }
    if (legacyStored.recovery && !recoveryAllowed) {
      migrated = legacyStored;
      return null;
    }
    migrated = reconcileStoredConfig(legacyStored, todayISO, recoveryAllowed);
    return JSON.stringify(migrated);
  });
  lease.assertCurrent();
  if (!migrated) throw new Error('CYCLE_CONFIG_WRITE_FAILED');
  return migrated;
}

async function loadCycleConfigForLease(lease: HealthDataWriteOperationLease): Promise<CycleConfig> {
  lease.assertCurrent();
  const fallbackAnchor = await getCycleAnchor();
  lease.assertCurrent();
  const today = localDateString();
  lease.assertCurrent();
  const raw = await getPrivateItem(KEY);
  lease.assertCurrent();
  if (!raw) {
    const migrated = await migrateLegacyConfig(fallbackAnchor, today, lease);
    lease.assertCurrent();
    return migrated ?? defaults(fallbackAnchor);
  }

  const { parsed, config: normalized } = parseStoredConfig(raw, fallbackAnchor);
  const recoveryAllowed = canUseRoutineRecovery();
  if (normalized.recovery && !recoveryAllowed) return normalized;
  const reconciled = reconcileStoredConfig(normalized, today, recoveryAllowed);
  lease.assertCurrent();
  if (JSON.stringify(parsed) === JSON.stringify(reconciled)) return reconciled;

  const latest = await normalizeLatestStoredConfig(fallbackAnchor, today, lease);
  lease.assertCurrent();
  return latest ?? defaults(fallbackAnchor);
}

export async function loadCycleConfig(): Promise<CycleConfig> {
  return runCurrentHealthDataOperation(loadCycleConfigForLease);
}

function sameRecovery(left: RecoveryState | null, right: RecoveryState | null): boolean {
  if (!left || !right) return left === right;
  return (
    left.startISO === right.startISO && left.days === right.days && left.reason === right.reason
  );
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
  assertRoutineCadenceMutationAdmission();
  return runCurrentHealthDataOperation(async (lease) => {
    const today = localDateString();
    lease.assertCurrent();
    let fallbackAnchor = today;
    try {
      const legacyAnchor = await getPrivateItem(LEGACY_ANCHOR_KEY);
      lease.assertCurrent();
      fallbackAnchor = normalizeLocalDateISO(legacyAnchor) ?? today;
    } catch {
      // The v2 transform below remains authoritative and re-reads its own key.
      // A failed legacy-anchor read must not trigger a repair write before the
      // requested cycle mutation has committed.
      lease.assertCurrent();
    }

    const currentRaw = await getPrivateItem(KEY);
    lease.assertCurrent();
    const legacyRaw = currentRaw ? null : await getPrivateItem(LEGACY_KEY);
    lease.assertCurrent();
    let next: CycleConfig | null = null;

    await maybeRejectDevCycleConfigWrite();
    assertRoutineCadenceMutationAdmission();
    lease.assertCurrent();
    await updatePrivateItem(KEY, (raw) => {
      lease.assertCurrent();
      const sourceRaw = raw ?? legacyRaw;
      const stored = sourceRaw
        ? parseStoredConfig(sourceRaw, fallbackAnchor, raw === null).config
        : defaults(fallbackAnchor);
      const recoveryAllowed = canUseRoutineRecovery();
      if (raw === null && stored.recovery && !recoveryAllowed) {
        throw new Error(ROUTINE_RECOVERY_ADMISSION_CLOSED);
      }
      const current = reconcileStoredConfig(stored, today, recoveryAllowed);
      const candidate = normalizeStoredConfig(transform(current, today), current.anchorISO);
      if (!candidate) throw new Error('CYCLE_CONFIG_INVALID');
      if (!recoveryAllowed && !sameRecovery(candidate.recovery, stored.recovery)) {
        throw new Error(ROUTINE_RECOVERY_ADMISSION_CLOSED);
      }
      next = reconcileStoredConfig(candidate, today, recoveryAllowed);
      if (!canUseRoutineRecovery() && !sameRecovery(next.recovery, stored.recovery)) {
        throw new Error(ROUTINE_RECOVERY_ADMISSION_CLOSED);
      }
      lease.assertCurrent();
      return JSON.stringify(next);
    });
    lease.assertCurrent();

    if (!next) throw new Error('CYCLE_CONFIG_WRITE_FAILED');
    return next;
  });
}

export async function updateCycleConfig(
  patch: Partial<Omit<CycleConfig, 'schemaVersion'>>,
): Promise<CycleConfig> {
  if (Object.prototype.hasOwnProperty.call(patch, 'recovery')) {
    assertRoutineRecoveryAvailable();
  }
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
  assertRoutineRecoveryAvailable();
  const recoveryWindows = shippableRoutineCadencePolicy()?.recoveryWindows;
  const isReviewedWindow =
    recoveryWindows !== undefined &&
    (reason === 'irritation'
      ? days === recoveryWindows.irritationDays
      : recoveryWindows.procedureChoicesDays.includes(days));
  if (!isReviewedWindow) throw new Error('CYCLE_RECOVERY_INPUT_INVALID');
  return mutateCycleConfig((current, today) => {
    assertRoutineRecoveryAvailable();
    const settled = finishRecoveryAt(finishPauseAt(current, today), today);
    return { ...settled, recovery: { startISO: today, days, reason } };
  });
}

/** Finish recovery early and resume at the night where recovery began. */
export async function endRecovery(): Promise<CycleConfig> {
  assertRoutineRecoveryAvailable();
  return mutateCycleConfig((current, today) => {
    assertRoutineRecoveryAvailable();
    return finishRecoveryAt(current, today);
  });
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
