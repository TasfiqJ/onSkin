import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { ExpiryBadge, Sheet, StripedThumb, Text } from '@/components/ui';
import { isCommerceConsented } from '@/features/commerce/consent';
import { COMMERCE_COPY } from '@/features/commerce/copy';
import { isSafetyCriticalCategory } from '@/features/shelf/categories';
import { useShelfMutations } from '@/features/shelf/mutations';
import { useShelf } from '@/features/shelf/useShelf';
import { track } from '@/lib/analytics/track';
import { APP_SHELF_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';

// Replenishment (design screen 09, docs/04 §6). An HONEST PAO-triggered prompt
// (the product is genuinely running low/expiring), opt-in, claim-safe. "Re-add"
// resets the clock; "see similar" + any affiliate link are gated behind the
// separate MHMDA data-sharing consent (B-PRIVACY) and the catalog (B-CATALOG-SEED).
export default function ReplenishScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useShelf();
  const m = useShelfMutations();

  const item = data?.items.find((i) => i.id === id);

  // Surface the nudge once (analytics). The in-app prompt, not a notification (§6).
  useEffect(() => {
    if (item?.id) track('replenishment_nudge_shown', { source: 'shelf' });
  }, [item?.id]);

  if (!item) {
    return (
      <Sheet>
        <Text variant="body" tone="muted" className="py-6 text-center">
          This product is no longer on your shelf.
        </Text>
        <Pressable
          accessibilityRole="button"
          className="items-center py-2"
          onPress={() => backOrReplace(router, APP_SHELF_ROUTE)}
        >
          <Text className="font-sans-semibold" tone="muted">
            Close
          </Text>
        </Pressable>
      </Sheet>
    );
  }

  const safety = isSafetyCriticalCategory(item.category);
  const headline = safety
    ? `Your ${item.name} is nearly finished.`
    : `Time to top up ${item.name}.`;
  const body = safety
    ? 'Sun protection is one to keep fresh. Its filters lose strength over time. Want to line up the next one?'
    : 'You’re running low. Want to line up the next one so you don’t run out?';
  const similarSub = safety
    ? 'Same protection, claim-safe matches'
    : 'Same role, claim-safe matches';

  const reAdd = async () => {
    haptics.select();
    await m.replace(item.id);
    router.replace('/shelf');
  };

  const seeSimilar = async () => {
    haptics.select();
    track('replenishment_nudge_tapped', { action: 'see_similar' });
    // Route through the SAME commerce MHMDA gate the where-to-buy surface uses
    // (docs/10 §3): no consent => open the consent sheet, never share silently.
    // Consented => the honest empty state until the catalog lands (B-CATALOG-SEED).
    const consented = await isCommerceConsented();
    if (!consented) {
      router.push('/commerce/consent');
      return;
    }
    Alert.alert('Similar options', COMMERCE_COPY.whereToBuy.emptyState, [{ text: 'OK' }]);
  };

  return (
    <Sheet>
      <View className="flex-row items-center gap-4">
        <StripedThumb size={60} radius={16} />
        <View className="flex-1">
          <View className="mb-1.5 self-start">
            <ExpiryBadge badge={item.badge} />
          </View>
          <Text variant="titleSm" className="text-[23px] leading-[24px]">
            {item.name}
          </Text>
        </View>
      </View>

      <Text variant="title" className="mt-4 text-[28px] leading-[33px]" accessibilityRole="header">
        {headline}
      </Text>
      <Text variant="body" tone="muted" className="mt-2">
        {body}
      </Text>

      <View className="mt-5 gap-2.5">
        <Pressable
          accessibilityRole="button"
          onPress={reAdd}
          className="flex-row items-center gap-3.5 rounded-[18px] border-2 border-clay bg-paper-raised p-4"
        >
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
          onPress={() => void seeSimilar()}
          className="flex-row items-center gap-3.5 rounded-[18px] border border-hairline bg-paper-raised p-4"
        >
          <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-greige">
            <Text tone="muted">⌕</Text>
          </View>
          <View className="flex-1">
            <Text variant="body" className="font-sans-semibold">
              See similar options
            </Text>
            <Text variant="bodySm" tone="muted">
              {similarSub}
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

      <Pressable
        accessibilityRole="button"
        className="mt-3 items-center py-2"
        onPress={() => backOrReplace(router, APP_SHELF_ROUTE)}
      >
        <Text className="font-sans-semibold" tone="muted">
          Not now
        </Text>
      </Pressable>
    </Sheet>
  );
}
