import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AccountGenerationLeaseError,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  runAccountGenerationOperation,
  type AccountGenerationLease,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';

import {
  RevenueCatIdentityMismatchError,
  RevenueCatOperationBusyError,
  RevenueCatOperationFencedError,
  RevenueCatOwnerCoordinator,
  type RevenueCatIdentityAdapter,
} from './revenuecatOwnerCoordinator';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, reject, resolve };
}

function createAdapter(initial: {
  anonymous?: boolean;
  configured?: boolean;
  userId?: string;
} = {}) {
  let anonymous = initial.anonymous ?? true;
  let configured = initial.configured ?? false;
  let userId = initial.userId ?? '$RCAnonymousID:initial';
  const calls: string[] = [];
  const adapter: RevenueCatIdentityAdapter = {
    configure: vi.fn((nextUserId: string, markNativeConfigureDispatched: () => void) => {
      calls.push(`configure:${nextUserId}`);
      configured = true;
      anonymous = false;
      userId = nextUserId;
      markNativeConfigureDispatched();
    }),
    fenceIdentity: vi.fn(async () => ({ configured })),
    getAppUserID: vi.fn(async () => userId),
    isAnonymous: vi.fn(async () => anonymous),
    isConfigured: vi.fn(async () => configured),
    logIn: vi.fn(async (nextUserId: string) => {
      calls.push(`login:${nextUserId}`);
      anonymous = false;
      userId = nextUserId;
    }),
    logOut: vi.fn(async () => {
      calls.push('logout');
      anonymous = true;
      userId = '$RCAnonymousID:reset';
    }),
  };
  return {
    adapter,
    calls,
    setIdentity(nextUserId: string, nextAnonymous = false) {
      configured = true;
      anonymous = nextAnonymous;
      userId = nextUserId;
    },
  };
}

function context(appUserId: string, lease: AccountGenerationLease) {
  return { appUserId, lease } as const;
}

let boundaryDepth = 0;

function beginBoundary() {
  beginAccountGenerationBoundary();
  boundaryDepth += 1;
}

function endBoundary() {
  endAccountGenerationBoundary();
  boundaryDepth = Math.max(0, boundaryDepth - 1);
}

afterEach(() => {
  while (boundaryDepth > 0) endBoundary();
});

