import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';
import { createOwnerQueryScope, queryKeys } from '@/lib/query/queryKeys';

import {
  containRecommendationDismissalFailure,
  publishCommittedRecommendationDismissal,
} from './dismissalMutation';
import type { RecommendationInputs } from './store';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('committed recommendation dismissal cache publication', () => {
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
});
