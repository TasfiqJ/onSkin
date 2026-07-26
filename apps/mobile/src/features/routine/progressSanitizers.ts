export function normalizeProgressCompletionDate(value: unknown): string | null {
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

export function normalizeProgressCount(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 0;
}

export function normalizeProgressLongestStreak(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export type ServerAdherenceProjection = Readonly<{
  currentStreak: number;
  longestStreak: number;
  adherenceTimezone: string;
  referenceDay: string;
  frozenDates: string[];
  lapsed: boolean;
  algorithmVersion: 1;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function canonicalTimezone(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < 1 || value !== value.trim()) return null;
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone ===
      value
      ? value
      : null;
  } catch {
    return null;
  }
}

/** Strict decoder for the single row returned by the adherence RPCs. */
export function decodeServerAdherenceProjection(value: unknown): ServerAdherenceProjection | null {
  if (!Array.isArray(value) || value.length !== 1 || !isRecord(value[0])) return null;
  const row = value[0];
  const keys = Object.keys(row).sort();
  const expected = [
    'adherence_timezone',
    'algorithm_version',
    'current_streak',
    'frozen_dates',
    'lapsed',
    'longest_streak',
    'reference_day',
  ].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    return null;
  }
  const currentStreak = normalizeProgressLongestStreak(row.current_streak);
  const longestStreak = normalizeProgressLongestStreak(row.longest_streak);
  const adherenceTimezone = canonicalTimezone(row.adherence_timezone);
  const referenceDay = normalizeProgressCompletionDate(row.reference_day);
  if (
    currentStreak !== row.current_streak ||
    longestStreak !== row.longest_streak ||
    longestStreak < currentStreak ||
    adherenceTimezone === null ||
    referenceDay === null ||
    row.algorithm_version !== 1 ||
    typeof row.lapsed !== 'boolean' ||
    !Array.isArray(row.frozen_dates)
  ) {
    return null;
  }
  const frozenDates: string[] = [];
  for (const candidate of row.frozen_dates) {
    const date = normalizeProgressCompletionDate(candidate);
    if (
      date === null ||
      date > referenceDay ||
      frozenDates.includes(date) ||
      (frozenDates.length > 0 && frozenDates[frozenDates.length - 1]! < date)
    ) {
      return null;
    }
    frozenDates.push(date);
  }
  return {
    currentStreak,
    longestStreak,
    adherenceTimezone,
    referenceDay,
    frozenDates,
    lapsed: row.lapsed,
    algorithmVersion: 1,
  };
}
