import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, ExpiryBadge, Sheet, StripedThumb, Text } from '@/components/ui';
import {
  CommerceLinkNotice,
  type CommerceLinkFeedback,
} from '@/features/commerce/CommerceLinkNotice';
import {
  readCommerceConsentForOwner,
  resolveCommerceConsentRead,
} from '@/features/commerce/consentQuery';
import { COMMERCE_COPY } from '@/features/commerce/copy';
import { isSafetyCriticalCategory } from '@/features/shelf/categories';
import { useShelfMutations } from '@/features/shelf/mutations';
import { SHELF_REPLENISHMENT_ALREADY_REPLACED } from '@/features/shelf/store';
import { useShelfRouteSources } from '@/features/shelf/ShelfRouteSources';
import { track } from '@/lib/analytics/track';
import { APP_SHELF_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { isOwnerQueryScopeCurrent } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';
import { haptics } from '@/theme/haptics';

// Replenishment (design screen 09, docs/04 §6). An honest PAO/expiry/finished
// replacement prompt, opt-in and claim-safe. "Re-add" resets the clock; "see
// similar" + any affiliate link are gated behind the separate MHMDA data-sharing
// consent (B-PRIVACY) and the catalog (B-CATALOG-SEED).
export default function ReplenishScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { shelf } = useShelfRouteSources();
  const { data } = shelf;
  const m = useShelfMutations();
  const ownerScope = useOwnerQueryScope();
  const [similarFeedback, setSimilarFeedback] = useState<{
    itemId: string;
    feedback: CommerceLinkFeedback;
  } | null>(null);
  const [reAdding, setReAdding] = useState(false);
  const [reAddFailed, setReAddFailed] = useState(false);
  const [alreadyReplaced, setAlreadyReplaced] = useState(false);
  const [similarPending, setSimilarPending] = useState(false);
  const [similarReadFailureItemId, setSimilarReadFailureItemId] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const similarPendingRef = useRef(false);
  const similarRequestRef = useRef(0);

  const item = [...(data?.items ?? []), ...(data?.archive ?? [])].find((i) => i.id === id);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      similarPendingRef.current = false;
      similarRequestRef.current += 1;
    };
  }, []);

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

  const safety = isSafetyCriticalCategory(item.category);
  const expired = item.badge.kind === 'expired';
  const countdown = item.badge.kind === 'countdown';
  const headline = safety
    ? `Keep ${item.name} fresh.`
    : expired
      ? `${item.name} may be past its best.`
      : `Line up a fresh ${item.name}.`;
  const body = safety
    ? 'For sunscreen and eye-area products, take printed expiry and PAO more seriously. You can re-add a fresh unit without losing history.'
    : expired
      ? 'Its PAO or printed date may be past its best. This is a calm replacement reminder, not an alarm.'
      : countdown
        ? 'Its PAO or printed date is coming up. This is a calm replacement reminder, not an alarm.'
        : 'Use this when you are ready to replace or repurchase. No urgency is added.';
  const similarSub = safety
    ? 'Same protection, claim-safe matches'
    : 'Same role, claim-safe matches';
  const activeSimilarFeedback =
    similarFeedback?.itemId === item.id ? similarFeedback.feedback : null;
  const activeSimilarReadFailure = similarReadFailureItemId === item.id;

  const reAdd = async () => {
    if (reAdding) return;
    haptics.select();
    setReAdding(true);
    setReAddFailed(false);
    setAlreadyReplaced(false);
    try {
      await m.replace(item.id);
      router.replace('/shelf');
    } catch (error) {
      if (error instanceof Error && error.message === SHELF_REPLENISHMENT_ALREADY_REPLACED) {
        setAlreadyReplaced(true);
      } else {
        setReAddFailed(true);
      }
    } finally {
      setReAdding(false);
    }
  };

  const seeSimilar = async () => {
    if (similarPendingRef.current || !isOwnerQueryScopeCurrent(ownerScope)) return;
    const itemId = item.id;
    const requestId = ++similarRequestRef.current;
    similarPendingRef.current = true;
    setSimilarPending(true);
    setSimilarReadFailureItemId(null);
    haptics.select();
    track('replenishment_nudge_tapped', { action: 'see_similar' });
    // Route through the SAME commerce MHMDA gate the where-to-buy surface uses
    // (docs/10 §3): no consent => open the consent sheet, never share silently.
    // Consented => the honest empty state until the catalog lands (B-CATALOG-SEED).
    const isCurrent = () =>
      mountedRef.current &&
      similarRequestRef.current === requestId &&
      isOwnerQueryScopeCurrent(ownerScope);
    try {
      const outcome = await resolveCommerceConsentRead(
        () => readCommerceConsentForOwner(ownerScope),
        isCurrent,
      );

      if (!isCurrent()) return;
      if (outcome === 'stale') return;
      if (outcome === 'unavailable') {
        setSimilarFeedback(null);
        setSimilarReadFailureItemId(itemId);
        return;
      }
      if (outcome === 'declined') {
        setSimilarFeedback(null);
        router.push('/commerce/consent');
        return;
      }
      setSimilarFeedback({
        itemId,
        feedback: {
          title: 'Similar options',
          body: COMMERCE_COPY.whereToBuy.emptyState,
        },
      });
    } finally {
      if (isCurrent()) {
        similarPendingRef.current = false;
        setSimilarPending(false);
      }
    }
  };

  return (
    <Sheet fallbackRoute={APP_SHELF_ROUTE} scroll>
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
          accessibilityState={{ disabled: reAdding }}
          disabled={reAdding}
          onPress={() => void reAdd()}
          className="flex-row items-center gap-3.5 rounded-[18px] border-2 border-clay bg-paper-raised p-4"
          style={{ opacity: reAdding ? 0.68 : 1 }}
        >
          <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-clay-tint">
            <Text className="font-sans-bold text-clay">+</Text>
          </View>
          <View className="flex-1">
            <Text variant="body" className="font-sans-semibold">
              {reAdding ? 'Adding fresh unit...' : 'Re-add the same one'}
            </Text>
            <Text variant="bodySm" tone="muted">
              Resets the freshness clock
            </Text>
          </View>
        </Pressable>
        {reAddFailed ? (
          <View accessibilityRole="alert" className="rounded-[14px] bg-clay-tint px-4 py-3">
            <Text variant="bodySm" className="font-sans-semibold">
              Replacement not confirmed
            </Text>
            <Text variant="bodySm" tone="muted" className="mt-1">
              Your saved Shelf was not reset. Try again; this replacement keeps the same identity so
              it cannot create a duplicate from an uncertain attempt.
            </Text>
          </View>
        ) : null}
        {alreadyReplaced ? (
          <View accessibilityRole="alert" className="rounded-[14px] bg-clay-tint px-4 py-3">
            <Text variant="bodySm" className="font-sans-semibold">
              Replacement already recorded
            </Text>
            <Text variant="bodySm" tone="muted" className="mt-1">
              This older package was already replaced. Return to Shelf and choose the latest unit.
            </Text>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: similarPending, disabled: similarPending }}
          disabled={similarPending}
          onPress={() => void seeSimilar()}
          className="flex-row items-center gap-3.5 rounded-[18px] border border-hairline bg-paper-raised p-4"
          style={{ opacity: similarPending ? 0.68 : 1 }}
        >
          <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-greige">
            <Text tone="muted">⌕</Text>
          </View>
          <View className="flex-1">
            <Text variant="body" className="font-sans-semibold">
              {similarPending ? 'Checking consent...' : 'See similar options'}
            </Text>
            <Text variant="bodySm" tone="muted">
              {similarSub}
            </Text>
          </View>
        </Pressable>
        {activeSimilarFeedback ? <CommerceLinkNotice feedback={activeSimilarFeedback} /> : null}
        {activeSimilarReadFailure ? (
          <View accessibilityRole="alert" className="rounded-[14px] bg-clay-tint px-4 py-3">
            <Text variant="bodySm" className="font-sans-semibold">
              Consent status unavailable
            </Text>
            <Text variant="bodySm" tone="muted" className="mt-1">
              We could not safely read your saved data-sharing choice. Nothing was changed, and no
              shopping link was opened.
            </Text>
            <Button
              accessibilityLabel="Retry data-sharing consent status"
              className="mt-2"
              label="Try again"
              variant="ghost"
              onPress={() => void seeSimilar()}
            />
          </View>
        ) : null}
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
