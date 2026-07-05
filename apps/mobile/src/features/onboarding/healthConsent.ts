import { recordConsent } from '@/lib/consent/consent';

import { HEALTH_DATA_CONSENT } from './consentCopy';

type RecordConsent = typeof recordConsent;

type HealthConsentDeps = {
  recordConsent: RecordConsent;
};

const defaultDeps: HealthConsentDeps = { recordConsent };

export async function grantHealthDataCollectionConsent(
  deps: HealthConsentDeps = defaultDeps,
): Promise<void> {
  await deps.recordConsent({
    type: 'health_data_collection',
    granted: true,
    version: HEALTH_DATA_CONSENT.version,
    consentText: HEALTH_DATA_CONSENT.fullText,
  });
}

export async function declineHealthDataCollectionConsent(
  deps: HealthConsentDeps = defaultDeps,
): Promise<void> {
  await deps.recordConsent({
    type: 'health_data_collection',
    granted: false,
    version: HEALTH_DATA_CONSENT.version,
    consentText: HEALTH_DATA_CONSENT.declineText,
  });
}
