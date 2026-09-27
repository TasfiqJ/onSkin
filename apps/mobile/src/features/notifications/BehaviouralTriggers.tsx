import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/lib/auth/AuthProvider';
import { runOwnerQueryOperation, type OwnerQueryScope } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';

import type { BehaviouralTriggerEnables } from './behaviouralSnapshot';
import { notifyBehavioural } from './deliver';
import { useNotifPrefs } from './useNotifications';

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
      if (lastGeneration === ownerScope.generation && startedAt - lastStartedAt < cooldownMs) {
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

export function EnabledBehaviouralTriggers({ enabled }: { enabled: BehaviouralTriggerEnables }) {
  const ownerScope = useOwnerQueryScope();
  const { user } = useAuth();
  const ownerId = user?.id;

  useEffect(() => {
    const currentEnabled: BehaviouralTriggerEnables = {
      promotional: enabled.promotional,
      ramp: enabled.ramp,
      replenishment: enabled.replenishment,
    };
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'background') return;
      void backgroundEvaluationCoordinator
        .evaluate(ownerScope, () =>
          runOwnerQueryOperation(ownerScope, async (lease) => {
            const { readBehaviouralTriggerSnapshot } = await import('./behaviouralSnapshot');
            lease.assertCurrent();
            const current = await readBehaviouralTriggerSnapshot(lease, currentEnabled);
            lease.assertCurrent();
            const owner = ownerId
              ? {
                  ownerId,
                  ownerGeneration: ownerScope.generation,
                  assertCurrent: () => lease.assertCurrent(),
                }
              : undefined;
            if (current.replenishment) {
              await notifyBehavioural('replenishment', undefined, owner);
            } else if (current.ramp) {
              await notifyBehavioural('rampup', undefined, owner);
            } else if (current.promotional) {
              await notifyBehavioural('winback', undefined, owner);
            }
            lease.assertCurrent();
          }),
        )
        .catch(() => undefined);
    });
    return () => sub.remove();
  }, [enabled.promotional, enabled.ramp, enabled.replenishment, ownerId, ownerScope]);

  return null;
}

export function BehaviouralTriggers() {
  const query = useNotifPrefs();
  const read = query.data;

  const prefs = query.isSuccess && read?.status === 'available' ? read.prefs : null;
  const enabled = {
    promotional: false, // Win-back and promotional experiments are post-launch.
    ramp: prefs?.streakNudges === true,
    replenishment: prefs?.replenishmentAlerts === true,
  };

  return anyBehaviouralTriggerEnabled(enabled) ? (
    <EnabledBehaviouralTriggers enabled={enabled} />
  ) : null;
}
