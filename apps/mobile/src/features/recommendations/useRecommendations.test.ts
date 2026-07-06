import { describe, expect, it } from 'vitest';

import { isRecommendationDataLoading } from './loading';

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
