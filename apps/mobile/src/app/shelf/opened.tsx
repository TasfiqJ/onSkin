import type { PaoSource } from '@onskin/types';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, RouteIconButton, Sheet, Text } from '@/components/ui';
import { trackProductAddStarted } from '@/features/shelf/analytics';
import { useIntake } from '@/features/shelf/IntakeContext';
import { paoSourceLabel } from '@/features/shelf/labels';
import { useShelfMutations } from '@/features/shelf/mutations';
import { editedPaoSource } from '@/features/shelf/paoProvenance';
import { localDateString } from '@/features/today/useToday';
import { cn } from '@/lib/cn';
import { APP_SHELF_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';

// The opened-date linchpin (design screen 04, docs/04 §4.5). Every intake path
// converges here. Without an opened-date there is no PAO clock. Calm, skippable,
// with an explicit "not opened yet" state and an editable, source-labelled PAO.
type Mode = 'just' | 'pick' | 'unopened';

const PAO_OPTIONS = [3, 6, 9, 12, 18, 24];

function monthsAgoISO(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return localDateString(d);
}

const PICK_OPTIONS: { label: string; iso: string }[] = [
  {
    label: '2 weeks ago',
    iso: (() => {
      const d = new Date();
      d.setDate(d.getDate() - 14);
      return localDateString(d);
    })(),
  },
  { label: '1 month ago', iso: monthsAgoISO(1) },
  { label: '3 months ago', iso: monthsAgoISO(3) },
  { label: '6 months ago', iso: monthsAgoISO(6) },
];

function OptionRow({
  title,
  subtitle,
  selected,
  onPress,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={() => {
        haptics.select();
        onPress();
      }}
      className={cn(
        'flex-row items-center gap-3.5 rounded-[18px] bg-paper-raised p-4',
        selected ? 'border-2 border-clay' : 'border border-hairline',
      )}
    >
      <View
        className={cn(
          'h-[22px] w-[22px] items-center justify-center rounded-full',
          selected ? 'bg-clay' : 'border-[1.5px] border-hairline-strong',
        )}
      >
        {selected ? <Text className="text-[11px] text-paper">✓</Text> : null}
      </View>
      <View className="flex-1">
        <Text variant="body" className="font-sans-semibold">
          {title}
        </Text>
        <Text variant="bodySm" tone="muted">
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

export default function OpenedDateScreen() {
  const { draft, reset } = useIntake();
  const m = useShelfMutations();
  const [mode, setMode] = useState<Mode>('just');
  const [pickIso, setPickIso] = useState<string | null>(null);
  const [pao, setPao] = useState<number | null>(draft.paoMonths);
  const [paoSource, setPaoSource] = useState<PaoSource>(draft.paoSource);
  const [paoEditOpen, setPaoEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const hasProductDraft =
    draft.name.trim().length > 0 || draft.catalogProductId != null || draft.barcode != null;
  const canSave = mode !== 'pick' || pickIso != null;

  const onSave = async () => {
    const productName = draft.name.trim();
    if (!hasProductDraft || !productName || !canSave || saving) return;
    setSaving(true);
    const today = localDateString();
    const openedAt = mode === 'just' ? today : mode === 'pick' ? pickIso : null;
    const isOpened = mode !== 'unopened';
    await m.add({
      name: productName,
      brand: draft.brand,
      category: draft.category,
      barcode: draft.barcode,
      catalogProductId: draft.catalogProductId,
      catalogSourceId: draft.catalogSourceId,
      catalogSource: draft.catalogSource,
      catalogSourceName: draft.catalogSourceName,
      catalogSourceRef: draft.catalogSourceRef,
      catalogSourceUrl: draft.catalogSourceUrl,
      catalogSourceSnapshotDate: draft.catalogSourceSnapshotDate,
      catalogMatchQuality: draft.catalogMatchQuality,
      dataQualityScore: draft.dataQualityScore,
      ingredientParseStatus: draft.ingredientParseStatus,
      ingredientParseConfidence: draft.ingredientParseConfidence,
      parserVersion: draft.parserVersion,
      sourceDisclosureAckAt: draft.sourceDisclosureAckAt,
      ingredients: draft.ingredients,
      openedAt,
      isOpened,
      paoMonths: pao,
      paoSource,
      expiryDate: draft.expiryDate,
      expirySource: draft.expiryDate
        ? 'printed'
        : isOpened && pao != null
          ? 'pao_computed'
          : isOpened
            ? 'unknown'
            : 'estimated',
      addedVia: draft.addedVia,
    });
    reset();
    router.replace('/shelf');
  };

  if (!hasProductDraft) {
    return (
      <Sheet fallbackRoute={APP_SHELF_ROUTE} backdropAccessible={false}>
        <View className="mb-3 flex-row items-start justify-between">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-clay-tint">
            <Text className="text-[18px] text-clay">+</Text>
          </View>
          <RouteIconButton
            accessibilityLabel="Close"
            glyph="x"
            onPress={() => backOrReplace(router, APP_SHELF_ROUTE)}
          />
        </View>
        <Text
          variant="title"
          className="text-[28px] leading-[31px]"
          accessibilityRole="header"
        >
          Add product details first.
        </Text>
        <Text variant="bodySm" tone="muted" className="mt-1.5 text-[13px] leading-[18px]">
          Freshness starts after we know the product. Start with the name, then we&apos;ll ask when
          you opened it.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add product by hand"
          className="mt-4 min-h-[48px] items-center justify-center rounded-pill bg-ink px-5 py-2"
          onPress={() => {
            haptics.select();
            trackProductAddStarted('opened_recovery');
            router.replace('/shelf/manual');
          }}
        >
          <Text className="font-sans-semibold" tone="inverse">
            Add by hand
          </Text>
        </Pressable>
      </Sheet>
    );
  }

  return (
    <Sheet fallbackRoute={APP_SHELF_ROUTE} scroll backdropAccessible={false}>
      <View className="mb-4 flex-row items-start justify-between">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-clay-tint">
          <Text className="text-[18px] text-clay">◴</Text>
        </View>
        <RouteIconButton
          accessibilityLabel="Close"
          glyph="x"
          onPress={() => backOrReplace(router, APP_SHELF_ROUTE)}
        />
      </View>
      <Text variant="title" className="text-[33px] leading-[34px]" accessibilityRole="header">
        When did you open it?
      </Text>
      <Text variant="body" tone="muted" className="mt-2">
        This starts the freshness clock. Not sure? We&apos;ll estimate from when you added it.
      </Text>

      <View className="mt-6 gap-2.5">
        <OptionRow
          title="Just opened it"
          subtitle="Clock starts today"
          selected={mode === 'just'}
          onPress={() => setMode('just')}
        />
        <OptionRow
          title="Pick a date"
          subtitle={
            pickIso
              ? (PICK_OPTIONS.find((o) => o.iso === pickIso)?.label ?? 'Earlier')
              : 'I opened it earlier'
          }
          selected={mode === 'pick'}
          onPress={() => setMode('pick')}
        />
        {mode === 'pick' ? (
          <View className="flex-row flex-wrap gap-2 px-1">
            {PICK_OPTIONS.map((o) => (
              <Pressable
                key={o.iso}
                accessibilityRole="button"
                onPress={() => {
                  haptics.select();
                  setPickIso(o.iso);
                }}
                className={cn(
                  'min-h-[48px] items-center justify-center rounded-pill px-3.5 py-2',
                  pickIso === o.iso ? 'bg-clay' : 'border border-hairline bg-paper-raised',
                )}
              >
                <Text
                  className="font-sans-medium text-[13px]"
                  tone={pickIso === o.iso ? 'inverse' : 'ink'}
                >
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <OptionRow
          title="Not opened yet"
          subtitle="No clock. We'll show shelf life"
          selected={mode === 'unopened'}
          onPress={() => setMode('unopened')}
        />
      </View>

      {/* Editable, source-labelled PAO row (docs/04 §4.5). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Edit period after opening"
        onPress={() => {
          haptics.select();
          setPaoEditOpen((o) => !o);
        }}
        className="mt-5 flex-row items-center justify-between rounded-[16px] bg-greige-chip px-4 py-3.5"
      >
        <View>
          <Text variant="body" className="font-sans-semibold">
            {pao != null ? `Lasts ~${pao} months opened` : 'PAO not set'}
          </Text>
          <Text variant="label" tone="muted" className="mt-0.5">
            {pao != null ? `${paoSourceLabel(paoSource)} · tap to change` : 'tap to set'}
          </Text>
        </View>
        <Text tone="clay">✎</Text>
      </Pressable>

      {paoEditOpen ? (
        <View className="mt-2.5 flex-row flex-wrap gap-2">
          {PAO_OPTIONS.map((n) => (
            <Pressable
              key={n}
              accessibilityRole="button"
              onPress={() => {
                haptics.select();
                setPao(n);
                setPaoSource(
                  editedPaoSource({
                    currentMonths: draft.paoMonths,
                    currentSource: draft.paoSource,
                    nextMonths: n,
                  }),
                );
                setPaoEditOpen(false);
              }}
              className={cn(
                'min-h-[48px] items-center justify-center rounded-pill px-4 py-2',
                pao === n ? 'bg-clay' : 'border border-hairline bg-paper-raised',
              )}
            >
              <Text className="font-sans-medium text-[13px]" tone={pao === n ? 'inverse' : 'ink'}>
                {n} mo
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Button
        className="mt-6"
        label="Add to shelf"
        disabled={!canSave || saving}
        onPress={onSave}
      />
    </Sheet>
  );
}
