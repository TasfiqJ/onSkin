import { afterEach, describe, expect, it } from 'vitest';

import {
  canUseRoutineCadence,
  canUseRoutineSequencing,
  ROUTINE_CADENCE_REVIEWED,
} from './reviewGate';
import { SEQUENCING_RULES, shippableSequencingRules } from './sequencing';

afterEach(() => {
  delete (globalThis as { __DEV__?: boolean }).__DEV__;
  delete process.env.EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE;
  delete process.env.EXPO_PUBLIC_E2E_ROUTINE_SEQUENCING_REVIEW_GATE;
});

describe('routine cadence review gate', () => {
  it('keeps unreviewed cadence available in dev for buildability', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;

    expect(ROUTINE_CADENCE_REVIEWED).toBe(false);
    expect(canUseRoutineCadence()).toBe(true);
  });

  it('withholds cadence outside dev until clinical review flips the gate', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;

    expect(ROUTINE_CADENCE_REVIEWED).toBe(false);
    expect(canUseRoutineCadence()).toBe(false);
  });

  it('can force the unreviewed cadence gate closed in dev for E2E coverage', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    process.env.EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE = 'closed';

    expect(ROUTINE_CADENCE_REVIEWED).toBe(false);
    expect(canUseRoutineCadence()).toBe(false);
  });

  it('does not let the E2E fixture open unreviewed cadence outside dev', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    process.env.EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE = 'open';

    expect(ROUTINE_CADENCE_REVIEWED).toBe(false);
    expect(canUseRoutineCadence()).toBe(false);
  });
});

describe('routine sequencing review gate', () => {
  it('withholds every unreviewed starter role outside development', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;

    expect(shippableSequencingRules()).toEqual({});
    expect(canUseRoutineSequencing()).toBe(false);
    expect(canUseRoutineSequencing(SEQUENCING_RULES)).toBe(false);
  });

  it('makes starter sequencing available only under an explicit dev runtime', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;

    expect(Object.keys(shippableSequencingRules())).toHaveLength(
      Object.keys(SEQUENCING_RULES).length,
    );
    expect(canUseRoutineSequencing()).toBe(true);
  });

  it('can force the sequencing gate closed in development without creating a production open flag', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    process.env.EXPO_PUBLIC_E2E_ROUTINE_SEQUENCING_REVIEW_GATE = 'closed';

    expect(shippableSequencingRules()).toEqual({});
    expect(canUseRoutineSequencing()).toBe(false);

    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    process.env.EXPO_PUBLIC_E2E_ROUTINE_SEQUENCING_REVIEW_GATE = 'open';
    expect(shippableSequencingRules()).toEqual({});
    expect(canUseRoutineSequencing()).toBe(false);
  });

  it('admits only individually reviewed roles in production', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    const reviewedCleanser = {
      ...SEQUENCING_RULES.cleanser,
      reviewedBy: 'B-DERM-REVIEW',
    };
    const filtered = shippableSequencingRules({
      cleanser: reviewedCleanser,
      moisturiser: SEQUENCING_RULES.moisturiser,
    });

    expect(filtered).toEqual({ cleanser: reviewedCleanser });
    expect(canUseRoutineSequencing(filtered)).toBe(true);
  });

  it('does not let reviewed metadata for one role authorize a different role', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    const mismatched = {
      ...SEQUENCING_RULES.cleanser,
      reviewedBy: 'B-DERM-REVIEW',
    };

    expect(shippableSequencingRules({ moisturiser: mismatched })).toEqual({});
  });
});
