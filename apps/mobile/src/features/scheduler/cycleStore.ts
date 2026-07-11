import type { CycleVariant, DisruptionReason } from '@onskin/types';

import { getCycleAnchor } from '@/features/routine/cycleAnchor';
import { localDateString } from '@/features/today/useToday';
import { getPrivateItem, removePrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';

import { addDays } from './projection';

// Local-first cycle configuration (docs/05 sections 3 and 7). The generated
// per-night schedule remains derived from the shelf; this store holds only the
// user's persistent choices and disruption state on top of that schedule.
const KEY = 'onskin.cycle.v1';

export type RecoveryReason = Extract<DisruptionReason, 'procedure' | 'irritation'>;

export type RecoveryState = {
  startISO: string;
  days: number;
  reason: RecoveryReason;
};

export type CycleConfig = {
  /** 'auto' picks the variant from the profile; otherwise this is the user's choice. */
  variant: CycleVariant | 'auto';
  anchorISO: string;
  pausedFrom: string | null;
  pauseReason: DisruptionReason | null;
  recovery: RecoveryState | null;
  skips: string[];
  /** Product ids the user chose to introduce now instead of staging. */
  stagingOverrides: string[];
};

function defaults(anchorISO: string): CycleConfig {
  return {
    variant: 'auto',
    anchorISO,
    pausedFrom: null,
    pauseReason: null,
    recovery: null,
    skips: [],
    stagingOverrides: [],
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
  return [
    ...new Set(
      value
        .map((item) => (item as string).trim())
        .filter(Boolean),
    ),
  ];
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

function normalizeStoredConfig(value: unknown, fallbackAnchorISO: string): CycleConfig | null {
  if (!isRecord(value)) return null;
  const base = defaults(fallbackAnchorISO);
  const variant = value.variant ?? base.variant;
  const anchorISO = normalizeLocalDateISO(value.anchorISO ?? base.anchorISO);
  const pausedFromValue = value.pausedFrom ?? base.pausedFrom;
  const pausedFrom = pausedFromValue === null ? null : normalizeLocalDateISO(pausedFromValue);
  const pauseReasonValue = value.pauseReason ?? base.pauseReason;
  const recovery = normalizeRecovery(value.recovery);
  const skips = normalizeDateArray(value.skips ?? base.skips);
  const stagingOverrides = normalizeIdArray(value.stagingOverrides ?? base.stagingOverrides);

  if (!CYCLE_VARIANTS.has(variant as CycleConfig['variant'])) return null;
  if (!anchorISO) return null;
  if (pausedFrom === null && pausedFromValue !== null) return null;
  if (!(pauseReasonValue === null || isDisruptionReason(pauseReasonValue))) return null;
  if (recovery === undefined || !skips || !stagingOverrides) return null;

  const pauseReason = pausedFrom
    ? isDisruptionReason(pauseReasonValue)
      ? pauseReasonValue
      : 'break'
    : null;

  return {
    variant: variant as CycleConfig['variant'],
    anchorISO,
    pausedFrom,
    pauseReason,
    recovery,
    skips,
    stagingOverrides,
  };
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

  const currentAndFutureSkips = next.skips.filter((date) => date >= todayISO);
  if (currentAndFutureSkips.length !== next.skips.length) {
    next = { ...next, skips: currentAndFutureSkips };
  }
  return next;
}

async function normalizeLatestStoredConfig(
  fallbackAnchorISO: string,
  todayISO: string,
): Promise<CycleConfig | null> {
  let latest: CycleConfig | null = null;
  await updatePrivateItem(KEY, (currentRaw) => {
    if (!currentRaw) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(currentRaw) as unknown;
    } catch {
      return currentRaw;
    }
    const current = normalizeStoredConfig(parsed, fallbackAnchorISO);
    if (!current) return currentRaw;
    latest = reconcileStoredConfig(current, todayISO);
    return JSON.stringify(latest);
  });
  return latest;
}

export async function loadCycleConfig(): Promise<CycleConfig> {
  const fallbackAnchor = await getCycleAnchor();
  let raw: string | null;
  try {
    raw = await getPrivateItem(KEY);
  } catch {
    return defaults(fallbackAnchor);
  }

  if (!raw) return defaults(fallbackAnchor);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    await removePrivateItem(KEY).catch(() => undefined);
    return defaults(fallbackAnchor);
  }

  const normalized = normalizeStoredConfig(parsed, fallbackAnchor);
  if (!normalized) {
    await removePrivateItem(KEY).catch(() => undefined);
    return defaults(fallbackAnchor);
  }

  const today = localDateString();
  const reconciled = reconcileStoredConfig(normalized, today);
  if (JSON.stringify(parsed) === JSON.stringify(reconciled)) return reconciled;

  const latest = await normalizeLatestStoredConfig(fallbackAnchor, today).catch(() => null);
  return latest ?? reconciled;
}

function configForMutation(
  raw: string | null,
  fallbackAnchorISO: string,
  todayISO: string,
): CycleConfig {
  if (!raw) return defaults(fallbackAnchorISO);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('CYCLE_CONFIG_INVALID');
  }
  const normalized = normalizeStoredConfig(parsed, fallbackAnchorISO);
  if (!normalized) throw new Error('CYCLE_CONFIG_INVALID');
  return reconcileStoredConfig(normalized, todayISO);
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
  const today = localDateString();
  const fallbackAnchor = await getCycleAnchor();
  let next: CycleConfig | null = null;

  await maybeRejectDevCycleConfigWrite();
  await updatePrivateItem(KEY, (raw) => {
    const current = configForMutation(raw, fallbackAnchor, today);
    const candidate = normalizeStoredConfig(transform(current, today), current.anchorISO);
    if (!candidate) throw new Error('CYCLE_CONFIG_INVALID');
    next = reconcileStoredConfig(candidate, today);
    return JSON.stringify(next);
  });

  if (!next) throw new Error('CYCLE_CONFIG_WRITE_FAILED');
  return next;
}

export async function updateCycleConfig(patch: Partial<CycleConfig>): Promise<CycleConfig> {
  return mutateCycleConfig((current) => ({ ...current, ...patch }));
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
export async function overrideStagingProducts(
  productIds: readonly string[],
): Promise<CycleConfig> {
  const normalizedIds = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))];
  if (normalizedIds.length === 0) throw new Error('CYCLE_STAGING_PRODUCTS_INVALID');
  return mutateCycleConfig((current) => ({
    ...current,
    stagingOverrides: [...new Set([...current.stagingOverrides, ...normalizedIds])],
  }));
}

/** Begin a recovery window after settling any existing suspension through today. */
export async function startRecovery(
  days: number,
  reason: RecoveryReason,
): Promise<CycleConfig> {
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
