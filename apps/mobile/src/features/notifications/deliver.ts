import * as Notifications from 'expo-notifications';
import { randomUUID } from 'expo-crypto';
import { Platform } from 'react-native';

import type { NotificationKind } from '@layerwell/types';

import { canUseRoutineCadence, canUseRoutineRecovery } from '@/features/routine/reviewGate';
import { billingCadenceForProductId } from '@/features/subscription/billingCadence';
import { PAYWALL_COPY } from '@/features/subscription/copy';
import { loadEntitlement } from '@/features/subscription/store';
import {
  AccountGenerationLeaseError,
  type AccountGenerationLease,
  runAccountGenerationOperation,
} from '@/lib/auth/accountGeneration';
import {
  assertHealthDataWriteLease,
  captureHealthDataWriteLease,
  HEALTH_DATA_WRITE_ADMISSION_CLOSED,
  HEALTH_DATA_WRITE_OWNER_MISMATCH,
  type HealthDataWriteLease,
} from '@/lib/consent/healthDataWriteAdmission';

import { notificationContentForLockScreen } from './copy';
import {
  NOTIFICATION_CATEGORY,
  notificationCategoryForKind,
  notificationDataForKind,
  trialEndingNotificationData,
} from './contract';
import { canSend, reminderTimeOutsideQuietHours, tierEnabled, toMinutes } from './policy';
import {
  cancelNativeScheduledNotificationExact,
  clearNativeNotificationsForAccountIsolation,
  scheduleNativeNotificationExact,
} from './nativeMutation';
import { reserveNotificationSlotLocal } from './sentStore';
import { loadNotifPrefs, type NotifPrefs } from './store';
import { configureNotifications } from './startup';

export { configureNotifications } from './startup';

export type EventTriggeredNotificationKind = Extract<
  NotificationKind,
  'replenishment' | 'rampup' | 'deescalation' | 'winback'
>;

type HealthNotificationOperation = Readonly<{
  assertCurrent: () => void;
  schedule: (
    request: Parameters<typeof scheduleNativeNotificationExact>[1],
  ) => Promise<string>;
}>;

const inFlightHealthNotificationOperations = new Set<Promise<unknown>>();
let healthNotificationOperationTail: Promise<void> = Promise.resolve();

function assertHealthNotificationOperationCurrent(
  accountLease: AccountGenerationLease,
  healthLease: HealthDataWriteLease,
): void {
  accountLease.assertCurrent();
  assertHealthDataWriteLease(healthLease);
}

async function cancelCreatedHealthNotifications(ids: ReadonlySet<string>): Promise<void> {
  await Promise.allSettled([...ids].map((id) => cancelNativeScheduledNotificationExact(id)));
}

async function runHealthNotificationOperation<T>(
  operation: (context: HealthNotificationOperation) => Promise<T>,
): Promise<T> {
  const execute = () =>
    runAccountGenerationOperation(async (accountLease) => {
      const healthLease = captureHealthDataWriteLease();
      const createdIds = new Set<string>();
      const assertCurrent = () =>
        assertHealthNotificationOperationCurrent(accountLease, healthLease);
      const schedule = async (
        request: Parameters<typeof scheduleNativeNotificationExact>[1],
      ) => {
        assertCurrent();
        if (!isDeliverableAuthorizationState(await getPermissionStatus())) {
          throw new Error('NOTIFICATION_AUTHORIZATION_UNAVAILABLE');
        }
        assertCurrent();
        const id = await scheduleNativeNotificationExact(accountLease.signal, request);
        createdIds.add(id);
        try {
          assertCurrent();
        } catch (error) {
          await cancelNativeScheduledNotificationExact(id).catch(() => undefined);
          createdIds.delete(id);
          throw error;
        }
        return id;
      };

      try {
        assertCurrent();
        const result = await operation({ assertCurrent, schedule });
        assertCurrent();
        return result;
      } catch (error) {
        // If authorization closes between two schedules, remove every reminder
        // this exact operation already published before allowing cleanup to drain.
        await cancelCreatedHealthNotifications(createdIds);
        throw error;
      }
    });
  const pending = healthNotificationOperationTail.then(execute, execute);
  healthNotificationOperationTail = pending.then(
    () => undefined,
    () => undefined,
  );
  inFlightHealthNotificationOperations.add(pending);
  try {
    return await pending;
  } finally {
    inFlightHealthNotificationOperations.delete(pending);
  }
}

