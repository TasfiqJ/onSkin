import {
  refuseHealthDependentConsent,
  withdrawHealthDependentConsent,
} from '@/lib/consent/dependentConsentLifecycle';

import { COMMERCE_ADMISSION_CLOSED } from './admission';
import { clearCommerceState } from './store';

export { COMMERCE_ADMISSION_CLOSED } from './admission';

/** COM-01A: no stale ledger/local state can become positive commerce authority. */
export async function isCommerceConsented(): Promise<false> {
  return false;
}

/** Positive consent cannot be created until the live commerce rail is admitted. */
export async function grantCommerceConsent(): Promise<never> {
  throw new Error(COMMERCE_ADMISSION_CLOSED);
}

export async function declineCommerceConsent(): Promise<void> {
  await withdrawHealthDependentConsent({
    type: 'data_sharing',
    deleteLocal: clearCommerceState,
  });
}

/** Initial sheet refusal: confirm the authority is already off; record no revocation claim. */
export async function refuseCommerceConsent(): Promise<void> {
  await refuseHealthDependentConsent({
    type: 'data_sharing',
    deleteLocal: clearCommerceState,
  });
}
