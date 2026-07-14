// Startup is unresolved until SecureStore has been read. Default closed so no
// account-bound vendor capture or mutation can race a restored pending request.
let accountActivityBlocked = true;

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
