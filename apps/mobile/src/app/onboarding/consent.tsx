import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { HEALTH_DATA_CONSENT } from '@/features/onboarding/consentCopy';
import { track } from '@/lib/analytics/track';
import { recordConsent } from '@/lib/consent/consent';

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

  async function agree() {
    setBusy(true);
    track('screen_viewed', { screen_name: 'health_consent' });
    try {
      await recordConsent({
        type: 'health_data_collection',
        granted: true,
        version: HEALTH_DATA_CONSENT.version,
        consentText: HEALTH_DATA_CONSENT.fullText,
      });
    } catch {
      // Non-fatal until the backend is configured (B-SUPABASE).
    }
    setBusy(false);
    router.push('/onboarding/quiz');
  }

  return (
    <Screen>
      <View className="flex-1">
        <Text variant="title" className="mt-10">
          Before the quiz , {' '}
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
      </View>
      <View className="pb-4">
        <Button label="I agree. Continue" onPress={agree} disabled={busy} />
        <Pressable accessibilityRole="button" className="mt-3 items-center py-3">
          {/* BLOCKED: B-PRIVACY-COPY. Links to the Consumer Health Data Privacy Policy. */}
          <Text variant="body" tone="muted" className="font-sans-medium">
            Read the health data policy
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
