import type { PlanId } from '@layerwell/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { env } from '@/lib/env';
import { advanceSubscriptionState, canFinishEmptyRestore, stateFromEntitlementSnapshot, stateWithoutServerEvidence } from './clientEntitlement';

import { cancelTrialReminder, scheduleTrialReminder } from '@/features/notifications/deliver';
import { track } from '@/lib/analytics/track';
import { useAuth } from '@/lib/auth/AuthProvider';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
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
import { e2eEntitlementDelayMs, e2eEntitlementState } from './entitlementE2EFixture';
import { prepareRevenueCatActionProof } from './entitlementPurchaseAttribution';

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

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type PersistedRevenueCatResult = Readonly<{
  entitlement: StoredEntitlement | null;
  storeActive: boolean;
  providerResultPersisted: boolean;
  verifiedEmptyRestore: boolean;
}>;

async function persistRevenueCatResult(
  input: {
    customerInfo?: Parameters<typeof customerInfoToStoredEntitlement>[0];
    productId?: string;
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
    const proof = entitlement ? prepareRevenueCatActionProof(entitlement, input) : null;
    const withAttribution = proof?.entitlement ?? null;
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

    const providerResultPersisted = proof?.actionProductMatched === true && isDurablyAdmissibleStoreResult(
      input.customerInfo!.entitlements.verification,
      published,
    );
    return {
      entitlement: published.snapshot?.entitlement ?? null,
      storeActive: providerResultPersisted,
      providerResultPersisted,
      verifiedEmptyRestore: canFinishEmptyRestore(
        input.customerInfo!.entitlements.verification,
        entitlement?.isActive === true,
        published,
      ),
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

export function useEntitlement(options?: { refetchOnMount?: 'always' }) {
  const { user } = useAuth();
  const owner = useEntitlementOwnerContext(user?.id ?? null);
  const ownerContext = owner.status === 'ready' ? owner.context : null;
  const queryKey = entitlementQueryKey(ownerContext?.ownerBinding ?? UNRESOLVED_OWNER_BINDING);
  const query = useQuery<SubscriptionState>({
    queryKey,
    retry: 0,
    enabled: owner.status !== 'resolving',
    refetchOnMount: options?.refetchOnMount,
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
          return stateWithoutServerEvidence({
            local, localStatus: localRead.status, serverStatus: server.status,
            nowISO: new Date().toISOString(), development: env.appEnvironment === 'development',
          });
        }

        const merged = await mergeEntitlementEvidenceBatch(ownerContext, server.evidence);
        lease.assertCurrent();
        if (merged.snapshot) {
          return stateFromEntitlementSnapshot(merged.snapshot);
        }
        if (local) return stateFromEntitlementSnapshot(local);
        throw new Error(merged.reason ?? ENTITLEMENT_EVIDENCE_COMMIT_BLOCKED);
      }),
  });
  const [observedNow, setObservedNow] = useState(Date.now);
  const { refetch } = query;
  const expiry = query.data?.expiresAt ?? null;
  useEffect(() => {
    const tick = () => setObservedNow((previous) => Math.max(previous, Date.now()));
    const interval = setInterval(tick, 60_000);
    const endsAt = expiry === null ? NaN : Date.parse(expiry);
    const delay = endsAt - Math.max(observedNow, Date.now());
    const timer = Number.isFinite(delay) && delay > 0 && delay <= 2_147_483_647
      ? setTimeout(() => {
          setObservedNow((previous) => Math.max(previous, endsAt, Date.now()));
          if (owner.status === 'ready' && ownerContext) void refetch();
        }, delay)
      : null;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') { tick(); if (owner.status === 'ready' && ownerContext) void refetch(); }
    });
    return () => {
      clearInterval(interval);
      if (timer !== null) clearTimeout(timer);
      subscription.remove();
    };
  }, [expiry, observedNow, refetch, owner.status, ownerContext]);
  return { ...query, data: query.data ? advanceSubscriptionState(query.data, observedNow) : query.data };
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
      stateFromEntitlementSnapshot(read.snapshot),
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

  const purchasePlan = useMutation({
    mutationFn: async (plan: PlanId) => {
      const ownerUserId = user?.id;
      return runOwnedStoreTransaction({
        action: 'purchase',
        ownerUserId,
        operation: async (nativeCall) => {
          const ownerContext = await entitlementOwnerContextForUser(ownerUserId!);
          const result = await purchasePackage(plan, ownerUserId!, nativeCall);
          const persisted = await persistRevenueCatResult(result, ownerContext, qc);
          if (!persisted) {
            if (result.cancelled) nativeCall.markDefinitiveCancellation();
            return activeResult(null, { cancelled: result.cancelled });
          }
          if (persisted.storeActive && persisted.entitlement?.periodType === 'trial') {
            track('trial_started', {
              source: 'revenuecat',
              period_type: persisted.entitlement.periodType,
            });
          } else if (persisted.storeActive) {
            track('purchase_completed', {
              source: 'revenuecat',
              period_type: persisted.entitlement?.periodType ?? null,
            });
          }
          nativeCall.markProviderResultPersisted(persisted.providerResultPersisted);
          return activeResult(persisted.entitlement, { cancelled: result.cancelled });
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
          if (persisted?.providerResultPersisted) {
            nativeCall.markProviderResultPersisted(true);
          } else if (persisted?.verifiedEmptyRestore) {
            nativeCall.markProviderResultPersisted(false);
          }
          // Unconfirmed outcomes intentionally leave resolution to the journal.
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

  return { startReverseTrial, startTrial, purchase, purchasePlan, restore, downgrade, winback };
}