describe('RevenueCatOwnerCoordinator', () => {
  it('fences void configure with an ordered native call and exact app-user proof', async () => {
    const coordinator = new RevenueCatOwnerCoordinator();
    const harness = createAdapter();
    const nativeFence = deferred<Readonly<{ configured: boolean }>>();
    vi.mocked(harness.adapter.fenceIdentity).mockImplementationOnce(
      () => nativeFence.promise,
    );

    let lease!: AccountGenerationLease;
    const configuring = runAccountGenerationOperation((currentLease) => {
      lease = currentLease;
      return coordinator.configureFor(context('owner-a', currentLease), async () => harness.adapter);
    });
    await vi.waitFor(() =>
      expect(harness.adapter.configure).toHaveBeenCalledWith(
        'owner-a',
        expect.any(Function),
      ),
    );
    expect(() => coordinator.stampFor(context('owner-a', lease))).toThrow(
      RevenueCatOperationFencedError,
    );

    nativeFence.resolve({ configured: true });
    await configuring;
    expect(coordinator.stampFor(context('owner-a', lease)).appUserId).toBe('owner-a');
  });

  it('does not trust isConfigured false after a rejected fence for a delayed void configure', async () => {
    const coordinator = new RevenueCatOwnerCoordinator();
    const harness = createAdapter();
    const lateNativeConfigure = deferred<unknown>();
    vi.mocked(harness.adapter.configure).mockImplementationOnce(
      (nextUserId, markNativeConfigureDispatched) => {
        harness.calls.push(`configure:${nextUserId}`);
        // RevenueCat configure() is void: model native setup becoming visible
        // only when a later ordered async bridge call finally completes.
        markNativeConfigureDispatched();
      },
    );
    vi.mocked(harness.adapter.fenceIdentity)
      .mockRejectedValueOnce(new Error('SDK_NOT_CONFIGURED_YET'))
      .mockImplementationOnce(async () => {
        await lateNativeConfigure.promise;
        harness.setIdentity('owner-a');
        return { configured: true };
      });

    await expect(
      runAccountGenerationOperation((lease) =>
        coordinator.configureFor(context('owner-a', lease), async () => harness.adapter),
      ),
    ).rejects.toThrow('SDK_NOT_CONFIGURED_YET');

    let resetSettled = false;
    const reset = coordinator.reset(async () => harness.adapter).then(() => {
      resetSettled = true;
    });
    await Promise.resolve();
    expect(resetSettled).toBe(false);
    // The reset must not use another isConfigured() === false observation to
    // clear quarantine while the void dispatch is still uncertain.
    expect(harness.adapter.isConfigured).toHaveBeenCalledOnce();
    await expect(
      runAccountGenerationOperation((lease) =>
        coordinator.configureFor(context('owner-b', lease), async () => harness.adapter),
      ),
    ).rejects.toBeInstanceOf(RevenueCatOperationFencedError);

    lateNativeConfigure.resolve(undefined);
    await reset;
    expect(harness.adapter.logOut).toHaveBeenCalledOnce();
    await runAccountGenerationOperation((lease) =>
      coordinator.configureFor(context('owner-b', lease), async () => harness.adapter),
    );
    expect(harness.calls).toEqual(['configure:owner-a', 'logout', 'login:owner-b']);
  });

  it('does not create configure uncertainty when the write barrier rejects pre-dispatch', async () => {
    const coordinator = new RevenueCatOwnerCoordinator();
    const harness = createAdapter();
    const barrierError = new RevenueCatOperationFencedError();
    vi.mocked(harness.adapter.configure).mockRejectedValueOnce(barrierError);

    await expect(
      runAccountGenerationOperation((lease) =>
        coordinator.configureFor(context('owner-a', lease), async () => harness.adapter),
      ),
    ).rejects.toBe(barrierError);
    expect(harness.adapter.fenceIdentity).not.toHaveBeenCalled();

    await expect(coordinator.reset(async () => harness.adapter)).resolves.toBeUndefined();
    expect(harness.adapter.fenceIdentity).toHaveBeenCalledOnce();
    await runAccountGenerationOperation((lease) =>
      coordinator.configureFor(context('owner-b', lease), async () => harness.adapter),
    );
  });

  it('fences a prior JS runtime native configure before cold-start publication', async () => {
    const coordinator = new RevenueCatOwnerCoordinator();
    const harness = createAdapter();
    const priorRuntimeConfigure = deferred<void>();
    vi.mocked(harness.adapter.fenceIdentity).mockImplementationOnce(async () => {
      await priorRuntimeConfigure.promise;
      harness.setIdentity('owner-a');
      return { configured: true };
    });

    let publicationProofSettled = false;
    const publicationProof = coordinator
      .prepareForSessionPublication('owner-b', async () => harness.adapter)
      .then(() => {
        publicationProofSettled = true;
      });
    await Promise.resolve();
    expect(publicationProofSettled).toBe(false);

    priorRuntimeConfigure.resolve();
    await publicationProof;
    expect(harness.adapter.logOut).toHaveBeenCalledOnce();
    expect(harness.calls).toEqual(['logout']);
  });

  it('quarantines an interrupted void configure until its late fence and logout settle', async () => {
    const coordinator = new RevenueCatOwnerCoordinator();
    const harness = createAdapter();
    const nativeIdentity = deferred<string>();
    vi.mocked(harness.adapter.getAppUserID).mockImplementationOnce(
      () => nativeIdentity.promise,
    );

    const configuring = runAccountGenerationOperation((lease) =>
      coordinator.configureFor(context('owner-a', lease), async () => harness.adapter),
    );
    await vi.waitFor(() => expect(harness.adapter.configure).toHaveBeenCalledOnce());
    beginBoundary();
    await expect(configuring).rejects.toBeInstanceOf(AccountGenerationLeaseError);
    await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();

    let resetSettled = false;
    const reset = coordinator.reset(async () => harness.adapter).then(() => {
      resetSettled = true;
    });
    await Promise.resolve();
    expect(resetSettled).toBe(false);

    nativeIdentity.resolve('owner-a');
    await reset;
    expect(harness.adapter.logOut).toHaveBeenCalledOnce();
  });

  it('quarantines an interrupted login until its native promise is terminal', async () => {
    const coordinator = new RevenueCatOwnerCoordinator();
    const harness = createAdapter({ anonymous: true, configured: true });
    const nativeLogin = deferred<void>();
    vi.mocked(harness.adapter.logIn).mockImplementationOnce(async (appUserId) => {
      await nativeLogin.promise;
      harness.setIdentity(appUserId);
    });

    const configuring = runAccountGenerationOperation((lease) =>
      coordinator.configureFor(context('owner-a', lease), async () => harness.adapter),
    );
    await vi.waitFor(() => expect(harness.adapter.logIn).toHaveBeenCalledOnce());
    beginBoundary();
    await expect(configuring).rejects.toBeInstanceOf(AccountGenerationLeaseError);

    let resetSettled = false;
    const reset = coordinator.reset(async () => harness.adapter).then(() => {
      resetSettled = true;
    });
    await Promise.resolve();
    expect(resetSettled).toBe(false);
    nativeLogin.resolve();
    await reset;
    expect(harness.adapter.logOut).toHaveBeenCalledOnce();
  });

  it('logs out a mismatched authenticated native owner before logging in the expected owner', async () => {
    const coordinator = new RevenueCatOwnerCoordinator();
    const harness = createAdapter({
      anonymous: false,
      configured: true,
      userId: 'owner-b',
    });

    await runAccountGenerationOperation((lease) =>
      coordinator.configureFor(context('owner-a', lease), async () => harness.adapter),
    );

    expect(harness.calls).toEqual(['logout', 'login:owner-a']);
    expect(harness.adapter.logOut).toHaveBeenCalledOnce();
    expect(harness.adapter.logIn).toHaveBeenCalledExactlyOnceWith('owner-a');
    expect(vi.mocked(harness.adapter.logOut).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(harness.adapter.logIn).mock.invocationCallOrder[0]!,
    );
  });

  it('withholds cold-start owner publication until a mismatched native owner is logged out', async () => {
    const coordinator = new RevenueCatOwnerCoordinator();
    const harness = createAdapter({
      anonymous: false,
      configured: true,
      userId: 'owner-a',
    });
    const nativeLogout = deferred<void>();
    vi.mocked(harness.adapter.logOut).mockImplementationOnce(async () => {
      harness.calls.push('logout');
      await nativeLogout.promise;
      harness.setIdentity('$RCAnonymousID:cold-start-reset', true);
    });

    let publicationProofSettled = false;
    const publicationProof = coordinator
      .prepareForSessionPublication('owner-b', async () => harness.adapter)
      .then(() => {
        publicationProofSettled = true;
      });
    await vi.waitFor(() => expect(harness.adapter.logOut).toHaveBeenCalledOnce());
    expect(publicationProofSettled).toBe(false);
    await expect(
      runAccountGenerationOperation((lease) =>
        coordinator.configureFor(context('owner-b', lease), async () => harness.adapter),
      ),
    ).rejects.toBeInstanceOf(RevenueCatOperationFencedError);

    nativeLogout.resolve();
    await publicationProof;
    await runAccountGenerationOperation((lease) =>
      coordinator.configureFor(context('owner-b', lease), async () => harness.adapter),
    );
    expect(harness.calls).toEqual(['logout', 'login:owner-b']);
  });

  it('accepts an exact authenticated native owner for session publication without aliasing', async () => {
    const coordinator = new RevenueCatOwnerCoordinator();
    const harness = createAdapter({
      anonymous: false,
      configured: true,
      userId: 'owner-b',
    });

    await coordinator.prepareForSessionPublication('owner-b', async () => harness.adapter);
    expect(harness.adapter.logOut).not.toHaveBeenCalled();
    await runAccountGenerationOperation((lease) =>
      coordinator.configureFor(context('owner-b', lease), async () => harness.adapter),
    );
    expect(harness.adapter.logIn).not.toHaveBeenCalled();
  });

  it('detaches a never-settling pure read without quarantining reset', async () => {
    const coordinator = new RevenueCatOwnerCoordinator();
    const harness = createAdapter();
    await runAccountGenerationOperation((lease) =>
      coordinator.configureFor(context('owner-a', lease), async () => harness.adapter),
    );
    const readStarted = deferred<void>();
    const never = new Promise<never>(() => undefined);

    const read = runAccountGenerationOperation((lease) =>
      coordinator.runRead(context('owner-a', lease), async () => harness.adapter, async () => {
        readStarted.resolve();
        return never;
      }),
    );
    await readStarted.promise;
    beginBoundary();

    await expect(read).rejects.toBeInstanceOf(AccountGenerationLeaseError);
    await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
    await expect(coordinator.reset(async () => harness.adapter)).resolves.toBeUndefined();
    expect(harness.adapter.logOut).toHaveBeenCalledOnce();
  });

  it.each(['purchase', 'restore', 'manage'] as const)(
    'quarantines a never-settling %s until its exact terminal and reset proof',
    async (kind) => {
      const coordinator = new RevenueCatOwnerCoordinator();
      const harness = createAdapter();
      await runAccountGenerationOperation((lease) =>
        coordinator.configureFor(context('owner-a', lease), async () => harness.adapter),
      );
      const native = deferred<string>();
      const nativeStarted = deferred<void>();

      const ownerA = runAccountGenerationOperation((lease) =>
        coordinator.runHazard(
          context('owner-a', lease),
          kind,
          async () => harness.adapter,
          async () => {
            nativeStarted.resolve();
            return native.promise;
          },
        ),
      );
      await nativeStarted.promise;
      beginBoundary();

      await expect(ownerA).rejects.toBeInstanceOf(AccountGenerationLeaseError);
      await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();

      let resetSettled = false;
      const reset = coordinator.reset(async () => harness.adapter).then(() => {
        resetSettled = true;
      });
      await Promise.resolve();
      expect(resetSettled).toBe(false);

      endBoundary();
      await expect(
        runAccountGenerationOperation((lease) =>
          coordinator.configureFor(context('owner-b', lease), async () => harness.adapter),
        ),
      ).rejects.toBeInstanceOf(RevenueCatOperationFencedError);

      native.resolve('owner-a-result');
      await reset;
      await runAccountGenerationOperation((lease) =>
        coordinator.configureFor(context('owner-b', lease), async () => harness.adapter),
      );
      expect(harness.calls).toEqual([
        'configure:owner-a',
        'logout',
        'login:owner-b',
      ]);
    },
  );

  it('preserves owner invalidation over a late native rejection', async () => {
    const coordinator = new RevenueCatOwnerCoordinator();
    const harness = createAdapter();
    await runAccountGenerationOperation((lease) =>
      coordinator.configureFor(context('owner-a', lease), async () => harness.adapter),
    );
    const native = deferred<string>();
    const started = deferred<void>();
    const nativeFailure = new Error('late native failure');

    const purchase = runAccountGenerationOperation((lease) =>
      coordinator.runHazard(
        context('owner-a', lease),
        'purchase',
        async () => harness.adapter,
        async () => {
          started.resolve();
          return native.promise;
        },
      ),
    );
    await started.promise;
    beginBoundary();
    await expect(purchase).rejects.toBeInstanceOf(AccountGenerationLeaseError);

    const reset = coordinator.reset(async () => harness.adapter);
    native.reject(nativeFailure);
    await expect(reset).resolves.toBeUndefined();
    expect(harness.adapter.logOut).toHaveBeenCalledOnce();
  });

  it('rejects overlapping purchase, restore, and manage work synchronously', async () => {
    const coordinator = new RevenueCatOwnerCoordinator();
    const harness = createAdapter();
    let lease!: AccountGenerationLease;
    await runAccountGenerationOperation((currentLease) => {
      lease = currentLease;
      return coordinator.configureFor(context('owner-a', currentLease), async () => harness.adapter);
    });
    const native = deferred<string>();
    const first = coordinator.runHazard(
      context('owner-a', lease),
      'purchase',
      async () => harness.adapter,
      () => native.promise,
    );

    await expect(
      coordinator.runHazard(
        context('owner-a', lease),
        'restore',
        async () => harness.adapter,
        async () => 'restored',
      ),
    ).rejects.toBeInstanceOf(RevenueCatOperationBusyError);
    native.resolve('purchased');
    await expect(first).resolves.toBe('purchased');
  });

  it('quarantines an unexpected post-operation app-user mismatch until reset', async () => {
    const coordinator = new RevenueCatOwnerCoordinator();
    const harness = createAdapter();
    let lease!: AccountGenerationLease;
    await runAccountGenerationOperation((currentLease) => {
      lease = currentLease;
      return coordinator.configureFor(context('owner-a', currentLease), async () => harness.adapter);
    });

    await expect(
      coordinator.runHazard(
        context('owner-a', lease),
        'restore',
        async () => harness.adapter,
        async () => {
          harness.setIdentity('owner-b');
          return 'restored';
        },
      ),
    ).rejects.toBeInstanceOf(RevenueCatIdentityMismatchError);
    expect(() => coordinator.stampFor(context('owner-a', lease))).toThrow(
      RevenueCatOperationFencedError,
    );

    await expect(coordinator.reset(async () => harness.adapter)).resolves.toBeUndefined();
  });

  it('tears down the exact listener and makes its owner stamp inert before reset awaits', async () => {
    const coordinator = new RevenueCatOwnerCoordinator();
    const harness = createAdapter();
    let lease!: AccountGenerationLease;
    await runAccountGenerationOperation((currentLease) => {
      lease = currentLease;
      return coordinator.configureFor(context('owner-a', currentLease), async () => harness.adapter);
    });
    const stamp = coordinator.stampFor(context('owner-a', lease));
    const cleanup = vi.fn();
    const remove = coordinator.registerListener(stamp, cleanup);

    await coordinator.reset(async () => harness.adapter);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(coordinator.isStampCurrent(stamp)).toBe(false);
    remove();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('accepts logout response loss only when exact anonymous readback proves reset', async () => {
    const coordinator = new RevenueCatOwnerCoordinator();
    const harness = createAdapter();
    await runAccountGenerationOperation((lease) =>
      coordinator.configureFor(context('owner-a', lease), async () => harness.adapter),
    );
    vi.mocked(harness.adapter.logOut).mockImplementationOnce(async () => {
      harness.setIdentity('$RCAnonymousID:response-lost', true);
      throw new Error('logout response lost');
    });

    await expect(coordinator.reset(async () => harness.adapter)).resolves.toBeUndefined();
  });

  it('keeps reset and every newer owner fenced while native logout never settles', async () => {
    const coordinator = new RevenueCatOwnerCoordinator();
    const harness = createAdapter();
    await runAccountGenerationOperation((lease) =>
      coordinator.configureFor(context('owner-a', lease), async () => harness.adapter),
    );
    const nativeLogout = deferred<void>();
    vi.mocked(harness.adapter.logOut).mockImplementationOnce(async () => {
      await nativeLogout.promise;
      harness.setIdentity('$RCAnonymousID:late-logout', true);
    });

    const reset = coordinator.reset(async () => harness.adapter);
    await vi.waitFor(() => expect(harness.adapter.logOut).toHaveBeenCalledOnce());
    await expect(
      runAccountGenerationOperation((lease) =>
        coordinator.configureFor(context('owner-b', lease), async () => harness.adapter),
      ),
    ).rejects.toBeInstanceOf(RevenueCatOperationFencedError);

    nativeLogout.resolve();
    await reset;
    await runAccountGenerationOperation((lease) =>
      coordinator.configureFor(context('owner-b', lease), async () => harness.adapter),
    );
  });
});
