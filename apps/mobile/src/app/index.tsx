import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import {
  AGE_POLICY_STATUS_QUERY_KEY,
  getAgePolicyReceiptStatus,
} from '@/features/onboarding/ageGateStore';
import {
  applyCurrentServerSkinProfileFilters,
  CURRENT_SERVER_SKIN_PROFILE_SELECT,
  isServerSkinProfileFallbackPermitted,
  parseCurrentServerSkinProfile,
} from '@/features/onboarding/serverSkinProfile';
import { readStoredSkinProfile } from '@/features/onboarding/skinProfileStore';
import {
  acknowledgeAccountDeletionNotice,
  peekAccountDeletionNotice,
} from '@/features/settings/accountDeletionNotice';
import { clearLocalPrivateData } from '@/features/settings/localPrivateData';
import {
  LOCAL_PRIVATE_CONTROL_KEYS,
  LOCAL_PRIVATE_SECURE_CONTROL_KEY_PREFIXES,
  LOCAL_PRIVATE_SECURE_CONTROL_KEYS,
} from '@/features/settings/localPrivateDataKeys';
import { track } from '@/lib/analytics/track';
import { useAuth } from '@/lib/auth/AuthProvider';
import { runHealthDataWriteOperation } from '@/lib/consent/healthDataWriteAdmission';
import { isSupabaseConfigured } from '@/lib/env';
import { openExternalHttpsUrl } from '@/lib/navigation/externalOpen';
import { queryClient } from '@/lib/query/queryClient';
import { supabase } from '@/lib/supabase/client';

function shouldRunE2ELocalReset(value: string | string[] | undefined): boolean {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return false;
  if (process.env.EXPO_PUBLIC_E2E_LOCAL_RESET !== '1') return false;
  return value === 'local';
}

async function clearE2ELocalControlState(): Promise<void> {
  const storedKeys = await AsyncStorage.getAllKeys();
  const prefixedControlKeys = storedKeys.filter((key) =>
    LOCAL_PRIVATE_SECURE_CONTROL_KEY_PREFIXES.some((prefix) => key.startsWith(prefix)),
  );
  await AsyncStorage.multiRemove([
    ...LOCAL_PRIVATE_CONTROL_KEYS,
    ...LOCAL_PRIVATE_SECURE_CONTROL_KEYS,
    ...prefixedControlKeys,
  ]);
}

