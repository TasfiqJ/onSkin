import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { NotificationKind } from '@onskin/types';

import { supabase } from '@/lib/supabase/client';

import { REMINDER_COPY } from './copy';
import { canSend, tierEnabled, tierOf, toMinutes, withinQuietHours } from './policy';
import { loadNotifPrefs, type NotifPrefs } from './store';

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

let configured = false;

/** Call once at app start: handler + Android channel. */
export async function configureNotifications(): Promise<void> {
  if (configured) return;
  configured = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false, // calm by default (docs/07 §2)
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('routine', {
        name: 'Routine reminders',
        importance: Notifications.AndroidImportance.DEFAULT, // not high. Calm, no exact alarm
      });
    }
  } catch {
    /* unsupported environment. No-op */
  }
}

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

function copyFor(kind: NotificationKind, discreet: boolean): { title: string; body: string } {
  const c = REMINDER_COPY[kind];
  return { title: discreet ? 'OnSkin' : c.title, body: discreet ? c.discreet : c.body };
}

/**
 * Cancel + reschedule the utility AM/PM reminders from the user's prefs. A reminder
 * whose time falls inside quiet hours is skipped ("nothing fires" there). Idempotent
 * and safe to call on every prefs change.
 */
export async function rescheduleReminders(prefs?: NotifPrefs): Promise<void> {
  const p = prefs ?? (await loadNotifPrefs());
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const channelId = Platform.OS === 'android' ? 'routine' : undefined;
    const schedule = async (kind: 'am_reminder' | 'pm_step', hm: string) => {
      if (withinQuietHours(hm, p.quietStart, p.quietEnd)) return; // suppressed in quiet hours
      const mins = toMinutes(hm);
      if (mins == null) return;
      await Notifications.scheduleNotificationAsync({
        content: copyFor(kind, p.lockscreenDiscreet),
        // channelId belongs on the trigger in expo-notifications (SDK 56), not on
        // content. So the calm 'routine' channel is actually applied on Android.
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: Math.floor(mins / 60),
          minute: mins % 60,
          ...(channelId ? { channelId } : {}),
        },
      });
    };
    if (p.amEnabled) await schedule('am_reminder', p.amTime);
    if (p.pmEnabled) await schedule('pm_step', p.pmTime);
  } catch {
    /* unsupported environment. No-op (B-NOTIF-VERIFY) */
  }
}

/** This week's count for a tier, from the content-free log (best-effort; B-SUPABASE). */
async function sentThisWeekForTier(userId: string, tier: string): Promise<number> {
  try {
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { count } = await supabase
      .from('notification_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId) // explicit per-user scope, not relying on RLS alone
      .eq('tier', tier)
      .gte('sent_at', weekAgo);
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
export async function notifyBehavioural(kind: NotificationKind, nowHHMM: string): Promise<boolean> {
  const p = await loadNotifPrefs();
  // Honour the user's per-kind opt-out FIRST (docs/07 §3.1/§8): a disabled tier , 
  // and especially the off-by-default promotional tier. Never fires.
  if (!tierEnabled(kind, p)) return false;
  let sent = 0;
  let userId: string | undefined;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id;
    if (userId) sent = await sentThisWeekForTier(userId, tierOf(kind));
  } catch {
    /* offline. Treat as 0 sent */
  }
  const decision = canSend({ kind, sentThisWeekForTier: sent, now: nowHHMM, quietStart: p.quietStart, quietEnd: p.quietEnd });
  if (!decision.allowed) return false;
  try {
    await Notifications.scheduleNotificationAsync({
      content: copyFor(kind, p.lockscreenDiscreet),
      // Immediate, on the calm 'routine' channel (Android); channelId must be on the
      // trigger, not content (SDK 56). A bare { channelId } means deliver now.
      trigger: Platform.OS === 'android' ? { channelId: 'routine' } : null,
    });
    if (userId) await supabase.from('notification_log').insert({ user_id: userId, tier: tierOf(kind), kind });
  } catch {
    return false;
  }
  return true;
}
