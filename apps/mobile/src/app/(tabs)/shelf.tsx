import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import {
  ConflictBanner,
  ExpiryBadge,
  Screen,
  SegmentChip,
  StripedThumb,
  Text,
} from '@/components/ui';
import { bannerSubhead, bannerTitle, severityLabel } from '@/features/intelligence/presentation';
import { useShelf, type ShelfItem } from '@/features/shelf/useShelf';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

// Shelf list (design "OnSkin Smart Shelf" screen 05, docs/04 §5.1): title + count,
// All/Actives/Expiring filters, the calm conflict banner, product cards with the
// five-state badge taxonomy, and the "Scan a barcode" FAB. Light-mode, calm,
// claim-safe. The cabinet that knows when to replace, never when to alarm.
type Filter = 'all' | 'actives' | 'expiring';
const ACTIVE_TAGS = new Set(['retinoid', 'aha', 'bha', 'benzoyl_peroxide', 'vitamin_c']);
const SCAN_FAB_SHADOW =
  Platform.OS === 'web'
    ? { boxShadow: '0 8px 12px rgba(32, 27, 21, 0.25)' }
    : {
        shadowColor: '#201B15',
        shadowOpacity: 0.25,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
      };

const SUBHEAD: Record<Filter, string> = {
  all: 'Everything on your shelf, soonest to replace first.',
  actives: 'The potent ingredients in your routine.',
  expiring: 'Soonest first. The honest reasons to replace something.',
};

