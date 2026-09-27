import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { track } from '@/lib/analytics/track';
import {
  awaitAccountGenerationLease,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { useAuth } from '@/lib/auth/AuthProvider';
import { env, isSupabaseConfigured } from '@/lib/env';
import {
  classifyRevenueCatEntitlement,
  purchasePackage,
  purchaseWinBackPackage,
  refreshCustomerInfo,
  restorePurchases,
  showNativeManageSubscriptions,
} from '@/lib/iap/revenuecat';
import {
  isOwnerQueryScopeCurrent,
  ownerQueryPrefixes,
  queryKeys,
  runOwnerQueryOperation,
} from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';

import { deriveState, type StoredEntitlement, type SubscriptionState } from './entitlement';
import {
  activeResult,
  publishedActionResult,
  type EntitlementActionResult,
} from './entitlementActionResult';
import {
  assertEntitlementActionAllowed,
  type EntitlementActionInput,
  type EntitlementActionKind,
} from './entitlementActionGuard';
import {
  advanceEntitlementStateAtBoundary,
  entitlementBoundaryScheduler,
  nextEntitlementTrustBoundary,
} from './entitlementBoundaryScheduler';
import {
  entitlementRevenueCatRefreshCoordinator,
  entitlementServerCoordinator,
  entitlementVerificationRetryCoordinator,
} from './entitlementCoordinator';
import { deferEntitlementTrialReminder } from './entitlementReminder';
import { applyRefreshedCustomerInfo } from './entitlementRevenueCatRefresh';
import { mintPurchaseSuccessReceipt } from './purchaseSuccessReceipt';
import { prepareRevenueCatActionProof } from './entitlementPurchaseAttribution';
import {
  entitlementQueryOptions,
  publishEntitlementQueryAcceptance,
  publishEntitlementVerificationFailure,
  loadEntitlementLocalSnapshot,
  selectEntitlementQueryState,
  type EntitlementLocalSnapshot,
} from './entitlementQuery';
import {
  acceptRevenueCatVerifiedEmpty,
  acceptTrustedRevenueCatEntitlement,
  downgradeToFree,
  fetchServerEntitlement,
  loadEntitlement,
  startReverseTrialOnServer,
  type EntitlementAcceptance,
} from './store';

const MAX_E2E_ENTITLEMENT_DELAY_MS = 3_000;

export type { EntitlementActionResult };
export type { EntitlementActionInput };

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
        productId: 'routinekind_pro_reverse_trial_local',
        expiresAt: expiredAt,
        willRenew: false,
        grantedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        source: 'app_granted',
        environment: 'development',
        managementUrl: null,
        verifiedAt: now.toISOString(),
        offeringId: 'local_reverse_trial',
        packageId: 'reverse_trial_7d',
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
      productId: 'routinekind_pro_reverse_trial_local',
      expiresAt,
      willRenew: false,
      grantedAt: now.toISOString(),
      source: 'app_granted',
      environment: 'development',
      managementUrl: null,
      verifiedAt: now.toISOString(),
      offeringId: 'local_reverse_trial',
      packageId: 'reverse_trial_7d',
      storeUserId: null,
      priceLabel: null,
    },
    now.toISOString(),
  );
}

type PersistedRevenueCatResult = Readonly<{
  actionEntitlement: StoredEntitlement | null;
  acceptedEntitlement: StoredEntitlement | null;
  publishedState: SubscriptionState;
  persisted: boolean;
  verificationPending: boolean;
}>;

type PaidStoreResult =
  | Awaited<ReturnType<typeof purchasePackage>>
  | Awaited<ReturnType<typeof purchaseWinBackPackage>>;

