import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requestReviewAfterValue } from './prompt';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  hasAction: vi.fn(async () => true),
  requestReview: vi.fn(async () => undefined),
  track: vi.fn(),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
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
