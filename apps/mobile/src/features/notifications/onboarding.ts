import {
  HEALTH_DATA_WRITE_ADMISSION_CLOSED,
  runHealthDataWriteOperation,
} from '@/lib/consent/healthDataWriteAdmission';
import { activeHealthProcessingOwnerUserId } from '@/lib/consent/healthProcessingEpoch';

import { applyNotificationPreferencePatch } from './applyPreferences';
import { DEFAULT_ROUTINE_REMINDER_TIMES } from './defaults';
import {
  isDeliverableAuthorizationState,
  rescheduleReminders,
  requestPermission,
  type NotificationPermissionOutcome,
} from './deliver';
import { saveNotifPrefs, type NotifPrefs } from './store';

export const PROPOSED_ROUTINE_REMINDER_TIMES = DEFAULT_ROUTINE_REMINDER_TIMES;

const OPTIONAL_NOTIFICATION_PURPOSES_OFF: Partial<NotifPrefs> = {
  streakNudges: false,
  replenishmentAlerts: false,
  captureReminders: false,
  liveActivityEnabled: false,
  promotionalOptIn: false,
};

type NotificationOnboardingDeps = {
  requestPermission: () => Promise<NotificationPermissionOutcome>;
  saveNotifPrefs: (patch: Partial<NotifPrefs>) => Promise<NotifPrefs>;
  rescheduleReminders: (prefs: NotifPrefs) => Promise<void>;
};

const defaultDeps: NotificationOnboardingDeps = {
  requestPermission,
  saveNotifPrefs,
  rescheduleReminders,
};

export async function acceptRoutineReminderSoftAsk(
  times: Readonly<typeof PROPOSED_ROUTINE_REMINDER_TIMES> = PROPOSED_ROUTINE_REMINDER_TIMES,
  deps: NotificationOnboardingDeps = defaultDeps,
): Promise<NotificationPermissionOutcome> {
  const expectedOwnerUserId = activeHealthProcessingOwnerUserId();
  if (!expectedOwnerUserId) throw new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED);
  return runHealthDataWriteOperation(expectedOwnerUserId, async (lease) => {
    lease.assertCurrent();
    const outcome = await deps.requestPermission();
    lease.assertCurrent();
    const enabled = isDeliverableAuthorizationState(outcome.state);
    await applyNotificationPreferencePatch(
      {
        ...OPTIONAL_NOTIFICATION_PURPOSES_OFF,
        amEnabled: enabled,
        pmEnabled: enabled,
        amTime: times.amTime,
        pmTime: times.pmTime,
      },
      { save: deps.saveNotifPrefs, reschedule: deps.rescheduleReminders },
      lease,
    );
    lease.assertCurrent();
    return outcome;
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
      {
        ...OPTIONAL_NOTIFICATION_PURPOSES_OFF,
        amEnabled: false,
        pmEnabled: false,
      },
      { save: deps.saveNotifPrefs, reschedule: deps.rescheduleReminders },
      lease,
    );
    lease.assertCurrent();
  });
}
