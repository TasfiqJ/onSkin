import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { focusManager, onlineManager, QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { runRequest } from '@/lib/network/requestPolicy';

import {
  deterministicLocalQueryPolicy,
  queryClientDefaultPolicy,
  requestPolicyOwnedQueryPolicy,
} from './queryPolicies';

function createPolicyClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: queryClientDefaultPolicy,
    },
  });
}

afterEach(() => {
  focusManager.setFocused(true);
  onlineManager.setOnline(true);
});

describe('query retry policies', () => {
  it('executes a deterministic failure once and gives one later manual retry', async () => {
    const client = createPolicyClient();
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('PRIVATE_KV_ENVELOPE_INVALID'))
      .mockResolvedValueOnce('recovered');
    const options = {
      ...deterministicLocalQueryPolicy,
      queryKey: ['test', 'deterministic-local'] as const,
      queryFn: operation,
    };

    await expect(client.fetchQuery(options)).rejects.toThrow('PRIVATE_KV_ENVELOPE_INVALID');
    expect(operation).toHaveBeenCalledOnce();

    await expect(client.fetchQuery(options)).resolves.toBe('recovered');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('keeps a failed local observer idle across remount, focus, and reconnect', async () => {
    focusManager.setFocused(true);
    onlineManager.setOnline(true);
    const client = createPolicyClient();
    client.mount();
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('PRIVATE_KV_DECRYPTION_FAILED'))
      .mockResolvedValueOnce('recovered');
    const options = {
      ...deterministicLocalQueryPolicy,
      queryKey: ['test', 'local-lifecycle'] as const,
      queryFn: operation,
    };
    const first = new QueryObserver(client, options);
    const unsubscribeFirst = first.subscribe(() => undefined);
    await vi.waitFor(() => expect(first.getCurrentResult().isError).toBe(true));
    expect(operation).toHaveBeenCalledOnce();
    unsubscribeFirst();

    const remounted = new QueryObserver(client, options);
    const unsubscribeRemounted = remounted.subscribe(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(remounted.getCurrentResult().status).toBe('error');
    expect(operation).toHaveBeenCalledOnce();

    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(operation).toHaveBeenCalledOnce();

    onlineManager.setOnline(false);
    onlineManager.setOnline(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(operation).toHaveBeenCalledOnce();

    const recovered = await remounted.refetch();
    expect(recovered.data).toBe('recovered');
    expect(operation).toHaveBeenCalledTimes(2);
    unsubscribeRemounted();
    client.unmount();
  });

  it('runs an encrypted local query while TanStack considers the device offline', async () => {
    onlineManager.setOnline(false);
    const client = createPolicyClient();
    const operation = vi.fn(async () => 'local');

    await expect(
      client.fetchQuery({
        ...deterministicLocalQueryPolicy,
        queryKey: ['test', 'offline-local'],
        queryFn: operation,
      }),
    ).resolves.toBe('local');
    expect(operation).toHaveBeenCalledOnce();
  });

  it('does not multiply the request-policy attempt budget and retries manually once', async () => {
    const client = createPolicyClient();
    const transport = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(Object.assign(new Error('unavailable'), { status: 503 }))
      .mockRejectedValueOnce(Object.assign(new Error('unavailable'), { status: 503 }))
      .mockResolvedValueOnce('recovered');
    const queryFn = vi.fn(() =>
      runRequest(
        {
          endpoint: 'catalog_search',
          deadlineMs: 1_000,
          idempotent: true,
          maxAttempts: 2,
          ownerScoped: false,
          runtime: { random: () => 0, sleep: async () => undefined },
        },
        transport,
      ),
    );
    const options = {
      ...requestPolicyOwnedQueryPolicy,
      queryKey: ['test', 'request-policy-owned'] as const,
      queryFn,
    };

    await expect(client.fetchQuery(options)).rejects.toMatchObject({ attemptCount: 2 });
    expect(queryFn).toHaveBeenCalledOnce();
    expect(transport).toHaveBeenCalledTimes(2);

    await expect(client.fetchQuery(options)).resolves.toBe('recovered');
    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(transport).toHaveBeenCalledTimes(3);
  });

  it('refreshes a stale successful fallback after reconnect', async () => {
    onlineManager.setOnline(true);
    const client = createPolicyClient();
    client.mount();
    const operation = vi.fn<() => Promise<string | null>>().mockResolvedValueOnce(null);
    const observer = new QueryObserver(client, {
      ...requestPolicyOwnedQueryPolicy,
      queryKey: ['test', 'successful-fallback'],
      queryFn: operation,
      staleTime: 0,
    });
    const unsubscribe = observer.subscribe(() => undefined);
    await vi.waitFor(() => expect(observer.getCurrentResult().isSuccess).toBe(true));
    expect(operation).toHaveBeenCalledOnce();

    operation.mockResolvedValueOnce('recovered');
    onlineManager.setOnline(false);
    onlineManager.setOnline(true);
    await vi.waitFor(() => expect(operation).toHaveBeenCalledTimes(2));
    expect(observer.getCurrentResult().data).toBe('recovered');

    unsubscribe();
    client.unmount();
  });

  it('keeps each classified source explicit and remote retries opt-in', () => {
    const read = (relativePath: string) =>
      readFileSync(fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)), 'utf8');
    const queryClient = read('lib/query/queryClient.ts');
    const plan = read('features/routine/usePlan.ts');
    const cycleAnchor = read('features/routine/cycleAnchor.ts');
    const progress = read('features/routine/useProgress.ts');
    const profile = read('features/scheduler/profile.ts');
    const trend = read('features/trend/useTrend.ts');
    const commerce = read('features/commerce/useCommerce.ts');
    const offering = read('features/subscription/useSubscriptionOffering.ts');
    const photos = read('features/photos/usePhotos.ts');
    const note = read('app/community/note/[id].tsx');
    const onboarding = read('features/onboarding/onboardingStatusQuery.ts');
    const groundedTurns = read('features/ask/groundedTurnsQuery.ts');

    expect(queryClient).toContain('queries: queryClientDefaultPolicy');
    for (const source of [plan, cycleAnchor, progress, photos, note]) {
      expect(source).toContain('...deterministicLocalQueryPolicy');
    }
    expect(profile).toContain('...stableErrorQueryPolicy');
    expect(profile).toContain('shouldAutomaticallyRefetchProfileQuery');
    for (const source of [cycleAnchor, progress, photos]) {
      expect(
        source.match(
          /query\.state\.status !== 'error' && shouldRefetchCurrentLocalDayQuery\(query\)/g,
        ),
      ).toHaveLength(2);
    }
    expect(trend.match(/\.\.\.requestPolicyOwnedQueryPolicy/g)).toHaveLength(2);
    expect(commerce).toContain('...requestPolicyOwnedQueryPolicy');
    expect(offering).toContain('...stableErrorQueryPolicy');
    expect(offering).not.toMatch(/retry:\s*[1-9]/);
    for (const source of [onboarding, groundedTurns]) {
      expect(source).toContain('...stableErrorQueryPolicy');
    }
    expect(onboarding).not.toContain("refetchOnMount: 'always'");
    expect(groundedTurns).not.toContain('refetchOnReconnect: true');
    expect(groundedTurns).not.toContain('refetchOnWindowFocus: true');
  });
});
