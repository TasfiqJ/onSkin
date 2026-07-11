import { describe, expect, it } from 'vitest';

import { routinePlanProfileLabel } from '@/features/scheduler/profileMapping';

describe('routine plan profile label', () => {
  it('labels the empty-shelf fallback as an example', () => {
    expect(routinePlanProfileLabel(null, true)).toBe('EXAMPLE ROUTINE');
  });

  it('does not fabricate dry sensitive copy for neutral profiles', () => {
    expect(
      routinePlanProfileLabel(
        { sensitivity: 'neutral', moisture: 'balanced', pregnancy: false, goals: [] },
        false,
      ),
    ).toBe('BUILT FROM YOUR SHELF');
  });

  it('reflects the real coarse profile when available', () => {
    expect(
      routinePlanProfileLabel(
        { sensitivity: 'resistant', moisture: 'oily', pregnancy: false, goals: [] },
        false,
      ),
    ).toBe('BUILT FOR OILY, RESISTANT SKIN');
  });

  it('marks pregnancy-aware plans without adding sensitive details', () => {
    expect(
      routinePlanProfileLabel(
        { sensitivity: 'sensitive', moisture: 'dry', pregnancy: true, goals: [] },
        false,
      ),
    ).toBe('BUILT FOR DRY, SENSITIVE, PREGNANCY-AWARE SKIN');
  });

  it('labels an unconfirmed cautious profile without inferring pregnancy', () => {
    expect(
      routinePlanProfileLabel(
        {
          sensitivity: 'neutral',
          moisture: 'balanced',
          pregnancy: false,
          pregnancySafety: 'caution',
          pregnancyStatus: 'prefer_not',
          goals: [],
        },
        false,
      ),
    ).toBe('BUILT FOR SAFETY-FIRST SKIN');
  });
});
