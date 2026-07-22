import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, ExpiryBadge, Sheet, StripedThumb, Text } from '@/components/ui';
import { isCommerceConsented } from '@/features/commerce/consent';
import {
  CommerceLinkNotice,
  type CommerceLinkFeedback,
} from '@/features/commerce/CommerceLinkNotice';
import { COMMERCE_COPY } from '@/features/commerce/copy';
import { LocalDateField } from '@/features/shelf/LocalDateField';
import { useShelfMutations } from '@/features/shelf/mutations';
import type { ReplacementOpeningState } from '@/features/shelf/store';
import { useShelf } from '@/features/shelf/useShelf';
import { localDateString } from '@/features/today/useToday';
import { track } from '@/lib/analytics/track';
import { APP_SHELF_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';

// Replenishment (design screen 09, docs/04 §6). An honest PAO/expiry/finished
// replacement prompt with neutral source-bound copy. Re-add archives the prior
// unit and requires an explicit opening state; "see similar" + any affiliate link are gated behind the separate MHMDA data-sharing
// consent (B-PRIVACY) and the catalog (B-CATALOG-SEED).
export default function ReplenishScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useShelf();
  const m = useShelfMutations();
  const replacementInFlight = useRef(false);
  const replacementOperationId = useRef(randomUUID()).current;
  const [replacing, setReplacing] = useState(false);
  const [replacementError, setReplacementError] = useState<string | null>(null);
  const [pastDateOpen, setPastDateOpen] = useState(false);
  const [replacementOpenedAt, setReplacementOpenedAt] = useState<string | null>(null);
  const [routeRemovalReady, setRouteRemovalReady] = useState(false);
  usePreventRemove(replacing && !routeRemovalReady, () => undefined);
  useEffect(() => {
    if (routeRemovalReady) router.replace('/shelf');
  }, [routeRemovalReady]);
  const [similarFeedback, setSimilarFeedback] = useState<{
    itemId: string;
    feedback: CommerceLinkFeedback;
  } | null>(null);

  const item = [...(data?.items ?? []), ...(data?.archive ?? [])].find((i) => i.id === id);

  // Surface the nudge once (analytics). The in-app prompt, not a notification (§6).
  useEffect(() => {
    if (item?.id) track('replenishment_nudge_shown', { source: 'shelf' });
  }, [item?.id]);

  if (!item) {
    return (
      <Sheet fallbackRoute={APP_SHELF_ROUTE} scroll>
        <View className="gap-3">
          <View>
            <Text variant="label" tone="muted" className="font-mono uppercase">
              Shelf updated
            </Text>
            <Text
              variant="title"
              className="mt-3 text-[27px] leading-[31px]"
              accessibilityRole="header"
            >
              This replacement prompt is no longer active.
            </Text>
            <Text variant="body" tone="muted" className="mt-2.5 text-[14px] leading-[22px]">
              That product was removed or archived on this device, so we won&apos;t reuse its
              freshness or shopping prompt. Review your current shelf, or add the product again if
              it still belongs in your routine.
            </Text>
          </View>

          <View className="mt-1 gap-2">
            <Button label="Back to Shelf" onPress={() => router.replace(APP_SHELF_ROUTE)} />
            <Button
              label="Add a product"
              variant="ghost"
              onPress={() => router.replace('/shelf/manual')}
            />
          </View>
        </View>
      </Sheet>
    );
  }

  const expired = item.badge.kind === 'expired';
  const countdown = item.badge.kind === 'countdown';
  const finished = item.product.status === 'finished';
  const printedDate = item.product.expirySource === 'printed';
  const labelPao =
    item.product.expirySource === 'pao_computed' && item.product.paoSource === 'label';
  const catalogPao =
    item.product.expirySource === 'pao_computed' && item.product.paoSource === 'catalog';
  const reviewedPao = labelPao || catalogPao;
  const headline = finished
    ? `You marked ${item.name} as finished.`
    : expired && printedDate
      ? `${item.name} has passed its recorded package date.`
      : countdown && printedDate
        ? `${item.name} is nearing its recorded package date.`
        : expired && reviewedPao
          ? `${item.name} has passed its tracked PAO date.`
          : countdown && reviewedPao
            ? `${item.name} is nearing its tracked PAO date.`
            : `Replace ${item.name} when you are ready.`;
  const body = finished
    ? 'You can add another package when you are ready.'
    : printedDate && (expired || countdown)
      ? 'This reminder comes from the package date recorded on your Shelf.'
      : labelPao && (expired || countdown)
        ? 'This reminder comes from the opened date and the PAO recorded from the product label.'
        : catalogPao && (expired || countdown)
          ? 'This reminder comes from the opened date and the reviewed catalog PAO.'
        : 'Use this when you are ready to replace or repurchase. No urgency is added.';
  const similarSub = 'Options from available catalog data';
  const activeSimilarFeedback =
    similarFeedback?.itemId === item.id ? similarFeedback.feedback : null;

  const replace = async (opening: ReplacementOpeningState) => {
    if (replacementInFlight.current) return;
    replacementInFlight.current = true;
    setReplacing(true);
    setReplacementError(null);
    haptics.select();
    let committed = false;
    try {
      const replacement = await m.replace(
        item.id,
        opening,
        replacementOperationId,
      );
      if (!replacement) {
        setReplacementError('This item changed before the replacement was saved. Review your Shelf.');
        return;
      }
      committed = true;
      setRouteRemovalReady(true);
    } catch {
      setReplacementError(
        "We couldn't confirm the replacement. Check your Shelf, then try again if it is still needed.",
      );
    } finally {
      if (!committed) {
        replacementInFlight.current = false;
        setReplacing(false);
      }
    }
  };

  const seeSimilar = async () => {
    if (replacementInFlight.current) return;
    haptics.select();
    track('replenishment_nudge_tapped', { action: 'see_similar' });
    // Route through the SAME commerce MHMDA gate the where-to-buy surface uses
    // (docs/10 §3): no consent => open the consent sheet, never share silently.
    // Consented => the honest empty state until the catalog lands (B-CATALOG-SEED).
    const consented = await isCommerceConsented();
    if (!consented) {
      setSimilarFeedback(null);
      router.push('/commerce/consent');
      return;
    }
    setSimilarFeedback({
      itemId: item.id,
      feedback: {
        title: 'Similar options',
        body: COMMERCE_COPY.whereToBuy.emptyState,
      },
    });
  };

  return (
    <Sheet fallbackRoute={APP_SHELF_ROUTE} scroll dismissDisabled={replacing}>
      <View className="flex-row items-center gap-4">
        <StripedThumb size={60} radius={16} />
        <View className="flex-1">
          <View className="mb-1.5 self-start">
            <ExpiryBadge badge={item.badge} />
          </View>
          <Text variant="titleSm" className="text-[23px] leading-[24px]">
            {item.name}
          </Text>
        </View>
      </View>

      <Text variant="title" className="mt-4 text-[28px] leading-[33px]" accessibilityRole="header">
        {headline}
      </Text>
      <Text variant="body" tone="muted" className="mt-2">
        {body}
      </Text>

      <View className="mt-5 gap-2.5">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: replacing, disabled: replacing }}
          disabled={replacing}
          onPress={() => void replace({ isOpened: true, openedAt: localDateString() })}
          className="flex-row items-center gap-3.5 rounded-[18px] border-2 border-clay bg-paper-raised p-4"
        >
          <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-clay-tint">
            <Text className="font-sans-bold text-clay">+</Text>
          </View>
          <View className="flex-1">
            <Text variant="body" className="font-sans-semibold">
              I opened a new unit today
            </Text>
            <Text variant="bodySm" tone="muted">
              Starts its PAO clock from today when PAO is known
            </Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: pastDateOpen, disabled: replacing }}
          disabled={replacing}
          onPress={() => setPastDateOpen((open) => !open)}
          className="flex-row items-center gap-3.5 rounded-[18px] border border-hairline bg-paper-raised p-4"
        >
          <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-greige">
            <Text tone="muted">◷</Text>
          </View>
          <View className="flex-1">
            <Text variant="body" className="font-sans-semibold">
              New unit was opened earlier
            </Text>
            <Text variant="bodySm" tone="muted">
              Enter the date you actually opened this package
            </Text>
          </View>
        </Pressable>
        {pastDateOpen ? (
          <View className="gap-2 rounded-[16px] bg-paper-raised p-4">
            <LocalDateField
              label="Exact opened date"
              value={replacementOpenedAt}
              maxDate={localDateString()}
              disabled={replacing}
              onChangeDate={setReplacementOpenedAt}
            />
            <Button
              label="Save replacement with this date"
              disabled={
                replacing ||
                replacementOpenedAt == null ||
                replacementOpenedAt >= localDateString()
              }
              onPress={() => {
                if (!replacementOpenedAt || replacementOpenedAt >= localDateString()) return;
                void replace({ isOpened: true, openedAt: replacementOpenedAt });
              }}
            />
          </View>
        ) : null}
        {replacementError ? (
          <View accessibilityRole="alert" className="rounded-[14px] bg-clay-tint px-4 py-3">
            <Text variant="bodySm" tone="muted">
              {replacementError}
            </Text>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: replacing, disabled: replacing }}
          disabled={replacing}
          onPress={() => void replace({ isOpened: false, openedAt: null })}
          className="flex-row items-center gap-3.5 rounded-[18px] border border-hairline bg-paper-raised p-4"
        >
          <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-greige">
            <Text tone="muted">+</Text>
          </View>
          <View className="flex-1">
            <Text variant="body" className="font-sans-semibold">
              New unit is unopened
            </Text>
            <Text variant="bodySm" tone="muted">
              No PAO clock; add a printed date from the pack later
            </Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: replacing }}
          disabled={replacing}
          onPress={() => void seeSimilar()}
          className="flex-row items-center gap-3.5 rounded-[18px] border border-hairline bg-paper-raised p-4"
        >
          <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-greige">
            <Text tone="muted">⌕</Text>
          </View>
          <View className="flex-1">
            <Text variant="body" className="font-sans-semibold">
              See similar options
            </Text>
            <Text variant="bodySm" tone="muted">
              {similarSub}
            </Text>
          </View>
        </Pressable>
        {activeSimilarFeedback ? <CommerceLinkNotice feedback={activeSimilarFeedback} /> : null}
      </View>

      <View className="mt-4 flex-row items-center justify-center gap-2">
        <Text tone="muted" className="text-[12px]">
          ✦
        </Text>
        <Text variant="label" tone="muted" className="text-center">
          shopping links share data only with your consent · turn on in Settings
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: replacing }}
        disabled={replacing}
        className="mt-3 min-h-[48px] items-center justify-center py-2"
        onPress={() => backOrReplace(router, APP_SHELF_ROUTE)}
      >
        <Text className="font-sans-semibold" tone="muted">
          Not now
        </Text>
      </Pressable>
    </Sheet>
  );
}