async function persistRevenueCatResult(
  input: {
    customerInfo?: Parameters<typeof classifyRevenueCatEntitlement>[0];
    productId?: string;
    packageId?: string;
    offeringId?: string;
    priceLabel?: string;
    purchasePriceLabel?: string;
    purchasePeriodLabel?: string;
    offerDurationLabel?: string;
    renewalPriceLabel?: string;
    renewalPeriodLabel?: string;
  },
  assertCurrentOwner: () => void,
  publishAcceptance: (acceptance: EntitlementAcceptance) => SubscriptionState,
  publishVerificationFailure: () => SubscriptionState,
  ownerScope: ReturnType<typeof useOwnerQueryScope>,
  configuredAppUserId: string,
): Promise<PersistedRevenueCatResult | null> {
  if (!input.customerInfo) return null;
  const classified = classifyRevenueCatEntitlement(input.customerInfo, configuredAppUserId);
  if (classified.status === 'untrusted') {
    assertCurrentOwner();
    const publishedState = publishVerificationFailure();
    return {
      actionEntitlement: null,
      acceptedEntitlement: null,
      publishedState,
      persisted: false,
      verificationPending: true,
    };
  }
  const entitlement = classified.entitlement;
  if (!entitlement) {
    assertCurrentOwner();
    if (!classified.emptyEvidence) return null;
    const acceptance = await acceptRevenueCatVerifiedEmpty(classified.emptyEvidence);
    assertCurrentOwner();
    const published = publishAcceptance(acceptance);
    assertCurrentOwner();
    deferEntitlementTrialReminder(ownerScope, published);
    assertCurrentOwner();
    return {
      actionEntitlement: null,
      acceptedEntitlement: acceptance.entitlement,
      publishedState: published,
      persisted: acceptance.persisted,
      verificationPending: !acceptance.persisted,
    };
  }

  const attributed = prepareRevenueCatActionProof(entitlement, input);
  const withAttribution = attributed.entitlement;
  assertCurrentOwner();
  const acceptance = await acceptTrustedRevenueCatEntitlement(withAttribution);
  assertCurrentOwner();
  const published = publishAcceptance(acceptance);
  assertCurrentOwner();
  deferEntitlementTrialReminder(ownerScope, published);
  assertCurrentOwner();
  const nowISO = new Date().toISOString();
  const actionIdentity = deriveState(withAttribution, nowISO).evidenceIdentity;
  const acceptedIdentity = acceptance.entitlement
    ? deriveState(acceptance.entitlement, nowISO).evidenceIdentity
    : null;
  return {
    actionEntitlement:
      attributed.actionProductMatched &&
      actionIdentity !== null &&
      actionIdentity === acceptedIdentity
        ? withAttribution
        : null,
    acceptedEntitlement: acceptance.entitlement,
    publishedState: published,
    persisted: acceptance.persisted,
    verificationPending: !acceptance.persisted || !attributed.actionProductMatched,
  };
}

