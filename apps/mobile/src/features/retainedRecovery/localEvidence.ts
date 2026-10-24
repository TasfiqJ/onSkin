import { getAgeVerified } from '@/features/onboarding/ageGateStore';
import { hasCurrentHealthDataCollectionConsent } from '@/features/onboarding/healthConsentStore';
import { loadNotifPrefs } from '@/features/notifications/store';
import { getPhotoDeleteStatus } from '@/features/photos/store';
import { loadShelf } from '@/features/shelf/store';
import { getCompletedSteps } from '@/features/today/completionsStore';
import { localDateString } from '@/features/today/useToday';
import {
  assertHealthDataWriteLease,
  runHealthDataOperation,
  type HealthDataWriteLease,
  type HealthDataWriteOperationLease,
} from '@/lib/consent/healthDataWriteAdmission';

export const RECOVERY_DOMAINS = ['shelf', 'today', 'reminders', 'photoCleanup'] as const;
export type RecoveryDomain = typeof RECOVERY_DOMAINS[number];
export type LocalEvidence = Readonly<{
  status: 'saved' | 'needs_confirmation' | 'not_configured' | 'no_pending_cleanup' | 'unavailable';
  message: string;
}>;

export class LocalRecoveryAccessClosed extends Error {
  constructor() { super('LOCAL_RECOVERY_ACCESS_CLOSED'); }
}

async function assertLocalAccess(lease: HealthDataWriteOperationLease): Promise<void> {
  const [adult, consented] = await Promise.all([getAgeVerified(), hasCurrentHealthDataCollectionConsent()]);
  lease.assertCurrent();
  if (!adult || !consented) throw new LocalRecoveryAccessClosed();
}

/** Only existing local stores. Return descriptors, never private records,
 * product names, check-off identities, photo paths, notes or owner IDs. */
export async function readLocalRecoveryEvidence(
  domain: RecoveryDomain,
  day: string,
  accepted: HealthDataWriteLease,
): Promise<LocalEvidence> {
  assertHealthDataWriteLease(accepted);
  return runHealthDataOperation(accepted.ownerUserId, async lease => {
    assertHealthDataWriteLease(accepted);
    await assertLocalAccess(lease);
    if (day !== localDateString()) throw new Error('LOCAL_RECOVERY_DAY_CHANGED');
    let result: LocalEvidence;
    switch (domain) {
      case 'shelf': {
        const products = await loadShelf();
        result = products.length > 0
          ? { status: 'saved', message: 'Your Shelf records can be read on this device.' }
          : { status: 'not_configured', message: 'No products are recorded in this device’s Shelf.' };
        break;
      }
      case 'today': {
        const steps = await getCompletedSteps(day);
        result = steps.size > 0
          ? { status: 'saved', message: 'Check-offs for this local day can be read on this device.' }
          : { status: 'not_configured', message: 'No check-offs are recorded for this local day.' };
        break;
      }
      case 'reminders': {
        const prefs = await loadNotifPrefs({ strict: true });
        const enabled = prefs.amEnabled || prefs.pmEnabled || prefs.captureReminders || prefs.streakNudges || prefs.replenishmentAlerts || prefs.promotionalOptIn;
        result = enabled
          ? { status: 'needs_confirmation', message: 'Reminder choices are saved on this device. Check permission and scheduling in reminder settings; delivery is controlled by your device.' }
          : { status: 'not_configured', message: 'No reminder purpose is enabled in the device preferences. Scheduling and permission are not checked here.' };
        break;
      }
      case 'photoCleanup': {
        // This reads deletion obligations only. It neither opens a photo nor
        // retries deletion, and cannot bypass Progress entitlement/lock gates.
        const status = await getPhotoDeleteStatus();
        result = status.localPending > 0 || status.remotePending > 0 || status.needsAttention
          ? { status: 'needs_confirmation', message: status.localPending > 0
            ? 'Protected local photo cleanup is not finished. Review its existing retry in Progress.'
            : 'A photo deletion still needs confirmation. Review its existing retry in Progress.' }
          : { status: 'no_pending_cleanup', message: 'No outstanding deletion was found in the current local journal. Photo content is checked only in Progress.' };
        break;
      }
    }
    lease.assertCurrent();
    await assertLocalAccess(lease);
    assertHealthDataWriteLease(accepted);
    if (day !== localDateString()) throw new Error('LOCAL_RECOVERY_DAY_CHANGED');
    return result;
  });
}
