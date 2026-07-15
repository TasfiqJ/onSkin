import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_PUBLICATION_DRAIN_WAIT_MS,
  ACCOUNT_PUBLICATION_OPERATION_FRESHNESS_MS,
  ACCOUNT_PUBLICATION_RENEW_INTERVAL_MS,
  ACCOUNT_PUBLICATION_STORE_OPERATION_CALLER_DETACH_MS,
  AccountPublicationController,
  type AccountPublicationControllerDependencies,
} from './accountPublicationController';
import type {
  AccountPublicationAction,
  AccountPublicationSessionBinding,
  AccountPublicationSuccess,
} from './accountPublicationFence';

vi.mock('expo-crypto', () => ({ getRandomBytesAsync: vi.fn() }));
vi.mock('@/lib/env', () => ({
  env: {
    supabasePublishableKey: 'sb_publishable_test',
    supabaseUrl: 'https://project.supabase.co',
  },
}));

const A: AccountPublicationSessionBinding = {
  subject: '11111111-1111-4111-8111-111111111111',
  sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  accessToken: 'token-a-1',
};
const A_REFRESHED: AccountPublicationSessionBinding = {
  ...A,
  accessToken: 'token-a-2',
};
const B: AccountPublicationSessionBinding = {
  subject: '22222222-2222-4222-8222-222222222222',
  sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  accessToken: 'token-b-1',
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function successFor(action: AccountPublicationAction): AccountPublicationSuccess {
  if (action === 'publication_reserve') return 'reserved';
  if (action === 'publication_release') return 'released';
  return 'active';
}

function harness(overrides: Partial<AccountPublicationControllerDependencies> = {}) {
  let blocked = false;
  let monotonicNow = 0;
  let wallNow = 0;
  let capabilitySequence = 0;
  const events: string[] = [];
  const scheduled: { callback: () => void; delayMs: number }[] = [];
  const exchange = vi.fn(
    async (
      action: AccountPublicationAction,
      capability: string,
      binding?: AccountPublicationSessionBinding,
    ) => {
      events.push(`exchange:${action}:${capability}:${binding?.accessToken ?? 'no-bearer'}`);
      return successFor(action);
    },
  );
  const resetProviderIdentity = vi.fn(async () => {
    events.push('reset');
  });
  const dependencies: AccountPublicationControllerDependencies = {
    createCapability: async () => {
      capabilitySequence += 1;
      return capabilitySequence.toString(16).padStart(64, '0');
    },
    exchange,
    isAccountActivityBlocked: () => blocked,
    monotonicNow: () => monotonicNow,
    now: () => wallNow,
    resetProviderIdentity,
    schedule: (callback, delayMs) => {
      scheduled.push({ callback, delayMs });
      return scheduled.length as unknown as ReturnType<typeof setTimeout>;
    },
    cancelScheduled: vi.fn(),
    ...overrides,
  };
  return {
    controller: new AccountPublicationController(dependencies),
    events,
    exchange,
    resetProviderIdentity,
    scheduled,
    setBlocked(value: boolean) {
      blocked = value;
    },
    setNow(value: number) {
      monotonicNow = value;
      wallNow = value;
    },
    setMonotonicNow(value: number) {
      monotonicNow = value;
    },
    setWallNow(value: number) {
      wallNow = value;
    },
  };
}

async function activate(
  controller: AccountPublicationController,
  binding: AccountPublicationSessionBinding = A,
) {
  await controller.reserve(binding);
  return controller.activate(binding);
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function fakeTimerHarness() {
  const cancelScheduled = vi.fn((handle: ReturnType<typeof setTimeout>) => clearTimeout(handle));
  const result = harness({
    cancelScheduled,
    schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  });
  return { ...result, cancelScheduled };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('AccountPublicationController', () => {
  it('reserves, activates, and renews the same session generation on the 20s cadence', async () => {
    const h = harness();
    const ticket = await activate(h.controller);

    expect(h.controller.snapshot()).toEqual({
      state: 'active',
      generation: 1,
      subject: A.subject,
      sessionId: A.sessionId,
    });
    expect(ticket).toMatchObject({ generation: 1, subject: A.subject, sessionId: A.sessionId });
    expect(JSON.stringify(ticket)).not.toContain('token-a');
    expect(JSON.stringify(ticket)).not.toContain('00000000000000000000000000000001');
    expect(h.scheduled.at(-1)?.delayMs).toBe(ACCOUNT_PUBLICATION_RENEW_INTERVAL_MS);

    const refreshed = await h.controller.renew(A_REFRESHED);
    expect(refreshed.generation).toBe(1);
    expect(h.exchange.mock.calls.at(-1)).toEqual([
      'publication_renew',
      '0'.repeat(63) + '1',
      A_REFRESHED,
    ]);
    expect(h.controller.isActiveFor(A_REFRESHED)).toBe(true);
  });

  it('pauses new admission without invalidating an in-flight native store ticket', async () => {
    const h = harness();
    await activate(h.controller);
    const nativeResult = deferred<string>();
    const inFlight = h.controller.runOperation('purchase', () => nativeResult.promise);
    await flush();

    h.controller.pauseAdmission();
    await expect(
      h.controller.runOperation('offering', async () => 'must-not-start'),
    ).rejects.toMatchObject({ code: 'ACCOUNT_PUBLICATION_ADMISSION_CLOSED' });
    await expect(h.controller.renew(A_REFRESHED)).rejects.toMatchObject({
      code: 'ACCOUNT_PUBLICATION_ADMISSION_CLOSED',
    });

    nativeResult.resolve('settled-safely');
    await expect(inFlight).resolves.toBe('settled-safely');
    expect(h.controller.resumeAdmission()).toBe(true);
    await expect(
      h.controller.runOperation('offering', async () => 'resumed'),
    ).resolves.toBe('resumed');
  });

  it('refreshes both conservative freshness clocks only after a successful renewal', async () => {
    const h = harness();
    await activate(h.controller);
    h.setNow(ACCOUNT_PUBLICATION_OPERATION_FRESHNESS_MS - 1);

    await h.controller.renew(A_REFRESHED);
    h.setNow(2 * ACCOUNT_PUBLICATION_OPERATION_FRESHNESS_MS - 1);
    expect(h.controller.isActiveFor(A_REFRESHED)).toBe(true);

    h.setNow(2 * ACCOUNT_PUBLICATION_OPERATION_FRESHNESS_MS + 1);
    expect(h.controller.isActiveFor(A_REFRESHED)).toBe(false);
    await h.controller.retryDrain();
  });

  it('invalidates reserve before a delayed capability can enter the transition queue', async () => {
    const capability = deferred<string>();
    const exchange = vi.fn(async (action: AccountPublicationAction) => successFor(action));
    const h = harness({ createCapability: () => capability.promise, exchange });

    const reserve = h.controller.reserve(A);
    await h.controller.beginDrain('app_backgrounded');
    capability.resolve('ab'.repeat(32));

    await expect(reserve).rejects.toMatchObject({
      code: 'ACCOUNT_PUBLICATION_ADMISSION_CLOSED',
    });
    expect(exchange).not.toHaveBeenCalled();
    expect(h.controller.snapshot().state).toBe('closed');
  });

  it('closes a reservation synchronously during background, then reacquires on foreground', async () => {
    const reserveResponse = deferred<AccountPublicationSuccess>();
    let delayFirstReserve = true;
    const exchange = vi.fn(
      async (action: AccountPublicationAction): Promise<AccountPublicationSuccess> => {
        if (action === 'publication_reserve' && delayFirstReserve) {
          delayFirstReserve = false;
          return reserveResponse.promise;
        }
        return successFor(action);
      },
    );
    const h = harness({ exchange });

    const firstReserve = h.controller.reserve(A);
    await flush();
    expect(h.controller.snapshot().state).toBe('reserved');
    const drain = h.controller.beginDrain('app_backgrounded');
    expect(h.controller.snapshot().state).toBe('draining');
    reserveResponse.resolve('reserved');
    await expect(firstReserve).rejects.toMatchObject({ code: 'ACCOUNT_PUBLICATION_RESULT_STALE' });
    await drain;

    await activate(h.controller, A_REFRESHED);
    expect(h.controller.snapshot()).toMatchObject({ state: 'active', generation: 2 });
    expect(exchange.mock.calls.map(([action]) => action)).toEqual([
      'publication_reserve',
      'publication_release',
      'publication_reserve',
      'publication_activate',
    ]);
  });

  it('rejects activation that completes after background and reacquires a fresh generation', async () => {
    const activationResponse = deferred<AccountPublicationSuccess>();
    let delayActivation = true;
    const exchange = vi.fn(
      async (action: AccountPublicationAction): Promise<AccountPublicationSuccess> => {
        if (action === 'publication_activate' && delayActivation) {
          delayActivation = false;
          return activationResponse.promise;
        }
        return successFor(action);
      },
    );
    const h = harness({ exchange });

    await h.controller.reserve(A);
    const activation = h.controller.activate(A);
    await flush();
    const drain = h.controller.beginDrain('app_backgrounded');
    expect(h.controller.snapshot().state).toBe('draining');
    activationResponse.resolve('active');
    await expect(activation).rejects.toMatchObject({ code: 'ACCOUNT_PUBLICATION_RESULT_STALE' });
    await drain;

    await activate(h.controller, A_REFRESHED);
    expect(h.controller.snapshot()).toMatchObject({ state: 'active', generation: 2 });
  });

  it.each([
    ['activation', 'publication_activate', 'reserved'],
    ['renewal', 'publication_renew', 'released'],
  ] as const)('fails closed on a stale %s response', async (_label, staleAction, staleStatus) => {
    const exchange = vi.fn(
      async (action: AccountPublicationAction): Promise<AccountPublicationSuccess> =>
        action === staleAction ? staleStatus : successFor(action),
    );
    const h = harness({ exchange });

    await h.controller.reserve(A);
    if (staleAction === 'publication_activate') {
      await expect(h.controller.activate(A)).rejects.toMatchObject({
        code: 'ACCOUNT_PUBLICATION_RESULT_STALE',
      });
    } else {
      await h.controller.activate(A);
      await expect(h.controller.renew(A_REFRESHED)).rejects.toMatchObject({
        code: 'ACCOUNT_PUBLICATION_RESULT_STALE',
      });
    }
    expect(h.controller.snapshot().state).not.toBe('active');
    await h.controller.beginDrain('session_rejected');
    expect(h.controller.snapshot().state).toBe('closed');
  });

  it('removes listeners synchronously and awaits callback writes before reset and release', async () => {
    const h = harness();
    const ticket = await activate(h.controller);
    const remove = vi.fn(() => h.events.push('listener-removed'));
    h.controller.registerProviderListener(ticket, remove);
    const write = deferred<void>();
    const callback = h.controller.runOperation('listener', async () => {
      h.events.push('callback-started');
      await write.promise;
      h.events.push('callback-finished');
    });
    await flush();

    const drain = h.controller.beginDrain('account_boundary');
    expect(remove).toHaveBeenCalledOnce();
    expect(h.resetProviderIdentity).not.toHaveBeenCalled();
    write.resolve();
    await expect(callback).rejects.toMatchObject({ code: 'ACCOUNT_PUBLICATION_RESULT_STALE' });
    await drain;

    expect(h.events.indexOf('listener-removed')).toBeLessThan(
      h.events.indexOf('callback-finished'),
    );
    expect(h.events.indexOf('callback-finished')).toBeLessThan(h.events.indexOf('reset'));
    expect(h.events.indexOf('reset')).toBeLessThan(
      h.events.findIndex((event) => event.startsWith('exchange:publication_release')),
    );
  });

  it.each(['purchase', 'restore'] as const)(
    'turns an in-flight %s completion after drain into unconfirmed and skips persistence',
    async (kind) => {
      const h = harness();
      await activate(h.controller);
      const storeCompletion = deferred<{ active: boolean }>();
      const persist = vi.fn();
      const operation = h.controller
        .runOperation(kind, () => storeCompletion.promise)
        .then(persist);
      await flush();

      const drain = h.controller.beginDrain('app_backgrounded');
      storeCompletion.resolve({ active: true });
      await expect(operation).rejects.toMatchObject({
        code: 'ACCOUNT_PUBLICATION_STOREKIT_COMPLETION_UNCONFIRMED',
      });
      expect(persist).not.toHaveBeenCalled();
      await drain;
    },
  );

  it.each(['purchase', 'restore'] as const)(
    'bounds a never-settling native %s, quarantines without release, and recovers only after late settlement',
    async (kind) => {
      const h = harness();
      await activate(h.controller);
      const nativeCompletion = deferred<{ active: boolean }>();
      const operation = h.controller.runOperation(kind, () => nativeCompletion.promise);
      const operationOutcome = operation.catch((error: unknown) => error);
      await flush();

      const drain = h.controller.beginDrain('app_backgrounded');
      const drainOutcome = drain.catch((error: unknown) => error);
      await flush();
      const deadline = h.scheduled.find(
        ({ delayMs }) => delayMs === ACCOUNT_PUBLICATION_DRAIN_WAIT_MS,
      );
      expect(deadline).toBeDefined();
      deadline?.callback();

      await expect(operationOutcome).resolves.toMatchObject({
        code: 'ACCOUNT_PUBLICATION_STOREKIT_COMPLETION_UNCONFIRMED',
      });
      await expect(drainOutcome).resolves.toMatchObject({
        code: 'ACCOUNT_PUBLICATION_OPERATION_QUARANTINED',
      });
      expect(h.controller.snapshot()).toMatchObject({
        state: 'quarantined',
        generation: 1,
        subject: A.subject,
        sessionId: A.sessionId,
      });
      expect(h.resetProviderIdentity).not.toHaveBeenCalled();
      expect(h.exchange.mock.calls.some(([action]) => action === 'publication_release')).toBe(
        false,
      );
      await expect(h.controller.retryDrain()).rejects.toMatchObject({
        code: 'ACCOUNT_PUBLICATION_OPERATION_QUARANTINED',
      });
      await expect(h.controller.reserve(B)).rejects.toMatchObject({
        code: 'ACCOUNT_PUBLICATION_ADMISSION_CLOSED',
      });

      nativeCompletion.resolve({ active: true });
      await flush();
      // Late SDK settlement does not release or reopen automatically. The root
      // recovery gate must explicitly retry the protected drain.
      expect(h.controller.snapshot().state).toBe('quarantined');
      expect(h.resetProviderIdentity).not.toHaveBeenCalled();
      await expect(h.controller.retryDrain()).resolves.toBeUndefined();
      expect(h.controller.snapshot().state).toBe('closed');
      expect(h.resetProviderIdentity).toHaveBeenCalledOnce();
      expect(
        h.exchange.mock.calls.filter(([action]) => action === 'publication_release'),
      ).toHaveLength(1);

      await activate(h.controller, B);
      expect(h.controller.snapshot()).toMatchObject({ state: 'active', generation: 2 });
    },
  );

  it('detaches a never-settling pre-native purchase and revokes its ticket before late checkout', async () => {
    vi.useFakeTimers();
    const h = fakeTimerHarness();
    await activate(h.controller);
    const preNative = deferred<void>();
    const openNativeSheet = vi.fn();
    let lateAuthorityError: unknown;
    const operation = h.controller.runOperation('purchase', async (ticket) => {
      await preNative.promise;
      try {
        ticket.assertCurrent();
      } catch (error) {
        lateAuthorityError = error;
        throw error;
      }
      openNativeSheet();
      return 'opened';
    });
    const outcome = operation.catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(ACCOUNT_PUBLICATION_STORE_OPERATION_CALLER_DETACH_MS);

    await expect(outcome).resolves.toMatchObject({
      code: 'ACCOUNT_PUBLICATION_STORE_OPERATION_CALLER_DETACHED',
    });
    expect(h.controller.snapshot().state).toBe('active');
    expect(h.resetProviderIdentity).not.toHaveBeenCalled();
    expect(h.exchange.mock.calls.some(([action]) => action === 'publication_release')).toBe(false);

    preNative.resolve();
    await flush();
    expect(lateAuthorityError).toMatchObject({ code: 'ACCOUNT_PUBLICATION_RESULT_STALE' });
    expect(openNativeSheet).not.toHaveBeenCalled();
  });

  it.each(['purchase', 'restore'] as const)(
    'keeps a caller-detached native-like %s locked until actual settlement but permits safe status work',
    async (kind) => {
      vi.useFakeTimers();
      const h = fakeTimerHarness();
      await activate(h.controller);
      const nativeCompletion = deferred<string>();
      const operation = h.controller.runOperation(kind, () => nativeCompletion.promise);
      const outcome = operation.catch((error: unknown) => error);

      await vi.advanceTimersByTimeAsync(ACCOUNT_PUBLICATION_STORE_OPERATION_CALLER_DETACH_MS);
      await expect(outcome).resolves.toMatchObject({
        code: 'ACCOUNT_PUBLICATION_STORE_OPERATION_CALLER_DETACHED',
      });

      for (const blockedKind of ['purchase', 'restore'] as const) {
        const blocked = vi.fn(async () => 'must-not-run');
        await expect(h.controller.runOperation(blockedKind, blocked)).rejects.toMatchObject({
          code: 'ACCOUNT_PUBLICATION_STORE_OPERATION_IN_PROGRESS',
        });
        expect(blocked).not.toHaveBeenCalled();
      }
      await expect(
        h.controller.runOperation('customer_info', async () => 'status-current'),
      ).resolves.toBe('status-current');

      nativeCompletion.resolve('late-success');
      await flush();
      expect(h.controller.snapshot().state).toBe('active');
      expect(h.resetProviderIdentity).not.toHaveBeenCalled();
      expect(h.exchange.mock.calls.some(([action]) => action === 'publication_release')).toBe(
        false,
      );
      await expect(
        h.controller.runOperation(kind, async () => 'next-store-operation'),
      ).resolves.toBe('next-store-operation');
    },
  );

  it('lets an actual success scheduled first at the detachment instant win and cancels its timer', async () => {
    vi.useFakeTimers();
    const h = fakeTimerHarness();
    await activate(h.controller);
    const nativeCompletion = deferred<string>();
    setTimeout(
      () => nativeCompletion.resolve('success-at-boundary'),
      ACCOUNT_PUBLICATION_STORE_OPERATION_CALLER_DETACH_MS,
    );
    const operation = h.controller.runOperation('purchase', () => nativeCompletion.promise);

    await vi.advanceTimersByTimeAsync(ACCOUNT_PUBLICATION_STORE_OPERATION_CALLER_DETACH_MS);

    await expect(operation).resolves.toBe('success-at-boundary');
    expect(h.cancelScheduled).toHaveBeenCalled();
    await expect(h.controller.runOperation('restore', async () => 'not-blocked')).resolves.toBe(
      'not-blocked',
    );
  });

  it('preserves the earlier bounded-drain result when drain wins the timer race', async () => {
    vi.useFakeTimers();
    const h = fakeTimerHarness();
    await activate(h.controller);
    const nativeCompletion = deferred<string>();
    const operation = h.controller.runOperation('purchase', () => nativeCompletion.promise);
    const operationOutcome = operation.catch((error: unknown) => error);
    const drain = h.controller.beginDrain('app_backgrounded');
    const drainOutcome = drain.catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(ACCOUNT_PUBLICATION_DRAIN_WAIT_MS);

    await expect(operationOutcome).resolves.toMatchObject({
      code: 'ACCOUNT_PUBLICATION_STOREKIT_COMPLETION_UNCONFIRMED',
    });
    await expect(drainOutcome).resolves.toMatchObject({
      code: 'ACCOUNT_PUBLICATION_OPERATION_QUARANTINED',
    });
    expect(h.controller.snapshot().state).toBe('quarantined');
    expect(h.resetProviderIdentity).not.toHaveBeenCalled();
    expect(h.exchange.mock.calls.some(([action]) => action === 'publication_release')).toBe(false);

    await vi.advanceTimersByTimeAsync(
      ACCOUNT_PUBLICATION_STORE_OPERATION_CALLER_DETACH_MS - ACCOUNT_PUBLICATION_DRAIN_WAIT_MS,
    );
    nativeCompletion.resolve('late-success');
    await flush();
    await expect(h.controller.retryDrain()).resolves.toBeUndefined();
    expect(h.controller.snapshot().state).toBe('closed');
    expect(h.resetProviderIdentity).toHaveBeenCalledOnce();
  });

  it.each(['reset', 'release'] as const)(
    'stays draining when protected %s fails and closes only after a successful retry',
    async (failurePoint) => {
      let fail = true;
      const exchange = vi.fn(
        async (action: AccountPublicationAction): Promise<AccountPublicationSuccess> => {
          if (action === 'publication_release' && failurePoint === 'release' && fail) {
            fail = false;
            throw new Error('release unavailable');
          }
          return successFor(action);
        },
      );
      const resetProviderIdentity = vi.fn(async () => {
        if (failurePoint === 'reset' && fail) {
          fail = false;
          throw new Error('reset unavailable');
        }
      });
      const h = harness({ exchange, resetProviderIdentity });
      await activate(h.controller);

      await expect(h.controller.beginDrain('account_boundary')).rejects.toThrow(
        `${failurePoint} unavailable`,
      );
      expect(h.controller.snapshot().state).toBe('draining');
      await flush();
      await expect(h.controller.retryDrain()).resolves.toBeUndefined();
      expect(h.controller.snapshot().state).toBe('closed');
      expect(resetProviderIdentity).toHaveBeenCalledTimes(2);
      expect(
        exchange.mock.calls.filter(([action]) => action === 'publication_release'),
      ).toHaveLength(failurePoint === 'release' ? 2 : 1);
    },
  );

  it('denies SDK work without a current fresh ticket and drains a stale lease', async () => {
    const h = harness();
    const sdk = vi.fn(async () => 'sdk-result');
    await expect(h.controller.runOperation('manage_subscription', sdk)).rejects.toMatchObject({
      code: 'ACCOUNT_PUBLICATION_ADMISSION_CLOSED',
    });
    expect(sdk).not.toHaveBeenCalled();

    await activate(h.controller);
    h.setNow(ACCOUNT_PUBLICATION_OPERATION_FRESHNESS_MS + 1);
    await expect(h.controller.runOperation('offering', sdk)).rejects.toMatchObject({
      code: 'ACCOUNT_PUBLICATION_ADMISSION_CLOSED',
    });
    expect(sdk).not.toHaveBeenCalled();
    expect(h.controller.snapshot().state).not.toBe('active');
    await h.controller.beginDrain('renewal_stale');
  });

  it('keeps render-safe snapshots pure even after authority becomes stale', async () => {
    const h = harness();
    const closed = vi.fn();
    h.controller.addAdmissionClosedListener(closed);
    await activate(h.controller);
    h.setNow(ACCOUNT_PUBLICATION_OPERATION_FRESHNESS_MS + 1);

    expect(h.controller.snapshot()).toMatchObject({
      state: 'active',
      subject: A.subject,
    });
    expect(closed).not.toHaveBeenCalled();

    await expect(
      h.controller.runOperation('offering', async () => undefined),
    ).rejects.toMatchObject({
      code: 'ACCOUNT_PUBLICATION_ADMISSION_CLOSED',
    });
    expect(closed).toHaveBeenCalledWith('renewal_stale');
  });

  it('fails closed when the wall clock moves backward even if monotonic time advances', async () => {
    const h = harness();
    await activate(h.controller);
    h.setMonotonicNow(1_000);
    h.setWallNow(-1);

    expect(h.controller.isActiveFor(A)).toBe(false);
    expect(h.controller.activeGenerationForSubject(A.subject)).toBeNull();
    expect(h.controller.snapshot().state).not.toBe('active');
    await h.controller.retryDrain();
    expect(h.controller.snapshot().state).toBe('closed');
  });

  it('treats a renewal timer resumed after prolonged inactivity as stale without renewing', async () => {
    const h = harness();
    const closed = vi.fn();
    h.controller.addAdmissionClosedListener(closed);
    await activate(h.controller);
    const delayedRenewal = h.scheduled.find(
      ({ delayMs }) => delayMs === ACCOUNT_PUBLICATION_RENEW_INTERVAL_MS,
    );
    expect(delayedRenewal).toBeDefined();

    h.setNow(ACCOUNT_PUBLICATION_OPERATION_FRESHNESS_MS + 1);
    delayedRenewal?.callback();
    await flush();

    expect(h.exchange.mock.calls.some(([action]) => action === 'publication_renew')).toBe(false);
    expect(closed).toHaveBeenCalledWith('renewal_stale');
    expect(h.controller.isActiveFor(A)).toBe(false);
    await h.controller.retryDrain();
    expect(h.controller.snapshot().state).toBe('closed');
  });

  it('closes on renewal denial and rejects all work once deletion activity is blocked', async () => {
    const closed = vi.fn();
    const exchange = vi.fn(
      async (action: AccountPublicationAction): Promise<AccountPublicationSuccess> => {
        if (action === 'publication_renew') throw new Error('renew denied');
        return successFor(action);
      },
    );
    const h = harness({ exchange });
    h.controller.addAdmissionClosedListener(closed);
    await activate(h.controller);

    await expect(h.controller.renew(A_REFRESHED)).rejects.toThrow('renew denied');
    expect(h.controller.snapshot().state).not.toBe('active');
    expect(closed).toHaveBeenCalledWith('renewal_failed');
    await h.controller.beginDrain('renewal_failed');

    h.setBlocked(true);
    const sdk = vi.fn();
    await expect(h.controller.reserve(B)).rejects.toMatchObject({
      code: 'ACCOUNT_PUBLICATION_ADMISSION_CLOSED',
    });
    await expect(h.controller.runOperation('offering', sdk)).rejects.toMatchObject({
      code: 'ACCOUNT_PUBLICATION_ADMISSION_CLOSED',
    });
    expect(sdk).not.toHaveBeenCalled();
  });

  it('exposes no capability or bearer in snapshots, tickets, or thrown gate errors', async () => {
    const h = harness();
    const ticket = await activate(h.controller);
    const serialized = JSON.stringify({ snapshot: h.controller.snapshot(), ticket });
    expect(serialized).not.toContain(A.accessToken);
    expect(serialized).not.toContain('0'.repeat(63) + '1');

    const error = await h.controller
      .runOperation('offering', async () => {
        throw new Error(`must not surface ${A.accessToken}`);
      })
      .catch((caught: unknown) => caught);
    // Provider errors are preserved only while the ticket is current; callers
    // must use safe logging. The controller's own gate errors contain no secret.
    expect(error).toBeInstanceOf(Error);
    await h.controller.beginDrain('account_boundary');
    const gateError = await h.controller
      .runOperation('offering', vi.fn())
      .catch((caught: unknown) => caught);
    expect(String(gateError)).not.toContain(A.accessToken);
    expect(String(gateError)).not.toContain('0'.repeat(63) + '1');
  });
});
