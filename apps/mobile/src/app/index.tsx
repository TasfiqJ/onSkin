import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { getAgeVerified } from '@/features/onboarding/ageGateStore';
import { isOnboardedLocal } from '@/features/onboarding/skinProfileStore';
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
// (a completed skin_profile exists) is sent straight to Today.
export default function WelcomeScreen() {
  const params = useLocalSearchParams<{ e2eReset?: string }>();
  const { ensureAnonymousSession, session, initializing } = useAuth();
  const [accountDeletionNotice] = useState(peekAccountDeletionNotice);
  const [appleInstructionsUnavailable, setAppleInstructionsUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
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

  // Onboarding-completion check as a query (no setState-in-effect). Reads the
  // local-first completion record FIRST (the v1 source of truth, D-029): a
  // returning onboarded user is recognized even with no backend, so a failed or
  // absent server write never re-onboards them. Falls back to the server row.
  const onboarded = useQuery({
    queryKey: ['onboarded', session?.user.id],
    enabled: !resetting && !!session && !initializing,
    retry: 0,
    queryFn: async () => {
      const expectedOwnerUserId = session?.user.id;
      if (!expectedOwnerUserId) return false;
      return runHealthDataWriteOperation(expectedOwnerUserId, async (lease) => {
        const localOnboarded = await isOnboardedLocal();
        lease.assertCurrent();
        if (localOnboarded) return true;
        if (!isSupabaseConfigured) return false;
        lease.assertCurrent();
        const { count } = await supabase
          .from('skin_profiles')
          .select('id', { count: 'exact', head: true })
          .not('completed_at', 'is', null);
        lease.assertCurrent();
        return (count ?? 0) > 0;
      });
    },
  });

  useEffect(() => {
    if (onboarded.data === true) router.replace('/today');
  }, [onboarded.data]);

  async function begin() {
    setBusy(true);
    track('onboarding_started');
    try {
      await ensureAnonymousSession();
    } catch {
      // non-fatal before backend is configured
    }
    const ageVerified = await getAgeVerified().catch(() => false);
    setBusy(false);
    // Neutral DOB age gate (docs/01 §4) precedes any data collection. Resolve
    // the skip here so an inactive age screen cannot redirect a later route.
    router.push(ageVerified ? '/onboarding/consent' : '/onboarding/age');
  }

  async function openAppleInstructions() {
    setAppleInstructionsUnavailable(false);
    const opened = await openExternalHttpsUrl(accountDeletionNotice?.instructionUrl, {
      mode: 'browser',
      alertOnFailure: false,
    });
    if (!opened) setAppleInstructionsUnavailable(true);
  }

  // Stay on splash while deciding; render nothing while redirecting an onboarded user.
  const deciding = resetting || initializing || (!!session && onboarded.isLoading);

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
                A routine that fits what&apos;s already on your shelf. And photos that never leave
                your phone.
              </Text>
            </>
          )}
        </View>
        <View className="pb-4">
          <Button label="Begin" onPress={begin} disabled={busy} />
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
