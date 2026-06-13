import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { ExpiryBadge, Sheet, Text } from '@/components/ui';
import { isSafetyCriticalCategory } from '@/features/shelf/categories';
import { useShelfMutations } from '@/features/shelf/mutations';
import { useShelf } from '@/features/shelf/useShelf';
import { track } from '@/lib/analytics/track';
import { haptics } from '@/theme/haptics';

// Replenishment (design screen 09, docs/04 §6) — an HONEST PAO-triggered prompt
// (the product is genuinely running low/expiring), opt-in, claim-safe. "Re-add"
// resets the clock; "see similar" + any affiliate link are gated behind the
// separate MHMDA data-sharing consent (B-PRIVACY) and the catalog (B-CATALOG-SEED).
export default function ReplenishScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useShelf();
  const m = useShelfMutations();

  const item = data?.items.find((i) => i.id === id);

  // Surface the nudge once (analytics) — the in-app prompt, not a notification (§6).
  useEffect(() => {
    if (item?.id) track('replenishment_nudge_shown', { product_id: item.id });
  }, [item?.id]);

  if (!item) {
    return (
      <Sheet>
        <Text variant="body" tone="muted" className="py-6 text-center">
          This product is no longer on your shelf.
        </Text>
        <Pressable accessibilityRole="button" className="items-center py-2" onPress={() => router.back()}>
          <Text className="font-sans-semibold" tone="muted">
            Close
          </Text>
        </Pressable>
      </Sheet>
    );
  }

  const safety = isSafetyCriticalCategory(item.category);
  const headline = safety ? `Your ${item.name} is nearly finished.` : `Time to top up ${item.name}.`;
  const body = safety
    ? 'This is one to keep fresh — its protection can fade over time. Want to line up the next one?'
    : 'You’re running low. Want to line up the next one so you don’t run out?';

  const reAdd = async () => {
    haptics.select();
    await m.replace(item.id);
    router.replace('/shelf');
  };

  const seeSimilar = () => {
    haptics.select();
    track('replenishment_nudge_tapped', { product_id: item.id, action: 'see_similar' });
    // BLOCKED: B-PRIVACY — when the catalog/affiliate path goes live, the actual
    // share MUST be gated on getLatestConsents()['data_sharing'] (route to the
    // consent screen if not granted). This informational Alert shares nothing.
    Alert.alert(
      'Similar options',
      'Claim-safe product matches arrive with the catalog, and shopping links are shared only after you turn on data-sharing in Settings.',
      [{ text: 'OK' }],
    );
  };

  return (
    <Sheet>
      <View className="flex-row items-center gap-4">
        <View className="h-[60px] w-[60px] rounded-2xl border border-hairline bg-greige" />
        <View className="flex-1">
          <View className="mb-1.5 self-start">
            <ExpiryBadge badge={item.badge} />
          </View>
          <Text variant="titleSm" className="text-[22px] leading-[24px]">
            {item.name}
          </Text>
        </View>
      </View>

      <Text variant="title" className="mt-4 text-[27px] leading-[30px]" accessibilityRole="header">
        {headline}
      </Text>
      <Text variant="body" tone="muted" className="mt-2">
        {body}
      </Text>

      <View className="mt-5 gap-2.5">
        <Pressable
          accessibilityRole="button"
          onPress={reAdd}
          className="flex-row items-center gap-3.5 rounded-[18px] border-2 border-clay bg-paper-raised p-4">
          <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-clay-tint">
            <Text className="font-sans-bold text-clay">+</Text>
          </View>
          <View className="flex-1">
            <Text variant="body" className="font-sans-semibold">
              Re-add the same one
            </Text>
            <Text variant="bodySm" tone="muted">
              Resets the freshness clock
            </Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={seeSimilar}
          className="flex-row items-center gap-3.5 rounded-[18px] border border-hairline bg-paper-raised p-4">
          <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-greige">
            <Text tone="muted">⌕</Text>
          </View>
          <View className="flex-1">
            <Text variant="body" className="font-sans-semibold">
              See similar options
            </Text>
            <Text variant="bodySm" tone="muted">
              Same role, claim-safe matches
            </Text>
          </View>
        </Pressable>
      </View>

      <View className="mt-4 flex-row items-center justify-center gap-2">
        <Text tone="muted" className="text-[12px]">
          ✦
        </Text>
        <Text variant="label" tone="muted" className="text-center">
          shopping links share data only with your consent · turn on in Settings
        </Text>
      </View>

      <Pressable accessibilityRole="button" className="mt-3 items-center py-2" onPress={() => router.back()}>
        <Text className="font-sans-semibold" tone="muted">
          Not now
        </Text>
      </Pressable>
    </Sheet>
  );
}
