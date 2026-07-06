export function isRecommendationDataLoading({
  shelfLoading,
  profileLoading,
  prefsLoading,
}: {
  shelfLoading: boolean;
  profileLoading: boolean;
  prefsLoading: boolean;
}): boolean {
  return shelfLoading || profileLoading || prefsLoading;
}
