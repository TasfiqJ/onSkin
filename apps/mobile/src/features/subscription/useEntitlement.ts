import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { cancelTrialReminder, scheduleTrialReminder } from '@/features/notifications/deliver';
import { track } from '@/lib/analytics/track';
import { useAuth } from '@/lib/auth/AuthProvider';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { env } from '@/lib/env';
import {
  assertRevenueCatResultCurrent,
  customerInfoToStoredEntitlement,
  purchasePackage,
  purchaseWinBackPackage,
  restorePurchases,
  runRevenueCatResultWrite,
} from '@/lib/iap/revenuecat';
import { runOwnedStoreTransaction } from '@/lib/iap/storeTransactionNotice';

import {
  deriveState,
  entitlementQueryKey,
  type EntitlementOwnerContext,
  type StoredEntitlement,
  type SubscriptionState,
} from './entitlement';
import {
  ENTITLEMENT_EVIDENCE_COMMIT_BLOCKED,
  downgradeToFree,
  entitlementOwnerContextForUser,
  fetchServerEvidence,
  isDurablyAdmissibleStoreResult,
  mergeEntitlementEvidenceBatch,
  publishCustomerInfoEvidence,
  readEntitlementSnapshot,
  startReverseTrialOnServer,
} from './store';

const MAX_E2E_ENTITLEMENT_DELAY_MS = 3_000;
const UNRESOLVED_OWNER_BINDING = '0'.repeat(64);

export type EntitlementActionResult = {
  active: boolean;
  cancelled?: boolean;
  offerUnavailable?: boolean;
  entitlement: StoredEntitlement | null;
};

function activeResult(
  entitlement: StoredEntitlement | null,
  extras?: Omit<EntitlementActionResult, 'active' | 'entitlement'>,
): EntitlementActionResult {
  const active = entitlement ? deriveState(entitlement, new Date().toISOString()).isPro : false;
  return { active, entitlement, ...extras };
}

function e2eEntitlementDelayMs(): number {
  if (env.appEnvironment !== 'development') return 0;

  const raw = process.env.EXPO_PUBLIC_E2E_ENTITLEMENT_DELAY_MS;
  if (!raw) return 0;

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(Math.round(value), MAX_E2E_ENTITLEMENT_DELAY_MS);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function e2eEntitlementState(): SubscriptionState | null {
  if (env.appEnvironment !== 'development') return null;

  const fixture = process.env.EXPO_PUBLIC_E2E_ENTITLEMENT;
  if (
    fixture !== 'pro' &&
    fixture !== 'store_pro' &&
    fixture !== 'expired_store' &&
    fixture !== 'expired_reverse_trial'
  )
    return null;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const expiredAt = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  if (fixture === 'store_pro') {
    return deriveState(
      {
        tier: 'pro',
        isActive: true,
        periodType: 'normal',
        store: 'app_store',
        productId: 'routinekind_pro_annual_dev',
        expiresAt,
        willRenew: true,
        grantedAt: now.toISOString(),
        source: 'revenuecat',
        environment: 'sandbox',
        managementUrl: 'https://apps.apple.com/account/subscriptions',
        verifiedAt: now.toISOString(),
        offeringId: 'local_store_fixture',
        packageId: 'annual',
        storeUserId: 'e2e-store-user',
        priceLabel: '$49.99/year',
      },
      now.toISOString(),
    );
  }
  if (fixture === 'expired_store') {
    return deriveState(
      {
        tier: 'pro',
        isActive: true,
        periodType: 'normal',
        store: 'app_store',
        productId: 'routinekind_pro_annual_dev',
        expiresAt: expiredAt,
        willRenew: false,
        grantedAt: new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000).toISOString(),
        source: 'revenuecat',
        environment: 'sandbox',
        managementUrl: 'https://apps.apple.com/account/subscriptions',
        verifiedAt: now.toISOString(),
        offeringId: 'local_store_fixture',
        packageId: 'annual',
        storeUserId: 'e2e-expired-store-user',
        priceLabel: '$49.99/year',
      },
      now.toISOString(),
    );
  }
  if (fixture === 'expired_reverse_trial') {
    return deriveState(
      {
        tier: 'pro',
        isActive: true,
        periodType: 'reverse_trial',
        store: 'app_granted',
        productId: null,
        expiresAt: expiredAt,
        willRenew: false,
        grantedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        source: 'app_granted',
        environment: 'development',
        managementUrl: null,
        verifiedAt: now.toISOString(),
        offeringId: null,
        packageId: null,
        storeUserId: null,
        priceLabel: null,
      },
      now.toISOString(),
    );
  }

  return deriveState(
    {
      tier: 'pro',
      isActive: true,
      periodType: 'reverse_trial',
      store: 'app_granted',
      productId: null,
      expiresAt,
      willRenew: false,
      grantedAt: now.toISOString(),
      source: 'app_granted',
      environment: 'development',
      managementUrl: null,
      verifiedAt: now.toISOString(),
      offeringId: null,
      packageId: null,
      storeUserId: null,
      priceLabel: null,
    },
    now.toISOString(),
  );
}

