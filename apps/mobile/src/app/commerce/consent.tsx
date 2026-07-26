import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RouteIconButton, Text } from '@/components/ui';
import { declineCommerceConsent, grantCommerceConsent } from '@/features/commerce/consent';
import { commerceConsentWithdrawalPendingQueryOptions } from '@/features/commerce/consentQuery';
import { COMMERCE_COPY } from '@/features/commerce/copy';
import { LockGlyph } from '@/features/commerce/LockGlyph';
import { COMMERCE_CONSENT_WITHDRAWAL_PENDING } from '@/features/commerce/store';
import { APP_YOU_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { isOwnerQueryScopeCurrent, ownerQueryPrefixes } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

// Surface 04 (docs/10 §6). The MHMDA consent gate. A separate, distinct, opt-in
// consent before any commerce telemetry leaves the device. The deep-research pass
// confirmed inferred skincare-concern data is regulated consumer health data with a
// live private right of action, so this gate is non-negotiable. MHMDA-strict (D-061):
// decline => no paid links shown at all. No health-adjacent attribute ever reaches a
// retailer regardless of consent (the opaque token carries none).
export default function CommerceConsentSheet() {
  const qc = useQueryClient();
  const ownerScope = useOwnerQueryScope();
  const consentActionInFlightRef = useRef(false);
  const consentActionRequestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const [consentActionPending, setConsentActionPending] = useState(false);
  const [consentActionFailure, setConsentActionFailure] = useState<'allow' | 'decline' | null>(
    null,
  );
  const { height: viewportHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sheetMaxHeight = viewportHeight > 44 ? viewportHeight - 44 : 524;
  const footerPaddingBottom = insets.bottom > 0 ? Math.max(32, insets.bottom + 24) : undefined;

  useEffect(
    () => () => {
      mountedRef.current = false;
      consentActionInFlightRef.current = false;
      consentActionRequestIdRef.current += 1;
    },
    [],
  );

  const close = () => backOrReplace(router, APP_YOU_ROUTE);

  const runConsentAction = async (action: 'allow' | 'decline') => {
    if (consentActionInFlightRef.current) return;
    consentActionInFlightRef.current = true;
    const requestId = ++consentActionRequestIdRef.current;
    setConsentActionPending(true);
    setConsentActionFailure(null);
    const canPublish = () =>
      mountedRef.current &&
      consentActionRequestIdRef.current === requestId &&
      isOwnerQueryScopeCurrent(ownerScope);
    try {
      if (action === 'allow') {
        haptics.success();
        await grantCommerceConsent();
      } else {
        haptics.select();
        await declineCommerceConsent();
      }
      if (!isOwnerQueryScopeCurrent(ownerScope)) return;
      await qc.invalidateQueries({
        queryKey: ownerQueryPrefixes.commerceConsent(ownerScope),
      });
      if (action === 'decline') {
        await qc.invalidateQueries({
          queryKey: ownerQueryPrefixes.commerceConsentWithdrawalPending(ownerScope),
        });
        const withdrawalPending = await qc.fetchQuery(
          commerceConsentWithdrawalPendingQueryOptions(ownerScope),
        );
        if (!canPublish()) return;
        if (withdrawalPending) {
          setConsentActionFailure('decline');
          return;
        }
      }
      if (!canPublish()) return;
      close();
    } catch (error) {
      if (!canPublish()) return;
      setConsentActionFailure(
        error instanceof Error && error.message === COMMERCE_CONSENT_WITHDRAWAL_PENDING
          ? 'decline'
          : action,
      );
    } finally {
      if (consentActionRequestIdRef.current === requestId) {
        consentActionInFlightRef.current = false;
        if (mountedRef.current) setConsentActionPending(false);
      }
    }
  };

  const allow = () => runConsentAction('allow');
  const decline = () => runConsentAction('decline');

  return (
    <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(32,27,21,0.42)' }}>
      <Pressable
        aria-hidden
        className="absolute inset-0"
        accessible={false}
        accessibilityElementsHidden
        focusable={false}
        importantForAccessibility="no"
        tabIndex={-1}
        disabled={consentActionPending}
        onPress={close}
      />
      <View
        aria-modal
        role="dialog"
        accessibilityLabel={COMMERCE_COPY.consent.title}
        accessibilityViewIsModal
        className="overflow-hidden rounded-t-sheet bg-paper"
        style={{ maxHeight: sheetMaxHeight }}
      >
        <RouteIconButton
          accessibilityLabel="Dismiss"
          disabled={consentActionPending}
          glyph="x"
          tone="muted"
          onPress={close}
          style={{ position: 'absolute', right: 20, top: 16, zIndex: 1 }}
        />
        <ScrollView
          style={{ flexShrink: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerClassName="px-7 pb-4 pt-4"
        >
          <View
            className="mb-5 h-[5px] w-10 self-center rounded-[3px]"
            style={{ backgroundColor: 'rgba(32,27,21,0.15)' }}
          />

          <View
            className="mb-4 h-[52px] w-[52px] items-center justify-center rounded-[14px]"
            style={{ backgroundColor: colors.clayTint }}
          >
            <LockGlyph size={22} color={colors.clay} />
          </View>

          <Text variant="title" className="text-[29px] leading-[32px]" accessibilityRole="header">
            {COMMERCE_COPY.consent.title}
          </Text>
          <Text variant="body" tone="muted" className="mt-3" style={{ lineHeight: 22 }}>
            {COMMERCE_COPY.consent.body}
          </Text>

          <View
            className="mt-5 rounded-2xl bg-paper-raised px-4"
            style={{ borderWidth: 1, borderColor: colors.hairline }}
          >
            <View
              className="flex-row items-center gap-3 py-3"
              style={{ borderBottomWidth: 1, borderBottomColor: colors.hairline }}
            >
              <View
                className="h-[18px] w-[18px] items-center justify-center rounded-full"
                style={{ backgroundColor: colors.sageTint }}
              >
                <Text className="text-[10px]" style={{ color: colors.sage }}>
                  ✓
                </Text>
              </View>
              <Text variant="bodySm" className="flex-1 text-[13px]">
                {COMMERCE_COPY.consent.allow}
              </Text>
            </View>
            <View className="flex-row items-center gap-3 py-3">
              <View
                className="h-[18px] w-[18px] items-center justify-center rounded-full"
                style={{ backgroundColor: colors.clayTint }}
              >
                <Text className="text-[10px]" style={{ color: colors.clay }}>
                  ✕
                </Text>
              </View>
              <Text variant="bodySm" className="flex-1 text-[13px]">
                {COMMERCE_COPY.consent.never}
              </Text>
            </View>
          </View>

          <Text variant="label" tone="muted" className="mt-4" style={{ lineHeight: 17 }}>
            {COMMERCE_COPY.consent.note}
          </Text>
        </ScrollView>

        <View
          className="px-7 pb-8 pt-2"
          style={
            footerPaddingBottom === undefined ? undefined : { paddingBottom: footerPaddingBottom }
          }
        >
          {consentActionFailure === null ? null : (
            <Text
              accessibilityRole="alert"
              variant="bodySm"
              tone="muted"
              className="mb-2 text-center"
            >
              Choice not saved
              {'\n'}
              {consentActionFailure === 'decline'
                ? 'Partner data sharing remains off, but cleanup was not confirmed. Try again.'
                : 'We could not save that choice. Try again.'}
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              consentActionFailure === 'allow'
                ? 'Try allowing where-to-buy links again'
                : COMMERCE_COPY.consent.cta
            }
            accessibilityState={{
              disabled: consentActionPending || consentActionFailure === 'decline',
            }}
            disabled={consentActionPending || consentActionFailure === 'decline'}
            onPress={() => void allow()}
            className="h-[54px] items-center justify-center rounded-pill"
            style={{ backgroundColor: colors.clay, opacity: consentActionPending ? 0.55 : 1 }}
          >
            <Text className="font-sans-semibold text-[16px]" style={{ color: colors.paper }}>
              {COMMERCE_COPY.consent.cta}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              consentActionFailure === 'decline'
                ? 'Try partner data-sharing withdrawal again'
                : COMMERCE_COPY.consent.decline
            }
            accessibilityState={{ disabled: consentActionPending }}
            disabled={consentActionPending}
            onPress={() => void decline()}
            className="h-[48px] items-center justify-center"
          >
            <Text className="font-sans-semibold text-[15px]" tone="muted">
              {consentActionFailure === 'decline' ? 'Try again' : COMMERCE_COPY.consent.decline}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
