import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';
import { createOwnerQueryScope, queryKeys } from '@/lib/query/queryKeys';

import {
  containRecommendationDismissalFailure,
  publishCommittedRecommendationDismissal,
  runRecommendationDismissalMutation,
} from './dismissalMutation';
import type { RecommendationInputs } from './store';

const mocks = vi.hoisted(() => ({
  dismissRecommendation: vi.fn(),
}));

vi.mock('./store', () => ({
  dismissRecommendation: mocks.dismissRecommendation,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, reject, resolve };
}

describe('committed recommendation dismissal cache publication', () => {
  beforeEach(() => {
    mocks.dismissRecommendation.mockReset();
  });

  it('still resets shared owner state after the originating surface unmounts', async () => {
    const client = new QueryClient();
    const ownerScope = createOwnerQueryScope();
    const pendingReset = deferred<void>();
    const reset = vi.spyOn(client, 'resetQueries').mockReturnValue(pendingReset.promise);
    const onFailure = vi.fn();
    const onRelease = vi.fn();
    let mounted = true;

    const recovery = containRecommendationDismissalFailure(client, ownerScope, {
      isMounted: () => mounted,
      onFailure,
      onRelease,
    });
    expect(onFailure).toHaveBeenCalledOnce();
    expect(reset).toHaveBeenCalledTimes(2);

    mounted = false;
    pendingReset.resolve();
    await recovery;

    expect(onRelease).not.toHaveBeenCalled();
    client.clear();
  });

  it('removes the action surface before a deferred strict revalidation completes', async () => {
    const client = new QueryClient();
    const ownerScope = createOwnerQueryScope();
    const queryKey = queryKeys.recommendations(ownerScope);
    const pendingInvalidation = deferred<void>();
    const invalidate = vi
      .spyOn(client, 'invalidateQueries')
      .mockReturnValue(pendingInvalidation.promise);
    const cached: RecommendationInputs = {
      prefs: { values: ['vegan'], budget: 'mid', formats: ['gel'] },
      dismissed: [],
    };
    client.setQueryData(queryKey, cached);

    expect(publishCommittedRecommendationDismissal(client, ownerScope, 'gap:spf')).toBe(true);
    expect(client.getQueryData(queryKey)).toEqual({ ...cached, dismissed: ['gap:spf'] });
    expect(invalidate).toHaveBeenCalledOnce();

    pendingInvalidation.resolve();
    await pendingInvalidation.promise;
    client.clear();
  });

  it('does not publish into a stale owner cache', () => {
    const client = new QueryClient();
    const ownerScope = createOwnerQueryScope();
    const setQueryData = vi.spyOn(client, 'setQueryData');
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();

    expect(publishCommittedRecommendationDismissal(client, ownerScope, 'gap:spf')).toBe(false);
    expect(setQueryData).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
    client.clear();
  });

  it('delivers success to the initiating route after the prompt unmounts and coalesces a remount', async () => {
    const client = new QueryClient();
    const ownerScope = createOwnerQueryScope();
    const queryKey = queryKeys.recommendations(ownerScope);
    const pendingWrite = deferred<void>();
    const firstOnFailure = vi.fn();
    const firstOnSuccess = vi.fn();
    const remountOnFailure = vi.fn();
    const remountOnSuccess = vi.fn();
    let promptMounted = true;
    mocks.dismissRecommendation.mockReturnValue(pendingWrite.promise);
    client.setQueryData<RecommendationInputs>(queryKey, {
      prefs: { values: ['vegan'], budget: 'mid', formats: ['gel'] },
      dismissed: [],
    });

    const first = runRecommendationDismissalMutation(client, ownerScope, 'gap:spf', {
      onFailure: firstOnFailure,
      onSuccess: () => {
        expect(promptMounted).toBe(false);
        firstOnSuccess();
      },
    });
    promptMounted = false;
    const fromRemountedPrompt = runRecommendationDismissalMutation(
      client,
      ownerScope,
      'gap:spf',
      { onFailure: remountOnFailure, onSuccess: remountOnSuccess },
    );

    expect(fromRemountedPrompt).toBe(first);
    await Promise.resolve();
    expect(mocks.dismissRecommendation).toHaveBeenCalledOnce();
    pendingWrite.resolve();

    await expect(first).resolves.toBe('committed');
    expect(firstOnSuccess).toHaveBeenCalledOnce();
    expect(firstOnFailure).not.toHaveBeenCalled();
    expect(remountOnSuccess).not.toHaveBeenCalled();
    expect(remountOnFailure).not.toHaveBeenCalled();
    expect(client.getQueryData<RecommendationInputs>(queryKey)?.dismissed).toEqual(['gap:spf']);
    client.clear();
  });

  it('delivers failure after prompt unmount and awaits strict fail-closed recovery', async () => {
    const client = new QueryClient();
    const ownerScope = createOwnerQueryScope();
    const pendingWrite = deferred<void>();
    const pendingReset = deferred<void>();
    const reset = vi.spyOn(client, 'resetQueries').mockReturnValue(pendingReset.promise);
    const onFailure = vi.fn();
    const onSuccess = vi.fn();
    let promptMounted = true;
    mocks.dismissRecommendation.mockReturnValue(pendingWrite.promise);

    const mutation = runRecommendationDismissalMutation(client, ownerScope, 'gap:spf', {
      onFailure: () => {
        expect(promptMounted).toBe(false);
        onFailure();
      },
      onSuccess,
    });
    promptMounted = false;
    await Promise.resolve();
    pendingWrite.reject(new Error('storage unavailable'));
    await Promise.resolve();

    expect(onFailure).toHaveBeenCalledOnce();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(reset).toHaveBeenCalledTimes(2);
    pendingReset.resolve();
    await expect(mutation).resolves.toBe('failed');
    client.clear();
  });

  it.each(['resolve', 'reject'] as const)(
    'drops %s settlement after the initiating owner becomes stale',
    async (settlement) => {
      const client = new QueryClient();
      const ownerScope = createOwnerQueryScope();
      const pendingWrite = deferred<void>();
      const setQueryData = vi.spyOn(client, 'setQueryData');
      const resetQueries = vi.spyOn(client, 'resetQueries');
      const onFailure = vi.fn();
      const onSuccess = vi.fn();
      mocks.dismissRecommendation.mockReturnValue(pendingWrite.promise);

      const mutation = runRecommendationDismissalMutation(client, ownerScope, 'gap:spf', {
        onFailure,
        onSuccess,
      });
      await Promise.resolve();
      beginAccountGenerationBoundary();
      endAccountGenerationBoundary();
      if (settlement === 'resolve') pendingWrite.resolve();
      else pendingWrite.reject(new Error('owner changed'));

      await expect(mutation).resolves.toBe('stale_owner');
      expect(onFailure).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
      expect(setQueryData).not.toHaveBeenCalled();
      expect(resetQueries).not.toHaveBeenCalled();
      client.clear();
    },
  );
});
