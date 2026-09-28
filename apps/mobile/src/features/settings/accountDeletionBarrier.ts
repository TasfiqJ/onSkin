// Startup is unresolved until SecureStore has been read. Default closed so no
// account-bound vendor capture or mutation can race a restored pending request.
let durableAccountActivityBlocked = true;
let deletionIntakeHoldCount = 0;
const blockedListeners = new Set<() => void>();
const intakeHoldListeners = new Set<(active: boolean) => void>();

function activityBlocked(): boolean {
  return durableAccountActivityBlocked || deletionIntakeHoldCount > 0;
}

function notifyBlocked(): void {
  for (const listener of blockedListeners) {
    try {
      listener();
    } catch {
      // Deletion admission is already closed. One observer cannot reopen it or
      // prevent every other account-bound subsystem from closing synchronously.
    }
  }
}

function notifyIntakeHold(active: boolean): void {
  for (const listener of intakeHoldListeners) {
    try {
      listener(active);
    } catch {
      // Provider admission still observes the effective synchronous block.
      // One lifecycle observer cannot release another owner's hold.
    }
  }
}

/** Synchronous process-local guard used by capture and mutation entry points. */
export function isAccountActivityBlockedForDeletion(): boolean {
  return activityBlocked();
}

/** Durable authority only; temporary intake holds must never impersonate it. */
export function isAccountActivityDurablyBlockedForDeletion(): boolean {
  return durableAccountActivityBlocked;
}

/**
 * Only the durable account-deletion state module may mirror SecureStore state
 * into this process-local guard.
 */
export function setAccountActivityBlockedForDeletion(blocked: boolean): void {
  const wasBlocked = activityBlocked();
  durableAccountActivityBlocked = blocked;
  if (!wasBlocked && activityBlocked()) notifyBlocked();
}

/**
 * Synchronously blocks account/vendor publication during the gap between a
 * verified deletion intent and its durable SecureStore handoff. Holds are
 * ref-counted so a failed or duplicate caller cannot reopen another intake.
 */
export function beginAccountDeletionIntakeHold(): () => void {
  const wasBlocked = activityBlocked();
  deletionIntakeHoldCount += 1;
  if (deletionIntakeHoldCount === 1) notifyIntakeHold(true);
  if (!wasBlocked) notifyBlocked();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    deletionIntakeHoldCount = Math.max(0, deletionIntakeHoldCount - 1);
    if (deletionIntakeHoldCount === 0) notifyIntakeHold(false);
  };
}

export function isAccountDeletionIntakeHoldActive(): boolean {
  return deletionIntakeHoldCount > 0;
}

/** Process-local notification only; durable authority remains SecureStore. */
export function subscribeToAccountDeletionActivityBlock(listener: () => void): () => void {
  blockedListeners.add(listener);
  return () => blockedListeners.delete(listener);
}

/** Process-local lifecycle signal; it carries no durable deletion authority. */
export function subscribeToAccountDeletionIntakeHold(
  listener: (active: boolean) => void,
): () => void {
  intakeHoldListeners.add(listener);
  return () => intakeHoldListeners.delete(listener);
}
