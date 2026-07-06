import { recordConsent } from '@/lib/consent/consent';

import { HEALTH_DATA_CONSENT } from './consentCopy';
import { setHealthDataCollectionConsentLocal } from './healthConsentStore';

type RecordConsent = typeof recordConsent;

type HealthConsentDeps = {
  recordConsent: RecordConsent;
};

const defaultDeps: HealthConsentDeps = { recordConsent };

export async function grantHealthDataCollectionConsent(
  deps: HealthConsentDeps = defaultDeps,
): Promise<void> {
  await setHealthDataCollectionConsentLocal({
    granted: true,
    version: HEALTH_DATA_CONSENT.version,
    consentText: HEALTH_DATA_CONSENT.fullText,
  });
  try {
    await deps.recordConsent({
      type: 'health_data_collection',
      granted: true,
      version: HEALTH_DATA_CONSENT.version,
      consentText: HEALTH_DATA_CONSENT.fullText,
    });
  } catch {
    /* offline / no anonymous session. Keep the local-first consent proof. */
  }
}

export async function declineHealthDataCollectionConsent(
  deps: HealthConsentDeps = defaultDeps,
): Promise<void> {
  await setHealthDataCollectionConsentLocal({
    granted: false,
    version: HEALTH_DATA_CONSENT.version,
    consentText: HEALTH_DATA_CONSENT.declineText,
  });
  try {
    await deps.recordConsent({
      type: 'health_data_collection',
      granted: false,
      version: HEALTH_DATA_CONSENT.version,
      consentText: HEALTH_DATA_CONSENT.declineText,
    });
  } catch {
    /* Declines are recorded locally first; ledger decline is best-effort pre-account. */
  }
}
