import type { RecPreferences } from './preferences';

type ApplyRecommendationPreferencesDeps = {
  save: (prefs: RecPreferences) => Promise<void>;
  onSaved: () => void | Promise<void>;
  onFailure: () => void | Promise<void>;
};

export async function applyRecommendationPreferences(
  next: RecPreferences,
  deps: ApplyRecommendationPreferencesDeps,
): Promise<boolean> {
  try {
    await deps.save(next);
  } catch {
    await deps.onFailure();
    return false;
  }

  await deps.onSaved();
  return true;
}
