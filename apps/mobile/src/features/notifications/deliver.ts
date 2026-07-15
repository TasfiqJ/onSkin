import { randomUUID } from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { NotificationKind, NotificationTier } from '@onskin/types';

import { PAYWALL_COPY } from '@/features/subscription/copy';
import { PLANS } from '@/features/subscription/plans';
import { loadEntitlement } from '@/features/subscription/store';
import {
  awaitAccountGenerationLease,
  runAccountGenerationOperation,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { captureAuthenticatedAccountOwner } from '@/lib/auth/authenticatedAccountOwner';
import { supabase } from '@/lib/supabase/client';

import { notificationContentForLockScreen } from './copy';
import {
  assertNativeNotificationMutationAvailable,
  cancelNativeScheduledNotificationExact,
  scheduleNativeNotificationExact,
} from './nativeMutation';
import { canSend, reminderTimeOutsideQuietHours, tierEnabled, tierOf, toMinutes } from './policy';
import { recordSentLocal, sentThisWeekForTierLocal } from './sentStore';
import {
  readNotifPrefs,
  saveNotifPrefs,
  type NotifPrefs,
  type NotifPrefsSaveResult,
} from './store';

export { configureNotifications } from './startup';

export const AM_REMINDER_ID = 'onskin-am-reminder';
export const PM_REMINDER_ID = 'onskin-pm-reminder';
export const CAPTURE_REMINDER_ID = 'onskin-capture-reminder';
export const TRIAL_REMINDER_ID = 'onskin-trial-reminder';
export const BEHAVIOURAL_REMINDER_ID_PREFIX = 'onskin-behavioural-';

const PREFERENCE_REMINDER_IDS = [AM_REMINDER_ID, PM_REMINDER_ID, CAPTURE_REMINDER_ID] as const;

let notificationOperationTail: Promise<void> = Promise.resolve();
let lastReminderScheduleSignature: string | null = null;

async function preferenceScheduleIdentifiersAreHealthy(
  prefs: NotifPrefs,
  lease: AccountGenerationLease,
): Promise<boolean> {
  const expected = new Set<string>();
  if (prefs.amEnabled) expected.add(AM_REMINDER_ID);
  if (prefs.pmEnabled) expected.add(PM_REMINDER_ID);
  if (prefs.captureReminders) expected.add(CAPTURE_REMINDER_ID);

  try {
    const scheduled = await awaitAccountGenerationLease(lease, () =>
      Notifications.getAllScheduledNotificationsAsync(),
    );
    lease.assertCurrent();
    const actual = scheduled
      .map((request) => request.identifier)
      .filter((identifier) =>
        PREFERENCE_REMINDER_IDS.includes(identifier as (typeof PREFERENCE_REMINDER_IDS)[number]),
      );
    return (
      actual.length === expected.size && actual.every((identifier) => expected.has(identifier))
    );
  } catch {
    lease.assertCurrent();
    return false;
  }
}

/** Acquire the owner lease before waiting so an account boundary can abort queued work. */
function runSerializedNotificationOperation<T>(
  operation: (lease: AccountGenerationLease) => Promise<T>,
): Promise<T> {
  return runAccountGenerationOperation(async (lease) => {
    const previous = notificationOperationTail.catch(() => undefined);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => gate);
    notificationOperationTail = tail;

    try {
      await awaitAccountGenerationLease(lease, () => previous);
      lease.assertCurrent();
      return await operation(lease);
    } catch (error) {
      // Preserve account-generation cancellation over a queued/native error
      // that settles after the boundary has already invalidated this owner.
      lease.assertCurrent();
      throw error;
    } finally {
      release();
      if (notificationOperationTail === tail) notificationOperationTail = Promise.resolve();
    }
  });
}

/** The current local wall-clock time as "HH:MM" (for quiet-hours / cap checks). */
export function nowHHMM(d = new Date()): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export async function getPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'undetermined';
  }
}

/** The OS prompt. Fired only after the in-app soft ask is accepted. */
export async function requestPermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

async function cancelPreferenceRemindersUnderLease(lease: AccountGenerationLease): Promise<void> {
  const failures: unknown[] = [];
  for (const identifier of PREFERENCE_REMINDER_IDS) {
    lease.assertCurrent();
    try {
      await awaitAccountGenerationLease(lease, () =>
        cancelNativeScheduledNotificationExact(identifier),
      );
    } catch (error) {
      failures.push(error);
    }
  }
  lease.assertCurrent();
  if (failures.length > 0) throw failures[0];
}

/**
 * Remove only the schedules owned by notification preferences. This is used when
 * the private preference record is absent or unreadable; unrelated and trial
 * schedules are deliberately preserved.
 */
