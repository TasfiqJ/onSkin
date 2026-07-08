import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { Button, RouteIconButton, Screen, StripedThumb, Text } from '@/components/ui';
import { CommerceLinkNotice, type CommerceLinkFeedback } from '@/features/commerce/CommerceLinkNotice';
import { LockGlyph } from '@/features/commerce/LockGlyph';
import { useCommerceConsent } from '@/features/commerce/useCommerce';
import { COMMERCE_COPY } from '@/features/commerce/copy';
import { stackBySlug, type StackItem } from '@/features/commerce/stacks';
import { buildClickToken, recordClick } from '@/features/commerce/store';
import { track } from '@/lib/analytics/track';
import { APP_COMMERCE_STACKS_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

// Surface 02 (docs/10 §4). A shoppable Stack. An expert/derm-reviewed routine, IN
// ORDER (the routine sequence, never the payout). Items stay visually locked until
// commerce consent, then carry the FTC "Paid link" wording with the unavoidable
// disclosure. Curated on merit; commission never changed the list.
export default function StackDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { height } = useWindowDimensions();
  const qc = useQueryClient();
  const stack = slug ? stackBySlug(slug) : undefined;
  const { data: consented } = useCommerceConsent();
  const compactMissingStack = height < 640;
  const [linkFeedback, setLinkFeedback] = useState<CommerceLinkFeedback | null>(null);

  useEffect(() => {
    if (stack) track('stack_viewed', { source: 'stack' });
  }, [stack]);

  const tapItem = async (item: StackItem) => {
    haptics.select();
    setLinkFeedback(null);
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
    setLinkFeedback({
      title: COMMERCE_COPY.whereToBuy.stubTitle,
      body: COMMERCE_COPY.whereToBuy.stubBody,
    });
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
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingBottom: compactMissingStack ? 24 : 38,
          }}
        >
          <View className="items-center px-2">
            <StripedThumb size={compactMissingStack ? 66 : 74} radius={20} faded />
            <Text variant="label" tone="clay" className="mt-5 font-mono uppercase">
              Stack unavailable
            </Text>
            <Text
              variant="titleSm"
              className="mt-2 text-center"
              style={{
                fontSize: compactMissingStack ? 24 : 27,
                lineHeight: compactMissingStack ? 28 : 31,
              }}
              accessibilityRole="header"
            >
              This routine is not available right now.
            </Text>
            <Text variant="bodySm" tone="muted" className="mt-2 max-w-[284px] text-center">
              It may have been updated while we review disclosures or product availability. Current
              stacks are still available in the stack library.
            </Text>
          </View>
          <View className="mt-6 gap-2">
            <Button
              label="Back to stacks"
              onPress={() => router.replace(APP_COMMERCE_STACKS_ROUTE)}
            />
            <Button
              label="How paid links work"
              variant="ghost"
              onPress={() => router.replace('/commerce/transparency')}
            />
          </View>
        </ScrollView>
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

          {linkFeedback ? <CommerceLinkNotice feedback={linkFeedback} /> : null}
          <View className="mt-4 gap-2.5">
            {stack.items.map((item) => {
              const itemAccessibilityLabel = consented
                ? `${item.label}, ${item.roleLabel}, paid link`
                : `${item.label}, ${item.roleLabel}, where-to-buy locked until consent`;

              return (
                <Pressable
                  key={item.position}
                  accessibilityRole="button"
                  accessibilityLabel={itemAccessibilityLabel}
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
                    {consented ? (
                      <>
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
                      </>
                    ) : (
                      <>
                        <LockGlyph size={12} color={colors.muted} />
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
                          {COMMERCE_COPY.stack.lockedChip}
                        </Text>
                      </>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* FTC disclosure appears only with visible paid links; locked state keeps consent separate. */}
          <Text className="mt-3.5 text-[11px]" tone="muted" style={{ lineHeight: 16 }}>
            {consented ? COMMERCE_COPY.stack.disclosure : COMMERCE_COPY.stack.lockedDisclosure}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              consented ? 'How stack paid links work' : 'How stack link consent works'
            }
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
