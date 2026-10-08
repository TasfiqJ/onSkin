import type { PlanId } from '@layerwell/types';
import {
  useMutation, useQuery, useQueryClient, type MutateOptions, type UseMutationResult,
} from '@tanstack/react-query';
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
  assertEntitlementSnapshotCurrent,
  downgradeToFree,
  entitlementOwnerContextForUser,
  fetchServerEvidence,
  isDurablyAdmissibleStoreResult,
  mergeEntitlementEvidenceBatch,
  publishCustomerInfoEvidence,
  readEntitlementSnapshot,
  startReverseTrialOnServer,
  type EntitlementSnapshot,
} from './store';
import { e2eEntitlementDelayMs, e2eEntitlementState } from './entitlementE2EFixture';
import { prepareRevenueCatActionProof } from './entitlementPurchaseAttribution';

const UNRESOLVED_OWNER_BINDING = '0'.repeat(64);

export type EntitlementActionResult = Readonly<{
  active: boolean;
  /** Current access may become unavailable without undoing provider facts. */
  accessStatus: 'current' | 'unavailable';
  cancelled?: boolean;
  offerUnavailable?: boolean;
  entitlement: StoredEntitlement | null;
}>;

// Keep provider facts while carrying local access authority through the native
// journal, Query Core's awaited callbacks, and the actual data consumer.
const actionResultPublications = new WeakMap<EntitlementActionResult, () => void>();
const settledPublicationErrors = new WeakSet<Error>();

function assertActionResultCurrent(result: EntitlementActionResult): void {
  const assertCurrent = actionResultPublications.get(result);
  if (result.active && !assertCurrent) throw new Error(ENTITLEMENT_EVIDENCE_COMMIT_BLOCKED);
  assertCurrent?.();
  if (result.accessStatus === 'unavailable') throw new Error(ENTITLEMENT_EVIDENCE_COMMIT_BLOCKED);
}

function activeResult(
  entitlement: StoredEntitlement | null,
  extras?: Omit<EntitlementActionResult, 'active' | 'entitlement' | 'accessStatus'>,
  assertCurrent?: () => void,
): EntitlementActionResult {
  assertCurrent?.();
  const active = entitlement ? deriveState(entitlement, new Date().toISOString()).isPro : false;
  const current = () => {
    try {
      if (active && !assertCurrent) return false;
      assertCurrent?.();
      return true;
    } catch {
      return false;
    }
  };
  // Core retains the exact data object. These nonthrowing accessors therefore
  // also cover rejection between async onSettled and synchronous success
  // publication; an earlier plain `true` cannot survive that queued boundary.
  const result: EntitlementActionResult = {
    get active() { return active && current(); },
    get accessStatus() { return current() ? 'current' : 'unavailable'; },
    entitlement,
    ...extras,
  };
  if (assertCurrent) actionResultPublications.set(result, assertCurrent);
  return Object.freeze(result);
}

function currentMutationPublication<TVariables>(
  mutation: UseMutationResult<EntitlementActionResult, Error, TVariables>,
): UseMutationResult<EntitlementActionResult, Error, TVariables> {
  type Callbacks = MutateOptions<EntitlementActionResult, Error, TVariables>;
  const callbacks = (options?: Callbacks): Callbacks | undefined => {
    if (!options) return undefined;
    let publicationError: Error | undefined;
    let publicationChecked = false;
    const check = (result: EntitlementActionResult) => {
      if (publicationChecked) return publicationError;
      publicationChecked = true;
      try {
        assertActionResultCurrent(result);
      } catch (cause) {
        publicationError = cause instanceof Error ? cause : new Error(ENTITLEMENT_EVIDENCE_COMMIT_BLOCKED,
          { cause });
      }
      return publicationError;
    };
    return {
      ...options,
      onSuccess: (result, variables, onMutateResult, context) => {
        const error = check(result);
        if (error) options.onError?.(error, variables, onMutateResult, context);
        else options.onSuccess?.(result, variables, onMutateResult, context);
      },
      onSettled: (result, error, variables, onMutateResult, context) => {
        if (!error && result && !publicationChecked) {
          const blocked = check(result);
          if (blocked) options.onError?.(blocked, variables, onMutateResult, context);
        }
        options.onSettled?.(publicationError ? undefined : result, publicationError ?? error,
          variables, onMutateResult, context);
      },
    };
  };
  return {
    ...mutation,
    // Existing callers use per-mutate callbacks for Restore and navigation.
    // An unavailable live result must reach their existing recovery/error path,
    // never their verified-empty subscription or purchase-success feedback.
    mutate: (variables, options) => mutation.mutate(variables, callbacks(options)),
    mutateAsync: async (variables, options) => {
      const result = await mutation.mutateAsync(variables, callbacks(options));
      assertActionResultCurrent(result);
      return result;
    },
  };
}

