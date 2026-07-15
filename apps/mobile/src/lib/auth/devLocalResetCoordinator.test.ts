import { describe, expect, it, vi } from 'vitest';

import {
  createDevLocalResetCoordinator,
  latestSessionForDevLocalReset,
} from './devLocalResetCoordinator';

describe('dev local reset coordinator', () => {
  it('keeps publication and redirect locked after failure, then retries and reclaims the owner', async () => {
    const calls: string[] = [];
    const clearAccountState = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(async () => {
        calls.push('clear:failed');
        throw new Error('cleanup failed');
      })
      .mockImplementationOnce(async () => {
        calls.push('clear:complete');
      });
    const coordinator = createDevLocalResetCoordinator({
      clearAccountState,
      claimOwnership: vi.fn(async (userId: string) => {
        calls.push(`claim:${userId}`);
      }),
    });

    await coordinator.requestSingleFlight(async () => undefined);
    await expect(coordinator.runIfRequired('owner-a')).rejects.toThrow('cleanup failed');
    expect(coordinator.isPublicationBlocked()).toBe(true);
    expect(coordinator.consumeRedirectAfterSuccessfulPublication()).toBe(false);

    await expect(coordinator.runIfRequired('owner-a')).resolves.toBe(true);
    expect(calls).toEqual(['clear:failed', 'clear:complete', 'claim:owner-a']);
    expect(coordinator.isPublicationBlocked()).toBe(false);
    expect(coordinator.consumeRedirectAfterSuccessfulPublication()).toBe(true);
    expect(coordinator.consumeRedirectAfterSuccessfulPublication()).toBe(false);
  });

  it('completes a signed-out reset without manufacturing an owner claim', async () => {
    const claimOwnership = vi.fn<(userId: string) => Promise<void>>(async () => undefined);
    const coordinator = createDevLocalResetCoordinator({
      claimOwnership,
      clearAccountState: vi.fn(async () => undefined),
    });

    await coordinator.requestSingleFlight(async () => undefined);
    await expect(coordinator.runIfRequired(null)).resolves.toBe(true);

    expect(claimOwnership).not.toHaveBeenCalled();
    expect(coordinator.isPublicationBlocked()).toBe(false);
    expect(coordinator.consumeRedirectAfterSuccessfulPublication()).toBe(true);
  });

  it('joins duplicate reset requests into one clear and owner reclaim', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const clearAccountState = vi.fn(async () => undefined);
    const claimOwnership = vi.fn(async () => undefined);
    const coordinator = createDevLocalResetCoordinator({
      claimOwnership,
      clearAccountState,
    });
    const operation = async () => {
      await gate;
      await coordinator.runIfRequired('owner-a');
    };

    const first = coordinator.requestSingleFlight(operation);
    const duplicate = coordinator.requestSingleFlight(operation);

    expect(duplicate).toBe(first);
    release();
    await expect(Promise.all([first, duplicate])).resolves.toEqual([undefined, undefined]);
    expect(clearAccountState).toHaveBeenCalledOnce();
    expect(claimOwnership).toHaveBeenCalledOnce();
  });

  it('resolves a reset queued behind sign-out from the latest published null session', async () => {
    const ownerA = { user: { id: 'owner-a' } };
    let published: typeof ownerA | null = ownerA;
    const claimOwnership = vi.fn(async () => undefined);
    const coordinator = createDevLocalResetCoordinator({
      claimOwnership,
      clearAccountState: vi.fn(async () => undefined),
    });
    let selectedOwner: string | null | undefined;

    const reset = coordinator.requestSingleFlight(async () => {
      const selected = latestSessionForDevLocalReset(null, published);
      selectedOwner = selected?.user.id ?? null;
      await coordinator.runIfRequired(selectedOwner);
    });
    published = null;
    await reset;

    expect(selectedOwner).toBeNull();
    expect(claimOwnership).not.toHaveBeenCalled();
  });

  it('resolves a reset queued behind A-to-B from the latest pending B session', async () => {
    const ownerA = { user: { id: 'owner-a' } };
    const ownerB = { user: { id: 'owner-b' } };
    let pending: { session: typeof ownerA | null } | null = null;
    const claimOwnership = vi.fn(async () => undefined);
    const coordinator = createDevLocalResetCoordinator({
      claimOwnership,
      clearAccountState: vi.fn(async () => undefined),
    });
    let selectedOwner: string | null | undefined;

    const reset = coordinator.requestSingleFlight(async () => {
      const selected = latestSessionForDevLocalReset(pending, ownerA);
      selectedOwner = selected?.user.id ?? null;
      await coordinator.runIfRequired(selectedOwner);
    });
    pending = { session: ownerB };
    await reset;

    expect(selectedOwner).toBe('owner-b');
    expect(claimOwnership).toHaveBeenCalledExactlyOnceWith('owner-b');
  });
});
