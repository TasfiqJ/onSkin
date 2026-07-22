import { router, useIsFocused } from 'expo-router';
import {
  createContext,
  memo,
  Profiler,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewToken,
} from 'react-native';

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
import { ShelfDataUnavailableNotice } from '@/features/shelf/ShelfDataAvailabilityGate';
import {
  recordShelfFooterRender,
  recordShelfHeaderRender,
  recordShelfMainListCommit,
  recordShelfProductRowRender,
} from '@/features/shelf/shelfRenderDiagnostics';
import {
  readShelfE2EStressFixture,
  type ShelfStressActiveRow,
} from '@/features/shelf/shelfStressFixture';
import { ShelfSyncStatus } from '@/features/shelf/ShelfSyncStatus';
import { useShelfFromBoundary, type ShelfData, type ShelfItem } from '@/features/shelf/useShelf';
import { useLocalDateBoundary } from '@/lib/query/localDateBoundaryStore';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

// Shelf list (Smart Shelf design screen 05, docs/04 §5.1): title + count,
// All/Actives/Expiring filters, the calm conflict banner, product cards with the
// five-state badge taxonomy, and the "Scan a barcode" FAB. Light-mode, calm,
// claim-safe. The cabinet that knows when to replace, never when to alarm.
type Filter = 'all' | 'actives' | 'expiring';
const ACTIVE_TAGS = new Set(['retinoid', 'aha', 'bha', 'benzoyl_peroxide', 'vitamin_c']);
const SUBHEAD: Record<Filter, string> = {
  all: 'Everything on your shelf, soonest to replace first.',
  actives: 'The potent ingredients in your routine.',
  expiring: 'Soonest first. The honest reasons to replace something.',
};

// Preserve only bounded, non-sensitive view state while Expo Router releases the
// focused Shelf subtree. Product rows and query data remain owned by React Query.
const shelfViewMemory: {
  filter: Filter;
  restoreToEnd: Filter | null;
  scrollOffsets: Record<Filter, number>;
} = {
  filter: 'all',
  restoreToEnd: null,
  scrollOffsets: { all: 0, actives: 0, expiring: 0 },
};

type ShelfViewState = {
  beginFilterEndRestore: (filter: Filter) => void;
  filter: Filter;
  finishFilterOffsetRestore: (filter: Filter) => void;
  getScrollOffset: () => number;
  isFilterEndRestorePending: (filter: Filter) => boolean;
  isFilterOffsetRestorePending: (filter: Filter) => boolean;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  setFilter: (filter: Filter) => void;
};

const ShelfViewStateContext = createContext<ShelfViewState | null>(null);

function useShelfViewState(): ShelfViewState {
  const state = useContext(ShelfViewStateContext);
  if (!state) throw new Error('ShelfViewStateProvider is missing');
  return state;
}

function ShelfViewStateProvider({
  children,
  isFocused,
}: {
  children: React.ReactNode;
  isFocused: boolean;
}) {
  const [filter, setFilterState] = useState<Filter>(() => shelfViewMemory.filter);
  const filterRef = useRef<Filter>(shelfViewMemory.filter);
  const focusedRef = useRef(isFocused);
  const restoringFilter = useRef<Filter | null>(
    shelfViewMemory.restoreToEnd ??
      (shelfViewMemory.scrollOffsets[shelfViewMemory.filter] > 0 ? shelfViewMemory.filter : null),
  );
  const scrollOffsets = useRef(shelfViewMemory.scrollOffsets);
  useLayoutEffect(() => {
    focusedRef.current = isFocused;
  }, [isFocused]);
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (
        !focusedRef.current ||
        filterRef.current !== filter ||
        restoringFilter.current !== null
      ) {
        return;
      }
      scrollOffsets.current[filter] = Math.max(0, event.nativeEvent.contentOffset.y);
    },
    [filter],
  );
  const setFilter = useCallback((nextFilter: Filter) => {
    if (filterRef.current === nextFilter) return;
    filterRef.current = nextFilter;
    shelfViewMemory.filter = nextFilter;
    restoringFilter.current = nextFilter;
    setFilterState(nextFilter);
  }, []);
  const getScrollOffset = useCallback(() => scrollOffsets.current[filter], [filter]);
  const beginFilterEndRestore = useCallback((candidate: Filter) => {
    shelfViewMemory.restoreToEnd = candidate;
    restoringFilter.current = candidate;
  }, []);
  const isFilterEndRestorePending = useCallback(
    (candidate: Filter) => shelfViewMemory.restoreToEnd === candidate,
    [],
  );
  const isFilterOffsetRestorePending = useCallback(
    (candidate: Filter) => restoringFilter.current === candidate,
    [],
  );
  const finishFilterOffsetRestore = useCallback((candidate: Filter) => {
    if (restoringFilter.current === candidate) restoringFilter.current = null;
    if (shelfViewMemory.restoreToEnd === candidate) shelfViewMemory.restoreToEnd = null;
  }, []);
  const state = useMemo(
    () => ({
      beginFilterEndRestore,
      filter,
      finishFilterOffsetRestore,
      getScrollOffset,
      isFilterEndRestorePending,
      isFilterOffsetRestorePending,
      onScroll,
      setFilter,
    }),
    [
      filter,
      beginFilterEndRestore,
      finishFilterOffsetRestore,
      getScrollOffset,
      isFilterEndRestorePending,
      isFilterOffsetRestorePending,
      onScroll,
      setFilter,
    ],
  );

  return <ShelfViewStateContext.Provider value={state}>{children}</ShelfViewStateContext.Provider>;
}

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

