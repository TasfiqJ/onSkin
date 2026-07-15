import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_GENERATION_CHANGED,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';
import { RequestPolicyError } from '@/lib/network/requestPolicy';
import { createOwnerQueryScope, queryKeys, type OwnerQueryScope } from '@/lib/query/queryKeys';

import {
  ASK_GROUNDED_DELIVERY_FAILED,
  ASK_GROUNDED_DELIVERY_MUST_BE_SYNCHRONOUS,
  ASK_GROUNDED_TURN_IN_PROGRESS,
  ASK_GROUNDED_TURN_OPERATION_CONFLICT,
  createGroundedTurnOperationId,
  createGroundedTurnRequestFingerprint,
  resetGroundedTurnCoordinatorForTests,
  runGroundedTurnForOwner,
  type GroundedTurnExecution,
} from './groundedTurnReservation';
import { reserveTrialGroundedTurn } from './store';

const mocks = vi.hoisted(() => ({
  randomUUID: vi.fn(),
}));

vi.mock('expo-crypto', () => ({ randomUUID: mocks.randomUUID }));
vi.mock('./store', () => ({ reserveTrialGroundedTurn: vi.fn() }));

const OPERATION_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as ReturnType<
  typeof createGroundedTurnOperationId
>;
const OPERATION_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as ReturnType<
  typeof createGroundedTurnOperationId
>;
const FINGERPRINT_A = '11111111111111111111111111111111' as ReturnType<
  typeof createGroundedTurnRequestFingerprint
>;
const FINGERPRINT_B = '22222222222222222222222222222222' as ReturnType<
  typeof createGroundedTurnRequestFingerprint
>;
const ASK_TURN_CAP_REACHED = 'ASK_TURN_CAP_REACHED';

