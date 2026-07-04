import { describe, expect, it, afterEach, beforeEach } from 'vitest';

import { shippableNotes } from '@/features/community/notes';
import { shippableStacks } from '@/features/commerce/stacks';
import { reviewedCategoryPao } from '@/features/intelligence/pao';
import { shippableRules } from '@/features/intelligence/rules';
import { shippableRecTypes } from '@/features/recommendations/catalog';

const runtime = globalThis as typeof globalThis & { __DEV__?: boolean };

describe('Phase 3 launch gates keep unreviewed clinical-adjacent content out of production', () => {
  beforeEach(() => {
    delete runtime.__DEV__;
  });

  afterEach(() => {
    delete runtime.__DEV__;
  });

  it('withholds unreviewed conflict rules, PAO defaults, notes, and stacks', () => {
    expect(shippableRules()).toHaveLength(0);
    expect(reviewedCategoryPao('spf')).toBeNull();
    expect(shippableNotes()).toHaveLength(0);
    expect(shippableStacks()).toHaveLength(0);
  });

  it('ships only structural recommendations until derm review is recorded', () => {
    const recs = shippableRecTypes();

    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every((rec) => !rec.medicalAdjacent || rec.reviewedBy != null)).toBe(true);
    expect(recs.some((rec) => rec.medicalAdjacent)).toBe(false);
  });

  it('keeps dev/demo content available only when the dev flag is explicit', () => {
    runtime.__DEV__ = true;

    expect(shippableRules().length).toBeGreaterThan(0);
    expect(reviewedCategoryPao('spf')).toBe(12);
    expect(shippableNotes().length).toBeGreaterThan(0);
    expect(shippableStacks().length).toBeGreaterThan(0);
    expect(shippableRecTypes().some((rec) => rec.medicalAdjacent)).toBe(true);
  });
});