export function useEntitlement(options: { enabled?: boolean } = {}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const ownerScope = useOwnerQueryScope();
  const query = useQuery(
    entitlementQueryOptions({
      ownerScope,
      enabled: options.enabled,
      loadLocal: async (lease): Promise<EntitlementLocalSnapshot> => {
        const e2eDelay = e2eEntitlementDelayMs();
        if (e2eDelay > 0) {
          await awaitAccountGenerationLease(lease, () => wait(e2eDelay));
        }

        const e2e = e2eEntitlementState();
        if (e2e) return { state: e2e, shouldReconcile: false };
        return loadEntitlementLocalSnapshot(lease, {
          expectedStoreUserId: user?.id,
        });
      },
      reconcile: () =>
        entitlementServerCoordinator.reconcile({
          ownerScope,
          fetchServer: fetchServerEntitlement,
          publish: (acceptance) => {
            const nowISO = new Date().toISOString();
            publishEntitlementQueryAcceptance(
              queryClient,
              ownerScope,
              acceptance,
              nowISO,
              env.appEnvironment,
            );
          },
        }),
      selectCurrentState: (incoming) =>
        selectEntitlementQueryState(
          queryClient.getQueryData<SubscriptionState>(queryKeys.entitlement(ownerScope)),
          incoming,
        ),
    }),
  );
  const verificationRetry = useMutation({
    mutationFn: () => {
      const appUserId = user?.id;
      return entitlementVerificationRetryCoordinator.retry({
        ownerScope,
        refreshLocal: async (lease) => {
          lease.assertCurrent();
          await query.refetch();
          lease.assertCurrent();
        },
        ...(appUserId
          ? {
              refreshRevenueCat: async (lease: AccountGenerationLease) => {
                lease.assertCurrent();
                await entitlementRevenueCatRefreshCoordinator.refresh({
                  ownerScope,
                  refresh: async (refreshLease) => {
                    const customerInfo = await refreshCustomerInfo({
                      appUserId,
                      lease: refreshLease,
                    });
                    refreshLease.assertCurrent();
                    if (!customerInfo) return;
                    await applyRefreshedCustomerInfo({
                      customerInfo,
                      configuredAppUserId: appUserId,
                      assertCurrentOwner: refreshLease.assertCurrent,
                      publishAcceptance: (acceptance) => {
                        refreshLease.assertCurrent();
                        if (!isOwnerQueryScopeCurrent(ownerScope)) {
                          throw new Error('ENTITLEMENT_OWNER_STALE');
                        }
                        return publishEntitlementQueryAcceptance(
                          queryClient,
                          ownerScope,
                          acceptance,
                          new Date().toISOString(),
                          env.appEnvironment,
                        );
                      },
                      publishVerificationFailure: () => {
                        refreshLease.assertCurrent();
                        if (!isOwnerQueryScopeCurrent(ownerScope)) {
                          throw new Error('ENTITLEMENT_OWNER_STALE');
                        }
                        return publishEntitlementVerificationFailure(
                          queryClient,
                          ownerScope,
                          new Date().toISOString(),
                        );
                      },
                      onPublished: (published) => {
                        deferEntitlementTrialReminder(ownerScope, published);
                      },
                    });
                    refreshLease.assertCurrent();
                  },
                });
                lease.assertCurrent();
              },
            }
          : {}),
        reconcileServer: async (lease) => {
          lease.assertCurrent();
          await entitlementServerCoordinator.reconcile({
            ownerScope,
            fetchServer: fetchServerEntitlement,
            publish: (acceptance) => {
              lease.assertCurrent();
              if (!isOwnerQueryScopeCurrent(ownerScope)) {
                throw new Error('ENTITLEMENT_OWNER_STALE');
              }
              publishEntitlementQueryAcceptance(
                queryClient,
                ownerScope,
                acceptance,
                new Date().toISOString(),
                env.appEnvironment,
              );
            },
            force: true,
          });
          lease.assertCurrent();
        },
      });
    },
    retry: 0,
  });
  useEffect(() => {
    if (!query.data || !isOwnerQueryScopeCurrent(ownerScope)) return;
    const nowMs = Date.now();
    let advancedRawCache = false;
    queryClient.setQueryData<SubscriptionState>(queryKeys.entitlement(ownerScope), (current) => {
      if (!current) return current;
      const advanced = advanceEntitlementStateAtBoundary(current, nowMs);
      advancedRawCache = advanced !== current;
      return advanced;
    });
    if (advancedRawCache) {
      void queryClient.invalidateQueries({
        queryKey: ownerQueryPrefixes.entitlement(ownerScope),
      });
      return;
    }
    const boundaryMs = nextEntitlementTrustBoundary(query.data, nowMs);
    if (boundaryMs === null) return;
    return entitlementBoundaryScheduler.subscribe(
      `entitlement:${ownerScope.generation}`,
      boundaryMs,
      (event) => {
        if (!isOwnerQueryScopeCurrent(ownerScope)) return;
        queryClient.setQueryData<SubscriptionState>(queryKeys.entitlement(ownerScope), (current) =>
          current ? advanceEntitlementStateAtBoundary(current, Date.now(), event) : current,
        );
        void queryClient.invalidateQueries({
          queryKey: ownerQueryPrefixes.entitlement(ownerScope),
        });
      },
    );
  }, [ownerScope, query.data, queryClient]);
  return {
    ...query,
    isVerificationRetrying: verificationRetry.isPending,
    retryVerification: () => verificationRetry.mutateAsync(),
  };
}

