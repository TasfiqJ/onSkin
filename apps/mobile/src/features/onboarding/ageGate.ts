// Neutral age gate (docs/01 section 4): pure age math with no storage imports.
// The current 16+ behavior remains a draft launch assumption, not an approved
// legal conclusion. The exact threshold and any parental-consent path remain
// blocked on the documented founder/counsel decision.

export const MINIMUM_AGE = 16;
export const INVALID_DOB_MESSAGE = 'Enter a real birth date that is not in the future.';
export const AGE_POLICY_REVIEW_STATUS = 'draft_blocked' as const;
export const AGE_POLICY_RECEIPT_KEY = 'onskin.ageVerified' as const;

/**
 * Canonical semantic policy tuple. Its order and newline encoding are part of
 * the receipt contract; changing any policy decision requires a new pinned hash.
 */
export const AGE_POLICY_TUPLE = Object.freeze([
  'policy=neutral_dob_eligibility',
  'version=draft-v1',
  'scope=global',
  `minimum_years=${MINIMUM_AGE}`,
  'parental_consent_path=none',
  `review_status=${AGE_POLICY_REVIEW_STATUS}`,
] as const);

export const AGE_POLICY_CANONICAL = AGE_POLICY_TUPLE.join('\n');
export const AGE_POLICY_SHA256 =
  '213a9fa27a479d336ca74edb858d780d568abf4166a43b586dd8bdc48f62fb1e' as const;

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
