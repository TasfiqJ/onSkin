export type PaidActionOutcomeInput = Readonly<{
  active: boolean;
  successReceiptId?: string;
  pending?: boolean;
  verificationPending?: boolean;
  purchaseMayHaveCompleted?: boolean;
}>;

export type PaidActionOutcome =
  | { kind: 'pending' }
  | { kind: 'verification_pending' }
  | { kind: 'success'; receiptId: string }
  | { kind: 'active_without_receipt' }
  | { kind: 'inactive' };

export type PaidActionHoldState = Readonly<{
  kind: 'pending' | 'verification_pending';
  ownerGeneration: number;
}>;

export type PaidActionHoldStore = Readonly<{
  activateOwnerGeneration: (ownerGeneration: number) => void;
  hold: (ownerGeneration: number, kind: PaidActionHoldState['kind']) => void;
  getSnapshot: (ownerGeneration: number) => PaidActionHoldState | null;
  subscribe: (listener: () => void) => () => void;
}>;

export function paidActionHoldForOwner(
  held: PaidActionHoldState | null,
  ownerGeneration: number,
): PaidActionHoldState | null {
  return held?.ownerGeneration === ownerGeneration ? held : null;
}

/**
 * Creates a process-local hold store. Generations are monotonic, so stale
 * screens cannot revive or replace a newer owner's hold.
 */
export function createPaidActionHoldStore(): PaidActionHoldStore {
  let latestOwnerGeneration: number | null = null;
  let held: PaidActionHoldState | null = null;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) listener();
  };

  const activateOwnerGeneration = (ownerGeneration: number) => {
    if (latestOwnerGeneration !== null && ownerGeneration <= latestOwnerGeneration) {
      return;
    }

    latestOwnerGeneration = ownerGeneration;
    if (held) {
      held = null;
      notify();
    }
  };

  return {
    activateOwnerGeneration,
    hold(ownerGeneration, kind) {
      if (latestOwnerGeneration !== null && ownerGeneration < latestOwnerGeneration) {
        return;
      }
      if (ownerGeneration > (latestOwnerGeneration ?? -1)) {
        latestOwnerGeneration = ownerGeneration;
        held = null;
      }
      if (held?.ownerGeneration === ownerGeneration && held.kind === kind) return;

      held = { kind, ownerGeneration };
      notify();
    },
    getSnapshot(ownerGeneration) {
      return ownerGeneration === latestOwnerGeneration
        ? paidActionHoldForOwner(held, ownerGeneration)
        : null;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * Native completion uncertainty always wins over apparent access. The success
 * surface is reachable only through the opaque receipt minted by the core.
 */
export function paidActionOutcome(result: PaidActionOutcomeInput): PaidActionOutcome {
  if (result.pending) return { kind: 'pending' };
  if (result.verificationPending || result.purchaseMayHaveCompleted) {
    return { kind: 'verification_pending' };
  }
  if (result.active && result.successReceiptId) {
    return { kind: 'success', receiptId: result.successReceiptId };
  }
  if (result.active) return { kind: 'active_without_receipt' };
  return { kind: 'inactive' };
}
