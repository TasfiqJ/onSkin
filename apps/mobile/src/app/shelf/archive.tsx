import { router } from 'expo-router';
import { memo, Profiler, useMemo } from 'react';
import { FlatList, Pressable, View, type ListRenderItem } from 'react-native';

import { RouteIconButton, Screen, StripedThumb, Text } from '@/components/ui';
import { useShelfRouteSources } from '@/features/shelf/ShelfRouteSources';
import {
  recordShelfArchiveListCommit,
  recordShelfArchiveRowRender,
} from '@/features/shelf/shelfRenderDiagnostics';
import {
  readShelfE2EStressFixture,
  type ShelfStressArchiveRow,
} from '@/features/shelf/shelfStressFixture';
import type { ShelfItem } from '@/features/shelf/useShelf';
import { APP_SHELF_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';

// Lifecycle / archive (design screen 08, docs/04 §5.7). Finished + discarded
// products live here. Never deleted. So repurchase history and replenishment
// just work. Calm, no celebration, no alarm.

function weeksUsed(createdAt: string, finishedAt: string | null): number | null {
  if (!finishedAt) return null;
  const start = new Date(createdAt).getTime();
  const end = new Date(finishedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.max(1, Math.round((end - start) / (7 * 86_400_000)));
}

function monthLabel(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short' });
}

type ArchiveCardProps = Omit<ShelfStressArchiveRow, 'id'> & { productId: string };

const ArchiveCard = memo(function ArchiveCard({
  createdAt,
  finishedAt,
  name,
  productId,
  repurchaseCount,
  status,
}: ArchiveCardProps) {
  recordShelfArchiveRowRender();
  const weeks = weeksUsed(createdAt, finishedAt);
  const when = monthLabel(finishedAt);
  const meta =
    status === 'finished'
      ? `finished ${when ?? ''}${weeks ? ` · used ${weeks} week${weeks === 1 ? '' : 's'}` : ''}`.trim()
      : `discarded ${when ?? ''}`.trim();

  return (
    <Pressable
      nativeID={`shelf-archive-product-${productId}`}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${meta}`}
      onPress={() => {
        haptics.select();
        router.push(`/shelf/${productId}`);
      }}
      className="flex-row items-center gap-3.5 rounded-[18px] bg-paper-warm px-4 py-3.5"
    >
      <StripedThumb light size={48} radius={14} faded />
      <View className="flex-1">
        <Text variant="bodySm" tone="muted" className="font-sans-semibold">
          {name}
        </Text>
        <Text variant="label" tone="muted" className="mt-0.5">
          {meta}
        </Text>
      </View>
      {status === 'finished' && repurchaseCount > 1 ? (
        <View className="rounded-pill bg-sage-tint px-2.5 py-1.5">
          <Text className="font-sans-bold text-[11px] text-sage">{repurchaseCount}× bought</Text>
        </View>
      ) : (
        <Text variant="label" tone="muted">
          archived
        </Text>
      )}
    </Pressable>
  );
});

function ArchiveSeparator() {
  return <View className="h-2.5" />;
}

function ArchiveEmptyState() {
  return (
    <Text variant="bodySm" tone="muted" className="mt-8 text-center">
      Nothing archived yet. When you finish or discard a product, it&apos;ll move here.
    </Text>
  );
}

const renderArchiveItem: ListRenderItem<ShelfStressArchiveRow> = ({ item }) => {
  return (
    <ArchiveCard
      createdAt={item.createdAt}
      finishedAt={item.finishedAt}
      name={item.name}
      productId={item.id}
      repurchaseCount={item.repurchaseCount}
      status={item.status}
    />
  );
};

function archiveRow(item: ShelfItem): ShelfStressArchiveRow {
  return {
    createdAt: item.product.createdAt,
    finishedAt: item.product.finishedAt,
    id: item.product.id,
    name: item.product.name,
    repurchaseCount: item.product.repurchaseCount,
    status: item.product.status === 'finished' ? 'finished' : 'discarded',
  };
}

export default function ArchiveScreen() {
  const { shelf } = useShelfRouteSources();
  const { data, isError } = shelf;
  const stressFixtureCandidate = useMemo(() => readShelfE2EStressFixture(), []);
  const stressFixture = !isError && data ? stressFixtureCandidate : null;
  const archive = useMemo(
    () => stressFixture?.archiveRows ?? (data?.archive ?? []).map(archiveRow),
    [data?.archive, stressFixture],
  );

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="mt-2 flex-row items-center gap-3">
        <RouteIconButton
          accessibilityLabel="Back"
          onPress={() => backOrReplace(router, APP_SHELF_ROUTE)}
        />
        <Text variant="title" className="text-[30px]">
          Archive
        </Text>
      </View>
      <Text variant="bodySm" tone="muted" className="mt-2">
        Finished and discarded products live here. We keep the history so repurchases and
        replenishment just work.
      </Text>

      {/* Lifecycle strip */}
      <View className="mt-5 flex-row items-end">
        <View className="flex-1 items-center">
          <View className="mb-1.5 h-2 w-full rounded-full bg-greige-deep" />
          <Text variant="label" tone="muted">
            Unopened
          </Text>
        </View>
        <Text tone="muted" className="px-1 pb-4">
          ›
        </Text>
        <View className="flex-1 items-center">
          <View className="mb-1.5 h-2 w-full rounded-full bg-clay" />
          <Text className="font-sans-bold text-[11px] text-clay-deep">Active</Text>
        </View>
        <Text tone="muted" className="px-1 pb-4">
          ›
        </Text>
        <View className="flex-1 items-center">
          <View className="mb-1.5 h-2 w-full rounded-full" style={{ backgroundColor: '#C0B7A6' }} />
          <Text variant="label" tone="muted">
            Finished
          </Text>
        </View>
      </View>

      <Profiler
        id="shelf-archive-list"
        onRender={(_id, _phase, actualDuration) => recordShelfArchiveListCommit(actualDuration)}
      >
        <FlatList
          nativeID="shelf-archive-list"
          data={archive}
          keyExtractor={(item) => item.id}
          renderItem={renderArchiveItem}
          ItemSeparatorComponent={ArchiveSeparator}
          ListEmptyComponent={ArchiveEmptyState}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32, paddingTop: archive.length === 0 ? 0 : 20 }}
        />
      </Profiler>
    </Screen>
  );
}
