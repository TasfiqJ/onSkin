import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requestReviewAfterValue } from './prompt';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  hasAction: vi.fn(async () => true),
  requestReview: vi.fn(async () => undefined),
  setShouldReject: false,
  track: vi.fn(),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    if (mocks.setShouldReject) throw new Error('storage unavailable');
    mocks.storage.set(key, value);
  }),
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.storage.delete(key);
  }),
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
    mocks.storage.clear();
    mocks.hasAction.mockClear();
    mocks.hasAction.mockResolvedValue(true);
    mocks.requestReview.mockClear();
    mocks.requestReview.mockResolvedValue(undefined);
    mocks.setShouldReject = false;
    mocks.track.mockClear();
  });

  it('recovers from unreadable local history before recording a fresh attempt', async () => {
    mocks.storage.set(KEY, '{not-json');

    await requestReviewAfterValue('data_export_success', NOW);

    expect(mocks.requestReview).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      attemptedAt: [NOW.toISOString()],
    });
  });

  it('removes wrong-shaped local history when no platform prompt is available', async () => {
    mocks.hasAction.mockResolvedValue(false);
    mocks.storage.set(KEY, JSON.stringify(['2026-06-01T12:00:00.000Z']));

    await requestReviewAfterValue('data_export_success', NOW);

    expect(mocks.requestReview).not.toHaveBeenCalled();
    expect(mocks.storage.has(KEY)).toBe(false);
    expect(mocks.track).toHaveBeenCalledWith('review_prompt_unavailable', {
      moment: 'data_export_success',
    });
  });

  it('treats platform availability errors as unavailable instead of throwing', async () => {
    mocks.hasAction.mockRejectedValueOnce(new Error('native module failed'));

    await expect(requestReviewAfterValue('paid_conversion_success', NOW)).resolves.toBeUndefined();

    expect(mocks.requestReview).not.toHaveBeenCalled();
    expect(mocks.track).toHaveBeenCalledWith('review_prompt_unavailable', {
      moment: 'paid_conversion_success',
    });
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('records a local attempt even when the native review request rejects', async () => {
    mocks.requestReview.mockRejectedValueOnce(new Error('prompt failed'));

    await expect(requestReviewAfterValue('paid_conversion_success', NOW)).resolves.toBeUndefined();

    expect(mocks.track).toHaveBeenCalledWith('review_prompt_attempted', {
      moment: 'paid_conversion_success',
    });
    expect(mocks.track).toHaveBeenCalledWith('review_prompt_unavailable', {
      moment: 'paid_conversion_success',
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      attemptedAt: [NOW.toISOString()],
    });
  });

  it('does not throw if local attempt history cannot be saved after a prompt attempt', async () => {
    mocks.setShouldReject = true;

    await expect(requestReviewAfterValue('paid_conversion_success', NOW)).resolves.toBeUndefined();

    expect(mocks.requestReview).toHaveBeenCalledTimes(1);
    expect(mocks.track).toHaveBeenCalledWith('review_prompt_attempted', {
      moment: 'paid_conversion_success',
    });
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

    await requestReviewAfterValue('data_export_success', NOW);

    expect(mocks.requestReview).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      attemptedAt: ['2026-06-01T12:00:00.000Z', NOW.toISOString()],
    });
  });
});
