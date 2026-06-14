import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import type { DetectedConflict } from '@/features/intelligence/engine';
import { bannerSubhead, tagLabel } from '@/features/intelligence/presentation';
import { expiryMonthLabel, surfacedExpiry } from '@/features/shelf/expiry';
import { paoSourceLabel } from '@/features/shelf/labels';
import { useShelfMutations } from '@/features/shelf/mutations';
import { useShelf } from '@/features/shelf/useShelf';
import { usePlan } from '@/features/routine/usePlan';
import { localDateString } from '@/features/today/useToday';
import { cn } from '@/lib/cn';
import { haptics } from '@/theme/haptics';

// Product detail. The management hub (design screen 06, docs/04 §5.6). Freshness
// with provenance, the actives it contributes, the conflicts it's part of, where
// it's used, and the full lifecycle actions. Claim-safe throughout.

const PROVENANCE: Record<string, string> = {
  barcode: 'data · Open Beauty Facts',
  search: 'data · Open Beauty Facts',
  ocr: 'from the label you scanned',
  manual: 'added by hand',
  onboarding: 'added during setup',
};

const RECENT_OPENS: { label: string; monthsAgo: number }[] = [
  { label: 'Today', monthsAgo: 0 },
  { label: '1 mo ago', monthsAgo: 1 },
  { label: '3 mo ago', monthsAgo: 3 },
  { label: '6 mo ago', monthsAgo: 6 },
];

// Printed best-before is a FUTURE date (docs/04 §3. Wins for sunscreen). The
// primary source is the catalog/scan path (OBF, B-CATALOG-SEED); this inline edit
// lets the user record it by hand on the freshness block (§5.6 "editable inline").
const BEST_BEFORE: { label: string; monthsAhead: number }[] = [
  { label: 'in 3 mo', monthsAhead: 3 },
  { label: 'in 6 mo', monthsAhead: 6 },
  { label: 'in 1 yr', monthsAhead: 12 },
  { label: 'in 2 yr', monthsAhead: 24 },
];

