import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Platform, ScrollView, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { POLICY_LINKS } from '@/lib/legal/policyLinks';
import { openExternalHttpsUrl } from '@/lib/navigation/externalOpen';

import {
  type AccountDeletionClientRecord,
  canRetryAccountDeletionIntake,
  clearCompletedAccountDeletionState,
  commitCompletedAccountDeletion,
  commitUnresolvedAccountDeletion,
  loadPendingAccountDeletion,
  markAccountDeletionRetryUnavailable,
  resolveAccountDeletionStartupWithoutNativeStore,
  subscribeToAccountDeletionRecovery,
} from './accountDeletionClientState';
import {
  acknowledgeAccountDeletionNotice,
  peekAccountDeletionNotice,
  queueAppleManualRevocationNotice,
  type AccountDeletionNotice,
} from './accountDeletionNotice';
import {
  acceptAccountDeletionAndSignOut,
  accountDeletionCleanupOptions,
  completeAccountDeletionLocalSignOut,
  fetchAccountDeletionStatus,
  finalizeCompletedAccountDeletion,
  quarantineAccountDeletionSession,
  resolveAccountDeletionRecoveryOwnership,
  type AccountDeletionStatusOutcome,
} from './accountDeletionRecovery';
import {
  deleteAccount,
  isAcceptedAccountDeletionLocalSignOutIncomplete,
  isAccountDeletionAuthSessionUnavailable,
} from './actions';

type RecoveryView =
  | { kind: 'loading' | 'checking' }
  | { kind: 'manual_notice' }
  | {
      kind: 'pending';
      status: 'pending' | 'delayed';
      phase: string;
      nextPollAfterSeconds: number;
    }
  | { kind: 'invalid'; retryable: boolean }
  | { kind: 'expired' }
  | { kind: 'error' }
  | { kind: 'ready' };

type AccountDeletionRecoveryFixture =
  | 'pending_then_completed_manual'
  | 'invalid'
  | 'invalid_support_only'
  | 'expired';

const COPY = {
  loading: 'Checking account deletion...',
  checking: 'Checking the saved deletion request...',
  eyebrow: 'Account activity paused',
  pendingTitle: 'Deleting your account',
  pendingBody:
    'Your deletion request is safely queued. This device will keep checking, and account activity stays paused until completion is verified.',
  delayedBody:
    'Your deletion needs more time. Your recovery key is still saved and account activity stays paused while we verify completion.',
  invalidTitle: 'Deletion status could not be verified',
  invalidBody:
    'This device kept the saved recovery key and did not reopen the account. Retry the deletion request or check again. If that does not work, contact support.',
  invalidSupportBody:
    'This device kept the saved recovery key and did not reopen the account, but the original authenticated retry session is no longer available. Check status again or contact support.',
  expiredTitle: 'Deletion receipt needs support',
  expiredBody:
    'The server receipt expired before this device could verify it. We kept the saved recovery information and did not reopen the account. Contact support before creating or using another account.',
  errorTitle: 'Deletion recovery is temporarily unavailable',
  errorBody:
    'Your saved recovery information is still on this device and account activity remains paused. Check again when you have a connection, or contact support.',
} as const;

function accountDeletionRecoveryFixture(): AccountDeletionRecoveryFixture | null {
  if (Platform.OS !== 'web' || typeof __DEV__ === 'undefined' || !__DEV__) return null;
  const value = process.env.EXPO_PUBLIC_E2E_ACCOUNT_DELETION_RECOVERY;
  if (
    value === 'pending_then_completed_manual' ||
    value === 'invalid' ||
    value === 'invalid_support_only' ||
    value === 'expired'
  ) {
    return value;
  }
  return null;
}

function pendingView(
  outcome: Extract<AccountDeletionStatusOutcome, { kind: 'pending' }>,
): RecoveryView {
  return {
    kind: 'pending',
    status: outcome.status,
    phase: outcome.phase,
    nextPollAfterSeconds: outcome.nextPollAfterSeconds,
  };
}