/** Drain point used by consent withdrawal before its final native cancel-all. */
export async function waitForHealthNotificationOperationsToSettle(): Promise<void> {
  while (inFlightHealthNotificationOperations.size > 0) {
    await Promise.allSettled([...inFlightHealthNotificationOperations]);
  }
}

/** The current local wall-clock time as "HH:MM" (for quiet-hours / cap checks). */
export function nowHHMM(d = new Date()): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Local-first notification delivery (docs/07 §3.4/§9). The utility AM/PM reminders
 * are scheduled as repeating DAILY local notifications at the user's chosen times
 * (no server round-trip, content on-device, §3.6 discretion). Behavioural triggers
 * go through the frequency-cap engine before firing. Everything is guarded. On
 * Expo Go / emulators / unsupported devices it degrades to a no-op rather than
 * throwing (real on-device behaviour + Android-14 exact-alarm acceptance is
 * B-NOTIF-VERIFY). NO health-revealing content is placed in any push payload; these
 * are LOCAL notifications (§8).
 */

export type NotificationAuthorizationState =
  | 'not_determined'
  | 'denied'
  | 'authorized'
  | 'provisional'
  | 'ephemeral'
  | 'unavailable';

export type NotificationPermissionOutcome =
  | {
      kind: 'already_authorized';
      state: 'authorized' | 'provisional' | 'ephemeral';
      requestAttempted: false;
    }
  | {
      kind: 'authorized';
      state: 'authorized' | 'provisional' | 'ephemeral';
      requestAttempted: true;
    }
  | { kind: 'denied'; state: 'denied'; requestAttempted: true }
  | { kind: 'blocked'; state: 'denied'; requestAttempted: false }
  | { kind: 'unchanged'; state: 'not_determined'; requestAttempted: true }
  | { kind: 'error'; state: 'unavailable'; requestAttempted: boolean };

export function isDeliverableAuthorizationState(
  state: NotificationAuthorizationState,
): state is 'authorized' | 'provisional' | 'ephemeral' {
  return state === 'authorized' || state === 'provisional' || state === 'ephemeral';
}

function authorizationState(
  status: Notifications.NotificationPermissionsStatus,
): NotificationAuthorizationState {
  if (Platform.OS === 'ios' && status.ios) {
    switch (status.ios.status) {
      case Notifications.IosAuthorizationStatus.AUTHORIZED:
        return 'authorized';
      case Notifications.IosAuthorizationStatus.PROVISIONAL:
        return 'provisional';
      case Notifications.IosAuthorizationStatus.EPHEMERAL:
        return 'ephemeral';
      case Notifications.IosAuthorizationStatus.DENIED:
        return 'denied';
      case Notifications.IosAuthorizationStatus.NOT_DETERMINED:
        return 'not_determined';
    }
  }
  if (status.status === 'granted') return 'authorized';
  if (status.status === 'denied') return 'denied';
  return 'not_determined';
}

async function readAuthorization(): Promise<{
  state: NotificationAuthorizationState;
  canAskAgain: boolean;
}> {
  const status = await Notifications.getPermissionsAsync();
  return { state: authorizationState(status), canAskAgain: status.canAskAgain };
}

export async function getPermissionStatus(): Promise<NotificationAuthorizationState> {
  try {
    return (await readAuthorization()).state;
  } catch {
    return 'unavailable';
  }
}

/** The OS prompt. Fired only after the soft-ask "yes" (docs/07 §3.2). */
export async function requestPermission(): Promise<NotificationPermissionOutcome> {
  let requestAttempted = false;
  try {
    const before = await readAuthorization();
    if (isDeliverableAuthorizationState(before.state)) {
      return {
        kind: 'already_authorized',
        state: before.state,
        requestAttempted: false,
      };
    }
    if (before.state === 'denied' && !before.canAskAgain) {
      return { kind: 'blocked', state: 'denied', requestAttempted: false };
    }
    requestAttempted = true;
    const after = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: false,
        allowSound: false,
      },
    });
    const state = authorizationState(after);
    if (isDeliverableAuthorizationState(state)) {
      return { kind: 'authorized', state, requestAttempted: true };
    }
    if (state === 'denied') {
      return { kind: 'denied', state: 'denied', requestAttempted: true };
    }
    return { kind: 'unchanged', state: 'not_determined', requestAttempted: true };
  } catch {
    return { kind: 'error', state: 'unavailable', requestAttempted };
  }
}

