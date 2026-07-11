import { describe, expect, it } from 'vitest';

import { STARTER_RULES } from './rules';
import { pregnancySafetyModeForStatus, pregnancySafetyReasonForProduct } from './pregnancySafety';

describe('pregnancy safety clearance', () => {
  it.each([
    ['none', 'clear'],
    ['pregnant', 'caution'],
    ['breastfeeding', 'caution'],
    ['prefer_not', 'caution'],
    ['unknown', 'caution'],
  ] as const)('maps %s to %s', (status, expected) => {
    expect(pregnancySafetyModeForStatus(status)).toBe(expected);
  });

  it('excludes every repository-defined caution class until status is clear', () => {
    expect(pregnancySafetyReasonForProduct({ tags: ['retinoid'] }, 'caution', STARTER_RULES)).toBe(
      'retinoid',
    );
    expect(
      pregnancySafetyReasonForProduct({ tags: ['hydroquinone'] }, 'caution', STARTER_RULES),
    ).toBe('hydroquinone');
    expect(
      pregnancySafetyReasonForProduct(
        { tags: ['bha'], concentration: 'high' },
        'caution',
        STARTER_RULES,
      ),
    ).toBe('bha_not_confirmed_low');
    expect(pregnancySafetyReasonForProduct({ tags: ['bha'] }, 'caution', STARTER_RULES)).toBe(
      'bha_not_confirmed_low',
    );
  });

  it('keeps confirmed-low BHA and every product in a clear profile eligible', () => {
    expect(
      pregnancySafetyReasonForProduct(
        { tags: ['bha'], concentration: 'low' },
        'caution',
        STARTER_RULES,
      ),
    ).toBeNull();
    expect(
      pregnancySafetyReasonForProduct(
        { tags: ['retinoid'], concentration: 'high' },
        'clear',
        STARTER_RULES,
      ),
    ).toBeNull();
  });

  it('does not bypass the production clinical-review gate', () => {
    expect(pregnancySafetyReasonForProduct({ tags: ['retinoid'] }, 'caution', [])).toBeNull();
    expect(pregnancySafetyReasonForProduct({ tags: ['hydroquinone'] }, 'caution', [])).toBeNull();
    expect(
      pregnancySafetyReasonForProduct({ tags: ['bha'], concentration: 'high' }, 'caution', []),
    ).toBeNull();
  });
});