type ProductCardProps = Pick<ShelfItem, 'id' | 'name' | 'metaLine' | 'badge'>;

const ProductCard = memo(function ProductCard({ id, name, metaLine, badge }: ProductCardProps) {
  recordShelfProductRowRender();
  // Only the countdown card carries the faint accent border (design screen 05);
  // expired/safety cards stay on the neutral hairline. The firmer badge already
  // signals attention.
  const attention = badge.kind === 'countdown';
  return (
    <View
      nativeID={`shelf-product-${id}`}
      style={[
        // The countdown card carries the faint amber accent border (design frame 03,
        // rgba(176,122,60,0.45)); everything else stays on the neutral hairline.
        { borderWidth: 1, borderColor: attention ? 'rgba(176,122,60,0.45)' : colors.hairline },
      ]}
      className="rounded-[18px] bg-paper-raised p-4"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${badge.label}`}
        onPress={() => {
          haptics.select();
          router.push(`/shelf/${id}`);
        }}
        style={({ pressed }) => [pressed ? { opacity: 0.85 } : null]}
        className="flex-row items-center gap-3.5"
      >
        <StripedThumb size={50} radius={14} faded={badge.kind === 'expired'} />
        <View className="flex-1">
          <Text variant="body" className="font-sans-semibold">
            {name}
          </Text>
          {metaLine ? (
            <Text variant="bodySm" tone="muted" className="mt-0.5">
              {metaLine}
            </Text>
          ) : null}
        </View>
        <ExpiryBadge badge={badge} />
      </Pressable>
      {/* Proactive, honest PAO-triggered replenishment nudge on the card itself
            (docs/04 §6): a quiet "Replace ->" on countdown/expired items. */}
      {badge.kind === 'countdown' || badge.kind === 'expired' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Replace ${name}`}
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
            router.push(`/shelf/replenish?id=${id}`);
          }}
        >
          <Text variant="bodySm" tone="clay" className="font-sans-semibold">
            Replace →
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
});

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
            label={compactFilterLabels && l === 'Expiring' ? '7d' : l}
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

type ShelfListRow = ShelfStressActiveRow;

function shelfRowKey(item: ShelfListRow) {
  return item.id;
}

function renderShelfRow({ item }: ListRenderItemInfo<ShelfListRow>) {
  return <ProductCard id={item.id} name={item.name} metaLine={item.metaLine} badge={item.badge} />;
}

function ShelfRowSeparator() {
  return <View className="h-2.5" />;
}

const ShelfListTitle = memo(function ShelfListTitle({ productCount }: { productCount: number }) {
  return (
    <View className="mt-2 flex-row items-baseline justify-between">
      <Text variant="title" className="text-[38px] leading-[40px]">
        Shelf
      </Text>
      <Text variant="label" tone="muted">
        {productCount} product{productCount === 1 ? '' : 's'}
      </Text>
    </View>
  );
});

function ShelfFilterControls({ compactFilterLabels }: { compactFilterLabels: boolean }) {
  const { filter, setFilter } = useShelfViewState();

  return (
    <>
      <View className={compactFilterLabels ? 'mt-3.5 flex-row gap-2' : 'mt-3.5 flex-row gap-2.5'}>
        {(['all', 'actives', 'expiring'] as Filter[]).map((filterOption) => (
          <SegmentChip
            key={filterOption}
            accessibilityLabel={
              filterOption === 'all' ? 'All' : filterOption === 'actives' ? 'Actives' : 'Expiring'
            }
            label={
              filterOption === 'all'
                ? 'All'
                : filterOption === 'actives'
                  ? 'Actives'
                  : compactFilterLabels
                    ? '7d'
                    : 'Expiring'
            }
            selected={filter === filterOption}
            className={compactFilterLabels ? 'px-2.5' : undefined}
            onPress={() => setFilter(filterOption)}
          />
        ))}
      </View>

      <Text variant="bodySm" tone="muted" className="mt-3">
        {SUBHEAD[filter]}
      </Text>
    </>
  );
}

