import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { useShelf, type ShelfItem } from '@/features/shelf/useShelf';
import { haptics } from '@/theme/haptics';

// Lifecycle / archive (design screen 08, docs/04 §5.7). Finished + discarded
// products live here — never deleted — so repurchase history and replenishment
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

function ArchiveCard({ item }: { item: ShelfItem }) {
  const p = item.product;
  const weeks = weeksUsed(p.createdAt, p.finishedAt);
  const when = monthLabel(p.finishedAt);
  const meta =
    p.status === 'finished'
      ? `finished ${when ?? ''}${weeks ? ` · used ${weeks} week${weeks === 1 ? '' : 's'}` : ''}`.trim()
      : `discarded ${when ?? ''}`.trim();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${p.name}, ${meta}`}
      onPress={() => {
        haptics.select();
        router.push(`/shelf/${p.id}`);
      }}
      className="flex-row items-center gap-3.5 rounded-[18px] bg-greige px-4 py-3.5">
      <View className="h-12 w-12 rounded-[14px] bg-greige-deep" style={{ opacity: 0.7 }} />
      <View className="flex-1">
        <Text variant="bodySm" tone="muted" className="font-sans-semibold">
          {p.name}
        </Text>
        <Text variant="label" tone="muted" className="mt-0.5">
          {meta}
        </Text>
      </View>
      {p.status === 'finished' && p.repurchaseCount > 1 ? (
        <View className="rounded-pill px-2.5 py-1.5" style={{ backgroundColor: '#E6ECE0' }}>
          <Text className="font-sans-bold text-[11px]" style={{ color: '#4F7A4A' }}>
            {p.repurchaseCount}× bought
          </Text>
        </View>
      ) : (
        <Text variant="label" tone="muted">
          archived
        </Text>
      )}
    </Pressable>
  );
}

export default function ArchiveScreen() {
  const { data } = useShelf();
  const archive = data?.archive ?? [];

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="mt-2 flex-row items-center gap-3">
        <Pressable accessibilityRole="button" onPress={() => router.back()} className="py-2">
          <Text className="font-sans-semibold">‹</Text>
        </Pressable>
        <Text variant="title" className="text-[30px]">
          Archive
        </Text>
      </View>
      <Text variant="bodySm" tone="muted" className="mt-2">
        Finished and discarded products live here — we keep the history so repurchases and
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-8">
        {archive.length === 0 ? (
          <Text variant="bodySm" tone="muted" className="mt-8 text-center">
            Nothing archived yet. When you finish or discard a product, it&apos;ll move here.
          </Text>
        ) : (
          <View className="mt-5 gap-2.5">
            {archive.map((item) => (
              <ArchiveCard key={item.id} item={item} />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
