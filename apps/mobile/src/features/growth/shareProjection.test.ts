import { describe, expect, it } from 'vitest';

import { CONFLICT_SHARE_PROJECTION_KEYS, parseConflictShareProjection } from './shareProjection';

function validProjection(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    brandName: 'RoutineKind',
    eyebrow: 'SHELF CHECK',
    title: 'Use on different nights',
    severityLabel: 'Timing note',
    evidenceLabel: 'Reviewed guidance',
    claim: 'Spacing these cosmetic ingredients may make a routine easier to tolerate.',
    actionLabel: 'Check your own shelf',
    attributionLabel: 'routinekind.app',
    disclaimer: 'General cosmetic information, not medical advice.',
    tone: 'caution',
  };
}

describe('conflict share projection', () => {
  it('copies and freezes only the exact public allowlist', () => {
    const input = validProjection();
    const parsed = parseConflictShareProjection(input);

    expect(parsed).toEqual(input);
    expect(parsed).not.toBe(input);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.keys(parsed ?? {}).sort()).toEqual([...CONFLICT_SHARE_PROJECTION_KEYS].sort());
  });

  it('supports a reassuring projection without a severity label', () => {
    expect(
      parseConflictShareProjection({
        ...validProjection(),
        severityLabel: null,
        tone: 'reassuring',
      }),
    ).toMatchObject({ severityLabel: null, tone: 'reassuring' });
  });

  it.each([
    ['product name', { productName: 'Private Product' }],
    ['product id', { productId: 'private-product-id' }],
    ['Shelf id', { shelfItemId: 'private-shelf-id' }],
    ['rule metadata', { ruleId: 'private-rule-id' }],
    ['profile', { skinProfile: { sensitivity: 'high' } }],
    ['goal', { goals: ['acne'] }],
    ['safety state', { pregnancyStatus: 'pregnant' }],
    ['reviewer metadata', { reviewedBy: 'Dr Private' }],
    ['account id', { userId: 'private-user-id' }],
    ['public URL', { shareUrl: 'https://routinekind.app/s/forged' }],
    ['arbitrary extra', { extra: true }],
  ])(
    'rejects the exact projection when it contains a private or extra %s field',
    (_label, extra) => {
      expect(parseConflictShareProjection({ ...validProjection(), ...extra })).toBeNull();
    },
  );

  it('rejects missing, blank, overlong, malformed, and non-object payloads', () => {
    const { claim: _claim, ...missingClaim } = validProjection();

    expect(parseConflictShareProjection(missingClaim)).toBeNull();
    expect(parseConflictShareProjection({ ...validProjection(), title: '   ' })).toBeNull();
    expect(
      parseConflictShareProjection({ ...validProjection(), claim: 'x'.repeat(601) }),
    ).toBeNull();
    expect(parseConflictShareProjection({ ...validProjection(), tone: 'urgent' })).toBeNull();
    expect(parseConflictShareProjection({ ...validProjection(), schemaVersion: 2 })).toBeNull();
    expect(parseConflictShareProjection(null)).toBeNull();
    expect(parseConflictShareProjection([])).toBeNull();
  });

  it('rejects accessor-backed fields without invoking them', () => {
    const input = validProjection();
    let getterRead = false;
    Object.defineProperty(input, 'claim', {
      enumerable: true,
      get() {
        getterRead = true;
        return 'Private getter value';
      },
    });

    expect(parseConflictShareProjection(input)).toBeNull();
    expect(getterRead).toBe(false);
  });
});
