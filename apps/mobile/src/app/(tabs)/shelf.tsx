import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button, Card, Chip, ConflictBanner, Screen, Text } from '@/components/ui';
import { bannerSubhead, bannerTitle } from '@/features/intelligence/presentation';
import { useShelf, type ShelfItem } from '@/features/intelligence/useShelf';
import { cn } from '@/lib/cn';
import { haptics } from '@/theme/haptics';

// Shelf (design spec p11–12, docs/02 §7.1): products + PAO/expiry badges + a calm,
// evidence-graded conflict banner + reassurance. The conflict engine runs over the
// loaded products (B-DERM-REVIEW gates which rules surface). Barcode scan + manual
// add are the next slice (B-CATALOG-SEED).
type Filter = 'all' | 'actives' | 'expiring';
const ACTIVE_TAGS = new Set(['retinoid', 'aha', 'bha', 'benzoyl_peroxide', 'vitamin_c']);

function badgeClasses(kind: ShelfItem['badge']['kind']): string {
  if (kind === 'countdown' || kind === 'expired') return 'text-clay';
  return 'text-muted';
}

export default function ShelfScreen() {
  const { data, isLoading } = useShelf();
  const [filter, setFilter] = useState<Filter>('all');

  const items = data?.items ?? [];
  const filtered = items.filter((i) => {
    if (filter === 'actives') return i.engineProduct.tags.some((t) => ACTIVE_TAGS.has(t));
    if (filter === 'expiring') return i.badge.kind === 'countdown' || i.badge.kind === 'expired';
    return true;
  });

  return (
    <Screen edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-28">
        <View className="mt-2 flex-row items-baseline justify-between">
          <Text variant="title">Shelf</Text>
          <Text variant="label" tone="muted">
            {items.length} product{items.length === 1 ? '' : 's'}
          </Text>
        </View>

        <View className="mt-4 flex-row gap-2">
          {(['all', 'actives', 'expiring'] as Filter[]).map((f) => (
            <Chip
              key={f}
              label={f === 'all' ? 'All' : f === 'actives' ? 'Actives' : 'Expiring'}
              selected={filter === f}
              onPress={() => setFilter(f)}
            />
          ))}
        </View>

        {data?.banner ? (
          <ConflictBanner
            className="mt-5"
            title={bannerTitle(data.banner)}
            subhead={bannerSubhead(data.banner)}
            onReview={() => {
              haptics.select();
              router.push(`/conflict/${data.banner!.rule.id}`);
            }}
          />
        ) : null}

        {data?.reassurances.length ? (
          <ConflictBanner
            className="mt-3"
            title="These pair well"
            subhead={data.reassurances[0]!.rule.resolutionCopy}
          />
        ) : null}

        {isLoading ? null : items.length === 0 ? (
          <Card className="mt-6">
            <Text variant="titleSm">Your shelf is empty.</Text>
            <Text variant="bodySm" tone="muted" className="mt-2">
              Add the products you use and we&apos;ll track PAO/expiry and check for conflicts —
              always with an evidence grade and a calm resolution.
            </Text>
          </Card>
        ) : (
          <View className="mt-5 gap-3">
            {filtered.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                className="flex-row items-center rounded-card border border-greige-line bg-paper-raised p-4">
                <View className="mr-3 h-12 w-12 rounded-xl bg-greige" />
                <View className="flex-1">
                  <Text variant="body" className="font-sans-medium">
                    {item.name}
                  </Text>
                  {item.metaLine ? (
                    <Text variant="label" tone="muted" className="mt-0.5">
                      {item.metaLine}
                    </Text>
                  ) : null}
                </View>
                <Text variant="label" className={cn('ml-2', badgeClasses(item.badge.kind))}>
                  {item.badge.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <View className="absolute inset-x-6 bottom-4">
        <Button label="Scan a barcode" onPress={() => router.push('/shelf/scan')} />
      </View>
    </Screen>
  );
}