const ShelfListInsights = memo(function ShelfListInsights({
  banner,
  productCount,
}: {
  banner: ShelfData['banner'];
  productCount: number;
}) {
  return (
    <>
      {banner ? (
        <ConflictBanner
          className="mt-4"
          title={bannerTitle(banner)}
          subhead={bannerSubhead(banner)}
          severityPill={severityLabel(banner.computedSeverity)}
          onReview={() => {
            haptics.select();
            router.push(conflictDetailRoute(banner));
          }}
        />
      ) : null}
      <RoutineHandoffCard hasConflict={Boolean(banner)} productCount={productCount} />
    </>
  );
});

const ShelfListHeader = memo(function ShelfListHeader({
  banner,
  compactFilterLabels,
  productCount,
}: {
  banner: ShelfData['banner'];
  compactFilterLabels: boolean;
  productCount: number;
}) {
  recordShelfHeaderRender();
  return (
    <View className="pb-4">
      <ShelfListTitle productCount={productCount} />
      <ShelfSyncStatus className="mt-3" />
      <ShelfFilterControls compactFilterLabels={compactFilterLabels} />
      <ShelfListInsights banner={banner} productCount={productCount} />
    </View>
  );
});

const ShelfListFooter = memo(function ShelfListFooter({
  archiveCount,
  onOpenArchive,
}: {
  archiveCount: number;
  onOpenArchive: () => void;
}) {
  recordShelfFooterRender();
  return (
    <>
      {archiveCount > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View archive, ${archiveCount} archived ${
            archiveCount === 1 ? 'product' : 'products'
          }`}
          className="mt-6 min-h-[48px] items-center justify-center py-2"
          onPress={() => {
            haptics.select();
            onOpenArchive();
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
    </>
  );
});

function LoadedShelf({
  items,
  banner,
  archiveCount,
  compactFilterLabels,
  stressRows,
}: {
  items: ShelfItem[];
  banner: ShelfData['banner'];
  archiveCount: number;
  compactFilterLabels: boolean;
  stressRows?: ShelfListRow[];
}) {
  const {
    beginFilterEndRestore,
    filter,
    finishFilterOffsetRestore,
    getScrollOffset,
    isFilterEndRestorePending,
    isFilterOffsetRestorePending,
    onScroll,
  } = useShelfViewState();
  const listRef = useRef<FlatList<ShelfListRow>>(null);
  const restoreFrame = useRef<number | null>(null);
  const rows = useMemo<ShelfListRow[]>(
    () =>
      stressRows ??
      items.map((item) => ({
        id: item.id,
        name: item.name,
        metaLine: item.metaLine,
        badge: item.badge,
        active: item.engineProduct.tags.some((tag) => ACTIVE_TAGS.has(tag)),
        expiring: item.badge.kind === 'countdown' || item.badge.kind === 'expired',
      })),
    [items, stressRows],
  );
  const filteredRows = useMemo(() => {
    if (filter === 'actives') return rows.filter((item) => item.active);
    if (filter === 'expiring') return rows.filter((item) => item.expiring);
    return rows;
  }, [filter, rows]);
  const initialContentOffset = useMemo(() => ({ x: 0, y: getScrollOffset() }), [getScrollOffset]);
  const restoreFilterOffset = useCallback(() => {
    if (restoreFrame.current !== null) cancelAnimationFrame(restoreFrame.current);
    const offset = getScrollOffset();
    const restoreToEnd = isFilterEndRestorePending(filter);
    const restore = () => {
      if (restoreToEnd) listRef.current?.scrollToEnd({ animated: false });
      else listRef.current?.scrollToOffset({ animated: false, offset });
    };
    restore();
    restoreFrame.current = requestAnimationFrame(() => {
      restore();
      restoreFrame.current = requestAnimationFrame(() => {
        restore();
        if (!restoreToEnd) finishFilterOffsetRestore(filter);
        restoreFrame.current = null;
      });
    });
  }, [filter, finishFilterOffsetRestore, getScrollOffset, isFilterEndRestorePending]);
  useLayoutEffect(() => {
    restoreFilterOffset();
    return () => {
      if (restoreFrame.current !== null) cancelAnimationFrame(restoreFrame.current);
      restoreFrame.current = null;
    };
  }, [filter, filteredRows.length, restoreFilterOffset]);
  const handleContentSizeChange = useCallback(() => {
    if (isFilterOffsetRestorePending(filter)) restoreFilterOffset();
  }, [filter, isFilterOffsetRestorePending, restoreFilterOffset]);
  const viewabilityState = useRef({ filter, finalIndex: filteredRows.length - 1 });
  useLayoutEffect(() => {
    viewabilityState.current = { filter, finalIndex: filteredRows.length - 1 };
  }, [filter, filteredRows.length]);
  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<ShelfListRow>[] }) => {
      const current = viewabilityState.current;
      if (
        isFilterEndRestorePending(current.filter) &&
        viewableItems.some((item) => item.index === current.finalIndex)
      ) {
        finishFilterOffsetRestore(current.filter);
      }
    },
    [finishFilterOffsetRestore, isFilterEndRestorePending],
  );
  const listHeader = useMemo(
    () => (
      <ShelfListHeader
        banner={banner}
        compactFilterLabels={compactFilterLabels}
        productCount={rows.length}
      />
    ),
    [banner, compactFilterLabels, rows.length],
  );
  const openArchive = useCallback(() => {
    beginFilterEndRestore(filter);
    router.push('/shelf/archive');
  }, [beginFilterEndRestore, filter]);
  const listFooter = useMemo(
    () => <ShelfListFooter archiveCount={archiveCount} onOpenArchive={openArchive} />,
    [archiveCount, openArchive],
  );

  return (
    <Profiler
      id="shelf-main-list"
      onRender={(_id, _phase, actualDuration) => recordShelfMainListCommit(actualDuration)}
    >
      <FlatList
        ref={listRef}
        nativeID="shelf-main-list"
        className="flex-1"
        data={filteredRows}
        keyExtractor={shelfRowKey}
        renderItem={renderShelfRow}
        ItemSeparatorComponent={ShelfRowSeparator}
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-32"
        contentOffset={initialContentOffset}
        onScroll={onScroll}
        onContentSizeChange={handleContentSizeChange}
        onViewableItemsChanged={handleViewableItemsChanged}
        scrollEventThrottle={32}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <Text variant="bodySm" tone="muted" className="mt-4 text-center">
            {filter === 'expiring'
              ? 'Nothing needs replacing right now.'
              : 'No products match this filter.'}
          </Text>
        }
        ListFooterComponent={listFooter}
      />
    </Profiler>
  );
}

function FocusedShelfScreen() {
  const boundary = useLocalDateBoundary();
  const { data, isError, isFetching, isLoading, refetch } = useShelfFromBoundary(boundary);
  const { height } = useWindowDimensions();
  const compactShelf = height < 640;
  const shortShelf = height < 520;
  const splitShortShelf = height < 410;
  const compactFilterLabels = compactShelf;
  const stressFixtureCandidate = useMemo(() => readShelfE2EStressFixture(), []);
  const stressFixture = !isError && data ? stressFixtureCandidate : null;

  const items = data?.items ?? [];
  const displayedItemCount = stressFixture?.activeRows.length ?? items.length;
  const archiveCount = stressFixture?.archiveRows.length ?? data?.archive.length ?? 0;

  const showLoading = !stressFixture && isLoading && items.length === 0;
  const isEmpty = !showLoading && displayedItemCount === 0;

  return (
    <Screen edges={['top']}>
      {showLoading ? (
        <SkeletonShelf compactFilterLabels={compactFilterLabels} />
      ) : isError ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingBottom: 96 }}
        >
          <ShelfDataUnavailableNotice onRetry={refetch} retrying={isFetching} />
        </ScrollView>
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
          <ShelfSyncStatus className="mt-3" />
          <EmptyShelf
            archiveCount={archiveCount}
            compact={compactShelf}
            shortPhone={shortShelf}
            splitShort={splitShortShelf}
          />
        </>
      ) : (
        <LoadedShelf
          items={items}
          banner={stressFixture ? null : (data?.banner ?? null)}
          archiveCount={archiveCount}
          compactFilterLabels={compactFilterLabels}
          stressRows={stressFixture?.activeRows}
        />
      )}
    </Screen>
  );
}

export default function ShelfScreen() {
  const isFocused = useIsFocused();

  return (
    <ShelfViewStateProvider isFocused={isFocused}>
      {isFocused ? <FocusedShelfScreen /> : null}
    </ShelfViewStateProvider>
  );
}
