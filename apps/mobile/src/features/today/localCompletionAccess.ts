import {
  assertHealthDataWriteLease,
  HEALTH_DATA_WRITE_ADMISSION_CLOSED,
  runCurrentHealthDataOperation,
  type HealthDataWriteLease,
} from '@/lib/consent/healthDataWriteAdmission';

/** Memory-only query identity. Never serialize this tuple into a completion record. */
export function completionQueryScope(lease: HealthDataWriteLease | undefined) {
  return lease === undefined
    ? (['closed'] as const)
    : ([
        'health-owner',
        lease.ownerUserId,
        lease.accountGeneration,
        lease.generation,
        lease.epoch,
      ] as const);
}

/** A deferred query/retry must not acquire a successor account or consent lease. */
export async function runWithCompletionLease<T>(
  expected: HealthDataWriteLease | undefined,
  operation: () => T | Promise<T>,
): Promise<T> {
  if (expected === undefined) throw new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED);
  assertHealthDataWriteLease(expected);
  return runCurrentHealthDataOperation(async (lease) => {
    assertHealthDataWriteLease(expected);
    lease.assertCurrent();
    const result = await operation();
    lease.assertCurrent();
    assertHealthDataWriteLease(expected);
    return result;
  });
}

/**
 * Memory-only coordination for one encrypted completion record. It owns neither
 * completion bytes nor replay. Unsubscribing a screen NEVER finishes an action
 * or clears recovery. Only exact authority, not mount/date/phase, admits changes.
 */
export function createCompletionActionState(
  storageKey = '',
  isCurrent: () => boolean = () => true,
) {
  let snapshot: Readonly<{ pendingKey: string | null; failed: boolean }> = Object.freeze({
    pendingKey: null,
    failed: false,
  });
  const listeners = new Set<() => void>();
  function publish(pendingKey: string | null, failed: boolean): void {
    if (snapshot.pendingKey === pendingKey && snapshot.failed === failed) return;
    snapshot = Object.freeze({ pendingKey, failed });
    for (const listener of [...listeners]) {
      // A listener may detach another listener synchronously during publication.
      if (!listeners.has(listener)) continue;
      try { listener(); } catch {
        // Observation cannot relabel a committed write or prevent other screens
        // from seeing its pending/recovery state.
      }
    }
  }
  return {
    storageKey,
    get pendingKey() { return snapshot.pendingKey; },
    get failed() { return snapshot.failed; },
    get active() { return isCurrent(); },
    getSnapshot: () => snapshot,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    begin(key: string, recovery = false): boolean {
      if (!isCurrent() || snapshot.pendingKey !== null || (snapshot.failed && !recovery)) {
        return false;
      }
      publish(key, snapshot.failed);
      return true;
    },
    requireRecovery() {
      if (isCurrent()) publish(snapshot.pendingKey, true);
    },
    confirmRecovery() {
      if (isCurrent()) publish(snapshot.pendingKey, false);
    },
    finish() {
      if (isCurrent()) publish(null, snapshot.failed);
    },
  };
}

type CompletionActionState = ReturnType<typeof createCompletionActionState>;
const CLOSED_COMPLETION_ACTION_STATE = createCompletionActionState(
  JSON.stringify(completionQueryScope(undefined)), () => false,
);
// One current authority in this JS runtime. Retain it even with zero listeners:
// an unresolved write or failed settlement can outlive all Today components.
// On authority replacement the slot is released; only already-running callbacks
// can retain the old object, whose captured lease refuses every further change.
let currentCompletionActionState: CompletionActionState | undefined;

export function completionActionStateForLease(
  expected: HealthDataWriteLease | undefined,
): CompletionActionState {
  if (currentCompletionActionState && !currentCompletionActionState.active) {
    currentCompletionActionState = undefined;
  }
  if (expected === undefined) return CLOSED_COMPLETION_ACTION_STATE;
  try { assertHealthDataWriteLease(expected); } catch { return CLOSED_COMPLETION_ACTION_STATE; }
  const storageKey = JSON.stringify(completionQueryScope(expected));
  if (currentCompletionActionState?.storageKey === storageKey) return currentCompletionActionState;
  const captured = Object.freeze({ ...expected });
  currentCompletionActionState = createCompletionActionState(storageKey, () => {
    try { assertHealthDataWriteLease(captured); return true; } catch { return false; }
  });
  return currentCompletionActionState;
}

/**
 * Per-view presentation lifetime, separate from shared storage coordination.
 * Allocate per captured coordinator in useMemo, never reuse a component-wide
 * mutable bit across authority changes. The frozen handle exposes no writable
 * state; only its own closure changes. Cleanup cannot unlock storage or another
 * view, and setup may reactivate this same token for StrictMode effect replay.
 */
export function createCompletionViewLifecycle(storageKey: string) {
  let active = false;
  return Object.freeze({
    storageKey,
    activate(): void { active = true; },
    deactivate(): void { active = false; },
    isActive(): boolean { return active; },
  });
}