function ProductCard({ item }: { item: ShelfItem }) {
  // Only the countdown card carries the faint accent border (design screen 05);
  // expired/safety cards stay on the neutral hairline. The firmer badge already
  // signals attention.
  const attention = item.badge.kind === 'countdown';
  return (
    <View
      style={[
        // The countdown card carries the faint amber accent border (design frame 03,
        // rgba(176,122,60,0.45)); everything else stays on the neutral hairline.
        { borderWidth: 1, borderColor: attention ? 'rgba(176,122,60,0.45)' : colors.hairline },
      ]}
      className="rounded-[18px] bg-paper-raised p-4"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${item.badge.label}`}
        onPress={() => {
          haptics.select();
          router.push(`/shelf/${item.id}`);
        }}
        style={({ pressed }) => [pressed ? { opacity: 0.85 } : null]}
        className="flex-row items-center gap-3.5"
      >
        <StripedThumb size={50} radius={14} faded={item.badge.kind === 'expired'} />
        <View className="flex-1">
          <Text variant="body" className="font-sans-semibold">
            {item.name}
          </Text>
          {item.metaLine ? (
            <Text variant="bodySm" tone="muted" className="mt-0.5">
              {item.metaLine}
            </Text>
          ) : null}
        </View>
        <ExpiryBadge badge={item.badge} />
      </Pressable>
      {/* Proactive, honest PAO-triggered replenishment nudge on the card itself
            (docs/04 §6): a quiet "Replace ->" on countdown/expired items. */}
      {item.badge.kind === 'countdown' || item.badge.kind === 'expired' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Replace ${item.name}`}
          className="ml-[64px] mt-2 min-h-[48px] min-w-[84px] self-start items-center justify-center rounded-pill border border-clay/20 bg-clay-tint px-3 py-2"
          style={({ pressed }) => [
            {
              minHeight: 48,
              minWidth: 84,
            },
            pressed ? { opacity: 0.78 } : null,
          ]}
          onPress={() => {
            haptics.select();
            router.push(`/shelf/replenish?id=${item.id}`);
          }}
        >
          <Text variant="bodySm" tone="clay" className="font-sans-semibold">
            Replace →
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function EmptyShelf({ archiveCount }: { archiveCount: number }) {
  return (
    <View className="flex-1 items-center justify-center px-2 pb-16">
      <View className="mb-7 flex-row items-end gap-2.5">
        <View className="-rotate-6">
          <StripedThumb light width={46} height={60} radius={10} />
        </View>
        <StripedThumb light width={46} height={68} radius={10} />
        <View className="rotate-6">
          <StripedThumb light width={46} height={60} radius={10} />
        </View>
      </View>
      <Text variant="title" className="max-w-[280px] text-center text-[28px] leading-[32px]">
        Let&apos;s build your cabinet.
      </Text>
      <Text variant="body" tone="muted" className="mt-2.5 max-w-[280px] text-center">
        Add what you already use. Scan a barcode, or add it by hand. We&apos;ll handle freshness and
        clashes.
      </Text>
      <View className="mt-8 w-full max-w-[300px] gap-3">
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            haptics.select();
            router.push('/shelf/scan');
          }}
          className="h-14 items-center justify-center rounded-pill bg-ink"
        >
          <Text className="font-sans-semibold text-[16px] text-paper">Scan a barcode</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            haptics.select();
            router.push('/shelf/manual');
          }}
          className="h-[50px] items-center justify-center"
        >
          <Text className="font-sans-semibold text-[15px]" tone="muted">
            Add by hand
          </Text>
        </Pressable>
        {archiveCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View archive, ${archiveCount} archived ${
              archiveCount === 1 ? 'product' : 'products'
            }`}
            onPress={() => {
              haptics.select();
              router.push('/shelf/archive');
            }}
            className="min-h-[48px] items-center justify-center py-2"
          >
            <Text variant="label" tone="muted">
              View archive ({archiveCount}) →
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function SkeletonCard() {
  return (
    <View
      className="flex-row items-center gap-3.5 rounded-[18px] bg-paper-raised p-4"
      style={{ borderWidth: 1, borderColor: colors.hairline }}
    >
      <StripedThumb size={50} radius={14} />
      <View className="flex-1 gap-2">
        <View className="h-3.5 w-2/3 rounded-[5px]" style={{ backgroundColor: colors.greige }} />
        <View
          className="h-2.5 w-1/2 rounded-[5px]"
          style={{ backgroundColor: colors.greigeChip }}
        />
      </View>
    </View>
  );
}

// Cold-load skeleton (docs/04 §5.1/§5.8: skeleton cards, never spinners, and never a
// flash of "0 products" while the local-first store reads).
function SkeletonShelf() {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-32">
      <View className="mt-2">
        <Text variant="title" className="text-[38px] leading-[40px]">
          Shelf
        </Text>
      </View>
      <View className="mt-3.5 flex-row gap-2.5">
        {(['All', 'Actives', 'Expiring'] as const).map((l, i) => (
          <SegmentChip key={l} label={l} selected={i === 0} />
        ))}
      </View>
      <View className="mt-7 gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </View>
    </ScrollView>
  );
}

export default function ShelfScreen() {
  const { data, isLoading } = useShelf();
  const [filter, setFilter] = useState<Filter>('all');

  const items = data?.items ?? [];
  const archiveCount = data?.archive.length ?? 0;
  const filtered = items.filter((i) => {
    if (filter === 'actives') return i.engineProduct.tags.some((t) => ACTIVE_TAGS.has(t));
    if (filter === 'expiring') return i.badge.kind === 'countdown' || i.badge.kind === 'expired';
    return true;
  });

  const showLoading = isLoading && items.length === 0;
  const isEmpty = !isLoading && items.length === 0;

  return (
    <Screen edges={['top']}>
      {showLoading ? (
        <SkeletonShelf />
      ) : isEmpty ? (
        <>
          <View className="mt-2">
            <Text variant="title" className="text-[38px] leading-[40px]">
              Shelf
            </Text>
            <Text variant="label" tone="muted" className="mt-1">
              empty for now
            </Text>
          </View>
          <EmptyShelf archiveCount={archiveCount} />
        </>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-32">
          <View className="mt-2 flex-row items-baseline justify-between">
            <Text variant="title" className="text-[38px] leading-[40px]">
              Shelf
            </Text>
            <Text variant="label" tone="muted">
              {items.length} product{items.length === 1 ? '' : 's'}
            </Text>
          </View>

          <View className="mt-3.5 flex-row gap-2.5">
            {(['all', 'actives', 'expiring'] as Filter[]).map((f) => (
              <SegmentChip
                key={f}
                label={f === 'all' ? 'All' : f === 'actives' ? 'Actives' : 'Expiring'}
                selected={filter === f}
                onPress={() => setFilter(f)}
              />
            ))}
          </View>

          <Text variant="bodySm" tone="muted" className="mt-3">
            {SUBHEAD[filter]}
          </Text>

          {data?.banner ? (
            <ConflictBanner
              className="mt-4"
              title={bannerTitle(data.banner)}
              subhead={bannerSubhead(data.banner)}
              severityPill={severityLabel(data.banner.computedSeverity)}
              onReview={() => {
                haptics.select();
                router.push(`/conflict/${data.banner!.rule.id}`);
              }}
            />
          ) : null}

          <View className="mt-4 gap-2.5">
            {filtered.map((item) => (
              <ProductCard key={item.id} item={item} />
            ))}
            {filtered.length === 0 ? (
              <Text variant="bodySm" tone="muted" className="mt-4 text-center">
                {filter === 'expiring'
                  ? 'Nothing needs replacing right now.'
                  : 'No products match this filter.'}
              </Text>
            ) : null}
          </View>

          {archiveCount > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View archive, ${archiveCount} archived ${
                archiveCount === 1 ? 'product' : 'products'
              }`}
              className="mt-6 min-h-[48px] items-center justify-center py-2"
              onPress={() => {
                haptics.select();
                router.push('/shelf/archive');
              }}
            >
              <Text variant="label" tone="muted">
                View archive ({archiveCount}) →
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}

      {!isEmpty && !showLoading ? (
        <View className="absolute inset-x-0 bottom-4 items-center">
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              haptics.select();
              router.push('/shelf/scan');
            }}
            style={({ pressed }) => [SCAN_FAB_SHADOW, pressed ? { opacity: 0.9 } : null]}
            className="rounded-pill bg-ink px-7 py-3.5"
          >
            <Text className="font-sans-semibold text-[15px] text-paper">Scan a barcode</Text>
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}
