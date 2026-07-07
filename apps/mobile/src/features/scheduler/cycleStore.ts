import type { CycleVariant, DisruptionReason } from '@onskin/types';

import { getCycleAnchor } from '@/features/routine/cycleAnchor';
import { localDateString } from '@/features/today/useToday';
import { getPrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

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

export async function loadCycleConfig(): Promise<CycleConfig> {
  try {
    const raw = await getPrivateItem(KEY);
    if (raw) return { ...defaults(localDateString()), ...(JSON.parse(raw) as CycleConfig) };
  } catch {
    /* fall through */
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
  const next = { ...current, ...patch };
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
