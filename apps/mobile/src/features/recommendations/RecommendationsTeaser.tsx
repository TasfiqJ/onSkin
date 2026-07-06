import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { track } from '@/lib/analytics/track';
import { cn } from '@/lib/cn';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

import { REC_COPY } from './copy';
import { dismissRecommendation } from './store';
import { useRecommendations } from './useRecommendations';

// The recommendation surfaces ON Today (docs/09 §7.1/§7.2): a calm "For you" entry
// card + the in-routine SPF gap prompt (design 04). Inline, dismissible, never
// modal-blocking, surfaced where the need arises. Both route into the hub.

function ForYouCard({ compact, count, youreSet }: { compact?: boolean; count: number; youreSet: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="See your recommendations"
      onPress={() => {
        haptics.select();
        router.push('/recommendations');
      }}
      className={cn(
        'flex-row items-center rounded-card bg-paper-raised',
        compact ? 'mt-3 gap-3 p-4' : 'mt-4 gap-4 p-5',
      )}
      style={{ borderWidth: 1, borderColor: colors.hairline }}>
      <View
        className={
          compact
            ? 'h-9 w-9 items-center justify-center rounded-full'
            : 'h-[38px] w-[38px] items-center justify-center rounded-full'
        }
        style={{ backgroundColor: colors.clayTint }}>
        <Text className="text-[16px]" style={{ color: colors.clay }}>
          ✦
        </Text>
      </View>
      <View className="flex-1">
        <Text variant="body" className="font-sans-semibold text-[15px]">
          {REC_COPY.todayCard.title}
        </Text>
        <Text variant="bodySm" tone="muted" className={compact ? 'text-[12.5px]' : 'text-[13px]'}>
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

function GapPrompt({ compact, recId }: { compact?: boolean; recId: string }) {
  const qc = useQueryClient();
  // Persist the dismissal (docs/09 §7.2): writing it to the dismissed store means
  // the engine drops the rec, so a dismissed SPF nudge stays dismissed across
  // sessions, matching the hub. (Was local useState that reappeared on remount.)
  const dismiss = async () => {
    await dismissRecommendation(recId);
    await qc.invalidateQueries({ queryKey: ['recPrefsAndDismissed'] });
  };

  const openRecommendation = () => {
    haptics.select();
    track('recommendation_expanded');
    router.push({ pathname: '/recommendations/[id]', params: { id: recId } });
  };

  if (compact) {
    return (
      <View
        className="mt-3 flex-row items-center gap-2 rounded-[16px] p-2.5"
        style={{
          backgroundColor: colors.clayTint,
          borderWidth: 1,
          borderColor: 'rgba(165,105,75,0.22)',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={REC_COPY.gapPrompt.cta}
          onPress={openRecommendation}
          className="min-h-[48px] flex-1 flex-row items-center gap-2"
        >
          <View
            className="h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: colors.clay }}
          >
            <Text className="font-sans-bold text-[10px]" style={{ color: colors.paper }}>
              SPF
            </Text>
          </View>
          <View className="min-w-0 flex-1">
            <Text
              numberOfLines={2}
              className="font-sans-bold text-[13px]"
              style={{ color: colors.clayDeep, lineHeight: 16 }}
            >
              {REC_COPY.gapPrompt.title}
            </Text>
            <Text className="mt-0.5 font-sans-semibold text-[12.5px]" style={{ color: colors.clay }}>
              {REC_COPY.gapPrompt.cta}
            </Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={REC_COPY.gapPrompt.dismiss}
          onPress={() => void dismiss()}
          className="h-12 w-12 items-center justify-center rounded-full"
          style={{
            backgroundColor: 'rgba(165,105,75,0.12)',
            borderWidth: 1,
            borderColor: 'rgba(165,105,75,0.14)',
          }}
        >
          <Text className="font-sans-bold text-[14px]" style={{ color: colors.clay }}>
            x
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      className="mt-4 rounded-[18px] p-4"
      style={{ backgroundColor: colors.clayTint, borderWidth: 1, borderColor: 'rgba(165,105,75,0.22)' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss SPF recommendation"
        onPress={() => void dismiss()}
        className="absolute right-3 top-3 h-12 w-12 items-center justify-center rounded-full"
        style={{
          backgroundColor: 'rgba(165,105,75,0.12)',
          borderWidth: 1,
          borderColor: 'rgba(165,105,75,0.14)',
        }}>
        <Text className="text-[14px]" style={{ color: colors.clay }}>
          ✕
        </Text>
      </Pressable>
      <View className="mb-2 flex-row items-center gap-2.5 pr-12">
        <View
          className="h-[30px] w-[30px] items-center justify-center rounded-lg"
          style={{ backgroundColor: colors.clay }}>
          <Text className="text-[15px]" style={{ color: colors.paper }}>
            ☀
          </Text>
        </View>
        <Text
          className="flex-1 font-sans-bold text-[14.5px]"
          style={{ color: colors.clayDeep }}>
          {REC_COPY.gapPrompt.title}
        </Text>
      </View>
      <Text
        className="mb-3 text-[12.5px]"
        style={{ color: '#6F4A36', lineHeight: 18 }}>
        {REC_COPY.gapPrompt.body}
      </Text>
      <View className="flex-row items-center gap-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={REC_COPY.gapPrompt.cta}
          onPress={openRecommendation}
          className="items-center justify-center rounded-pill px-5 py-2"
          style={{ minHeight: 48, backgroundColor: colors.clay }}>
          <Text className="font-sans-semibold text-[13.5px]" style={{ color: colors.paper }}>
            {REC_COPY.gapPrompt.cta}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={REC_COPY.gapPrompt.dismiss}
          onPress={() => void dismiss()}
          className="items-center justify-center rounded-pill px-4 py-2"
          style={{
            minHeight: 48,
            borderWidth: 1,
            borderColor: 'rgba(165,105,75,0.22)',
            backgroundColor: 'rgba(255,255,255,0.18)',
          }}>
          <Text className="font-sans-semibold text-[13.5px]" style={{ color: colors.clay }}>
            {REC_COPY.gapPrompt.dismiss}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function RecommendationsTeaser({
  compact = false,
  showGapPrompt = false,
}: {
  compact?: boolean;
  showGapPrompt?: boolean;
}) {
  const { result, isLoading } = useRecommendations();
  if (isLoading) return null;

  const spfGap = result.recommendations.find(
    (r) => (r.trigger === 'gap' || r.trigger === 'routine_completion') && r.productType.includes('spf'),
  );
  const showCompactGapOnly = compact && showGapPrompt && Boolean(spfGap);

  return (
    <>
      {showGapPrompt && spfGap ? <GapPrompt compact={compact} recId={spfGap.id} /> : null}
      {showCompactGapOnly ? null : (
        <ForYouCard compact={compact} count={result.recommendations.length} youreSet={result.youreSet} />
      )}
    </>
  );
}