/**
 * Cancel + reschedule the utility AM/PM reminders from the user's prefs. A reminder
 * whose chosen time falls inside quiet hours is shifted to the quiet-hours end so
 * routine scheduling waits until the window ends. The OS still controls actual
 * presentation. Idempotent and safe to call on every prefs change.
 */
export async function rescheduleReminders(prefs?: NotifPrefs): Promise<void> {
  try {
    await runHealthNotificationOperation(async ({ assertCurrent, schedule }) => {
      assertCurrent();
      const p = prefs ?? (await loadNotifPrefs());
      assertCurrent();
      await clearNativeNotificationsForAccountIsolation();
      assertCurrent();
      if (!isDeliverableAuthorizationState(await getPermissionStatus())) return;
      assertCurrent();
      if ((await configureNotifications()) !== 'ready') return;
      assertCurrent();
      const channelId = Platform.OS === 'android' ? 'routine' : undefined;
      const scheduleRoutine = async (kind: 'am_reminder' | 'pm_step', hm: string) => {
        const deliveryTime = reminderTimeOutsideQuietHours(hm, p.quietStart, p.quietEnd);
        const mins = toMinutes(deliveryTime);
        if (mins == null) return;
        assertCurrent();
        await schedule({
          identifier: `layerwell-local-${kind}-v1`,
          content: {
            ...notificationContentForLockScreen(kind),
            categoryIdentifier: notificationCategoryForKind(kind),
            data: notificationDataForKind(kind),
          },
          // channelId belongs on the trigger in expo-notifications (SDK 57), not on
          // content. So the calm 'routine' channel is actually applied on Android.
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: Math.floor(mins / 60),
            minute: mins % 60,
            ...(channelId ? { channelId } : {}),
          },
        });
        assertCurrent();
      };
      if (p.amEnabled) await scheduleRoutine('am_reminder', p.amTime);
      if (p.pmEnabled) await scheduleRoutine('pm_step', p.pmTime);

      // Weekly progress-photo capture nudge (docs/07 §3.3 / docs/06 §5): a recurring
      // WEEKLY local notification when opted in, the weekly cadence being its own
      // frequency control. If the usual AM time is quiet, it waits until quiet ends.
      if (p.captureReminders) {
        const mins = toMinutes(reminderTimeOutsideQuietHours(p.amTime, p.quietStart, p.quietEnd));
        if (mins != null) {
          assertCurrent();
          await schedule({
            identifier: 'layerwell-local-capture-v1',
            content: {
              ...notificationContentForLockScreen('capture'),
              categoryIdentifier: notificationCategoryForKind('capture'),
              data: notificationDataForKind('capture'),
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
              weekday: 1, // Sunday, a calm weekly check-in cadence
              hour: Math.floor(mins / 60),
              minute: mins % 60,
              ...(channelId ? { channelId } : {}),
            },
          });
          assertCurrent();
        }
      }
      // cancelAll also removes the billing reminder; it is rebuilt below after
      // this health-purpose operation and admission scope have ended.
    });
  } catch {
    /* unsupported environment. No-op (B-NOTIF-VERIFY) */
  }

  // Billing safety is deliberately outside health admission and its tracked
  // operation. Re-create it even if health scheduling was closed or aborted.
  await scheduleTrialReminder();
}

const TRIAL_REMINDER_ID = 'layerwell-trial-reminder';

function fmtShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Schedule the one-shot pre-charge reminder fired 2 days before a carded trial
 * converts (docs/08 §6 / docs/07). The UI describes this as optional because
 * delivery depends on notification permission and device availability. Only an
 * active carded trial with an exact configured-product cadence, localized price,
 * and future 2-days-before instant is eligible. Idempotent (fixed identifier,
 * cancelled + recreated). No-op off-device.
 */
