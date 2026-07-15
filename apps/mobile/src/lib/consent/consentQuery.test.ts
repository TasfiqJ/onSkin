import { onlineManager, QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_GENERATION_CHANGED,
  awaitAccountGenerationLease,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { createOwnerQueryScope, queryKeys } from '@/lib/query/queryKeys';

import { getLatestConsentsWithLease } from './consent';
import { consentManagementState, latestConsentsQueryOptions } from './consentQuery';

vi.mock('./consent', () => ({
  getLatestConsentsWithLease: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

afterEach(() => {
  onlineManager.setOnline(true);
  vi.clearAllMocks();
});

describe('latest consent ledger query options', () => {
  it('runs under the owner key while offline and preserves strict query settings', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const scope = createOwnerQueryScope();
    const options = latestConsentsQueryOptions(scope);
    vi.mocked(getLatestConsentsWithLease).mockResolvedValueOnce({ marketing: true });
    onlineManager.setOnline(false);

    expect(options.queryKey).toEqual(queryKeys.consents(scope));
    expect(options.networkMode).toBe('always');
    expect(options.retry).toBe(0);
    await expect(client.fetchQuery(options)).resolves.toEqual({ marketing: true });
    client.clear();
  });

  it('rejects an owner-A callback invoked after owner B starts before reading the ledger', async () => {
    const scopeA = createOwnerQueryScope();
    const optionsA = latestConsentsQueryOptions(scopeA);

    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();

    await expect(optionsA.queryFn()).rejects.toMatchObject({
      code: ACCOUNT_GENERATION_CHANGED,
    });
    expect(getLatestConsentsWithLease).not.toHaveBeenCalled();
  });

  it('drains delayed owner A, suppresses its late rows, and caches only fresh owner B', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const delayedA = deferred<Record<string, boolean>>();
    const scopeA = createOwnerQueryScope();
    vi.mocked(getLatestConsentsWithLease).mockImplementationOnce(
      (lease: AccountGenerationLease) =>
        awaitAccountGenerationLease(lease, () => delayedA.promise),
    );
    const pendingA = client.fetchQuery(latestConsentsQueryOptions(scopeA));
    await Promise.resolve();

    beginAccountGenerationBoundary();
    try {
      await expect(pendingA).rejects.toMatchObject({ code: ACCOUNT_GENERATION_CHANGED });
      await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
    } finally {
      endAccountGenerationBoundary();
    }

    const scopeB = createOwnerQueryScope();
    vi.mocked(getLatestConsentsWithLease).mockResolvedValueOnce({ marketing: false });
    await expect(client.fetchQuery(latestConsentsQueryOptions(scopeB))).resolves.toEqual({
      marketing: false,
    });

    delayedA.resolve({ marketing: true });
    await Promise.resolve();
    await Promise.resolve();
    expect(client.getQueryData(queryKeys.consents(scopeA))).toBeUndefined();
    expect(client.getQueryData(queryKeys.consents(scopeB))).toEqual({ marketing: false });
    client.clear();
  });

  it('allows a same-owner refresh to replace the prior ledger snapshot', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const scope = createOwnerQueryScope();
    vi.mocked(getLatestConsentsWithLease)
      .mockResolvedValueOnce({ marketing: false })
      .mockResolvedValueOnce({ marketing: true });

    await client.fetchQuery(latestConsentsQueryOptions(scope));
    await client.invalidateQueries({ queryKey: queryKeys.consents(scope) });
    await client.fetchQuery(latestConsentsQueryOptions(scope));

    expect(client.getQueryData(queryKeys.consents(scope))).toEqual({ marketing: true });
    client.clear();
  });
});

describe('consent management publication', () => {
  it('keeps a verified grant revocable after a real observer refetch error', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let rejectRefresh!: (reason?: unknown) => void;
    let calls = 0;
    const observer = new QueryObserver<Record<string, boolean>>(client, {
      queryKey: ['consent-management-refetch'],
      queryFn: () => {
        calls += 1;
        if (calls === 1) return Promise.resolve({ marketing: true });
        return new Promise<Record<string, boolean>>((_resolve, reject) => {
          rejectRefresh = reject;
        });
      },
      retry: false,
    });
    const unsubscribe = observer.subscribe(() => undefined);

    await vi.waitFor(() => expect(observer.getCurrentResult().isSuccess).toBe(true));
    const refresh = observer.refetch();
    await vi.waitFor(() => expect(observer.getCurrentResult().isFetching).toBe(true));

    const checking = consentManagementState(
      observer.getCurrentResult(),
      (data) => data.marketing === true,
    );
    expect(checking).toMatchObject({
      canChange: false,
      hasVerifiedValue: true,
      isChecking: true,
      value: true,
    });

    rejectRefresh(new Error('ledger unavailable'));
    await refresh;
    await vi.waitFor(() => expect(observer.getCurrentResult().isError).toBe(true));

    expect(
      consentManagementState(observer.getCurrentResult(), (data) => data.marketing === true),
    ).toEqual({
      canChange: true,
      canRetry: true,
      hasVerifiedValue: true,
      isChecking: false,
      isUnavailable: true,
      value: true,
    });

    unsubscribe();
    client.clear();
  });

  it('keeps an unknown initial failure disabled instead of treating it as a decline', () => {
    expect(
      consentManagementState(
        { data: undefined, isError: true, isFetching: false },
        (value: boolean) => value,
      ),
    ).toEqual({
      canChange: false,
      canRetry: true,
      hasVerifiedValue: false,
      isChecking: false,
      isUnavailable: true,
      value: false,
    });
  });
});
