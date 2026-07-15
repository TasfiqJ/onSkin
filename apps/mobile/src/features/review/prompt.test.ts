import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requestReviewAfterValue } from './prompt';

const mocks = vi.hoisted(() => ({
  healthGeneration: 1,
  healthOpen: true,
  storage: new Map<string, string>(),
  hasAction: vi.fn(async () => true),
  requestReview: vi.fn(async () => undefined),
  setShouldReject: false,
  tails: new Map<string, Promise<void>>(),
  track: vi.fn(),
}));

vi.mock('@/lib/consent/healthDataWriteAdmission', () => ({
  runCurrentHealthDataOperation: async (
    operation: (lease: { assertCurrent: () => void }) => unknown,
  ) => {
    if (!mocks.healthOpen) throw new Error('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    const generation = mocks.healthGeneration;
    const assertCurrent = () => {
      if (!mocks.healthOpen || generation !== mocks.healthGeneration) {
        throw new Error('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
      }
    };
    const result = await operation({ assertCurrent });
    assertCurrent();
    return result;
  },
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
  updatePrivateItem: vi.fn(
    async (key: string, updater: (current: string | null) => string | null) => {
      const previous = mocks.tails.get(key) ?? Promise.resolve();
      let release!: () => void;
      const tail = new Promise<void>((resolve) => {
        release = resolve;
      });
      mocks.tails.set(key, tail);
      await previous;
      try {
        if (mocks.setShouldReject) throw new Error('storage unavailable');
        const next = updater(mocks.storage.get(key) ?? null);
        if (next === null) mocks.storage.delete(key);
        else mocks.storage.set(key, next);
      } finally {
        release();
        if (mocks.tails.get(key) === tail) mocks.tails.delete(key);
      }
    },
  ),
}));

vi.mock('expo-store-review', () => ({
  hasAction: mocks.hasAction,
  requestReview: mocks.requestReview,
}));

vi.mock('@/lib/analytics/track', () => ({
  track: mocks.track,
}));

vi.mock('@/lib/env', () => ({
  env: { phase8ReviewPromptEnabled: true },
}));

const KEY = 'onskin.reviewPrompt.v1';
const NOW = new Date('2026-07-04T12:00:00.000Z');

describe('review prompt local history', () => {
  beforeEach(() => {
    mocks.healthGeneration = 1;
    mocks.healthOpen = true;
    mocks.storage.clear();
    mocks.hasAction.mockClear();
    mocks.hasAction.mockResolvedValue(true);
    mocks.requestReview.mockClear();
    mocks.requestReview.mockResolvedValue(undefined);
    mocks.setShouldReject = false;
    mocks.tails.clear();
    mocks.track.mockClear();
  });

  it('preserves unreadable local history and suppresses the native prompt', async () => {
    const original = '{not-json';
    mocks.storage.set(KEY, original);

    await requestReviewAfterValue('seven_checkoff_days', NOW);

    expect(mocks.requestReview).not.toHaveBeenCalled();
    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.track).toHaveBeenCalledWith('review_prompt_unavailable', {
      moment: 'seven_checkoff_days',
    });
  });

  it('preserves wrong-shaped local history before checking platform availability', async () => {
    mocks.hasAction.mockResolvedValue(false);
    const original = JSON.stringify(['2026-06-01T12:00:00.000Z']);
    mocks.storage.set(KEY, original);

    await requestReviewAfterValue('seven_checkoff_days', NOW);

    expect(mocks.requestReview).not.toHaveBeenCalled();
    expect(mocks.hasAction).not.toHaveBeenCalled();
    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.track).toHaveBeenCalledWith('review_prompt_unavailable', {
      moment: 'seven_checkoff_days',
    });
  });

  it('skips privacy and payment moments without touching the native prompt API', async () => {
    for (const moment of ['data_export_success', 'paid_conversion_success'] as const) {
      await requestReviewAfterValue(moment, NOW);
    }

    expect(mocks.hasAction).not.toHaveBeenCalled();
    expect(mocks.requestReview).not.toHaveBeenCalled();
    expect(mocks.track).toHaveBeenCalledWith('review_prompt_skipped', {
      moment: 'data_export_success',
      reason: 'not_value_moment',
    });
    expect(mocks.track).toHaveBeenCalledWith('review_prompt_skipped', {
      moment: 'paid_conversion_success',
      reason: 'not_value_moment',
    });
  });

  it('treats platform availability errors as unavailable instead of throwing', async () => {
    mocks.hasAction.mockRejectedValueOnce(new Error('native module failed'));

    await expect(requestReviewAfterValue('first_reviewed_conflict', NOW)).resolves.toBeUndefined();

    expect(mocks.requestReview).not.toHaveBeenCalled();
    expect(mocks.track).toHaveBeenCalledWith('review_prompt_unavailable', {
      moment: 'first_reviewed_conflict',
    });
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('records a local attempt even when the native review request rejects', async () => {
    mocks.requestReview.mockRejectedValueOnce(new Error('prompt failed'));

    await expect(requestReviewAfterValue('first_reviewed_conflict', NOW)).resolves.toBeUndefined();

    expect(mocks.track).toHaveBeenCalledWith('review_prompt_attempted', {
      moment: 'first_reviewed_conflict',
    });
    expect(mocks.track).toHaveBeenCalledWith('review_prompt_unavailable', {
      moment: 'first_reviewed_conflict',
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      version: 1,
      state: { attemptedAt: [NOW.toISOString()] },
    });
  });

  it('does not prompt if the attempt reservation cannot be saved', async () => {
    mocks.setShouldReject = true;

    await expect(requestReviewAfterValue('seven_checkoff_days', NOW)).resolves.toBeUndefined();

    expect(mocks.requestReview).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalledWith('review_prompt_attempted', expect.anything());
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('drops invalid, duplicate, and future-dated attempts before policy reads them', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify({
        attemptedAt: [
          '2026-06-01T12:00:00.000Z',
          'not-a-date',
          '2026-06-01T12:00:00.000Z',
          '2026-08-01T12:00:00.000Z',
        ],
      }),
    );

    await requestReviewAfterValue('seven_checkoff_days', NOW);

    expect(mocks.requestReview).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      version: 1,
      state: { attemptedAt: ['2026-06-01T12:00:00.000Z', NOW.toISOString()] },
    });
  });

  it('serializes simultaneous callers so the native review prompt is requested once', async () => {
    await Promise.all(
      Array.from({ length: 20 }, () => requestReviewAfterValue('seven_checkoff_days', NOW)),
    );

    expect(mocks.requestReview).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      version: 1,
      state: { attemptedAt: [NOW.toISOString()] },
    });
  });

  it('preserves future-version attempt history and never invokes native review', async () => {
    const original = JSON.stringify({ version: 2, state: { attemptedAt: [] } });
    mocks.storage.set(KEY, original);

    await requestReviewAfterValue('seven_checkoff_days', NOW);

    expect(mocks.hasAction).not.toHaveBeenCalled();
    expect(mocks.requestReview).not.toHaveBeenCalled();
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('never invokes the native prompt when withdrawal lands during availability', async () => {
    let release!: (available: boolean) => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    mocks.hasAction.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          release = resolve;
          markStarted();
        }),
    );

    const prompting = requestReviewAfterValue('seven_checkoff_days', NOW);
    await started;
    mocks.healthGeneration += 1;
    release(true);

    await expect(prompting).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    expect(mocks.requestReview).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalledWith('review_prompt_attempted', expect.anything());
  });
});
