import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { REC_COPY } from '@/features/recommendations/copy';
import type { Recommendation } from '@/features/recommendations/engine';
import { dismissRecommendation } from '@/features/recommendations/store';
import { useRecommendations } from '@/features/recommendations/useRecommendations';
import { track } from '@/lib/analytics/track';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

// 02 · The what / why / how card (docs/09 §6, design 02). Every recommendation
// carries the trust triad — What (type-first) / Why (your reason) / How (the
// decision, with the evidence grade + an honest caveat). Never a bare product +
// buy button. The "how" is what makes it trust, not a sell.

function HowRow({ k, value, accent }: { k: string; value: string; accent?: string }) {
  return (
    <View className="flex-row gap-2.5">
      <Text className="font-mono text-[10px]" tone="muted" style={{ width: 64 }}>
        {k}
      </Text>
      <Text className="flex-1 text-[12.5px]" style={{ color: accent ?? colors.inkSoft, lineHeight: 18 }}>
        {value}
      </Text>
    </View>
  );
}

function Body({ rec }: { rec: Recommendation }) {
  const qc = useQueryClient();
  const isConflict = rec.trigger === 'conflict';

  const dismiss = async () => {
    haptics.select();
    track('recommendation_dismissed', { trigger: rec.trigger, type: rec.productType });
    await dismissRecommendation(rec.id);
    await qc.invalidateQueries({ queryKey: ['recPrefsAndDismissed'] });
    router.back();
  };

  const accept = () => {
    haptics.success();
    track('recommendation_accepted', { trigger: rec.trigger, type: rec.productType });
    if (isConflict && rec.relatedRuleId) {
      router.push({ pathname: '/conflict/[ruleId]', params: { ruleId: rec.relatedRuleId } });
      return;
    }
    // No catalog yet (B-CATALOG-SEED) → the honest path is the manual-add flow, so
    // the user adds their own product of this type. Church-and-state intact.
    router.push('/shelf/manual');
  };

  // The disclosed-commerce link is INERT here (doc #10 / B-PRIVACY): it states the
  // disclosure honestly and explains links arrive with the catalog, behind the
  // separate data-sharing consent — it shares nothing. We deliberately fire NO
  // analytics here: a commerce-intent tap must never enter the merit accept/dismiss
  // relevance funnel (docs/09 §12 — instrument for trust, never toward commission).
  const whereToFind = () => {
    Alert.alert(
      'Where to find it',
      'Shopping links arrive with the product catalog, and they’re shared only after you turn on data-sharing in Settings. It never affects what we recommend.',
      [{ text: 'OK' }],
    );
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-8">
      <View className="rounded-[22px] bg-paper-raised p-5" style={{ borderWidth: 1, borderColor: colors.hairline }}>
        {/* WHAT */}
        <Text variant="label" tone="muted" className="mb-1.5">
          {REC_COPY.card.whatLabel.toUpperCase()}
        </Text>
        <Text variant="title" className="text-[27px] leading-[29px]" accessibilityRole="header">
          {rec.what}
        </Text>
        {rec.example ? (
          <View
            className="mt-3 flex-row items-center gap-3 rounded-xl bg-paper p-2.5"
            style={{ borderWidth: 1, borderColor: colors.hairline }}>
            <View
              className="h-9 w-[26px] rounded"
              style={{ backgroundColor: colors.greige, borderWidth: 1, borderColor: colors.hairline }}
            />
            <View className="flex-1">
              <Text variant="bodySm" className="font-sans-medium text-[12.5px]">
                {rec.example}
              </Text>
              <Text className="font-mono text-[10px]" tone="muted">
                {REC_COPY.card.specificNote}
              </Text>
            </View>
          </View>
        ) : null}

        {/* WHY */}
        <Text variant="label" tone="muted" className="mb-1.5 mt-5">
          {REC_COPY.card.whyLabel.toUpperCase()}
        </Text>
        <Text className="text-[13.5px]" style={{ color: colors.inkSoft, lineHeight: 21 }}>
          {rec.why}
        </Text>

        {/* HOW */}
        <Text variant="label" className="mb-2.5 mt-5" style={{ color: colors.clay }}>
          {REC_COPY.card.howLabel.toUpperCase()}
        </Text>
        <View className="gap-2">
          <HowRow k={REC_COPY.howKeys.profile} value={rec.how.profile} />
          <HowRow k={REC_COPY.howKeys.gap} value={rec.how.gap} />
          <HowRow k={REC_COPY.howKeys.evidence} value={rec.how.evidence} accent={colors.sageBody} />
          <HowRow k={REC_COPY.howKeys.fit} value={rec.how.fit} />
          {rec.how.caveat ? <HowRow k={REC_COPY.howKeys.caveat} value={rec.how.caveat} accent="#8A6A55" /> : null}
        </View>

        {/* disclosed commerce — inert (doc #10 / B-PRIVACY) */}
        <View
          className="mt-4 flex-row items-center justify-between pt-3"
          style={{ borderTopWidth: 1, borderTopColor: colors.hairline }}>
          <Text className="max-w-[210px] text-[11px]" tone="muted" style={{ lineHeight: 15 }}>
            {REC_COPY.card.disclosure}
          </Text>
          <Pressable accessibilityRole="button" onPress={whereToFind} hitSlop={6}>
            <Text className="font-sans-semibold text-[12.5px]" style={{ color: colors.clay }}>
              {REC_COPY.card.whereToFind} →
            </Text>
          </Pressable>
        </View>
      </View>

      {/* actions */}
      <View className="mt-4 flex-row gap-3">
        <Pressable
          accessibilityRole="button"
          onPress={accept}
          className="h-[50px] flex-1 items-center justify-center rounded-pill"
          style={{ backgroundColor: colors.clay }}>
          <Text className="font-sans-semibold text-[15px]" style={{ color: colors.paper }}>
            {isConflict ? 'See the clash' : REC_COPY.card.addToShelf}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={dismiss}
          className="h-[50px] items-center justify-center rounded-pill px-6"
          style={{ borderWidth: 1.5, borderColor: colors.hairlineStrong }}>
          <Text className="font-sans-semibold text-[15px]" tone="muted">
            {REC_COPY.card.dismiss}
          </Text>
        </Pressable>
      </View>
      <Text variant="label" tone="muted" className="mt-4 text-center">
        {REC_COPY.card.optional}
      </Text>
    </ScrollView>
  );
}

export default function RecommendationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { result, isLoading } = useRecommendations();
  const rec = result.recommendations.find((r) => r.id === id);

  return (
    <Screen edges={['top']}>
      <View className="flex-row items-center gap-3 pb-2 pt-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          className="h-7 w-7 items-center justify-center rounded-full bg-paper-raised"
          style={{ borderWidth: 1, borderColor: colors.hairline }}>
          <Text style={{ color: colors.ink }}>‹</Text>
        </Pressable>
        <Text variant="body" className="font-sans-semibold" tone="muted">
          Recommendation
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text variant="bodySm" tone="muted">
            Looking at your routine…
          </Text>
        </View>
      ) : !rec ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text variant="body" tone="muted" className="text-center">
            This suggestion isn’t current anymore — your routine may have changed.
          </Text>
          <Pressable accessibilityRole="button" className="mt-4 py-2" onPress={() => router.back()}>
            <Text className="font-sans-semibold" tone="muted">
              Back to For you
            </Text>
          </Pressable>
        </View>
      ) : (
        <Body rec={rec} />
      )}
    </Screen>
  );
}
