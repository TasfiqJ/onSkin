import { beforeEach, describe, expect, it, vi } from 'vitest';

import { applyRecommendationPreferences } from './applyPreferences';
import type { RecPreferences } from './preferences';

const next: RecPreferences = {
  values: ['fragrance_free'],
  budget: 'mid',
  formats: ['cream'],
};

const deps = {
  save: vi.fn<(prefs: RecPreferences) => Promise<void>>(),
  onSaved: vi.fn<() => void>(),
  onFailure: vi.fn<() => void>(),
};

describe('recommendation preference application', () => {
  beforeEach(() => {
    deps.save.mockReset();
    deps.onSaved.mockReset();
    deps.onFailure.mockReset();
    deps.save.mockResolvedValue(undefined);
  });

  it('saves preferences before applying visible state', async () => {
    await expect(applyRecommendationPreferences(next, deps)).resolves.toBe(true);

    expect(deps.save).toHaveBeenCalledWith(next);
    expect(deps.onSaved).toHaveBeenCalledTimes(1);
    expect(deps.onFailure).not.toHaveBeenCalled();
  });

  it('fails closed when local preference persistence rejects', async () => {
    deps.save.mockRejectedValueOnce(new Error('private storage unavailable'));

    await expect(applyRecommendationPreferences(next, deps)).resolves.toBe(false);

    expect(deps.onFailure).toHaveBeenCalledTimes(1);
    expect(deps.onSaved).not.toHaveBeenCalled();
  });
});
