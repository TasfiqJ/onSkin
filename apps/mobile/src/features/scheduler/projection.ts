import type { ActiveClass } from './classes';
import type { Cycle, NightSlot, SchedulerSlot } from './orchestrate';

// The projection algorithm (docs/05 §3): deterministic, pure, local-day aware.
// Given a cycle (anchor A, length L) and today's local date T:
//   night_index(T) = ((T - A) mod L + L) mod L   (safe modulo for dates before A)
// → tonight's slot, the week ahead, and the next-of-slot (next acid/retinoid night).

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}
function daysBetween(fromISO: string, toISO: string): number {
  return Math.round(
    (parseLocalDate(toISO).getTime() - parseLocalDate(fromISO).getTime()) / 86_400_000,
  );
}
export function addDays(iso: string, n: number): string {
  const d = parseLocalDate(iso);
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}
/** "Saturday". Friendly weekday for the schedule copy. */
export function friendlyWeekday(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString('en-US', { weekday: 'short' });
}

/** 0-based night index for a date, safe for dates before the anchor (docs/05 §3). */
export function nightIndex(cycle: Cycle, anchorISO: string, dateISO: string): number {
  const L = cycle.lengthNights;
  if (L <= 0) return 0;
  return ((daysBetween(anchorISO, dateISO) % L) + L) % L;
}

/** The night slot for a date. */
export function nightFor(cycle: Cycle, anchorISO: string, dateISO: string): NightSlot {
  return cycle.nights[nightIndex(cycle, anchorISO, dateISO)]!;
}

export type ProjectedNight = { dateISO: string; weekday: string; night: NightSlot };

export type CycleActiveSummary = {
  productId: string;
  name: string;
  className: ActiveClass;
  nightNumbers: number[];
};

/** One row per scheduled product, ordered by its first appearance in the cycle. */
export function cycleActiveSummaries(cycle: Cycle): CycleActiveSummary[] {
  const byProductId = new Map<string, CycleActiveSummary>();
  for (const night of cycle.nights) {
    if (!night.productId || !night.productName || !night.className) continue;
    const existing = byProductId.get(night.productId);
    if (existing) {
      existing.nightNumbers.push(night.index + 1);
      continue;
    }
    byProductId.set(night.productId, {
      productId: night.productId,
      name: night.productName,
      className: night.className,
      nightNumbers: [night.index + 1],
    });
  }
  return [...byProductId.values()];
}

export function cycleRecoveryNightNumbers(cycle: Cycle): number[] {
  return cycle.nights.filter((night) => night.slot === 'recover').map((night) => night.index + 1);
}

/** Today + the next `days` nights, each with its slot + assigned active (docs/05 §3). */
export function weekAhead(
  cycle: Cycle,
  anchorISO: string,
  fromISO: string,
  days = 6,
): ProjectedNight[] {
  const out: ProjectedNight[] = [];
  for (let d = 0; d <= days; d++) {
    const dateISO = addDays(fromISO, d);
    out.push({
      dateISO,
      weekday: friendlyWeekday(dateISO),
      night: nightFor(cycle, anchorISO, dateISO),
    });
  }
  return out;
}

/** The next date AFTER `fromISO` whose slot matches. E.g. the next acid night (docs/05 §3). */
export function nextSlotDate(
  cycle: Cycle,
  anchorISO: string,
  fromISO: string,
  slot: SchedulerSlot,
): string | null {
  for (let i = 1; i <= cycle.lengthNights; i++) {
    const dateISO = addDays(fromISO, i);
    if (nightFor(cycle, anchorISO, dateISO).slot === slot) return dateISO;
  }
  return null;
}

const SLOT_LABEL: Record<SchedulerSlot, string> = {
  exfoliate: 'Exfoliate',
  retinoid: 'Retinoid',
  recover: 'Recover',
  other_active: 'Active',
};
export const slotLabel = (slot: SchedulerSlot) => SLOT_LABEL[slot];
