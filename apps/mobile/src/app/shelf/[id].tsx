import { router, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, RouteIconButton, Screen, StripedThumb, Text } from '@/components/ui';
import { reportCatalogIssue, type CatalogCorrectionType } from '@/features/catalog/client';
import { conflictDetailRoute, conflictKey } from '@/features/intelligence/conflictIdentity';
import { choiceForConflict } from '@/features/intelligence/conflictChoices';
import {
  catalogQualityCopy,
  catalogQualityLabel,
  sourceDisplayName,
} from '@/features/catalog/copy';
import type { DetectedConflict } from '@/features/intelligence/engine';
import { bannerSubhead, tagLabel } from '@/features/intelligence/presentation';
import { expiryMonthLabel, surfacedExpiry } from '@/features/shelf/expiry';
import { paoSourceLabel } from '@/features/shelf/labels';
import { useShelfMutations } from '@/features/shelf/mutations';
import { useShelf } from '@/features/shelf/useShelf';
import { usePlan } from '@/features/routine/usePlan';
import { useCycle } from '@/features/scheduler/useCycle';
import { localDateString } from '@/features/today/useToday';
import { cn } from '@/lib/cn';
import { APP_SHELF_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

// Product detail. The management hub (design screen 06, docs/04 §5.6). Freshness
// with provenance, the actives it contributes, the conflicts it's part of, where
// it's used, and the full lifecycle actions. Claim-safe throughout.

const PROVENANCE: Record<string, string> = {
  barcode: 'barcode lookup',
  search: 'catalog search',
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

type RoutineUsage = { phase: string; cycleNightNumbers?: number[] };
type ProductDetailSheet = 'manage' | 'report' | null;
type CatalogReportFeedback = { title: string; message: string };

const CATALOG_REPORT_SENT: CatalogReportFeedback = {
  title: 'Report sent',
  message: 'Thanks. Open catalog issues block product-specific recommendations until reviewed.',
};

const CATALOG_REPORT_NOT_SENT: CatalogReportFeedback = {
  title: 'Report not sent',
  message:
    'The catalog backend is not configured on this build. You can still keep this product on your shelf.',
};

function MoreOptionsGlyph() {
  return (
    <View
      className="flex-row items-center gap-1"
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {[0, 1, 2].map((dot) => (
        <View key={dot} className="h-1 w-1 rounded-full" style={{ backgroundColor: colors.ink }} />
      ))}
    </View>
  );
}

function shiftMonthsISO(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return localDateString(d);
}
const monthsAgoISO = (m: number) => shiftMonthsISO(-m);

function RoutineUsageCard({ usage }: { usage: RoutineUsage | null }) {
  const placed = Boolean(usage);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={placed ? 'Review routine placement' : 'Build routine from shelf'}
      onPress={() => {
        haptics.select();
        router.push('/routine/plan');
      }}
      className="mt-2.5 min-h-[64px] flex-row gap-3 rounded-[16px] border border-hairline bg-paper-raised px-4 py-3.5"
    >
      <View className="mt-1.5 h-[7px] w-[7px] rounded-full bg-muted" />
      <View className="flex-1">
        <Text variant="label" tone="clay" className="font-mono uppercase">
          Routine role
        </Text>
        <Text variant="bodySm" tone="muted" className="mt-1">
          {usage ? (
            <>
              Used in your{' '}
              <Text variant="bodySm" className="font-sans-semibold">
                {usage.phase}
              </Text>
              {usage.cycleNightNumbers?.length
                ? `. Cycling night${
                    usage.cycleNightNumbers.length === 1 ? '' : 's'
                  } ${usage.cycleNightNumbers.join(', ')}.`
                : '.'}
            </>
          ) : (
            'Not placed in a routine yet.'
          )}
        </Text>
        <Text variant="bodySm" tone="clay" className="mt-1 font-sans-semibold">
          {usage
            ? 'Review the AM/PM plan before you check it off.'
            : 'Build an AM/PM draft from your shelf.'}
        </Text>
      </View>
    </Pressable>
  );
}

function ProductDetailActionSheet({
  title,
  body,
  viewportHeight,
  bottomInset,
  children,
  onClose,
}: {
  title: string;
  body: string;
  viewportHeight: number;
  bottomInset: number;
  children: ReactNode;
  onClose: () => void;
}) {
  const sheetMaxHeight = Math.max(0, viewportHeight - 44);
  const sheetPaddingBottom = bottomInset > 0 ? Math.max(32, bottomInset + 18) : 32;

  return (
    <View
      className="absolute inset-0 justify-end"
      style={{ backgroundColor: 'rgba(32,27,21,0.42)', zIndex: 30, elevation: 30 }}
      accessibilityLabel={title}
    >
      <View className="flex-1 justify-end">
        <Pressable
          accessibilityLabel={`Dismiss ${title}`}
          accessibilityRole="button"
          className="flex-1"
          onPress={onClose}
        />
        <View
          aria-modal
          role="dialog"
          accessibilityLabel={title}
          accessibilityViewIsModal
          className="overflow-hidden rounded-t-sheet bg-paper px-6 pt-4"
          style={{ maxHeight: sheetMaxHeight, paddingBottom: sheetPaddingBottom }}
        >
          <View
            className="mx-auto mb-4 h-[5px] w-10 rounded-[3px]"
            style={{ backgroundColor: 'rgba(32,27,21,0.15)' }}
          />
          <View className="mb-3 flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text variant="titleSm" className="text-[24px] leading-[28px]">
                {title}
              </Text>
              <Text variant="bodySm" tone="muted" className="mt-1.5">
                {body}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Close product options"
              accessibilityRole="button"
              className="min-h-[48px] min-w-[64px] items-center justify-center rounded-pill px-3"
              onPress={onClose}
            >
              <Text variant="bodySm" className="font-sans-semibold" style={{ color: colors.clay }}>
                Close
              </Text>
            </Pressable>
          </View>
          <View className="gap-2">{children}</View>
        </View>
      </View>
    </View>
  );
}

function SheetAction({
  label,
  description,
  tone = 'default',
  onPress,
}: {
  label: string;
  description: string;
  tone?: 'default' | 'destructive';
  onPress: () => void;
}) {
  const destructive = tone === 'destructive';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-[58px] rounded-[16px] border border-hairline bg-paper-raised px-4 py-3"
    >
      <Text
        variant="bodySm"
        className="font-sans-bold"
        style={{ color: destructive ? colors.clayDeep : colors.ink }}
      >
        {label}
      </Text>
      <Text variant="bodySm" tone="muted" className="mt-0.5">
        {description}
      </Text>
    </Pressable>
  );
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { data } = useShelf();
  const plan = usePlan();
  const { data: cycleData } = useCycle();
  const m = useShelfMutations();
  const [editOpen, setEditOpen] = useState(false);
  const [bestOpen, setBestOpen] = useState(false);
  const [activeSheet, setActiveSheet] = useState<ProductDetailSheet>(null);
  const [catalogReportFeedback, setCatalogReportFeedback] = useState<CatalogReportFeedback | null>(
    null,
  );
  const supportFloorTextPressureDetail = width <= 390 && height >= 640 && height < 700;
  const compactMissingDetail = height < 640 || supportFloorTextPressureDetail;

  const item = [...(data?.items ?? []), ...(data?.archive ?? [])].find((i) => i.id === id);
  const closeToShelf = () => backOrReplace(router, APP_SHELF_ROUTE);

  if (!item) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View className="mt-2 flex-row items-center">
          <RouteIconButton accessibilityLabel="Back" onPress={closeToShelf} />
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingBottom: compactMissingDetail ? 20 : 34,
          }}
        >
          <View className="items-center">
            <StripedThumb size={compactMissingDetail ? 68 : 76} radius={20} faded />
            <Text variant="label" tone="clay" className="mt-5 font-mono uppercase">
              Product unavailable
            </Text>
            <Text
              variant="titleSm"
              className="mt-2 text-center"
              style={{
                fontSize: compactMissingDetail ? 24 : 27,
                lineHeight: compactMissingDetail ? 28 : 31,
              }}
            >
              This product is no longer on your shelf.
            </Text>
            <Text variant="bodySm" tone="muted" className="mt-2 max-w-[280px] text-center">
              It may have been removed or archived on this device. Your Shelf is still safe.
            </Text>
          </View>
          <View className="mt-6 gap-2">
            <Button label="Back to Shelf" onPress={() => router.replace(APP_SHELF_ROUTE)} />
            <Button
              label="Add a product"
              variant="ghost"
              className="min-h-[52px] py-3"
              onPress={() => router.replace('/shelf/manual')}
            />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  const p = item.product;
  const archived = p.status !== 'active';
  const expiry = surfacedExpiry(p);
  const best = expiryMonthLabel(expiry);
  const provenance = p.catalogSource
    ? `data / ${sourceDisplayName(p.catalogSource)}`
    : (PROVENANCE[p.addedVia] ?? 'added by hand');
  const openedLabel = p.isOpened
    ? p.openedAt
      ? new Date(p.openedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : 'date not set'
    : 'not opened yet';

  const conflicts = (data?.conflicts ?? []).filter(
    (c) => c.productAId === id || c.productBId === id,
  );

  // Where it's used. From the live plan (skipped for the example fallback).
  let usage: RoutineUsage | null = null;
  if (plan.data && !plan.data.isExample) {
    const pm = plan.data.plan.pm.find((s) => s.productId === id);
    if (pm) {
      const cycleNightNumbers = cycleData?.cycle?.nights
        .filter((night) => night.productId === id)
        .map((night) => night.index + 1);
      usage = {
        phase: 'Evening routine',
        cycleNightNumbers: cycleNightNumbers?.length ? cycleNightNumbers : undefined,
      };
    } else if (plan.data.plan.am.find((s) => s.productId === id))
      usage = { phase: 'Morning routine' };
  }

  const otherName = (c: DetectedConflict) =>
    (c.productAId === id ? c.productBName : c.productAName) ?? 'another product';

  const setOpened = async (monthsAgo: number) => {
    await m.setOpened(id, { openedAt: monthsAgoISO(monthsAgo), isOpened: true });
    setEditOpen(false);
  };

  const confirmRemove = () => {
    setActiveSheet('manage');
  };

  const submitCatalogReport = async (correctionType: CatalogCorrectionType) => {
    setActiveSheet(null);
    const result = await reportCatalogIssue({
      correctionType,
      productId: p.catalogProductId,
      barcode: p.barcode,
      description: `${correctionType} reported from product detail`,
      proposedPayload: {
        productName: p.name,
        brand: p.brand,
        barcode: p.barcode,
        category: p.category,
        sourceName: catalogSourceLabel,
        sourceUrl: p.catalogSourceUrl,
        defaultPaoMonths:
          p.paoMonths != null && (p.paoSource === 'catalog' || p.paoSource === 'category_default')
            ? p.paoMonths
            : null,
        qualityIssue: correctionType,
      },
      clientContext: {
        addedVia: p.addedVia,
        quality: p.catalogMatchQuality,
        source: p.catalogSource,
        platform: Platform.OS,
        route: 'shelf_detail',
      },
    });
    setCatalogReportFeedback(result.ok ? CATALOG_REPORT_SENT : CATALOG_REPORT_NOT_SENT);
  };

  const reportIssue = () => {
    setCatalogReportFeedback(null);
    setActiveSheet('report');
  };

  const catalogSourceLabel =
    p.catalogSourceName ??
    sourceDisplayName(p.catalogSource ?? (p.addedVia === 'manual' ? 'user_local' : null));
  const qualityLabel = catalogQualityLabel(p.catalogMatchQuality);
  const sourceDate = p.catalogSourceSnapshotDate
    ? new Date(p.catalogSourceSnapshotDate).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="mt-2 flex-row items-center justify-between">
        <RouteIconButton accessibilityLabel="Back" onPress={closeToShelf} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="More options"
          onPress={confirmRemove}
          className="h-[48px] w-[48px] items-center justify-center rounded-full border border-hairline-strong bg-paper-raised"
        >
          <MoreOptionsGlyph />
        </Pressable>
      </View>

      <View className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-6"
        >
          {/* Header */}
          <View className="mt-2 flex-row items-center gap-4">
            <StripedThumb size={72} radius={18} faded={archived} />
            <View className="flex-1">
              <Text variant="titleSm" className="text-[25px] leading-[27px]">
                {p.name}
              </Text>
              {p.brand ? (
                <Text variant="bodySm" tone="muted" className="mt-0.5">
                  {p.brand}
                </Text>
              ) : null}
              <Text variant="label" className="mt-1" style={{ color: colors.mutedFaint }}>
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

          {/* Catalog source and quality disclosure (Phase 4). */}
          <View className="mt-4 rounded-[20px] border border-hairline bg-paper-raised px-[18px] py-3.5">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text variant="eyebrow" tone="clay">
                  Catalog
                </Text>
                <Text variant="bodySm" tone="muted" className="mt-1">
                  {catalogSourceLabel}
                  {sourceDate ? ` / updated ${sourceDate}` : ''}
                </Text>
              </View>
              <View className="rounded-pill bg-greige-chip px-3 py-1.5">
                <Text variant="label" tone="muted">
                  {qualityLabel}
                </Text>
              </View>
            </View>
            <Text variant="bodySm" tone="muted" className="mt-2">
              {catalogQualityCopy(p.catalogMatchQuality)}
            </Text>
            <View className="mt-3 gap-1.5">
              {p.barcode ? (
                <Text variant="label" tone="muted">
                  barcode {p.barcode}
                </Text>
              ) : null}
              {p.category ? (
                <Text variant="label" tone="muted">
                  category {p.category}
                </Text>
              ) : null}
              {p.ingredientParseStatus ? (
                <Text variant="label" tone="muted">
                  ingredients {p.ingredientParseStatus}
                  {p.ingredientParseConfidence != null
                    ? ` / ${Math.round(p.ingredientParseConfidence * 100)}% confidence`
                    : ''}
                </Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={reportIssue}
              className="mt-3 min-h-[48px] self-start items-center justify-center px-1"
            >
              <Text variant="bodySm" tone="clay" className="font-sans-semibold">
                Report an issue
              </Text>
            </Pressable>
            {catalogReportFeedback ? (
              <View className="mt-2.5 rounded-[14px] bg-clay-tint px-4 py-3">
                <Text variant="label" style={{ color: colors.clayDeep }}>
                  {catalogReportFeedback.title}
                </Text>
                <Text
                  accessibilityRole="alert"
                  variant="bodySm"
                  className="mt-1"
                  style={{ color: colors.clayDeep, lineHeight: 19 }}
                >
                  {catalogReportFeedback.message}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Freshness block */}
          <View className="mt-4 rounded-[20px] border border-hairline bg-paper-raised px-[18px]">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit opened date"
              onPress={() => {
                haptics.select();
                setEditOpen((o) => !o);
              }}
              className="min-h-[56px] flex-row items-center justify-between border-b border-hairline py-3"
            >
              <Text variant="bodySm" tone="muted">
                Opened
              </Text>
              <Text variant="bodySm" className="font-sans-semibold">
                {openedLabel}{' '}
                <Text variant="bodySm" tone="clay">
                  · edit
                </Text>
              </Text>
            </Pressable>
            {editOpen ? (
              <View className="flex-row flex-wrap gap-2 py-3">
                {RECENT_OPENS.map((o) => (
                  <Pressable
                    key={o.label}
                    accessibilityRole="button"
                    onPress={() => setOpened(o.monthsAgo)}
                    className="min-h-[48px] items-center justify-center rounded-pill border border-hairline bg-paper-raised px-3.5 py-2"
                  >
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Set printed best-before date"
                onPress={() => {
                  haptics.select();
                  setBestOpen((o) => !o);
                }}
                className="min-h-[56px] flex-row items-center justify-between"
              >
                <Text variant="bodySm" tone="muted">
                  {p.isOpened ? 'Best used by' : 'Shelf life'}
                </Text>
                <Text variant="bodySm" className="font-sans-bold text-clay-deep">
                  {best ?? 'estimated'}{' '}
                  <Text variant="bodySm" tone="clay">
                    · {p.expirySource === 'printed' ? 'edit' : 'set'}
                  </Text>
                </Text>
              </Pressable>
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
                      className="min-h-[48px] items-center justify-center rounded-pill border border-hairline bg-paper-raised px-3.5 py-2"
                    >
                      <Text className="font-sans-medium text-[13px]">{b.label}</Text>
                    </Pressable>
                  ))}
                  {p.expiryDate ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={async () => {
                        await m.edit(id, {
                          expiryDate: null,
                          expirySource:
                            p.isOpened && p.paoMonths != null ? 'pao_computed' : 'unknown',
                        });
                        setBestOpen(false);
                      }}
                      className="min-h-[48px] items-center justify-center rounded-pill px-3.5 py-2"
                    >
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
              className="mt-2.5 min-h-[48px] items-center justify-center rounded-[14px] border border-hairline bg-paper-raised py-3"
            >
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
                    className="rounded-pill border border-hairline bg-paper-raised px-3 py-1.5"
                  >
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
            const reassure =
              c.rule.interactionType === 'myth' || c.rule.interactionType === 'synergy';
            const savedChoice = data ? choiceForConflict(data.conflictChoices, c) : null;
            const resolved = savedChoice != null;
            const lead = reassure
              ? 'Pairs well with '
              : savedChoice === 'use_together'
                ? 'Your timing choice is saved with '
                : savedChoice === 'accept_suggested_timing'
                  ? 'Kept on separate timing with '
                  : 'Timing note with ';
            const detail =
              savedChoice === 'use_together'
                ? 'Guided check-offs stay on the reviewed one-active schedule.'
                : savedChoice === 'accept_suggested_timing'
                  ? 'Your guided schedule keeps this pairing apart.'
                  : bannerSubhead(c);
            return (
              <Pressable
                key={conflictKey(c)}
                accessibilityRole="button"
                onPress={() => router.push(conflictDetailRoute(c))}
                className={cn(
                  'mt-3 flex-row gap-3 rounded-[16px] px-4 py-3.5',
                  resolved ? 'bg-sage-tint' : 'bg-clay-tint',
                )}
              >
                <View
                  className={cn(
                    'mt-1.5 h-[7px] w-[7px] rounded-full',
                    resolved ? 'bg-sage' : 'bg-clay',
                  )}
                />
                <Text variant="bodySm" tone="muted" className="flex-1">
                  {lead}
                  <Text variant="bodySm" className="font-sans-semibold">
                    {otherName(c)}
                  </Text>
                  {'. '}
                  {detail}{' '}
                  <Text
                    variant="bodySm"
                    className={cn('font-sans-bold', resolved ? 'text-sage' : 'text-clay-deep')}
                  >
                    {resolved ? 'Change →' : 'Review →'}
                  </Text>
                </Text>
              </Pressable>
            );
          })}

          {/* Where it's used */}
          {!archived ? <RoutineUsageCard usage={usage} /> : null}
        </ScrollView>
      </View>

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
            className="h-[50px] flex-1 items-center justify-center rounded-[14px] bg-ink"
          >
            <Text className="font-sans-semibold text-paper">Replace</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={async () => {
              await m.markFinished(id);
              closeToShelf();
            }}
            className="h-[50px] flex-1 items-center justify-center rounded-[14px] border border-hairline-strong bg-paper-raised"
          >
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
            )}
          >
            {/* Text-presentation (U+FE0E) bin glyph so it stays monochrome + honours the clay tint. */}
            <Text className="text-[18px]" style={{ color: '#9A6A4B' }}>
              {'\u{1F5D1}\u{FE0E}'}
            </Text>
          </Pressable>
        </View>
      )}
      {activeSheet === 'manage' ? (
        <ProductDetailActionSheet
          title="Remove from shelf?"
          body={`Choose what should happen to ${p.name}. Discarding keeps your history; removing deletes this local shelf entry.`}
          viewportHeight={height}
          bottomInset={insets.bottom}
          onClose={() => setActiveSheet(null)}
        >
          <SheetAction
            label="Mark discarded"
            description="Archive it and keep freshness and repurchase history."
            onPress={async () => {
              await m.markDiscarded(id);
              setActiveSheet(null);
              closeToShelf();
            }}
          />
          <SheetAction
            label="Remove completely"
            description="Delete this local shelf entry. This cannot be undone."
            tone="destructive"
            onPress={async () => {
              await m.remove(id);
              setActiveSheet(null);
              closeToShelf();
            }}
          />
        </ProductDetailActionSheet>
      ) : null}
      {activeSheet === 'report' ? (
        <ProductDetailActionSheet
          title="Report catalog issue"
          body="Choose the closest issue. You can keep using this product while the catalog data is reviewed."
          viewportHeight={height}
          bottomInset={insets.bottom}
          onClose={() => setActiveSheet(null)}
        >
          <SheetAction
            label="Missing catalog product"
            description="This local shelf item should be added to the reviewed catalog."
            onPress={() => submitCatalogReport('missing_product')}
          />
          <SheetAction
            label="Wrong product match"
            description="The product, brand, or barcode does not match this shelf item."
            onPress={() => submitCatalogReport('wrong_match')}
          />
          <SheetAction
            label="Ingredient issue"
            description="The INCI list or active ingredient parsing looks wrong."
            onPress={() => submitCatalogReport('ingredient_issue')}
          />
          <SheetAction
            label="Expiry or PAO issue"
            description="The printed date, PAO, or freshness source looks wrong."
            onPress={() => submitCatalogReport('expiry_issue')}
          />
        </ProductDetailActionSheet>
      ) : null}
    </Screen>
  );
}
