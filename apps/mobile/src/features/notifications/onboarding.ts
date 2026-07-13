import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';

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
  return runAccountGenerationOperation(async (lease) => {
    const granted = await deps.requestPermission();
    lease.assertCurrent();
    const prefs = await deps.saveNotifPrefs(granted ? ROUTINE_REMINDERS_ON : ROUTINE_REMINDERS_OFF);
    lease.assertCurrent();
    await deps.rescheduleReminders(prefs);
    lease.assertCurrent();
    return granted;
  });
}

export async function declineRoutineReminderSoftAsk(
  deps: Pick<NotificationOnboardingDeps, 'saveNotifPrefs' | 'rescheduleReminders'> = defaultDeps,
): Promise<void> {
  await runAccountGenerationOperation(async (lease) => {
    const prefs = await deps.saveNotifPrefs(ROUTINE_REMINDERS_OFF);
    lease.assertCurrent();
    await deps.rescheduleReminders(prefs);
    lease.assertCurrent();
  });
}
