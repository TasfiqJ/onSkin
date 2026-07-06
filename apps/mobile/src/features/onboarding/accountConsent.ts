import { recordConsent } from '@/lib/consent/consent';

import { ACCOUNT_CONSENT } from './consentCopy';

export async function recordAccountConsent(): Promise<void> {
  await recordConsent({
    type: 'account',
    granted: true,
    version: ACCOUNT_CONSENT.version,
    consentText: ACCOUNT_CONSENT.fullText,
  });
}
