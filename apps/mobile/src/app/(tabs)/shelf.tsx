import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import {
  Button,
  ConflictBanner,
  ExpiryBadge,
  Screen,
  SegmentChip,
  StripedThumb,
  Text,
} from '@/components/ui';
import { conflictDetailRoute } from '@/features/intelligence/conflictIdentity';
import { bannerSubhead, bannerTitle, severityLabel } from '@/features/intelligence/presentation';
import { trackProductAddStarted, type ProductAddStartSource } from '@/features/shelf/analytics';
import { useShelf, type ShelfItem } from '@/features/shelf/useShelf';
import { readReadyCatalogLookups, type ReadyCatalogLookup } from '@/lib/offline/catalogLookupQueue';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

// Shelf list (Smart Shelf design screen 05, docs/04 §5.1): title + count,
// All/Actives/Expiring filters, the calm conflict banner, product cards with the
// provenance-aware freshness badges, and the "Scan a barcode" FAB. Light-mode
// and calm, with unsupported dates left unknown.
type Filter = 'all' | 'actives' | 'expiring';
const ACTIVE_TAGS = new Set(['retinoid', 'aha', 'bha', 'benzoyl_peroxide', 'vitamin_c']);
const SUBHEAD: Record<Filter, string> = {
  all: 'Everything on your shelf, ordered by supported tracked dates.',
  actives: 'The potent ingredients in your routine.',
  expiring: 'Printed or reviewed PAO dates, soonest first.',
};

function ScanShelfButton({ source }: { source: ProductAddStartSource }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptics.select();
        trackProductAddStarted(source);
        router.push('/shelf/scan');
      }}
      style={({ pressed }) => [pressed ? { opacity: 0.86 } : null]}
      className="rounded-pill bg-ink px-7 py-3.5"
    >
      <Text className="font-sans-semibold text-[15px] text-paper">Scan a barcode</Text>
    </Pressable>
  );
}