async function runCurrentStoreTransaction(
  input: Parameters<typeof runOwnedStoreTransaction<EntitlementActionResult>>[0],
): Promise<EntitlementActionResult> {
  const result = await runOwnedStoreTransaction(input);
  // Journal settlement records provider facts. A newer local rejection must
  // block the retained access result without undoing that completed journal.
  assertActionResultCurrent(result);
  return result;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type PersistedRevenueCatResult = Readonly<{
  entitlement: StoredEntitlement | null;
  storeActive: boolean;
  providerResultPersisted: boolean;
  verifiedEmptyRestore: boolean;
  assertCurrent: () => void;
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
  const persisted = await runRevenueCatResultWrite(input, async () => {
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
    const assertCurrent = () => {
      assertRevenueCatResultCurrent(input);
      if (published.snapshot) assertEntitlementSnapshotCurrent(published.snapshot);
    };
    assertCurrent();

    const committed = published.snapshot?.activeStoreEntitlement ?? null;

    if (committed?.isActive && committed.periodType === 'trial') {
      await scheduleTrialReminder();
    } else if (committed?.isActive) {
      await cancelTrialReminder();
    }
    assertCurrent();

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
      assertCurrent,
    };
  });
  persisted.assertCurrent();
  return persisted;
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

        const server = await fetchServerEvidence(ownerContext, lease.signal);
        lease.assertCurrent();
        if (server.status !== 'evidence') {
          // A newer SDK/server merge may have committed during the request.
          // Read the current atomic cache only after that request completes.
          const localRead = await readEntitlementSnapshot(ownerContext);
          lease.assertCurrent();
          const local = localRead.status === 'available' ? localRead.snapshot : null;
          if (local) assertEntitlementSnapshotCurrent(local);
          return stateWithoutServerEvidence({
            local, localStatus: localRead.status, serverStatus: server.status,
            nowISO: new Date().toISOString(), development: env.appEnvironment === 'development',
          });
        }

        const merged = await mergeEntitlementEvidenceBatch(ownerContext, server.evidence);
        lease.assertCurrent();
        if (merged.snapshot) {
          assertEntitlementSnapshotCurrent(merged.snapshot);
          return stateFromEntitlementSnapshot(merged.snapshot);
        }
        // Authenticated newer evidence was observed but could not be committed.
        // The pre-read cache may now hide a revocation; keep recovery closed.
        return deriveState(null, new Date().toISOString(), 'unavailable');
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

  const settleResult = async (result: EntitlementActionResult | undefined, error: Error | null) => {
    // Query Core repeats onSettled on its error path if this success callback
    // throws. That exact failure already completed invalidation; ordinary
    // mutation failures still run the existing awaited invalidation normally.
    if (error && settledPublicationErrors.has(error)) return;
    await invalidate();
    if (!result) return;
    try {
      assertActionResultCurrent(result);
    } catch (cause) {
      const blocked = new Error(cause instanceof Error ? cause.message : ENTITLEMENT_EVIDENCE_COMMIT_BLOCKED,
        { cause });
      settledPublicationErrors.add(blocked);
      throw blocked;
    }
  };

  const publishCurrentSnapshot = async (ownerUserId: string): Promise<EntitlementSnapshot | null> => {
    const context = await entitlementOwnerContextForUser(ownerUserId);
    const read = await readEntitlementSnapshot(context);
    if (read.status === 'absent') return null;
    if (read.status !== 'available') throw new Error(ENTITLEMENT_EVIDENCE_COMMIT_BLOCKED);
    assertEntitlementSnapshotCurrent(read.snapshot);
    qc.setQueryData(
      entitlementQueryKey(context.ownerBinding),
      stateFromEntitlementSnapshot(read.snapshot),
    );
    return read.snapshot;
  };

  const startReverseTrial = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('ENTITLEMENT_OWNER_USER_ID_REQUIRED');
      const entitlement = await startReverseTrialOnServer();
      track('reverse_trial_started', { source: entitlement.source ?? 'server' });
      const snapshot = await publishCurrentSnapshot(user.id);
      return activeResult(snapshot?.entitlement ?? entitlement, undefined,
        snapshot ? () => assertEntitlementSnapshotCurrent(snapshot) : undefined);
    },
    onSettled: settleResult,
  });

  const startTrial = useMutation({
    mutationFn: async () => {
      const ownerUserId = user?.id;
      return runCurrentStoreTransaction({
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
          return activeResult(entitlement, { cancelled: result.cancelled }, persisted.assertCurrent);
        },
      });
    },
    onSettled: settleResult,
  });

  const purchasePlan = useMutation({
    mutationFn: async (plan: PlanId) => {
      const ownerUserId = user?.id;
      return runCurrentStoreTransaction({
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
          return activeResult(persisted.entitlement, { cancelled: result.cancelled }, persisted.assertCurrent);
        },
      });
    },
    onSettled: settleResult,
  });

  const purchase = useMutation({
    mutationFn: async () => {
      const ownerUserId = user?.id;
      return runCurrentStoreTransaction({
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
          return activeResult(entitlement, { cancelled: result.cancelled }, persisted?.assertCurrent);
        },
      });
    },
    onSettled: settleResult,
  });

  const restore = useMutation({
    mutationFn: async () => {
      const ownerUserId = user?.id;
      return runCurrentStoreTransaction({
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
          return activeResult(persisted?.entitlement ?? null, undefined, persisted?.assertCurrent);
        },
      });
    },
    onSettled: settleResult,
  });

  const downgrade = useMutation({
    mutationFn: async () => {
      await downgradeToFree();
      track('reverse_trial_expired');
      if (!user?.id) return activeResult(null);
      const snapshot = await publishCurrentSnapshot(user.id);
      return activeResult(snapshot?.entitlement ?? null, undefined,
        snapshot ? () => assertEntitlementSnapshotCurrent(snapshot) : undefined);
    },
    onSettled: settleResult,
  });

  const winback = useMutation({
    mutationFn: async () => {
      const ownerUserId = user?.id;
      return runCurrentStoreTransaction({
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
          }, persisted?.assertCurrent);
        },
      });
    },
    onSettled: settleResult,
  });

  return {
    startReverseTrial: currentMutationPublication(startReverseTrial),
    startTrial: currentMutationPublication(startTrial),
    purchase: currentMutationPublication(purchase),
    purchasePlan: currentMutationPublication(purchasePlan),
    restore: currentMutationPublication(restore),
    downgrade: currentMutationPublication(downgrade),
    winback: currentMutationPublication(winback),
  };
}