function shiftMonthsISO(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return localDateString(d);
}
const monthsAgoISO = (m: number) => shiftMonthsISO(-m);

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useShelf();
  const plan = usePlan();
  const m = useShelfMutations();
  const [editOpen, setEditOpen] = useState(false);
  const [bestOpen, setBestOpen] = useState(false);

  const item = [...(data?.items ?? []), ...(data?.archive ?? [])].find((i) => i.id === id);

  if (!item) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View className="mt-2 flex-row items-center">
          <Pressable accessibilityRole="button" onPress={() => router.back()} className="py-2 pr-4">
            <Text className="font-sans-semibold">‹ Back</Text>
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center">
          <Text variant="body" tone="muted">
            This product is no longer on your shelf.
          </Text>
        </View>
      </Screen>
    );
  }

  const p = item.product;
  const archived = p.status !== 'active';
  const expiry = surfacedExpiry(p);
  const best = expiryMonthLabel(expiry);
  const provenance = PROVENANCE[p.addedVia] ?? 'added by hand';
  const openedLabel = p.isOpened
    ? p.openedAt
      ? new Date(p.openedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : 'date not set'
    : 'not opened yet';

  const conflicts = (data?.conflicts ?? []).filter(
    (c) => c.productAId === id || c.productBId === id,
  );

  // Where it's used. From the live plan (skipped for the example fallback).
  let usage: { phase: string; night?: number } | null = null;
  if (plan.data && !plan.data.isExample) {
    const pm = plan.data.plan.pm.find((s) => s.productId === id);
    if (pm) usage = { phase: 'Evening routine', night: pm.cyclingNight };
    else if (plan.data.plan.am.find((s) => s.productId === id)) usage = { phase: 'Morning routine' };
  }

  const otherName = (c: DetectedConflict) =>
    (c.productAId === id ? c.productBName : c.productAName) ?? 'another product';

  const setOpened = async (monthsAgo: number) => {
    await m.setOpened(id, { openedAt: monthsAgoISO(monthsAgo), isOpened: true });
    setEditOpen(false);
  };

  const confirmRemove = () => {
    Alert.alert('Remove from shelf?', `What should we do with ${p.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark discarded (keep history)',
        onPress: async () => {
          await m.markDiscarded(id);
          router.back();
        },
      },
      {
        text: 'Remove completely',
        style: 'destructive',
        onPress: async () => {
          await m.remove(id);
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="mt-2 flex-row items-center justify-between">
        <Pressable accessibilityRole="button" onPress={() => router.back()} className="py-2 pr-4">
          <Text className="font-sans-semibold">‹ Back</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-4">
        {/* Header */}
        <View className="mt-2 flex-row items-center gap-4">
          <View
            className="h-[72px] w-[72px] rounded-[18px] border border-hairline bg-greige"
            style={{ opacity: archived ? 0.7 : 1 }}
          />
          <View className="flex-1">
            <Text variant="titleSm" className="text-[24px] leading-[27px]">
              {p.name}
            </Text>
            {p.brand ? (
              <Text variant="bodySm" tone="muted" className="mt-0.5">
                {p.brand}
              </Text>
            ) : null}
            <Text variant="label" tone="muted" className="mt-1">
              {provenance}
            </Text>
          </View>
        </View>

        {archived ? (
          <View className="mt-4 rounded-[16px] bg-greige px-4 py-3">
            <Text variant="bodySm" tone="muted">
              {p.status === 'finished' ? 'Finished' : 'Discarded'}
              {p.finishedAt
                ? ` · ${new Date(p.finishedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
                : ''}
              {p.repurchaseCount > 1 ? ` · bought ${p.repurchaseCount}×` : ''}
            </Text>
          </View>
        ) : null}

        {/* Freshness block */}
        <View className="mt-4 rounded-[20px] border border-hairline bg-paper-raised px-4">
          <View className="flex-row items-center justify-between border-b border-hairline py-3">
            <Text variant="bodySm" tone="muted">
              Opened
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                haptics.select();
                setEditOpen((o) => !o);
              }}>
              <Text variant="bodySm" className="font-sans-semibold">
                {openedLabel} <Text variant="bodySm" tone="clay">· edit</Text>
              </Text>
            </Pressable>
          </View>
          {editOpen ? (
            <View className="flex-row flex-wrap gap-2 py-3">
              {RECENT_OPENS.map((o) => (
                <Pressable
                  key={o.label}
                  accessibilityRole="button"
                  onPress={() => setOpened(o.monthsAgo)}
                  className="rounded-pill border border-hairline bg-paper-raised px-3.5 py-2">
                  <Text className="font-sans-medium text-[13px]">{o.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View className="flex-row items-center justify-between border-b border-hairline py-3">
            <Text variant="bodySm" tone="muted">
              PAO
            </Text>
            <Text variant="bodySm" className="font-sans-semibold">
              {p.paoMonths != null ? `${p.paoMonths} months` : 'unknown'}
              {p.paoMonths != null ? (
                <Text variant="label" tone="muted">
                  {' '}
                  {paoSourceLabel(p.paoSource)}
                </Text>
              ) : null}
            </Text>
          </View>
          <View className="py-3">
            <View className="flex-row items-center justify-between">
              <Text variant="bodySm" tone="muted">
                {p.isOpened ? 'Best used by' : 'Shelf life'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Set printed best-before date"
                onPress={() => {
                  haptics.select();
                  setBestOpen((o) => !o);
                }}>
                <Text variant="bodySm" className="font-sans-bold text-clay-deep">
                  {best ?? 'estimated'}{' '}
                  <Text variant="bodySm" tone="clay">
                    · {p.expirySource === 'printed' ? 'edit' : 'set'}
                  </Text>
                </Text>
              </Pressable>
            </View>
            {bestOpen ? (
              <View className="mt-2.5 flex-row flex-wrap items-center gap-2">
                <Text variant="label" tone="muted" className="w-full">
                  Printed best-before on the pack?
                </Text>
                {BEST_BEFORE.map((b) => (
                  <Pressable
                    key={b.label}
                    accessibilityRole="button"
                    onPress={async () => {
                      await m.edit(id, {
                        expiryDate: shiftMonthsISO(b.monthsAhead),
                        expirySource: 'printed',
                      });
                      setBestOpen(false);
                    }}
                    className="rounded-pill border border-hairline bg-paper-raised px-3.5 py-2">
                    <Text className="font-sans-medium text-[13px]">{b.label}</Text>
                  </Pressable>
                ))}
                {p.expiryDate ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={async () => {
                      await m.edit(id, {
                        expiryDate: null,
                        expirySource: p.isOpened && p.paoMonths != null ? 'pao_computed' : 'unknown',
                      });
                      setBestOpen(false);
                    }}
                    className="rounded-pill px-3.5 py-2">
                    <Text className="font-sans-medium text-[13px]" tone="muted">
                      Clear
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

        {!p.isOpened ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => m.setOpened(id, { openedAt: localDateString(), isOpened: true })}
            className="mt-2.5 items-center rounded-[14px] border border-hairline bg-paper-raised py-3">
            <Text variant="bodySm" className="font-sans-semibold text-clay-deep">
              Mark as opened. Start the freshness clock
            </Text>
          </Pressable>
        ) : null}

        {/* What it contributes */}
        {item.engineProduct.tags.length ? (
          <>
            <Text variant="eyebrow" tone="clay" className="mt-5">
              What it contributes
            </Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {item.engineProduct.tags.map((t) => (
                <View
                  key={t}
                  className="rounded-pill border border-hairline bg-paper-raised px-3 py-1.5">
                  <Text variant="bodySm" className="font-sans-semibold">
                    {tagLabel(t)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* Conflicts & pairings */}
        {conflicts.map((c) => {
          const reassure = c.rule.interactionType === 'myth' || c.rule.interactionType === 'synergy';
          return (
            <Pressable
              key={c.rule.id}
              accessibilityRole="button"
              onPress={() => router.push(`/conflict/${c.rule.id}`)}
              className="mt-3 flex-row gap-3 rounded-[16px] bg-clay-tint px-4 py-3.5">
              <View className="mt-1.5 h-[7px] w-[7px] rounded-full bg-clay" />
              <Text variant="bodySm" tone="muted" className="flex-1">
                {reassure ? 'Pairs well with ' : 'Paired with '}
                <Text variant="bodySm" className="font-sans-semibold">
                  {otherName(c)}
                </Text>
                {'. '}
                {bannerSubhead(c)} <Text variant="bodySm" className="font-sans-bold text-clay-deep">Review →</Text>
              </Text>
            </Pressable>
          );
        })}

        {/* Where it's used */}
        {usage ? (
          <View className="mt-2.5 flex-row gap-3 rounded-[16px] border border-hairline bg-paper-raised px-4 py-3.5">
            <View className="mt-1.5 h-[7px] w-[7px] rounded-full bg-muted" />
            <Text variant="bodySm" tone="muted" className="flex-1">
              Used in your <Text variant="bodySm" className="font-sans-semibold">{usage.phase}</Text>
              {usage.night ? `. Cycling night ${usage.night}.` : '.'}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Lifecycle actions */}
      {archived ? (
        <Button
          label="Replace. Add a fresh one"
          onPress={async () => {
            await m.replace(id);
            router.replace('/shelf');
          }}
        />
      ) : (
        <View className="flex-row gap-2.5">
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/shelf/replenish?id=${id}`)}
            className="h-[50px] flex-1 items-center justify-center rounded-[14px] bg-ink">
            <Text className="font-sans-semibold text-paper">Replace</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={async () => {
              await m.markFinished(id);
              router.back();
            }}
            className="h-[50px] flex-1 items-center justify-center rounded-[14px] border border-hairline-strong bg-paper-raised">
            <Text className="font-sans-semibold" tone="muted">
              Mark finished
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove or discard"
            onPress={confirmRemove}
            className={cn(
              'h-[50px] w-[50px] items-center justify-center rounded-[14px] border border-hairline-strong bg-paper-raised',
            )}>
            {/* Text-presentation (U+FE0E) bin glyph so it stays monochrome + honours the clay tint. */}
            <Text className="text-[18px]" style={{ color: '#9A6A4B' }}>
              {'\u{1F5D1}\u{FE0E}'}
            </Text>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}
