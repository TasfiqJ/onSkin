import { router, useSegments } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Pressable, View, type AppStateStatus } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { queryClient } from '@/lib/query/queryClient';
import { colors } from '@/theme/tokens';

import {
  AGE_POLICY_STATUS_QUERY_KEY,
  getAgePolicyReceiptStatus,
  type AgePolicyReceiptStatus,
} from './ageGateStore';
import {
  agePolicyRouteMayMountWithoutReceipt,
  consumePostAgeConsentRoute,
  isAgePolicyReverificationRequiredInSession,
} from './agePolicyRoute';

/**
 * Blocks protected route children before health lifecycle reconciliation or
 * navigation can mount them. Welcome remains available to start the app and
 * the age route remains available to commit a fresh minimized receipt.
 * Account-deletion recovery, Auth/session isolation, and App Lock stay outside
 * this gate in the root layout.
 */
export function AgePolicyGate({
  bootstrap,
  children,
}: {
  bootstrap: ReactNode;
  children: ReactNode;
}) {
  const segments = useSegments();
  const [retrying, setRetrying] = useState(false);
  const [receiptStatus, setReceiptStatus] = useState<AgePolicyReceiptStatus | 'checking'>(
    'checking',
  );
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const readGenerationRef = useRef(0);
  const mountedRef = useRef(false);
  const routeAllowedWithoutReceipt = agePolicyRouteMayMountWithoutReceipt(segments);
  const routeAllowedWithoutReceiptRef = useRef(routeAllowedWithoutReceipt);
  const unavailable = receiptStatus === 'unavailable';

  useEffect(() => {
    routeAllowedWithoutReceiptRef.current = routeAllowedWithoutReceipt;
  }, [routeAllowedWithoutReceipt]);

  const readActiveReceipt = useCallback(async (preserveUnavailableView = false) => {
    const readGeneration = ++readGenerationRef.current;
    if (!preserveUnavailableView) setReceiptStatus('checking');

    let nextStatus: AgePolicyReceiptStatus;
    try {
      nextStatus = await getAgePolicyReceiptStatus();
    } catch {
      // The store already converts read failures to unavailable, but retain a
      // closed boundary if that implementation ever regresses.
      nextStatus = 'unavailable';
    }
    if (nextStatus === 'current' && isAgePolicyReverificationRequiredInSession()) {
      nextStatus = 'missing';
    }

    if (
      !mountedRef.current ||
      appStateRef.current !== 'active' ||
      readGenerationRef.current !== readGeneration
    ) {
      return;
    }
    queryClient.setQueryData(AGE_POLICY_STATUS_QUERY_KEY, nextStatus);
    setReceiptStatus(nextStatus);
    setRetrying(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    appStateRef.current = AppState.currentState;
    if (appStateRef.current === 'active') void readActiveReceipt();

    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState !== 'active') {
        // Invalidate every pending read and synchronously close protected
        // providers before the app can later foreground with a stale receipt.
        readGenerationRef.current += 1;
        setRetrying(false);
        setReceiptStatus('checking');
        return;
      }
      if (previousState === 'active') return;

      // A foreground transition never trusts the infinite-lived query cache.
      // The closed checking state is published before private storage is read.
      void readActiveReceipt();
    });
    const unsubscribeReceiptPublication = queryClient.getQueryCache().subscribe((event) => {
      const publishedStatus = event.query.state.data;
      if (
        event.type !== 'updated' ||
        event.action.type !== 'success' ||
        event.query.queryKey.length !== AGE_POLICY_STATUS_QUERY_KEY.length ||
        !event.query.queryKey.every(
          (value: unknown, index: number) => value === AGE_POLICY_STATUS_QUERY_KEY[index],
        ) ||
        (publishedStatus !== 'current' &&
          publishedStatus !== 'missing' &&
          publishedStatus !== 'unavailable') ||
        (publishedStatus === 'current' && isAgePolicyReverificationRequiredInSession()) ||
        appStateRef.current !== 'active' ||
        !routeAllowedWithoutReceiptRef.current
      ) {
        return;
      }

      // The age route publishes current only after its durable eligible write.
      // It publishes a closed status before attempting a durable revocation, so
      // an older affirmative state cannot keep protected providers mounted
      // while that overwrite is pending or has failed. Incrementing the
      // generation also prevents an older receipt read from reopening them.
      readGenerationRef.current += 1;
      setRetrying(false);
      setReceiptStatus(publishedStatus);
    });

    return () => {
      mountedRef.current = false;
      readGenerationRef.current += 1;
      subscription.remove();
      unsubscribeReceiptPublication();
    };
  }, [readActiveReceipt]);

  useEffect(() => {
    if (receiptStatus === 'current') {
      if (consumePostAgeConsentRoute()) router.replace('/onboarding/consent');
      return;
    }
    if (routeAllowedWithoutReceipt || receiptStatus === 'checking' || unavailable) {
      return;
    }
    router.replace('/onboarding/age');
  }, [receiptStatus, routeAllowedWithoutReceipt, unavailable]);

  function retryReceiptRead() {
    if (retrying || appStateRef.current !== 'active') return;
    setRetrying(true);
    void readActiveReceipt(true);
  }

  if (unavailable) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-7">
          <Text variant="eyebrow" tone="clay" className="text-center">
            AGE CHECK
          </Text>
          <Text variant="title" className="mt-2 text-center">
            Your age confirmation could not open.
          </Text>
          <Text variant="bodySm" tone="muted" className="mt-3 text-center">
            Nothing was changed. Try again when this phone’s private storage is available.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: retrying }}
            disabled={retrying}
            onPress={retryReceiptRead}
            className="mt-7 min-h-[56px] items-center justify-center rounded-pill px-6 py-3"
            style={{ backgroundColor: colors.ink, opacity: retrying ? 0.68 : 1 }}
          >
            <Text className="font-sans-semibold" style={{ color: colors.paper, fontSize: 16 }}>
              {retrying ? 'Trying again…' : 'Try again'}
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (receiptStatus === 'current') return <>{children}</>;
  if (receiptStatus !== 'checking' && routeAllowedWithoutReceipt) return <>{bootstrap}</>;

  return (
    <Screen>
      <View
        accessibilityLabel="Checking age eligibility"
        accessibilityLiveRegion="polite"
        className="flex-1 items-center justify-center px-7"
      >
        <Text variant="bodySm" tone="muted" className="text-center">
          Checking age eligibility…
        </Text>
      </View>
    </Screen>
  );
}
