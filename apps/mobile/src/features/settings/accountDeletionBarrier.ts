let accountActivityBlocked = false;

/** Synchronous process-local guard used by capture and mutation entry points. */
export function isAccountActivityBlockedForDeletion(): boolean {
  return accountActivityBlocked;
}

/**
 * Only the durable account-deletion state module may mirror SecureStore state
 * into this process-local guard.
 */
export function setAccountActivityBlockedForDeletion(blocked: boolean): void {
  accountActivityBlocked = blocked;
}
