import {
  awaitAccountGenerationLease,
  runAccountGenerationOperation,
} from '@/lib/auth/accountGeneration';

import { requestPermission, saveAndRescheduleNotifPrefs } from './deliver';
import type { NotifPrefs, NotifPrefsOwner, NotifPrefsSaveResult } from './store';

const ROUTINE_REMINDERS_ON: Partial<NotifPrefs> = { amEnabled: true, pmEnabled: true };
const ROUTINE_REMINDERS_OFF: Partial<NotifPrefs> = { amEnabled: false, pmEnabled: false };

type NotificationOnboardingDeps = {
  requestPermission: () => Promise<boolean>;
  saveAndReschedule: (
    patch: Partial<NotifPrefs>,
    owner?: NotifPrefsOwner,
  ) => Promise<NotifPrefsSaveResult>;
};

const defaultDeps: NotificationOnboardingDeps = {
  requestPermission,
  saveAndReschedule: saveAndRescheduleNotifPrefs,
};

export async function acceptRoutineReminderSoftAsk(
  deps: NotificationOnboardingDeps = defaultDeps,
  owner?: NotifPrefsOwner,
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
    const patch = granted ? ROUTINE_REMINDERS_ON : ROUTINE_REMINDERS_OFF;
    if (owner) await deps.saveAndReschedule(patch, owner);
    else await deps.saveAndReschedule(patch);
    lease.assertCurrent();
    return granted;
  });
}

export async function declineRoutineReminderSoftAsk(
  deps: Pick<NotificationOnboardingDeps, 'saveAndReschedule'> = defaultDeps,
  owner?: NotifPrefsOwner,
): Promise<void> {
  await runAccountGenerationOperation(async (lease) => {
    if (owner) await deps.saveAndReschedule(ROUTINE_REMINDERS_OFF, owner);
    else await deps.saveAndReschedule(ROUTINE_REMINDERS_OFF);
    lease.assertCurrent();
  });
}
