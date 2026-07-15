import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { LOCAL_UNCONFIGURED_HEALTH_DATA_OWNER } from '@/features/healthConsent/lifecycle';
import { getAgeVerified } from '@/features/onboarding/ageGateStore';
import { HEALTH_DATA_CONSENT } from '@/features/onboarding/consentCopy';
import {
  declineHealthDataCollectionConsent,
  grantHealthDataCollectionConsent,
  resetHealthProfileConsumers,
} from '@/features/onboarding/healthConsent';
import { openPolicy } from '@/features/subscription/ComplianceRow';
import { track } from '@/lib/analytics/track';
import { useAuth } from '@/lib/auth/AuthProvider';
import { isSupabaseConfigured } from '@/lib/env';
import { NOT_MEDICAL_ADVICE_SHORT } from '@/lib/legal/disclaimer';
import { POLICY_LINKS } from '@/lib/legal/policyLinks';
import { safeExternalHttpsUrl } from '@/lib/navigation/externalUrl';
import { colors } from '@/theme/tokens';

// 02 · Health-data collection consent. Dedicated + unbundled, BEFORE goals and the quiz
// (docs/01 §4: MHMDA "collection" + GDPR Art. 9 explicit). Collection only;
// sharing is asked separately later. BLOCKED: B-PRIVACY-COPY (final wording).
function Block({
  label,
  body,
  compact = false,
}: {
  label: string;
  body: string;
  compact?: boolean;
}) {
  return (
    <View className={compact ? 'mb-3' : 'mb-4'}>
      <Text variant="label" tone="clay">
        {label}
      </Text>
      <Text variant="body" className={compact ? 'mt-0.5' : 'mt-1'}>
        {body}
      </Text>
    </View>
  );
}

