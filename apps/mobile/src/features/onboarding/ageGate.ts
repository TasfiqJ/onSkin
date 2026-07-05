// Neutral age gate (docs/01 §4): PURE age math. We collect a date of birth, never
// "are you over X?" (which invites falsification), and block under-threshold users
// before any health-data collection. Minimum age is 16 globally: the doc's
// recommendation given health-data processing (GDPR digital-consent age; COPPA
// floor is 13). The exact threshold + any parental-consent path is a counsel
// decision (BLOCKERS: minors / B-PRIVACY). No RN/Supabase imports so this is
// unit-testable in the Node vitest env; the device flag lives in ageGateStore.ts.

export const MINIMUM_AGE = 16;
export const INVALID_DOB_MESSAGE = 'Enter a real birth date that is not in the future.';

export type Dob = { year: number; month: number; day: number };

/** Whole years between `dob` and `on` (caller passes today; keeps this pure). */
export function ageOn(dob: Dob, on: Date): number {
  let age = on.getFullYear() - dob.year;
  const beforeBirthday =
    on.getMonth() + 1 < dob.month || (on.getMonth() + 1 === dob.month && on.getDate() < dob.day);
  if (beforeBirthday) age -= 1;
  return age;
}

/** A real calendar date, not in the future, not absurdly old. Rejects 2026-02-30. */
export function isValidDob(dob: Dob, on: Date): boolean {
  const { year, month, day } = dob;
  if (![year, month, day].every((n) => Number.isInteger(n))) return false;
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  // Reject overflow (e.g. Feb 30 rolls into March).
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return false;
  return d.getTime() <= on.getTime();
}

export function meetsMinimumAge(dob: Dob, on: Date): boolean {
  return isValidDob(dob, on) && ageOn(dob, on) >= MINIMUM_AGE;
}

export function getDobValidationError(dob: Dob, on: Date, complete: boolean): string | null {
  if (!complete || isValidDob(dob, on)) return null;
  return INVALID_DOB_MESSAGE;
}
