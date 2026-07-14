import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { hasReplenishmentSignal } from '@/features/recommendations/replenishment';
import { useProgress } from '@/features/routine/useProgress';
import { useRamp } from '@/features/routine/useRamp';
import { useShelf, type ShelfData } from '@/features/shelf/useShelf';
import { runOwnerQueryOperation, type OwnerQueryScope } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';

import { notifyBehavioural, nowHHMM } from './deliver';
import { useNotifPrefs } from './useNotifications';

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
type BehaviouralTriggerEnables = {
  promotional: boolean;
  ramp: boolean;
  replenishment: boolean;
};

export function anyBehaviouralTriggerEnabled(
  enabled: BehaviouralTriggerEnables | undefined,
): boolean {
  return Boolean(enabled?.promotional || enabled?.ramp || enabled?.replenishment);
}

export async function notifyReplenishmentFromFreshShelf(
  ownerScope: OwnerQueryScope,
  refetchShelf: () => Promise<{
    isSuccess: boolean;
    data?: Pick<ShelfData, 'items' | 'archive'>;
  }>,
  now: string,
): Promise<boolean> {
  try {
    return await runOwnerQueryOperation(ownerScope, async (lease) => {
      const freshShelf = await refetchShelf();
      lease.assertCurrent();
      if (!freshShelf.isSuccess || !hasReplenishmentSignal(freshShelf.data)) return false;
      lease.assertCurrent();
      await notifyBehavioural('replenishment', now);
      lease.assertCurrent();
      return true;
    });
  } catch {
    return false;
  }
}

function EnabledBehaviouralTriggers({ enabled }: { enabled: BehaviouralTriggerEnables }) {
  const ownerScope = useOwnerQueryScope();
  const shelf = useShelf();
  const ramp = useRamp();
  const progress = useProgress();

  // A retained ramp value is not authoritative after cadence storage becomes
  // unreadable. Never schedule a step-up nudge unless the current read succeeded.
  const offerStepUp = ramp.isSuccess && ramp.items.some((r) => r.offerStepUp);
  // A retained query value is not authoritative after private completion
  // storage becomes unreadable. Never schedule a win-back from stale history.
  const lapsed = progress.isSuccess && progress.data?.lapsed === true;

  // Mirror the latest derived state into a ref (in an effect, never during render)
  // so the long-lived AppState listener always reads current values without
  // re-subscribing on every change.
  const stateRef = useRef({
    enabled,
    ownerScope,
    shelfWasSuccess: shelf.isSuccess,
    refetchShelf: shelf.refetch,
    offerStepUp,
    lapsed,
  });
  useEffect(() => {
    stateRef.current = {
      enabled,
      ownerScope,
      shelfWasSuccess: shelf.isSuccess,
      refetchShelf: shelf.refetch,
      offerStepUp,
      lapsed,
    };
  }, [enabled, ownerScope, shelf.isSuccess, shelf.refetch, offerStepUp, lapsed]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'background') return;
      const now = nowHHMM();
      const latest = stateRef.current;
      // A render snapshot can become unreadable while the app backgrounds. A
      // purchase-adjacent replenishment nudge therefore requires a fresh strict
      // Shelf read at decision time; retained success/data can never authorize it.
      if (latest.enabled.replenishment && latest.shelfWasSuccess) {
        void notifyReplenishmentFromFreshShelf(latest.ownerScope, latest.refetchShelf, now);
      }
      if (latest.enabled.ramp && latest.offerStepUp) {
        void notifyBehavioural('rampup', now).catch(() => undefined);
      }
      if (latest.enabled.promotional && latest.lapsed) {
        void notifyBehavioural('winback', now).catch(() => undefined);
      }
    });
    return () => sub.remove();
  }, []);

  return null;
}

export function BehaviouralTriggers() {
  const prefs = useNotifPrefs().data;
  const enabled = {
    promotional: prefs?.promotionalOptIn === true,
    ramp: prefs?.streakNudges === true,
    replenishment: prefs?.replenishmentAlerts === true,
  };

  return anyBehaviouralTriggerEnabled(enabled) ? (
    <EnabledBehaviouralTriggers enabled={enabled} />
  ) : null;
}
