import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { ConflictCard } from '@/features/growth/ConflictCard';
import { shareConflictCard } from '@/features/growth/shareCard';
import { useShelf } from '@/features/shelf/useShelf';
import { track } from '@/lib/analytics/track';

// docs/14 §3: the shareable "Shelf Conflict Card" growth artifact. Renders the
// branded, watermarked, claim-safe card for a detected conflict and exports it to the
// OS share sheet as a one-tap watermarked Story image (react-native-view-shot). The
// card is screenshot-worthy on its own, so even a manual screenshot carries the brand.
export default function ShareConflictScreen() {
  const { ruleId } = useLocalSearchParams<{ ruleId: string }>();
  const { data } = useShelf();
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const conflict = data?.conflicts.find((c) => c.rule.id === ruleId) ?? data?.conflicts[0];

  async function onShare() {
    if (!conflict) return;
    setBusy(true);
    try {
      track('conflict_card_shared', { rule_id: conflict.rule.id });
      const ok = await shareConflictCard(cardRef);
      if (!ok) Alert.alert('Sharing', 'Sharing isn’t available on this device.');
    } catch (e) {
      Alert.alert('Couldn’t create the card', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-7">
        <Text variant="label" tone="muted">
          SHARE YOUR SHELF CHECK
        </Text>
        {conflict ? (
          <ConflictCard ref={cardRef} conflict={conflict} />
        ) : (
          <Text variant="body" tone="muted" className="text-center">
            Nothing to share right now. Add a couple of products to your shelf first.
          </Text>
        )}
      </View>
      <View className="gap-2 pb-4">
        <Button
          label={busy ? 'Preparing…' : 'Share to Stories'}
          disabled={busy || !conflict}
          onPress={() => void onShare()}
        />
        <Pressable accessibilityRole="button" className="items-center py-3" onPress={() => router.back()}>
          <Text variant="body" tone="muted" className="font-sans-medium">
            Done
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
