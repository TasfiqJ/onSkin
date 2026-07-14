import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';
import * as privateKV from '@/lib/storage/privateKV';
import type { PrivateKVReadResult } from '@/lib/storage/privateKV';

import {
  MAX_REVIEW_PROMPT_ATTEMPTS,
  MAX_REVIEW_PROMPT_STATE_CHARS,
  readReviewPromptState,
  requestReviewAfterValue,
} from './prompt';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  readOverride: null as PrivateKVReadResult | null,
  hasAction: vi.fn(async () => true),
  requestReview: vi.fn(async () => undefined),
  tails: new Map<string, Promise<void>>(),
  updateFailure: null as 'before' | 'after_updater' | 'after' | null,
  updateBlocker: null as Promise<void> | null,
  track: vi.fn(),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  readPrivateItem: vi.fn(async (key: string): Promise<PrivateKVReadResult> => {
    if (mocks.readOverride) return mocks.readOverride;
    const value = mocks.storage.get(key);
    return value === undefined ? { status: 'absent' } : { status: 'available', value };
  }),
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
        const blocker = mocks.updateBlocker;
        mocks.updateBlocker = null;
        if (blocker) await blocker;
        if (mocks.updateFailure === 'before') throw new Error('storage unavailable');
        const current = mocks.storage.get(key) ?? null;
        const next = updater(current);
        if (mocks.updateFailure === 'after_updater') {
          throw new Error('native pre-commit rejection after updater');
        }
        if (next === null) mocks.storage.delete(key);
        else mocks.storage.set(key, next);
        if (mocks.updateFailure === 'after') throw new Error('native post-commit rejection');
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
const PRIOR_ATTEMPT = '2026-06-01T12:00:00.000Z';

function legacyState(attemptedAt: string[] = []): string {
  return JSON.stringify({ attemptedAt });
}

function currentState(attemptedAt: string[] = []): string {
  return JSON.stringify({ version: 1, state: { attemptedAt } });
}

