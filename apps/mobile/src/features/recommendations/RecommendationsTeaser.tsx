import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { track } from '@/lib/analytics/track';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

import { REC_COPY } from './copy';
import { useRecommendations } from './useRecommendations';

// The recommendation surfaces ON Today (docs/09 §7.1/§7.2): a calm "For you" entry
// card + the in-routine SPF gap prompt (design 04) — inline, dismissible, never
// modal-blocking, surfaced where the need arises. Both route into the hub.

function ForYouCard({ count, youreSet }: { count: number; youreSet: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="See your recommendations"
      onPress={() => {
        haptics.select();
        router.push('/recommendations');
      }}
      className="mt-4 flex-row items-center gap-4 rounded-card bg-paper-raised p-5"
      style={{ borderWidth: 1, borderColor: colors.hairline }}>
      <View className="h-[38px] w-[38px] items-center justify-center rounded-full" style={{ backgroundColor: colors.clayTint }}>
        <Text className="text-[16px]" style={{ color: colors.clay }}>
          ✦
        </Text>
      </View>
      <View className="flex-1">
        <Text variant="body" className="font-sans-semibold text-[15px]">
          {REC_COPY.todayCard.title}
        </Text>
        <Text variant="bodySm" tone="muted" className="text-[13px]">
          {youreSet
            ? REC_COPY.todayCard.bodySet
            : count === 1
              ? REC_COPY.todayCard.bodyOne
              : REC_COPY.todayCard.bodyMany(count)}
        </Text>
      </View>
      <Text style={{ color: colors.mutedLight, fontSize: 20 }}>›</Text>
    </Pressable>
  );
}

function GapPrompt({ recId }: { recId: string }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <View
      className="mt-4 rounded-[18px] p-4"
      style={{ backgroundColor: colors.clayTint, borderWidth: 1, borderColor: 'rgba(165,105,75,0.22)' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={() => setDismissed(true)}
        hitSlop={8}
        className="absolute right-3.5 top-3.5 h-5 w-5 items-center justify-center rounded-full"
        style={{ backgroundColor: 'rgba(165,105,75,0.12)' }}>
        <Text className="text-[11px]" style={{ color: colors.clay }}>
          ✕
        </Text>
      </Pressable>
      <View className="mb-2 flex-row items-center gap-2.5 pr-6">
        <View className="h-[30px] w-[30px] items-center justify-center rounded-lg" style={{ backgroundColor: colors.clay }}>
          <Text className="text-[15px]" style={{ color: colors.paper }}>
            ☀
          </Text>
        </View>
        <Text className="flex-1 font-sans-bold text-[14.5px]" style={{ color: colors.clayDeep }}>
          {REC_COPY.gapPrompt.title}
        </Text>
      </View>
      <Text className="mb-3 text-[12.5px]" style={{ color: '#6F4A36', lineHeight: 18 }}>
        {REC_COPY.gapPrompt.body}
      </Text>
      <View className="flex-row items-center gap-4">
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            haptics.select();
            track('recommendation_expanded', { trigger: 'gap', type: 'spf' });
            router.push({ pathname: '/recommendations/[id]', params: { id: recId } });
          }}
          className="h-[38px] items-center justify-center rounded-pill px-5"
          style={{ backgroundColor: colors.clay }}>
          <Text className="font-sans-semibold text-[13.5px]" style={{ color: colors.paper }}>
            {REC_COPY.gapPrompt.cta}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setDismissed(true)} hitSlop={6}>
          <Text className="font-sans-semibold text-[13.5px]" style={{ color: colors.clay }}>
            {REC_COPY.gapPrompt.dismiss}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function RecommendationsTeaser({ showGapPrompt = false }: { showGapPrompt?: boolean }) {
  const { result, isLoading } = useRecommendations();
  if (isLoading) return null;

  const spfGap = result.recommendations.find(
    (r) => (r.trigger === 'gap' || r.trigger === 'routine_completion') && r.productType.includes('spf'),
  );

  return (
    <>
      {showGapPrompt && spfGap ? <GapPrompt recId={spfGap.id} /> : null}
      <ForYouCard count={result.recommendations.length} youreSet={result.youreSet} />
    </>
  );
}
