import {
  HEALTH_DATA_WRITE_ADMISSION_CLOSED,
  runHealthDataWriteOperation,
  type HealthDataWriteOperationLease,
} from '@/lib/consent/healthDataWriteAdmission';
import { activeHealthProcessingOwnerUserId } from '@/lib/consent/healthProcessingEpoch';

import type { ReminderScheduleOutcome } from './deliver';
import type { NotifPrefs } from './store';

type ApplyNotificationPreferencePatchDeps = {
  save: (patch: Partial<NotifPrefs>) => Promise<NotifPrefs>;
  reschedule: (prefs: NotifPrefs) => Promise<ReminderScheduleOutcome>;
};

export class NotificationPreferenceSaveError extends Error {
  constructor(readonly prefs: NotifPrefs, readonly schedulingError: unknown) {
    super('PREFERENCES_SAVED_REMINDERS_UNCONFIRMED');
    this.name = 'NotificationPreferenceSaveError';
  }
}

let preferenceApplicationTail: Promise<void> = Promise.resolve();

export async function applyNotificationPreferencePatch(
  patch: Partial<NotifPrefs>,
  deps: ApplyNotificationPreferencePatchDeps,
  existingLease?: HealthDataWriteOperationLease,
): Promise<{ prefs: NotifPrefs; scheduling: ReminderScheduleOutcome }> {
  const apply = async (lease: HealthDataWriteOperationLease) => {
    const execute = async () => {
      lease.assertCurrent();
      const next = await deps.save(patch);
      lease.assertCurrent();
      let scheduling: ReminderScheduleOutcome;
      try {
        scheduling = await deps.reschedule(next);
      } catch (error) {
        lease.assertCurrent();
        throw new NotificationPreferenceSaveError(next, error);
      }
      lease.assertCurrent();
      return { prefs: next, scheduling };
    };
    // Preference persistence and native convergence are one ordered intent.
    const pending = preferenceApplicationTail.then(execute, execute);
    preferenceApplicationTail = pending.then(() => undefined, () => undefined);
    return pending;
  };
  if (existingLease) return apply(existingLease);

  const expectedOwnerUserId = activeHealthProcessingOwnerUserId();
  if (!expectedOwnerUserId) throw new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED);
  return runHealthDataWriteOperation(expectedOwnerUserId, apply);
}

/** A saved failure retries current durable intent, never an older opt-in patch. */
export function notificationPreferenceRetryPatch(error: unknown, patch: Partial<NotifPrefs> = {}): Partial<NotifPrefs> {
  return error instanceof NotificationPreferenceSaveError ? {} : patch;
}
