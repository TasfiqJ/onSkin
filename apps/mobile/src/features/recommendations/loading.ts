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

export function isRecommendationDataUnavailable({
  shelfError,
  profileError,
  prefsError,
  profileSource,
  consentCurrent,
}: {
  shelfError: boolean;
  profileError: boolean;
  prefsError: boolean;
  profileSource: 'local' | 'server' | 'unavailable' | null;
  consentCurrent: boolean | null;
}): boolean {
  return (
    shelfError ||
    profileError ||
    prefsError ||
    profileSource === 'unavailable' ||
    consentCurrent === false
  );
}
