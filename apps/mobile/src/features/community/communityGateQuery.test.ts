import { onlineManager, QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_GENERATION_CHANGED,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';
import { createOwnerQueryScope, queryKeys } from '@/lib/query/queryKeys';

import { isCommunityConsentedWithLease } from './consent';
import { communityGateQueryOptions } from './communityGateQuery';
import { readAgeConfirmedLocal } from './store';

vi.mock('./consent', () => ({
  isCommunityConsentedWithLease: vi.fn(),
}));

vi.mock('./store', () => ({
  readAgeConfirmedLocal: vi.fn(),
}));

vi.mock('@/lib/storage/privateBoolean', () => ({
  requirePrivateBoolean: (result: { status: string; value?: boolean }) => {
    if (result.status === 'available') return result.value === true;
    if (result.status === 'absent') return false;
    if (result.status === 'corrupt') throw new Error('PRIVATE_BOOLEAN_INVALID');
    if (result.status === 'unsupported_version') {
      throw new Error('PRIVATE_BOOLEAN_UNSUPPORTED_VERSION');
    }
    throw new Error('PRIVATE_BOOLEAN_UNAVAILABLE');
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('community gate query options', () => {
  beforeEach(() => {
    vi.mocked(isCommunityConsentedWithLease).mockReset();
    vi.mocked(readAgeConfirmedLocal).mockReset();
    onlineManager.setOnline(true);
  });

  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('reads consent and age offline under one owner-scoped query', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const scope = createOwnerQueryScope();
    const options = communityGateQueryOptions(scope);
    vi.mocked(isCommunityConsentedWithLease).mockResolvedValueOnce(true);
    vi.mocked(readAgeConfirmedLocal).mockResolvedValueOnce({
      status: 'available',
      value: true,
      format: 'current',
    });
    onlineManager.setOnline(false);

    expect(options.queryKey).toEqual(queryKeys.communityGate(scope));
    expect(options.networkMode).toBe('always');
    expect(options.retry).toBe(0);
    await expect(client.fetchQuery(options)).resolves.toEqual({
      consented: true,
      ageConfirmed: true,
    });
    client.clear();
  });

  it('detaches a hung owner-A age read and caches only the complete owner-B gate', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const delayedAgeA = deferred<{
      status: 'available';
      value: boolean;
      format: 'current';
    }>();
    const scopeA = createOwnerQueryScope();
    vi.mocked(isCommunityConsentedWithLease).mockResolvedValueOnce(true);
    vi.mocked(readAgeConfirmedLocal).mockReturnValueOnce(delayedAgeA.promise);
    const pendingA = client.fetchQuery(communityGateQueryOptions(scopeA));
    await vi.waitFor(() => expect(readAgeConfirmedLocal).toHaveBeenCalledOnce());

    beginAccountGenerationBoundary();
    try {
      await expect(pendingA).rejects.toMatchObject({ code: ACCOUNT_GENERATION_CHANGED });
      await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
    } finally {
      endAccountGenerationBoundary();
    }

    const scopeB = createOwnerQueryScope();
    vi.mocked(isCommunityConsentedWithLease).mockResolvedValueOnce(false);
    vi.mocked(readAgeConfirmedLocal).mockResolvedValueOnce({
      status: 'available',
      value: false,
      format: 'current',
    });
    await expect(client.fetchQuery(communityGateQueryOptions(scopeB))).resolves.toEqual({
      consented: false,
      ageConfirmed: false,
    });

    delayedAgeA.resolve({ status: 'available', value: true, format: 'current' });
    await Promise.resolve();
    await Promise.resolve();
    expect(client.getQueryData(queryKeys.communityGate(scopeA))).toBeUndefined();
    expect(client.getQueryData(queryKeys.communityGate(scopeB))).toEqual({
      consented: false,
      ageConfirmed: false,
    });
    client.clear();
  });

  it('surfaces strict age storage failure and supports same-owner refresh', async () => {
    const options = communityGateQueryOptions(createOwnerQueryScope());
    vi.mocked(isCommunityConsentedWithLease).mockResolvedValue(true);
    vi.mocked(readAgeConfirmedLocal)
      .mockResolvedValueOnce({ status: 'unavailable', reason: 'storage_unavailable' })
      .mockResolvedValueOnce({ status: 'available', value: true, format: 'current' });

    await expect(options.queryFn()).rejects.toThrow('PRIVATE_BOOLEAN_UNAVAILABLE');
    await expect(options.queryFn()).resolves.toEqual({ consented: true, ageConfirmed: true });
  });
});