export default function HealthConsentScreen() {
  const { height } = useWindowDimensions();
  const compactPhone = height < 640;
  const scrollRef = useRef<ScrollView>(null);
  const actionInFlightRef = useRef(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    returnTo?: string | string[];
    profileReturnTo?: string | string[];
  }>();
  const [busy, setBusy] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [consentSaveError, setConsentSaveError] = useState(false);
  const [policyLinkMissing, setPolicyLinkMissing] = useState(false);
  const requestedReturn = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const healthDataOwnerId =
    user?.id ?? (!isSupabaseConfigured ? LOCAL_UNCONFIGURED_HEALTH_DATA_OWNER : null);
  const isSettingsReconsent = requestedReturn === 'skin-profile';
  const profileReturn = Array.isArray(params.profileReturnTo)
    ? params.profileReturnTo[0]
    : params.profileReturnTo;

  function returnToSkinProfile() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace({
      pathname: '/settings/skin-profile',
      params: {
        returnTo:
          profileReturn === 'plan' || profileReturn === 'shelf' || profileReturn === 'today'
            ? profileReturn
            : 'you',
      },
    });
  }

  function scrollToStatus() {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  function beginConsentAction(): boolean {
    if (actionInFlightRef.current) return false;
    actionInFlightRef.current = true;
    return true;
  }

  function releaseConsentAction(): void {
    actionInFlightRef.current = false;
  }

  async function agree() {
    if (busy || !beginConsentAction()) return;
    setBusy(true);
    setDeclined(false);
    setConsentSaveError(false);
    if (!(await getAgeVerified().catch(() => false))) {
      releaseConsentAction();
      setBusy(false);
      router.replace('/onboarding/age');
      return;
    }
    track('screen_viewed', { screen_name: 'health_consent' });
    let activationRoutePending: boolean;
    try {
      if (!healthDataOwnerId) throw new Error('HEALTH_DATA_CONSENT_OWNER_UNAVAILABLE');
      ({ activationRoutePending } = await grantHealthDataCollectionConsent(healthDataOwnerId));
    } catch {
      releaseConsentAction();
      setConsentSaveError(true);
      scrollToStatus();
      setBusy(false);
      return;
    }
    setBusy(false);
    // The consent transition is already durable. Cache refresh failures must
    // not strand the user on this screen after a successful grant; each query
    // remains independently retryable on its destination surface.
    void Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ['skinProfileBits'] }),
      queryClient.invalidateQueries({ queryKey: ['shelf'] }),
      queryClient.invalidateQueries({ queryKey: ['ramp'] }),
    ]);
    if (isSettingsReconsent) {
      returnToSkinProfile();
      return;
    }
    // A fresh grant synchronously publishes an activation-route barrier. Its
    // global gate is the sole navigator in that case; issuing a second route
    // command here races the web history adapter back to the prior age screen.
    if (!activationRoutePending) router.replace('/onboarding/goals');
  }

  async function decline() {
    if (busy || !beginConsentAction()) return;
    setBusy(true);
    setConsentSaveError(false);
    if (!(await getAgeVerified().catch(() => false))) {
      releaseConsentAction();
      setBusy(false);
      router.replace('/onboarding/age');
      return;
    }
    try {
      if (!healthDataOwnerId) throw new Error('HEALTH_DATA_CONSENT_OWNER_UNAVAILABLE');
      await declineHealthDataCollectionConsent(healthDataOwnerId);
      // Reset synchronously before refetching so a previously cached explicit
      // `none` cannot keep driving Plan or Today after consent is withdrawn.
      await resetHealthProfileConsumers(queryClient);
      track('health_consent_declined');
      setDeclined(true);
      scrollToStatus();
    } catch {
      setConsentSaveError(true);
      scrollToStatus();
    } finally {
      releaseConsentAction();
      setBusy(false);
    }
  }

  function openHealthDataPolicy() {
    if (!safeExternalHttpsUrl(POLICY_LINKS.consumerHealthPrivacy.url)) {
      setPolicyLinkMissing(true);
      return;
    }
    setPolicyLinkMissing(false);
    void openPolicy(POLICY_LINKS.consumerHealthPrivacy.url);
  }

  return (
    <Screen>
      <View className="flex-1 overflow-hidden">
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerClassName={compactPhone ? 'pb-8 pt-8' : 'pb-6 pt-10'}
        >
          <Text variant="title">
            Before the quiz,{' '}
            <Text variant="title" italic tone="clay">
              your privacy.
            </Text>
          </Text>
          <Text variant="body" tone="muted" className="mt-3">
            Your answers describe your skin&apos;s health, so we ask plainly. This consent covers
            collection only. We&apos;ll ask separately before anything is ever shared.
          </Text>
          {declined ? (
            <View className="mt-4 rounded-[14px] p-4" style={{ backgroundColor: colors.clayTint }}>
              <Text variant="body" className="font-sans-semibold">
                {HEALTH_DATA_CONSENT.declinedTitle}
              </Text>
              <Text variant="bodySm" tone="muted" className="mt-1">
                {HEALTH_DATA_CONSENT.declinedBody}
              </Text>
            </View>
          ) : null}
          {consentSaveError ? (
            <View className="mt-4 rounded-[14px] p-4" style={{ backgroundColor: colors.clayTint }}>
              <Text variant="body" className="font-sans-semibold">
                {HEALTH_DATA_CONSENT.saveFailedTitle}
              </Text>
              <Text variant="bodySm" tone="muted" className="mt-1">
                {HEALTH_DATA_CONSENT.saveFailedBody}
              </Text>
            </View>
          ) : null}
          <Card className={compactPhone ? 'mt-5 p-4' : 'mt-7'}>
            <Block label="WHAT" body={HEALTH_DATA_CONSENT.what} compact={compactPhone} />
            <Block label="WHY" body={HEALTH_DATA_CONSENT.why} compact={compactPhone} />
            <Block label="NEVER" body={HEALTH_DATA_CONSENT.never} compact={compactPhone} />
            <Text variant="bodySm" tone="muted">
              {HEALTH_DATA_CONSENT.footnote}
            </Text>
          </Card>
          {/* Standing not-medical-advice disclaimer (docs/02 §9). */}
          <Text
            variant="bodySm"
            tone="muted"
            className={compactPhone ? 'mt-3 text-[12px]' : 'mt-4 text-[12px]'}
          >
            {NOT_MEDICAL_ADVICE_SHORT}
          </Text>
        </ScrollView>
      </View>
      <View className="bg-paper pb-4 pt-2">
        <Button label="I agree. Continue" onPress={agree} disabled={busy} />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          className="mt-3 min-h-[48px] items-center justify-center py-2"
          disabled={busy}
          onPress={() => void decline()}
        >
          <Text variant="body" tone="muted" className="font-sans-medium">
            {HEALTH_DATA_CONSENT.declineCta}
          </Text>
        </Pressable>
        {isSettingsReconsent ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            className="min-h-[48px] items-center justify-center py-2"
            disabled={busy}
            onPress={returnToSkinProfile}
          >
            <Text variant="body" tone="muted" className="font-sans-medium">
              Return without changing
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          className="mt-1 min-h-[48px] items-center justify-center py-2"
          onPress={openHealthDataPolicy}
        >
          {/* BLOCKED: B-PRIVACY-COPY. Links to the Consumer Health Data Privacy Policy. */}
          <Text variant="body" tone="muted" className="font-sans-medium">
            Read the health data policy
          </Text>
        </Pressable>
        {policyLinkMissing ? (
          <Text variant="bodySm" tone="clay" className="text-center">
            The health data policy link is not configured in this build.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
