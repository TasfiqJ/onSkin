import { afterEach, describe, expect, it } from 'vitest';

import {
  canUseRoutineCadence,
  canUseRoutineExplainabilityCopy,
  canUseRoutineRecovery,
  canUseRoutineSequencing,
} from './reviewGate';
import {
  ROUTINE_SEQUENCING_CORPUS,
  SEQUENCING_RULES,
  shippableSequencingRules,
} from './sequencing';

afterEach(() => {
  delete (globalThis as { __DEV__?: boolean }).__DEV__;
  delete process.env.EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE;
  delete process.env.EXPO_PUBLIC_E2E_ROUTINE_RECOVERY_REVIEW_GATE;
  delete process.env.EXPO_PUBLIC_E2E_ROUTINE_EXPLAINABILITY_COPY_GATE;
  delete process.env.EXPO_PUBLIC_E2E_ROUTINE_SEQUENCING_REVIEW_GATE;
});

describe('routine cadence review gate', () => {
  it('keeps unreviewed cadence available in dev for buildability', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;

    expect(ROUTINE_SEQUENCING_CORPUS.status).toBe('draft_blocked');
    expect(canUseRoutineCadence()).toBe(true);
  });

  it('withholds cadence outside dev until clinical review flips the gate', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;

    expect(ROUTINE_SEQUENCING_CORPUS.status).toBe('draft_blocked');
    expect(canUseRoutineCadence()).toBe(false);
  });

  it('can force the unreviewed cadence gate closed in dev for E2E coverage', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    process.env.EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE = 'closed';

    expect(ROUTINE_SEQUENCING_CORPUS.status).toBe('draft_blocked');
    expect(canUseRoutineCadence()).toBe(false);
  });

  it('does not let the E2E fixture open unreviewed cadence outside dev', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    process.env.EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE = 'open';

    expect(ROUTINE_SEQUENCING_CORPUS.status).toBe('draft_blocked');
    expect(canUseRoutineCadence()).toBe(false);
  });

  it('keeps recovery closed when stop/refer is unavailable', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;

    expect(canUseRoutineCadence()).toBe(true);
    expect(canUseRoutineRecovery()).toBe(false);
  });

  it('allows only an explicit development recovery fixture, never a production flag', () => {
    process.env.EXPO_PUBLIC_E2E_ROUTINE_RECOVERY_REVIEW_GATE = 'open_fixture';
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    expect(canUseRoutineRecovery()).toBe(true);

    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    expect(canUseRoutineRecovery()).toBe(false);
  });

  it('keeps unbound explainability copy closed except for an explicit dev fixture', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    expect(canUseRoutineExplainabilityCopy()).toBe(false);

    process.env.EXPO_PUBLIC_E2E_ROUTINE_EXPLAINABILITY_COPY_GATE = 'open_fixture';
    expect(canUseRoutineExplainabilityCopy()).toBe(true);

    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    expect(canUseRoutineExplainabilityCopy()).toBe(false);
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

  it('does not treat a free-text reviewer identity as production admission', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    const reviewedCleanser = {
      ...SEQUENCING_RULES.cleanser,
      reviewedBy: 'B-DERM-REVIEW',
    };
    const filtered = shippableSequencingRules({
      cleanser: reviewedCleanser,
      moisturiser: SEQUENCING_RULES.moisturiser,
    });

    expect(filtered).toEqual({});
    expect(canUseRoutineSequencing(filtered)).toBe(false);
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