export function AccountDeletionRecoveryGate({ children }: { children: ReactNode }) {
  const fixture = accountDeletionRecoveryFixture();
  const [view, setView] = useState<RecoveryView>({ kind: 'loading' });
  const [retryNonce, setRetryNonce] = useState(0);
  const [wakeRevision, setWakeRevision] = useState(0);
  const [retryingIntake, setRetryingIntake] = useState(false);
  const [supportUnavailable, setSupportUnavailable] = useState(false);
  const [appleInstructionsUnavailable, setAppleInstructionsUnavailable] = useState(false);
  const [manualNotice, setManualNotice] = useState<AccountDeletionNotice | null>(null);

  useEffect(
    () =>
      subscribeToAccountDeletionRecovery(() => {
        setWakeRevision((revision) => revision + 1);
      }),
    [],
  );

  useEffect(() => {
    let active = true;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    async function recover(): Promise<void> {
      setSupportUnavailable(false);

      if (fixture) {
        if (fixture === 'pending_then_completed_manual' && retryNonce === 0) {
          setView({
            kind: 'pending',
            status: 'pending',
            phase: 'provider_verifying',
            nextPollAfterSeconds: 30,
          });
          return;
        }
        if (fixture === 'invalid') {
          setView({ kind: 'invalid', retryable: true });
          return;
        }
        if (fixture === 'invalid_support_only') {
          setView({ kind: 'invalid', retryable: false });
          return;
        }
        if (fixture === 'expired') {
          setView({ kind: 'expired' });
          return;
        }

        setManualNotice(queueAppleManualRevocationNotice());
        setView({ kind: 'manual_notice' });
        return;
      }

      // SecureStore is unavailable on Expo web. An iOS deletion request cannot
      // cross onto this separate browser runtime, so the normal web app opens
      // only after explicitly resolving its process-local startup barrier.
      if (Platform.OS === 'web') {
        resolveAccountDeletionStartupWithoutNativeStore();
        setView({ kind: 'ready' });
        return;
      }

      try {
        setView({ kind: 'checking' });
        const record = await loadPendingAccountDeletion();
        if (!active) return;
        if (!record) {
          setView({ kind: 'ready' });
          return;
        }

        const ownership = await resolveAccountDeletionRecoveryOwnership(record);
        if (!active) return;
        const cleanupOptions = accountDeletionCleanupOptions(ownership);

        if (record.state === 'completed') {
          const finalized = await finalizeCompletedAccountDeletion(
            record,
            undefined,
            cleanupOptions,
          );
          if (!active) return;
          if (finalized === 'manual_notice_pending') {
            setManualNotice(peekAccountDeletionNotice() ?? queueAppleManualRevocationNotice());
            setView({ kind: 'manual_notice' });
          } else {
            setView({ kind: 'ready' });
          }
          return;
        }

        // Every durable record keeps the product/Auth/vendor tree unmounted.
        // Only retry-capable states retain encrypted Supabase auth; all other
        // states clear in-memory and persisted auth before status polling.
        let recoveryRecord: AccountDeletionClientRecord = record;
        if (canRetryAccountDeletionIntake(record) && ownership.session !== 'match') {
          recoveryRecord = await markAccountDeletionRetryUnavailable();
          await completeAccountDeletionLocalSignOut(undefined, cleanupOptions);
        } else if (canRetryAccountDeletionIntake(record)) {
          await quarantineAccountDeletionSession(undefined, {
            clearIsolatedState: cleanupOptions.clearIsolatedState,
          });
        } else {
          await completeAccountDeletionLocalSignOut(undefined, cleanupOptions);
        }
        if (!active) return;

        const outcome = await fetchAccountDeletionStatus(recoveryRecord.statusCapability);
        if (!active) return;
        if (outcome.kind === 'completed') {
          const committed = await commitCompletedAccountDeletion(outcome.notice);
          const finalized = await finalizeCompletedAccountDeletion(
            committed,
            undefined,
            cleanupOptions,
          );
          if (!active) return;
          if (finalized === 'manual_notice_pending') {
            setManualNotice(peekAccountDeletionNotice() ?? queueAppleManualRevocationNotice());
            setView({ kind: 'manual_notice' });
          } else {
            setView({ kind: 'ready' });
          }
          return;
        }
        if (outcome.kind === 'invalid' || outcome.kind === 'expired') {
          const unresolved = await commitUnresolvedAccountDeletion(outcome.kind);
          const retryable = canRetryAccountDeletionIntake(unresolved);
          if (!retryable) {
            await completeAccountDeletionLocalSignOut(undefined, cleanupOptions);
          }
          if (active) {
            setView(
              outcome.kind === 'invalid' ? { kind: 'invalid', retryable } : { kind: 'expired' },
            );
          }
          return;
        }

        if (canRetryAccountDeletionIntake(recoveryRecord)) {
          await acceptAccountDeletionAndSignOut(recoveryRecord, undefined, cleanupOptions);
        }
        if (!active) return;
        setView(pendingView(outcome));
        pollTimer = setTimeout(() => {
          if (active) setRetryNonce((nonce) => nonce + 1);
        }, outcome.nextPollAfterSeconds * 1_000);
      } catch {
        if (active) setView({ kind: 'error' });
      }
    }

    void recover();
    return () => {
      active = false;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [fixture, retryNonce, wakeRevision]);

  const checkAgain = useCallback(() => {
    setView({ kind: 'checking' });
    setRetryNonce((nonce) => nonce + 1);
  }, []);

  const retryIntake = useCallback(async () => {
    if (retryingIntake) return;
    if (fixture) {
      // Development fixtures must never issue a destructive request. Re-run
      // only the fixture state transition so the retry control is testable.
      checkAgain();
      return;
    }
    setRetryingIntake(true);
    setView({ kind: 'checking' });
    try {
      await deleteAccount(completeAccountDeletionLocalSignOut);
    } catch (error) {
      if (isAcceptedAccountDeletionLocalSignOutIncomplete(error)) {
        // HTTP 202 was already explicit acceptance. Never surface intake retry
        // even if the acceptance-state write or a cleanup stage was ambiguous.
        try {
          const record = await loadPendingAccountDeletion();
          if (record && canRetryAccountDeletionIntake(record)) {
            await markAccountDeletionRetryUnavailable();
          }
          if (record) {
            const ownership = await resolveAccountDeletionRecoveryOwnership(record);
            await completeAccountDeletionLocalSignOut(
              undefined,
              accountDeletionCleanupOptions(ownership),
            );
          }
        } catch {
          // The durable gate remains closed and the generic recovery state
          // continues to offer capability polling/support, not intake retry.
        }
        setView({ kind: 'error' });
      } else if (isAccountDeletionAuthSessionUnavailable(error)) {
        try {
          const record = await markAccountDeletionRetryUnavailable();
          const ownership = await resolveAccountDeletionRecoveryOwnership(record);
          await completeAccountDeletionLocalSignOut(
            undefined,
            accountDeletionCleanupOptions(ownership),
          );
          setView({ kind: 'invalid', retryable: false });
        } catch {
          setView({ kind: 'error' });
        }
      } else {
        setView({ kind: 'invalid', retryable: true });
      }
    } finally {
      setRetryingIntake(false);
    }
  }, [checkAgain, fixture, retryingIntake]);

  const openSupport = useCallback(async () => {
    setSupportUnavailable(false);
    const opened = await openExternalHttpsUrl(POLICY_LINKS.support.url, {
      mode: 'browser',
      alertOnFailure: false,
    });
    if (!opened) setSupportUnavailable(true);
  }, []);

  const openAppleInstructions = useCallback(async () => {
    setAppleInstructionsUnavailable(false);
    const opened = await openExternalHttpsUrl(manualNotice?.instructionUrl, {
      mode: 'browser',
      alertOnFailure: false,
    });
    if (!opened) setAppleInstructionsUnavailable(true);
  }, [manualNotice]);

  const acknowledgeManualNotice = useCallback(async () => {
    const notice = manualNotice;
    if (!notice) {
      setView({ kind: 'error' });
      return;
    }
    setView({ kind: 'checking' });
    try {
      if (fixture) resolveAccountDeletionStartupWithoutNativeStore();
      else await clearCompletedAccountDeletionState();
      acknowledgeAccountDeletionNotice(notice);
      setManualNotice(null);
      setView({ kind: 'ready' });
    } catch {
      setView({ kind: 'error' });
    }
  }, [fixture, manualNotice]);

  if (view.kind === 'ready') return children;

  if (view.kind === 'loading' || view.kind === 'checking') {
    return (
      <Screen>
        <View
          accessibilityLabel={view.kind === 'loading' ? COPY.loading : COPY.checking}
          accessibilityLiveRegion="polite"
          className="flex-1 items-center justify-center"
        >
          <Text variant="bodySm" tone="muted" className="text-center">
            {view.kind === 'loading' ? COPY.loading : COPY.checking}
          </Text>
        </View>
      </Screen>
    );
  }

  if (view.kind === 'manual_notice' && manualNotice) {
    return (
      <Screen>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 28 }}
          showsVerticalScrollIndicator={false}
        >
          <Card>
            <View
              accessible
              accessibilityLabel={`Account deleted. ${manualNotice.title}. ${manualNotice.message}`}
              accessibilityLiveRegion="assertive"
              accessibilityRole="alert"
            >
              <Text variant="label" tone="clay" className="text-center">
                Account deletion completed
              </Text>
              <Text variant="title" className="mt-3 text-center">
                {manualNotice.title}
              </Text>
              <Text variant="bodySm" tone="muted" className="mt-3 text-center">
                {manualNotice.message}
              </Text>
            </View>
            <Button
              className="mt-6"
              label="Open Apple instructions"
              onPress={() => void openAppleInstructions()}
            />
            {appleInstructionsUnavailable ? (
              <Text
                accessibilityRole="alert"
                variant="bodySm"
                tone="muted"
                className="mt-3 text-center"
              >
                Apple Support could not open. Use the iPhone Settings steps above.
              </Text>
            ) : null}
            <Button
              className="mt-2"
              label="Continue"
              variant="ghost"
              onPress={() => void acknowledgeManualNotice()}
            />
          </Card>
        </ScrollView>
      </Screen>
    );
  }

  const pending = view.kind === 'pending';
  const title = pending
    ? COPY.pendingTitle
    : view.kind === 'invalid'
      ? COPY.invalidTitle
      : view.kind === 'expired'
        ? COPY.expiredTitle
        : COPY.errorTitle;
  const body = pending
    ? view.status === 'delayed'
      ? COPY.delayedBody
      : COPY.pendingBody
    : view.kind === 'invalid'
      ? view.retryable
        ? COPY.invalidBody
        : COPY.invalidSupportBody
      : view.kind === 'expired'
        ? COPY.expiredBody
        : COPY.errorBody;

  return (
    <Screen>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <View accessibilityLiveRegion="polite" accessibilityRole="alert">
            <Text variant="label" tone="clay" className="text-center">
              {COPY.eyebrow}
            </Text>
            <Text variant="title" className="mt-3 text-center">
              {title}
            </Text>
            <Text variant="bodySm" tone="muted" className="mt-3 text-center">
              {body}
            </Text>
            {pending ? (
              <Text variant="bodySm" tone="muted" className="mt-2 text-center">
                Next automatic check in about {view.nextPollAfterSeconds} seconds.
              </Text>
            ) : null}
          </View>

          <Button className="mt-6" label="Check status now" onPress={checkAgain} />
          {view.kind === 'invalid' && view.retryable ? (
            <Button
              className="mt-2"
              label={retryingIntake ? 'Retrying...' : 'Retry deletion request'}
              variant="ghost"
              disabled={retryingIntake}
              onPress={() => void retryIntake()}
            />
          ) : null}
          {pending ? null : (
            <Button
              className="mt-2"
              label="Open support"
              variant="ghost"
              onPress={() => void openSupport()}
            />
          )}
          {supportUnavailable ? (
            <Text
              accessibilityRole="alert"
              variant="bodySm"
              tone="muted"
              className="mt-3 text-center"
            >
              Support could not open. Keep this screen and try again when you have a connection.
            </Text>
          ) : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}
