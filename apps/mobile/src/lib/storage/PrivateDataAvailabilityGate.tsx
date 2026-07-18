import { router, useUnstableGlobalHref, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, StateLoading, StateNotice } from '@/components/ui';
import { useAppLock } from '@/lib/applock/AppLockProvider';
import { markStartupPhase } from '@/lib/observability/operationTiming';
import { colors } from '@/theme/tokens';

import { assertPrivateKVReadable } from './privateKV';

const PRIVATE_STORAGE_COPY = {
  loading: 'Opening your private data...',
  eyebrow: 'Private storage',
  title: 'Your private data could not open.',
  body: "We couldn't read encrypted data on this phone. Nothing was changed. Try again when your phone's secure storage is available.",
  retry: 'Try again',
  retrying: 'Trying again...',
  retryFailed: 'It is still unavailable. Your encrypted data remains unchanged.',
} as const;

type Availability = 'waiting' | 'checking' | 'restoring' | 'ready' | 'error';
type VerificationReason = 'initial' | 'foreground' | 'retry';

let e2ePrivateStorageFailureConsumed = false;
let e2ePrivateStorageForegroundFailureConsumed = false;

function e2ePrivateStorageFailure(reason: VerificationReason): Error | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  const fixture = process.env.EXPO_PUBLIC_E2E_PRIVATE_STORAGE_FAILURE;
  if (fixture === 'unavailable') return new Error('E2E_PRIVATE_STORAGE_UNAVAILABLE');
  if (fixture === 'unavailable_once' && !e2ePrivateStorageFailureConsumed) {
    e2ePrivateStorageFailureConsumed = true;
    return new Error('E2E_PRIVATE_STORAGE_UNAVAILABLE');
  }
  if (
    fixture === 'foreground_once' &&
    reason === 'foreground' &&
    !e2ePrivateStorageForegroundFailureConsumed
  ) {
    e2ePrivateStorageForegroundFailureConsumed = true;
    return new Error('E2E_PRIVATE_STORAGE_UNAVAILABLE');
  }
  return null;
}

async function verifyPrivateStorage(reason: VerificationReason): Promise<void> {
  const fixtureError = e2ePrivateStorageFailure(reason);
  if (fixtureError) throw fixtureError;
  await assertPrivateKVReadable();
}

export function PrivateDataAvailabilityGate({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { appUnlocked } = useAppLock();
  const currentHref = useUnstableGlobalHref();
  const [availability, setAvailability] = useState<Availability>('waiting');
  const [retryFailed, setRetryFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const checkId = useRef(0);
  const currentHrefRef = useRef(currentHref);
  const recoveryHrefRef = useRef<string | null>(null);

  useEffect(() => {
    currentHrefRef.current = currentHref;
  }, [currentHref]);

  const check = useCallback(async (reason: VerificationReason) => {
    const fromRetry = reason === 'retry';
    const id = ++checkId.current;
    setRetryFailed(false);
    if (fromRetry) setRetrying(true);
    else {
      setRetrying(false);
      setAvailability('checking');
    }
    try {
      await verifyPrivateStorage(reason);
      if (checkId.current === id) {
        markStartupPhase('vault_decision_complete');
        setRetrying(false);
        setAvailability(recoveryHrefRef.current ? 'restoring' : 'ready');
      }
    } catch {
      if (checkId.current !== id) return;
      setRetrying(false);
      setRetryFailed(fromRetry);
      setAvailability('error');
    }
  }, []);

  useEffect(() => {
    if (!appUnlocked) return;
    const timer = setTimeout(() => void check('initial'), 0);
    return () => {
      clearTimeout(timer);
      checkId.current += 1;
    };
  }, [appUnlocked, check]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        if (appUnlocked) recoveryHrefRef.current = currentHrefRef.current;
        return;
      }
      if (appUnlocked) {
        recoveryHrefRef.current ??= currentHrefRef.current;
        void check('foreground');
      }
    });
    return () => subscription.remove();
  }, [appUnlocked, check]);

  useEffect(() => {
    if (availability !== 'restoring') return;
    const href = recoveryHrefRef.current;
    if (!href) {
      const readyTimer = setTimeout(() => setAvailability('ready'), 0);
      return () => clearTimeout(readyTimer);
    }

    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    const restoreTimer = setTimeout(() => {
      router.replace(href as Href);
      revealTimer = setTimeout(() => {
        recoveryHrefRef.current = null;
        setAvailability('ready');
      }, 0);
    }, 0);
    return () => {
      clearTimeout(restoreTimer);
      if (revealTimer) clearTimeout(revealTimer);
    };
  }, [availability]);

  if (appUnlocked && (availability === 'ready' || availability === 'restoring')) {
    const restoring = availability === 'restoring';
    return (
      <View className="flex-1" style={{ backgroundColor: colors.paper }}>
        <View
          accessibilityElementsHidden={restoring}
          importantForAccessibility={restoring ? 'no-hide-descendants' : 'auto'}
          className="flex-1"
          style={{ opacity: restoring ? 0 : 1, pointerEvents: restoring ? 'none' : 'auto' }}
        >
          {children}
        </View>
        {restoring ? (
          <View
            accessibilityLabel={PRIVATE_STORAGE_COPY.loading}
            accessibilityLiveRegion="polite"
            className="absolute inset-0 items-center justify-center px-7"
            style={{ backgroundColor: colors.paper }}
          >
            <StateLoading label={PRIVATE_STORAGE_COPY.loading} />
          </View>
        ) : null}
      </View>
    );
  }

  if (!appUnlocked || availability !== 'error') {
    return (
      <View
        accessibilityElementsHidden={!appUnlocked}
        accessibilityLabel={appUnlocked ? PRIVATE_STORAGE_COPY.loading : undefined}
        accessibilityLiveRegion="polite"
        importantForAccessibility={appUnlocked ? 'auto' : 'no-hide-descendants'}
        className="flex-1 items-center justify-center px-7"
        style={{ backgroundColor: colors.paper }}
      >
        {appUnlocked ? (
          <StateLoading label={PRIVATE_STORAGE_COPY.loading} />
        ) : null}
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 28,
        paddingTop: insets.top + 32,
        paddingBottom: insets.bottom + 32,
      }}
      showsVerticalScrollIndicator={false}
    >
      <StateNotice
        kind="unavailable"
        presentation="plain"
        align="center"
        title={PRIVATE_STORAGE_COPY.title}
        body={PRIVATE_STORAGE_COPY.body}
        detail={retryFailed ? PRIVATE_STORAGE_COPY.retryFailed : null}
        accessibilityLabel={`${PRIVATE_STORAGE_COPY.eyebrow}. ${PRIVATE_STORAGE_COPY.title}`}
      >
        <Button
          accessibilityLabel="Retry opening private storage"
          className="mt-7"
          disabled={retrying}
          label={retrying ? PRIVATE_STORAGE_COPY.retrying : PRIVATE_STORAGE_COPY.retry}
          onPress={() => void check('retry')}
        />
      </StateNotice>
    </ScrollView>
  );
}
