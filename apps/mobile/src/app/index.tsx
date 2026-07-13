import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { isOnboardedLocal } from '@/features/onboarding/skinProfileStore';
import { clearLocalPrivateData } from '@/features/settings/localPrivateData';
import { track } from '@/lib/analytics/track';
import { useAuth } from '@/lib/auth/AuthProvider';
import { isSupabaseConfigured } from '@/lib/env';
import { queryClient } from '@/lib/query/queryClient';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';
import { supabase } from '@/lib/supabase/client';

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
  const { ensureAnonymousSession, session, initializing } = useAuth();
  const ownerScope = useOwnerQueryScope();
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
    queryKey: queryKeys.onboarded(ownerScope),
    enabled: !resetting && !!session && !initializing,
    retry: 0,
    queryFn: async () => {
      if (await isOnboardedLocal()) return true;
      if (!isSupabaseConfigured) return false;
      const { count } = await supabase
        .from('skin_profiles')
        .select('id', { count: 'exact', head: true })
        .not('completed_at', 'is', null);
      return (count ?? 0) > 0;
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
    setBusy(false);
    // Neutral DOB age gate (docs/01 §4) precedes any data collection; it self-skips
    // to goals if this device already passed it.
    router.push('/onboarding/age');
  }

  // Stay on splash while deciding; render nothing while redirecting an onboarded user.
  const deciding = resetting || initializing || (!!session && onboarded.isLoading);
  if (deciding || onboarded.data === true) return null;

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
        <Button label="Begin" onPress={begin} disabled={busy} />
        <Pressable
          accessibilityRole="button"
          className="mt-3 items-center py-3"
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
