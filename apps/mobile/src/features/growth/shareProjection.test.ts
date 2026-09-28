import { describe, expect, it } from 'vitest';

import {
  CONFLICT_SHARE_PROJECTION_KEYS,
  CONFLICT_SHARE_PUBLIC_COPY,
  parseConflictShareProjection,
} from './shareProjection';

function validProjection(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    brandName: CONFLICT_SHARE_PUBLIC_COPY.brandName,
    eyebrow: CONFLICT_SHARE_PUBLIC_COPY.eyebrow,
    title: 'Use on different nights',
    severityLabel: 'Timing note',
    evidenceLabel: CONFLICT_SHARE_PUBLIC_COPY.evidenceLabel,
    claim: 'Spacing these cosmetic ingredients may make a routine easier to tolerate.',
    actionLabel: CONFLICT_SHARE_PUBLIC_COPY.actionLabel,
    attributionLabel: CONFLICT_SHARE_PUBLIC_COPY.attributionLabel,
    disclaimer: CONFLICT_SHARE_PUBLIC_COPY.disclaimer,
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
    ['public URL', { shareUrl: 'https://layerwell.app/s/forged' }],
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

  it.each([
    ['brand', { brandName: 'Trusted Skin Lab' }],
    ['eyebrow', { eyebrow: 'CLINICALLY PROVEN' }],
    ['review status', { evidenceLabel: 'Doctor approved' }],
    ['CTA', { actionLabel: 'Buy this now' }],
    ['watermark', { attributionLabel: 'trusted.example' }],
    ['disclaimer', { disclaimer: 'Guaranteed results.' }],
  ])('rejects caller-authored product-owned %s copy', (_label, replacement) => {
    expect(parseConflictShareProjection({ ...validProjection(), ...replacement })).toBeNull();
  });

  it.each([
    ['line break', 'Safe title\nPrivate suffix'],
    ['carriage return', 'Safe title\rPrivate suffix'],
    ['zero-width space', 'Safe\u200btitle'],
    ['right-to-left override', 'Safe\u202etitle'],
    ['word joiner', 'Safe\u2060title'],
  ])('rejects %s characters that can disguise reviewed card text', (_label, title) => {
    expect(parseConflictShareProjection({ ...validProjection(), title })).toBeNull();
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
