import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import type { SequencingRole } from '@onskin/types';

import { RouteIconButton, Screen, Text } from '@/components/ui';
import { WhereToBuy } from '@/features/commerce/WhereToBuy';
import { recTypeByKey } from '@/features/recommendations/catalog';
import { REC_COPY } from '@/features/recommendations/copy';
import {
  containRecommendationDismissalFailure,
  publishCommittedRecommendationDismissal,
} from '@/features/recommendations/dismissalMutation';
import type { Recommendation } from '@/features/recommendations/engine';
import { dismissRecommendation } from '@/features/recommendations/store';
import { useRecommendations } from '@/features/recommendations/useRecommendations';
import { trackProductAddStarted } from '@/features/shelf/analytics';
import type { ProductCategory } from '@/features/shelf/categories';
import {
  PRIVATE_GUIDANCE_AVAILABILITY_COPY,
  ShelfDataUnavailableNotice,
  type DataAvailabilityCopy,
} from '@/features/shelf/ShelfDataAvailabilityGate';
import { track } from '@/lib/analytics/track';
import { APP_RECOMMENDATIONS_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { isOwnerQueryScopeCurrent } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

// Map the recommended type's sequencing role to the manual-add category so an
// accepted rec lands on a pre-filled form, not a blank/stale one (docs/09 §11).
const ROLE_TO_CATEGORY: Partial<Record<SequencingRole, ProductCategory>> = {
  spf: 'spf',
  cleanser: 'cleanser',
  moisturiser: 'moisturiser_tube',
  hydrating_serum: 'serum',
  antioxidant: 'vitamin_c_serum',
  treatment: 'retinoid_serum',
  exfoliant: 'serum',
};

const RECOMMENDATION_DISMISS_AVAILABILITY_COPY: DataAvailabilityCopy = {
  eyebrow: 'Private choices',
  title: 'Suggestion not dismissed',
  body: "We couldn't save “Not for me,” then couldn't safely reload your recommendation choices. Nothing was removed. Reload them before trying again.",
  retry: 'Try again',
  retrying: 'Trying again...',
  retryFailed: 'Your saved recommendation choices are still unavailable. Nothing was removed.',
};

// 02 · The what / why / how card (docs/09 §6, design 02). Every recommendation
// carries the trust triad. What (type-first) / Why (your reason) / How (the
// decision, with the evidence grade + an honest caveat). Never a bare product +
// buy button. The "how" is what makes it trust, not a sell.

function HowRow({ k, value, accent }: { k: string; value: string; accent?: string }) {
  return (
    <View className="flex-row gap-2.5">
      <Text
        className="font-mono text-[10px]"
        tone="muted"
        numberOfLines={1}
        style={{ width: 72, flexShrink: 0 }}
      >
        {k}
      </Text>
      <Text
        className="flex-1 text-[12.5px]"
        style={{ color: accent ?? colors.inkSoft, lineHeight: 18 }}
      >
        {value}
      </Text>
    </View>
  );
}

function Body({
  rec,
  dismissFailed,
  onDismissFailure,
  onDismissSuccess,
}: {
  rec: Recommendation;
  dismissFailed: boolean;
  onDismissFailure: () => void;
  onDismissSuccess: () => void;
}) {
  const qc = useQueryClient();
  const ownerScope = useOwnerQueryScope();
  const mountedRef = useRef(true);
  const dismissInFlightRef = useRef(false);
  const [dismissing, setDismissing] = useState(false);
  const isConflict = rec.trigger === 'conflict';
  const canPublish = () => mountedRef.current && isOwnerQueryScopeCurrent(ownerScope);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const dismiss = async () => {
    if (dismissInFlightRef.current) return;
    dismissInFlightRef.current = true;
    setDismissing(true);
    haptics.select();
    try {
      await dismissRecommendation(ownerScope, rec.id);
    } catch {
      await containRecommendationDismissalFailure(qc, ownerScope, {
        isMounted: () => mountedRef.current,
        onFailure: onDismissFailure,
        onRelease: () => {
          dismissInFlightRef.current = false;
          setDismissing(false);
        },
      });
      return;
    }

    if (!publishCommittedRecommendationDismissal(qc, ownerScope, rec.id)) return;
    track('recommendation_dismissed');
    if (!canPublish()) return;
    onDismissSuccess();
    // The cache update above removes this stale detail before its strict reread.
    // Keep the action lock set until unmount and navigate exactly once now.
    backOrReplace(router, APP_RECOMMENDATIONS_ROUTE);
  };

  // Where-to-buy is for real catalog types (gap / goal / better-fit / completion) ,
  // the shelf-anchored replacement & conflict triggers route elsewhere (docs/10 §3).
  const showWhereToBuy = rec.trigger !== 'replacement' && rec.trigger !== 'conflict';

  const accept = () => {
    if (dismissing) return;
    haptics.success();
    track('recommendation_accepted');
    if (isConflict && rec.relatedRuleId) {
      const [productAId, productBId] = rec.relatedConflictProductIds ?? [];
      router.push({
        pathname: '/conflict/[ruleId]',
        params: {
          ruleId: rec.relatedRuleId,
          ...(productAId && productBId ? { productAId, productBId } : {}),
        },
      });
      return;
    }
    // No catalog yet (B-CATALOG-SEED) → the honest path is the manual-add flow, so
    // the user adds their own product of this type. Church-and-state intact. Carry
    // the recommended type's category so the form is pre-filled, not blank/stale.
    const recType = recTypeByKey(rec.productType);
    const presetCategory = recType ? ROLE_TO_CATEGORY[recType.role] : undefined;
    trackProductAddStarted('recommendation');
    router.push(
      presetCategory ? { pathname: '/shelf/manual', params: { presetCategory } } : '/shelf/manual',
    );
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-8">
      <View
        className="rounded-[22px] bg-paper-raised p-5"
        style={{ borderWidth: 1, borderColor: colors.hairline }}
      >
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
            style={{ borderWidth: 1, borderColor: colors.hairline }}
          >
            <View
              className="h-9 w-[26px] rounded"
              style={{
                backgroundColor: colors.greige,
                borderWidth: 1,
                borderColor: colors.hairline,
              }}
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
          {rec.how.caveat ? (
            <HowRow k={REC_COPY.howKeys.caveat} value={rec.how.caveat} accent="#8A6A55" />
          ) : null}
        </View>

        {/* Where to buy (docs/10 §3). A quiet, consent-gated, FTC-disclosed affordance
            BENEATH the rationale; church-and-state walled, opaque-token attribution. */}
        {showWhereToBuy ? <WhereToBuy productType={rec.productType} /> : null}
      </View>

      {dismissFailed ? (
        <View
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          className="mt-4 rounded-xl bg-clay-tint px-3.5 py-3"
          style={{ borderWidth: 1, borderColor: colors.hairline }}
        >
          <Text className="font-sans-bold text-[13px]" style={{ color: colors.clayDeep }}>
            Suggestion not dismissed
          </Text>
          <Text variant="bodySm" tone="muted" className="mt-1">
            We couldn&apos;t save “Not for me.” Nothing was removed. You can try again.
          </Text>
        </View>
      ) : null}

      {/* actions */}
      <View className="mt-4 flex-row gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: dismissing }}
          disabled={dismissing}
          onPress={accept}
          className="h-[50px] flex-1 items-center justify-center rounded-pill"
          style={{ backgroundColor: colors.clay, opacity: dismissing ? 0.6 : 1 }}
        >
          <Text className="font-sans-semibold text-[15px]" style={{ color: colors.paper }}>
            {isConflict ? 'See the clash' : REC_COPY.card.addToShelf}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: dismissing }}
          disabled={dismissing}
          onPress={dismiss}
          className="h-[50px] items-center justify-center rounded-pill px-6"
          style={{
            borderWidth: 1.5,
            borderColor: colors.hairlineStrong,
            opacity: dismissing ? 0.6 : 1,
          }}
        >
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
  const { width } = useWindowDimensions();
  const { result, isError, isFetching, isLoading, retry } = useRecommendations();
  const [dismissFailed, setDismissFailed] = useState(false);
  const rec = result.recommendations.find((r) => r.id === id);
  const compactHeader = width <= 360;

  return (
    <Screen edges={['top']}>
      <View className="flex-row items-center gap-3 pb-2 pt-1">
        <RouteIconButton
          accessibilityLabel="Back"
          onPress={() => backOrReplace(router, APP_RECOMMENDATIONS_ROUTE)}
        />
        <Text
          variant="body"
          adjustsFontSizeToFit
          accessibilityLabel="Recommendation"
          className="flex-1 font-sans-semibold"
          minimumFontScale={0.82}
          numberOfLines={1}
          tone="muted"
          style={{ minWidth: 0 }}
        >
          {compactHeader ? 'Suggestion' : 'Recommendation'}
        </Text>
      </View>

      {isError ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingBottom: 48 }}
        >
          <ShelfDataUnavailableNotice
            copy={
              dismissFailed
                ? RECOMMENDATION_DISMISS_AVAILABILITY_COPY
                : PRIVATE_GUIDANCE_AVAILABILITY_COPY
            }
            onRetry={retry}
            retrying={isFetching}
            onExit={() => backOrReplace(router, APP_RECOMMENDATIONS_ROUTE)}
            exitLabel="Back to For you"
          />
        </ScrollView>
      ) : isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text variant="bodySm" tone="muted">
            Looking at your routine…
          </Text>
        </View>
      ) : !rec ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text variant="body" tone="muted" className="text-center">
            This suggestion isn’t current anymore. Your routine may have changed.
          </Text>
          <Pressable
            accessibilityRole="button"
            className="mt-4 min-h-[48px] items-center justify-center py-2"
            onPress={() => backOrReplace(router, APP_RECOMMENDATIONS_ROUTE)}
          >
            <Text className="font-sans-semibold" tone="muted">
              Back to For you
            </Text>
          </Pressable>
        </View>
      ) : (
        <Body
          rec={rec}
          dismissFailed={dismissFailed}
          onDismissFailure={() => setDismissFailed(true)}
          onDismissSuccess={() => setDismissFailed(false)}
        />
      )}
    </Screen>
  );
}