function deferred<T>(): {
  promise: Promise<T>;
  reject: (reason: unknown) => void;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

function queryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function trialAccess(
  operationId = OPERATION_A,
  period = '2026-07',
): Readonly<{ kind: 'trial'; operationId: typeof OPERATION_A; period: string }> {
  return { kind: 'trial', operationId, period };
}

function execution<TProvider, TPublished>(
  client: QueryClient,
  input: Pick<GroundedTurnExecution<TProvider, TPublished>, 'publish' | 'request'> &
    Partial<
      Pick<
        GroundedTurnExecution<TProvider, TPublished>,
        'providerDeadlineMs' | 'providerMaxResponseBytes' | 'requestFingerprint'
      >
    >,
): GroundedTurnExecution<TProvider, TPublished> {
  return {
    providerDeadlineMs: input.providerDeadlineMs ?? 1_000,
    providerMaxResponseBytes: input.providerMaxResponseBytes,
    publish: input.publish,
    queryClient: client,
    request: input.request,
    requestFingerprint: input.requestFingerprint ?? FINGERPRINT_A,
  };
}

let boundaryActive = false;

function startBoundary(): void {
  beginAccountGenerationBoundary();
  boundaryActive = true;
}

function finishBoundary(): void {
  endAccountGenerationBoundary();
  boundaryActive = false;
}

describe('future grounded-turn provider boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetGroundedTurnCoordinatorForTests();
    mocks.randomUUID
      .mockReturnValueOnce('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      .mockReturnValueOnce('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  });

  afterEach(async () => {
    if (boundaryActive) finishBoundary();
    await waitForAccountGenerationOperationsToSettle();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('owns fresh opaque operation identities for distinct provider turns', () => {
    expect(createGroundedTurnOperationId()).toBe('aaaaaaaaaaaa4aaa8aaaaaaaaaaaaaaa');
    expect(createGroundedTurnOperationId()).toBe('bbbbbbbbbbbb4bbb8bbbbbbbbbbbbbbb');
  });

  it('owns a fresh opaque identity for one exact provider input', () => {
    expect(createGroundedTurnRequestFingerprint()).toBe(
      'aaaaaaaaaaaa4aaa8aaaaaaaaaaaaaaa',
    );
  });

  it('rejects a malformed entropy-provider result', () => {
    mocks.randomUUID.mockReset();
    mocks.randomUUID.mockReturnValueOnce('not-a-uuid');

    expect(() => createGroundedTurnOperationId()).toThrow('ASK_TURN_OPERATION_ID_UNAVAILABLE');
  });

  it('reserves, updates only the exact owner quota cache, requests, and publishes in order', async () => {
    vi.mocked(reserveTrialGroundedTurn).mockResolvedValueOnce(3);
    const client = queryClient();
    const scope = createOwnerQueryScope();
    const otherScope: OwnerQueryScope = Object.freeze({ generation: scope.generation + 100 });
    client.setQueryData(queryKeys.askGroundedTurns(scope, '2026-07'), 2);
    client.setQueryData(queryKeys.askGroundedTurns(otherScope, '2026-07'), 9);
    const request = vi.fn(async (context) => {
      expect(context).toMatchObject({
        attempt: 1,
        operationId: OPERATION_A,
        recordedTrialCount: 3,
      });
      expect(context.signal).toBeInstanceOf(AbortSignal);
      expect(client.getQueryData(queryKeys.askGroundedTurns(scope, '2026-07'))).toBe(3);
      return 'provider-answer';
    });
    const publish = vi.fn((result, context) => {
      context.assertCurrent();
      expect(context).toMatchObject({
        operationId: OPERATION_A,
        ownerScope: scope,
        recordedTrialCount: 3,
      });
      return `published:${result}`;
    });

    await expect(
      runGroundedTurnForOwner(scope, trialAccess(), execution(client, { publish, request })),
    ).resolves.toBe('published:provider-answer');

    expect(reserveTrialGroundedTurn).toHaveBeenCalledWith('2026-07', OPERATION_A);
    expect(request).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledOnce();
    expect(client.getQueryData(queryKeys.askGroundedTurns(scope, '2026-07'))).toBe(3);
    expect(client.getQueryData(queryKeys.askGroundedTurns(otherScope, '2026-07'))).toBe(9);
  });

  it('retries one provider request identity without reserving, publishing quota, or delivering twice', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    vi.mocked(reserveTrialGroundedTurn).mockResolvedValueOnce(1);
    const client = queryClient();
    const setQueryData = vi.spyOn(client, 'setQueryData');
    const scope = createOwnerQueryScope();
    const retryableFailure = Object.assign(new Error('PROVIDER_SERVER_FAILURE'), { status: 503 });
    const request = vi
      .fn()
      .mockRejectedValueOnce(retryableFailure)
      .mockResolvedValueOnce('provider-answer');
    const publish = vi.fn((result: string) => `published:${result}`);

    await expect(
      runGroundedTurnForOwner(scope, trialAccess(), execution(client, { publish, request })),
    ).resolves.toBe('published:provider-answer');

    expect(reserveTrialGroundedTurn).toHaveBeenCalledOnce();
    expect(setQueryData).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls.map(([context]) => context.attempt)).toEqual([1, 2]);
    expect(request.mock.calls.map(([context]) => context.operationId)).toEqual([
      OPERATION_A,
      OPERATION_A,
    ]);
    expect(publish).toHaveBeenCalledOnce();
  });

  it('keeps an existing higher owner quota count when an idempotent replay reports less', async () => {
    vi.mocked(reserveTrialGroundedTurn).mockResolvedValueOnce(3);
    const client = queryClient();
    const scope = createOwnerQueryScope();
    client.setQueryData(queryKeys.askGroundedTurns(scope, '2026-07'), 4);
    const providerFailure = new Error('PROVIDER_PRIVATE_FAILURE');

    await expect(
      runGroundedTurnForOwner(
        scope,
        trialAccess(),
        execution<string, string>(client, {
          publish: (result) => result,
          request: async () => Promise.reject(providerFailure),
        }),
      ),
    ).rejects.toMatchObject({
      endpoint: 'ask_grounded',
      kind: 'unknown',
      message: 'NETWORK_REQUEST_UNKNOWN',
    });

    expect(client.getQueryData(queryKeys.askGroundedTurns(scope, '2026-07'))).toBe(4);
  });

  it('preserves a same-owner typed reservation failure and never calls the provider', async () => {
    const capError = new Error(ASK_TURN_CAP_REACHED);
    vi.mocked(reserveTrialGroundedTurn).mockRejectedValueOnce(capError);
    const client = queryClient();
    const scope = createOwnerQueryScope();
    const request = vi.fn(async () => 'must-not-run');
    const publish = vi.fn((result: string) => result);

    await expect(
      runGroundedTurnForOwner(scope, trialAccess(), execution(client, { publish, request })),
    ).rejects.toBe(capError);

    expect(request).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(client.getQueryData(queryKeys.askGroundedTurns(scope, '2026-07'))).toBeUndefined();
  });

  it('uses an identified uncapped path without reserving or touching trial cache', async () => {
    const client = queryClient();
    const scope = createOwnerQueryScope();

    await expect(
      runGroundedTurnForOwner(
        scope,
        { kind: 'uncapped', operationId: OPERATION_A },
        execution(client, {
          publish: (result, context) => {
            expect(context.recordedTrialCount).toBeNull();
            return result;
          },
          request: async (context) => {
            expect(context.recordedTrialCount).toBeNull();
            return 'paid-answer';
          },
        }),
      ),
    ).resolves.toBe('paid-answer');

    expect(reserveTrialGroundedTurn).not.toHaveBeenCalled();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  it('does not let a never-resolving provider pin the account boundary', async () => {
    vi.mocked(reserveTrialGroundedTurn).mockResolvedValueOnce(1);
    const client = queryClient();
    const scope = createOwnerQueryScope();
    const observed: { signal?: AbortSignal } = {};
    const request = vi.fn(async (context) => {
      observed.signal = context.signal;
      return new Promise<never>(() => undefined);
    });
    const publish = vi.fn((result: never) => result);
    const pending = runGroundedTurnForOwner(
      scope,
      trialAccess(),
      execution(client, { publish, request }),
    );
    await flushMicrotasks();
    expect(request).toHaveBeenCalledOnce();

    startBoundary();

    await expect(pending).rejects.toThrow(ACCOUNT_GENERATION_CHANGED);
    await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
    expect(observed.signal?.aborted).toBe(true);
    expect(publish).not.toHaveBeenCalled();
  });

  it('bounds an ignored provider signal and consumes its rejection after timeout', async () => {
    vi.useFakeTimers();
    vi.mocked(reserveTrialGroundedTurn).mockResolvedValueOnce(1);
    const client = queryClient();
    const scope = createOwnerQueryScope();
    const provider = deferred<string>();
    const observed: { signal?: AbortSignal } = {};
    const publish = vi.fn((result: string) => result);
    const pending = runGroundedTurnForOwner(
      scope,
      trialAccess(),
      execution(client, {
        providerDeadlineMs: 50,
        publish,
        request: async (context) => {
          observed.signal = context.signal;
          return provider.promise;
        },
      }),
    );
    const rejected = expect(pending).rejects.toMatchObject({
      endpoint: 'ask_grounded',
      kind: 'timeout',
      message: 'NETWORK_REQUEST_TIMEOUT',
    } satisfies Partial<RequestPolicyError>);

    await vi.advanceTimersByTimeAsync(50);
    await rejected;
    expect(observed.signal?.aborted).toBe(true);
    provider.reject(new Error('LATE_PROVIDER_FAILURE_AFTER_TIMEOUT'));
    await flushMicrotasks();
    expect(publish).not.toHaveBeenCalled();
  });

  it('keeps the ambiguous reservation write in the account-boundary drain', async () => {
    const reservation = deferred<number>();
    vi.mocked(reserveTrialGroundedTurn).mockReturnValueOnce(reservation.promise);
    const client = queryClient();
    const scope = createOwnerQueryScope();
    const request = vi.fn(async () => 'must-not-run');
    const publish = vi.fn((result: string) => result);
    const pending = runGroundedTurnForOwner(
      scope,
      trialAccess(),
      execution(client, { publish, request }),
    );
    await flushMicrotasks();
    expect(reserveTrialGroundedTurn).toHaveBeenCalledOnce();

    startBoundary();
    let drained = false;
    const drain = waitForAccountGenerationOperationsToSettle().then(() => {
      drained = true;
    });
    await flushMicrotasks();
    expect(drained).toBe(false);

    reservation.resolve(1);
    await expect(pending).rejects.toThrow(ACCOUNT_GENERATION_CHANGED);
    await drain;
    expect(request).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('lets boundary cancellation dominate a later reservation storage failure', async () => {
    const reservation = deferred<number>();
    vi.mocked(reserveTrialGroundedTurn).mockReturnValueOnce(reservation.promise);
    const client = queryClient();
    const scope = createOwnerQueryScope();
    const pending = runGroundedTurnForOwner(
      scope,
      trialAccess(),
      execution(client, {
        publish: (result: string) => result,
        request: async () => 'must-not-run',
      }),
    );
    await flushMicrotasks();

    startBoundary();
    reservation.reject(new Error('PRIVATE_WRITE_FAILED_AFTER_BOUNDARY'));

    await expect(pending).rejects.toThrow(ACCOUNT_GENERATION_CHANGED);
  });

  it('drops a late owner-A provider result while owner B starts fresh', async () => {
    const ownerAProvider = deferred<string>();
    vi.mocked(reserveTrialGroundedTurn).mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    const client = queryClient();
    const ownerA = createOwnerQueryScope();
    const publishA = vi.fn((result: string) => `A:${result}`);
    const ownerAPending = runGroundedTurnForOwner(
      ownerA,
      trialAccess(),
      execution(client, {
        publish: publishA,
        request: async () => ownerAProvider.promise,
      }),
    );
    await flushMicrotasks();

    startBoundary();
    await expect(ownerAPending).rejects.toThrow(ACCOUNT_GENERATION_CHANGED);
    await waitForAccountGenerationOperationsToSettle();
    finishBoundary();

    const ownerB = createOwnerQueryScope();
    await expect(
      runGroundedTurnForOwner(
        ownerB,
        trialAccess(OPERATION_B),
        execution(client, {
          publish: (result: string) => `B:${result}`,
          request: async () => 'fresh',
        }),
      ),
    ).resolves.toBe('B:fresh');

    ownerAProvider.resolve('late');
    await flushMicrotasks();
    expect(publishA).not.toHaveBeenCalled();
    expect(client.getQueryData(queryKeys.askGroundedTurns(ownerA, '2026-07'))).toBe(1);
    expect(client.getQueryData(queryKeys.askGroundedTurns(ownerB, '2026-07'))).toBe(2);
  });

  it('consumes a late owner-A provider rejection without changing cancellation precedence', async () => {
    const provider = deferred<string>();
    vi.mocked(reserveTrialGroundedTurn).mockResolvedValueOnce(1);
    const client = queryClient();
    const scope = createOwnerQueryScope();
    const publish = vi.fn((result: string) => result);
    const pending = runGroundedTurnForOwner(
      scope,
      trialAccess(),
      execution(client, { publish, request: async () => provider.promise }),
    );
    await flushMicrotasks();

    startBoundary();
    await expect(pending).rejects.toThrow(ACCOUNT_GENERATION_CHANGED);
    provider.reject(new Error('LATE_PROVIDER_FAILURE'));
    await flushMicrotasks();
    expect(publish).not.toHaveBeenCalled();
  });

  it('joins the same owner operation and executes one reservation and provider request', async () => {
    const provider = deferred<string>();
    vi.mocked(reserveTrialGroundedTurn).mockResolvedValueOnce(1);
    const client = queryClient();
    const scope = createOwnerQueryScope();
    const request = vi.fn(async () => provider.promise);
    const sharedExecution = execution(client, {
      publish: (result: string) => `published:${result}`,
      request,
    });

    const first = runGroundedTurnForOwner(scope, trialAccess(), sharedExecution);
    const joined = runGroundedTurnForOwner(scope, trialAccess(), sharedExecution);

    expect(joined).toBe(first);
    await flushMicrotasks();
    expect(reserveTrialGroundedTurn).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledOnce();

    provider.resolve('answer');
    await expect(first).resolves.toBe('published:answer');
    await expect(joined).resolves.toBe('published:answer');
  });

  it('rejects a distinct rapid turn before it can reserve a second quota slot', async () => {
    const provider = deferred<string>();
    vi.mocked(reserveTrialGroundedTurn).mockResolvedValueOnce(1);
    const client = queryClient();
    const scope = createOwnerQueryScope();
    const first = runGroundedTurnForOwner(
      scope,
      trialAccess(),
      execution(client, {
        publish: (result: string) => result,
        request: async () => provider.promise,
      }),
    );

    await expect(
      runGroundedTurnForOwner(
        scope,
        trialAccess(OPERATION_B),
        execution(client, {
          publish: (result: string) => result,
          request: async () => 'must-not-run',
        }),
      ),
    ).rejects.toThrow(ASK_GROUNDED_TURN_IN_PROGRESS);
    await flushMicrotasks();
    expect(reserveTrialGroundedTurn).toHaveBeenCalledOnce();

    provider.resolve('first');
    await expect(first).resolves.toBe('first');
  });

  it('rejects a same-ID request fingerprint conflict instead of joining it', async () => {
    const provider = deferred<string>();
    vi.mocked(reserveTrialGroundedTurn).mockResolvedValueOnce(1);
    const client = queryClient();
    const scope = createOwnerQueryScope();
    const first = runGroundedTurnForOwner(
      scope,
      trialAccess(),
      execution(client, {
        publish: (result: string) => result,
        request: async () => provider.promise,
      }),
    );

    await expect(
      runGroundedTurnForOwner(
        scope,
        trialAccess(),
        execution(client, {
          publish: (result: string) => result,
          request: async () => 'must-not-run',
          requestFingerprint: FINGERPRINT_B,
        }),
      ),
    ).rejects.toThrow(ASK_GROUNDED_TURN_OPERATION_CONFLICT);

    provider.resolve('first');
    await expect(first).resolves.toBe('first');
  });

  it('maps a synchronous publication throw to a typed non-rollback delivery failure', async () => {
    vi.mocked(reserveTrialGroundedTurn).mockResolvedValueOnce(1);
    const client = queryClient();
    const scope = createOwnerQueryScope();
    const publish = vi.fn(() => {
      throw new Error('CALLER_PRIVATE_DELIVERY_FAILURE');
    });

    await expect(
      runGroundedTurnForOwner(
        scope,
        trialAccess(),
        execution(client, { publish, request: async () => 'answer' }),
      ),
    ).rejects.toMatchObject({
      code: ASK_GROUNDED_DELIVERY_FAILED,
      message: ASK_GROUNDED_DELIVERY_FAILED,
      name: 'GroundedTurnDeliveryError',
    });
    expect(publish).toHaveBeenCalledOnce();
  });

  it('rejects an asynchronous publication callback even when the type contract is bypassed', async () => {
    vi.mocked(reserveTrialGroundedTurn).mockResolvedValueOnce(1);
    const client = queryClient();
    const scope = createOwnerQueryScope();
    const publish = (async () => 'late-publication') as unknown as (result: string) => string;

    await expect(
      runGroundedTurnForOwner(
        scope,
        trialAccess(),
        execution(client, { publish, request: async () => 'answer' }),
      ),
    ).rejects.toThrow(ASK_GROUNDED_DELIVERY_MUST_BE_SYNCHRONOUS);
  });
});
