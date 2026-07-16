import { useQuery } from '@tanstack/react-query';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Screen, StateNotice, Text } from '@/components/ui';
import {
  classifyOnboardingStatusFailure,
  decideWelcomeOnboardingGate,
  onboardingStatusQueryOptions,
} from '@/features/onboarding/onboardingStatusQuery';
import {
  decideAnonymousOnboardingHandoff,
  isAnonymousOnboardingRequestSuperseded,
} from '@/features/onboarding/welcomeSessionHandoff';
import { track } from '@/lib/analytics/track';
import { useAuth } from '@/lib/auth/AuthProvider';
import { isSupabaseConfigured } from '@/lib/env';
import { isOwnerQueryScopeCurrent } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';

function shouldRunE2ELocalReset(value: string | string[] | undefined): boolean {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return false;
  if (process.env.EXPO_PUBLIC_E2E_LOCAL_RESET !== '1') return false;
  return value === 'local';
}

// 01 · Welcome. The anonymous session starts silently here (docs/01 §1/§2).
// Also acts as the entry gate: a returning user who already finished onboarding
// (a completed skin_profile exists) is sent straight to Today.
export default function WelcomeScreen() {
  const params = useLocalSearchParams<{ e2eReset?: string }>();
  const {
    anonymousOnboardingHandoff,
    completedSessionPublication,
    ensureAnonymousSession,
    initializing,
    isAnonymousOnboardingHandoffCurrent,
    registerAnonymousOnboardingConsumer,
    resetLocalStateForE2E,
    session,
    settleAnonymousOnboardingHandoff,
  } = useAuth();
  const isFocused = useIsFocused();
  const ownerScope = useOwnerQueryScope();
  const activeWelcomeRef = useRef(false);
  const beginRequestSeqRef = useRef(0);
  const e2eResetRequestStartedRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [beginError, setBeginError] = useState(false);
  const resetting = shouldRunE2ELocalReset(params.e2eReset);
  const accountActionPending = busy || anonymousOnboardingHandoff !== null;

  useEffect(() => {
    let effectActive = true;
    const resetLocalBeginState = () => {
      void Promise.resolve().then(() => {
        if (!effectActive) return;
        setBusy(false);
        setBeginError(false);
      });
    };
    if (!isFocused) {
      activeWelcomeRef.current = false;
      beginRequestSeqRef.current += 1;
      resetLocalBeginState();
      return () => {
        effectActive = false;
      };
    }
    activeWelcomeRef.current = true;
    resetLocalBeginState();
    const unregisterConsumer = registerAnonymousOnboardingConsumer();
    return () => {
      effectActive = false;
      activeWelcomeRef.current = false;
      beginRequestSeqRef.current += 1;
      unregisterConsumer();
    };
  }, [isFocused, registerAnonymousOnboardingConsumer]);

  useEffect(() => {
    if (!shouldRunE2ELocalReset(params.e2eReset)) return;
    if (e2eResetRequestStartedRef.current) return;
    e2eResetRequestStartedRef.current = true;
    // AuthProvider owns the destructive boundary. A rejection deliberately
    // remains behind SessionBoundaryGate, whose accessible retry re-enters the
    // same serialized reset instead of letting this route fail open.
    void resetLocalStateForE2E().catch(() => undefined);
  }, [params.e2eReset, resetLocalStateForE2E]);

  // Onboarding-completion check as a query (no setState-in-effect). Reads the
  // local-first completion record FIRST (the v1 source of truth, D-029): a
  // returning onboarded user is recognized even with no backend, so a failed or
  // absent server write never re-onboards them. Falls back to the server row.
  const onboarded = useQuery({
    ...onboardingStatusQueryOptions(ownerScope),
    enabled:
      isFocused && !resetting && !initializing && (!!session || !isSupabaseConfigured),
  });

  const checkingOnboarding = !!session || !isSupabaseConfigured;
  const ownerScopeCurrent = isOwnerQueryScopeCurrent(ownerScope);
  const onboardingGate = decideWelcomeOnboardingGate({
    data: onboarded.data,
    initializing,
    isError: onboarded.isError,
    isFetching: onboarded.isFetching,
    isSuccess: onboarded.isSuccess,
    ownerScopeCurrent,
    resetting,
    shouldCheck: checkingOnboarding,
  });

  useEffect(() => {
    if (!isFocused || !activeWelcomeRef.current) return;
    const pending = anonymousOnboardingHandoff;
    if (onboardingGate === 'redirect_today') {
      if (pending) settleAnonymousOnboardingHandoff(pending.requestId);
      router.replace('/today');
      return;
    }
    if (!pending || pending.phase === 'resolving') return;

    const decision = decideAnonymousOnboardingHandoff({
      completedSessionPublication,
      initializing,
      mounted: activeWelcomeRef.current,
      onboardingGate,
      ownerScopeCurrent,
      pending,
      publishedUserId: session?.user.id ?? null,
      requestIsLatest: isAnonymousOnboardingHandoffCurrent(pending.requestId),
    });
    if (decision === 'cancel') {
      settleAnonymousOnboardingHandoff(pending.requestId);
      setBusy(false);
      return;
    }
    if (
      decision === 'navigate' &&
      settleAnonymousOnboardingHandoff(pending.requestId)
    ) {
      router.push('/onboarding/age');
    }
  }, [
    anonymousOnboardingHandoff,
    completedSessionPublication,
    initializing,
    isAnonymousOnboardingHandoffCurrent,
    isFocused,
    onboardingGate,
    ownerScopeCurrent,
    session?.user.id,
    settleAnonymousOnboardingHandoff,
  ]);

  async function begin() {
    const requestId = ++beginRequestSeqRef.current;
    setBusy(true);
    setBeginError(false);
    track('onboarding_started');
    try {
      const handoff = await ensureAnonymousSession();
      if (!activeWelcomeRef.current || requestId !== beginRequestSeqRef.current) return;
      if (handoff) return;
    } catch (error) {
      if (!activeWelcomeRef.current || requestId !== beginRequestSeqRef.current) return;
      if (isAnonymousOnboardingRequestSuperseded(error)) {
        setBusy(false);
        return;
      }
      if (isSupabaseConfigured) {
        setBusy(false);
        setBeginError(true);
        return;
      }
    }
    setBusy(false);
    // Neutral DOB age gate (docs/01 §4) precedes any data collection; it self-skips
    // to goals if this device already passed it.
    router.push('/onboarding/age');
  }

  // Stay on splash while deciding; render nothing while redirecting an onboarded user.
  if (onboardingGate === 'checking' || onboardingGate === 'redirect_today') return null;

  if (onboardingGate === 'error') {
    const failureKind = classifyOnboardingStatusFailure(onboarded.error);
    const title =
      failureKind === 'unsupported_profile'
        ? 'This saved profile needs a newer version of OnSkin.'
        : failureKind === 'invalid_profile'
          ? 'We found saved profile data we can\'t safely read.'
          : 'We couldn\'t safely check your progress.';
    const body =
      failureKind === 'unsupported_profile'
        ? 'Your saved profile was preserved unchanged. Update OnSkin, then check again.'
        : failureKind === 'invalid_profile'
          ? 'Your saved profile was preserved unchanged. Try again, and contact support before resetting local data if this continues.'
          : 'Your saved skincare data was not changed. Check your connection and private storage, then try again.';
    return (
      <Screen>
        <View className="flex-1 justify-center">
          <StateNotice
            kind={failureKind === 'invalid_profile' ? 'corrupt' : 'unavailable'}
            presentation="plain"
            title={title}
            body={body}
          >
            <Button
              accessibilityLabel="Retry checking onboarding progress"
              className="mt-7"
              disabled={onboarded.isFetching}
              label={onboarded.isFetching ? 'Trying again...' : 'Try again'}
              onPress={() => void onboarded.refetch()}
            />
          </StateNotice>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="flex-1 justify-center">
        <Text variant="display">
          Healthier skin in eight weeks, built around{' '}
          <Text variant="display" italic tone="clay">
            your
          </Text>{' '}
          skin.
        </Text>
        <Text variant="body" tone="muted" className="mt-4">
          A routine that fits what&apos;s already on your shelf. And photos that never leave your
          phone.
        </Text>
      </View>
      <View className="pb-4">
        {beginError ? (
          <StateNotice
            kind="error"
            compact
            align="center"
            className="mb-4"
            title="Private session not started"
            body="We couldn't start your private session. Check your connection and try again."
          />
        ) : null}
        <Button
          label={beginError ? 'Try again' : 'Begin'}
          onPress={begin}
          disabled={accountActionPending}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: accountActionPending }}
          className={`mt-3 items-center py-3 ${accountActionPending ? 'opacity-50' : ''}`}
          disabled={accountActionPending}
          onPress={() => router.push('/onboarding/account')}
        >
          <Text variant="body" tone="muted" className="font-sans-medium">
            I already have an account
          </Text>
        </Pressable>
        <Text variant="label" tone="clay" className="mt-2 text-center">
          No ads · no data sales · photos stay on device
        </Text>
      </View>
    </Screen>
  );
}
