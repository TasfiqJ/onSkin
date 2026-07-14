import { onlineManager, QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createOwnerQueryScope } from '@/lib/query/queryKeys';

import { recommendationInputsQueryOptions } from './recommendationInputsQuery';
import { loadRecommendationInputs } from './store';

vi.mock('./store', () => ({
  loadRecommendationInputs: vi.fn(async () => ({
    prefs: { values: ['vegan'], budget: 'mid', formats: ['gel'] },
    dismissed: ['gap:spf'],
  })),
}));

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
});