type PersistedRevenueCatResult = Readonly<{
  entitlement: StoredEntitlement | null;
  storeActive: boolean;
  providerResultPersisted: boolean;
}>;

async function persistRevenueCatResult(
  input: {
    customerInfo?: Parameters<typeof customerInfoToStoredEntitlement>[0];
    packageId?: string;
    offeringId?: string;
    priceLabel?: string;
  },
  ownerContext: EntitlementOwnerContext,
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<PersistedRevenueCatResult | null> {
  assertRevenueCatResultCurrent(input);
  if (!input.customerInfo) return null;
  return runRevenueCatResultWrite(input, async () => {
    assertRevenueCatResultCurrent(input);
    const entitlement = customerInfoToStoredEntitlement(input.customerInfo!);
    const withAttribution: StoredEntitlement | null = entitlement
      ? {
          ...entitlement,
          packageId: input.packageId ?? entitlement.packageId ?? null,
          offeringId: input.offeringId ?? entitlement.offeringId ?? null,
          priceLabel: input.priceLabel ?? entitlement.priceLabel ?? null,
        }
      : null;
    const published = await publishCustomerInfoEvidence({
      context: ownerContext,
      customerInfo: input.customerInfo!,
      entitlement: withAttribution,
      queryClient,
    });
    assertRevenueCatResultCurrent(input);
    if (published.status === 'blocked') {
      throw new Error(published.reason ?? ENTITLEMENT_EVIDENCE_COMMIT_BLOCKED);
    }
    if (published.status === 'rejected') {
      throw new Error(`ENTITLEMENT_EVIDENCE_REJECTED:${published.reason}`);
    }
    if (published.status === 'conflict') {
      throw new Error('ENTITLEMENT_EVIDENCE_CONFLICT');
    }

    const committed = published.snapshot?.activeStoreEntitlement ?? null;

    if (committed?.isActive && committed.periodType === 'trial') {
      await scheduleTrialReminder();
      assertRevenueCatResultCurrent(input);
    } else if (committed?.isActive) {
      await cancelTrialReminder();
      assertRevenueCatResultCurrent(input);
    }

    const providerResultPersisted = isDurablyAdmissibleStoreResult(
      input.customerInfo!.entitlements.verification,
      published,
    );
    return {
      entitlement: published.snapshot?.entitlement ?? null,
      storeActive: committed?.isActive === true,
      providerResultPersisted,
    };
  });
}

type OwnerContextResolution =
  | Readonly<{ userId: string | null; status: 'resolving'; context: null; error: null }>
  | Readonly<{
      userId: string | null;
      status: 'ready';
      context: EntitlementOwnerContext | null;
      error: null;
    }>
  | Readonly<{ userId: string; status: 'error'; context: null; error: Error }>;

function useEntitlementOwnerContext(userId: string | null): OwnerContextResolution {
  const [resolution, setResolution] = useState<OwnerContextResolution>({
    userId,
    status: userId ? 'resolving' : 'ready',
    context: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      return () => {
        cancelled = true;
      };
    }
    void entitlementOwnerContextForUser(userId).then(
      (context) => {
        if (!cancelled) setResolution({ userId, status: 'ready', context, error: null });
      },
      (error: unknown) => {
        if (!cancelled) {
          setResolution({
            userId,
            status: 'error',
            context: null,
            error: error instanceof Error ? error : new Error('ENTITLEMENT_OWNER_CONTEXT_FAILED'),
          });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return resolution.userId === userId
    ? resolution
    : { userId, status: userId ? 'resolving' : 'ready', context: null, error: null };
}

export function useEntitlement() {
  const { user } = useAuth();
  const owner = useEntitlementOwnerContext(user?.id ?? null);
  const ownerContext = owner.status === 'ready' ? owner.context : null;
  const queryKey = entitlementQueryKey(ownerContext?.ownerBinding ?? UNRESOLVED_OWNER_BINDING);
  return useQuery<SubscriptionState>({
    queryKey,
    retry: 0,
    enabled: owner.status !== 'resolving',
    queryFn: () =>
      runAccountGenerationOperation(async (lease) => {
        const e2eDelay = e2eEntitlementDelayMs();
        if (e2eDelay > 0) await wait(e2eDelay);
        lease.assertCurrent();

        const e2e = e2eEntitlementState();
        if (e2e) return e2e;

        if (owner.status === 'error') throw owner.error;
        if (!ownerContext) return deriveState(null, new Date().toISOString());

        const localRead = await readEntitlementSnapshot(ownerContext);
        lease.assertCurrent();
        const local = localRead.status === 'available' ? localRead.snapshot : null;
        const server = await fetchServerEvidence(ownerContext, lease.signal);
        lease.assertCurrent();
        if (server.status !== 'evidence') {
          if (local) return deriveState(local.entitlement, local.effectiveNowISO);
          if (localRead.status === 'absent' || localRead.status === 'legacy_unbound') {
            return deriveState(null, new Date().toISOString());
          }
          throw new Error(`ENTITLEMENT_CACHE_READ_${localRead.status.toUpperCase()}`);
        }

        const merged = await mergeEntitlementEvidenceBatch(ownerContext, server.evidence);
        lease.assertCurrent();
        if (merged.snapshot) {
          return deriveState(merged.snapshot.entitlement, merged.snapshot.effectiveNowISO);
        }
        if (local) return deriveState(local.entitlement, local.effectiveNowISO);
        throw new Error(merged.reason ?? ENTITLEMENT_EVIDENCE_COMMIT_BLOCKED);
      }),
  });
}

export function useEntitlementActions() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const invalidate = async () => {
    if (!user?.id) return;
    try {
      const context = await entitlementOwnerContextForUser(user.id);
      await qc.invalidateQueries({
        queryKey: entitlementQueryKey(context.ownerBinding),
        exact: true,
      });
    } catch {
      // A boundary in progress must not target another owner's query.
    }
  };

  const publishCurrentSnapshot = async (ownerUserId: string): Promise<StoredEntitlement | null> => {
    const context = await entitlementOwnerContextForUser(ownerUserId);
    const read = await readEntitlementSnapshot(context);
    if (read.status !== 'available') return null;
    qc.setQueryData(
      entitlementQueryKey(context.ownerBinding),
      deriveState(read.snapshot.entitlement, read.snapshot.effectiveNowISO),
    );
    return read.snapshot.entitlement;
  };

  const startReverseTrial = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('ENTITLEMENT_OWNER_USER_ID_REQUIRED');
      const entitlement = await startReverseTrialOnServer();
      track('reverse_trial_started', { source: entitlement.source ?? 'server' });
      return activeResult((await publishCurrentSnapshot(user.id)) ?? entitlement);
    },
    onSettled: invalidate,
  });

  const startTrial = useMutation({
    mutationFn: async () => {
      const ownerUserId = user?.id;
      return runOwnedStoreTransaction({
        action: 'purchase',
        ownerUserId,
        operation: async (nativeCall) => {
          const ownerContext = await entitlementOwnerContextForUser(ownerUserId!);
          const result = await purchasePackage('annual', ownerUserId!, nativeCall);
          const persisted = await persistRevenueCatResult(result, ownerContext, qc);
          const entitlement = persisted?.entitlement ?? null;
          if (!persisted) {
            if (result.cancelled) nativeCall.markDefinitiveCancellation();
            return activeResult(null, { cancelled: result.cancelled });
          }

          if (persisted.storeActive && entitlement?.periodType === 'trial') {
            track('trial_started', {
              source: 'revenuecat',
              period_type: entitlement.periodType,
            });
          } else if (persisted.storeActive) {
            track('purchase_completed', {
              source: 'revenuecat',
              period_type: entitlement?.periodType ?? null,
            });
          }
          nativeCall.markProviderResultPersisted(persisted.providerResultPersisted);
          return activeResult(entitlement, { cancelled: result.cancelled });
        },
      });
    },
    onSettled: invalidate,
  });

  const purchase = useMutation({
    mutationFn: async () => {
      const ownerUserId = user?.id;
      return runOwnedStoreTransaction({
        action: 'purchase',
        ownerUserId,
        operation: async (nativeCall) => {
          const ownerContext = await entitlementOwnerContextForUser(ownerUserId!);
          const result = await purchasePackage('annual', ownerUserId!, nativeCall);
          const persisted = await persistRevenueCatResult(result, ownerContext, qc);
          const entitlement = persisted?.entitlement ?? null;
          if (persisted?.storeActive) {
            track('purchase_completed', {
              source: 'revenuecat',
              period_type: entitlement?.periodType ?? null,
            });
          }
          if (result.cancelled) nativeCall.markDefinitiveCancellation();
          else if (persisted) {
            nativeCall.markProviderResultPersisted(persisted.providerResultPersisted);
          }
          return activeResult(entitlement, { cancelled: result.cancelled });
        },
      });
    },
    onSettled: invalidate,
  });

  const restore = useMutation({
    mutationFn: async () => {
      const ownerUserId = user?.id;
      return runOwnedStoreTransaction({
        action: 'restore',
        ownerUserId,
        operation: async (nativeCall) => {
          const ownerContext = await entitlementOwnerContextForUser(ownerUserId!);
          track('restore_tapped');
          const result = await restorePurchases(ownerUserId!, nativeCall);
          const persisted = await persistRevenueCatResult(result, ownerContext, qc);
          if (persisted) {
            nativeCall.markProviderResultPersisted(persisted.providerResultPersisted);
          }
          return activeResult(persisted?.entitlement ?? null);
        },
      });
    },
    onSettled: invalidate,
  });

  const downgrade = useMutation({
    mutationFn: async () => {
      await downgradeToFree();
      track('reverse_trial_expired');
      if (!user?.id) return activeResult(null);
      return activeResult(await publishCurrentSnapshot(user.id));
    },
    onSettled: invalidate,
  });

  const winback = useMutation({
    mutationFn: async () => {
      const ownerUserId = user?.id;
      return runOwnedStoreTransaction({
        action: 'purchase',
        ownerUserId,
        operation: async (nativeCall) => {
          const ownerContext = await entitlementOwnerContextForUser(ownerUserId!);
          const result = await purchaseWinBackPackage(ownerUserId!, nativeCall);
          const persisted = await persistRevenueCatResult(result, ownerContext, qc);
          const entitlement = persisted?.entitlement ?? null;
          if (persisted?.storeActive) {
            track('winback_converted', {
              source: 'revenuecat',
              period_type: entitlement?.periodType ?? null,
            });
          }
          if (result.cancelled) nativeCall.markDefinitiveCancellation();
          else if (persisted) {
            nativeCall.markProviderResultPersisted(persisted.providerResultPersisted);
          }
          return activeResult(entitlement, {
            cancelled: result.cancelled,
            offerUnavailable: result.offerUnavailable,
          });
        },
      });
    },
    onSettled: invalidate,
  });

  return { startReverseTrial, startTrial, purchase, restore, downgrade, winback };
}
