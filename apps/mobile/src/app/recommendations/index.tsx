import type { RecommendationTrigger } from '@onskin/types';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { RouteIconButton, Screen, Text } from '@/components/ui';
import { goalRecsShippable } from '@/features/recommendations/catalog';
import { REC_COPY } from '@/features/recommendations/copy';
import type { Recommendation } from '@/features/recommendations/engine';
import { useRecommendations } from '@/features/recommendations/useRecommendations';
import { track } from '@/lib/analytics/track';
import { APP_YOU_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

// 01 · The "For you" hub (docs/09 §7.1, design 01/03). The user's current
// recommendations grouped by honest trigger, each a calm what/why card. Deliberately
// NOT a storefront grid. When there's nothing to add, it shows the honest "you're
// set" state proudly (design 03).

const TRIGGER_GLYPH: Record<RecommendationTrigger, string> = {
  gap: '☀',
  routine_completion: '✦',
  replacement: '↻',
  conflict: '⇄',
  better_fit: '♡',
  goal: '◇',
};

// Preserve the engine's priority order while grouping by trigger.
function grouped(
  recs: Recommendation[],
): { trigger: RecommendationTrigger; group: string; items: Recommendation[] }[] {
  const order: RecommendationTrigger[] = [];
  const map = new Map<RecommendationTrigger, Recommendation[]>();
  for (const r of recs) {
    if (!map.has(r.trigger)) {
      map.set(r.trigger, []);
      order.push(r.trigger);
    }
    map.get(r.trigger)!.push(r);
  }
  return order.map((t) => ({ trigger: t, group: map.get(t)![0]!.group, items: map.get(t)! }));
}

function openRec(rec: Recommendation) {
  haptics.select();
  track('recommendation_expanded');
  // Replacement reuses the existing replenishment sheet (docs/04 §6); the rest open
  // the what/why/how card.
  if (rec.trigger === 'replacement' && rec.relatedProductId) {
    router.push({ pathname: '/shelf/replenish', params: { id: rec.relatedProductId } });
    return;
  }
  router.push({ pathname: '/recommendations/[id]', params: { id: rec.id } });
}

function RecCard({ rec }: { rec: Recommendation }) {
  const evidenceGood = rec.evidenceLabel === 'established' || rec.evidenceLabel === 'plausible';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${rec.what}. ${rec.why}`}
      onPress={() => openRec(rec)}
      className="mb-4 rounded-[18px] bg-paper-raised p-4"
      style={{ borderWidth: 1, borderColor: colors.hairline }}
    >
      <View className="flex-row items-start gap-3">
        <View
          className="h-9 w-9 items-center justify-center rounded-[10px]"
          style={{ backgroundColor: colors.clayTint }}
        >
          <Text className="text-[16px]" style={{ color: colors.clay }}>
            {TRIGGER_GLYPH[rec.trigger]}
          </Text>
        </View>
        <View className="flex-1">
          <View className="mb-1 flex-row items-center justify-between gap-2">
            <Text variant="body" className="flex-1 font-sans-bold text-[15px]">
              {rec.what}
            </Text>
            {rec.fitLabel ? (
              <Text
                className="font-mono text-[9.5px]"
                style={{
                  color: colors.clay,
                  backgroundColor: colors.clayTint,
                  paddingHorizontal: 7,
                  paddingVertical: 3,
                  borderRadius: 6,
                  overflow: 'hidden',
                }}
              >
                {rec.fitLabel}
              </Text>
            ) : null}
          </View>
          <Text variant="bodySm" tone="muted" className="text-[12.5px]" style={{ lineHeight: 18 }}>
            {rec.why}
          </Text>
        </View>
      </View>
      <View
        className="mt-3 flex-row items-start justify-between gap-3 pt-3"
        style={{ borderTopWidth: 1, borderTopColor: colors.hairline }}
      >
        <View className="min-w-0 flex-1 flex-row items-start gap-1.5">
          {rec.footIsEvidence && evidenceGood ? (
            <View
              className="mt-1.5 h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: colors.sage }}
            />
          ) : null}
          <Text
            className="flex-1 font-mono text-[10.5px]"
            style={{
              color: rec.footIsEvidence && evidenceGood ? colors.sage : colors.muted,
              flexShrink: 1,
              lineHeight: 15,
            }}
          >
            {rec.footLabel}
          </Text>
        </View>
        <Text
          className="font-sans-semibold text-[12.5px]"
          style={{ color: colors.clay, flexShrink: 0, textAlign: 'right' }}
        >
          {REC_COPY.card.seeHow} →
        </Text>
      </View>
    </Pressable>
  );
}

function YoureSet() {
  return (
    <View className="flex-1 items-center justify-center px-2">
      <View
        className="mb-7 h-[78px] w-[78px] items-center justify-center rounded-full bg-paper-raised"
        style={{ borderWidth: 1.5, borderColor: 'rgba(165,105,75,0.3)' }}
      >
        <Text className="text-[30px]" style={{ color: colors.clay }}>
          ✓
        </Text>
      </View>
      <Text
        variant="title"
        className="text-center text-[31px] leading-[34px]"
        accessibilityRole="header"
      >
        {REC_COPY.youreSet.title}
      </Text>
      <Text
        variant="body"
        tone="muted"
        className="mt-3.5 max-w-[300px] text-center"
        style={{ lineHeight: 23 }}
      >
        {goalRecsShippable() ? REC_COPY.youreSet.body : REC_COPY.youreSet.bodyNoGoals}
      </Text>
      <View className="mt-7 w-full max-w-[300px] gap-2.5">
        {REC_COPY.youreSet.checks.map((c) => (
          <View
            key={c}
            className="flex-row items-center gap-3 rounded-xl bg-paper-raised px-3.5 py-3"
            style={{ borderWidth: 1, borderColor: colors.hairline }}
          >
            <View
              className="h-[18px] w-[18px] items-center justify-center rounded-full"
              style={{ backgroundColor: colors.sageTint }}
            >
              <Text className="text-[10px]" style={{ color: colors.sage }}>
                ✓
              </Text>
            </View>
            <Text variant="bodySm" className="flex-1">
              {c}
            </Text>
          </View>
        ))}
      </View>
      <Text variant="label" tone="muted" className="mt-8 text-center">
        {REC_COPY.youreSet.footnote}
      </Text>
    </View>
  );
}

function HubIntro() {
  const [subtitleLead, ...subtitleRest] = REC_COPY.hub.subtitle.split(', ');
  const subtitleTail = subtitleRest.join(', ');

  return (
    <View className="mt-3">
      <Text variant="title" accessibilityRole="header" style={{ alignSelf: 'flex-start' }}>
        {REC_COPY.hub.title}
      </Text>
      <View className="mt-1">
        <Text variant="bodySm" tone="muted" style={{ alignSelf: 'flex-start' }}>
          {subtitleTail ? `${subtitleLead},` : REC_COPY.hub.subtitle}
        </Text>
        {subtitleTail ? (
          <Text variant="bodySm" tone="muted" style={{ alignSelf: 'flex-start' }}>
            {subtitleTail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function ForYouScreen() {
  const { result, isLoading } = useRecommendations();
  const groups = grouped(result.recommendations);

  useEffect(() => {
    if (isLoading) return;
    if (result.youreSet) track('youre_set_shown');
    else track('recommendation_shown', { count: result.recommendations.length });
  }, [isLoading, result.youreSet, result.recommendations.length]);

  return (
    <Screen edges={['top']}>
      <View className="flex-row items-center justify-between pt-1">
        <RouteIconButton
          accessibilityLabel="Back"
          onPress={() => backOrReplace(router, APP_YOU_ROUTE)}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/recommendations/preferences')}
          className="min-h-[48px] min-w-[48px] items-center justify-center px-2"
        >
          <Text variant="body" tone="muted" className="font-sans-medium">
            Preferences
          </Text>
        </Pressable>
      </View>

      <HubIntro />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text variant="bodySm" tone="muted">
            Looking at your routine…
          </Text>
        </View>
      ) : result.youreSet ? (
        <YoureSet />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10 pt-5">
          {groups.map((g) => (
            <View key={g.trigger} className="mb-2">
              <Text variant="label" tone="muted" className="mb-2.5 pl-0.5">
                {g.group.toUpperCase()}
              </Text>
              {g.items.map((rec) => (
                <RecCard key={rec.id} rec={rec} />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
