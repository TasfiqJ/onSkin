import { onlineManager, QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_GENERATION_CHANGED,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';
import { createOwnerQueryScope, queryKeys } from '@/lib/query/queryKeys';

import { recommendationInputsQueryOptions } from './recommendationInputsQuery';
import { loadRecommendationInputs, type RecommendationInputs } from './store';

vi.mock('./store', () => ({
  loadRecommendationInputs: vi.fn(async () => ({
    prefs: { values: ['vegan'], budget: 'mid', formats: ['gel'] },
    dismissed: ['gap:spf'],
  })),
}));

function deferred<T>() {
  let reject!: (error: unknown) => void;
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    reject = rejectPromise;
    resolve = resolvePromise;
  });
  return { promise, reject, resolve };
}

function runQuery(
  options: ReturnType<typeof recommendationInputsQueryOptions>,
): Promise<RecommendationInputs> {
  return (options.queryFn as () => Promise<RecommendationInputs>)();
}

const FIRST_INPUTS: RecommendationInputs = {
  prefs: { values: ['vegan'], budget: 'mid', formats: ['gel'] },
  dismissed: ['gap:spf'],
};

const REFRESHED_INPUTS: RecommendationInputs = {
  prefs: { values: ['fragrance_free'], budget: 'drugstore', formats: ['cream'] },
  dismissed: ['goal:brightening'],
};

afterEach(() => {
  onlineManager.setOnline(true);
  vi.clearAllMocks();
});

describe('recommendation input query options', () => {
  it('executes the encrypted local read while the device is offline', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    onlineManager.setOnline(false);

    await expect(
      client.fetchQuery(recommendationInputsQueryOptions(createOwnerQueryScope())),
    ).resolves.toEqual({
      prefs: { values: ['vegan'], budget: 'mid', formats: ['gel'] },
      dismissed: ['gap:spf'],
    });

    expect(loadRecommendationInputs).toHaveBeenCalledTimes(1);
    client.clear();
  });

  it('detaches a hung private read so the account boundary can drain', async () => {
    vi.mocked(loadRecommendationInputs).mockReturnValueOnce(
      new Promise<RecommendationInputs>(() => undefined),
    );
    const pending = runQuery(recommendationInputsQueryOptions(createOwnerQueryScope()));
    await Promise.resolve();

    beginAccountGenerationBoundary();
    try {
      await expect(pending).rejects.toMatchObject({ code: ACCOUNT_GENERATION_CHANGED });
      await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
    } finally {
      endAccountGenerationBoundary();
    }
  });

  it('never publishes a delayed account-A read into the fresh account-B cache', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const delayedA = deferred<RecommendationInputs>();
    const scopeA = createOwnerQueryScope();
    vi.mocked(loadRecommendationInputs).mockReturnValueOnce(delayedA.promise);
    const pendingA = client.fetchQuery(recommendationInputsQueryOptions(scopeA));
    await Promise.resolve();

    beginAccountGenerationBoundary();
    try {
      await expect(pendingA).rejects.toMatchObject({ code: ACCOUNT_GENERATION_CHANGED });
      await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
    } finally {
      endAccountGenerationBoundary();
    }

    const scopeB = createOwnerQueryScope();
    vi.mocked(loadRecommendationInputs).mockResolvedValueOnce(REFRESHED_INPUTS);
    await expect(
      client.fetchQuery(recommendationInputsQueryOptions(scopeB)),
    ).resolves.toEqual(REFRESHED_INPUTS);

    delayedA.resolve(FIRST_INPUTS);
    await Promise.resolve();
    await Promise.resolve();

    expect(client.getQueryData(queryKeys.recommendations(scopeA))).toBeUndefined();
    expect(client.getQueryData(queryKeys.recommendations(scopeB))).toEqual(REFRESHED_INPUTS);
    client.clear();
  });

  it('surfaces a genuine private-read failure instead of publishing empty defaults', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const scope = createOwnerQueryScope();
    vi.mocked(loadRecommendationInputs).mockRejectedValueOnce(
      new Error('REC_PREFERENCES_UNAVAILABLE'),
    );

    await expect(
      client.fetchQuery(recommendationInputsQueryOptions(scope)),
    ).rejects.toThrow('REC_PREFERENCES_UNAVAILABLE');
    expect(client.getQueryData(queryKeys.recommendations(scope))).toBeUndefined();
    client.clear();
  });

  it('allows a same-owner refresh to publish the newer local snapshot', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const scope = createOwnerQueryScope();
    vi.mocked(loadRecommendationInputs)
      .mockResolvedValueOnce(FIRST_INPUTS)
      .mockResolvedValueOnce(REFRESHED_INPUTS);

    await expect(
      client.fetchQuery(recommendationInputsQueryOptions(scope)),
    ).resolves.toEqual(FIRST_INPUTS);
    await client.invalidateQueries({ queryKey: queryKeys.recommendations(scope) });
    await expect(
      client.fetchQuery(recommendationInputsQueryOptions(scope)),
    ).resolves.toEqual(REFRESHED_INPUTS);

    expect(loadRecommendationInputs).toHaveBeenCalledTimes(2);
    expect(client.getQueryData(queryKeys.recommendations(scope))).toEqual(REFRESHED_INPUTS);
    client.clear();
  });
});
