import { MILESTONE_COPY } from '@/features/notifications/copy';

// Calm streak milestones (docs/07 §4.5): gentle markers at one week, one full
// cycle, and thirty days. Restrained celebration, never confetti. Pure + testable;
// the streak screen renders the highest reached marker and fires the analytics
// event once per milestone (via milestoneStore).

export const MILESTONE_KEYS = ['d7', 'one_cycle', 'd30'] as const;

export type MilestoneKey = (typeof MILESTONE_KEYS)[number];
export type Milestone = { key: MilestoneKey; threshold: number; copy: string };

/** Ascending, de-duplicated milestone thresholds for a given cycle length. */
export function milestoneThresholds(cycleLength: number): Milestone[] {
  const raw = [
    { key: 'd7', threshold: 7 },
    { key: 'one_cycle', threshold: Math.max(2, Math.round(cycleLength)) },
    { key: 'd30', threshold: 30 },
  ] satisfies { key: MilestoneKey; threshold: number }[];
  const seen = new Set<number>();
  return raw
    .sort((a, b) => a.threshold - b.threshold)
    .filter((m) => {
      if (seen.has(m.threshold)) return false;
      seen.add(m.threshold);
      return true;
    })
    .map((m) => ({ ...m, copy: MILESTONE_COPY[m.key] ?? '' }));
}

/** The highest milestone the current streak has reached, or null below the first. */
export function currentMilestone(current: number, cycleLength: number): Milestone | null {
  const reached = milestoneThresholds(cycleLength).filter((m) => current >= m.threshold);
  return reached.length > 0 ? (reached[reached.length - 1] ?? null) : null;
}
