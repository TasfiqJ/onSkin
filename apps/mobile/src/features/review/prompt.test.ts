import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { REVIEW_PROMPT_SETTLE_DELAY_MS, requestReviewAfterValue } from './prompt';

const mocks = vi.hoisted(() => ({
  healthGeneration: 1,
  healthOpen: true,
  appState: 'active',
  appVersion: '1.4.0',
  backgroundDuringUpdate: false,
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
        if (mocks.backgroundDuringUpdate) mocks.appState = 'background';
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

vi.mock('expo-application', () => ({
  get nativeApplicationVersion() {
    return mocks.appVersion;
  },
}));

vi.mock('react-native', () => ({
  AppState: {
    get currentState() {
      return mocks.appState;
    },
  },
}));

vi.mock('@/lib/analytics/track', () => ({
  track: mocks.track,
}));

vi.mock('@/lib/env', () => ({
  env: { phase8ReviewPromptEnabled: true },
}));

const KEY = 'layerwell.reviewPrompt.v1';
const NOW = new Date('2026-07-04T12:00:00.000Z');

describe('review prompt local history', () => {
  let timerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mocks.healthGeneration = 1;
    mocks.healthOpen = true;
    mocks.appState = 'active';
    mocks.appVersion = '1.4.0';
    mocks.backgroundDuringUpdate = false;
    mocks.storage.clear();
    mocks.hasAction.mockClear();
    mocks.hasAction.mockResolvedValue(true);
    mocks.requestReview.mockClear();
    mocks.requestReview.mockResolvedValue(undefined);
    mocks.setShouldReject = false;
    mocks.tails.clear();
    mocks.track.mockClear();
    timerSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation((callback) => {
      if (typeof callback === 'function') queueMicrotask(callback);
      return 1 as unknown as ReturnType<typeof setTimeout>;
    });
  });

  afterEach(() => {
    timerSpy.mockRestore();
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
      version: 2,
      state: { attemptedAt: [NOW.toISOString()], lastVersionPrompted: '1.4.0' },
    });
  });

  it('does not prompt if the attempt reservation cannot be saved', async () => {
    mocks.setShouldReject = true;

    await expect(requestReviewAfterValue('seven_checkoff_days', NOW)).resolves.toBeUndefined();

    expect(mocks.requestReview).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalledWith('review_prompt_attempted', expect.anything());
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('migrates canonical legacy history without losing cooldown or cap evidence', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify({
        version: 1,
        state: { attemptedAt: ['2026-06-20T12:00:00.000Z'] },
      }),
    );

    await requestReviewAfterValue('seven_checkoff_days', NOW);

    expect(mocks.hasAction).not.toHaveBeenCalled();
    expect(mocks.requestReview).not.toHaveBeenCalled();
    expect(mocks.track).toHaveBeenCalledWith('review_prompt_skipped', {
      moment: 'seven_checkoff_days',
      reason: 'cooldown',
    });
  });

  it('starts exact version history on the first eligible post-legacy attempt', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify({
        version: 1,
        state: { attemptedAt: ['2026-05-01T12:00:00.000Z'] },
      }),
    );

    await requestReviewAfterValue('seven_checkoff_days', NOW);

    expect(mocks.requestReview).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      version: 2,
      state: {
        attemptedAt: ['2026-05-01T12:00:00.000Z', NOW.toISOString()],
        lastVersionPrompted: '1.4.0',
      },
    });
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

    expect(mocks.requestReview).not.toHaveBeenCalled();
    expect(mocks.storage.get(KEY)).toContain('not-a-date');
    expect(mocks.track).toHaveBeenCalledWith('review_prompt_unavailable', {
      moment: 'seven_checkoff_days',
    });
  });

  it('serializes simultaneous callers so the native review prompt is requested once', async () => {
    await Promise.all(
      Array.from({ length: 20 }, () => requestReviewAfterValue('seven_checkoff_days', NOW)),
    );

    expect(mocks.requestReview).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      version: 2,
      state: { attemptedAt: [NOW.toISOString()], lastVersionPrompted: '1.4.0' },
    });
  });

  it('preserves future-version attempt history and never invokes native review', async () => {
    const original = JSON.stringify({
      version: 3,
      state: { attemptedAt: [], lastVersionPrompted: null },
    });
    mocks.storage.set(KEY, original);

    await requestReviewAfterValue('seven_checkoff_days', NOW);

    expect(mocks.hasAction).not.toHaveBeenCalled();
    expect(mocks.requestReview).not.toHaveBeenCalled();
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('preserves future-dated current history and never clears suppression evidence', async () => {
    const original = JSON.stringify({
      version: 2,
      state: {
        attemptedAt: ['2026-08-01T12:00:00.000Z'],
        lastVersionPrompted: '1.3.0',
      },
    });
    mocks.storage.set(KEY, original);

    await requestReviewAfterValue('seven_checkoff_days', NOW);

    expect(mocks.hasAction).not.toHaveBeenCalled();
    expect(mocks.requestReview).not.toHaveBeenCalled();
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('suppresses repeats for the same app version before checking StoreKit', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify({
        version: 2,
        state: {
          attemptedAt: ['2026-05-01T12:00:00.000Z'],
          lastVersionPrompted: '1.4.0',
        },
      }),
    );

    await requestReviewAfterValue('seven_checkoff_days', NOW);

    expect(mocks.hasAction).not.toHaveBeenCalled();
    expect(mocks.requestReview).not.toHaveBeenCalled();
    expect(mocks.track).toHaveBeenCalledWith('review_prompt_skipped', {
      moment: 'seven_checkoff_days',
      reason: 'already_prompted_for_version',
    });
  });

  it('fails closed when the native app version is unavailable', async () => {
    mocks.appVersion = '';

    await requestReviewAfterValue('seven_checkoff_days', NOW);

    expect(mocks.hasAction).not.toHaveBeenCalled();
    expect(mocks.requestReview).not.toHaveBeenCalled();
    expect(mocks.track).toHaveBeenCalledWith('review_prompt_skipped', {
      moment: 'seven_checkoff_days',
      reason: 'version_unavailable',
    });
  });

  it('waits for a natural pause and stays quiet if the app backgrounds', async () => {
    mocks.appState = 'background';

    await requestReviewAfterValue('seven_checkoff_days', NOW);

    expect(timerSpy).toHaveBeenCalledWith(expect.any(Function), REVIEW_PROMPT_SETTLE_DELAY_MS);
    expect(mocks.requestReview).not.toHaveBeenCalled();
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('never invokes StoreKit if the app backgrounds while reserving the attempt', async () => {
    mocks.backgroundDuringUpdate = true;

    await requestReviewAfterValue('seven_checkoff_days', NOW);

    expect(mocks.requestReview).not.toHaveBeenCalled();
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      version: 2,
      state: { attemptedAt: [NOW.toISOString()], lastVersionPrompted: '1.4.0' },
    });
    expect(mocks.track).toHaveBeenCalledWith('review_prompt_unavailable', {
      moment: 'seven_checkoff_days',
    });
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
