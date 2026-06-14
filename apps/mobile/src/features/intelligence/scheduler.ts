import type { GoalId } from '@onskin/types';

import type { SensitivityLevel } from './engine';

// Skin-cycling scheduler (docs/02 §5). Dr. Whitney Bowe's framework, personalised
// by sensitivity, with `alternate_nights` conflicts resolved INTO the cycle and
// rendered as the spec's PM "next acid night" banner. Pure + date-only (local-day
// aware, DECISIONS D-012) so it's testable and offline.

export type CycleSlot = 'exfoliate' | 'retinoid' | 'recover';

export type CycleTemplate = {
  id: 'classic_4' | 'gentle_5' | 'advanced_3';
  label: string;
  /** Ordered slot per night; the cycle repeats. */
  nights: CycleSlot[];
};

export const CYCLE_TEMPLATES: Record<CycleTemplate['id'], CycleTemplate> = {
  // The classic four-night cycle (Bowe): Exfoliate → Retinoid → Recover → Recover.
  classic_4: { id: 'classic_4', label: 'Classic', nights: ['exfoliate', 'retinoid', 'recover', 'recover'] },
  // Gentle: extra recovery nights for sensitive / barrier-repair skin.
  gentle_5: { id: 'gentle_5', label: 'Gentle', nights: ['exfoliate', 'recover', 'retinoid', 'recover', 'recover'] },
  // Advanced: fewer recovery nights for resistant skin that tolerates more.
  advanced_3: { id: 'advanced_3', label: 'Advanced', nights: ['exfoliate', 'retinoid', 'recover'] },
};

export type SchedulerProfile = {
  sensitivity: SensitivityLevel;
  goals: GoalId[];
  /** Whether the user owns any cycling actives (retinoid / exfoliating acid). */
  hasActives: boolean;
};

/** Pick a cycle for the user, or null when there's nothing to cycle (docs/02 §5). */
export function pickCycle(profile: SchedulerProfile): CycleTemplate | null {
  if (!profile.hasActives) return null;
  if (profile.sensitivity === 'sensitive' || profile.goals.includes('barrier_repair')) {
    return CYCLE_TEMPLATES.gentle_5;
  }
  if (profile.sensitivity === 'resistant') return CYCLE_TEMPLATES.advanced_3;
  return CYCLE_TEMPLATES.classic_4;
}

// --- date-only helpers (local midnight; avoid TZ drift) ----------------------
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}
function daysBetween(fromISO: string, toISO: string): number {
  const ms = parseLocalDate(toISO).getTime() - parseLocalDate(fromISO).getTime();
  return Math.round(ms / 86_400_000);
}
function addDays(iso: string, n: number): string {
  const d = parseLocalDate(iso);
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

export type NightInfo = { index: number; slot: CycleSlot; total: number };

/** Tonight's 1-based night number + slot, given the cycle anchor (start date). */
export function nightForDate(template: CycleTemplate, anchorISO: string, dateISO: string): NightInfo {
  const total = template.nights.length;
  const offset = ((daysBetween(anchorISO, dateISO) % total) + total) % total; // handles dates before anchor
  return { index: offset + 1, slot: template.nights[offset]!, total };
}

/** The next date (after `fromISO`) whose slot matches `slot`. E.g. the next acid night. */
export function nextNightWithSlot(
  template: CycleTemplate,
  anchorISO: string,
  fromISO: string,
  slot: CycleSlot,
): string | null {
  for (let i = 1; i <= template.nights.length; i++) {
    const candidate = addDays(fromISO, i);
    if (nightForDate(template, anchorISO, candidate).slot === slot) return candidate;
  }
  return null;
}

/** "Saturday". Friendly weekday for the PM banner. */
export function friendlyWeekday(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString('en-US', { weekday: 'long' });
}

export type PmResolution = {
  /** Active product names skipped tonight because tonight isn't their night. */
  skippedTonight: string[];
  /** Friendly weekday of the next exfoliation (acid) night, if any acids are skipped. */
  nextAcidNight: string | null;
};

/**
 * The spec's PM auto-resolution (§7.4): on a retinoid night, any exfoliating-acid
 * products are skipped, and we name the next acid night. `acidProductNames` are the
 * user's owned AHA/BHA products that `alternate_nights`-conflict with the retinoid.
 */
export function pmResolution(
  template: CycleTemplate,
  anchorISO: string,
  todayISO: string,
  acidProductNames: string[],
): PmResolution {
  const tonight = nightForDate(template, anchorISO, todayISO);
  if (tonight.slot !== 'retinoid' || acidProductNames.length === 0) {
    return { skippedTonight: [], nextAcidNight: null };
  }
  const next = nextNightWithSlot(template, anchorISO, todayISO, 'exfoliate');
  return {
    skippedTonight: acidProductNames,
    nextAcidNight: next ? friendlyWeekday(next) : null,
  };
}
