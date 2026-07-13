import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { NotificationKind } from '@onskin/types';

import { PAYWALL_COPY } from '@/features/subscription/copy';
import { PLANS } from '@/features/subscription/plans';
import { loadEntitlement } from '@/features/subscription/store';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { captureAuthenticatedAccountOwner } from '@/lib/auth/authenticatedAccountOwner';
import { supabase } from '@/lib/supabase/client';

import { notificationContentForLockScreen } from './copy';
import { canSend, reminderTimeOutsideQuietHours, tierEnabled, tierOf, toMinutes } from './policy';
import { recordSentLocal, sentThisWeekForTierLocal } from './sentStore';
import { loadNotifPrefs, type NotifPrefs } from './store';

export { configureNotifications } from './startup';

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

export async function getPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'undetermined';
  }
}

/** The OS prompt. Fired only after the soft-ask "yes" (docs/07 §3.2). */
export async function requestPermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Cancel + reschedule the utility AM/PM reminders from the user's prefs. A reminder
 * whose chosen time falls inside quiet hours is shifted to the quiet-hours end so
 * nothing fires inside the window and the reminder still arrives. Idempotent and
 * safe to call on every prefs change.
 */
export async function rescheduleReminders(prefs?: NotifPrefs): Promise<void> {
  await runAccountGenerationOperation(async (lease) => {
    const p = prefs ?? (await loadNotifPrefs());
    lease.assertCurrent();
    const scheduledIds: string[] = [];
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      lease.assertCurrent();
      const channelId = Platform.OS === 'android' ? 'routine' : undefined;
      const schedule = async (kind: 'am_reminder' | 'pm_step', hm: string) => {
        const deliveryTime = reminderTimeOutsideQuietHours(hm, p.quietStart, p.quietEnd);
        const mins = toMinutes(deliveryTime);
        if (mins == null) return;
        lease.assertCurrent();
        scheduledIds.push(
          await Notifications.scheduleNotificationAsync({
            content: notificationContentForLockScreen(kind),
            // channelId belongs on the trigger in expo-notifications (SDK 56), not on
            // content. So the calm 'routine' channel is actually applied on Android.
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour: Math.floor(mins / 60),
              minute: mins % 60,
              ...(channelId ? { channelId } : {}),
            },
          }),
        );
        lease.assertCurrent();
      };
      if (p.amEnabled) await schedule('am_reminder', p.amTime);
      if (p.pmEnabled) await schedule('pm_step', p.pmTime);

      // Weekly progress-photo capture nudge (docs/07 §3.3 / docs/06 §5): a recurring
      // WEEKLY local notification when opted in, the weekly cadence being its own
      // frequency control. If the usual AM time is quiet, it waits until quiet ends.
      if (p.captureReminders) {
        const mins = toMinutes(reminderTimeOutsideQuietHours(p.amTime, p.quietStart, p.quietEnd));
        if (mins != null) {
          lease.assertCurrent();
          scheduledIds.push(
            await Notifications.scheduleNotificationAsync({
              content: notificationContentForLockScreen('capture'),
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                weekday: 1, // Sunday, a calm weekly check-in cadence
                hour: Math.floor(mins / 60),
                minute: mins % 60,
                ...(channelId ? { channelId } : {}),
              },
            }),
          );
          lease.assertCurrent();
        }
      }
      // The one-shot "2 days before your trial ends" pre-charge reminder (docs/08
      // §6, the honesty promise made on the paywall + success screens). Re-created
      // here so the cancelAll above never strands it when the user edits any pref.
      await scheduleTrialReminder();
      lease.assertCurrent();
    } catch {
      await Promise.allSettled(
        scheduledIds.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
      );
      lease.assertCurrent();
      /* unsupported environment. No-op (B-NOTIF-VERIFY) */
    }
  });
}

const TRIAL_REMINDER_ID = 'onskin-trial-reminder';

function fmtShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Schedule the one-shot pre-charge reminder fired 2 days before a carded trial
 * converts (docs/08 §6 / docs/07): the app promises this on the paywall + success
 * screens, so it must actually be scheduled. Reads the entitlement; only schedules
 * for an ACTIVE carded trial whose 2-days-before instant is still in the future.
 * Idempotent (fixed identifier, cancelled + recreated). No-op off-device.
 */
