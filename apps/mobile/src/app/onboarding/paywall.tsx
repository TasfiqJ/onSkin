import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import { track } from '@/lib/analytics/track';
import { useAuth } from '@/lib/auth/AuthProvider';
import { PRO_ANNUAL, purchaseProAnnual } from '@/lib/iap/revenuecat';

// 10 · Onboarding paywall (docs/01 §2, design spec p.7). Single annual offer with
// a 14-day trial and a visible "Not now". NO trial toggle on iOS (Guideline
// 3.1.2). Purchase is STUBBED (BLOCKED: B-REVENUECAT).
const FEATURES = [
  'Routine intelligence — order, timing, skin cycling',
  'Ingredient conflict checks, with evidence grades',
  'Private photo timeline — on-device only',
  'Reminders, streaks & home-screen widgets',
];

export default function PaywallScreen() {
  const { goals } = useOnboarding();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const firstName =
    (user?.user_metadata?.display_name as string | undefined)?.split(' ')[0] ??
    (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] ??
    null;

  useEffect(() => {
    track('paywall_shown', { goals: goals.length });
  }, [goals.length]);

  async function startTrial() {
    setBusy(true);
    const { purchased } = await purchaseProAnnual();
    if (purchased) track('trial_started', { product: PRO_ANNUAL.productId });
    setBusy(false);
    router.replace('/home');
  }

  return (
    <Screen>
      <View className="flex-row justify-end pt-1">
        <Pressable accessibilityRole="button" className="py-2" onPress={() => router.replace('/home')}>
          <Text variant="body" tone="muted" className="font-sans-medium">
            Not now
          </Text>
        </Pressable>
      </View>

      <View className="flex-1">
        <Text variant="title" className="mt-2">
          {firstName ? `Your plan is ready, ${firstName}.` : 'Your plan is ready.'}
        </Text>
        <Text variant="body" tone="muted" className="mt-2">
          Built around your skin{goals.length ? ` — ${goals.length} goal${goals.length > 1 ? 's' : ''}` : ''}.
        </Text>

        <Card className="mt-7">
          {FEATURES.map((f) => (
            <View key={f} className="mb-3 flex-row">
              <View className="mr-3 mt-2 h-1.5 w-1.5 rounded-full bg-clay" />
              <Text variant="body" className="flex-1">
                {f}
              </Text>
            </View>
          ))}
        </Card>

        <View className="mt-6 overflow-hidden rounded-card bg-ink p-5">
          <View className="mb-2 self-start rounded-pill bg-clay px-3 py-1">
            <Text variant="label" tone="inverse">
              {PRO_ANNUAL.trialDays} DAYS FREE
            </Text>
          </View>
          <View className="flex-row items-baseline justify-between">
            <Text variant="titleSm" tone="inverse">
              OnSkin Pro · Annual
            </Text>
            <Text variant="titleSm" tone="inverse" className="font-sans-bold">
              {PRO_ANNUAL.priceLabel}
            </Text>
          </View>
          <Text variant="bodySm" tone="inverseMuted" className="mt-1">
            {PRO_ANNUAL.perMonth}
          </Text>
        </View>
      </View>

      <View className="pb-4">
        <Button label={`Start ${PRO_ANNUAL.trialDays} days free`} variant="accent" onPress={startTrial} disabled={busy} />
        <Text variant="bodySm" tone="muted" className="mt-3 text-center">
          We&apos;ll remind you 2 days before the trial ends · Cancel anytime
        </Text>
      </View>
    </Screen>
  );
}
