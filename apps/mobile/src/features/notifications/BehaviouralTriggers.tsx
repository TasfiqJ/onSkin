import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { hasReplenishmentSignal } from '@/features/recommendations/replenishment';
import { useProgress } from '@/features/routine/useProgress';
import { useRamp } from '@/features/routine/useRamp';
import { useShelf, type ShelfData } from '@/features/shelf/useShelf';
import { runOwnerQueryOperation, type OwnerQueryScope } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';

import { notifyBehavioural } from './deliver';
import { useNotifPrefs } from './useNotifications';

type BehaviouralTriggerEnables = {
  promotional: boolean;
  ramp: boolean;
  replenishment: boolean;
};

type ReplenishmentTriggerValue = {
  isSuccess: boolean;
  refetch: () => Promise<{
    isSuccess: boolean;
    data?: Pick<ShelfData, 'items' | 'archive'>;
  }>;
};

type ReplenishmentSnapshot = ReplenishmentTriggerValue & { generation: number };

type ScopedTriggerValue = { generation: number; value: boolean };

type TriggerSnapshot = {
  ownerScope: OwnerQueryScope;
  replenishment?: ReplenishmentSnapshot;
  ramp?: ScopedTriggerValue;
  promotional?: ScopedTriggerValue;
};

type BehaviouralEvaluationCoordinator = Readonly<{
  evaluate: (
    ownerScope: OwnerQueryScope,
    operation: () => void | Promise<void>,
  ) => Promise<boolean>;
}>;

/** Single-flight background evaluation with an owner-scoped cooldown. */
export function createBehaviouralEvaluationCoordinator(
  cooldownMs = 60_000,
  clock: () => number = Date.now,
): BehaviouralEvaluationCoordinator {
  let inFlight: { generation: number; promise: Promise<boolean> } | null = null;
  let lastGeneration: number | null = null;
  let lastStartedAt = Number.NEGATIVE_INFINITY;

  return Object.freeze({
    evaluate(ownerScope, operation) {
      if (inFlight?.generation === ownerScope.generation) return inFlight.promise;

      const startedAt = clock();
      if (
        lastGeneration === ownerScope.generation &&
        startedAt - lastStartedAt < cooldownMs
      ) {
        return Promise.resolve(false);
      }
      lastGeneration = ownerScope.generation;
      lastStartedAt = startedAt;

      let pending!: Promise<boolean>;
      pending = Promise.resolve()
        .then(operation)
        .then(() => true)
        .finally(() => {
          if (inFlight?.promise === pending) inFlight = null;
        });
      inFlight = { generation: ownerScope.generation, promise: pending };
      return pending;
    },
  });
}

const backgroundEvaluationCoordinator = createBehaviouralEvaluationCoordinator();

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
  hhmm?: string,
): Promise<boolean> {
  try {
    return await runOwnerQueryOperation(ownerScope, async (lease) => {
      const freshShelf = await refetchShelf();
      lease.assertCurrent();
      if (!freshShelf.isSuccess || !hasReplenishmentSignal(freshShelf.data)) return false;
      lease.assertCurrent();
      await notifyBehavioural('replenishment', hhmm);
      lease.assertCurrent();
      return true;
    });
  } catch {
    return false;
  }
}

function ReplenishmentTrigger({
  onSnapshot,
}: {
  onSnapshot: (value: ReplenishmentTriggerValue | undefined) => void;
}) {
  const shelf = useShelf();
  useEffect(() => {
    onSnapshot({
      isSuccess: shelf.isSuccess,
      refetch: shelf.refetch,
    });
    return () => {
      onSnapshot(undefined);
    };
  }, [onSnapshot, shelf.isSuccess, shelf.refetch]);
  return null;
}

function RampTrigger({ onSnapshot }: { onSnapshot: (value: boolean | undefined) => void }) {
  const ramp = useRamp();
  const offerStepUp = ramp.isSuccess && ramp.items.some((item) => item.offerStepUp);
  useEffect(() => {
    onSnapshot(offerStepUp);
    return () => {
      onSnapshot(undefined);
    };
  }, [offerStepUp, onSnapshot]);
  return null;
}

function PromotionalTrigger({ onSnapshot }: { onSnapshot: (value: boolean | undefined) => void }) {
  const progress = useProgress();
  const lapsed = progress.isSuccess && progress.data?.lapsed === true;
  useEffect(() => {
    onSnapshot(lapsed);
    return () => {
      onSnapshot(undefined);
    };
  }, [lapsed, onSnapshot]);
  return null;
}

function EnabledBehaviouralTriggers({ enabled }: { enabled: BehaviouralTriggerEnables }) {
  const ownerScope = useOwnerQueryScope();
  const snapshot = useRef<TriggerSnapshot>({ ownerScope });
  useEffect(() => {
    snapshot.current.ownerScope = ownerScope;
  }, [ownerScope]);
  const setReplenishmentSnapshot = useCallback((value: ReplenishmentTriggerValue | undefined) => {
    snapshot.current.replenishment = value
      ? { ...value, generation: ownerScope.generation }
      : undefined;
  }, [ownerScope.generation]);
  const setRampSnapshot = useCallback((value: boolean | undefined) => {
    snapshot.current.ramp =
      value === undefined ? undefined : { generation: ownerScope.generation, value };
  }, [ownerScope.generation]);
  const setPromotionalSnapshot = useCallback((value: boolean | undefined) => {
    snapshot.current.promotional =
      value === undefined ? undefined : { generation: ownerScope.generation, value };
  }, [ownerScope.generation]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'background') return;
      const latest = snapshot.current;
      void backgroundEvaluationCoordinator
        .evaluate(latest.ownerScope, () =>
          runOwnerQueryOperation(latest.ownerScope, async (lease) => {
            const generation = latest.ownerScope.generation;
            if (
              enabled.replenishment &&
              latest.replenishment?.generation === generation &&
              latest.replenishment.isSuccess
            ) {
              await notifyReplenishmentFromFreshShelf(
                latest.ownerScope,
                latest.replenishment.refetch,
              );
            } else if (
              enabled.ramp &&
              latest.ramp?.generation === generation &&
              latest.ramp.value
            ) {
              await notifyBehavioural('rampup');
            } else if (
              enabled.promotional &&
              latest.promotional?.generation === generation &&
              latest.promotional.value
            ) {
              await notifyBehavioural('winback');
            }
            lease.assertCurrent();
          }),
        )
        .catch(() => undefined);
    });
    return () => sub.remove();
  }, [enabled.promotional, enabled.ramp, enabled.replenishment]);

  return (
    <>
      {enabled.replenishment ? (
        <ReplenishmentTrigger onSnapshot={setReplenishmentSnapshot} />
      ) : null}
      {enabled.ramp ? <RampTrigger onSnapshot={setRampSnapshot} /> : null}
      {enabled.promotional ? (
        <PromotionalTrigger onSnapshot={setPromotionalSnapshot} />
      ) : null}
    </>
  );
}

export function BehaviouralTriggers() {
  const query = useNotifPrefs();
  const read = query.data;

  const prefs = query.isSuccess && read?.status === 'available' ? read.prefs : null;
  const enabled = {
    promotional: prefs?.promotionalOptIn === true,
    ramp: prefs?.streakNudges === true,
    replenishment: prefs?.replenishmentAlerts === true,
  };

  return anyBehaviouralTriggerEnabled(enabled) ? (
    <EnabledBehaviouralTriggers enabled={enabled} />
  ) : null;
}
