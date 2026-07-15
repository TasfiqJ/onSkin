import {
  HEALTH_DATA_WRITE_ADMISSION_CLOSED,
  runHealthDataWriteOperation,
} from '@/lib/consent/healthDataWriteAdmission';
import { activeHealthProcessingOwnerUserId } from '@/lib/consent/healthProcessingEpoch';

import { applyNotificationPreferencePatch } from './applyPreferences';
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
  const expectedOwnerUserId = activeHealthProcessingOwnerUserId();
  if (!expectedOwnerUserId) throw new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED);
  return runHealthDataWriteOperation(expectedOwnerUserId, async (lease) => {
    lease.assertCurrent();
    const granted = await deps.requestPermission();
    lease.assertCurrent();
    await applyNotificationPreferencePatch(
      granted ? ROUTINE_REMINDERS_ON : ROUTINE_REMINDERS_OFF,
      { save: deps.saveNotifPrefs, reschedule: deps.rescheduleReminders },
      lease,
    );
    lease.assertCurrent();
    return granted;
  });
}

export async function declineRoutineReminderSoftAsk(
  deps: Pick<NotificationOnboardingDeps, 'saveNotifPrefs' | 'rescheduleReminders'> = defaultDeps,
): Promise<void> {
  const expectedOwnerUserId = activeHealthProcessingOwnerUserId();
  if (!expectedOwnerUserId) throw new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED);
  await runHealthDataWriteOperation(expectedOwnerUserId, async (lease) => {
    lease.assertCurrent();
    await applyNotificationPreferencePatch(
      ROUTINE_REMINDERS_OFF,
      { save: deps.saveNotifPrefs, reschedule: deps.rescheduleReminders },
      lease,
    );
    lease.assertCurrent();
  });
}
