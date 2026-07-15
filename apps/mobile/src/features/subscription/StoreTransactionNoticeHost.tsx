import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { useAppLock } from '@/lib/applock/AppLockProvider';
import { useAuth } from '@/lib/auth/AuthProvider';
import { env } from '@/lib/env';
import { productionUrlReady } from '@/lib/launch/phase8';
import {
  MANAGE_SUBSCRIPTION_URL_ANDROID,
  MANAGE_SUBSCRIPTION_URL_IOS,
  showNativeManageSubscriptions,
} from '@/lib/iap/revenuecat';
import {
  readStoreTransactionNotice,
  seedStoreTransactionNoticeE2E,
  shouldSeedStoreTransactionNoticeE2E,
  storeTransactionRecoveryMessage,
  subscribeToStoreTransactionNotice,
  type StoreTransactionNoticeView,
} from '@/lib/iap/storeTransactionNotice';
import { safeExternalHttpsUrl } from '@/lib/navigation/externalUrl';
import { openExternalHttpsUrl } from '@/lib/navigation/externalOpen';
import { colors } from '@/theme/tokens';

import { useEntitlementActions } from './useEntitlement';
import { subscriptionStorefrontCopy } from './storefrontCopy';

type NoticeState =
  | { kind: 'loading' }
  | { kind: 'storage_unavailable' }
  | { kind: 'ready'; notice: StoreTransactionNoticeView | null };

const CHECK_FAILED_MESSAGE =
  'We could not safely confirm the store status. Do not buy again. Keep this account open and try Restore purchases again.';

export function StoreTransactionNoticeHost() {
  const { initializing, user } = useAuth();

  if (initializing || !user) return null;
  return <OwnerStoreTransactionNoticeHost key={user.id} ownerUserId={user.id} />;
}

