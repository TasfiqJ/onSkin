import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { track } from '@/lib/analytics/track';
import { cn } from '@/lib/cn';
import { isOwnerQueryScopeCurrent } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

import { REC_COPY } from './copy';
import {
  containRecommendationDismissalFailure,
  publishCommittedRecommendationDismissal,
} from './dismissalMutation';
import { dismissRecommendation } from './store';
import { useRecommendations } from './useRecommendations';

// The recommendation surfaces ON Today (docs/09 §7.1/§7.2): a calm "For you" entry
// card + the in-routine SPF gap prompt (design 04). Inline, dismissible, never
// modal-blocking, surfaced where the need arises. Both route into the hub.

function ForYouCard({
  compact,
  count,
  youreSet,
}: {
  compact?: boolean;
  count: number;
  youreSet: boolean;
}) {
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
      style={{ borderWidth: 1, borderColor: colors.hairline }}
    >
      <View
        className={
          compact
            ? 'h-9 w-9 items-center justify-center rounded-full'
            : 'h-[38px] w-[38px] items-center justify-center rounded-full'
        }
        style={{ backgroundColor: colors.clayTint }}
      >
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

function GapPrompt({
  compact,
  recId,
  onDismissFailure,
  onDismissSuccess,
}: {
  compact?: boolean;
  recId: string;
  onDismissFailure: () => void;
  onDismissSuccess: () => void;
}) {
  const qc = useQueryClient();
  const ownerScope = useOwnerQueryScope();
  const mountedRef = useRef(true);
  const dismissInFlightRef = useRef(false);
  const [dismissing, setDismissing] = useState(false);
  const compactTitle = 'No SPF this morning';
  const canPublish = () => mountedRef.current && isOwnerQueryScopeCurrent(ownerScope);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Persist the dismissal (docs/09 §7.2): writing it to the dismissed store means
  // the engine drops the rec, so a dismissed SPF nudge stays dismissed across
  // sessions, matching the hub. (Was local useState that reappeared on remount.)
  const dismiss = async () => {
    if (dismissInFlightRef.current) return;
    dismissInFlightRef.current = true;
    setDismissing(true);
    try {
      await dismissRecommendation(ownerScope, recId);
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

    if (!publishCommittedRecommendationDismissal(qc, ownerScope, recId)) return;
    if (!canPublish()) return;
    onDismissSuccess();
    // The synchronous cache patch removes this prompt before the strict reread,
    // so its actions stay unavailable until this component unmounts.
  };

  const openRecommendation = () => {
    if (dismissing) return;
    haptics.select();
    track('recommendation_expanded');
    router.push({ pathname: '/recommendations/[id]', params: { id: recId } });
  };

  if (compact) {
    return (
      <View
        className="mt-0 flex-row items-center gap-2 rounded-[16px] p-0"
        style={{
          backgroundColor: colors.clayTint,
          borderWidth: 1,
          borderColor: 'rgba(165,105,75,0.22)',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={REC_COPY.gapPrompt.cta}
          accessibilityState={{ disabled: dismissing }}
          disabled={dismissing}
          onPress={openRecommendation}
          className="min-h-[48px] flex-1 flex-row items-center gap-2"
        >
          <View
            className="h-7 w-7 items-center justify-center rounded-lg"
            style={{ backgroundColor: colors.clay }}
          >
            <Text className="font-sans-bold text-[10px]" style={{ color: colors.paper }}>
              SPF
            </Text>
          </View>
          <View className="min-w-0 flex-1">
            <Text
              numberOfLines={2}
              className="font-sans-bold text-[12.5px]"
              style={{ color: colors.clayDeep, lineHeight: 15 }}
            >
              {compactTitle}
            </Text>
            <Text className="mt-0.5 font-sans-semibold text-[12px]" style={{ color: colors.clay }}>
              {REC_COPY.gapPrompt.cta}
            </Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={REC_COPY.gapPrompt.dismiss}
          accessibilityState={{ disabled: dismissing }}
          disabled={dismissing}
          onPress={() => void dismiss()}
          className="min-h-[48px] min-w-[72px] items-center justify-center rounded-full px-3"
          style={{
            backgroundColor: 'rgba(165,105,75,0.12)',
            borderWidth: 1,
            borderColor: 'rgba(165,105,75,0.14)',
            opacity: dismissing ? 0.6 : 1,
          }}
        >
          <Text className="font-sans-bold text-[12.5px]" style={{ color: colors.clay }}>
            {REC_COPY.gapPrompt.dismiss}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      className="mt-4 rounded-[18px] p-4"
      style={{
        backgroundColor: colors.clayTint,
        borderWidth: 1,
        borderColor: 'rgba(165,105,75,0.22)',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss SPF recommendation"
        accessibilityState={{ disabled: dismissing }}
        disabled={dismissing}
        onPress={() => void dismiss()}
        className="absolute right-3 top-3 h-12 w-12 items-center justify-center rounded-full"
        style={{
          backgroundColor: 'rgba(165,105,75,0.12)',
          borderWidth: 1,
          borderColor: 'rgba(165,105,75,0.14)',
          opacity: dismissing ? 0.6 : 1,
        }}
      >
        <Text className="text-[14px]" style={{ color: colors.clay }}>
          ✕
        </Text>
      </Pressable>
      <View className="mb-2 flex-row items-center gap-2.5 pr-12">
        <View
          className="h-[30px] w-[30px] items-center justify-center rounded-lg"
          style={{ backgroundColor: colors.clay }}
        >
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
          accessibilityLabel={REC_COPY.gapPrompt.cta}
          accessibilityState={{ disabled: dismissing }}
          disabled={dismissing}
          onPress={openRecommendation}
          className="items-center justify-center rounded-pill px-5 py-2"
          style={{ minHeight: 48, backgroundColor: colors.clay }}
        >
          <Text className="font-sans-semibold text-[13.5px]" style={{ color: colors.paper }}>
            {REC_COPY.gapPrompt.cta}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={REC_COPY.gapPrompt.dismiss}
          accessibilityState={{ disabled: dismissing }}
          disabled={dismissing}
          onPress={() => void dismiss()}
          className="items-center justify-center rounded-pill px-4 py-2"
          style={{
            minHeight: 48,
            borderWidth: 1,
            borderColor: 'rgba(165,105,75,0.22)',
            backgroundColor: 'rgba(255,255,255,0.18)',
            opacity: dismissing ? 0.6 : 1,
          }}
        >
          <Text className="font-sans-semibold text-[13.5px]" style={{ color: colors.clay }}>
            {REC_COPY.gapPrompt.dismiss}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function DismissalFailureNotice({
  compact,
  retrying,
  onRetry,
}: {
  compact: boolean;
  retrying: boolean;
  onRetry: () => Promise<{ isError: boolean }>;
}) {
  const [retryFailed, setRetryFailed] = useState(false);

  async function retry(): Promise<void> {
    if (retrying) return;
    setRetryFailed(false);
    const result = await onRetry();
    if (result.isError) setRetryFailed(true);
  }

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      className={compact ? 'mt-2 rounded-xl px-3 py-2.5' : 'mt-4 rounded-xl px-4 py-3.5'}
      style={{ backgroundColor: colors.clayTint, borderWidth: 1, borderColor: colors.hairline }}
    >
      <Text className="font-sans-bold text-[13px]" style={{ color: colors.clayDeep }}>
        Suggestion not dismissed
      </Text>
      <Text variant="bodySm" tone="muted" className="mt-1" style={{ lineHeight: 18 }}>
        We couldn&apos;t save “Not now.” Nothing was removed. Reload your saved choices, then try
        again.
      </Text>
      {retryFailed ? (
        <Text variant="bodySm" className="mt-1.5" style={{ color: colors.ink, lineHeight: 18 }}>
          Your saved recommendation choices are still unavailable.
        </Text>
      ) : null}
      <Pressable
        accessibilityLabel="Retry loading recommendation choices after dismissal failure"
        accessibilityRole="button"
        accessibilityState={{ disabled: retrying }}
        disabled={retrying}
        onPress={() => void retry()}
        className="mt-2 min-h-[48px] items-center justify-center rounded-pill px-4 py-2"
        style={{ backgroundColor: colors.ink, opacity: retrying ? 0.68 : 1 }}
      >
        <Text className="font-sans-semibold text-[13.5px]" style={{ color: colors.paper }}>
          {retrying ? 'Trying again…' : 'Reload suggestion'}
        </Text>
      </Pressable>
    </View>
  );
}

export function RecommendationsTeaser({
  compact = false,
  showGapPrompt = false,
  dismissFailed: controlledDismissFailed,
  onDismissFailure,
  onDismissSuccess,
}: {
  compact?: boolean;
  showGapPrompt?: boolean;
  dismissFailed?: boolean;
  onDismissFailure?: () => void;
  onDismissSuccess?: () => void;
}) {
  const [localDismissFailed, setLocalDismissFailed] = useState(false);
  const dismissFailed = controlledDismissFailed ?? localDismissFailed;
  const { result, isError, isFetching, isSuccess, retry } = useRecommendations();
  const markDismissFailure = () => {
    setLocalDismissFailed(true);
    onDismissFailure?.();
  };
  const clearDismissFailure = () => {
    setLocalDismissFailed(false);
    onDismissSuccess?.();
  };
  const retryAfterDismissFailure = async (): Promise<{ isError: boolean }> => {
    const outcome = await retry();
    if (!outcome.isError) clearDismissFailure();
    return outcome;
  };

  if (dismissFailed && !isSuccess) {
    return (
      <DismissalFailureNotice
        compact={compact}
        retrying={isFetching}
        onRetry={retryAfterDismissFailure}
      />
    );
  }
  if (!isSuccess || isError) return null;

  const spfGap = result.recommendations.find(
    (r) =>
      (r.trigger === 'gap' || r.trigger === 'routine_completion') && r.productType.includes('spf'),
  );
  const showCompactGapOnly = compact && showGapPrompt && Boolean(spfGap);

  return (
    <>
      {dismissFailed ? (
        <DismissalFailureNotice
          compact={compact}
          retrying={isFetching}
          onRetry={retryAfterDismissFailure}
        />
      ) : null}
      {showGapPrompt && spfGap ? (
        <GapPrompt
          compact={compact}
          recId={spfGap.id}
          onDismissFailure={markDismissFailure}
          onDismissSuccess={clearDismissFailure}
        />
      ) : null}
      {showCompactGapOnly ? null : (
        <ForYouCard
          compact={compact}
          count={result.recommendations.length}
          youreSet={result.youreSet}
        />
      )}
    </>
  );
}