export async function suspendPreferenceOwnedReminders(): Promise<void> {
  await runSerializedNotificationOperation(async (lease) => {
    lastReminderScheduleSignature = null;
    if (Platform.OS === 'web') return;
    await cancelPreferenceRemindersUnderLease(lease);
  });
}

/**
 * Reconcile the fixed-ID AM, PM, and capture schedules with an authoritative
 * preference snapshot. Native mutations are serialized so overlapping toggles
 * cannot recreate an older schedule after a newer one. A partial failure is
 * cleaned up and surfaced to the caller for a truthful retry state.
 */
async function reconcileRemindersUnderLease(
  prefs: NotifPrefs,
  lease: AccountGenerationLease,
): Promise<void> {
  if (Platform.OS === 'web') return;

  const signature = JSON.stringify([
    lease.generation,
    prefs.amEnabled,
    prefs.pmEnabled,
    prefs.amTime,
    prefs.pmTime,
    prefs.captureReminders,
    prefs.quietStart,
    prefs.quietEnd,
    prefs.timezone,
  ]);
  if (
    lastReminderScheduleSignature === signature &&
    (await preferenceScheduleIdentifiersAreHealthy(prefs, lease))
  ) {
    return;
  }

  lastReminderScheduleSignature = null;
  await cancelPreferenceRemindersUnderLease(lease);
  const channelId = Platform.OS === 'android' ? 'routine' : undefined;

  const scheduleDaily = async (
    identifier: typeof AM_REMINDER_ID | typeof PM_REMINDER_ID,
    kind: 'am_reminder' | 'pm_step',
    hm: string,
  ) => {
    const deliveryTime = reminderTimeOutsideQuietHours(hm, prefs.quietStart, prefs.quietEnd);
    const minutes = toMinutes(deliveryTime);
    if (minutes == null) return;
    lease.assertCurrent();
    await awaitAccountGenerationLease(lease, () =>
      scheduleNativeNotificationExact(lease.signal, {
        identifier,
        content: notificationContentForLockScreen(kind),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: Math.floor(minutes / 60),
          minute: minutes % 60,
          ...(channelId ? { channelId } : {}),
        },
      }),
    );
    lease.assertCurrent();
  };

  try {
    if (prefs.amEnabled) await scheduleDaily(AM_REMINDER_ID, 'am_reminder', prefs.amTime);
    if (prefs.pmEnabled) await scheduleDaily(PM_REMINDER_ID, 'pm_step', prefs.pmTime);

    if (prefs.captureReminders) {
      const minutes = toMinutes(
        reminderTimeOutsideQuietHours(prefs.amTime, prefs.quietStart, prefs.quietEnd),
      );
      if (minutes != null) {
        lease.assertCurrent();
        await awaitAccountGenerationLease(lease, () =>
          scheduleNativeNotificationExact(lease.signal, {
            identifier: CAPTURE_REMINDER_ID,
            content: notificationContentForLockScreen('capture'),
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
              weekday: 1,
              hour: Math.floor(minutes / 60),
              minute: minutes % 60,
              ...(channelId ? { channelId } : {}),
            },
          }),
        );
        lease.assertCurrent();
      }
    }
    lastReminderScheduleSignature = signature;
  } catch (error) {
    if (!lease.signal.aborted) await cancelPreferenceRemindersUnderLease(lease);
    lease.assertCurrent();
    throw error;
  }
}

export async function rescheduleReminders(prefs: NotifPrefs): Promise<void> {
  await runSerializedNotificationOperation((lease) => reconcileRemindersUnderLease(prefs, lease));
}

/** Persist and reconcile under the same queue used by behavioural delivery. */
export async function saveAndRescheduleNotifPrefs(
  patch: Partial<NotifPrefs>,
): Promise<NotifPrefsSaveResult> {
  return runSerializedNotificationOperation(async (lease) => {
    const result = await saveNotifPrefs(patch);
    lease.assertCurrent();
    await reconcileRemindersUnderLease(result.prefs, lease);
    lease.assertCurrent();
    return result;
  });
}

function fmtShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Schedule the fixed-ID one-shot pre-charge reminder for an active carded trial. */
export async function scheduleTrialReminder(): Promise<void> {
  await runSerializedNotificationOperation(async (lease) => {
    if (Platform.OS === 'web') return;
    await awaitAccountGenerationLease(lease, () =>
      cancelNativeScheduledNotificationExact(TRIAL_REMINDER_ID),
    );
    lease.assertCurrent();
    const entitlement = await loadEntitlement();
    lease.assertCurrent();
    if (
      !entitlement ||
      !entitlement.isActive ||
      entitlement.periodType !== 'trial' ||
      !entitlement.expiresAt
    ) {
      return;
    }
    const expiresAt = entitlement.expiresAt;
    const fireAt = new Date(expiresAt).getTime() - 2 * 86_400_000;
    if (fireAt <= Date.now()) return;
    await awaitAccountGenerationLease(lease, () =>
      scheduleNativeNotificationExact(lease.signal, {
        identifier: TRIAL_REMINDER_ID,
        content: {
          title: PAYWALL_COPY.trialReminder.title,
          body: PAYWALL_COPY.trialReminder.bodyFor(
            fmtShortDate(expiresAt),
            entitlement.priceLabel ?? PLANS.annual.priceLabel,
          ),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
          ...(Platform.OS === 'android' ? { channelId: 'routine' } : {}),
        },
      }),
    );
    lease.assertCurrent();
  });
}

