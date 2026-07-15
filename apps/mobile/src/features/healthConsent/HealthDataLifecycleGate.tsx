import { router, useSegments } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, ScrollView, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { HEALTH_DATA_CONSENT } from '@/features/onboarding/consentCopy';
import { deleteAccount, exportData } from '@/features/settings/actions';
import { subscriptionStorefrontCopy } from '@/features/subscription/storefrontCopy';
import { useEntitlement, useEntitlementActions } from '@/features/subscription/useEntitlement';
import { useAuth } from '@/lib/auth/AuthProvider';
import { isAccountGenerationLeaseError } from '@/lib/auth/accountGeneration';
import {
  activeHealthProcessingLeaseSnapshot,
  clearActiveHealthProcessingEpoch,
  healthProcessingStatusLeaseExpiresAt,
  isHealthProcessingStatusLeaseCurrent,
  type ActiveHealthProcessingLeaseSnapshot,
} from '@/lib/consent/healthProcessingEpoch';
import { isSupabaseConfigured } from '@/lib/env';
import {
  MANAGE_SUBSCRIPTION_URL_ANDROID,
  MANAGE_SUBSCRIPTION_URL_IOS,
  showNativeManageSubscriptions,
} from '@/lib/iap/revenuecat';
import { POLICY_LINKS } from '@/lib/legal/policyLinks';
import { openExternalHttpsUrl } from '@/lib/navigation/externalOpen';

import {
  completeHealthDataActivationRoute,
  grantAuthoritativeHealthDataConsent,
  LOCAL_UNCONFIGURED_HEALTH_DATA_OWNER,
  reconcileHealthDataLifecycle,
  resumeHealthDataConsentWithdrawal,
} from './lifecycle';
import {
  applyHealthDataLifecycleRecord,
  createHealthDataGateSnapshot,
  healthDataActivationRouteIsSelected,
  healthDataChildrenMayMount,
  healthDataPausedShellRequired,
  healthDataUnconsentedRedirectRequired,
  releaseHealthDataActivationRoute,
} from './activationInterlock';
import {
  readHealthDataLifecycle,
  subscribeToHealthDataLifecycle,
  verificationRequiredRecord,
  verificationRequiresLocalCleanup,
  type HealthDataLifecycleRecord,
} from './lifecycleStore';
import { MountedGoalsActivationInterlock } from './HealthDataActivationMount';

const STOREFRONT_COPY = subscriptionStorefrontCopy(Platform.OS);

function clearExactProcessingLease(
  lease: ActiveHealthProcessingLeaseSnapshot | null,
  expectedOwnerUserId: string,
): boolean {
  if (lease === null) {
    return activeHealthProcessingLeaseSnapshot(expectedOwnerUserId) === null;
  }
  if (lease.ownerUserId !== expectedOwnerUserId || lease.accountGeneration === null) return false;
  return clearActiveHealthProcessingEpoch({
    ownerUserId: lease.ownerUserId,
    generation: lease.generation,
    accountGeneration: lease.accountGeneration,
  });
}

function unconsentedRouteMayMount(segments: readonly string[]): boolean {
  if (segments.length === 0) return true;
  if (segments[0] !== 'onboarding') return false;
  return segments[1] === 'account' || segments[1] === 'age' || segments[1] === 'consent';
}

function signedOutConfiguredRouteMayMount(segments: readonly string[]): boolean {
  if (segments.length === 0) return true;
  return segments[0] === 'onboarding' && segments[1] === 'account';
}

function lifecycleMessage(record: HealthDataLifecycleRecord): string {
  if (record.state === 'withdrawing') {
    return record.localCleanupComplete
      ? 'Your health data is paused on this device. Server deletion is still finishing.'
      : 'Your health data is paused. This device still needs to finish its private-data cleanup.';
  }
  if (record.state === 'withdrawn') {
    return record.localCleanupComplete
      ? 'Health-purpose data has been cleared from this device and the live service. Protected backups, if any, follow policy retention and are not used for personalization. Your account and subscription remain available.'
      : 'The server completed withdrawal, but this device still needs to finish local cleanup.';
  }
  if (record.verificationReason === 'status_unavailable') {
    return 'We could not verify the current server permission. Existing health data remains locked on this device; this status check does not delete it.';
  }
  if (record.localCleanupComplete) {
    return 'Local health-purpose data is cleared, but the server lifecycle is not compatible with a new consent yet. Personalized features stay locked while you retry or contact support.';
  }
  return 'We could not verify the current health-data permission. Personalized features stay locked until verification succeeds.';
}

