import type { CycleVariant, DisruptionReason } from '@onskin/types';

import { getCycleAnchor } from '@/features/routine/cycleAnchor';
import { localDateString } from '@/features/today/useToday';
import { getPrivateItem, removePrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

import { addDays } from './projection';

// Local-first cycle config (docs/05 §3/§7). Variant override, anchor, pause, the
// recovery window, and one-off skips. AsyncStorage is the v1 source of truth
// (offline-first, D-029/D-034); the `cycles`/`cycle_nights` schema is the
// forward-compatible server target (B-SUPABASE). The per-night SLOTS are derived
// by orchestration (orchestrate.ts) over the shelf. This store holds only the
// user's persistent choices on top.
const KEY = 'onskin.cycle.v1';

export type RecoveryState = {
  startISO: string;
  days: number; // recovery window length
  reason: DisruptionReason; // 'procedure' | 'irritation'
};

export type CycleConfig = {
  /** 'auto' = pick the variant from the profile; otherwise the user's choice. */
  variant: CycleVariant | 'auto';
  anchorISO: string;
  pausedFrom: string | null;
  pauseReason: DisruptionReason | null;
  recovery: RecoveryState | null;
  skips: string[];
  /** Product ids the user chose to start NOW, opting out of phased staging
   *  (docs/05 §6.2: "the user may proceed anyway"). orchestrate stops treating
   *  these as new so they enter the cycle immediately. */
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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
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

function isDisruptionReason(value: unknown): value is DisruptionReason {
  return typeof value === 'string' && DISRUPTION_REASONS.has(value as DisruptionReason);
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
    !isDisruptionReason(value.reason)
  ) {
    return undefined;
  }
  return { startISO, days, reason: value.reason };
}

function normalizeStoredConfig(value: unknown, fallbackAnchorISO: string): CycleConfig | null {
  if (!isRecord(value)) return null;
  const base = defaults(fallbackAnchorISO);
  const variant = value.variant ?? base.variant;
  const anchorISO = value.anchorISO ?? base.anchorISO;
  const pausedFrom = value.pausedFrom ?? base.pausedFrom;
  const pauseReason = value.pauseReason ?? base.pauseReason;
  const recovery = normalizeRecovery(value.recovery);
  const skips = normalizeDateArray(value.skips ?? base.skips);
  const stagingOverrides = value.stagingOverrides ?? base.stagingOverrides;
  const normalizedAnchorISO = normalizeLocalDateISO(anchorISO);
  const normalizedPausedFrom = pausedFrom === null ? null : normalizeLocalDateISO(pausedFrom);

  if (!CYCLE_VARIANTS.has(variant as CycleConfig['variant'])) return null;
  if (!normalizedAnchorISO) return null;
  if (normalizedPausedFrom === null && pausedFrom !== null) return null;
  if (!(pauseReason === null || isDisruptionReason(pauseReason))) return null;
  if (recovery === undefined) return null;
  if (!skips) return null;
  if (!isStringArray(stagingOverrides)) return null;

  return {
    variant: variant as CycleConfig['variant'],
    anchorISO: normalizedAnchorISO,
    pausedFrom: normalizedPausedFrom,
    pauseReason,
    recovery,
    skips,
    stagingOverrides,
  };
}

export async function loadCycleConfig(): Promise<CycleConfig> {
  let raw: string | null = null;
  try {
    raw = await getPrivateItem(KEY);
  } catch {
    raw = null;
  }

  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      const normalized = normalizeStoredConfig(parsed, localDateString());
      if (normalized) {
        if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
          await setPrivateItem(KEY, JSON.stringify(normalized)).catch(() => undefined);
        }
        return normalized;
      }
    } catch {
      /* malformed legacy/local state */
    }
    await removePrivateItem(KEY).catch(() => undefined);
  }

  // Continuity with the legacy "Start today" anchor (cycleAnchor.ts).
  const anchor = await getCycleAnchor();
  return defaults(anchor);
}

async function persist(config: CycleConfig): Promise<void> {
  try {
    await setPrivateItem(KEY, JSON.stringify(config));
  } catch {
    /* best-effort */
  }
}

export async function updateCycleConfig(patch: Partial<CycleConfig>): Promise<CycleConfig> {
  const current = await loadCycleConfig();
  const normalized = normalizeStoredConfig({ ...current, ...patch }, current.anchorISO);
  const next = normalized ?? current;
  await persist(next);
  return next;
}

/** Pause the cycle (vacation/illness/break/travel). Suspends without breaking. */
export async function pauseCycle(reason: DisruptionReason): Promise<void> {
  await updateCycleConfig({ pausedFrom: localDateString(), pauseReason: reason });
}

/** Resume, re-anchoring so the cycle continues where it left off (docs/05 §3, D-036). */
export async function resumeCycle(): Promise<void> {
  const c = await loadCycleConfig();
  if (!c.pausedFrom) return;
  const pausedDays = Math.max(0, daysBetween(c.pausedFrom, localDateString()));
  await updateCycleConfig({
    anchorISO: addDays(c.anchorISO, pausedDays),
    pausedFrom: null,
    pauseReason: null,
  });
}

/** Start (or restart) the cycle today. Re-anchors to night 0 today. */
export async function startCycleToday(): Promise<void> {
  const today = localDateString();
  const current = await loadCycleConfig();
  await updateCycleConfig({
    anchorISO: today,
    pausedFrom: null,
    pauseReason: null,
    skips: current.skips.filter((date) => date !== today),
  });
}

/** Skip a single night. The cycle continues, nothing resets (docs/05 §7). */
export async function skipTonight(): Promise<void> {
  const c = await loadCycleConfig();
  const today = localDateString();
  if (c.skips.includes(today)) return;
  await updateCycleConfig({ skips: [...c.skips, today] });
}

/** Opt a product out of phased staging so it enters the cycle now (docs/05 §6.2). */
export async function overrideStaging(productId: string): Promise<void> {
  const c = await loadCycleConfig();
  if (c.stagingOverrides.includes(productId)) return;
  await updateCycleConfig({ stagingOverrides: [...c.stagingOverrides, productId] });
}

/** Begin a recovery window (post-procedure or auto-de-escalation, docs/05 §7). */
export async function startRecovery(days: number, reason: DisruptionReason): Promise<void> {
  await updateCycleConfig({ recovery: { startISO: localDateString(), days, reason } });
}

export async function endRecovery(): Promise<void> {
  await updateCycleConfig({ recovery: null });
}

function parseLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}
function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((parseLocal(toISO).getTime() - parseLocal(fromISO).getTime()) / 86_400_000);
}

/** Recovery is active while today is within [start, start+days). Returns day N of total. */
export function recoveryProgress(
  recovery: RecoveryState | null,
  todayISO: string,
): { active: boolean; day: number; days: number } {
  if (!recovery) return { active: false, day: 0, days: 0 };
  const elapsed = daysBetween(recovery.startISO, todayISO);
  const active = elapsed >= 0 && elapsed < recovery.days;
  return { active, day: Math.min(recovery.days, elapsed + 1), days: recovery.days };
}