// 01 · Welcome. The anonymous session starts silently here (docs/01 §1/§2).
// Also acts as the entry gate: a returning user who already finished onboarding
// reaches Today only after the current age-policy receipt is verified.
export default function WelcomeScreen() {
  const params = useLocalSearchParams<{ e2eReset?: string }>();
  const { ensureAnonymousSession, session, initializing } = useAuth();
  const [accountDeletionNotice] = useState(peekAccountDeletionNotice);
  const [appleInstructionsUnavailable, setAppleInstructionsUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState(false);
  const [resetting, setResetting] = useState(() => shouldRunE2ELocalReset(params.e2eReset));

  useEffect(() => {
    if (!shouldRunE2ELocalReset(params.e2eReset)) return;
    let active = true;

    async function resetLocalState() {
      setResetting(true);
      try {
        await clearLocalPrivateData();
      } catch {
        // Dev-only E2E fixture reset; keep the app reachable if one cleanup backend is unavailable.
      }
      try {
        // Production cleanup deliberately preserves recovery controls. A
        // dev-only first-run fixture must remove them as well, otherwise a
        // completed withdrawal reopens the paused shell instead of Welcome.
        await clearE2ELocalControlState();
      } catch {
        // Keep the fixture reachable so the visible flow can expose any stale
        // control state instead of failing on a blank reset screen.
      }
      queryClient.clear();
      if (!active) return;
      setResetting(false);
      router.replace('/');
    }

    void resetLocalState();

    return () => {
      active = false;
    };
  }, [params.e2eReset]);

  // Resolve the minimized age-policy receipt before any profile-backed
  // onboarding check. Missing, legacy, stale, malformed, or unavailable receipt
  // bytes all fail closed. An unavailable read stays distinct so the root gate
  // can provide recovery instead of redirecting into a failing write.
  const agePolicy = useQuery({
    queryKey: AGE_POLICY_STATUS_QUERY_KEY,
    enabled: !resetting && !!session && !initializing,
    retry: 0,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: getAgePolicyReceiptStatus,
  });

  // Onboarding-completion check as a query (no setState-in-effect). The
  // local-first completion record remains the source of truth, but it must not
  // be read until the current age-policy receipt has been verified.
  const onboarded = useQuery({
    queryKey: ['onboarded', session?.user.id],
    enabled: !resetting && !!session && !initializing && agePolicy.data === 'current',
    retry: 0,
    queryFn: async () => {
      const expectedOwnerUserId = session?.user.id;
      if (!expectedOwnerUserId) return false;
      return runHealthDataWriteOperation(expectedOwnerUserId, async (lease) => {
        const local = await readStoredSkinProfile();
        lease.assertCurrent();
        if (local.status === 'available') return true;
        // Only a genuinely absent local profile permits a server fallback.
        // Invalid, legacy, future, mismatched, or unreadable local bytes remain
        // authoritative fail-closed states and require a fresh quiz/recovery.
        if (!isServerSkinProfileFallbackPermitted(local.status)) return false;
        if (!isSupabaseConfigured) return false;
        try {
          lease.assertCurrent();
          const { data, error } = await applyCurrentServerSkinProfileFilters(
            supabase.from('skin_profiles').select(CURRENT_SERVER_SKIN_PROFILE_SELECT),
          )
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          lease.assertCurrent();
          return !error && parseCurrentServerSkinProfile(data) !== null;
        } catch {
          // Supabase errors fail closed, while a generation/owner boundary must
          // still propagate instead of being mistaken for an absent profile.
          lease.assertCurrent();
          return false;
        }
      });
    },
  });

  useEffect(() => {
    if (resetting || initializing || !session || agePolicy.isLoading) return;
    if (agePolicy.data !== 'current' && agePolicy.data !== 'unavailable') {
      router.replace('/onboarding/age');
    }
  }, [agePolicy.data, agePolicy.isLoading, initializing, resetting, session]);

  useEffect(() => {
    if (agePolicy.data === 'current' && onboarded.data === true) router.replace('/today');
  }, [agePolicy.data, onboarded.data]);

  async function begin() {
    setBusy(true);
    setStartError(false);
    track('onboarding_started');
    const agePolicyStatus = await getAgePolicyReceiptStatus();
    queryClient.setQueryData(AGE_POLICY_STATUS_QUERY_KEY, agePolicyStatus);
    if (agePolicyStatus === 'unavailable') {
      setBusy(false);
      return;
    }
    if (agePolicyStatus !== 'current') {
      setBusy(false);
      router.push('/onboarding/age');
      return;
    }
    try {
      await ensureAnonymousSession();
    } catch {
      setStartError(true);
      setBusy(false);
      return;
    }
    setBusy(false);
    // Neutral DOB age gate (docs/01 §4) precedes any data collection. Resolve
    // the skip here so an inactive age screen cannot redirect a later route.
    router.push('/onboarding/consent');
  }

  async function openAppleInstructions() {
    setAppleInstructionsUnavailable(false);
    const opened = await openExternalHttpsUrl(accountDeletionNotice?.instructionUrl, {
      mode: 'browser',
      alertOnFailure: false,
    });
    if (!opened) setAppleInstructionsUnavailable(true);
  }

  // Stay on splash while deciding; render nothing while redirecting an invalid
  // age-policy receipt or an already-onboarded user.
  const deciding =
    resetting ||
    initializing ||
    (!!session && (agePolicy.data !== 'current' || onboarded.isLoading));

  useEffect(() => {
    if (!accountDeletionNotice || deciding || onboarded.data === true) return;
    acknowledgeAccountDeletionNotice(accountDeletionNotice);
  }, [accountDeletionNotice, deciding, onboarded.data]);

  if (deciding || onboarded.data === true) return null;

  return (
    <Screen>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 justify-center py-4">
          {accountDeletionNotice ? (
            <Card>
              <View
                accessible
                accessibilityLabel={`Account deleted. ${accountDeletionNotice.title}. ${accountDeletionNotice.message}`}
                accessibilityLiveRegion="assertive"
                accessibilityRole="alert"
              >
                <Text variant="label" tone="clay">
                  ACCOUNT DELETED
                </Text>
                <Text variant="title" className="mt-2">
                  {accountDeletionNotice.title}
                </Text>
                <Text variant="body" tone="muted" className="mt-3">
                  {accountDeletionNotice.message}
                </Text>
              </View>
              <Button
                className="mt-4"
                label="Open Apple instructions"
                variant="ghost"
                onPress={() => void openAppleInstructions()}
              />
              {appleInstructionsUnavailable ? (
                <Text accessibilityRole="alert" variant="bodySm" tone="clay" className="mt-2">
                  Apple Support could not open. Use the iPhone Settings steps above.
                </Text>
              ) : null}
            </Card>
          ) : (
            <>
              <Text variant="display">
                Healthier skin in eight weeks, built around{' '}
                <Text variant="display" italic tone="clay">
                  your
                </Text>{' '}
                skin.
              </Text>
              <Text variant="body" tone="muted" className="mt-4">
                A routine that fits what&apos;s already on your shelf. Photos stay encrypted on your
                phone unless you choose to share one.
              </Text>
            </>
          )}
        </View>
        <View className="pb-4">
          <Button label="Begin" onPress={begin} disabled={busy} />
          {startError ? (
            <Text accessibilityRole="alert" variant="bodySm" tone="clay" className="mt-3">
              We couldn&apos;t start a private session. Nothing new was collected. Try again.
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            className="mt-3 min-h-[44px] items-center justify-center py-3"
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
      </ScrollView>
    </Screen>
  );
}
