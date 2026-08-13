import { describe, expect, it } from 'vitest';

import {
  createPaidActionHoldStore,
  paidActionHoldForOwner,
  paidActionOutcome,
} from './paidActionOutcome';

describe('paid action outcome', () => {
  it('opens success only for active access carrying a minted receipt', () => {
    expect(
      paidActionOutcome({
        active: true,
        successReceiptId: 'opaque-receipt',
      }),
    ).toEqual({ kind: 'success', receiptId: 'opaque-receipt' });
    expect(paidActionOutcome({ active: true })).toEqual({
      kind: 'active_without_receipt',
    });
    expect(
      paidActionOutcome({ active: false, successReceiptId: 'opaque-receipt' }),
    ).toEqual({ kind: 'inactive' });
  });

  it('fails closed when native completion is pending or cannot yet be verified', () => {
    expect(
      paidActionOutcome({
        active: true,
        successReceiptId: 'must-not-open',
        pending: true,
      }),
    ).toEqual({ kind: 'pending' });

    for (const uncertain of [
      { verificationPending: true },
      { purchaseMayHaveCompleted: true },
    ]) {
      expect(
        paidActionOutcome({
          active: true,
          successReceiptId: 'must-not-open',
          ...uncertain,
        }),
      ).toEqual({ kind: 'verification_pending' });
    }
  });

  it('keeps a hold for all evidence churn within the mounted owner generation', () => {
    const held = { kind: 'verification_pending', ownerGeneration: 7 } as const;

    // Evidence identity is intentionally absent from this terminal policy:
    // newer empty/revocation proof does not prove a pending charge ended.
    expect(paidActionHoldForOwner(held, 7)).toBe(held);
    expect(paidActionHoldForOwner(held, 8)).toBeNull();
  });

  it('retains uncertain completion across route lifetimes in the same process', () => {
    const store = createPaidActionHoldStore();
    store.activateOwnerGeneration(7);
    store.hold(7, 'verification_pending');

    // A newly mounted paywall reads the same module-level store snapshot.
    expect(store.getSnapshot(7)).toEqual({
      kind: 'verification_pending',
      ownerGeneration: 7,
    });
    expect(store.getSnapshot(7)).toEqual(store.getSnapshot(7));
  });

  it('clears only for a newer owner generation and ignores stale screens', () => {
    const store = createPaidActionHoldStore();
    const changes: string[] = [];
    const unsubscribe = store.subscribe(() => changes.push('changed'));

    store.activateOwnerGeneration(7);
    store.hold(7, 'pending');
    store.activateOwnerGeneration(8);

    expect(store.getSnapshot(7)).toBeNull();
    expect(store.getSnapshot(8)).toBeNull();

    store.hold(7, 'verification_pending');
    expect(store.getSnapshot(7)).toBeNull();
    expect(store.getSnapshot(8)).toBeNull();

    store.hold(8, 'verification_pending');
    expect(store.getSnapshot(8)).toEqual({
      kind: 'verification_pending',
      ownerGeneration: 8,
    });
    expect(changes).toHaveLength(3);

    unsubscribe();
  });
});