function CatalogRecoveryCard({
  ready,
  readyCount,
}: {
  ready: ReadyCatalogLookup;
  readyCount: number;
}) {
  return (
    <View
      className="mt-4 rounded-[18px] bg-sage-tint p-4"
      style={{ borderWidth: 1, borderColor: colors.sageMuted }}
    >
      <Text variant="label" tone="muted" className="font-mono uppercase">
        Catalog match ready
      </Text>
      <Text variant="body" className="mt-1 font-sans-semibold">
        {ready.candidate.brand ? `${ready.candidate.brand} ` : ''}
        {ready.candidate.name}
      </Text>
      <Text variant="bodySm" tone="muted" className="mt-1.5">
        Compare it with your saved details before anything changes.
        {readyCount > 1 ? ` ${readyCount} matches are ready.` : ''}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Review catalog match for ${ready.candidate.name}`}
        onPress={() => {
          haptics.select();
          router.push({
            pathname: '/shelf/catalog-recovery',
            params: {
              barcode: ready.barcode,
              productId: ready.candidate.productId,
            },
          } as unknown as Href);
        }}
        className="mt-3 min-h-[48px] items-center justify-center rounded-pill bg-ink px-5 py-2.5"
      >
        <Text variant="bodySm" tone="inverse" className="font-sans-semibold">
          Review match
        </Text>
      </Pressable>
    </View>
  );
}

function CatalogRecoveryUnavailable({ retry }: { retry: () => void }) {
  return (
    <View accessibilityRole="alert" className="mt-4 rounded-[18px] bg-clay-tint p-4">
      <Text variant="body" className="font-sans-semibold">
        Saved catalog retries unavailable
      </Text>
      <Text variant="bodySm" tone="muted" className="mt-1">
        Your Shelf is unchanged. Try loading saved retries again.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={retry}
        className="mt-2 min-h-[48px] self-start justify-center rounded-pill px-4 py-2"
      >
        <Text variant="bodySm" tone="clay" className="font-sans-semibold">
          Try again
        </Text>
      </Pressable>
    </View>
  );
}

function ProductCard({ item }: { item: ShelfItem }) {
  // Only the countdown card carries the faint accent border (design screen 05);
  // Other freshness states stay on the neutral hairline; their badge carries
  // the source-bound status.
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

function EmptyShelf({
  archiveCount,
  compact,
  shortPhone,
  splitShort,
}: {
  archiveCount: number;
  compact: boolean;
  shortPhone: boolean;
  splitShort: boolean;
}) {
  const hasArchive = archiveCount > 0;
  const compactWithArchive = compact && hasArchive;
  const compactNoArchiveShort = compact && !hasArchive && shortPhone;

  return (
    <View
      className={
        compact
          ? compactWithArchive
            ? 'items-center px-2 pb-28 pt-2'
            : splitShort
              ? 'items-center px-2 pb-28 pt-0'
              : compactNoArchiveShort
                ? 'items-center px-2 pb-28 pt-2'
                : 'items-center px-2 pb-24 pt-7'
          : 'flex-1 items-center justify-center px-2 pb-16'
      }
    >
      {!splitShort ? (
        <View
          className={`${
            compactNoArchiveShort ? 'mb-3' : compactWithArchive ? 'mb-4' : 'mb-7'
          } flex-row items-end gap-2.5`}
        >
          <View className="-rotate-6">
            <StripedThumb
              light
              width={compactNoArchiveShort ? 38 : 46}
              height={compactNoArchiveShort ? 50 : 60}
              radius={10}
            />
          </View>
          <StripedThumb
            light
            width={compactNoArchiveShort ? 38 : 46}
            height={compactNoArchiveShort ? 56 : 68}
            radius={10}
          />
          <View className="rotate-6">
            <StripedThumb
              light
              width={compactNoArchiveShort ? 38 : 46}
              height={compactNoArchiveShort ? 50 : 60}
              radius={10}
            />
          </View>
        </View>
      ) : null}
      <Text
        variant="title"
        className={
          compactNoArchiveShort
            ? 'max-w-[280px] text-center text-[25px] leading-[29px]'
            : 'max-w-[280px] text-center text-[28px] leading-[32px]'
        }
      >
        Let&apos;s build your cabinet.
      </Text>
      <Text
        variant="body"
        tone="muted"
        className={
          compactNoArchiveShort
            ? 'mt-1.5 max-w-[270px] text-center text-[14px] leading-[19px]'
            : 'mt-2.5 max-w-[280px] text-center'
        }
      >
        {splitShort ? (
          <>Scan a barcode, or add it by hand.</>
        ) : (
          <>
            Add what you already use. Scan a barcode, or add it by hand. We&apos;ll handle freshness
            and clashes.
          </>
        )}
      </Text>
      <View
        className={`${
          compactNoArchiveShort ? 'mt-4 gap-2' : compactWithArchive ? 'mt-5 gap-2' : 'mt-8 gap-3'
        } w-full max-w-[300px]`}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            haptics.select();
            trackProductAddStarted('empty_scan');
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
            trackProductAddStarted('empty_manual');
            router.push('/shelf/manual');
          }}
          className={
            compactNoArchiveShort
              ? 'h-[48px] items-center justify-center'
              : 'h-[50px] items-center justify-center'
          }
        >
          <Text className="font-sans-semibold text-[15px]" tone="muted">
            Add by hand
          </Text>
        </Pressable>
        {hasArchive ? (
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

function RoutineHandoffCard({
  hasConflict,
  productCount,
}: {
  hasConflict: boolean;
  productCount: number;
}) {
  return (
    <View
      className="mt-4 rounded-[18px] bg-greige-chip p-4"
      style={{ borderWidth: 1, borderColor: colors.hairline }}
    >
      <Text variant="label" tone="clay" className="font-mono uppercase">
        First routine
      </Text>
      <Text variant="body" className="mt-1 font-sans-semibold">
        {hasConflict ? 'Turn this insight into a routine.' : 'Your routine is ready to draft.'}
      </Text>
      <Text variant="bodySm" tone="muted" className="mt-1.5">
        {hasConflict
          ? 'We will place your products around the timing note instead of making you remember it.'
          : productCount === 1
            ? 'Even one product can start an honest AM/PM draft. Missing steps stay visible, not invented.'
            : 'Uses the products you added, and keeps missing steps visible instead of inventing them.'}
      </Text>
      <Button
        label="Build my routine"
        className="mt-3 min-h-[52px] py-3"
        onPress={() => router.push('/routine/plan')}
      />
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
function SkeletonShelf({ compactFilterLabels }: { compactFilterLabels: boolean }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-32">
      <View className="mt-2">
        <Text variant="title" className="text-[38px] leading-[40px]">
          Shelf
        </Text>
      </View>
      <View className={compactFilterLabels ? 'mt-3.5 flex-row gap-2' : 'mt-3.5 flex-row gap-2.5'}>
        {(['All', 'Actives', 'Expiring'] as const).map((l, i) => (
          <SegmentChip
            key={l}
            accessibilityLabel={l}
            label={compactFilterLabels && l === 'Expiring' ? 'Soon' : l}
            selected={i === 0}
            className={compactFilterLabels ? 'px-2.5' : undefined}
          />
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
  const catalogRecovery = useQuery({
    queryKey: ['catalog-lookup-ready'],
    queryFn: () => readReadyCatalogLookups(),
    retry: false,
    refetchOnMount: 'always',
  });
  const [filter, setFilter] = useState<Filter>('all');
  const { height } = useWindowDimensions();
  const compactShelf = height < 640;
  const shortShelf = height < 520;
  const splitShortShelf = height < 410;
  const compactFilterLabels = compactShelf;

  const items = data?.items ?? [];
  const archiveCount = data?.archive.length ?? 0;
  const filtered = items.filter((i) => {
    if (filter === 'actives') return i.engineProduct.tags.some((t) => ACTIVE_TAGS.has(t));
    if (filter === 'expiring') return i.badge.kind === 'countdown' || i.badge.kind === 'expired';
    return true;
  });

  const showLoading = isLoading && items.length === 0;
  const isEmpty = !isLoading && items.length === 0;
  const readyCatalogLookup = catalogRecovery.data?.[0] ?? null;
  const recoverySurface = readyCatalogLookup ? (
    <CatalogRecoveryCard
      ready={readyCatalogLookup}
      readyCount={catalogRecovery.data?.length ?? 1}
    />
  ) : catalogRecovery.isError ? (
    <CatalogRecoveryUnavailable retry={() => void catalogRecovery.refetch()} />
  ) : null;

  return (
    <Screen edges={['top']}>
      {showLoading ? (
        <SkeletonShelf compactFilterLabels={compactFilterLabels} />
      ) : isEmpty ? (
        recoverySurface ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-32">
            <View className="mt-2">
              <Text variant="title" className="text-[38px] leading-[40px]">
                Shelf
              </Text>
              <Text variant="label" tone="muted" className="mt-1">
                empty for now
              </Text>
            </View>
            {recoverySurface}
            <EmptyShelf
              archiveCount={archiveCount}
              compact={compactShelf}
              shortPhone={shortShelf}
              splitShort={splitShortShelf}
            />
          </ScrollView>
        ) : (
          <>
            <View className="mt-2">
              <Text variant="title" className="text-[38px] leading-[40px]">
                Shelf
              </Text>
              <Text variant="label" tone="muted" className="mt-1">
                empty for now
              </Text>
            </View>
            <EmptyShelf
              archiveCount={archiveCount}
              compact={compactShelf}
              shortPhone={shortShelf}
              splitShort={splitShortShelf}
            />
          </>
        )
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

          <View
            className={compactFilterLabels ? 'mt-3.5 flex-row gap-2' : 'mt-3.5 flex-row gap-2.5'}
          >
            {(['all', 'actives', 'expiring'] as Filter[]).map((f) => (
              <SegmentChip
                key={f}
                accessibilityLabel={f === 'all' ? 'All' : f === 'actives' ? 'Actives' : 'Expiring'}
                label={
                  f === 'all'
                    ? 'All'
                    : f === 'actives'
                      ? 'Actives'
                      : compactFilterLabels
                        ? 'Soon'
                        : 'Expiring'
                }
                selected={filter === f}
                className={compactFilterLabels ? 'px-2.5' : undefined}
                onPress={() => setFilter(f)}
              />
            ))}
          </View>

          <Text variant="bodySm" tone="muted" className="mt-3">
            {SUBHEAD[filter]}
          </Text>

          {recoverySurface}

          {data?.banner ? (
            <ConflictBanner
              className="mt-4"
              title={bannerTitle(data.banner)}
              subhead={bannerSubhead(data.banner)}
              severityPill={severityLabel(data.banner)}
              actionLabel={data.banner.rule.copy.primaryActionLabel}
              onReview={() => {
                haptics.select();
                router.push(conflictDetailRoute(data.banner!));
              }}
            />
          ) : data?.conflictCoverageStatus === 'unsupported_unreviewed' &&
            data.unsupportedConflictPairs.length > 0 ? (
            <ConflictBanner
              className="mt-4"
              title="Interaction guidance is unavailable"
              subhead="We won't show a compatibility result for these products until that review is complete."
            />
          ) : null}

          <RoutineHandoffCard hasConflict={Boolean(data?.banner)} productCount={items.length} />

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

          <View className="mt-6 items-center pb-2">
            <ScanShelfButton source="scan_inline" />
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}
