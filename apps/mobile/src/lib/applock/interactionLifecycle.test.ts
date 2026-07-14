import { describe, expect, it } from 'vitest';

import {
  captureAppLockInteractionLease,
  createAppLockInteractionLifecycle,
  createAppLockInteractionOwnerToken,
  isAppLockInteractionLeaseCurrent,
  releasePreservedAppLockInteractionLease,
  transitionAppLockInteractionLifecycle,
} from './interactionLifecycle';

describe('App Lock interaction lifecycle', () => {
  it('captures interactions only while the app is active', () => {
    const owner = createAppLockInteractionOwnerToken();
    const lifecycle = createAppLockInteractionLifecycle();

    expect(captureAppLockInteractionLease(lifecycle, owner, 'active')).toEqual({ epoch: 0 });
    expect(captureAppLockInteractionLease(lifecycle, owner, 'inactive')).toBeNull();
    expect(captureAppLockInteractionLease(lifecycle, owner, 'background')).toBeNull();
  });

  it.each(['inactive', 'background', 'unknown', 'extension'])(
    'hard-invalidates every lease on a non-prompt %s transition',
    (appState) => {
      const owner = createAppLockInteractionOwnerToken();
      let lifecycle = createAppLockInteractionLifecycle();
      const lease = captureAppLockInteractionLease(lifecycle, owner, 'active')!;

      lifecycle = transitionAppLockInteractionLifecycle(lifecycle, owner, appState, null);

      expect(lifecycle).toEqual({ epoch: 1, preservedLease: null });
      expect(isAppLockInteractionLeaseCurrent(lifecycle, owner, lease, appState)).toBe(false);
      expect(isAppLockInteractionLeaseCurrent(lifecycle, owner, lease, 'active')).toBe(false);
    },
  );

  it('preserves only the exact presented prompt through inactive until active', () => {
    const owner = createAppLockInteractionOwnerToken();
    let lifecycle = createAppLockInteractionLifecycle();
    const presented = captureAppLockInteractionLease(lifecycle, owner, 'active')!;
    const queued = captureAppLockInteractionLease(lifecycle, owner, 'active')!;

    lifecycle = transitionAppLockInteractionLifecycle(lifecycle, owner, 'inactive', presented);

    expect(lifecycle.epoch).toBe(1);
    expect(lifecycle.preservedLease).toBe(presented);
    expect(isAppLockInteractionLeaseCurrent(lifecycle, owner, presented, 'inactive')).toBe(false);
    expect(isAppLockInteractionLeaseCurrent(lifecycle, owner, presented, 'active')).toBe(true);
    expect(isAppLockInteractionLeaseCurrent(lifecycle, owner, queued, 'active')).toBe(false);
  });

  it('preserves the exact presented prompt through one direct background hop', () => {
    const owner = createAppLockInteractionOwnerToken();
    let lifecycle = createAppLockInteractionLifecycle();
    const presented = captureAppLockInteractionLease(lifecycle, owner, 'active')!;
    const queued = captureAppLockInteractionLease(lifecycle, owner, 'active')!;

    lifecycle = transitionAppLockInteractionLifecycle(lifecycle, owner, 'background', presented);

    expect(lifecycle).toEqual({ epoch: 1, preservedLease: presented });
    expect(isAppLockInteractionLeaseCurrent(lifecycle, owner, presented, 'active')).toBe(true);
    expect(isAppLockInteractionLeaseCurrent(lifecycle, owner, queued, 'active')).toBe(false);
  });

  it('hard-invalidates the same prompt when inactive progresses to background', () => {
    const owner = createAppLockInteractionOwnerToken();
    let lifecycle = createAppLockInteractionLifecycle();
    const presented = captureAppLockInteractionLease(lifecycle, owner, 'active')!;

    lifecycle = transitionAppLockInteractionLifecycle(lifecycle, owner, 'inactive', presented);
    lifecycle = transitionAppLockInteractionLifecycle(lifecycle, owner, 'background', presented);

    expect(lifecycle.epoch).toBe(2);
    expect(lifecycle.preservedLease).toBeNull();
    expect(isAppLockInteractionLeaseCurrent(lifecycle, owner, presented, 'active')).toBe(false);
  });

  it('hard-invalidates a direct-background prompt on a second non-active event', () => {
    const owner = createAppLockInteractionOwnerToken();
    let lifecycle = createAppLockInteractionLifecycle();
    const presented = captureAppLockInteractionLease(lifecycle, owner, 'active')!;

    lifecycle = transitionAppLockInteractionLifecycle(lifecycle, owner, 'background', presented);
    lifecycle = transitionAppLockInteractionLifecycle(lifecycle, owner, 'background', presented);

    expect(lifecycle).toEqual({ epoch: 2, preservedLease: null });
    expect(isAppLockInteractionLeaseCurrent(lifecycle, owner, presented, 'active')).toBe(false);
  });

  it('rejects a different provider token and never revives a stale prompt', () => {
    const ownerA = createAppLockInteractionOwnerToken();
    const ownerB = createAppLockInteractionOwnerToken();
    let lifecycle = createAppLockInteractionLifecycle();
    const ownerAPrompt = captureAppLockInteractionLease(lifecycle, ownerA, 'active')!;

    lifecycle = transitionAppLockInteractionLifecycle(lifecycle, ownerB, 'inactive', ownerAPrompt);
    expect(lifecycle).toEqual({ epoch: 1, preservedLease: null });
    expect(isAppLockInteractionLeaseCurrent(lifecycle, ownerA, ownerAPrompt, 'active')).toBe(false);

    lifecycle = transitionAppLockInteractionLifecycle(
      lifecycle,
      ownerA,
      'background',
      ownerAPrompt,
    );
    expect(lifecycle).toEqual({ epoch: 2, preservedLease: null });
  });

  it('hard-invalidates a preserved prompt on a later non-prompt interruption', () => {
    const owner = createAppLockInteractionOwnerToken();
    let lifecycle = createAppLockInteractionLifecycle();
    const presented = captureAppLockInteractionLease(lifecycle, owner, 'active')!;

    lifecycle = transitionAppLockInteractionLifecycle(lifecycle, owner, 'inactive', presented);
    lifecycle = transitionAppLockInteractionLifecycle(lifecycle, owner, 'active', presented);
    lifecycle = transitionAppLockInteractionLifecycle(lifecycle, owner, 'inactive', null);

    expect(lifecycle).toEqual({ epoch: 2, preservedLease: null });
    expect(isAppLockInteractionLeaseCurrent(lifecycle, owner, presented, 'active')).toBe(false);
  });

  it('releases a completed preserved prompt without changing the hard epoch', () => {
    const owner = createAppLockInteractionOwnerToken();
    let lifecycle = createAppLockInteractionLifecycle();
    const presented = captureAppLockInteractionLease(lifecycle, owner, 'active')!;

    lifecycle = transitionAppLockInteractionLifecycle(lifecycle, owner, 'inactive', presented);
    lifecycle = releasePreservedAppLockInteractionLease(lifecycle, owner, presented);

    expect(lifecycle).toEqual({ epoch: 1, preservedLease: null });
    expect(isAppLockInteractionLeaseCurrent(lifecycle, owner, presented, 'active')).toBe(false);
  });
});
