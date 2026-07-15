import {
  HEALTH_DATA_WRITE_ADMISSION_CLOSED,
  runHealthDataWriteOperation,
  type HealthDataWriteOperationLease,
} from '@/lib/consent/healthDataWriteAdmission';
import { activeHealthProcessingOwnerUserId } from '@/lib/consent/healthProcessingEpoch';

import type { NotifPrefs } from './store';

type ApplyNotificationPreferencePatchDeps = {
  save: (patch: Partial<NotifPrefs>) => Promise<NotifPrefs>;
  reschedule: (prefs: NotifPrefs) => Promise<void>;
};

export async function applyNotificationPreferencePatch(
  patch: Partial<NotifPrefs>,
  deps: ApplyNotificationPreferencePatchDeps,
  existingLease?: HealthDataWriteOperationLease,
): Promise<NotifPrefs> {
  const apply = async (lease: HealthDataWriteOperationLease) => {
    const next = await deps.save(patch);
    lease.assertCurrent();
    await deps.reschedule(next);
    lease.assertCurrent();
    return next;
  };
  if (existingLease) return apply(existingLease);

  const expectedOwnerUserId = activeHealthProcessingOwnerUserId();
  if (!expectedOwnerUserId) throw new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED);
  return runHealthDataWriteOperation(expectedOwnerUserId, apply);
}