function OwnerStoreTransactionNoticeHost({ ownerUserId }: { ownerUserId: string }) {
  const storefrontCopy = subscriptionStorefrontCopy(Platform.OS);
  const { restore } = useEntitlementActions();
  const { appUnlocked } = useAppLock();
  const { height } = useWindowDimensions();
  const [state, setState] = useState<NoticeState>({ kind: 'loading' });
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [suppressedForForeground, setSuppressedForForeground] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const loadGeneration = useRef(0);
  const fixtureSeeded = useRef(false);

  const refresh = useCallback(async () => {
    const generation = ++loadGeneration.current;
    try {
      const notice = await readStoreTransactionNotice(ownerUserId);
      if (generation === loadGeneration.current) setState({ kind: 'ready', notice });
    } catch {
      if (generation === loadGeneration.current) setState({ kind: 'storage_unavailable' });
    }
  }, [ownerUserId]);

  useEffect(() => {
    // Enter through a microtask so the effect establishes the owner cleanup
    // boundary before an immediately-resolving storage adapter can publish.
    void Promise.resolve().then(refresh);
    return () => {
      // Invalidate every read issued for the unmounted/previous owner so it
      // cannot publish into a later notice identity.
      loadGeneration.current += 1;
    };
  }, [refresh]);

  useEffect(() => {
    if (fixtureSeeded.current || !shouldSeedStoreTransactionNoticeE2E()) return;
    fixtureSeeded.current = true;
    void seedStoreTransactionNoticeE2E(ownerUserId).then(
      () => void refresh(),
      () => void refresh(),
    );
  }, [ownerUserId, refresh]);

  useEffect(
    () =>
      subscribeToStoreTransactionNotice(({ attention }) => {
        if (attention) {
          setSuppressedForForeground(false);
          // Feedback describes the notice that was visible when the action ran.
          // Never carry it into a later warning identity for this mounted owner.
          setFeedback(null);
        }
        void refresh();
      }),
    [refresh],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setAppState(nextState);
      if (nextState !== 'active') return;
      setSuppressedForForeground(false);
      setFeedback(null);
      void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  if (
    !appUnlocked ||
    appState !== 'active' ||
    state.kind === 'loading' ||
    suppressedForForeground
  ) {
    return null;
  }
  const notice = state.kind === 'ready' ? state.notice : null;
  if (state.kind === 'ready' && notice === null) return null;

  const exactOwner = notice?.kind === 'owner_pending';
  const paymentPending = exactOwner && notice.reason === 'payment_pending';
  const anotherAccount = notice?.kind === 'another_account_pending';
  const deletedAccount = notice?.kind === 'deleted_account_pending';
  const canRestore = exactOwner || deletedAccount;
  const storageUnavailable = state.kind === 'storage_unavailable';
  const title = paymentPending
    ? 'Store approval is still pending'
    : exactOwner
      ? 'Store transaction completion unconfirmed'
      : deletedAccount
        ? 'Deleted-account purchase needs checking'
        : anotherAccount
          ? 'Purchase status needs checking'
          : 'Purchase safety check unavailable';
  const body = paymentPending
    ? 'The store says this purchase is waiting for approval or another required step. Follow the store instructions and do not buy again. The status may update later; use Restore purchases to check again.'
    : exactOwner
      ? 'The store transaction may have completed, but we could not safely confirm it for this account. Do not buy again until Restore purchases checks the status.'
      : deletedAccount
        ? 'A recently deleted account may still have a store purchase that needs confirmation. Do not buy again. Use Restore purchases first. You can also manage subscriptions in store settings or contact support, but opening settings alone does not clear this safety block.'
        : anotherAccount
          ? 'A store transaction on this device still needs confirmation. Do not buy again. Sign in to the account used at checkout and use Restore purchases first.'
          : 'We could not safely read the saved store transaction status. Do not buy again until the app can check it.';

  function acknowledge() {
    setFeedback(null);
    // Dismissal is intentionally process-local. Do not retain a behavioral
    // timestamp or create a storage failure path for a foreground-only choice.
    setSuppressedForForeground(true);
  }

  function checkWithRestore() {
    if (!canRestore) return;
    setFeedback(null);
    restore.mutate(undefined, {
      onSuccess: (result) => {
        setFeedback(
          !result.active && paymentPending
            ? 'The store check completed, but approval is still unresolved. Do not buy again. Follow the store instructions or contact support.'
            : !result.active && deletedAccount
              ? 'The store check completed without active access, but the deleted-account safety block remains. Do not buy again; use store settings or contact support.'
              : null,
        );
        void refresh();
      },
      onError: (error) => {
        setFeedback(storeTransactionRecoveryMessage(error, 'restore') ?? CHECK_FAILED_MESSAGE);
      },
    });
  }

  async function openSubscriptionManagement() {
    setFeedback(null);
    const openedNative = await showNativeManageSubscriptions();
    const fallbackUrl =
      Platform.OS === 'android' ? MANAGE_SUBSCRIPTION_URL_ANDROID : MANAGE_SUBSCRIPTION_URL_IOS;
    const opened =
      openedNative ||
      (await openExternalHttpsUrl(fallbackUrl, { mode: 'linking', alertOnFailure: false }));
    setFeedback(
      opened
        ? 'Subscription management opened. Return here and use Restore purchases; opening settings does not clear the safety block.'
        : `${storefrontCopy.managementUnavailable} The safety block remains on.`,
    );
  }

  async function openSupport() {
    setFeedback(null);
    const supportUrl = productionUrlReady(env.supportUrl)
      ? safeExternalHttpsUrl(env.supportUrl)
      : null;
    if (!supportUrl) {
      setFeedback(
        'Support is not configured in this build. The safety block remains on; use Restore purchases or your store subscription settings.',
      );
      return;
    }
    const opened = await openExternalHttpsUrl(supportUrl, { alertOnFailure: false });
    setFeedback(
      opened
        ? 'Support opened. Return here and use Restore purchases; contacting support does not clear the safety block.'
        : 'Support could not be opened. The safety block remains on.',
    );
  }

  return (
    <Modal
      transparent
      animationType="fade"
      visible
      statusBarTranslucent
      onRequestClose={acknowledge}
    >
      <SafeAreaView
        className="flex-1 justify-end px-4 pb-4"
        style={{ backgroundColor: 'rgba(32,27,21,0.58)' }}
      >
        <View
          accessibilityViewIsModal
          className="rounded-card bg-paper-raised"
          style={{
            borderWidth: 1,
            borderColor: colors.hairlineStrong,
            maxHeight: Math.max(240, Math.floor(height * 0.78)),
          }}
        >
          <ScrollView
            bounces={false}
            contentContainerStyle={{ padding: 20 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text variant="eyebrow" style={{ color: colors.clayDeep }}>
              Purchase safety
            </Text>
            <Text accessibilityRole="header" variant="titleSm" className="mt-2">
              {title}
            </Text>
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              variant="bodySm"
              className="mt-2"
              style={{ color: colors.mutedStrong }}
            >
              {body}
            </Text>
            {feedback ? (
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                variant="bodySm"
                className="mt-3"
                style={{ color: colors.clayDeep }}
              >
                {feedback}
              </Text>
            ) : null}
            {canRestore ? (
              <Button
                label={
                  restore.isPending ? 'Checking purchase status...' : 'Check with Restore purchases'
                }
                disabled={restore.isPending}
                className="mt-5"
                onPress={checkWithRestore}
              />
            ) : storageUnavailable ? (
              <Button
                label="Try safety check again"
                className="mt-5"
                onPress={() => {
                  setState({ kind: 'loading' });
                  void refresh();
                }}
              />
            ) : null}
            {deletedAccount || paymentPending ? (
              <View className="mt-1">
                <Button
                  label="Manage store subscription"
                  variant="ghost"
                  className="min-h-[48px] py-2"
                  onPress={() => void openSubscriptionManagement()}
                />
                <Button
                  label="Contact support"
                  variant="ghost"
                  className="min-h-[48px] py-2"
                  onPress={() => void openSupport()}
                />
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Reminds you again when the app returns to the foreground."
              onPress={acknowledge}
              className="mt-2 min-h-[48px] items-center justify-center px-4 py-2"
            >
              <Text className="font-sans-semibold" style={{ color: colors.mutedStrong }}>
                Not now — keep purchase blocked
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
