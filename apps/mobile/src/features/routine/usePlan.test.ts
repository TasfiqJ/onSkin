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

  it('does not put reproductive-status data in the glanceable subtitle', () => {
    expect(
      routinePlanProfileLabel(
        {
          sensitivity: 'sensitive',
          moisture: 'dry',
          pregnancy: true,
          pregnancyStatus: 'pregnant',
          goals: [],
        },
        false,
      ),
    ).toBe('BUILT FOR DRY, SENSITIVE SKIN');
  });

  for (const pregnancyStatus of [
    'breastfeeding',
    'trying',
    'unknown',
    'prefer_not',
    'none',
  ] as const) {
    it(`does not collapse ${pregnancyStatus} into pregnancy or generic safety copy`, () => {
      expect(
        routinePlanProfileLabel(
          {
            sensitivity: 'neutral',
            moisture: 'balanced',
            pregnancy: pregnancyStatus === 'breastfeeding',
            pregnancySafety: pregnancyStatus === 'none' ? 'clear' : 'caution',
            pregnancyStatus,
            goals: [],
          },
          false,
        ),
      ).toBe('BUILT FROM YOUR SHELF');
    });
  }
});
