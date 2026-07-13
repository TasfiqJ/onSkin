import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';

import { EDGE_REQUEST_POLICIES, invokeEdgeFunction } from './edgeFunctions';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: { getSession: mocks.getSession, getUser: mocks.getUser },
    functions: { invoke: mocks.invoke },
  },
}));

describe('Edge Function request policies', () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
    mocks.getUser.mockReset();
    mocks.getSession.mockReset();
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'account-a' } },
      error: null,
    });
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-a', user: { id: 'account-a' } } },
      error: null,
    });
  });

  it('defines explicit bounded policy for every mobile Edge Function', () => {
    expect(Object.keys(EDGE_REQUEST_POLICIES).sort()).toEqual([
      'account-deletion',
      'catalog-lookup',
      'catalog-report',
      'catalog-search',
      'consent-withdrawal',
      'data-export',
      'subscription-grants',
    ]);
    for (const policy of Object.values(EDGE_REQUEST_POLICIES)) {
      expect(policy.deadlineMs).toBeGreaterThan(0);
      expect(policy.maxAttempts).toBeGreaterThan(0);
      expect(policy.maxResponseBytes).toBeGreaterThan(0);
    }
    expect(EDGE_REQUEST_POLICIES['catalog-lookup']).toMatchObject({
      idempotent: true,
      maxAttempts: 2,
      ownerScoped: true,
    });
    expect(EDGE_REQUEST_POLICIES['catalog-report']).toMatchObject({
      idempotent: false,
      maxAttempts: 1,
      ownerScoped: true,
    });
  });

  it('passes only the bounded attempt signal and returns successful data', async () => {
    const caller = new AbortController();
    mocks.invoke.mockResolvedValueOnce({ data: { result: 'no_match' }, error: null });

    await expect(
      invokeEdgeFunction('catalog-search', {
        body: { query: 'private search text' },
        signal: caller.signal,
      }),
    ).resolves.toEqual({ result: 'no_match' });

    expect(mocks.invoke).toHaveBeenCalledWith('catalog-search', {
      body: { query: 'private search text' },
      headers: { Authorization: 'Bearer token-a' },
      signal: expect.any(AbortSignal),
    });
    expect(mocks.invoke.mock.calls[0]?.[1]?.signal).not.toBe(caller.signal);
  });

  it('never retries a non-idempotent report after a server failure', async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: Object.assign(new Error('provider payload'), { context: { status: 503 } }),
    });

    await expect(
      invokeEdgeFunction('catalog-report', { body: { correctionType: 'wrong_match' } }),
    ).rejects.toMatchObject({
      kind: 'server',
      attemptCount: 1,
      message: 'NETWORK_REQUEST_SERVER',
    });
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });

  it('retries an idempotent lookup once after a transient server failure', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      mocks.invoke
        .mockResolvedValueOnce({
          data: null,
          error: Object.assign(new Error('provider payload'), { context: { status: 503 } }),
        })
        .mockResolvedValueOnce({ data: { result: 'matched' }, error: null });

      const request = invokeEdgeFunction('catalog-lookup', { body: { barcode: '012345678905' } });
      await vi.runAllTimersAsync();
      await expect(request).resolves.toEqual({ result: 'matched' });
      expect(mocks.invoke).toHaveBeenCalledTimes(2);
      expect(mocks.getUser).toHaveBeenCalledTimes(1);
      expect(mocks.getSession).toHaveBeenCalledTimes(1);
      expect(
        mocks.invoke.mock.calls.every(
          (call) => call[1]?.headers?.Authorization === 'Bearer token-a',
        ),
      ).toBe(true);
    } finally {
      vi.restoreAllMocks();
      vi.useRealTimers();
    }
  });

  it('overrides a mutable caller Authorization header with the pinned initiating session', async () => {
    mocks.invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });

    await invokeEdgeFunction('data-export', {
      headers: { Authorization: 'Bearer mutable-client-token', 'X-Test': 'fixed' },
    });

    expect(mocks.invoke).toHaveBeenCalledWith('data-export', {
      headers: { Authorization: 'Bearer token-a', 'X-Test': 'fixed' },
      signal: expect.any(AbortSignal),
    });
  });

  it('aborts an in-flight A request at the boundary before B can reuse its payload', async () => {
    let requestStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      requestStarted = resolve;
    });
    mocks.invoke.mockImplementation(
      async (_name: string, options: { signal: AbortSignal; headers: Record<string, string> }) => {
        requestStarted();
        await new Promise<void>((resolve) => {
          if (options.signal.aborted) resolve();
          else options.signal.addEventListener('abort', () => resolve(), { once: true });
        });
        return {
          data: null,
          error: Object.assign(new Error('Failed to send a request to the Edge Function'), {
            context: Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }),
            name: 'FunctionsFetchError',
          }),
        };
      },
    );

    const request = invokeEdgeFunction('catalog-lookup', { body: { barcode: 'private-a' } });
    const rejection = expect(request).rejects.toMatchObject({ kind: 'owner_changed' });
    await started;
    beginAccountGenerationBoundary();
    try {
      await rejection;
    } finally {
      endAccountGenerationBoundary();
    }

    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(mocks.invoke.mock.calls[0]?.[1]?.headers).toEqual({
      Authorization: 'Bearer token-a',
    });
  });
});