export function useEntitlementActions() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const ownerScope = useOwnerQueryScope();
  const publishAcceptance = (acceptance: EntitlementAcceptance) => {
    if (!isOwnerQueryScopeCurrent(ownerScope)) throw new Error('ENTITLEMENT_OWNER_STALE');
    return publishEntitlementQueryAcceptance(
      qc,
      ownerScope,
      acceptance,
      new Date().toISOString(),
      env.appEnvironment,
    );
  };
  const publishVerificationFailure = () => {
    if (!isOwnerQueryScopeCurrent(ownerScope)) throw new Error('ENTITLEMENT_OWNER_STALE');
    return publishEntitlementVerificationFailure(qc, ownerScope, new Date().toISOString());
  };
  const revenueCatOwner = (lease: AccountGenerationLease) => {
    if (!user?.id) throw new Error('REVENUECAT_OWNER_REQUIRED');
    return { appUserId: user.id, lease } as const;
  };
  const reverseTrialStoreUserId = () => {
    if (user?.id) return user.id;
    if (env.appEnvironment === 'development' && !isSupabaseConfigured) return undefined;
    throw new Error('REVENUECAT_OWNER_REQUIRED');
  };
  const assertActionAtCommit = (
    lease: AccountGenerationLease,
    input: EntitlementActionInput,
    allowedKinds: readonly EntitlementActionKind[],
  ): SubscriptionState => {
    lease.assertCurrent();
    if (input.kind === 'reverse_trial' || input.kind === 'winback_purchase') {
      throw new Error('DEFERRED_SUBSCRIPTION_ACTION');
    }
    if (!isOwnerQueryScopeCurrent(ownerScope)) throw new Error('ENTITLEMENT_OWNER_STALE');
    const key = queryKeys.entitlement(ownerScope);
    const current = qc.getQueryData<SubscriptionState>(key);
    const advanced = current ? advanceEntitlementStateAtBoundary(current, Date.now()) : current;
    if (advanced && advanced !== current) qc.setQueryData(key, advanced);
    assertEntitlementActionAllowed(advanced, input, allowedKinds, user?.id);
    return advanced;
  };
  const invalidate = () => {
    if (!isOwnerQueryScopeCurrent(ownerScope)) return;
    try {
      void qc
        .invalidateQueries({ queryKey: ownerQueryPrefixes.entitlement(ownerScope) })
        .catch(() => undefined);
    } catch {
      // Mutation settlement is independent of a background refetch.
    }
  };
  const reconcileInBackground = () => {
    void entitlementServerCoordinator
      .reconcile({
        ownerScope,
        fetchServer: fetchServerEntitlement,
        publish: (acceptance) => {
          publishAcceptance(acceptance);
        },
      })
      .catch(() => undefined);
  };
  const finishPaidAction = async (
    lease: AccountGenerationLease,
    result: PaidStoreResult,
    action: 'purchase' | 'winback',
  ): Promise<EntitlementActionResult> => {
    lease.assertCurrent();
    if (result.cancelled) return activeResult(null, { cancelled: true });
    if (result.pending) {
      reconcileInBackground();
      return activeResult(null, { pending: true });
    }
    if (result.purchaseMayHaveCompleted && !result.customerInfo) {
      reconcileInBackground();
      return activeResult(null, {
        verificationPending: true,
        purchaseMayHaveCompleted: true,
      });
    }

    let persisted: PersistedRevenueCatResult | null;
    try {
      persisted = await persistRevenueCatResult(
        result,
        lease.assertCurrent,
        publishAcceptance,
        publishVerificationFailure,
        ownerScope,
        revenueCatOwner(lease).appUserId,
      );
    } catch {
      if (result.customerInfo) {
        reconcileInBackground();
        return activeResult(null, {
          verificationPending: true,
          purchaseMayHaveCompleted: true,
        });
      }
      throw new Error('ENTITLEMENT_POST_PURCHASE_VERIFICATION_FAILED');
    }
    lease.assertCurrent();
    if (!persisted) return activeResult(null);

    const actionIdentity = persisted.actionEntitlement
      ? deriveState(persisted.actionEntitlement, new Date().toISOString()).evidenceIdentity
      : null;
    const actionProofWon = Boolean(
      result.purchased &&
      persisted.persisted &&
      actionIdentity &&
      persisted.publishedState.isPro &&
      actionIdentity === persisted.publishedState.evidenceIdentity,
    );
    if (result.purchaseMayHaveCompleted || persisted.verificationPending || !actionProofWon) {
      reconcileInBackground();
      return publishedActionResult(persisted.publishedState, persisted.acceptedEntitlement, {
        verificationPending: true,
        purchaseMayHaveCompleted: true,
      });
    }

    const successReceiptId = mintPurchaseSuccessReceipt(
      ownerScope,
      persisted.actionEntitlement,
      persisted.publishedState,
      {
        action,
        completed: true,
        commercialTerms: {
          purchasePriceLabel: result.purchasePriceLabel,
          purchasePeriodLabel: result.purchasePeriodLabel,
          offerDurationLabel: result.offerDurationLabel,
          renewalPriceLabel: result.renewalPriceLabel,
          renewalPeriodLabel: result.renewalPeriodLabel,
        },
      },
    );
    const won = persisted.actionEntitlement;
    if (won?.isActive) {
      if (action === 'winback') {
        track('winback_converted', {
          source: 'revenuecat',
          period_type: won.periodType,
        });
      } else if (won.periodType === 'trial') {
        track('trial_started', {
          source: 'revenuecat',
          period_type: won.periodType,
        });
      } else {
        track('purchase_completed', {
          source: 'revenuecat',
          period_type: won.periodType,
        });
      }
    }
    return publishedActionResult(persisted.publishedState, persisted.acceptedEntitlement, {
      ...(successReceiptId ? { successReceiptId } : {}),
    });
  };

  const startReverseTrial = useMutation({
    mutationFn: (input: EntitlementActionInput) =>
      runOwnerQueryOperation(ownerScope, async (lease) => {
        assertActionAtCommit(lease, input, ['reverse_trial']);
        const storeUserId = reverseTrialStoreUserId();
        const started = await startReverseTrialOnServer(lease.assertCurrent, storeUserId, () =>
          assertActionAtCommit(lease, input, ['reverse_trial']),
        );
        lease.assertCurrent();
        const published = publishAcceptance(started);
        lease.assertCurrent();
        if (started.started && started.entitlement) {
          track('reverse_trial_started', {
            source: started.entitlement.source ?? 'server',
          });
        }
        return publishedActionResult(published, started.entitlement);
      }),
    onSettled: invalidate,
  });

  const startTrial = useMutation({
    mutationFn: (input: EntitlementActionInput) =>
      runOwnerQueryOperation(ownerScope, async (lease) => {
        assertActionAtCommit(lease, input, ['onboarding_purchase']);
        const result = await purchasePackage(revenueCatOwner(lease), 'annual', () =>
          assertActionAtCommit(lease, input, ['onboarding_purchase']),
        );
        return finishPaidAction(lease, result, 'purchase');
      }),
    onSettled: invalidate,
    retry: 0,
  });

  const purchase = useMutation({
    mutationFn: (input: EntitlementActionInput) =>
      runOwnerQueryOperation(ownerScope, async (lease) => {
        const allowedKinds = ['upsell_purchase', 'downgrade_purchase', 'reoffer_purchase'] as const;
        assertActionAtCommit(lease, input, allowedKinds);
        const result = await purchasePackage(revenueCatOwner(lease), 'annual', () =>
          assertActionAtCommit(lease, input, allowedKinds),
        );
        return finishPaidAction(lease, result, 'purchase');
      }),
    onSettled: invalidate,
    retry: 0,
  });

  const restore = useMutation({
    mutationFn: () =>
      runOwnerQueryOperation(ownerScope, async (lease) => {
        track('restore_tapped');
        const result = await restorePurchases(revenueCatOwner(lease));
        let persisted: PersistedRevenueCatResult | null;
        try {
          persisted = await persistRevenueCatResult(
            result,
            lease.assertCurrent,
            publishAcceptance,
            publishVerificationFailure,
            ownerScope,
            revenueCatOwner(lease).appUserId,
          );
        } catch {
          if (result.customerInfo) {
            reconcileInBackground();
            return activeResult(null, { verificationPending: true });
          }
          throw new Error('ENTITLEMENT_RESTORE_VERIFICATION_FAILED');
        }
        if (!persisted) return activeResult(null, { storePurchaseFound: false });
        if (persisted.verificationPending) {
          reconcileInBackground();
          return publishedActionResult(persisted.publishedState, persisted.acceptedEntitlement, {
            verificationPending: true,
          });
        }
        return publishedActionResult(persisted.publishedState, persisted.acceptedEntitlement, {
          storePurchaseFound: result.restored,
        });
      }),
    onSettled: invalidate,
    retry: 0,
  });

  const downgrade = useMutation({
    mutationFn: (input: EntitlementActionInput) =>
      runOwnerQueryOperation(ownerScope, async (lease) => {
        const state = assertActionAtCommit(lease, input, ['decline_expired_reverse_trial']);
        if (!state.evidenceIdentity) {
          throw new Error('ENTITLEMENT_ACTION_PRECONDITION_FAILED');
        }
        const downgraded = await downgradeToFree(
          state.evidenceIdentity,
          revenueCatOwner(lease).appUserId,
        );
        lease.assertCurrent();
        if (!downgraded) throw new Error('ENTITLEMENT_ACTION_PRECONDITION_FAILED');
        track('reverse_trial_expired');
        return activeResult(await loadEntitlement());
      }),
    onSettled: invalidate,
  });

  const winback = useMutation({
    mutationFn: (input: EntitlementActionInput) =>
      runOwnerQueryOperation(ownerScope, async (lease) => {
        assertActionAtCommit(lease, input, ['winback_purchase']);
        const result = await purchaseWinBackPackage(revenueCatOwner(lease), () =>
          assertActionAtCommit(lease, input, ['winback_purchase']),
        );
        const settled = await finishPaidAction(lease, result, 'winback');
        return result.offerUnavailable ? { ...settled, offerUnavailable: true } : settled;
      }),
    onSettled: invalidate,
    retry: 0,
  });

  const manage = useMutation({
    mutationFn: () =>
      runOwnerQueryOperation(ownerScope, async (lease) => {
        const opened = await showNativeManageSubscriptions(revenueCatOwner(lease));
        lease.assertCurrent();
        return opened;
      }),
    retry: 0,
  });

  return { startReverseTrial, startTrial, purchase, restore, downgrade, winback, manage };
}
