import { awaitAccountGenerationLease } from '@/lib/auth/accountGeneration';
import { env, type AppEnvironment } from '@/lib/env';
import { runOwnerQueryOperation, type OwnerQueryScope } from '@/lib/query/queryKeys';

import type { SubscriptionState } from './entitlement';
import { advanceEntitlementStateAtBoundary } from './entitlementBoundaryScheduler';
import { resolveEntitlementCacheRead } from './entitlementEvidence';
import { readEntitlementCache } from './store';

type ReminderDelivery = Readonly<{
  scheduleTrialReminder: (input: {
    expiresAt: string;
    priceLabel: string | null;
  }) => Promise<boolean>;
  cancelTrialReminder: () => Promise<void>;
}>;

export type EntitlementReminderResult = 'scheduled' | 'cancelled' | 'failed';

export type EntitlementReminderUnreadableEvidenceStatus =
  | 'unavailable'
  | 'corrupt'
  | 'unsupported_version'
  | 'invalid'
  | 'stale';

export class EntitlementReminderUnreadableEvidenceError extends Error {
  readonly code = 'ENTITLEMENT_REMINDER_EVIDENCE_UNREADABLE';

  constructor(readonly evidenceStatus: EntitlementReminderUnreadableEvidenceStatus) {
    super(`Entitlement reminder evidence is ${evidenceStatus}.`);
    this.name = 'EntitlementReminderUnreadableEvidenceError';
  }
}

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
          const scheduled = await delivery.scheduleTrialReminder({
            expiresAt: current.expiresAt,
            priceLabel: current.priceLabel,
          });
          lease.assertCurrent();
          return scheduled ? 'scheduled' : 'cancelled';
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

/**
 * Recover reminder state from the authoritative local entitlement evidence.
 * Unreadable evidence rejects explicitly so it can never be mistaken for an
 * authoritative absence and cancel a valid trial reminder.
 */
export function reconcileLocalEntitlementTrialReminder(
  ownerScope: OwnerQueryScope,
  options: {
    expectedStoreUserId?: string;
    nowMs?: () => number;
    appEnvironment?: AppEnvironment;
    readCache?: typeof readEntitlementCache;
    loadDelivery?: () => Promise<ReminderDelivery>;
  } = {},
): Promise<EntitlementReminderResult> {
  return runOwnerQueryOperation(ownerScope, async (lease) => {
    const readOptions =
      options.expectedStoreUserId === undefined
        ? {}
        : { expectedStoreUserId: options.expectedStoreUserId };
    const read = await awaitAccountGenerationLease(lease, () =>
      (options.readCache ?? readEntitlementCache)(readOptions),
    );
    lease.assertCurrent();

    if (
      read.status === 'unavailable' ||
      read.status === 'corrupt' ||
      read.status === 'unsupported_version'
    ) {
      throw new EntitlementReminderUnreadableEvidenceError(read.status);
    }

    const nowMs = (options.nowMs ?? Date.now)();
    const publishedState = resolveEntitlementCacheRead(
      read,
      new Date(nowMs).toISOString(),
      options.appEnvironment ?? env.appEnvironment,
    );
    lease.assertCurrent();
    if (
      publishedState.evidenceStatus === 'invalid' ||
      publishedState.evidenceStatus === 'stale'
    ) {
      throw new EntitlementReminderUnreadableEvidenceError(publishedState.evidenceStatus);
    }

    const result = await reconcileEntitlementTrialReminder(ownerScope, publishedState, {
      nowMs: () => nowMs,
      ...(options.loadDelivery ? { loadDelivery: options.loadDelivery } : {}),
    });
    lease.assertCurrent();
    return result;
  });
}

/** Start the tracked reconciliation without delaying the purchase/provider result. */
export function deferEntitlementTrialReminder(
  ownerScope: OwnerQueryScope,
  publishedState: SubscriptionState,
): void {
  void reconcileEntitlementTrialReminder(ownerScope, publishedState).catch(() => undefined);
}
