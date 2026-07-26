import { describe, expect, it, afterEach, beforeEach } from 'vitest';

import { shippableNotes } from '@/features/community/notes';
import { shippableStacks } from '@/features/commerce/stacks';
import { shippableRules } from '@/features/intelligence/rules';
import { shippableRecTypes } from '@/features/recommendations/catalog';
import { SEQUENCING_RULES, shippableSequencingRules } from '@/features/routine/sequencing';

const runtime = globalThis as typeof globalThis & { __DEV__?: boolean };

describe('Phase 3 runtime gates withhold covered conflict, recommendation, note, and stack content', () => {
  beforeEach(() => {
    delete runtime.__DEV__;
  });

  afterEach(() => {
    delete runtime.__DEV__;
  });

  it('withholds unreviewed conflict rules, sequencing, notes, and stacks', () => {
    expect(shippableRules()).toHaveLength(0);
    expect(shippableSequencingRules()).toEqual({});
    expect(shippableNotes()).toHaveLength(0);
    expect(shippableStacks()).toHaveLength(0);
  });

  it('ships only structural recommendations until derm review is recorded', () => {
    const recs = shippableRecTypes();

    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every((rec) => !rec.medicalAdjacent || rec.reviewedBy != null)).toBe(true);
    expect(recs.some((rec) => rec.medicalAdjacent)).toBe(false);
  });

  it('keeps the conflict corpus closed in dev while other legacy demos remain explicit', () => {
    runtime.__DEV__ = true;

    expect(shippableRules()).toEqual([]);
    expect(Object.keys(shippableSequencingRules())).toHaveLength(
      Object.keys(SEQUENCING_RULES).length,
    );
    expect(shippableNotes().length).toBeGreaterThan(0);
    expect(shippableStacks().length).toBeGreaterThan(0);
    expect(shippableRecTypes().some((rec) => rec.medicalAdjacent)).toBe(true);
  });
});
