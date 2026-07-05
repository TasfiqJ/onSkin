import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { HEALTH_DATA_CONSENT } from '@/features/onboarding/consentCopy';
import {
  declineHealthDataCollectionConsent,
  grantHealthDataCollectionConsent,
} from '@/features/onboarding/healthConsent';
import { openPolicy } from '@/features/subscription/ComplianceRow';
import { track } from '@/lib/analytics/track';
import { NOT_MEDICAL_ADVICE_SHORT } from '@/lib/legal/disclaimer';
import { POLICY_LINKS } from '@/lib/legal/policyLinks';
import { safeExternalHttpsUrl } from '@/lib/navigation/externalUrl';
import { colors } from '@/theme/tokens';

// 03 · Health-data collection consent. Dedicated + unbundled, BEFORE the quiz
// (docs/01 §4: MHMDA "collection" + GDPR Art. 9 explicit). Collection only;
// sharing is asked separately later. BLOCKED: B-PRIVACY-COPY (final wording).
function Block({ label, body }: { label: string; body: string }) {
  return (
    <View className="mb-4">
      <Text variant="label" tone="clay">
        {label}
      </Text>
      <Text variant="body" className="mt-1">
        {body}
      </Text>
    </View>
  );
}

export default function HealthConsentScreen() {
  const [busy, setBusy] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [policyLinkMissing, setPolicyLinkMissing] = useState(false);

  async function agree() {
    if (busy) return;
    setBusy(true);
    setDeclined(false);
    track('screen_viewed', { screen_name: 'health_consent' });
    try {
      await grantHealthDataCollectionConsent();
    } catch {
      // Non-fatal until the backend is configured (B-SUPABASE).
    }
    setBusy(false);
    router.push('/onboarding/quiz');
  }

  async function decline() {
    if (busy) return;
    setBusy(true);
    track('health_consent_declined');
    try {
      await declineHealthDataCollectionConsent();
    } catch {
      // Non-fatal until the backend is configured (B-SUPABASE).
    }
    setDeclined(true);
    setBusy(false);
  }

  function openHealthDataPolicy() {
    if (!safeExternalHttpsUrl(POLICY_LINKS.consumerHealthPrivacy.url)) {
      setPolicyLinkMissing(true);
      return;
    }
    setPolicyLinkMissing(false);
    openPolicy(POLICY_LINKS.consumerHealthPrivacy.url);
  }

  return (
    <Screen>
      <View className="flex-1">
        <Text variant="title" className="mt-10">
          Before the quiz,{' '}
          <Text variant="title" italic tone="clay">
            your privacy.
          </Text>
        </Text>
        <Text variant="body" tone="muted" className="mt-3">
          Your answers describe your skin&apos;s health, so we ask plainly. This consent covers
          collection only. We&apos;ll ask separately before anything is ever shared.
        </Text>
        <Card className="mt-7">
          <Block label="WHAT" body={HEALTH_DATA_CONSENT.what} />
          <Block label="WHY" body={HEALTH_DATA_CONSENT.why} />
          <Block label="NEVER" body={HEALTH_DATA_CONSENT.never} />
          <Text variant="bodySm" tone="muted">
            {HEALTH_DATA_CONSENT.footnote}
          </Text>
        </Card>
        {/* Standing not-medical-advice disclaimer (docs/02 §9). */}
        <Text variant="bodySm" tone="muted" className="mt-4 text-[12px]">
          {NOT_MEDICAL_ADVICE_SHORT}
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
      </View>
      <View className="pb-4">
        <Button label="I agree. Continue" onPress={agree} disabled={busy} />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          className="mt-3 items-center py-3"
          disabled={busy}
          onPress={() => void decline()}
        >
          <Text variant="body" tone="muted" className="font-sans-medium">
            {HEALTH_DATA_CONSENT.declineCta}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          className="mt-1 items-center py-3"
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
