import { loadNotifPrefs, saveNotifPrefs } from '@/features/notifications/store';

// The weekly progress-photo nudge (docs/06 §5) is one of Doc 7's behavioural
// notifications, so its preference now lives in the unified notification-prefs
// store (`captureReminders`) rather than a separate flag. These thin delegates keep
// the Slice-20 call sites working. Delivery/scheduling is the Doc 7 engine; a missed
// week never breaks anything.
export async function getPhotoReminderEnabled(): Promise<boolean> {
  return (await loadNotifPrefs()).captureReminders;
}

export async function setPhotoReminderEnabled(enabled: boolean): Promise<void> {
  await saveNotifPrefs({ captureReminders: enabled });
}
