import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { RouteIconButton, Screen, Text } from '@/components/ui';
import { useCommerceConsent } from '@/features/commerce/useCommerce';
import { COMMERCE_COPY } from '@/features/commerce/copy';
import { stackBySlug, type StackItem } from '@/features/commerce/stacks';
import { buildClickToken, recordClick } from '@/features/commerce/store';
import { track } from '@/lib/analytics/track';
import { APP_COMMERCE_STACKS_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

// Surface 02 (docs/10 §4). A shoppable Stack. An expert/derm-reviewed routine, IN
// ORDER (the routine sequence, never the payout). Each item carries the FTC "Paid
// link" wording; tapping is consent-gated and routes through the same opaque-token
// attribution as the where-to-buy affordance. Curated on merit; commission never
// changed the list.
export default function StackDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const qc = useQueryClient();
  const stack = slug ? stackBySlug(slug) : undefined;
  const { data: consented } = useCommerceConsent();

  useEffect(() => {
    if (stack) track('stack_viewed', { source: 'stack' });
  }, [stack]);

  const tapItem = async (item: StackItem) => {
    haptics.select();
    if (!consented) {
      router.push('/commerce/consent');
      await qc.invalidateQueries({ queryKey: ['commerceConsent'] });
      return;
    }
    track('where_to_buy_clicked', { source: 'stack' });
    const token = buildClickToken();
    await recordClick({
      clickToken: token,
      productType: item.productType,
      source: 'none',
      consented: true,
    });
    // BLOCKED: B-SHOPMY / B-CATALOG-SEED. Resolve + open the real retailer link here
    // (opaque token only). Until then, the honest stub.
    Alert.alert(COMMERCE_COPY.whereToBuy.stubTitle, COMMERCE_COPY.whereToBuy.stubBody, [
      { text: 'OK' },
    ]);
  };

  return (
    <Screen edges={['top']}>
      <View className="flex-row items-center gap-3 pb-2 pt-1">
        <RouteIconButton
          accessibilityLabel="Back"
          onPress={() => backOrReplace(router, APP_COMMERCE_STACKS_ROUTE)}
        />
      </View>

      {!stack ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text variant="body" tone="muted" className="text-center">
            This routine isn’t available right now.
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10 pt-2">
          <View
            className="mb-3.5 flex-row items-center gap-1.5 self-start rounded-pill px-3 py-1.5"
            style={{
              backgroundColor: stack.curatorKind === 'derm' ? colors.sageTint : colors.clayTint,
            }}
          >
            <Text
              style={{
                color: stack.curatorKind === 'derm' ? colors.sage : colors.clay,
                fontSize: 11,
              }}
            >
              ✦
            </Text>
            <Text
              className="font-mono text-[10px]"
              style={{ color: stack.curatorKind === 'derm' ? colors.sageDeep : colors.clayDeep }}
            >
              {COMMERCE_COPY.stack.chipFor(stack.curatorKind)}
            </Text>
          </View>

          <Text variant="title" className="text-[29px] leading-[32px]" accessibilityRole="header">
            {stack.title}
          </Text>
          <Text variant="bodySm" tone="muted" className="mt-1.5" style={{ lineHeight: 19 }}>
            {stack.subtitle} {COMMERCE_COPY.stack.subtitle}
          </Text>

          <View className="mt-4 gap-2.5">
            {stack.items.map((item) => (
              <Pressable
                key={item.position}
                accessibilityRole="button"
                accessibilityLabel={`${item.label}, ${item.roleLabel}, paid link`}
                onPress={() => void tapItem(item)}
                className="rounded-2xl bg-paper-raised p-3.5"
                style={{ minHeight: 96, borderWidth: 1, borderColor: colors.hairline }}
              >
                <View className="flex-row items-center gap-3">
                  <Text className="font-mono text-[11px]" tone="muted" style={{ width: 14 }}>
                    {item.position}
                  </Text>
                  <View
                    className="h-[38px] w-8 rounded"
                    style={{
                      backgroundColor: colors.greige,
                      borderWidth: 1,
                      borderColor: colors.hairline,
                    }}
                  />
                  <View className="flex-1" style={{ minWidth: 0 }}>
                    <Text variant="bodySm" className="font-sans-bold text-[13.5px]">
                      {item.label}
                    </Text>
                    <Text className="text-[11px]" tone="muted">
                      {item.roleLabel}
                    </Text>
                  </View>
                </View>
                <View className="mt-3 flex-row items-center self-end gap-1.5">
                  <Text
                    className="font-mono text-[9px]"
                    style={{
                      color: colors.muted,
                      backgroundColor: '#F0EBE2',
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 5,
                      overflow: 'hidden',
                    }}
                  >
                    {COMMERCE_COPY.stack.paidChip}
                  </Text>
                  <Text style={{ color: colors.clay, fontSize: 12 }}>↗</Text>
                </View>
              </Pressable>
            ))}
          </View>

          {/* FTC disclosure. Order set on merit, commission never changed the list */}
          <Text className="mt-3.5 text-[11px]" tone="muted" style={{ lineHeight: 16 }}>
            {COMMERCE_COPY.stack.disclosure}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="How stack paid links work"
            onPress={() => router.push('/commerce/transparency')}
            className="mt-3 min-h-[48px] self-start justify-center rounded-pill px-3"
            style={{ minHeight: 48, backgroundColor: colors.clayTint }}
          >
            <Text className="font-sans-semibold text-[12px]" style={{ color: colors.clay }}>
              {COMMERCE_COPY.whereToBuy.howThisWorks} →
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </Screen>
  );
}
