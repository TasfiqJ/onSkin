import { rescheduleReminders, requestPermission } from './deliver';
import { saveNotifPrefs, type NotifPrefs } from './store';

const ROUTINE_REMINDERS_ON: Partial<NotifPrefs> = { amEnabled: true, pmEnabled: true };
const ROUTINE_REMINDERS_OFF: Partial<NotifPrefs> = { amEnabled: false, pmEnabled: false };

type NotificationOnboardingDeps = {
  requestPermission: () => Promise<boolean>;
  saveNotifPrefs: (patch: Partial<NotifPrefs>) => Promise<NotifPrefs>;
  rescheduleReminders: (prefs: NotifPrefs) => Promise<void>;
};

const defaultDeps: NotificationOnboardingDeps = {
  requestPermission,
  saveNotifPrefs,
  rescheduleReminders,
};

export async function acceptRoutineReminderSoftAsk(
  deps: NotificationOnboardingDeps = defaultDeps,
): Promise<boolean> {
  const granted = await deps.requestPermission();
  const prefs = await deps.saveNotifPrefs(granted ? ROUTINE_REMINDERS_ON : ROUTINE_REMINDERS_OFF);
  await deps.rescheduleReminders(prefs);
  return granted;
}

export async function declineRoutineReminderSoftAsk(
  deps: Pick<NotificationOnboardingDeps, 'saveNotifPrefs' | 'rescheduleReminders'> = defaultDeps,
): Promise<void> {
  const prefs = await deps.saveNotifPrefs(ROUTINE_REMINDERS_OFF);
  await deps.rescheduleReminders(prefs);
}
