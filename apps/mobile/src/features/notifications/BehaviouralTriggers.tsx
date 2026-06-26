import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useProgress } from '@/features/routine/useProgress';
import { useRamp } from '@/features/routine/useRamp';
import { useShelf } from '@/features/shelf/useShelf';

import { notifyBehavioural, nowHHMM } from './deliver';

// Wires the behavioural/promotional notification engine (notifyBehavioural) to the
// real user state it is meant to nudge on (docs/07 §3.3). Without this the engine
// had ZERO callers, so the replenishment / ramp-step-up / win-back nudges the
// settings screen advertises could never fire. Evaluated when the app goes to the
// BACKGROUND, so the nudge lands while the user is away rather than while they are
// looking at the screen. The engine enforces per-kind opt-outs, the per-tier weekly
// caps (local-first sentStore, so the cap holds offline), and quiet hours, so it is
// safe to evaluate every applicable kind on each transition. Real on-device
// delivery + send-timing tuning is B-NOTIF-VERIFY; off-device this is a no-op.
//
// Note: the weekly capture nudge is a recurring schedule in deliver.rescheduleReminders;
// de-escalation is surfaced in-app by the recovery flow (docs/05 §7) rather than a push.
export function BehaviouralTriggers() {
  const shelf = useShelf();
  const ramp = useRamp();
  const progress = useProgress();

  const needsReplenish = (shelf.data?.items ?? []).some(
    (i) => i.badge.kind === 'expired' || i.badge.kind === 'countdown',
  );
  const offerStepUp = ramp.items.some((r) => r.offerStepUp);
  const lapsed = progress.data?.lapsed ?? false;

  // Mirror the latest derived state into a ref (in an effect, never during render)
  // so the long-lived AppState listener always reads current values without
  // re-subscribing on every change.
  const stateRef = useRef({ needsReplenish, offerStepUp, lapsed });
  useEffect(() => {
    stateRef.current = { needsReplenish, offerStepUp, lapsed };
  }, [needsReplenish, offerStepUp, lapsed]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'background') return;
      const now = nowHHMM();
      const { needsReplenish, offerStepUp, lapsed } = stateRef.current;
      if (needsReplenish) void notifyBehavioural('replenishment', now);
      if (offerStepUp) void notifyBehavioural('rampup', now);
      if (lapsed) void notifyBehavioural('winback', now);
    });
    return () => sub.remove();
  }, []);

  return null;
}