export function PausedHealthDataShell({
  record,
  onRecord,
}: {
  record: HealthDataLifecycleRecord;
  onRecord: (record: HealthDataLifecycleRecord) => void;
}) {
  const { signOut } = useAuth();
  const entitlement = useEntitlement();
  const { restore } = useEntitlementActions();
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [reviewingConsent, setReviewingConsent] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function retry() {
    setBusy('retry');
    setFeedback(null);
    try {
      const next =
        record.state === 'withdrawing' ||
        (record.state === 'withdrawn' && !record.localCleanupComplete)
          ? await resumeHealthDataConsentWithdrawal(record.ownerUserId, {
              expectedInterruptedProcessingEpoch:
                record.state === 'withdrawing' ? record.processingEpoch : undefined,
            })
          : await reconcileHealthDataLifecycle(record.ownerUserId);
      // Publishing the record sets the activation-route epoch atomically.
      // The global gate is the only goals navigator for every fresh epoch;
      // exact same-epoch outage recovery intentionally preserves its route.
      onRecord(next);
      setFeedback(
        next.state === 'withdrawn' && next.localCleanupComplete
          ? 'Active-system withdrawal is complete.'
          : 'Status checked. Personalized features remain paused.',
      );
    } catch {
      setFeedback(
        'Could not finish the privacy request. Your health features remain safely paused.',
      );
    } finally {
      setBusy(null);
    }
  }

  async function reconsent() {
    setBusy('reconsent');
    setFeedback(null);
    if (isSupabaseConfigured && !terminal) {
      setFeedback('Consent cannot restart until the server confirms a compatible terminal state.');
      setBusy(null);
      return;
    }
    try {
      const next = await grantAuthoritativeHealthDataConsent({
        ownerUserId: record.ownerUserId,
        expectedProcessingEpoch: record.processingEpoch,
      });
      // The grant synchronously publishes an activation-route barrier before
      // this promise resolves. Let the global gate issue the sole goals route
      // command so Expo Router never receives duplicate replacements.
      onRecord(next);
    } catch {
      setFeedback('Consent was not saved. Health features remain paused; please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function exportAccountData() {
    setBusy('export');
    setFeedback(null);
    try {
      const shared = await exportData();
      setFeedback(
        shared
          ? 'Your export was prepared.'
          : 'The export sheet is unavailable on this device. No temporary file was retained.',
      );
    } catch {
      setFeedback('Export is unavailable while the privacy request is still being verified.');
    } finally {
      setBusy(null);
    }
  }

  async function manageSubscription() {
    setBusy('manage');
    setFeedback(null);
    try {
      const openedNative = await showNativeManageSubscriptions();
      const fallbackUrl =
        Platform.OS === 'android' ? MANAGE_SUBSCRIPTION_URL_ANDROID : MANAGE_SUBSCRIPTION_URL_IOS;
      const opened =
        openedNative ||
        (await openExternalHttpsUrl(entitlement.data?.managementUrl ?? fallbackUrl, {
          mode: 'linking',
          alertOnFailure: false,
        }));
      if (!opened) setFeedback(STOREFRONT_COPY.managementUnavailable);
    } catch {
      setFeedback(STOREFRONT_COPY.managementUnavailable);
    } finally {
      setBusy(null);
    }
  }

  async function signOutAccount() {
    setBusy('signout');
    setFeedback(null);
    try {
      await signOut();
    } catch {
      setFeedback('Sign out did not finish. Your health features remain paused.');
      setBusy(null);
    }
  }

  async function removeAccount() {
    setBusy('delete');
    setFeedback(null);
    try {
      await deleteAccount(signOut);
      router.replace('/');
    } catch {
      setFeedback(
        'Account deletion could not start. Your account and health-data pause are unchanged.',
      );
      setBusy(null);
      setConfirmDelete(false);
    }
  }

  async function openPolicy(key: 'privacy' | 'consumerHealthPrivacy' | 'support') {
    try {
      const opened = await openExternalHttpsUrl(POLICY_LINKS[key].url, {
        mode: 'browser',
        alertOnFailure: false,
      });
      if (!opened) setFeedback('That link is not configured in this build.');
    } catch {
      setFeedback('That link is unavailable. Please try again.');
    }
  }

  const terminal = record.state === 'withdrawn' && record.localCleanupComplete;
  const localOnlyVerificationReady =
    !isSupabaseConfigured &&
    record.state === 'verification_required' &&
    verificationRequiresLocalCleanup(record) &&
    record.localCleanupComplete;
  const mayReviewConsent = terminal || localOnlyVerificationReady;
  return (
    <Screen edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
        <Text variant="eyebrow" tone="clay" className="mt-2">
          HEALTH DATA PAUSED
        </Text>
        <Text variant="title" className="mt-2">
          Your account is still here.
        </Text>
        <Text variant="body" tone="muted" className="mt-3">
          {lifecycleMessage(record)} Billing does not stop automatically; use Manage subscription
          below whenever you need it.
        </Text>

        {feedback ? (
          <Card className="mt-4">
            <Text accessibilityRole="alert" variant="bodySm" tone="muted">
              {feedback}
            </Text>
          </Card>
        ) : null}

        <Card className="mt-5">
          <Text variant="label" tone="muted">
            PRIVACY REQUEST
          </Text>
          <Text variant="bodySm" tone="muted" className="mt-2">
            Status: {record.state.replace('_', ' ')}.{' '}
            {record.state === 'verification_required' &&
            record.verificationReason === 'status_unavailable'
              ? 'Local data is preserved but inaccessible while server status is checked.'
              : `Local cleanup ${record.localCleanupComplete ? 'complete' : 'pending'}.`}
          </Text>
          {!terminal ? (
            <Button
              className="mt-4"
              label={busy === 'retry' ? 'Checking...' : 'Retry / check status'}
              disabled={busy !== null}
              onPress={() => void retry()}
            />
          ) : null}
        </Card>

        {mayReviewConsent ? (
          <Card className="mt-4">
            <Text variant="label" tone="clay">
              {terminal ? 'START FRESH' : 'REVIEW CURRENT CONSENT'}
            </Text>
            <Text variant="body" className="mt-2 font-sans-semibold">
              {terminal
                ? 'Re-enable personalized skincare only with a new consent.'
                : 'Re-enable personalized skincare only with the current consent.'}
            </Text>
            <Text variant="bodySm" tone="muted" className="mt-2">
              {terminal
                ? 'The app will not restore the old profile into active use; create a new one. A new processing epoch starts with empty goals, quiz answers, shelf, routines, reminders, and Progress history.'
                : 'Review what is collected and why. Accepting starts a new processing epoch with empty goals, quiz answers, shelf, routines, reminders, and Progress history; it does not reuse an older disclosure or profile.'}
            </Text>
            {reviewingConsent ? (
              <View className="mt-4 rounded-card border border-hairline p-4">
                <Text variant="label" tone="clay">
                  WHAT
                </Text>
                <Text variant="bodySm" className="mt-1">
                  {HEALTH_DATA_CONSENT.what}
                </Text>
                <Text variant="label" tone="clay" className="mt-3">
                  WHY
                </Text>
                <Text variant="bodySm" className="mt-1">
                  {HEALTH_DATA_CONSENT.why}
                </Text>
                <Text variant="label" tone="clay" className="mt-3">
                  NEVER
                </Text>
                <Text variant="bodySm" className="mt-1">
                  {HEALTH_DATA_CONSENT.never}
                </Text>
                <Text variant="bodySm" tone="muted" className="mt-3">
                  {HEALTH_DATA_CONSENT.footnote} This permission covers collection only; sharing is
                  requested separately.
                </Text>
                <Button
                  className="mt-4"
                  label={busy === 'reconsent' ? 'Saving...' : 'I agree. Start a new profile'}
                  disabled={busy !== null}
                  onPress={() => void reconsent()}
                />
                <Button
                  className="mt-2"
                  label="Not now"
                  variant="ghost"
                  disabled={busy !== null}
                  onPress={() => setReviewingConsent(false)}
                />
              </View>
            ) : (
              <Button
                className="mt-4"
                label={terminal ? 'Review fresh consent' : 'Review current consent'}
                disabled={busy !== null}
                onPress={() => setReviewingConsent(true)}
              />
            )}
          </Card>
        ) : null}

        <Card className="mt-4">
          <Text variant="label" tone="muted">
            ACCOUNT & BILLING
          </Text>
          <Button
            className="mt-3"
            label={busy === 'manage' ? 'Opening...' : 'Manage subscription'}
            variant="ghost"
            disabled={busy !== null}
            onPress={() => void manageSubscription()}
          />
          <Button
            className="mt-2"
            label={restore.isPending ? 'Checking purchases...' : 'Restore purchases'}
            variant="ghost"
            disabled={busy !== null || restore.isPending}
            onPress={() =>
              restore.mutate(undefined, {
                onSuccess: (result) =>
                  setFeedback(
                    result.active
                      ? 'Your active subscription is restored.'
                      : 'No active subscription was found for this account.',
                  ),
                onError: () => setFeedback('We could not restore purchases. Please try again.'),
              })
            }
          />
          <Button
            className="mt-2"
            label={busy === 'export' ? 'Preparing...' : 'Export my data'}
            variant="ghost"
            disabled={busy !== null}
            onPress={() => void exportAccountData()}
          />
          <Button
            className="mt-2"
            label={busy === 'signout' ? 'Signing out...' : 'Sign out'}
            variant="ghost"
            disabled={busy !== null}
            onPress={() => void signOutAccount()}
          />
          {confirmDelete ? (
            <View className="mt-3 rounded-card border border-hairline p-4">
              <Text accessibilityRole="alert" variant="bodySm" tone="muted">
                Delete the whole account and its remaining data? Subscription billing may continue
                until you cancel it in the App Store.
              </Text>
              <Button
                className="mt-3"
                label={busy === 'delete' ? 'Deleting...' : 'Delete account'}
                disabled={busy !== null}
                onPress={() => void removeAccount()}
              />
              <Button
                className="mt-2"
                label="Cancel"
                variant="ghost"
                disabled={busy !== null}
                onPress={() => setConfirmDelete(false)}
              />
            </View>
          ) : (
            <Button
              className="mt-2"
              label="Delete account"
              variant="ghost"
              disabled={busy !== null}
              onPress={() => setConfirmDelete(true)}
            />
          )}
        </Card>

        <Card className="mt-4">
          <Text variant="label" tone="muted">
            HELP & POLICIES
          </Text>
          <Button
            className="mt-3"
            label="Consumer health data policy"
            variant="ghost"
            onPress={() => void openPolicy('consumerHealthPrivacy')}
          />
          <Button
            className="mt-2"
            label="Privacy policy"
            variant="ghost"
            onPress={() => void openPolicy('privacy')}
          />
          <Button
            className="mt-2"
            label="Support"
            variant="ghost"
            onPress={() => void openPolicy('support')}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

export function HealthDataLifecycleGate({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();
  const segments = useSegments();
  const ownerUserId =
    user?.id ?? (!isSupabaseConfigured ? LOCAL_UNCONFIGURED_HEALTH_DATA_OWNER : null);
  const [gateSnapshot, setGateSnapshot] = useState(createHealthDataGateSnapshot);
  const gateSnapshotRef = useRef(gateSnapshot);
  const reconciliationBaselineRef = useRef<{
    token: symbol;
    record: HealthDataLifecycleRecord | null;
  } | null>(null);
  const activationReleasePromiseRef = useRef<Promise<void> | null>(null);
  const record = gateSnapshot.record;
  const [reconcileRevision, setReconcileRevision] = useState(0);
  const [activationReleaseFailureOwner, setActivationReleaseFailureOwner] = useState<string | null>(
    null,
  );

  const commitLifecycleRecord = useCallback(
    (next: HealthDataLifecycleRecord | null, transitionFrom?: HealthDataLifecycleRecord | null) => {
      const current = gateSnapshotRef.current;
      const updated =
        transitionFrom === undefined
          ? applyHealthDataLifecycleRecord(current, next)
          : applyHealthDataLifecycleRecord(current, next, transitionFrom);
      gateSnapshotRef.current = updated;
      setGateSnapshot(updated);
    },
    [],
  );

  useEffect(() => {
    clearActiveHealthProcessingEpoch();
    reconciliationBaselineRef.current = null;
    const empty = createHealthDataGateSnapshot();
    gateSnapshotRef.current = empty;
    activationReleasePromiseRef.current = null;
  }, [ownerUserId]);

  useEffect(() => {
    return subscribeToHealthDataLifecycle((next) => {
      if (next === null || next.ownerUserId === ownerUserId) {
        const baseline = reconciliationBaselineRef.current;
        reconciliationBaselineRef.current = null;
        if (baseline) commitLifecycleRecord(next, baseline.record);
        else commitLifecycleRecord(next);
      }
    });
  }, [commitLifecycleRecord, ownerUserId]);

  const activationRouteSelected = healthDataActivationRouteIsSelected(segments);
  useEffect(() => {
    const current = gateSnapshotRef.current;
    if (current.activationRouteEpoch === null) return;
    if (!activationRouteSelected) {
      router.replace('/onboarding/goals');
    }
  }, [activationRouteSelected, gateSnapshot.activationRouteEpoch]);

  const acknowledgeMountedGoalsRoute = useCallback((): Promise<void> => {
    if (activationReleasePromiseRef.current) return activationReleasePromiseRef.current;
    const pending = (async () => {
      const current = gateSnapshotRef.current;
      if (current.activationRouteEpoch === null || current.record?.state !== 'active') return;
      const pendingOwnerUserId = current.record.ownerUserId;
      const pendingEpoch = current.activationRouteEpoch;
      setActivationReleaseFailureOwner(null);
      try {
        const next = await completeHealthDataActivationRoute({
          ownerUserId: pendingOwnerUserId,
          expectedProcessingEpoch: pendingEpoch,
        });
        const liveRecord = gateSnapshotRef.current.record;
        if (
          liveRecord?.ownerUserId !== pendingOwnerUserId ||
          liveRecord.processingEpoch !== pendingEpoch
        ) {
          return;
        }
        commitLifecycleRecord(next);
        const latest = gateSnapshotRef.current;
        const released = releaseHealthDataActivationRoute(latest, ['onboarding', 'goals']);
        if (released !== latest) {
          gateSnapshotRef.current = released;
          setGateSnapshot(released);
        }
      } catch {
        const live = gateSnapshotRef.current;
        if (
          live.record?.ownerUserId === pendingOwnerUserId &&
          live.activationRouteEpoch === pendingEpoch
        ) {
          setActivationReleaseFailureOwner(pendingOwnerUserId);
        }
      }
    })();
    activationReleasePromiseRef.current = pending;
    void pending.finally(() => {
      if (activationReleasePromiseRef.current === pending) {
        activationReleasePromiseRef.current = null;
      }
    });
    return pending;
  }, [commitLifecycleRecord]);

  const unconsentedRouteAllowed = unconsentedRouteMayMount(segments);
  const signedOutRouteAllowed = signedOutConfiguredRouteMayMount(segments);
  useEffect(() => {
    if (!initializing && isSupabaseConfigured && ownerUserId === null && !signedOutRouteAllowed) {
      router.replace('/');
    }
  }, [initializing, ownerUserId, signedOutRouteAllowed]);
  useEffect(() => {
    const redirectRequired = healthDataUnconsentedRedirectRequired(
      gateSnapshotRef.current,
      ownerUserId,
      unconsentedRouteAllowed,
    );
    if (redirectRequired) {
      router.replace('/onboarding/consent');
    }
  }, [ownerUserId, record?.ownerUserId, record?.state, unconsentedRouteAllowed]);

  useEffect(() => {
    if (!ownerUserId) return;
    let active = true;
    const reconcile = async () => {
      let next: HealthDataLifecycleRecord;
      const before = await readHealthDataLifecycle(ownerUserId).catch(() => null);
      const baselineToken = Symbol('health-data-reconcile');
      reconciliationBaselineRef.current = { token: baselineToken, record: before };
      try {
        next = await reconcileHealthDataLifecycle(ownerUserId);
        if (
          next.state === 'withdrawing' ||
          (next.state === 'withdrawn' && !next.localCleanupComplete)
        ) {
          next = await resumeHealthDataConsentWithdrawal(ownerUserId);
        }
      } catch (error) {
        if (isAccountGenerationLeaseError(error)) return;
        next =
          (await readHealthDataLifecycle(ownerUserId).catch(() => null)) ??
          verificationRequiredRecord({ ownerUserId });
      } finally {
        if (reconciliationBaselineRef.current?.token === baselineToken) {
          reconciliationBaselineRef.current = null;
        }
      }
      if (active) {
        commitLifecycleRecord(next, before);
      }
    };
    void reconcile();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const cleared = clearExactProcessingLease(
          activeHealthProcessingLeaseSnapshot(ownerUserId),
          ownerUserId,
        );
        if (!cleared) return;
        const current = gateSnapshotRef.current.record;
        if (current?.ownerUserId === ownerUserId && current.state === 'active') {
          commitLifecycleRecord(verificationRequiredRecord({ ownerUserId, previous: current }));
        }
        void reconcile();
      }
    });
    return () => {
      active = false;
      appState.remove();
    };
  }, [commitLifecycleRecord, ownerUserId, reconcileRevision]);

  useEffect(() => {
    if (!isSupabaseConfigured || record?.ownerUserId !== ownerUserId || record.state !== 'active') {
      return;
    }
    const expiresAt = record.serverVerifiedAt
      ? healthProcessingStatusLeaseExpiresAt(record.serverVerifiedAt)
      : null;
    const delay = expiresAt === null ? 0 : Math.max(0, expiresAt - Date.now());
    const scheduledLease = activeHealthProcessingLeaseSnapshot(ownerUserId);
    const timer = setTimeout(() => {
      if (!clearExactProcessingLease(scheduledLease, ownerUserId)) return;
      const current = gateSnapshotRef.current.record;
      if (current?.ownerUserId === ownerUserId && current.state === 'active') {
        commitLifecycleRecord(verificationRequiredRecord({ ownerUserId, previous: current }));
      }
      setReconcileRevision((revision) => revision + 1);
    }, delay);
    return () => clearTimeout(timer);
  }, [commitLifecycleRecord, ownerUserId, record]);

  if (initializing) return null;
  // The Welcome route must be able to create the first anonymous account.
  if (!ownerUserId) {
    if (isSupabaseConfigured && !signedOutRouteAllowed) {
      return (
        <Screen>
          <View className="flex-1 justify-center">
            <Text variant="eyebrow" tone="clay" className="text-center">
              PRIVACY CHECK
            </Text>
            <Text variant="title" className="mt-2 text-center">
              Sign in before entering health information
            </Text>
          </View>
        </Screen>
      );
    }
    return <>{children}</>;
  }
  if (record === null || record.ownerUserId !== ownerUserId) {
    return (
      <Screen>
        <View className="flex-1 justify-center">
          <Text variant="eyebrow" tone="clay" className="text-center">
            PRIVACY CHECK
          </Text>
          <Text variant="title" className="mt-2 text-center">
            Verifying health-data access
          </Text>
        </View>
      </Screen>
    );
  }
  if (record && healthDataPausedShellRequired(gateSnapshot, ownerUserId)) {
    return (
      <PausedHealthDataShell record={record} onRecord={(next) => commitLifecycleRecord(next)} />
    );
  }
  if (!healthDataChildrenMayMount(gateSnapshot)) {
    if (activationRouteSelected && record.state === 'active') {
      return (
        <MountedGoalsActivationInterlock
          activationPending
          failed={activationReleaseFailureOwner === record.ownerUserId}
          onAcknowledge={acknowledgeMountedGoalsRoute}
        >
          {children}
        </MountedGoalsActivationInterlock>
      );
    }
    return (
      <Screen>
        <View className="flex-1 justify-center">
          <Text variant="eyebrow" tone="clay" className="text-center">
            STARTING FRESH
          </Text>
          <Text variant="title" className="mt-2 text-center">
            Preparing your new health profile
          </Text>
        </View>
      </Screen>
    );
  }
  if (
    record.state === 'active' &&
    isSupabaseConfigured &&
    !isHealthProcessingStatusLeaseCurrent(record.serverVerifiedAt)
  ) {
    return (
      <Screen>
        <View className="flex-1 justify-center">
          <Text variant="eyebrow" tone="clay" className="text-center">
            PRIVACY CHECK
          </Text>
          <Text variant="title" className="mt-2 text-center">
            Revalidating health-data access
          </Text>
        </View>
      </Screen>
    );
  }
  // Local consent alone is never enough to mount a direct health route. The
  // reconciled server lifecycle is authoritative, including when a stale local
  // grant survives on a device whose server state is still unconsented.
  if (record.state === 'unconsented' && !unconsentedRouteAllowed) {
    return (
      <Screen>
        <View className="flex-1 justify-center">
          <Text variant="eyebrow" tone="clay" className="text-center">
            PRIVACY CHECK
          </Text>
          <Text variant="title" className="mt-2 text-center">
            Consent is required before health questions
          </Text>
        </View>
      </Screen>
    );
  }
  // Keep the navigator and its browser-history adapter under the same parent
  // before and after activation acknowledgement. Replacing this wrapper with
  // a Fragment remounts the web navigation subtree and can replay the prior
  // age-gate history entry after goals has already mounted.
  return (
    <MountedGoalsActivationInterlock
      activationPending={false}
      failed={false}
      onAcknowledge={acknowledgeMountedGoalsRoute}
    >
      {children}
    </MountedGoalsActivationInterlock>
  );
}