export async function scheduleTrialReminder(): Promise<void> {
  try {
    await runAccountGenerationOperation(async (lease) => {
      lease.assertCurrent();
      await cancelNativeScheduledNotificationExact(TRIAL_REMINDER_ID).catch(() => {});
      lease.assertCurrent();
      const e = await loadEntitlement();
      lease.assertCurrent();
      if (!e || !e.isActive || e.periodType !== 'trial' || !e.expiresAt) return;
      const cadence = billingCadenceForProductId(e.productId);
      const price = e.priceLabel?.trim() || null;
      if (!cadence || !price) return;
      const fireAt = new Date(e.expiresAt).getTime() - 2 * 86_400_000;
      if (fireAt <= Date.now()) return; // already inside the final 2 days. Nothing to schedule
      if (!isDeliverableAuthorizationState(await getPermissionStatus())) return;
      lease.assertCurrent();
      if ((await configureNotifications()) !== 'ready') return;
      lease.assertCurrent();
      await scheduleNativeNotificationExact(lease.signal, {
        identifier: TRIAL_REMINDER_ID,
        content: {
          title: PAYWALL_COPY.trialReminder.title,
          body: PAYWALL_COPY.trialReminder.bodyFor(
            fmtShortDate(e.expiresAt),
            price,
            cadence,
          ),
          categoryIdentifier: NOTIFICATION_CATEGORY.billing,
          data: trialEndingNotificationData(),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
          ...(Platform.OS === 'android' ? { channelId: 'routine' } : {}),
        },
      });
      lease.assertCurrent();
    });
  } catch {
    /* unsupported environment. No-op (B-NOTIF-VERIFY) */
  }
}

/** Cancel the pre-charge reminder (on conversion or trial cancellation). */
export async function cancelTrialReminder(): Promise<void> {
  try {
    await cancelNativeScheduledNotificationExact(TRIAL_REMINDER_ID);
  } catch {
    /* no-op */
  }
}

/**
 * An event-triggered optional notification (replenishment / ramp-up /
 * de-escalation / win-back), gated by the frequency-cap engine + quiet hours (§9).
 * Reserves device-local cap capacity before asking the native scheduler and returns
 * whether the schedule request succeeded. A reservation is an attempt record, not
 * delivery/open proof. Behavioural delivery is wired here for the features that
 * raise these triggers to call; the trigger *content* is owned by those features
 * (docs/07 §1).
 */
export async function notifyBehavioural(
  kind: EventTriggeredNotificationKind,
  hhmm: string,
): Promise<boolean> {
  if (kind === 'rampup' && !canUseRoutineCadence()) return false;
  if (kind === 'deescalation' && !canUseRoutineRecovery()) return false;
  try {
    return await runHealthNotificationOperation(async ({ assertCurrent, schedule }) => {
      assertCurrent();
      const p = await loadNotifPrefs();
      assertCurrent();
      // Honour the user's per-kind opt-out FIRST (docs/07 §3.1/§8): a disabled tier ,
      // and especially the off-by-default promotional tier. Never fires.
      if (!tierEnabled(kind, p)) return false;
      const now = Date.now();
      const decision = canSend({
        kind,
        // The atomic device-local reservation below owns the cap decision. This
        // pure check handles quiet hours without a split read/then-write race.
        sentThisWeekForTier: 0,
        now: hhmm,
        quietStart: p.quietStart,
        quietEnd: p.quietEnd,
      });
      if (!decision.allowed) return false;
      assertCurrent();
      if (!isDeliverableAuthorizationState(await getPermissionStatus())) return false;
      assertCurrent();
      if ((await configureNotifications()) !== 'ready') return false;
      assertCurrent();
      if (!(await reserveNotificationSlotLocal(kind, now))) return false;
      assertCurrent();
      try {
        assertCurrent();
        await schedule({
          identifier: `layerwell-local-${kind}-${randomUUID()}`,
          content: {
            ...notificationContentForLockScreen(kind),
            categoryIdentifier: notificationCategoryForKind(kind),
            data: notificationDataForKind(kind),
          },
          // Immediate, on the calm 'routine' channel (Android); channelId must be on the
          // trigger, not content (SDK 57). A bare { channelId } means deliver now.
          trigger: Platform.OS === 'android' ? { channelId: 'routine' } : null,
        });
        assertCurrent();
      } catch {
        // Do not collapse an account-boundary invalidation into an ordinary
        // notification failure; the outer boundary handler must stop this
        // continuation before it can write into the next owner's state.
        assertCurrent();
        return false;
      }
      return true;
    });
  } catch (error) {
    if (error instanceof AccountGenerationLeaseError) return false;
    if (error instanceof Error && error.message === HEALTH_DATA_WRITE_ADMISSION_CLOSED) {
      return false;
    }
    if (error instanceof Error && error.message === HEALTH_DATA_WRITE_OWNER_MISMATCH) return false;
    throw error;
  }
}
