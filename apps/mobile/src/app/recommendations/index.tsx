import type { RecommendationTrigger } from '@onskin/types';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

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

function RecCard({
  rec,
  compact = false,
  short = false,
  ultraShort = false,
}: {
  rec: Recommendation;
  compact?: boolean;
  short?: boolean;
  ultraShort?: boolean;
}) {
  const evidenceGood = rec.evidenceLabel === 'established' || rec.evidenceLabel === 'plausible';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${rec.what}. ${rec.why}`}
      onPress={() => openRec(rec)}
      className={
        ultraShort
          ? 'mb-1.5 rounded-[12px] bg-paper-raised p-2'
          : short
          ? 'mb-2 rounded-[14px] bg-paper-raised p-2.5'
          : compact
            ? 'mb-3 rounded-[16px] bg-paper-raised p-3.5'
            : 'mb-4 rounded-[18px] bg-paper-raised p-4'
      }
      style={{ borderWidth: 1, borderColor: colors.hairline }}
    >
      <View
        className={
          short
            ? 'flex-row items-start gap-2'
            : compact
              ? 'flex-row items-start gap-2.5'
              : 'flex-row items-start gap-3'
        }
      >
        <View
          className={
            ultraShort
              ? 'h-6 w-6 items-center justify-center rounded-[7px]'
              : short
              ? 'h-7 w-7 items-center justify-center rounded-[8px]'
              : compact
                ? 'h-8 w-8 items-center justify-center rounded-[9px]'
                : 'h-9 w-9 items-center justify-center rounded-[10px]'
          }
          style={{ backgroundColor: colors.clayTint }}
        >
          <Text className={compact ? 'text-[14px]' : 'text-[16px]'} style={{ color: colors.clay }}>
            {TRIGGER_GLYPH[rec.trigger]}
          </Text>
        </View>
        <View className="flex-1">
          <View
            className={
              short
                ? 'mb-0.5 flex-row items-center justify-between gap-1.5'
                : compact
                  ? 'mb-0.5 flex-row items-center justify-between gap-2'
                  : 'mb-1 flex-row items-center justify-between gap-2'
            }
          >
            <Text
              variant="body"
              className={
                short
                  ? 'flex-1 font-sans-bold text-[13.5px]'
                  : compact
                    ? 'flex-1 font-sans-bold text-[14.5px]'
                    : 'flex-1 font-sans-bold text-[15px]'
              }
              style={short ? { lineHeight: 16 } : undefined}
            >
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
          <Text
            variant="bodySm"
            tone="muted"
            className={short ? 'text-[12px]' : 'text-[12.5px]'}
            style={{ lineHeight: short ? 14 : compact ? 16 : 18 }}
          >
            {rec.why}
          </Text>
        </View>
      </View>
      <View
        className={
          ultraShort
            ? 'mt-1 flex-row items-start justify-between gap-2 pt-1'
            : short
              ? 'mt-1.5 flex-row items-start justify-between gap-2 pt-1.5'
              : compact
                ? 'mt-2 flex-row items-start justify-between gap-2.5 pt-2'
                : 'mt-3 flex-row items-start justify-between gap-3 pt-3'
        }
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
            className={
              short
                ? 'flex-1 font-mono text-[9.5px]'
                : compact
                  ? 'flex-1 font-mono text-[10px]'
                  : 'flex-1 font-mono text-[10.5px]'
            }
            style={{
              color: rec.footIsEvidence && evidenceGood ? colors.sage : colors.muted,
              flexShrink: 1,
              lineHeight: short ? 12 : compact ? 13 : 15,
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

function YoureSet({ compact = false }: { compact?: boolean }) {
  return (
    <ScrollView
      className="flex-1"
      showsVerticalScrollIndicator={false}
      contentContainerClassName={
        compact
          ? 'items-center px-2 pb-28 pt-3'
          : 'flex-grow items-center justify-center px-2 pb-10 pt-7'
      }
    >
      <View
        className={
          compact
            ? 'mb-4 items-center justify-center rounded-full bg-paper-raised'
            : 'mb-7 items-center justify-center rounded-full bg-paper-raised'
        }
        style={{
          width: compact ? 50 : 78,
          height: compact ? 50 : 78,
          borderWidth: 1.5,
          borderColor: 'rgba(165,105,75,0.3)',
        }}
      >
        <Text style={{ color: colors.clay, fontSize: compact ? 23 : 30 }}>✓</Text>
      </View>
      <Text
        variant="title"
        className={
          compact
            ? 'text-center text-[27px] leading-[30px]'
            : 'text-center text-[31px] leading-[34px]'
        }
        accessibilityRole="header"
      >
        {REC_COPY.youreSet.title}
      </Text>
      <Text
        variant={compact ? 'bodySm' : 'body'}
        tone="muted"
        className={
          compact ? 'mt-2.5 max-w-[300px] text-center' : 'mt-3.5 max-w-[300px] text-center'
        }
        style={{ lineHeight: compact ? 20 : 23 }}
      >
        {goalRecsShippable() ? REC_COPY.youreSet.body : REC_COPY.youreSet.bodyNoGoals}
      </Text>
      <View
        className={
          compact ? 'mt-4 w-full max-w-[300px] gap-2' : 'mt-7 w-full max-w-[300px] gap-2.5'
        }
      >
        {REC_COPY.youreSet.checks.map((c) => (
          <View
            key={c}
            className={
              compact
                ? 'flex-row items-center gap-3 rounded-xl bg-paper-raised px-3.5 py-2'
                : 'flex-row items-center gap-3 rounded-xl bg-paper-raised px-3.5 py-3'
            }
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
      <Text
        variant="label"
        tone="muted"
        className={compact ? 'mt-5 pb-2 text-center' : 'mt-8 text-center'}
      >
        {REC_COPY.youreSet.footnote}
      </Text>
    </ScrollView>
  );
}

function HubIntro({
  short = false,
  ultraShort = false,
}: {
  short?: boolean;
  ultraShort?: boolean;
}) {
  const [subtitleLead, ...subtitleRest] = REC_COPY.hub.subtitle.split(', ');
  const subtitleTail = subtitleRest.join(', ');

  return (
    <View className={ultraShort ? 'mt-0.5' : short ? 'mt-1.5' : 'mt-3'}>
      <Text
        variant="title"
        accessibilityRole="header"
        className={
          ultraShort
            ? 'text-[27px] leading-[29px]'
            : short
              ? 'text-[28px] leading-[30px]'
              : undefined
        }
        style={{ alignSelf: 'flex-start' }}
      >
        {REC_COPY.hub.title}
      </Text>
      <View className={short ? 'mt-0.5' : 'mt-1'}>
        <Text
          variant="bodySm"
          tone="muted"
          className={short ? 'text-[12px] leading-[15px]' : undefined}
          style={{ alignSelf: 'flex-start' }}
        >
          {subtitleTail ? `${subtitleLead},` : REC_COPY.hub.subtitle}
        </Text>
        {subtitleTail ? (
          <Text
            variant="bodySm"
            tone="muted"
            className={short ? 'text-[12px] leading-[15px]' : undefined}
            style={{ alignSelf: 'flex-start' }}
          >
            {subtitleTail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function ForYouScreen() {
  const { height, width } = useWindowDimensions();
  const { result, isLoading } = useRecommendations();
  const groups = grouped(result.recommendations);
  const compactHub = height < 640;
  const shortHub = height < 520;
  const ultraShortHub = height < 460;
  const narrowCompactHub = compactHub && width <= 430;

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

      <HubIntro short={shortHub} ultraShort={ultraShortHub} />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text variant="bodySm" tone="muted">
            Looking at your routine…
          </Text>
        </View>
      ) : result.youreSet ? (
        <YoureSet compact={compactHub} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName={
            ultraShortHub
              ? 'pb-20 pt-1'
              : shortHub
                ? 'pb-20 pt-2'
                : compactHub
                  ? 'pb-12 pt-4'
                  : 'pb-10 pt-5'
          }
        >
          {groups.map((g) => (
            <View key={g.trigger} className={shortHub ? 'mb-1' : compactHub ? 'mb-1.5' : 'mb-2'}>
              <Text
                variant="label"
                tone="muted"
                className={shortHub ? 'mb-1.5 pl-0.5' : 'mb-2.5 pl-0.5'}
              >
                {g.group.toUpperCase()}
              </Text>
              {g.items.map((rec, recIndex) => {
                const keepNextCardBelowFold = narrowCompactHub && recIndex > 1;
                return (
                  <View key={rec.id} style={keepNextCardBelowFold ? { marginTop: 80 } : undefined}>
                    <RecCard
                      rec={rec}
                      compact={compactHub}
                      short={shortHub}
                      ultraShort={ultraShortHub}
                    />
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
