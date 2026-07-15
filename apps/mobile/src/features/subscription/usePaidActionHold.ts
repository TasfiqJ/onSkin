import { useCallback, useEffect, useSyncExternalStore } from 'react';

import {
  createPaidActionHoldStore,
  paidActionOutcome,
  type PaidActionOutcome,
  type PaidActionOutcomeInput,
} from './paidActionOutcome';
import { PAYWALL_FEEDBACK, type PaywallFeedbackState } from './PaywallFeedback';

const paidActionHoldStore = createPaidActionHoldStore();

export function usePaidActionHold(ownerGeneration: number): {
  isHeld: boolean;
  feedback: PaywallFeedbackState | null;
  resolve: (result: PaidActionOutcomeInput) => PaidActionOutcome;
} {
  const subscribe = useCallback(
    (listener: () => void) => paidActionHoldStore.subscribe(listener),
    [],
  );
  const getSnapshot = useCallback(
    () => paidActionHoldStore.getSnapshot(ownerGeneration),
    [ownerGeneration],
  );
  const currentHold = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    paidActionHoldStore.activateOwnerGeneration(ownerGeneration);
  }, [ownerGeneration]);

  const resolve = useCallback(
    (result: PaidActionOutcomeInput) => {
      const outcome = paidActionOutcome(result);
      if (outcome.kind === 'pending' || outcome.kind === 'verification_pending') {
        paidActionHoldStore.hold(ownerGeneration, outcome.kind);
      }
      return outcome;
    },
    [ownerGeneration],
  );

  return {
    isHeld: currentHold !== null,
    feedback:
      currentHold?.kind === 'pending'
        ? PAYWALL_FEEDBACK.purchasePending
        : currentHold?.kind === 'verification_pending'
          ? PAYWALL_FEEDBACK.verificationPending
          : null,
    resolve,
  };
}
