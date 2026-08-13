import { describe, expect, it, vi } from 'vitest';

import {
  createRevenueCatIdentityCoordinator,
  type RevenueCatIdentityAdapter,
} from './revenuecatIdentity';

function createHarness() {
  let nativeConfigured = false;
  let anonymous = true;
  const configure = vi.fn<RevenueCatIdentityAdapter['configure']>(async () => {
    nativeConfigured = true;
    anonymous = false;
  });
  const logIn = vi.fn(async () => {
    anonymous = false;
  });
  const logOut = vi.fn(async () => {
    anonymous = true;
  });
  const fenceIdentity = vi.fn<RevenueCatIdentityAdapter['fenceIdentity']>(async () => undefined);
  const adapter: RevenueCatIdentityAdapter = {
    configure,
    fenceIdentity,
    isAnonymous: vi.fn(async () => anonymous),
    isConfigured: vi.fn(async () => nativeConfigured),
    logIn,
    logOut,
  };
  return { adapter, configure, fenceIdentity, logIn, logOut };
}

describe('RevenueCat identity coordinator', () => {
  it('configures once, logs out A, then logs in B without duplicate configuration', async () => {
    const coordinator = createRevenueCatIdentityCoordinator();
    const harness = createHarness();
    const load = async () => harness.adapter;

    await coordinator.configureFor('owner-a', load);
    await coordinator.reset(load);
    await coordinator.configureFor('owner-b', load);

    expect(harness.configure).toHaveBeenCalledExactlyOnceWith('owner-a');
    expect(harness.fenceIdentity).toHaveBeenCalledOnce();
    expect(harness.logOut).toHaveBeenCalledOnce();
    expect(harness.logIn).toHaveBeenCalledExactlyOnceWith('owner-b');
    expect(coordinator.currentUserId()).toBe('owner-b');
  });

  it('serializes concurrent transitions and leaves the last requested owner current', async () => {
    const coordinator = createRevenueCatIdentityCoordinator();
    const harness = createHarness();
    let releaseA!: () => void;
    const gateA = new Promise<void>((resolve) => {
      releaseA = resolve;
    });
    harness.configure.mockImplementationOnce(async () => {
      await gateA;
    });

    const ownerA = coordinator.configureFor('owner-a', async () => harness.adapter);
    const ownerB = coordinator.configureFor('owner-b', async () => harness.adapter);
    releaseA();
    await Promise.all([ownerA, ownerB]);

    expect(harness.configure).toHaveBeenCalledExactlyOnceWith('owner-a');
    expect(harness.logIn).toHaveBeenCalledExactlyOnceWith('owner-b');
    expect(coordinator.currentUserId()).toBe('owner-b');
  });

  it('forgets the current user even when native logout fails', async () => {
    const coordinator = createRevenueCatIdentityCoordinator();
    const harness = createHarness();
    await coordinator.configureFor('owner-a', async () => harness.adapter);
    harness.logOut.mockRejectedValueOnce(new Error('logout failed'));

    await expect(coordinator.reset(async () => harness.adapter)).rejects.toThrow('logout failed');

    expect(coordinator.currentUserId()).toBeNull();
    await coordinator.configureFor('owner-b', async () => harness.adapter);
    expect(harness.logIn).toHaveBeenLastCalledWith('owner-b');
  });

  it('does not start a queued native identity write after deletion is armed', async () => {
    const coordinator = createRevenueCatIdentityCoordinator();
    const harness = createHarness();
    let writesAllowed = true;
    let releaseConfiguredRead!: () => void;
    const configuredRead = new Promise<void>((resolve) => {
      releaseConfiguredRead = resolve;
    });
    harness.adapter.isConfigured = vi.fn(async () => {
      await configuredRead;
      return false;
    });

    const configuration = coordinator.configureFor(
      'owner-a',
      async () => harness.adapter,
      () => writesAllowed,
    );
    await vi.waitFor(() => expect(harness.adapter.isConfigured).toHaveBeenCalledOnce());
    writesAllowed = false;
    releaseConfiguredRead();
    await configuration;

    expect(harness.configure).not.toHaveBeenCalled();
    expect(harness.logIn).not.toHaveBeenCalled();
    expect(coordinator.currentUserId()).toBeNull();
  });

  it('fences a void-returning native configure before logging out', async () => {
    const coordinator = createRevenueCatIdentityCoordinator();
    const harness = createHarness();
    let releaseNativeRead!: () => void;
    harness.configure.mockImplementationOnce(() => undefined);
    harness.adapter.isAnonymous = vi.fn(async () => false);
    harness.fenceIdentity.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseNativeRead = resolve;
        }),
    );

    await coordinator.configureFor('owner-a', async () => harness.adapter);
    const reset = coordinator.reset(async () => harness.adapter);
    await vi.waitFor(() => expect(harness.fenceIdentity).toHaveBeenCalledOnce());
    expect(harness.logOut).not.toHaveBeenCalled();

    releaseNativeRead();
    await reset;

    expect(harness.logOut).toHaveBeenCalledOnce();
    expect(
      harness.fenceIdentity.mock.invocationCallOrder[0],
    ).toBeLessThan(harness.logOut.mock.invocationCallOrder[0]!);
  });
});
