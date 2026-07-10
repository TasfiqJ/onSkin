import { describe, expect, it } from 'vitest';

import { toggleExclusiveNoneSelection } from './quiz';

describe('onboarding quiz multi-select behavior', () => {
  it('keeps the none option mutually exclusive with concrete sensitivities', () => {
    expect(toggleExclusiveNoneSelection([], 'none')).toEqual(['none']);
    expect(toggleExclusiveNoneSelection(['none'], 'fragrance')).toEqual(['fragrance']);
    expect(toggleExclusiveNoneSelection(['fragrance', 'alcohol'], 'none')).toEqual(['none']);
  });

  it('still lets concrete sensitivities be toggled independently', () => {
    expect(toggleExclusiveNoneSelection(['fragrance'], 'alcohol')).toEqual([
      'fragrance',
      'alcohol',
    ]);
    expect(toggleExclusiveNoneSelection(['fragrance', 'alcohol'], 'fragrance')).toEqual([
      'alcohol',
    ]);
  });
});
