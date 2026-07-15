import type { CustomerInfo } from 'react-native-purchases';

import { classifyRevenueCatEntitlement } from '@/lib/iap/revenuecat';

import type { SubscriptionState } from './entitlement';
import {
  acceptRevenueCatVerifiedEmpty,
  acceptTrustedRevenueCatEntitlement,
  type EntitlementAcceptance,
} from './store';

type RevenueCatClassification = ReturnType<typeof classifyRevenueCatEntitlement>;

export type ApplyRefreshedCustomerInfoInput = Readonly<{
  customerInfo: CustomerInfo;
  configuredAppUserId: string;
  assertCurrentOwner: () => void;
  publishAcceptance: (acceptance: EntitlementAcceptance) => SubscriptionState;
  publishVerificationFailure: () => SubscriptionState;
  onPublished?: (state: SubscriptionState) => void;
  classify?: (customerInfo: CustomerInfo, appUserId: string) => RevenueCatClassification;
  acceptEntitlement?: typeof acceptTrustedRevenueCatEntitlement;
  acceptEmpty?: typeof acceptRevenueCatVerifiedEmpty;
}>;

/** Reclassify a freshly invalidated CustomerInfo response without loading offerings. */
export async function applyRefreshedCustomerInfo(
  input: ApplyRefreshedCustomerInfoInput,
): Promise<'trusted' | 'untrusted' | 'no_evidence'> {
  const classified = (input.classify ?? classifyRevenueCatEntitlement)(
    input.customerInfo,
    input.configuredAppUserId,
  );
  input.assertCurrentOwner();
  if (classified.status === 'untrusted') {
    input.publishVerificationFailure();
    input.assertCurrentOwner();
    return 'untrusted';
  }

  let acceptance: EntitlementAcceptance;
  if (classified.entitlement) {
    acceptance = await (input.acceptEntitlement ?? acceptTrustedRevenueCatEntitlement)(
      classified.entitlement,
    );
  } else if (classified.emptyEvidence) {
    acceptance = await (input.acceptEmpty ?? acceptRevenueCatVerifiedEmpty)(
      classified.emptyEvidence,
    );
  } else {
    return 'no_evidence';
  }
  input.assertCurrentOwner();
  const published = input.publishAcceptance(acceptance);
  input.assertCurrentOwner();
  input.onPublished?.(published);
  input.assertCurrentOwner();
  return 'trusted';
}
