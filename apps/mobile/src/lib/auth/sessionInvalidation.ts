export type SessionInvalidationDependencies = {
  persistInvalidationMarker?: () => void | Promise<unknown>;
  signOut: () => void | Promise<unknown>;
  clearPersistedSession: () => void | Promise<unknown>;
  waitForAccountOperations: () => void | Promise<unknown>;
  waitForPrivateWrites: () => void | Promise<unknown>;
  waitForPhotoWrites: () => void | Promise<unknown>;
  clearAccountIsolatedState?: () => void | Promise<unknown>;
  clearAuthDerivedActivity: () => void | Promise<unknown>;
};

export type DurableSessionInvalidationDependencies = SessionInvalidationDependencies & {
  markAuthDerivedCleanupRequired: () => void | Promise<unknown>;
  clearAuthDerivedCleanupRequired: () => void | Promise<unknown>;
};

/**
 * Best-effort every required invalidation stage, then fail closed if any stage
 * did not complete. In particular, failure to persist an optional
 * provider-specific evidence marker must never prevent local/remote session
 * removal or vendor/query cleanup. The generic crash-recovery marker is
 * committed separately by clearRejectedSessionActivityDurably before this
 * best-effort sequence begins.
 */
export async function clearRejectedSessionActivity(
  dependencies: SessionInvalidationDependencies,
): Promise<void> {
  const failures: string[] = [];
  const attempt = async (label: string, operation: () => void | Promise<unknown>) => {
    try {
      await operation();
    } catch {
      failures.push(label);
    }
  };

  if (dependencies.persistInvalidationMarker) {
    await attempt('invalidation_marker', dependencies.persistInvalidationMarker);
  }
  await attempt('sign_out', dependencies.signOut);
  await attempt('persisted_session', dependencies.clearPersistedSession);
  await attempt('account_operations', dependencies.waitForAccountOperations);
  await attempt('private_writes', dependencies.waitForPrivateWrites);
  await attempt('photo_writes', dependencies.waitForPhotoWrites);
  if (dependencies.clearAccountIsolatedState) {
    await attempt('account_isolated_state', dependencies.clearAccountIsolatedState);
  }
  await attempt('auth_derived_activity', dependencies.clearAuthDerivedActivity);

  if (failures.length > 0) {
    throw new Error(`REJECTED_SESSION_CLEAR_FAILED:${failures.join(',')}`);
  }
}

/**
 * Commit a crash-recovery marker before session removal, and consume it only
 * after every auth-derived cleanup stage succeeds. A marker-write failure must
 * keep the session intact so the next retry still has cleanup authority.
 */
export async function clearRejectedSessionActivityDurably(
  dependencies: DurableSessionInvalidationDependencies,
): Promise<void> {
  await dependencies.markAuthDerivedCleanupRequired();
  await clearRejectedSessionActivity(dependencies);
  await dependencies.clearAuthDerivedCleanupRequired();
}
