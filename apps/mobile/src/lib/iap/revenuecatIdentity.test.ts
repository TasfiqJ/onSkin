import { describe, expect, it, vi } from 'vitest';

import {
  createRevenueCatIdentityCoordinator,
  type RevenueCatIdentityAdapter,
} from './revenuecatIdentity';

function createHarness() {
  let nativeConfigured = false;
  let anonymous = true;
  const configure = vi.fn(async () => {
    nativeConfigured = true;
    anonymous = false;
  });
  const logIn = vi.fn(async () => {
    anonymous = false;
  });
  const logOut = vi.fn(async () => {
    anonymous = true;
  });
  const adapter: RevenueCatIdentityAdapter = {
    configure,
    isAnonymous: vi.fn(async () => anonymous),
    isConfigured: vi.fn(async () => nativeConfigured),
    logIn,
    logOut,
  };
  return { adapter, configure, logIn, logOut };
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
});
