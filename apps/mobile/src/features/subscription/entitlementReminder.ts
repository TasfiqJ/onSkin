import { runOwnerQueryOperation, type OwnerQueryScope } from '@/lib/query/queryKeys';

import type { SubscriptionState } from './entitlement';
import { advanceEntitlementStateAtBoundary } from './entitlementBoundaryScheduler';

type ReminderDelivery = Readonly<{
  scheduleTrialReminder: (input: {
    expiresAt: string;
    priceLabel: string | null;
  }) => Promise<void>;
  cancelTrialReminder: () => Promise<void>;
}>;

export type EntitlementReminderResult = 'scheduled' | 'cancelled' | 'failed';

const reminderTails = new Map<number, Promise<void>>();

function runSerializedReminder<T>(
  ownerScope: OwnerQueryScope,
  operation: () => Promise<T>,
): Promise<T> {
  const generation = ownerScope.generation;
  const prior = reminderTails.get(generation) ?? Promise.resolve();
  const current = prior.catch(() => undefined).then(operation);
  const tail = current.then(
    () => undefined,
    () => undefined,
  );
  reminderTails.set(generation, tail);
  void tail.finally(() => {
    if (reminderTails.get(generation) === tail) reminderTails.delete(generation);
  });
  return current;
}

/** Owner-fenced and fail-soft: notification failures never turn accepted access into a failed buy. */
export function reconcileEntitlementTrialReminder(
  ownerScope: OwnerQueryScope,
  publishedState: SubscriptionState,
  options: {
    nowMs?: () => number;
    loadDelivery?: () => Promise<ReminderDelivery>;
  } = {},
): Promise<EntitlementReminderResult> {
  return runSerializedReminder(ownerScope, () =>
    runOwnerQueryOperation(ownerScope, async (lease) => {
      try {
        const delivery = await (
          options.loadDelivery ?? (() => import('@/features/notifications/deliver'))
        )();
        lease.assertCurrent();
        const current = advanceEntitlementStateAtBoundary(
          publishedState,
          (options.nowMs ?? Date.now)(),
        );
        if (current.isPro && current.inTrial && current.expiresAt) {
          await delivery.scheduleTrialReminder({
            expiresAt: current.expiresAt,
            priceLabel: current.priceLabel,
          });
          lease.assertCurrent();
          return 'scheduled';
        }
        await delivery.cancelTrialReminder();
        lease.assertCurrent();
        return 'cancelled';
      } catch {
        lease.assertCurrent();
        return 'failed';
      }
    }),
  );
}

/** Start the tracked reconciliation without delaying the purchase/provider result. */
export function deferEntitlementTrialReminder(
  ownerScope: OwnerQueryScope,
  publishedState: SubscriptionState,
): void {
  void reconcileEntitlementTrialReminder(ownerScope, publishedState).catch(() => undefined);
}
