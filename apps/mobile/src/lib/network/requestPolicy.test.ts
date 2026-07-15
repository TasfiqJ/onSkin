import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  runAccountGenerationOperation,
} from '@/lib/auth/accountGeneration';

import {
  readRequestMetricSamples,
  RequestPolicyError,
  resetRequestMetricSamplesForTests,
  runRequest,
  runRequestWithLease,
} from './requestPolicy';

function httpError(status: number, retryAfter?: string): Error {
  return Object.assign(new Error('private server response must not be retained'), {
    context: {
      status,
      headers: {
        get: (name: string) => (name === 'Retry-After' ? (retryAfter ?? null) : null),
      },
    },
  });
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('request policy network failure matrix', () => {
  beforeEach(() => resetRequestMetricSamplesForTests());

  it('returns a bounded response and records only fixed, content-free metrics', async () => {
    const readings = [10, 22.345];

    await expect(
      runRequest(
        {
          endpoint: 'catalog_lookup',
          deadlineMs: 10_000,
          idempotent: true,
          maxResponseBytes: 100,
          ownerScoped: false,
          runtime: { now: () => readings.shift() ?? 0 },
        },
        async () => ({ result: 'matched' }),
      ),
    ).resolves.toEqual({ result: 'matched' });

    expect(readRequestMetricSamples()).toEqual([
      { endpoint: 'catalog_lookup', durationMs: 12.35, statusClass: '2xx', attemptCount: 1 },
    ]);
  });

  it('reuses an existing owner lease without opening a nested request operation', async () => {
    const operation = vi.fn(async () => ({ answer: 'bounded' }));

    await expect(
      runAccountGenerationOperation((lease) =>
        runRequestWithLease(
          lease,
          {
            endpoint: 'ask_grounded',
            deadlineMs: 1_000,
            idempotent: true,
            maxResponseBytes: 100,
          },
          (context) => {
            expect(context.ownerLease).toBe(lease);
            return operation();
          },
        ),
      ),
    ).resolves.toEqual({ answer: 'bounded' });

    expect(operation).toHaveBeenCalledOnce();
    expect(readRequestMetricSamples()[0]).toMatchObject({
      endpoint: 'ask_grounded',
      statusClass: '2xx',
      attemptCount: 1,
    });
  });

  it('enforces the deadline even when the underlying operation ignores its signal', async () => {
    vi.useFakeTimers();
    try {
      const request = runRequest(
        {
          endpoint: 'data_export',
          deadlineMs: 50,
          idempotent: false,
        },
        async () => new Promise<never>(() => undefined),
      );
      const rejection = expect(request).rejects.toMatchObject({
        kind: 'timeout',
        attemptCount: 1,
        message: 'NETWORK_REQUEST_TIMEOUT',
      });
      await vi.advanceTimersByTimeAsync(50);
      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries only idempotent transient server failures with full jitter', async () => {
    const sleep = vi.fn(async () => undefined);
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValueOnce('ok');

    await expect(
      runRequest(
        {
          endpoint: 'catalog_search',
          deadlineMs: 1_000,
          idempotent: true,
          maxAttempts: 3,
          baseRetryDelayMs: 200,
          ownerScoped: false,
          runtime: { random: () => 0.5, sleep },
        },
        operation,
      ),
    ).resolves.toBe('ok');

    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(100, expect.any(AbortSignal));
    expect(readRequestMetricSamples()[0]).toMatchObject({
      endpoint: 'catalog_search',
      statusClass: '2xx',
      attemptCount: 2,
    });
  });

  it('honors Retry-After for a rate limit and caps unbounded provider delays', async () => {
    const sleep = vi.fn(async () => undefined);
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(httpError(429, '120'))
      .mockResolvedValueOnce('ok');

    await expect(
      runRequest(
        {
          endpoint: 'catalog_lookup',
          deadlineMs: 10_000,
          idempotent: true,
          maxRetryAfterMs: 5_000,
          ownerScoped: false,
          runtime: { sleep },
        },
        operation,
      ),
    ).resolves.toBe('ok');

    expect(sleep).toHaveBeenCalledWith(5_000, expect.any(AbortSignal));
  });

  it('enforces one absolute deadline across retry delay and later attempts', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(1);
    try {
      const operation = vi
        .fn<() => Promise<string>>()
        .mockRejectedValueOnce(httpError(503))
        .mockImplementationOnce(async () => new Promise<never>(() => undefined));
      const request = runRequest(
        {
          endpoint: 'catalog_search',
          deadlineMs: 1_000,
          idempotent: true,
          baseRetryDelayMs: 800,
          maxRetryDelayMs: 800,
          ownerScoped: false,
        },
        operation,
      );
      const rejection = expect(request).rejects.toMatchObject({
        kind: 'timeout',
        attemptCount: 2,
      });

      await vi.advanceTimersByTimeAsync(999);
      expect(operation).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      await rejection;
    } finally {
      vi.restoreAllMocks();
      vi.useRealTimers();
    }
  });

  it('does not wait past the absolute budget for a longer Retry-After', async () => {
    const sleep = vi.fn(async () => undefined);
    const operation = vi.fn(async () => Promise.reject(httpError(429, '120')));

    await expect(
      runRequest(
        {
          endpoint: 'catalog_lookup',
          deadlineMs: 1_000,
          idempotent: true,
          maxRetryAfterMs: 30_000,
          ownerScoped: false,
          runtime: { sleep },
        },
        operation,
      ),
    ).rejects.toMatchObject({ kind: 'timeout', attemptCount: 1 });
    expect(sleep).not.toHaveBeenCalled();
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it.each([
    [401, 'authentication'],
    [422, 'validation'],
  ] as const)('never retries deterministic HTTP %s failures', async (status, kind) => {
    const operation = vi.fn(async () => Promise.reject(httpError(status)));

    await expect(
      runRequest(
        {
          endpoint: 'subscription_grants',
          deadlineMs: 1_000,
          idempotent: true,
          maxAttempts: 4,
        },
        operation,
      ),
    ).rejects.toMatchObject({ kind, attemptCount: 1 });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('does not retry a non-idempotent request even when the failure is transient', async () => {
    const operation = vi.fn(async () => Promise.reject(httpError(503)));

    await expect(
      runRequest(
        {
          endpoint: 'catalog_report',
          deadlineMs: 1_000,
          idempotent: false,
          maxAttempts: 4,
          ownerScoped: false,
        },
        operation,
      ),
    ).rejects.toMatchObject({ kind: 'server', attemptCount: 1 });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries a classified offline transport failure without retaining its message', async () => {
    const sleep = vi.fn(async () => undefined);
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch private barcode 012345678905'))
      .mockResolvedValueOnce('ok');

    await expect(
      runRequest(
        {
          endpoint: 'catalog_lookup',
          deadlineMs: 1_000,
          idempotent: true,
          ownerScoped: false,
          runtime: { random: () => 0, sleep },
        },
        operation,
      ),
    ).resolves.toBe('ok');
    expect(JSON.stringify(readRequestMetricSamples())).not.toContain('012345678905');
  });

  it('unwraps the production Supabase FunctionsFetchError transport context', async () => {
    const sleep = vi.fn(async () => undefined);
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(
        new FunctionsFetchError(new TypeError('Failed to fetch private search content')),
      )
      .mockResolvedValueOnce('ok');

    await expect(
      runRequest(
        {
          endpoint: 'catalog_search',
          deadlineMs: 1_000,
          idempotent: true,
          ownerScoped: false,
          runtime: { random: () => 0, sleep },
        },
        operation,
      ),
    ).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(readRequestMetricSamples())).not.toContain('private search content');
  });

  it('unwraps production Supabase HTTP status and Retry-After metadata', async () => {
    const sleep = vi.fn(async () => undefined);
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(
        new FunctionsHttpError(
          new Response(null, { status: 429, headers: { 'Retry-After': '2' } }),
        ),
      )
      .mockResolvedValueOnce('ok');

    await expect(
      runRequest(
        {
          endpoint: 'catalog_lookup',
          deadlineMs: 10_000,
          idempotent: true,
          ownerScoped: false,
          runtime: { sleep },
        },
        operation,
      ),
    ).resolves.toBe('ok');
    expect(sleep).toHaveBeenCalledWith(2_000, expect.any(AbortSignal));
  });

  it('treats an aborted Supabase fetch wrapper as cancellation, not offline retry', async () => {
    const nestedAbort = Object.assign(new Error('The operation was aborted'), {
      name: 'AbortError',
    });
    const operation = vi.fn(async () => Promise.reject(new FunctionsFetchError(nestedAbort)));

    await expect(
      runRequest(
        {
          endpoint: 'catalog_search',
          deadlineMs: 1_000,
          idempotent: true,
          ownerScoped: false,
        },
        operation,
      ),
    ).rejects.toMatchObject({ kind: 'cancelled', attemptCount: 1 });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('classifies the production Supabase relay wrapper as a transient server failure', async () => {
    const operation = vi.fn(async () => Promise.reject(new FunctionsRelayError({})));

    await expect(
      runRequest(
        {
          endpoint: 'data_export',
          deadlineMs: 1_000,
          idempotent: false,
          ownerScoped: false,
        },
        operation,
      ),
    ).rejects.toMatchObject({ kind: 'server', statusClass: '5xx' });
  });

  it('does not call the operation at all for a pre-aborted caller signal', async () => {
    const controller = new AbortController();
    controller.abort();
    const operation = vi.fn(async () => 'must-not-run');

    await expect(
      runRequest(
        {
          endpoint: 'catalog_report',
          deadlineMs: 1_000,
          idempotent: false,
          ownerScoped: false,
          signal: controller.signal,
        },
        operation,
      ),
    ).rejects.toMatchObject({ kind: 'cancelled', attemptCount: 1 });
    expect(operation).not.toHaveBeenCalled();
  });

  it('cancels immediately when the caller signal aborts', async () => {
    const controller = new AbortController();
    const started = deferred<void>();
    const request = runRequest(
      {
        endpoint: 'catalog_search',
        deadlineMs: 10_000,
        idempotent: true,
        ownerScoped: false,
        signal: controller.signal,
      },
      async () => started.promise,
    );
    controller.abort();

    await expect(request).rejects.toMatchObject({ kind: 'cancelled', attemptCount: 1 });
  });

  it('aborts owner-scoped work at an account-generation boundary and never retries it', async () => {
    const started = deferred<void>();
    const entered = deferred<void>();
    const operation = vi.fn(async () => {
      entered.resolve();
      return started.promise;
    });
    const request = runRequest(
      {
        endpoint: 'data_export',
        deadlineMs: 10_000,
        idempotent: true,
        maxAttempts: 4,
      },
      operation,
    );

    await entered.promise;
    beginAccountGenerationBoundary();
    try {
      await expect(request).rejects.toMatchObject({ kind: 'owner_changed', attemptCount: 1 });
    } finally {
      endAccountGenerationBoundary();
    }
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('rejects oversized responses without exposing the response payload', async () => {
    const privatePayload = 'private-response-value';
    let thrown: unknown;
    try {
      await runRequest(
        {
          endpoint: 'data_export',
          deadlineMs: 1_000,
          idempotent: true,
          maxResponseBytes: 8,
        },
        async () => ({ privatePayload }),
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(RequestPolicyError);
    expect(thrown).toMatchObject({
      kind: 'response_too_large',
      message: 'NETWORK_REQUEST_RESPONSE_TOO_LARGE',
    });
    expect(JSON.stringify(thrown)).not.toContain(privatePayload);
    expect(JSON.stringify(readRequestMetricSamples())).not.toContain(privatePayload);
  });

  it('bounds retained request diagnostics', async () => {
    for (let index = 0; index < 220; index += 1) {
      await runRequest(
        {
          endpoint: 'catalog_lookup',
          deadlineMs: 1_000,
          idempotent: true,
          ownerScoped: false,
        },
        async () => index,
      );
    }

    expect(readRequestMetricSamples()).toHaveLength(200);
  });
});