export async function scheduleTrialReminder(): Promise<void> {
  await runAccountGenerationOperation(async (lease) => {
    try {
      await Notifications.cancelScheduledNotificationAsync(TRIAL_REMINDER_ID).catch(() => {});
      lease.assertCurrent();
      const e = await loadEntitlement();
      lease.assertCurrent();
      if (!e || !e.isActive || e.periodType !== 'trial' || !e.expiresAt) return;
      const fireAt = new Date(e.expiresAt).getTime() - 2 * 86_400_000;
      if (fireAt <= Date.now()) return; // already inside the final 2 days. Nothing to schedule
      await Notifications.scheduleNotificationAsync({
        identifier: TRIAL_REMINDER_ID,
        content: {
          title: PAYWALL_COPY.trialReminder.title,
          body: PAYWALL_COPY.trialReminder.bodyFor(
            fmtShortDate(e.expiresAt),
            e.priceLabel ?? PLANS.annual.priceLabel,
          ),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
          ...(Platform.OS === 'android' ? { channelId: 'routine' } : {}),
        },
      });
      lease.assertCurrent();
    } catch {
      if (lease.signal.aborted) {
        await Notifications.cancelScheduledNotificationAsync(TRIAL_REMINDER_ID).catch(() => {});
      }
      lease.assertCurrent();
      /* unsupported environment. No-op (B-NOTIF-VERIFY) */
    }
  });
}

/** Cancel the pre-charge reminder (on conversion or trial cancellation). */
export async function cancelTrialReminder(): Promise<void> {
  await runAccountGenerationOperation(async (lease) => {
    try {
      await Notifications.cancelScheduledNotificationAsync(TRIAL_REMINDER_ID);
      lease.assertCurrent();
    } catch {
      lease.assertCurrent();
      /* no-op */
    }
  });
}

/** This week's count for a tier, from the content-free log (best-effort; B-SUPABASE). */
async function sentThisWeekForTier(
  userId: string,
  tier: string,
  signal: AbortSignal,
): Promise<number> {
  try {
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { count } = await supabase
      .from('notification_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId) // explicit per-user scope, not relying on RLS alone
      .eq('tier', tier)
      .gte('sent_at', weekAgo)
      .abortSignal(signal);
    return count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * A behavioural-trigger notification (replenishment / rampup / de-escalation /
 * streak nudge / capture), gated by the frequency-cap engine + quiet hours (§9).
 * Fires an immediate local notification and logs metadata only. Returns whether it
 * was sent. Behavioural delivery is wired here for the features that raise these
 * triggers to call; the trigger *content* is owned by those features (docs/07 §1).
 */
export async function notifyBehavioural(kind: NotificationKind, hhmm: string): Promise<boolean> {
  return runAccountGenerationOperation(async (lease) => {
    const p = await loadNotifPrefs();
    lease.assertCurrent();
    // Honour the user's per-kind opt-out FIRST (docs/07 §3.1/§8): a disabled tier ,
    // and especially the off-by-default promotional tier. Never fires.
    if (!tierEnabled(kind, p)) return false;
    const now = Date.now();
    // Frequency cap source of truth = the local sent-log (works offline), unioned
    // with the server log when present. Without this, the server count is 0 offline
    // (v1) and a foreground trigger would re-fire on every app open (docs/07 §9).
    let sent = await sentThisWeekForTierLocal(tierOf(kind), now);
    lease.assertCurrent();
    let userId: string | undefined;
    try {
      const owner = await captureAuthenticatedAccountOwner(lease);
      userId = owner?.userId;
      if (userId) {
        sent = Math.max(sent, await sentThisWeekForTier(userId, tierOf(kind), lease.signal));
      }
      lease.assertCurrent();
    } catch {
      lease.assertCurrent();
      /* offline. Local count stands */
    }
    const decision = canSend({
      kind,
      sentThisWeekForTier: sent,
      now: hhmm,
      quietStart: p.quietStart,
      quietEnd: p.quietEnd,
    });
    if (!decision.allowed) return false;
    let scheduledNotificationId: string | null = null;
    try {
      lease.assertCurrent();
      scheduledNotificationId = await Notifications.scheduleNotificationAsync({
        content: notificationContentForLockScreen(kind),
        // Immediate, on the calm 'routine' channel (Android); channelId must be on the
        // trigger, not content (SDK 56). A bare { channelId } means deliver now.
        trigger: Platform.OS === 'android' ? { channelId: 'routine' } : null,
      });
      lease.assertCurrent();
      await recordSentLocal(kind, now); // local cap ledger (v1 source of truth)
      lease.assertCurrent();
    } catch {
      if (scheduledNotificationId) {
        await Notifications.cancelScheduledNotificationAsync(scheduledNotificationId).catch(
          () => undefined,
        );
      }
      lease.assertCurrent();
      return false;
    }
    if (userId) {
      try {
        lease.assertCurrent();
        await supabase
          .from('notification_log')
          .insert({ user_id: userId, tier: tierOf(kind), kind })
          .abortSignal(lease.signal);
        lease.assertCurrent();
      } catch {
        lease.assertCurrent();
        /* best-effort backend mirror; local delivery already succeeded */
      }
    }
    return true;
  });
}
