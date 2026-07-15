import { onlineManager, QueryClient } from '@tanstack/react-query';
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

import { isCommerceConsentedWithLease } from './consent';
import {
  commerceConsentQueryOptions,
  readCommerceConsentForOwner,
  resolveCommerceConsentRead,
} from './consentQuery';

vi.mock('./consent', () => ({
  isCommerceConsentedWithLease: vi.fn(),
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

describe('commerce consent query options', () => {
  it('executes the local-capable gate offline with strict owner query settings', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const scope = createOwnerQueryScope();
    const options = commerceConsentQueryOptions(scope);
    vi.mocked(isCommerceConsentedWithLease).mockResolvedValueOnce(true);
    onlineManager.setOnline(false);

    expect(options.queryKey).toEqual(queryKeys.commerceConsent(scope));
    expect(options.networkMode).toBe('always');
    expect(options.retry).toBe(0);
    await expect(client.fetchQuery(options)).resolves.toBe(true);
    client.clear();
  });

  it('drains owner A and keeps its delayed grant out of both owner caches', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const delayedA = deferred<boolean>();
    const scopeA = createOwnerQueryScope();
    vi.mocked(isCommerceConsentedWithLease).mockImplementationOnce(
      (lease: AccountGenerationLease) =>
        awaitAccountGenerationLease(lease, () => delayedA.promise),
    );
    const pendingA = client.fetchQuery(commerceConsentQueryOptions(scopeA));
    await Promise.resolve();

    beginAccountGenerationBoundary();
    try {
      await expect(pendingA).rejects.toMatchObject({ code: ACCOUNT_GENERATION_CHANGED });
      await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
    } finally {
      endAccountGenerationBoundary();
    }

    const scopeB = createOwnerQueryScope();
    vi.mocked(isCommerceConsentedWithLease).mockResolvedValueOnce(false);
    await expect(client.fetchQuery(commerceConsentQueryOptions(scopeB))).resolves.toBe(false);
    delayedA.resolve(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(client.getQueryData(queryKeys.commerceConsent(scopeA))).toBeUndefined();
    expect(client.getQueryData(queryKeys.commerceConsent(scopeB))).toBe(false);
    client.clear();
  });

  it('makes the direct route reader reject once its captured owner is stale', async () => {
    const scopeA = createOwnerQueryScope();
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();

    await expect(readCommerceConsentForOwner(scopeA)).rejects.toMatchObject({
      code: ACCOUNT_GENERATION_CHANGED,
    });
    expect(isCommerceConsentedWithLease).not.toHaveBeenCalled();
  });

  it('allows same-owner refresh to replace a prior decline with a fresh grant', async () => {
    const options = commerceConsentQueryOptions(createOwnerQueryScope());
    vi.mocked(isCommerceConsentedWithLease)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await expect(options.queryFn()).resolves.toBe(false);
    await expect(options.queryFn()).resolves.toBe(true);
  });

  it('suppresses a delayed route result after its request is abandoned', async () => {
    const delayed = deferred<boolean>();
    let current = true;
    const outcome = resolveCommerceConsentRead(() => delayed.promise, () => current);

    current = false;
    delayed.resolve(false);

    await expect(outcome).resolves.toBe('stale');
  });

  it('distinguishes a current read failure from a stale failure', async () => {
    await expect(
      resolveCommerceConsentRead(
        () => Promise.reject(new Error('private storage unavailable')),
        () => true,
      ),
    ).resolves.toBe('unavailable');

    let current = true;
    let rejectDelayed!: (reason?: unknown) => void;
    const delayedFailure = new Promise<boolean>((_resolve, reject) => {
      rejectDelayed = reject;
    });
    const stale = resolveCommerceConsentRead(() => delayedFailure, () => current);
    current = false;
    rejectDelayed(new Error('late failure'));
    await expect(stale).resolves.toBe('stale');
  });
});
