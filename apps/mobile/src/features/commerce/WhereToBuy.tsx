import { router } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { track } from '@/lib/analytics/track';
import { phase7Flags } from '@/lib/launch/phase7';
import { openExternalHttpsUrl } from '@/lib/navigation/externalOpen';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

import { COMMERCE_COPY } from './copy';
import { LockGlyph } from './LockGlyph';
import { formatPrice, outboundFor, type WhereToBuyOption } from './links';
import { buildClickToken, recordClick } from './store';
import { useCommerceConsent, useWhereToBuy } from './useCommerce';

// Surface 01 (docs/10 §3). The quiet "where to buy" affordance, rendered BENEATH the
// recommendation rationale (never a Buy Now CTA). Two states gated by the MHMDA
// commerce consent: locked (a calm opt-in row) or the disclosed retailer options with
// the FTC "Paid link" wording. *** The disclosure is always visible WITH the links
// (FTC "unavoidable"), never collapsed. *** No commission is shown or sorted on.

function PaidChip() {
  return (
    <Text
      className="font-mono text-[9px]"
      style={{
        color: colors.muted,
        backgroundColor: '#F0EBE2',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 5,
        overflow: 'hidden',
      }}
    >
      {COMMERCE_COPY.whereToBuy.paidChip}
    </Text>
  );
}

function OptionRow({ option, onPress }: { option: WhereToBuyOption; onPress: () => void }) {
  const price = formatPrice(option.priceCents, option.currency);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${option.label}, ${COMMERCE_COPY.whereToBuy.partnerLabel(price)}, paid link`}
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-xl p-3"
      style={{ borderWidth: 1, borderColor: colors.hairline }}
    >
      <View
        className="h-8 w-[26px] rounded"
        style={{ backgroundColor: colors.greige, borderWidth: 1, borderColor: colors.hairline }}
      />
      <View className="flex-1">
        <Text variant="bodySm" className="font-sans-semibold text-[13px]">
          {option.label}
        </Text>
        <Text className="text-[11px]" tone="muted">
          {COMMERCE_COPY.whereToBuy.partnerLabel(price)}
        </Text>
      </View>
      <View className="flex-row items-center gap-1.5">
        <PaidChip />
        <Text style={{ color: colors.clay, fontSize: 12 }}>↗</Text>
      </View>
    </Pressable>
  );
}

function EnabledWhereToBuy({ productType }: { productType: string }) {
  const { data: consented } = useCommerceConsent();
  const { data: options } = useWhereToBuy(consented ? productType : null);

  const openConsent = () => {
    haptics.select();
    router.push('/commerce/consent');
  };

  const tapOption = async (option: WhereToBuyOption) => {
    haptics.select();
    const token = buildClickToken();
    const outboundUrl = outboundFor(option, token);
    if (!outboundUrl) {
      Alert.alert('Link unavailable', 'This retailer link is not available right now.');
      return;
    }
    track('where_to_buy_clicked', { product_type: productType, source: option.source });
    await recordClick({ clickToken: token, productType, source: option.source, consented: true });
    // BLOCKED: B-SHOPMY / B-CATALOG-SEED. Dev demo links stay inert; real approved
    // retailer links open only after the HTTPS URL guard appends the opaque token.
    const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
    if (isDev && option.url.startsWith('https://example.com')) {
      Alert.alert(COMMERCE_COPY.whereToBuy.stubTitle, COMMERCE_COPY.whereToBuy.stubBody, [
        { text: 'OK' },
      ]);
    } else {
      const opened = await openExternalHttpsUrl(outboundUrl, {
        mode: 'linking',
        failureTitle: 'Link unavailable',
        failureMessage: 'We could not open this retailer link. Please try again.',
      });
      if (!opened) {
        track('where_to_buy_link_failed', { product_type: productType, source: option.source });
      }
    }
  };

  return (
    <View className="mt-4 pt-4" style={{ borderTopWidth: 1, borderTopColor: colors.hairline }}>
      <Text variant="label" tone="muted" className="mb-2.5">
        {COMMERCE_COPY.whereToBuy.eyebrow}
      </Text>

      {!consented ? (
        <>
          <View className="flex-row items-start gap-2.5">
            <View className="mt-0.5">
              <LockGlyph size={12} color={colors.muted} />
            </View>
            <Text
              variant="bodySm"
              tone="muted"
              className="flex-1 text-[12.5px]"
              style={{ lineHeight: 18 }}
            >
              {COMMERCE_COPY.whereToBuy.lockedBody}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={openConsent}
            className="mt-2.5 self-start"
            hitSlop={6}
          >
            <Text className="font-sans-semibold text-[12.5px]" style={{ color: colors.clay }}>
              {COMMERCE_COPY.whereToBuy.lockedCta} →
            </Text>
          </Pressable>
        </>
      ) : options && options.length > 0 ? (
        <>
          <View className="gap-2.5">
            {options.map((o) => (
              <OptionRow key={o.id} option={o} onPress={() => void tapOption(o)} />
            ))}
          </View>
          {/* FTC: the disclosure is visible WITH the links, never collapsed (16 CFR 255) */}
          <View className="mt-3 flex-row items-start justify-between gap-3">
            <Text className="flex-1 text-[11px]" tone="muted" style={{ lineHeight: 15 }}>
              {COMMERCE_COPY.whereToBuy.disclosureLead}{' '}
              <Text className="font-sans-semibold" style={{ color: colors.ink }}>
                {COMMERCE_COPY.whereToBuy.disclosureEmphasis}
              </Text>
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/commerce/transparency')}
              hitSlop={6}
            >
              <Text className="font-sans-semibold text-[11px]" style={{ color: colors.clay }}>
                {COMMERCE_COPY.whereToBuy.howThisWorks} →
              </Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Text variant="bodySm" tone="muted" className="text-[12.5px]" style={{ lineHeight: 18 }}>
          {COMMERCE_COPY.whereToBuy.emptyState}
        </Text>
      )}

      <Text
        className="mt-3.5 text-center text-[13px] font-sans-semibold"
        tone="muted"
        accessibilityRole="button"
        onPress={() => router.push('/shelf/manual')}
      >
        {COMMERCE_COPY.whereToBuy.alreadyOwn}
      </Text>
    </View>
  );
}

export function WhereToBuy({ productType }: { productType: string }) {
  if (!phase7Flags.commerce) return null;

  return <EnabledWhereToBuy productType={productType} />;
}
