import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  AGE_POLICY_CANONICAL,
  AGE_POLICY_REVIEW_STATUS,
  AGE_POLICY_SHA256,
  AGE_POLICY_TUPLE,
  ageOn,
  getDobValidationError,
  INVALID_DOB_MESSAGE,
  isValidDob,
  meetsMinimumAge,
  MINIMUM_AGE,
} from './ageGate';

const today = new Date(2026, 5, 25); // 2026-06-25 (local)

describe('neutral age gate (docs/01 §4)', () => {
  it('pins the current draft-blocked semantic policy tuple', () => {
    expect(MINIMUM_AGE).toBe(16);
    expect(AGE_POLICY_REVIEW_STATUS).toBe('draft_blocked');
    expect(AGE_POLICY_TUPLE).toEqual([
      'policy=neutral_dob_eligibility',
      'version=draft-v1',
      'scope=global',
      'minimum_years=16',
      'parental_consent_path=none',
      'review_status=draft_blocked',
    ]);
    expect(AGE_POLICY_CANONICAL).toBe(AGE_POLICY_TUPLE.join('\n'));
    expect(createHash('sha256').update(AGE_POLICY_CANONICAL, 'utf8').digest('hex')).toBe(
      AGE_POLICY_SHA256,
    );
  });

  it('computes age accounting for whether the birthday has passed this year', () => {
    expect(ageOn({ year: 2000, month: 1, day: 1 }, today)).toBe(26); // birthday passed
    expect(ageOn({ year: 2000, month: 12, day: 31 }, today)).toBe(25); // not yet this year
    expect(ageOn({ year: 2000, month: 6, day: 25 }, today)).toBe(26); // birthday is today
  });

  it('blocks just under the minimum and admits exactly at it', () => {
    const justUnder = { year: today.getFullYear() - MINIMUM_AGE, month: 12, day: 31 };
    const exactly = { year: today.getFullYear() - MINIMUM_AGE, month: 1, day: 1 };
    expect(meetsMinimumAge(justUnder, today)).toBe(false);
    expect(meetsMinimumAge(exactly, today)).toBe(true);
  });

  it('rejects impossible, future, and absurdly old dates', () => {
    expect(isValidDob({ year: 2026, month: 2, day: 30 }, today)).toBe(false); // Feb 30
    expect(isValidDob({ year: 2030, month: 1, day: 1 }, today)).toBe(false); // future
    expect(isValidDob({ year: 1850, month: 1, day: 1 }, today)).toBe(false); // pre-1900
    expect(isValidDob({ year: 2000, month: 6, day: 15 }, today)).toBe(true);
  });

  it('returns user-facing guidance only after a completed invalid date', () => {
    expect(getDobValidationError({ year: 2026, month: 2, day: 30 }, today, true)).toBe(
      INVALID_DOB_MESSAGE,
    );
    expect(getDobValidationError({ year: 2000, month: 6, day: 15 }, today, true)).toBeNull();
    expect(getDobValidationError({ year: 0, month: 2, day: 30 }, today, false)).toBeNull();
  });
});
