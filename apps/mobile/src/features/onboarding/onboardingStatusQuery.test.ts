import { onlineManager, QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_GENERATION_CHANGED,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';
import { createOwnerQueryScope, queryKeys } from '@/lib/query/queryKeys';
import { alwaysRefetchSuccessfulQuery } from '@/lib/query/queryPolicies';

import { SKIN_PROFILE_INVALID, SKIN_PROFILE_UNSUPPORTED_VERSION } from './skinProfileStore';
import {
  classifyOnboardingStatusFailure,
  decideWelcomeOnboardingGate,
  onboardingStatusQueryOptions,
  ONBOARDING_STATUS_UNAVAILABLE,
  OnboardingStatusUnavailableError,
} from './onboardingStatusQuery';

const mocks = vi.hoisted(() => ({
  abortSignal: vi.fn(),
  backendConfigured: true,
  from: vi.fn(),
  not: vi.fn(),
  readLocalOnboardingStatus: vi.fn(),
  select: vi.fn(),
  serverSignal: null as AbortSignal | null,
}));

const serverQuery = {
  abortSignal: mocks.abortSignal,
  not: mocks.not,
  select: mocks.select,
};

vi.mock('@/lib/env', () => ({
  get isSupabaseConfigured() {
    return mocks.backendConfigured;
  },
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: { from: mocks.from },
}));

vi.mock('./skinProfileStore', () => ({
  readLocalOnboardingStatus: mocks.readLocalOnboardingStatus,
  SKIN_PROFILE_INVALID: 'SKIN_PROFILE_INVALID',
  SKIN_PROFILE_UNAVAILABLE: 'SKIN_PROFILE_UNAVAILABLE',
  SKIN_PROFILE_UNSUPPORTED_VERSION: 'SKIN_PROFILE_UNSUPPORTED_VERSION',
}));

function serverResult(count: number | null, error: unknown = null) {
  return { count, data: null, error };
}

describe('owner-bound onboarding status query', () => {
  beforeEach(() => {
    for (let index = 0; index < 4; index += 1) endAccountGenerationBoundary();

    mocks.abortSignal.mockReset();
    mocks.backendConfigured = true;
    mocks.from.mockReset();
    mocks.not.mockReset();
    mocks.readLocalOnboardingStatus.mockReset();
    mocks.select.mockReset();
    mocks.serverSignal = null;

    mocks.from.mockReturnValue(serverQuery);
    mocks.select.mockReturnValue(serverQuery);
    mocks.not.mockReturnValue(serverQuery);
    mocks.abortSignal.mockImplementation((signal: AbortSignal) => {
      mocks.serverSignal = signal;
      return Promise.resolve(serverResult(0));
    });
    mocks.readLocalOnboardingStatus.mockResolvedValue('missing');
    onlineManager.setOnline(true);
  });

  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('runs the authoritative local read through QueryClient while offline', async () => {
    mocks.readLocalOnboardingStatus.mockResolvedValue('complete');
    const ownerScope = createOwnerQueryScope();
    const options = onboardingStatusQueryOptions(ownerScope);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    onlineManager.setOnline(false);

    expect(options.queryKey).toEqual(queryKeys.onboarded(ownerScope));
    expect(options.networkMode).toBe('always');
    expect(options.refetchOnMount).toBe(alwaysRefetchSuccessfulQuery);
    expect(alwaysRefetchSuccessfulQuery({ state: { status: 'success' } })).toBe('always');
    expect(alwaysRefetchSuccessfulQuery({ state: { status: 'error' } })).toBe(false);
    expect(options.retry).toBe(false);
    expect(options.staleTime).toBe(0);
    await expect(client.fetchQuery(options)).resolves.toBe(true);
    expect(mocks.from).not.toHaveBeenCalled();
    client.clear();
  });

  it('preserves no-backend development behavior for a genuinely missing profile', async () => {
    mocks.backendConfigured = false;
    const options = onboardingStatusQueryOptions(createOwnerQueryScope());

    await expect(options.queryFn()).resolves.toBe(false);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('falls through only a missing local profile and supports same-owner refresh', async () => {
    mocks.abortSignal
      .mockImplementationOnce((signal: AbortSignal) => {
        mocks.serverSignal = signal;
        return Promise.resolve(serverResult(0));
      })
      .mockImplementationOnce((signal: AbortSignal) => {
        mocks.serverSignal = signal;
        return Promise.resolve(serverResult(1));
      });
    const ownerScope = createOwnerQueryScope();
    const options = onboardingStatusQueryOptions(ownerScope);

    await expect(options.queryFn()).resolves.toBe(false);
    await expect(options.queryFn()).resolves.toBe(true);
    expect(mocks.from).toHaveBeenCalledTimes(2);
    expect(mocks.abortSignal).toHaveBeenCalledTimes(2);
    expect(mocks.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('fails closed when the server mirror returns an error', async () => {
    const serverError = { code: 'NETWORK_ERROR', message: 'offline' };
    mocks.abortSignal.mockResolvedValue(serverResult(null, serverError));
    const options = onboardingStatusQueryOptions(createOwnerQueryScope());

    await expect(options.queryFn()).rejects.toMatchObject({
      endpoint: 'onboarding_status',
      kind: 'offline',
      attemptCount: 2,
      message: 'NETWORK_REQUEST_OFFLINE',
    });
  });

  it.each([null, Number.NaN, Number.POSITIVE_INFINITY, -1, 1.5])(
    'fails closed with a typed unavailable error for malformed exact count %s',
    async (count) => {
      mocks.abortSignal.mockResolvedValue(serverResult(count));
      const options = onboardingStatusQueryOptions(createOwnerQueryScope());

      const outcome = options.queryFn();
      await expect(outcome).rejects.toBeInstanceOf(OnboardingStatusUnavailableError);
      await expect(outcome).rejects.toMatchObject({ code: ONBOARDING_STATUS_UNAVAILABLE });
    },
  );

  it('propagates a strict local read failure through QueryClient without server fallback', async () => {
    const localError = new Error(SKIN_PROFILE_INVALID);
    mocks.readLocalOnboardingStatus.mockRejectedValue(localError);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const options = onboardingStatusQueryOptions(createOwnerQueryScope());

    await expect(client.fetchQuery(options)).rejects.toBe(localError);
    expect(mocks.readLocalOnboardingStatus).toHaveBeenCalledOnce();

    const remounted = new QueryObserver(client, options);
    const unsubscribe = remounted.subscribe(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(remounted.getCurrentResult().isError).toBe(true);
    expect(mocks.readLocalOnboardingStatus).toHaveBeenCalledOnce();

    const retried = await remounted.refetch();
    expect(retried.isError).toBe(true);
    expect(mocks.readLocalOnboardingStatus).toHaveBeenCalledTimes(2);
    expect(mocks.from).not.toHaveBeenCalled();
    unsubscribe();
    client.clear();
  });

  it('keeps cached completion data behind the gate until its fresh observer fetch settles', async () => {
    let resolveLocal!: (status: 'complete' | 'missing') => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    mocks.readLocalOnboardingStatus.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLocal = resolve;
          markStarted();
        }),
    );
    mocks.abortSignal.mockResolvedValue(serverResult(0));
    const ownerScope = createOwnerQueryScope();
    const options = onboardingStatusQueryOptions(ownerScope);
    const client = new QueryClient({
      // Match the app client's local-first default. The startup query must
      // override it so even freshly cached gate data is revalidated on mount.
      defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
    });
    client.setQueryData(options.queryKey, true);
    const observer = new QueryObserver(client, options);
    const unsubscribe = observer.subscribe(() => undefined);

    await started;
    const refreshing = observer.getCurrentResult();
    expect(refreshing.data).toBe(true);
    expect(refreshing.isFetching).toBe(true);
    expect(
      decideWelcomeOnboardingGate({
        data: refreshing.data,
        initializing: false,
        isError: refreshing.isError,
        isFetching: refreshing.isFetching,
        isSuccess: refreshing.isSuccess,
        ownerScopeCurrent: true,
        resetting: false,
        shouldCheck: true,
      }),
    ).toBe('checking');

    resolveLocal('missing');
    await vi.waitFor(() => expect(observer.getCurrentResult().isFetching).toBe(false));
    const fresh = observer.getCurrentResult();
    expect(fresh.data).toBe(false);
    expect(
      decideWelcomeOnboardingGate({
        data: fresh.data,
        initializing: false,
        isError: fresh.isError,
        isFetching: fresh.isFetching,
        isSuccess: fresh.isSuccess,
        ownerScopeCurrent: true,
        resetting: false,
        shouldCheck: true,
      }),
    ).toBe('welcome');

    unsubscribe();
    client.clear();
  });

  it('ignores disabled cached query state until there is an authenticated owner to check', () => {
    expect(
      decideWelcomeOnboardingGate({
        data: true,
        initializing: false,
        isError: false,
        isFetching: false,
        isSuccess: true,
        ownerScopeCurrent: true,
        resetting: false,
        shouldCheck: false,
      }),
    ).toBe('welcome');
  });

  it('keeps the retry error surface mounted while an explicit refetch is active', () => {
    expect(
      decideWelcomeOnboardingGate({
        data: true,
        initializing: false,
        isError: true,
        isFetching: true,
        isSuccess: false,
        ownerScopeCurrent: true,
        resetting: false,
        shouldCheck: true,
      }),
    ).toBe('error');
  });

  it('routes retained cached completion to error when the fresh observer fetch fails', async () => {
    const localError = new Error('private storage temporarily unavailable');
    mocks.readLocalOnboardingStatus.mockRejectedValue(localError);
    const ownerScope = createOwnerQueryScope();
    const options = onboardingStatusQueryOptions(ownerScope);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(options.queryKey, true);
    const observer = new QueryObserver(client, options);
    const unsubscribe = observer.subscribe(() => undefined);

    await vi.waitFor(() => expect(observer.getCurrentResult().isError).toBe(true));
    const failedRefresh = observer.getCurrentResult();
    expect(failedRefresh.data).toBe(true);
    expect(failedRefresh.isFetching).toBe(false);
    expect(
      decideWelcomeOnboardingGate({
        data: failedRefresh.data,
        initializing: false,
        isError: failedRefresh.isError,
        isFetching: failedRefresh.isFetching,
        isSuccess: failedRefresh.isSuccess,
        ownerScopeCurrent: true,
        resetting: false,
        shouldCheck: true,
      }),
    ).toBe('error');

    unsubscribe();
    client.clear();
  });

  it('gives preserved corrupt and future-version profiles distinct guidance classes', () => {
    expect(classifyOnboardingStatusFailure(new Error(SKIN_PROFILE_INVALID))).toBe(
      'invalid_profile',
    );
    expect(classifyOnboardingStatusFailure(new Error(SKIN_PROFILE_UNSUPPORTED_VERSION))).toBe(
      'unsupported_profile',
    );
    expect(classifyOnboardingStatusFailure(new Error('offline'))).toBe('retryable_unavailable');
  });

  it('detaches a hung local read at A to B and suppresses its late result', async () => {
    let resolveLocal!: (status: 'complete' | 'missing') => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    mocks.readLocalOnboardingStatus.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLocal = resolve;
          markStarted();
        }),
    );
    const queryA = onboardingStatusQueryOptions(createOwnerQueryScope());
    let publishedA = false;
    const outcomeA = queryA.queryFn().then(
      (value) => {
        publishedA = true;
        return { status: 'resolved' as const, value };
      },
      (error: unknown) => ({ status: 'rejected' as const, error }),
    );

    await started;
    beginAccountGenerationBoundary();
    const rejected = await outcomeA;
    expect(rejected.status).toBe('rejected');
    expect((rejected as { error: Error }).error.message).toBe(ACCOUNT_GENERATION_CHANGED);
    await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
    endAccountGenerationBoundary();

    mocks.readLocalOnboardingStatus.mockResolvedValueOnce('complete');
    const queryB = onboardingStatusQueryOptions(createOwnerQueryScope());
    await expect(queryB.queryFn()).resolves.toBe(true);

    resolveLocal('missing');
    await Promise.resolve();
    await Promise.resolve();
    expect(publishedA).toBe(false);
  });

  it('aborts and detaches a hung server read at A to B while B reads independently', async () => {
    let resolveServer!: (result: ReturnType<typeof serverResult>) => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    mocks.abortSignal.mockImplementationOnce(
      (signal: AbortSignal) =>
        new Promise((resolve) => {
          mocks.serverSignal = signal;
          resolveServer = resolve;
          markStarted();
        }),
    );
    const queryA = onboardingStatusQueryOptions(createOwnerQueryScope());
    let publishedA = false;
    const outcomeA = queryA.queryFn().then(
      (value) => {
        publishedA = true;
        return { status: 'resolved' as const, value };
      },
      (error: unknown) => ({ status: 'rejected' as const, error }),
    );

    await started;
    beginAccountGenerationBoundary();
    const rejected = await outcomeA;
    expect(rejected.status).toBe('rejected');
    expect((rejected as { error: Error }).error.message).toBe(ACCOUNT_GENERATION_CHANGED);
    await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
    expect(mocks.serverSignal?.aborted).toBe(true);
    endAccountGenerationBoundary();

    mocks.readLocalOnboardingStatus.mockResolvedValueOnce('complete');
    const queryB = onboardingStatusQueryOptions(createOwnerQueryScope());
    await expect(queryB.queryFn()).resolves.toBe(true);

    resolveServer(serverResult(1));
    await Promise.resolve();
    await Promise.resolve();
    expect(publishedA).toBe(false);
  });
});
