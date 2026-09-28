import { describe, expect, it } from 'vitest';

import { hasExplicitFragranceMarker } from './fragrance';
import { isRecommendationDataLoading, isRecommendationDataUnavailable } from './loading';

function shelfProduct(
  name: string,
  ingredients: string[] = [],
): Parameters<typeof hasExplicitFragranceMarker>[0] {
  return { name, ingredients };
}

describe('recommendation data loading state', () => {
  it('keeps recommendations loading while private preferences and dismissals load', () => {
    expect(
      isRecommendationDataLoading({
        shelfLoading: false,
        profileLoading: false,
        prefsLoading: true,
      }),
    ).toBe(true);
  });

  it('waits for all recommendation inputs before rendering results', () => {
    expect(
      isRecommendationDataLoading({
        shelfLoading: false,
        profileLoading: false,
        prefsLoading: false,
      }),
    ).toBe(false);

    expect(
      isRecommendationDataLoading({
        shelfLoading: true,
        profileLoading: false,
        prefsLoading: false,
      }),
    ).toBe(true);

    expect(
      isRecommendationDataLoading({
        shelfLoading: false,
        profileLoading: true,
        prefsLoading: false,
      }),
    ).toBe(true);
  });
});

describe('recommendation data availability', () => {
  const ready = {
    shelfError: false,
    profileError: false,
    prefsError: false,
    profileSource: 'local' as const,
    consentCurrent: true,
  };

  it('admits only verified profile, shelf, preference, and consent inputs', () => {
    expect(isRecommendationDataUnavailable(ready)).toBe(false);
    expect(isRecommendationDataUnavailable({ ...ready, shelfError: true })).toBe(true);
    expect(isRecommendationDataUnavailable({ ...ready, profileError: true })).toBe(true);
    expect(isRecommendationDataUnavailable({ ...ready, prefsError: true })).toBe(true);
    expect(isRecommendationDataUnavailable({ ...ready, profileSource: 'unavailable' })).toBe(true);
    expect(isRecommendationDataUnavailable({ ...ready, consentCurrent: false })).toBe(true);
  });
});

describe('fragrance marker admission', () => {
  it('accepts an explicit fragrance or parfum marker from saved shelf details', () => {
    expect(hasExplicitFragranceMarker(shelfProduct('Cleanser', ['Aqua', 'Parfum']))).toBe(true);
    expect(hasExplicitFragranceMarker(shelfProduct('Rose Perfume Cleanser'))).toBe(true);
  });

  it('does not invert fragrance-free or no-fragrance wording', () => {
    expect(hasExplicitFragranceMarker(shelfProduct('Fragrance-Free Cleanser'))).toBe(false);
    expect(hasExplicitFragranceMarker(shelfProduct('Cleanser', ['No added fragrance']))).toBe(
      false,
    );
    expect(hasExplicitFragranceMarker(shelfProduct('Cleanser', ['Without perfume']))).toBe(false);
  });
});
