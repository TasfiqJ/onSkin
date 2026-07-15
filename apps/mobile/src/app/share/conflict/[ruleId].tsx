import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useLayoutEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { DeferredSurface } from '@/components/launch/DeferredSurface';
import { Button, Screen, Text } from '@/components/ui';
import { ConflictCard } from '@/features/growth/ConflictCard';
import {
  createConflictShareActionCoordinator,
  shareConflictCard,
  type ConflictSharePublication,
} from '@/features/growth/shareCard';
import { createConflictShareLink, type ConflictShareLink } from '@/features/growth/shareLinks';
import { useShelf } from '@/features/shelf/useShelf';
import { track } from '@/lib/analytics/track';
import { shareCardUserMessage } from '@/lib/errors/userFacing';
import { canShareConflictCard, phase7Flags } from '@/lib/launch/phase7';
import { APP_SHELF_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { isOwnerQueryScopeCurrent } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';
import { colors } from '@/theme/tokens';

const CREATIVE_VARIANT = 'story-v1';
const SHARE_LINK_UNAVAILABLE_TITLE = 'Sharing is not ready';
const SHARE_LINK_UNAVAILABLE_MESSAGE =
  'The public share link must be configured before this card can be exported.';
const SHARE_UNAVAILABLE_TITLE = 'Sharing unavailable';
const SHARE_UNAVAILABLE_MESSAGE = "Sharing isn't available on this device right now.";

type ShareFeedback = {
  title: string;
  message: string;
};

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

// Public Shelf Conflict Card growth artifact. Only reviewed, non-safety, real
// two-product conflicts can reach this screen. The exported image is content-safe,
// watermarked, and carries only an opaque first-party share URL.
export default function ShareConflictScreen() {
  const isFocused = useIsFocused();
  const ownerScope = useOwnerQueryScope();
  const params = useLocalSearchParams<{
    ruleId?: string | string[];
    productAId?: string | string[];
    productBId?: string | string[];
    subjectProductId?: string | string[];
  }>();
  const firstParam = (value: string | string[] | undefined) => {
    const first = Array.isArray(value) ? value[0] : value;
    return first?.trim() || null;
  };
  const ruleId = firstParam(params.ruleId);
  const productAId = firstParam(params.productAId);
  const productBId = firstParam(params.productBId);
  const subjectProductId = firstParam(params.subjectProductId);
  const requestedPair = productAId && productBId ? [productAId, productBId].sort().join('+') : null;
  const incompletePair = Boolean(productAId || productBId) && requestedPair == null;
  const invalidIdentity = incompletePair || Boolean(subjectProductId && requestedPair);
  const { data } = useShelf();
  const cardRef = useRef<View>(null);
  const mountedRef = useRef(true);
  const focusedRef = useRef(isFocused);
  const shareRequestRef = useRef<Promise<void> | null>(null);
  const shareActionRef = useRef<ReturnType<typeof createConflictShareActionCoordinator> | null>(
    null,
  );
  if (shareActionRef.current == null) {
    shareActionRef.current = createConflictShareActionCoordinator({
      createLink: () => createConflictShareLink({ creativeVariant: CREATIVE_VARIANT }),
      nextFrame,
      shareCard: shareConflictCard,
    });
  }
  const [busy, setBusy] = useState(false);
  const [shareLink, setShareLink] = useState<ConflictShareLink | null>(null);
  const [shareFeedback, setShareFeedback] = useState<ShareFeedback | null>(null);
  const ruleMatches = data?.conflicts.filter((candidate) => candidate.rule.id === ruleId) ?? [];
  const conflict = invalidIdentity
    ? null
    : requestedPair
      ? (ruleMatches.find(
          (candidate) =>
            [candidate.productAId ?? '', candidate.productBId ?? ''].sort().join('+') ===
            requestedPair,
        ) ?? null)
      : subjectProductId
        ? (ruleMatches.find(
            (candidate) =>
              candidate.productAId === subjectProductId ||
              candidate.productBId === subjectProductId,
          ) ?? null)
        : ruleMatches.length === 1
          ? ruleMatches[0]!
          : null;

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      shareActionRef.current?.invalidate();
      shareRequestRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    focusedRef.current = isFocused;
    const action = shareActionRef.current;
    let active = true;
    if (!isFocused) action?.invalidate();
    const nextBusy = isFocused ? (action?.isRunning() ?? false) : false;
    void Promise.resolve().then(() => {
      if (!active || !mountedRef.current || focusedRef.current !== isFocused) return;
      setBusy(nextBusy);
    });
    return () => {
      active = false;
    };
  }, [isFocused]);

  if (!phase7Flags.shareCard) {
    return (
      <DeferredSurface
        surface="shareCard"
        fallbackRoute={APP_SHELF_ROUTE}
        fallbackLabel="Back to Shelf"
      />
    );
  }

  function publishShareAction(publication: ConflictSharePublication): void {
    switch (publication.type) {
      case 'busy':
        setBusy(publication.value);
        return;
      case 'started':
        setShareFeedback(null);
        setShareLink(null);
        track('share_card_export_started', { creative_variant: CREATIVE_VARIANT });
        return;
      case 'link_unavailable':
        track('share_card_export_failed', {
          creative_variant: CREATIVE_VARIANT,
          reason: 'public_link_unavailable',
        });
        setShareFeedback({
          title: SHARE_LINK_UNAVAILABLE_TITLE,
          message: SHARE_LINK_UNAVAILABLE_MESSAGE,
        });
        return;
      case 'link_created':
        setShareLink(publication.link);
        track('share_link_created', {
          creative_variant: CREATIVE_VARIANT,
          share_id: publication.link.shareId,
        });
        return;
      case 'shared':
        track('share_card_export_succeeded', {
          creative_variant: CREATIVE_VARIANT,
          share_id: publication.link.shareId,
        });
        track('share_card_exported', {
          creative_variant: CREATIVE_VARIANT,
          share_id: publication.link.shareId,
        });
        track('share_sheet_opened', {
          creative_variant: CREATIVE_VARIANT,
          share_id: publication.link.shareId,
        });
        return;
      case 'share_unavailable':
        track('share_card_export_failed', {
          creative_variant: CREATIVE_VARIANT,
          share_id: publication.link.shareId,
          reason: 'share_unavailable',
        });
        setShareFeedback({
          title: SHARE_UNAVAILABLE_TITLE,
          message: SHARE_UNAVAILABLE_MESSAGE,
        });
        return;
      case 'failure':
        track('share_card_export_failed', {
          creative_variant: CREATIVE_VARIANT,
          reason: 'exception',
        });
        setShareFeedback({
          title: "Couldn't create the card",
          message: shareCardUserMessage(),
        });
    }
  }

  function onShare() {
    if (shareRequestRef.current || !canShareConflictCard(conflict)) return;
    const action = shareActionRef.current;
    if (!action) return;

    const completion = action.start({
      ownerScope,
      ref: cardRef,
      isRouteCurrent: () =>
        mountedRef.current &&
        focusedRef.current &&
        isOwnerQueryScopeCurrent(ownerScope),
      publish: publishShareAction,
    });
    if (!completion) return;

    // Install the exact single flight synchronously in the press handler. The
    // coordinator also installs its opaque request before beginning async work.
    shareRequestRef.current = completion;
    void completion.finally(() => {
      if (shareRequestRef.current !== completion) return;
      shareRequestRef.current = null;
      if (
        mountedRef.current &&
        focusedRef.current &&
        isOwnerQueryScopeCurrent(ownerScope)
      ) {
        setBusy(false);
      }
    });
  }

  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-7">
        <Text variant="label" tone="muted">
          SHARE YOUR SHELF CHECK
        </Text>
        {canShareConflictCard(conflict) ? (
          <ConflictCard ref={cardRef} conflict={conflict} shareUrl={shareLink?.url} />
        ) : (
          <Text variant="body" tone="muted" className="text-center">
            Nothing reviewed is shareable right now. Share cards unlock only for reviewed,
            non-safety shelf checks.
          </Text>
        )}
      </View>
      <View className="gap-2 pb-4">
        {shareFeedback ? (
          <View className="rounded-[16px] bg-clay-tint px-4 py-3">
            <Text
              accessibilityRole="alert"
              variant="bodySm"
              className="text-center"
              style={{ color: colors.clayDeep, lineHeight: 20 }}
            >
              {shareFeedback.title}
              {'\n'}
              {shareFeedback.message}
            </Text>
          </View>
        ) : null}
        <Button
          label={busy ? 'Preparing...' : 'Share to Stories'}
          disabled={busy || !canShareConflictCard(conflict)}
          onPress={() => void onShare()}
        />
        <Pressable
          accessibilityRole="button"
          className="items-center py-3"
          onPress={() => backOrReplace(router, APP_SHELF_ROUTE)}
        >
          <Text variant="body" tone="muted" className="font-sans-medium">
            Done
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
