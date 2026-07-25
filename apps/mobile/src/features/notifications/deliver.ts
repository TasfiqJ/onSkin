import { randomUUID } from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { NotificationKind } from '@onskin/types';

import { PAYWALL_COPY } from '@/features/subscription/copy';
import {
  AccountGenerationLeaseError,
  awaitAccountGenerationLease,
  runAccountGenerationOperation,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { scheduleOutboxFlush } from '@/lib/offline/outbox';

import { notificationContentForLockScreen } from './copy';
import {
  assertNativeNotificationMutationAvailable,
  cancelNativeScheduledNotificationExact,
  scheduleNativeNotificationExact,
} from './nativeMutation';
import { canSend, reminderTimeOutsideQuietHours, tierEnabled, tierOf, toMinutes } from './policy';
import {
  confirmSentLocalDelivery,
  reserveSentLocal,
  sentThisWeekForTierLocal,
  type NotificationDeliveryOwner,
} from './sentStore';
import {
  getNotificationPermissionSnapshot,
  NotificationPermissionRequestUnavailableError,
  NotificationPermissionUnavailableError,
  requestNotificationPermissionSnapshot,
  type NotificationPermissionSnapshot,
  type NotificationPermissionStatus,
} from './permission';
import {
  readNotifPrefs,
  saveNotifPrefs,
  type NotifPrefs,
  type NotifPrefsOwner,
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

export async function getPermissionStatus(): Promise<NotificationPermissionStatus> {
  return (await getNotificationPermissionSnapshot()).status;
}

export async function readNotificationScheduleHealth(): Promise<
  'healthy' | 'mismatch' | 'not_applicable' | 'unavailable'
> {
  if (Platform.OS === 'web') return 'not_applicable';
  try {
    return await runAccountGenerationOperation(async (lease) => {
      const read = await awaitAccountGenerationLease(lease, readNotifPrefs);
      lease.assertCurrent();
      if (read.status !== 'available' && read.status !== 'absent') return 'unavailable';
      return (await preferenceScheduleIdentifiersAreHealthy(read.prefs, lease))
        ? 'healthy'
        : 'mismatch';
    });
  } catch {
    return 'unavailable';
  }
}

/** The OS prompt. Fired only after the in-app soft ask is accepted. */
export async function requestPermission(): Promise<boolean> {
  const snapshot = await requestNotificationPermissionSnapshot();
  if (snapshot.status === 'granted') return true;
  if (snapshot.status === 'denied') return false;
  if (snapshot.status === 'unavailable') {
    throw new NotificationPermissionRequestUnavailableError(snapshot.reason);
  }
  throw new NotificationPermissionRequestUnavailableError('unresolved');
}

async function readPermissionUnderLease(
  lease: AccountGenerationLease,
): Promise<NotificationPermissionSnapshot> {
  const snapshot = await awaitAccountGenerationLease(lease, getNotificationPermissionSnapshot);
  lease.assertCurrent();
  return snapshot;
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

async function cancelTrialReminderUnderLease(lease: AccountGenerationLease): Promise<void> {
  lease.assertCurrent();
  await awaitAccountGenerationLease(lease, () =>
    cancelNativeScheduledNotificationExact(TRIAL_REMINDER_ID),
  );
  lease.assertCurrent();
}

async function cancelAllOwnedRemindersUnderLease(lease: AccountGenerationLease): Promise<void> {
  const failures: unknown[] = [];
  try {
    await cancelPreferenceRemindersUnderLease(lease);
  } catch (error) {
    failures.push(error);
  }
  try {
    await cancelTrialReminderUnderLease(lease);
  } catch (error) {
    failures.push(error);
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
  knownPermission?: NotificationPermissionSnapshot,
): Promise<NotificationScheduleReconcileOutcome> {
  if (Platform.OS === 'web') return 'not_applicable';

  const permission = knownPermission ?? (await readPermissionUnderLease(lease));
  if (permission.status !== 'granted') {
    lastReminderScheduleSignature = null;
    await cancelPreferenceRemindersUnderLease(lease);
    if (permission.status === 'unavailable') {
      throw new NotificationPermissionUnavailableError(permission.reason);
    }
    return permission.status === 'denied' ? 'suspended_denied' : 'suspended_undetermined';
  }

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
    return 'scheduled';
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
    return 'scheduled';
  } catch (error) {
    if (!lease.signal.aborted) await cancelPreferenceRemindersUnderLease(lease);
    lease.assertCurrent();
    throw error;
  }
}

export type NotificationScheduleReconcileOutcome =
  | 'scheduled'
  | 'suspended_denied'
  | 'suspended_undetermined'
  | 'not_applicable';

export async function rescheduleReminders(
  prefs: NotifPrefs,
): Promise<NotificationScheduleReconcileOutcome> {
  return runSerializedNotificationOperation((lease) =>
    reconcileRemindersUnderLease(prefs, lease),
  );
}

/**
 * Deferred-root convergence for fixed preferences plus the global trial ID.
 * The mounted owner generation is supplied explicitly so a stale React effect
 * can never acquire the next account's lease and mutate its schedules.
 */
export async function reconcileRootNotificationSchedules(
  prefs: NotifPrefs | null,
  expectedGeneration: number,
): Promise<NotificationScheduleReconcileOutcome> {
  return runSerializedNotificationOperation(async (lease) => {
    if (lease.generation !== expectedGeneration) throw new AccountGenerationLeaseError();
    if (Platform.OS === 'web') return 'not_applicable';

    if (prefs === null) {
      lastReminderScheduleSignature = null;
      await cancelPreferenceRemindersUnderLease(lease);
    }

    const permission = await readPermissionUnderLease(lease);
    if (permission.status !== 'granted') {
      lastReminderScheduleSignature = null;
      if (prefs === null) {
        await cancelTrialReminderUnderLease(lease);
      } else {
        await cancelAllOwnedRemindersUnderLease(lease);
      }
      if (permission.status === 'unavailable') {
        throw new NotificationPermissionUnavailableError(permission.reason);
      }
      return permission.status === 'denied' ? 'suspended_denied' : 'suspended_undetermined';
    }

    if (prefs === null) return 'scheduled';
    return reconcileRemindersUnderLease(prefs, lease, permission);
  });
}

/** Persist and reconcile under the same queue used by behavioural delivery. */
export async function saveAndRescheduleNotifPrefs(
  patch: Partial<NotifPrefs>,
  owner?: NotifPrefsOwner,
): Promise<NotifPrefsSaveResult> {
  return runSerializedNotificationOperation(async (lease) => {
    owner?.assertCurrent?.();
    if (owner && owner.ownerGeneration !== lease.generation) {
      throw new AccountGenerationLeaseError();
    }
    const result = await saveNotifPrefs(
      patch,
      owner
        ? {
            ...owner,
            assertCurrent: () => {
              lease.assertCurrent();
              owner.assertCurrent?.();
            },
          }
        : undefined,
    );
    lease.assertCurrent();
    if (result.changed && owner) scheduleOutboxFlush();
    await reconcileRemindersUnderLease(result.prefs, lease);
    lease.assertCurrent();
    return result;
  });
}

function fmtShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Schedule the fixed-ID one-shot pre-charge reminder for an active carded trial. */
export type TrialReminderInput = Readonly<{
  expiresAt: string;
  priceLabel: string | null;
}>;

export async function scheduleTrialReminder(input: TrialReminderInput): Promise<boolean> {
  return runSerializedNotificationOperation(async (lease) => {
    if (Platform.OS === 'web') return false;
    await cancelTrialReminderUnderLease(lease);
    const expiresAt = input.expiresAt;
    const fireAt = new Date(expiresAt).getTime() - 2 * 86_400_000;
    if (fireAt <= Date.now()) return false;
    const permission = await readPermissionUnderLease(lease);
    if (permission.status === 'unavailable') {
      throw new NotificationPermissionUnavailableError(permission.reason);
    }
    if (permission.status !== 'granted') return false;
    await awaitAccountGenerationLease(lease, () =>
      scheduleNativeNotificationExact(lease.signal, {
        identifier: TRIAL_REMINDER_ID,
        content: {
          title: PAYWALL_COPY.trialReminder.title,
          body: PAYWALL_COPY.trialReminder.bodyFor(fmtShortDate(expiresAt), input.priceLabel),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
          ...(Platform.OS === 'android' ? { channelId: 'routine' } : {}),
        },
      }),
    );
    lease.assertCurrent();
    return true;
  });
}

/** Cancel the pre-charge reminder on conversion or trial cancellation. */
export async function cancelTrialReminder(): Promise<void> {
  await runSerializedNotificationOperation(async (lease) => {
    if (Platform.OS === 'web') return;
    await cancelTrialReminderUnderLease(lease);
  });
}

/**
 * Deliver a behavioural notification only when preferences and the local cap
 * ledger are authoritative. The read/decide/reserve/schedule pipeline is globally
 * serialized, preventing concurrent background evaluations from overshooting the
 * weekly cap. `hhmm` exists only for deterministic callers/tests; production calls
 * evaluate the wall clock immediately before the policy decision.
 */
export async function notifyBehavioural(
  kind: NotificationKind,
  hhmm?: string,
  owner?: NotificationDeliveryOwner,
): Promise<boolean> {
  return runSerializedNotificationOperation(async (lease) => {
    owner?.assertCurrent?.();
    if (owner && owner.ownerGeneration !== lease.generation) {
      throw new AccountGenerationLeaseError();
    }
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

    const permission = await readPermissionUnderLease(lease);
    if (permission.status !== 'granted') return false;

    // Reserve the local cap slot before asking the OS to present anything. A
    // native failure may conservatively consume a slot, but can never produce an
    // unlogged immediate banner that is free to repeat.
    let notificationIdentifier: string;
    let eventId: string;
    let operationId: string;
    try {
      lease.assertCurrent();
      // Avoid consuming a cap slot when a known prior native mutation prevents
      // this attempt from reaching the OS at all. The serialized delivery queue
      // keeps ordinary notification callers from racing this synchronous check.
      assertNativeNotificationMutationAvailable();
      eventId = randomUUID();
      operationId = randomUUID();
      notificationIdentifier = `${BEHAVIOURAL_REMINDER_ID_PREFIX}${eventId}`;
      await reserveSentLocal(eventId, kind, sentAt);
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

    try {
      const result = await confirmSentLocalDelivery({
        eventId,
        operationId,
        kind,
        at: sentAt,
        ...(owner
          ? {
              owner: {
                ...owner,
                assertCurrent: () => {
                  lease.assertCurrent();
                  owner.assertCurrent?.();
                },
              },
            }
          : {}),
      });
      lease.assertCurrent();
      if (result.outboxQueued) scheduleOutboxFlush();
    } catch {
      // The OS already accepted the notification. Its reserved row continues
      // to count toward the cap without inventing a server delivery event.
      lease.assertCurrent();
    }
    return true;
  });
}
