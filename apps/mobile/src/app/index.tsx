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
import { BRAND } from '@/lib/brand';
import { runHealthDataWriteOperation } from '@/lib/consent/healthDataWriteAdmission';
import { isSupabaseConfigured } from '@/lib/env';
import { openExternalHttpsUrl } from '@/lib/navigation/externalOpen';
import { queryClient } from '@/lib/query/queryClient';
import { supabase } from '@/lib/supabase/client';
import { colors } from '@/theme/tokens';

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

function ValueRow({ title, detail }: { title: string; detail: string }) {
  return (
    <View className="flex-row items-start gap-3 py-2.5">
      <View
        className="mt-1 h-5 w-5 items-center justify-center rounded-full"
        style={{ backgroundColor: colors.clayTint }}
      >
        <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.clay }} />
      </View>
      <View className="flex-1">
        <Text variant="bodySm" className="font-sans-semibold text-[14px]">
          {title}
        </Text>
        <Text variant="bodySm" tone="muted" className="mt-0.5 text-[12.5px] leading-[17px]">
          {detail}
        </Text>
      </View>
    </View>
  );
}

// Welcome is both first impression and returning-user gate. The product pitch is
// deliberately shelf -> routine -> private progress, not a generic scanner.
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
        // Dev-only fixture reset stays best-effort.
      }
      try {
        await clearE2ELocalControlState();
      } catch {
        // Keep the fixture reachable so stale state can surface visibly.
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

  const agePolicy = useQuery({
    queryKey: AGE_POLICY_STATUS_QUERY_KEY,
    enabled: !resetting && !!session && !initializing,
    retry: 0,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: getAgePolicyReceiptStatus,
  });

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
        {accountDeletionNotice ? (
          <View className="flex-1 justify-center py-6">
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
          </View>
        ) : (
          <>
            <View className="flex-1 justify-center py-8">
              <View
                className="mb-7 h-14 w-14 items-center justify-center rounded-[19px] bg-ink"
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                <View
                  className="h-5 w-5 rounded-[7px]"
                  style={{ backgroundColor: colors.clayBright }}
                />
              </View>
              <Text variant="eyebrow" tone="clay">
                {BRAND.appName.toUpperCase()} · YOUR ROUTINE
              </Text>
              <Text variant="display" className="mt-3">
                Better skin starts with a routine you can actually{' '}
                <Text variant="display" italic tone="clay">
                  follow.
                </Text>
              </Text>
              <Text variant="body" tone="muted" className="mt-4 max-w-[340px]">
                Build around what you already own, know what to use today, and track progress
                privately.
              </Text>

              <View className="mt-6 rounded-[22px] border border-hairline bg-paper-raised px-4 py-2">
                <ValueRow
                  title="Your shelf, organized"
                  detail="Add products once. Keep everything in one place."
                />
                <View className="h-px bg-hairline" />
                <ValueRow
                  title="A clear AM/PM plan"
                  detail="Open Today and see the next step—without re-researching."
                />
                <View className="h-px bg-hairline" />
                <ValueRow
                  title="Progress stays private"
                  detail="Photos stay encrypted on your phone unless you choose to share one."
                />
              </View>
            </View>

            <View className="pb-4">
              <Button label={busy ? 'Starting…' : 'Begin'} onPress={begin} disabled={busy} />
              {startError ? (
                <Text accessibilityRole="alert" variant="bodySm" tone="clay" className="mt-3">
                  We couldn&apos;t start a private session. Nothing new was collected. Try again.
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                className="mt-2 min-h-[48px] items-center justify-center py-3"
                onPress={() => router.push('/onboarding/account')}
              >
                <Text variant="body" tone="muted" className="font-sans-semibold">
                  I already have an account
                </Text>
              </Pressable>
              <Text variant="label" tone="muted" className="mt-1 text-center text-[10.5px]">
                NO ADS · NO DATA SALES · PHOTOS STAY ON DEVICE
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
