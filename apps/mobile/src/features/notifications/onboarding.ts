import {
  awaitAccountGenerationLease,
  runAccountGenerationOperation,
} from '@/lib/auth/accountGeneration';

import { requestPermission, saveAndRescheduleNotifPrefs } from './deliver';
import type { NotifPrefs, NotifPrefsSaveResult } from './store';

const ROUTINE_REMINDERS_ON: Partial<NotifPrefs> = { amEnabled: true, pmEnabled: true };
const ROUTINE_REMINDERS_OFF: Partial<NotifPrefs> = { amEnabled: false, pmEnabled: false };

type NotificationOnboardingDeps = {
  requestPermission: () => Promise<boolean>;
  saveAndReschedule: (patch: Partial<NotifPrefs>) => Promise<NotifPrefsSaveResult>;
};

const defaultDeps: NotificationOnboardingDeps = {
  requestPermission,
  saveAndReschedule: saveAndRescheduleNotifPrefs,
};

export async function acceptRoutineReminderSoftAsk(
  deps: NotificationOnboardingDeps = defaultDeps,
): Promise<boolean> {
  return runAccountGenerationOperation(async (lease) => {
    let granted: boolean;
    try {
      granted = await awaitAccountGenerationLease(lease, deps.requestPermission);
    } catch (error) {
      lease.assertCurrent();
      throw error;
    }
    lease.assertCurrent();
    await deps.saveAndReschedule(
      granted ? ROUTINE_REMINDERS_ON : ROUTINE_REMINDERS_OFF,
    );
    lease.assertCurrent();
    return granted;
  });
}

export async function declineRoutineReminderSoftAsk(
  deps: Pick<NotificationOnboardingDeps, 'saveAndReschedule'> = defaultDeps,
): Promise<void> {
  await runAccountGenerationOperation(async (lease) => {
    await deps.saveAndReschedule(ROUTINE_REMINDERS_OFF);
    lease.assertCurrent();
  });
}
