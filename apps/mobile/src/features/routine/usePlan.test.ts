import { describe, expect, it } from 'vitest';

import { routinePlanProfileLabel } from '@/features/scheduler/profileMapping';

import { routineGenerationProfileForRealShelf } from './planProfileAdmission';

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

describe('real-shelf generation profile admission', () => {
  it('refuses to substitute the example profile when the profile source is missing', () => {
    expect(routineGenerationProfileForRealShelf(undefined)).toBeNull();
  });

  it('refuses to publish from the explicit unavailable profile sentinel', () => {
    expect(
      routineGenerationProfileForRealShelf({
        source: 'unavailable',
        sensitivity: 'neutral',
        moisture: 'balanced',
        pregnancyStatus: 'unknown',
        pregnancySafety: 'caution',
        pregnancy: false,
        consentCurrent: true,
        goals: [],
      }),
    ).toBeNull();
  });

  it('maps an available current profile without adding synthetic example values', () => {
    expect(
      routineGenerationProfileForRealShelf({
        source: 'local',
        sensitivity: 'resistant',
        moisture: 'oily',
        pregnancyStatus: 'none',
        pregnancySafety: 'clear',
        pregnancy: false,
        consentCurrent: true,
        goals: ['clear_skin'],
      }),
    ).toEqual({
      sensitivity: 'resistant',
      pregnancy: false,
      reproductiveStatus: 'none',
      pregnancySafety: 'clear',
      pregnancyStatus: 'none',
      goals: ['clear_skin'],
    });
  });
});
