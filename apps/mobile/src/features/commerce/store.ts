import { removePrivateItem } from '@/lib/storage/privateKV';

import type { ClickPayload } from './attribution';
import { COMMERCE_ADMISSION_CLOSED } from './admission';

// COM-01A keeps the legacy key only for explicit cleanup. Reads cannot issue
// authority, positive writes fail before storage, and click persistence is closed.

const CONSENT_KEY = 'layerwell.commerceConsent.v1';

export async function getCommerceConsentLocal(): Promise<boolean> {
  return false;
}

export async function setCommerceConsentLocal(granted: boolean): Promise<void> {
  if (granted) throw new Error(COMMERCE_ADMISSION_CLOSED);
  await clearCommerceState();
}

/** Click persistence has no issuer while commerce admission is closed. */
export async function recordClick(_payload: ClickPayload): Promise<never> {
  throw new Error(COMMERCE_ADMISSION_CLOSED);
}

/** Test/seed reset. */
export async function clearCommerceState(): Promise<void> {
  await removePrivateItem(CONSENT_KEY);
}