describe('review prompt local history', () => {
  let boundaryActive = false;

  beforeEach(() => {
    mocks.storage.clear();
    mocks.readOverride = null;
    mocks.hasAction.mockReset().mockResolvedValue(true);
    mocks.requestReview.mockReset().mockResolvedValue(undefined);
    mocks.tails.clear();
    mocks.updateFailure = null;
    mocks.updateBlocker = null;
    mocks.track.mockReset();
    vi.mocked(privateKV.readPrivateItem).mockClear();
    vi.mocked(privateKV.updatePrivateItem).mockClear();
  });

  afterEach(() => {
    if (!boundaryActive) return;
    endAccountGenerationBoundary();
    boundaryActive = false;
  });

  it('returns typed absence and strict legacy/current state without read-time writes', async () => {
    await expect(readReviewPromptState(NOW)).resolves.toEqual({
      status: 'absent',
      state: { attemptedAt: [] },
    });

    const legacy = legacyState([PRIOR_ATTEMPT]);
    mocks.storage.set(KEY, legacy);
    await expect(readReviewPromptState(NOW)).resolves.toEqual({
      status: 'available',
      state: { attemptedAt: [PRIOR_ATTEMPT] },
      format: 'legacy',
    });
    expect(mocks.storage.get(KEY)).toBe(legacy);

    const current = currentState([PRIOR_ATTEMPT]);
    mocks.storage.set(KEY, current);
    await expect(readReviewPromptState(NOW)).resolves.toEqual({
      status: 'available',
      state: { attemptedAt: [PRIOR_ATTEMPT] },
      format: 'current',
    });
    expect(mocks.storage.get(KEY)).toBe(current);
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('preserves private-adapter failure taxonomy and suppresses every prompt side effect', async () => {
    const original = currentState([PRIOR_ATTEMPT]);
    const failures = [
      {
        stored: { status: 'unavailable', reason: 'content_key_missing' } as const,
        expected: {
          status: 'unavailable',
          state: null,
          reason: 'content_key_missing',
        } as const,
      },
      {
        stored: { status: 'corrupt', reason: 'decryption_failed' } as const,
        expected: {
          status: 'corrupt',
          state: null,
          reason: 'decryption_failed',
        } as const,
      },
      {
        stored: { status: 'unsupported_version' } as const,
        expected: { status: 'unsupported_version', state: null } as const,
      },
    ] satisfies readonly {
      stored: PrivateKVReadResult;
      expected: unknown;
    }[];

    for (const { stored, expected } of failures) {
      mocks.storage.set(KEY, original);
      mocks.readOverride = stored;

      await expect(readReviewPromptState(NOW)).resolves.toEqual(expected);
      await requestReviewAfterValue('seven_checkoff_days', NOW);

      expect(mocks.storage.get(KEY)).toBe(original);
      expect(mocks.hasAction).not.toHaveBeenCalled();
      expect(mocks.requestReview).not.toHaveBeenCalled();
      expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
      expect(mocks.track).toHaveBeenCalledWith('review_prompt_unavailable', {
        moment: 'seven_checkoff_days',
      });

      mocks.readOverride = null;
      mocks.track.mockClear();
    }
  });

  it('maps an unexpected adapter rejection to typed unavailable without touching bytes', async () => {
    const original = currentState([PRIOR_ATTEMPT]);
    mocks.storage.set(KEY, original);
    vi.mocked(privateKV.readPrivateItem).mockRejectedValueOnce(new Error('transport failed'));

    await expect(readReviewPromptState(NOW)).resolves.toEqual({
      status: 'unavailable',
      state: null,
      reason: 'storage_unavailable',
    });

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('drops a delayed typed read at an account boundary without publishing owner-A state', async () => {
    let releaseRead!: (result: PrivateKVReadResult) => void;
    vi.mocked(privateKV.readPrivateItem).mockImplementationOnce(
      () =>
        new Promise<PrivateKVReadResult>((resolve) => {
          releaseRead = resolve;
        }),
    );

    const read = readReviewPromptState(NOW);
    await vi.waitFor(() => expect(privateKV.readPrivateItem).toHaveBeenCalledOnce());
    beginAccountGenerationBoundary();
    boundaryActive = true;
    releaseRead({ status: 'available', value: currentState([PRIOR_ATTEMPT]) });

    await expect(read).resolves.toEqual({
      status: 'unavailable',
      state: null,
      reason: 'account_boundary',
    });
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();

    endAccountGenerationBoundary();
    boundaryActive = false;
  });

  it('classifies every malformed legacy/current shape as corrupt and preserves exact bytes', async () => {
    const oversizedAttempts = Array.from({ length: MAX_REVIEW_PROMPT_ATTEMPTS + 1 }, (_, index) =>
      new Date(Date.UTC(2026, 0, 1 + index)).toISOString(),
    );
    const oversizedRaw = `${legacyState()}${' '.repeat(MAX_REVIEW_PROMPT_STATE_CHARS)}`;
    const malformed = [
      '{not-json',
      JSON.stringify([]),
      JSON.stringify({}),
      JSON.stringify({ attemptedAt: 'not-an-array' }),
      JSON.stringify({ attemptedAt: [PRIOR_ATTEMPT], extra: true }),
      JSON.stringify({ attemptedAt: [123] }),
      JSON.stringify({ attemptedAt: ['not-a-date'] }),
      JSON.stringify({ attemptedAt: ['2026-06-01'] }),
      JSON.stringify({ attemptedAt: [PRIOR_ATTEMPT, PRIOR_ATTEMPT] }),
      JSON.stringify({
        attemptedAt: ['2026-06-02T12:00:00.000Z', PRIOR_ATTEMPT],
      }),
      JSON.stringify({ attemptedAt: ['2026-08-01T12:00:00.000Z'] }),
      JSON.stringify({ attemptedAt: oversizedAttempts }),
      JSON.stringify({ version: 1, state: {} }),
      JSON.stringify({ version: 1, state: { attemptedAt: [], extra: true } }),
      JSON.stringify({ version: 1, state: { attemptedAt: [false] } }),
      JSON.stringify({ version: 1, state: { attemptedAt: [] }, extra: true }),
      JSON.stringify({ version: 0, state: { attemptedAt: [] } }),
      oversizedRaw,
    ];

    for (const original of malformed) {
      mocks.storage.set(KEY, original);

      await expect(readReviewPromptState(NOW)).resolves.toEqual({
        status: 'corrupt',
        state: null,
        reason: 'invalid_payload',
      });
      await requestReviewAfterValue('seven_checkoff_days', NOW);

      expect(mocks.storage.get(KEY)).toBe(original);
      expect(mocks.hasAction).not.toHaveBeenCalled();
      expect(mocks.requestReview).not.toHaveBeenCalled();
      expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();

      mocks.track.mockClear();
      vi.mocked(privateKV.readPrivateItem).mockClear();
    }
  });

  it('preserves future-version attempt history as typed unsupported state', async () => {
    const original = JSON.stringify({ version: 2, state: { attemptedAt: [] } });
    mocks.storage.set(KEY, original);

    await expect(readReviewPromptState(NOW)).resolves.toEqual({
      status: 'unsupported_version',
      state: null,
    });
    await requestReviewAfterValue('seven_checkoff_days', NOW);

    expect(mocks.hasAction).not.toHaveBeenCalled();
    expect(mocks.requestReview).not.toHaveBeenCalled();
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('reports an invalid wall clock without reading or mutating private state', async () => {
    await expect(readReviewPromptState(new Date(Number.NaN))).resolves.toEqual({
      status: 'unavailable',
      state: null,
      reason: 'invalid_clock',
    });

    expect(privateKV.readPrivateItem).not.toHaveBeenCalled();
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
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
    mocks.updateFailure = 'before';

    await expect(requestReviewAfterValue('seven_checkoff_days', NOW)).resolves.toBeUndefined();

    expect(mocks.requestReview).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalledWith('review_prompt_attempted', expect.anything());
    expect(mocks.track).toHaveBeenCalledWith('review_prompt_unavailable', {
      moment: 'seven_checkoff_days',
    });
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('fails closed when the updater runs but persistence rejects before commit', async () => {
    mocks.updateFailure = 'after_updater';

    await expect(requestReviewAfterValue('seven_checkoff_days', NOW)).resolves.toBeUndefined();

    expect(mocks.storage.has(KEY)).toBe(false);
    expect(mocks.requestReview).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalledWith('review_prompt_attempted', expect.anything());
    expect(mocks.track).toHaveBeenCalledWith('review_prompt_unavailable', {
      moment: 'seven_checkoff_days',
    });
  });

  it('recovers a commit-response loss only after an exact same-lease readback', async () => {
    mocks.updateFailure = 'after';

    await expect(requestReviewAfterValue('seven_checkoff_days', NOW)).resolves.toBeUndefined();

    expect(privateKV.readPrivateItem).toHaveBeenCalledTimes(2);
    expect(mocks.track).toHaveBeenCalledWith('review_prompt_attempted', {
      moment: 'seven_checkoff_days',
    });
    expect(mocks.track).not.toHaveBeenCalledWith('review_prompt_unavailable', expect.anything());
    expect(mocks.requestReview).toHaveBeenCalledOnce();
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      version: 1,
      state: { attemptedAt: [NOW.toISOString()] },
    });

    const readCallOrder = vi.mocked(privateKV.readPrivateItem).mock.invocationCallOrder;
    expect(readCallOrder[1]).toBeLessThan(mocks.track.mock.invocationCallOrder[0]!);
    expect(mocks.track.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.requestReview.mock.invocationCallOrder[0]!,
    );
  });

  it('fails closed when commit-response-loss readback does not exactly match', async () => {
    mocks.updateFailure = 'after';
    vi.mocked(privateKV.readPrivateItem)
      .mockResolvedValueOnce({ status: 'absent' })
      .mockResolvedValueOnce({
        status: 'available',
        value: currentState([PRIOR_ATTEMPT]),
      });

    await expect(requestReviewAfterValue('seven_checkoff_days', NOW)).resolves.toBeUndefined();

    expect(privateKV.readPrivateItem).toHaveBeenCalledTimes(2);
    expect(mocks.requestReview).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalledWith('review_prompt_attempted', expect.anything());
    expect(mocks.track).toHaveBeenCalledWith('review_prompt_unavailable', {
      moment: 'seven_checkoff_days',
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      version: 1,
      state: { attemptedAt: [NOW.toISOString()] },
    });
  });

  it('fails closed when commit-response-loss readback rejects', async () => {
    mocks.updateFailure = 'after';
    vi.mocked(privateKV.readPrivateItem)
      .mockResolvedValueOnce({ status: 'absent' })
      .mockRejectedValueOnce(new Error('readback unavailable'));

    await expect(requestReviewAfterValue('seven_checkoff_days', NOW)).resolves.toBeUndefined();

    expect(privateKV.readPrivateItem).toHaveBeenCalledTimes(2);
    expect(mocks.requestReview).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalledWith('review_prompt_attempted', expect.anything());
    expect(mocks.track).toHaveBeenCalledWith('review_prompt_unavailable', {
      moment: 'seven_checkoff_days',
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      version: 1,
      state: { attemptedAt: [NOW.toISOString()] },
    });
  });

  it('suppresses publication when an account boundary interrupts exact readback', async () => {
    let releaseReadback!: (result: PrivateKVReadResult) => void;
    mocks.updateFailure = 'after';
    vi.mocked(privateKV.readPrivateItem)
      .mockResolvedValueOnce({ status: 'absent' })
      .mockImplementationOnce(
        () =>
          new Promise<PrivateKVReadResult>((resolve) => {
            releaseReadback = resolve;
          }),
      );

    const request = requestReviewAfterValue('seven_checkoff_days', NOW);
    await vi.waitFor(() => expect(privateKV.readPrivateItem).toHaveBeenCalledTimes(2));

    beginAccountGenerationBoundary();
    boundaryActive = true;
    await expect(request).resolves.toBeUndefined();
    releaseReadback({ status: 'available', value: mocks.storage.get(KEY)! });
    endAccountGenerationBoundary();
    boundaryActive = false;

    expect(mocks.storage.has(KEY)).toBe(true);
    expect(mocks.requestReview).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it('migrates exact legacy history only as part of a successful reservation', async () => {
    mocks.storage.set(KEY, legacyState([PRIOR_ATTEMPT]));

    await requestReviewAfterValue('seven_checkoff_days', NOW);

    expect(mocks.requestReview).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      version: 1,
      state: { attemptedAt: [PRIOR_ATTEMPT, NOW.toISOString()] },
    });
  });

  it('does not rewrite valid legacy bytes when policy skips the prompt', async () => {
    const original = legacyState(['2026-06-20T12:00:00.000Z']);
    mocks.storage.set(KEY, original);

    await requestReviewAfterValue('seven_checkoff_days', NOW);

    expect(mocks.track).toHaveBeenCalledWith('review_prompt_skipped', {
      moment: 'seven_checkoff_days',
      reason: 'cooldown',
    });
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('serializes 100 simultaneous callers so the native review prompt is requested once', async () => {
    await Promise.all(
      Array.from({ length: 100 }, () => requestReviewAfterValue('seven_checkoff_days', NOW)),
    );

    expect(mocks.requestReview).toHaveBeenCalledTimes(1);
    expect(
      mocks.track.mock.calls.filter(([event]) => event === 'review_prompt_attempted'),
    ).toHaveLength(1);
    expect(mocks.track).not.toHaveBeenCalledWith('review_prompt_unavailable', expect.anything());
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      version: 1,
      state: { attemptedAt: [NOW.toISOString()] },
    });
  });

  it('cancels a delayed owner-A private read before owner B can inherit the decision', async () => {
    let releaseRead!: (result: PrivateKVReadResult) => void;
    vi.mocked(privateKV.readPrivateItem).mockImplementationOnce(
      () =>
        new Promise<PrivateKVReadResult>((resolve) => {
          releaseRead = resolve;
        }),
    );

    const request = requestReviewAfterValue('seven_checkoff_days', NOW);
    await vi.waitFor(() => expect(privateKV.readPrivateItem).toHaveBeenCalledOnce());

    beginAccountGenerationBoundary();
    boundaryActive = true;
    await expect(request).resolves.toBeUndefined();
    mocks.storage.clear();
    endAccountGenerationBoundary();
    boundaryActive = false;
    releaseRead({ status: 'absent' });
    await Promise.resolve();

    expect(mocks.hasAction).not.toHaveBeenCalled();
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.requestReview).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalled();
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('does not publish owner-A results after an already-started native request crosses a boundary', async () => {
    let releaseNative!: () => void;
    let nativeSettled = false;
    mocks.requestReview.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          releaseNative = () => {
            nativeSettled = true;
            resolve(undefined);
          };
        }),
    );

    const request = requestReviewAfterValue('seven_checkoff_days', NOW);
    await vi.waitFor(() => expect(mocks.requestReview).toHaveBeenCalledOnce());
    expect(mocks.track.mock.calls).toEqual([
      ['review_prompt_attempted', { moment: 'seven_checkoff_days' }],
    ]);

    beginAccountGenerationBoundary();
    boundaryActive = true;
    await expect(request).resolves.toBeUndefined();

    expect(nativeSettled).toBe(false);
    expect(mocks.track.mock.calls).toEqual([
      ['review_prompt_attempted', { moment: 'seven_checkoff_days' }],
    ]);

    endAccountGenerationBoundary();
    boundaryActive = false;
    releaseNative();
    await Promise.resolve();

    expect(mocks.track.mock.calls).toEqual([
      ['review_prompt_attempted', { moment: 'seven_checkoff_days' }],
    ]);
  });

  it('cancels owner-A after a delayed platform check without writing or prompting owner B', async () => {
    let releasePlatform!: (available: boolean) => void;
    mocks.hasAction.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          releasePlatform = resolve;
        }),
    );

    const request = requestReviewAfterValue('seven_checkoff_days', NOW);
    await vi.waitFor(() => expect(mocks.hasAction).toHaveBeenCalledOnce());

    beginAccountGenerationBoundary();
    boundaryActive = true;
    await expect(request).resolves.toBeUndefined();
    mocks.storage.clear();
    endAccountGenerationBoundary();
    boundaryActive = false;
    releasePlatform(true);
    await Promise.resolve();

    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.requestReview).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalled();
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('cancels owner-A during a delayed reservation before native publication', async () => {
    let releaseUpdate!: () => void;
    mocks.updateBlocker = new Promise<void>((resolve) => {
      releaseUpdate = resolve;
    });

    const request = requestReviewAfterValue('seven_checkoff_days', NOW);
    await vi.waitFor(() => expect(privateKV.updatePrivateItem).toHaveBeenCalledOnce());

    beginAccountGenerationBoundary();
    boundaryActive = true;
    await expect(request).resolves.toBeUndefined();
    mocks.updateFailure = 'before';
    releaseUpdate();
    await vi.waitFor(() => expect(mocks.tails.size).toBe(0));
    mocks.storage.clear();
    endAccountGenerationBoundary();
    boundaryActive = false;

    expect(mocks.requestReview).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalledWith('review_prompt_attempted', expect.anything());
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('keeps a delayed platform check valid while the same owner generation remains current', async () => {
    let releasePlatform!: (available: boolean) => void;
    mocks.hasAction.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          releasePlatform = resolve;
        }),
    );

    const request = requestReviewAfterValue('seven_checkoff_days', NOW);
    await vi.waitFor(() => expect(mocks.hasAction).toHaveBeenCalledOnce());
    releasePlatform(true);

    await expect(request).resolves.toBeUndefined();
    expect(mocks.requestReview).toHaveBeenCalledOnce();
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      version: 1,
      state: { attemptedAt: [NOW.toISOString()] },
    });
  });
});
