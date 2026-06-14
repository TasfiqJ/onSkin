import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { COMMUNITY_COPY } from '@/features/community/copy';
import { colors } from '@/theme/tokens';

// 05 · "People like you" (docs/11 §9.4, design 05). Phase 2+. Structured, anonymised
// contributions normalised into the docs/09 "people like you" signal: better
// recommendations → better retention. A quiet AGGREGATE card, never a social feed , 
// never a list of individuals, never a comparison ranking, never a photo. The aggregate
// shown is an illustrative placeholder until peer density exists (B-COMMUNITY-MOD).
export default function PeopleLikeYouScreen() {
  return (
    <Screen edges={['top']}>
      <View className="flex-row items-center justify-between pb-2 pt-1">
        <View className="flex-row items-center gap-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            className="h-7 w-7 items-center justify-center rounded-full bg-paper-raised"
            style={{ borderWidth: 1, borderColor: colors.hairline }}>
            <Text style={{ color: colors.ink }}>‹</Text>
          </Pressable>
          <Text variant="body" className="font-sans-semibold" tone="muted">
            {COMMUNITY_COPY.peopleLikeYou.title}
          </Text>
        </View>
        <Text variant="label" tone="muted">
          {COMMUNITY_COPY.peopleLikeYou.phaseTag}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10 pt-2">
        <Text variant="title" className="mt-1">
          {COMMUNITY_COPY.peopleLikeYou.title}
        </Text>
        <Text variant="bodySm" tone="muted" className="mt-1.5">
          {COMMUNITY_COPY.peopleLikeYou.subtitle}
        </Text>

        {/* the aggregate card */}
        <View className="mt-5 rounded-[22px] bg-paper-raised p-5" style={{ borderWidth: 1, borderColor: colors.hairline }}>
          <Text variant="label" tone="muted" className="mb-3">
            {COMMUNITY_COPY.peopleLikeYou.eyebrow}
          </Text>
          <Text variant="titleSm" className="text-[22px] leading-[28px]">
            Among people with <Text italic tone="clay" variant="titleSm" className="text-[22px] leading-[28px]">dry, sensitive</Text> skin who use retinol,{' '}
            <Text className="font-sans-bold text-[22px]" style={{ color: colors.ink }}>alternate-night cycling</Text> was the most common way to keep it comfortable.
          </Text>
          <View className="mt-4 flex-row items-center gap-2.5 rounded-xl p-3" style={{ backgroundColor: colors.greigeChip }}>
            <View className="h-[18px] w-[18px] items-center justify-center rounded-full" style={{ backgroundColor: colors.sageTint }}>
              <Text className="text-[10px]" style={{ color: colors.sage }}>
                ✓
              </Text>
            </View>
            <Text className="flex-1 text-[11.5px]" tone="muted" style={{ lineHeight: 16 }}>
              {COMMUNITY_COPY.peopleLikeYou.aggregateNote}
            </Text>
          </View>
        </View>

        {/* what it never is */}
        <View className="mt-4 gap-2">
          {COMMUNITY_COPY.peopleLikeYou.nevers.map((n) => (
            <View key={n} className="flex-row items-center gap-2.5">
              <View className="h-[18px] w-[18px] items-center justify-center rounded-full" style={{ backgroundColor: colors.greige }}>
                <Text className="text-[10px]" style={{ color: colors.mutedLight }}>
                  ✕
                </Text>
              </View>
              <Text variant="bodySm" tone="muted" className="text-[12.5px]">
                {n}
              </Text>
            </View>
          ))}
        </View>

        <Text variant="label" tone="muted" className="mt-7 px-2 text-center" style={{ lineHeight: 17 }}>
          {COMMUNITY_COPY.peopleLikeYou.footer}
        </Text>
      </ScrollView>
    </Screen>
  );
}
