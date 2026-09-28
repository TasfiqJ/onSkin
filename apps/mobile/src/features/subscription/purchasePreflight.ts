import { getNetworkStateAsync } from 'expo-network';

import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { env } from '@/lib/env';

import { stateFromEntitlementSnapshot } from './clientEntitlement';
import { subscriptionNetworkAvailable, subscriptionPoliciesConfigured } from './clientPolicy';
import { isEntitlementEvidenceUncertain } from './entitlement';
import {
  entitlementOwnerContextForUser,
  fetchServerEvidence,
  mergeEntitlementEvidenceBatch,
  readEntitlementSnapshot,
} from './store';

/** This guard applies only to NEW purchases, never Restore or Manage. */
export async function assertSubscriptionCheckoutDependencies(): Promise<void> {
  if (!subscriptionPoliciesConfigured(env.termsUrl, env.privacyUrl)) {
    throw new Error('SUBSCRIPTION_POLICIES_UNAVAILABLE');
  }
  const network = await getNetworkStateAsync().catch(() => null);
  if (!network || !subscriptionNetworkAvailable(network)) {
    throw new Error('SUBSCRIPTION_NETWORK_REQUIRED');
  }
}

/** Use the existing owner/authority machinery, without changing its architecture. */
export async function assertStandardPurchaseReady(ownerUserId: string): Promise<void> {
  await assertSubscriptionCheckoutDependencies();
  return runAccountGenerationOperation(async (lease) => {
    const context = await entitlementOwnerContextForUser(ownerUserId);
    lease.assertCurrent();
    const server = await fetchServerEvidence(context, lease.signal);
    lease.assertCurrent();
    if (server.status !== 'evidence' && server.status !== 'absent') {
      throw new Error('SUBSCRIPTION_ACCESS_UNCONFIRMED');
    }
    const snapshot = server.status === 'evidence'
      ? (await mergeEntitlementEvidenceBatch(context, server.evidence)).snapshot
      : null;
    lease.assertCurrent();
    const local = snapshot ? null : await readEntitlementSnapshot(context);
    lease.assertCurrent();
    // A valid absent server projection cannot repair unreadable local purchase evidence.
    if (!snapshot && local?.status !== 'available' && local?.status !== 'absent') {
      throw new Error('SUBSCRIPTION_ACCESS_UNCONFIRMED');
    }
    if (server.status === 'evidence' && !snapshot) {
      throw new Error('SUBSCRIPTION_ACCESS_UNCONFIRMED');
    }
    const current = snapshot ?? (local?.status === 'available' ? local.snapshot : null);
    if (!current) return;
    if (current.hasConflict || current.requiresUncachedRefresh) {
      throw new Error('SUBSCRIPTION_ACCESS_UNCONFIRMED');
    }
    const state = stateFromEntitlementSnapshot(current);
    if (isEntitlementEvidenceUncertain(state)) {
      throw new Error('SUBSCRIPTION_ACCESS_UNCONFIRMED');
    }
    if (state.isPro) throw new Error('SUBSCRIPTION_ALREADY_ACTIVE');
  });
}
