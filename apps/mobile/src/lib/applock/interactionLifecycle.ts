export type AppLockInteractionOwnerToken = object;
export type AppLockInteractionLease = Readonly<{ epoch: number }>;
export type AppLockPresentedAuthenticationToken = AppLockInteractionLease;
export type AppLockInteractionLifecycle = Readonly<{
  epoch: number;
  preservedLease: AppLockInteractionLease | null;
}>;

const leaseOwners = new WeakMap<AppLockInteractionLease, AppLockInteractionOwnerToken>();

export function createAppLockInteractionOwnerToken(): AppLockInteractionOwnerToken {
  return Object.freeze({});
}

export function createAppLockInteractionLifecycle(): AppLockInteractionLifecycle {
  return Object.freeze({ epoch: 0, preservedLease: null });
}

export function captureAppLockInteractionLease(
  lifecycle: AppLockInteractionLifecycle,
  owner: AppLockInteractionOwnerToken,
  appState: string,
): AppLockInteractionLease | null {
  if (appState !== 'active') return null;
  const lease = Object.freeze({ epoch: lifecycle.epoch });
  leaseOwners.set(lease, owner);
  return lease;
}

/**
 * Every non-active transition invalidates ordinary and queued work. Only the
 * exact native prompt already presented for this provider may remain through
 * its first OS-owned non-active transition. This covers iOS's inactive sheet
 * and Android API 29's device-credential Activity. A second non-active event
 * is always a hard interruption. The prompt still cannot publish until active.
 */
export function transitionAppLockInteractionLifecycle(
  lifecycle: AppLockInteractionLifecycle,
  owner: AppLockInteractionOwnerToken,
  appState: string,
  presentedAuthenticationToken: AppLockPresentedAuthenticationToken | null,
): AppLockInteractionLifecycle {
  if (appState === 'active') return lifecycle;

  const mayPreservePresentedPrompt =
    presentedAuthenticationToken !== null &&
    lifecycle.preservedLease === null &&
    leaseOwners.get(presentedAuthenticationToken) === owner &&
    presentedAuthenticationToken.epoch === lifecycle.epoch;

  return Object.freeze({
    epoch: lifecycle.epoch + 1,
    preservedLease: mayPreservePresentedPrompt ? presentedAuthenticationToken : null,
  });
}

export function isAppLockInteractionLeaseCurrent(
  lifecycle: AppLockInteractionLifecycle,
  owner: AppLockInteractionOwnerToken,
  lease: AppLockInteractionLease,
  appState: string,
): boolean {
  return (
    appState === 'active' &&
    leaseOwners.get(lease) === owner &&
    (lease.epoch === lifecycle.epoch || lifecycle.preservedLease === lease)
  );
}

export function releasePreservedAppLockInteractionLease(
  lifecycle: AppLockInteractionLifecycle,
  owner: AppLockInteractionOwnerToken,
  lease: AppLockInteractionLease,
): AppLockInteractionLifecycle {
  if (leaseOwners.get(lease) !== owner || lifecycle.preservedLease !== lease) return lifecycle;
  return Object.freeze({ epoch: lifecycle.epoch, preservedLease: null });
}
