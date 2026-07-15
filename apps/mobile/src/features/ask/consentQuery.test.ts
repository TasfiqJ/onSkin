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

import { isAskConsentedWithLease } from './consent';
import { askConsentQueryOptions } from './consentQuery';

vi.mock('./consent', () => ({
  isAskConsentedWithLease: vi.fn(),
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

describe('Ask consent query options', () => {
  it('executes the local-capable gate offline with an owner-scoped key', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const scope = createOwnerQueryScope();
    const options = askConsentQueryOptions(scope);
    vi.mocked(isAskConsentedWithLease).mockResolvedValueOnce(true);
    onlineManager.setOnline(false);

    expect(options.queryKey).toEqual(queryKeys.askConsent(scope));
    expect(options.networkMode).toBe('always');
    expect(options.retry).toBe(0);
    await expect(client.fetchQuery(options)).resolves.toBe(true);
    client.clear();
  });

  it('never puts a delayed Ask grant from owner A into either owner cache', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const delayedA = deferred<boolean>();
    const scopeA = createOwnerQueryScope();
    vi.mocked(isAskConsentedWithLease).mockImplementationOnce(
      (lease: AccountGenerationLease) =>
        awaitAccountGenerationLease(lease, () => delayedA.promise),
    );
    const pendingA = client.fetchQuery(askConsentQueryOptions(scopeA));
    await Promise.resolve();

    beginAccountGenerationBoundary();
    try {
      await expect(pendingA).rejects.toMatchObject({ code: ACCOUNT_GENERATION_CHANGED });
      await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
    } finally {
      endAccountGenerationBoundary();
    }

    const scopeB = createOwnerQueryScope();
    vi.mocked(isAskConsentedWithLease).mockResolvedValueOnce(false);
    await expect(client.fetchQuery(askConsentQueryOptions(scopeB))).resolves.toBe(false);
    delayedA.resolve(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(client.getQueryData(queryKeys.askConsent(scopeA))).toBeUndefined();
    expect(client.getQueryData(queryKeys.askConsent(scopeB))).toBe(false);
    client.clear();
  });

  it('rejects a stale callback before reading and permits same-owner refresh', async () => {
    const staleScope = createOwnerQueryScope();
    const staleOptions = askConsentQueryOptions(staleScope);
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    await expect(staleOptions.queryFn()).rejects.toMatchObject({
      code: ACCOUNT_GENERATION_CHANGED,
    });
    expect(isAskConsentedWithLease).not.toHaveBeenCalled();

    const currentScope = createOwnerQueryScope();
    const currentOptions = askConsentQueryOptions(currentScope);
    vi.mocked(isAskConsentedWithLease)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    await expect(currentOptions.queryFn()).resolves.toBe(false);
    await expect(currentOptions.queryFn()).resolves.toBe(true);
  });
});