/** Cancel the pre-charge reminder on conversion or trial cancellation. */
export async function cancelTrialReminder(): Promise<void> {
  await runSerializedNotificationOperation(async (lease) => {
    if (Platform.OS === 'web') return;
    await awaitAccountGenerationLease(lease, () =>
      cancelNativeScheduledNotificationExact(TRIAL_REMINDER_ID),
    );
    lease.assertCurrent();
  });
}

async function mirrorBehaviouralDelivery(
  kind: NotificationKind,
  tier: NotificationTier,
): Promise<void> {
  try {
    await runAccountGenerationOperation(async (lease) => {
      const owner = await captureAuthenticatedAccountOwner(lease);
      if (!owner) return;
      lease.assertCurrent();
      let result: { error: unknown };
      try {
        result = await awaitAccountGenerationLease(lease, () =>
          supabase
            .from('notification_log')
            .insert({ user_id: owner.userId, tier, kind })
            .abortSignal(lease.signal),
        );
      } catch (error) {
        lease.assertCurrent();
        throw error;
      }
      lease.assertCurrent();
      if (result.error) throw result.error;
    });
  } catch {
    // Optional owner-bound backend mirror; local cap truth is already durable.
  }
}

/**
 * Deliver a behavioural notification only when preferences and the local cap
 * ledger are authoritative. The read/decide/reserve/schedule pipeline is globally
 * serialized, preventing concurrent background evaluations from overshooting the
 * weekly cap. `hhmm` exists only for deterministic callers/tests; production calls
 * evaluate the wall clock immediately before the policy decision.
 */
export async function notifyBehavioural(kind: NotificationKind, hhmm?: string): Promise<boolean> {
  const delivered = await runSerializedNotificationOperation(async (lease) => {
    if (Platform.OS === 'web') return false;

    const prefRead = await readNotifPrefs();
    lease.assertCurrent();
    if (prefRead.status !== 'absent' && prefRead.status !== 'available') return false;
    const prefs = prefRead.prefs;
    if (!tierEnabled(kind, prefs)) return false;

    const sentAt = Date.now();
    const tier = tierOf(kind);
    const localCount = await sentThisWeekForTierLocal(tier, sentAt);
    lease.assertCurrent();
    if (localCount.status !== 'absent' && localCount.status !== 'available') return false;
    // The recurring weekly capture reminder consumes one conservative slot in
    // the behavioural tier; it cannot otherwise append to the immediate-send
    // ledger when the OS presents it while JavaScript is suspended.
    const sent = localCount.count + (tier === 'behavioural' && prefs.captureReminders ? 1 : 0);

    const decision = canSend({
      kind,
      sentThisWeekForTier: sent,
      now: hhmm ?? nowHHMM(),
      quietStart: prefs.quietStart,
      quietEnd: prefs.quietEnd,
    });
    if (!decision.allowed) return false;

    // Reserve the local cap slot before asking the OS to present anything. A
    // native failure may conservatively consume a slot, but can never produce an
    // unlogged immediate banner that is free to repeat.
    let notificationIdentifier: string;
    try {
      lease.assertCurrent();
      // Avoid consuming a cap slot when a known prior native mutation prevents
      // this attempt from reaching the OS at all. The serialized delivery queue
      // keeps ordinary notification callers from racing this synchronous check.
      assertNativeNotificationMutationAvailable();
      notificationIdentifier = `${BEHAVIOURAL_REMINDER_ID_PREFIX}${randomUUID()}`;
      await recordSentLocal(kind, sentAt);
      lease.assertCurrent();
    } catch {
      lease.assertCurrent();
      return false;
    }

    try {
      await awaitAccountGenerationLease(lease, () =>
        scheduleNativeNotificationExact(lease.signal, {
          identifier: notificationIdentifier,
          content: notificationContentForLockScreen(kind),
          trigger: Platform.OS === 'android' ? { channelId: 'routine' } : null,
        }),
      );
      lease.assertCurrent();
    } catch {
      lease.assertCurrent();
      return false;
    }

    return true;
  });
  if (delivered) void mirrorBehaviouralDelivery(kind, tierOf(kind));
  return delivered;
}
