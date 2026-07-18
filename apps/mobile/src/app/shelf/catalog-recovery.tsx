import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { Button, RouteIconButton, Screen, Text } from '@/components/ui';
import { catalogQualityLabel } from '@/features/catalog/copy';
import {
  catalogRecoveryIntakePatch,
  catalogRecoveryShelfFields,
  revalidateCatalogRecovery,
  type CatalogRecoveryRevalidation,
} from '@/features/shelf/catalogLookupRecovery';
import { categoryLabel } from '@/features/shelf/categories';
import { useIntake } from '@/features/shelf/IntakeContext';
import { useShelfMutations } from '@/features/shelf/mutations';
import { useShelf } from '@/features/shelf/useShelf';
import { APP_SHELF_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import {
  acceptReadyCatalogLookup,
  readReadyCatalogLookups,
  rejectReadyCatalogLookup,
  type ReadyCatalogLookup,
} from '@/lib/offline/catalogLookupQueue';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

type Feedback = { kind: 'error' | 'partial'; message: string } | null;

function scalar(value: string | string[] | undefined): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function revalidationMessage(result: Exclude<CatalogRecoveryRevalidation, { status: 'eligible' }>) {
  switch (result.status) {
    case 'gone':
      return 'The catalog no longer returns this product. Nothing on your Shelf changed.';
    case 'changed':
      return 'This catalog match changed or is no longer eligible. Nothing on your Shelf changed.';
    default:
      return "Couldn't verify this match. Nothing on your Shelf changed. Try again online.";
  }
}

function RecoveryLoading() {
  return (
    <Screen edges={['top', 'bottom']}>
      <View className="mt-2 flex-row items-center justify-between">
        <RouteIconButton
          accessibilityLabel="Back to Shelf"
          onPress={() => backOrReplace(router, APP_SHELF_ROUTE)}
        />
        <Text variant="body" className="font-sans-semibold">
          Review catalog match
        </Text>
        <View className="w-12" />
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Loading saved catalog match"
        accessibilityState={{ busy: true }}
        className="flex-1 items-center justify-center gap-3"
      >
        <ActivityIndicator />
        <Text variant="bodySm" tone="muted">
          Loading saved match...
        </Text>
      </View>
    </Screen>
  );
}

function MissingRecovery({ retry }: { retry?: () => void }) {
  return (
    <Screen edges={['top', 'bottom']}>
      <View className="mt-2 flex-row items-center justify-between">
        <RouteIconButton
          accessibilityLabel="Back to Shelf"
          onPress={() => backOrReplace(router, APP_SHELF_ROUTE)}
        />
        <View className="w-12" />
      </View>
      <View accessibilityRole="alert" className="flex-1 items-center justify-center px-4">
        <Text variant="titleSm" accessibilityRole="header" className="text-center">
          Match unavailable
        </Text>
        <Text variant="bodySm" tone="muted" className="mt-2 text-center">
          This saved catalog match may have expired or already been reviewed. Your Shelf is
          unchanged.
        </Text>
        {retry ? <Button label="Try loading again" className="mt-5" onPress={retry} /> : null}
        <Button
          label="Back to Shelf"
          variant={retry ? 'ghost' : 'primary'}
          className="mt-3"
          onPress={() => router.replace(APP_SHELF_ROUTE)}
        />
      </View>
    </Screen>
  );
}

function queuedMatch(
  values: ReadyCatalogLookup[] | undefined,
  barcode: string | null,
  productId: string | null,
): ReadyCatalogLookup | null {
  if (!barcode || !productId) return null;
  return (
    values?.find((value) => value.barcode === barcode && value.candidate.productId === productId) ??
    null
  );
}

export default function CatalogRecoveryScreen() {
  const params = useLocalSearchParams<{
    barcode?: string | string[];
    productId?: string | string[];
  }>();
  const barcode = scalar(params.barcode);
  const productId = scalar(params.productId);
  const queue = useQuery({
    queryKey: ['catalog-lookup-ready'],
    queryFn: () => readReadyCatalogLookups(),
    retry: false,
  });
  const shelf = useShelf();
  const mutations = useShelfMutations();
  const { reset } = useIntake();
  const queryClient = useQueryClient();
  const [useCatalogIdentity, setUseCatalogIdentity] = useState(false);
  const [busy, setBusy] = useState<'apply' | 'reject' | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  if (queue.isLoading || shelf.isLoading) return <RecoveryLoading />;
  if (queue.isError) return <MissingRecovery retry={() => void queue.refetch()} />;

  const ready = queuedMatch(queue.data, barcode, productId);
  if (!ready) return <MissingRecovery />;

  const shelfItems = [...(shelf.data?.items ?? []), ...(shelf.data?.archive ?? [])];
  const linkedItem = ready.shelfProductId
    ? (shelfItems.find((item) => item.id === ready.shelfProductId) ?? null)
    : null;
  const linkedProduct = linkedItem?.product ?? null;
  const linkedArchived = linkedProduct !== null && linkedProduct.status !== 'active';

  const verifyStillQueued = async (): Promise<ReadyCatalogLookup | null> => {
    const latest = await readReadyCatalogLookups();
    return queuedMatch(latest, ready.barcode, ready.candidate.productId);
  };

  const startUnlinkedIntake = async () => {
    if (busy) return;
    haptics.select();
    setBusy('apply');
    setFeedback(null);
    try {
      const revalidated = await revalidateCatalogRecovery(ready);
      if (revalidated.status !== 'eligible') {
        setFeedback({ kind: 'error', message: revalidationMessage(revalidated) });
        return;
      }
      const stillQueued = await verifyStillQueued();
      if (!stillQueued || stillQueued.shelfProductId !== null) {
        setFeedback({
          kind: 'error',
          message:
            'This saved match changed while you were reviewing it. Nothing was added or changed.',
        });
        return;
      }
      const token = { barcode: ready.barcode, productId: ready.candidate.productId };
      reset(catalogRecoveryIntakePatch(revalidated.product, token));
      router.push('/shelf/opened');
    } catch {
      setFeedback({
        kind: 'error',
        message: "Couldn't prepare this product. The saved match is still here. Try again.",
      });
    } finally {
      setBusy(null);
    }
  };

  const applyLinkedMatch = async () => {
    if (!linkedProduct || linkedArchived || busy) return;
    haptics.select();
    setBusy('apply');
    setFeedback(null);
    try {
      const revalidated = await revalidateCatalogRecovery(ready);
      if (revalidated.status !== 'eligible') {
        setFeedback({ kind: 'error', message: revalidationMessage(revalidated) });
        return;
      }
      const stillQueued = await verifyStillQueued();
      if (!stillQueued || stillQueued.shelfProductId !== linkedProduct.id) {
        setFeedback({
          kind: 'error',
          message: 'This saved match changed while you were reviewing it. Nothing was applied.',
        });
        return;
      }

      const result = await mutations.applyCatalogRecovery({
        id: linkedProduct.id,
        expectedUpdatedAt: linkedProduct.updatedAt,
        useCatalogIdentity,
        ...catalogRecoveryShelfFields(revalidated.product),
      });
      if (result.status !== 'updated') {
        setFeedback({
          kind: 'error',
          message:
            result.status === 'stale'
              ? 'This Shelf item changed while you were reviewing it. The catalog match was not applied.'
              : 'This Shelf item is no longer available. The catalog match was not applied.',
        });
        await shelf.refetch();
        return;
      }

      try {
        const accepted = await acceptReadyCatalogLookup({
          barcode: ready.barcode,
          productId: ready.candidate.productId,
          expectedShelfProductId: linkedProduct.id,
        });
        if (!accepted) {
          setFeedback({
            kind: 'partial',
            message:
              'Catalog details were saved, but this review changed before it could be cleared. The current match remains available.',
          });
          await queue.refetch();
          return;
        }
      } catch {
        setFeedback({
          kind: 'partial',
          message:
            "Catalog details were saved, but the review couldn't be cleared. The match remains available so you can try again.",
        });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['catalog-lookup-ready'] });
      router.replace(APP_SHELF_ROUTE);
    } catch {
      setFeedback({
        kind: 'partial',
        message:
          "Couldn't finish applying this match. It remains saved; review your current Shelf details before trying again.",
      });
    } finally {
      setBusy(null);
    }
  };

  const rejectMatch = async () => {
    if (busy) return;
    haptics.select();
    setBusy('reject');
    setFeedback(null);
    try {
      const rejected = await rejectReadyCatalogLookup({
        barcode: ready.barcode,
        productId: ready.candidate.productId,
        expectedShelfProductId: ready.shelfProductId,
      });
      if (!rejected) {
        setFeedback({
          kind: 'error',
          message:
            'This saved match changed while you were dismissing it. It was not removed; review the current match before trying again.',
        });
        await queue.refetch();
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['catalog-lookup-ready'] });
      router.replace(APP_SHELF_ROUTE);
    } catch {
      setFeedback({
        kind: 'error',
        message: "Couldn't dismiss this match. It remains saved for another try.",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="mt-2 flex-row items-center justify-between">
        <RouteIconButton
          accessibilityLabel="Back to Shelf"
          onPress={() => backOrReplace(router, APP_SHELF_ROUTE)}
        />
        <Text variant="body" className="font-sans-semibold">
          Review catalog match
        </Text>
        <View className="w-12" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-24">
        <Text
          variant="title"
          accessibilityRole="header"
          className="mt-4 text-[31px] leading-[34px]"
        >
          Compare before saving
        </Text>
        <Text variant="body" tone="muted" className="mt-2">
          We check the first-party catalog again when you confirm. Going back keeps this match for
          later.
        </Text>

        <View
          className="mt-5 rounded-[18px] bg-sage-tint p-4"
          style={{ borderWidth: 1, borderColor: colors.sageMuted }}
        >
          <Text variant="label" tone="muted" className="font-mono uppercase">
            Reviewed catalog candidate
          </Text>
          <Text variant="titleSm" className="mt-1">
            {ready.candidate.name}
          </Text>
          <Text variant="bodySm" tone="muted" className="mt-1">
            Brand: {ready.candidate.brand ?? 'Not listed'}
          </Text>
          <Text variant="bodySm" tone="muted">
            Category: {categoryLabel(ready.candidate.category) ?? 'Not listed'}
          </Text>
          <Text variant="bodySm" tone="muted">
            Source: {ready.candidate.sourceDisplayName ?? ready.candidate.sourceKey} ·{' '}
            {catalogQualityLabel(ready.candidate.qualityGrade)}
          </Text>
          <Text variant="bodySm" tone="muted" className="mt-2">
            Ingredients and freshness are not taken from this saved candidate.
          </Text>
        </View>

        {linkedProduct ? (
          <View className="mt-3 rounded-[18px] border border-hairline bg-paper-raised p-4">
            <Text variant="label" tone="muted" className="font-mono uppercase">
              Currently on your Shelf
            </Text>
            <Text variant="titleSm" className="mt-1">
              {linkedProduct.name}
            </Text>
            <Text variant="bodySm" tone="muted" className="mt-1">
              Brand: {linkedProduct.brand ?? 'Not entered'}
            </Text>
            <Text variant="bodySm" tone="muted">
              Category: {categoryLabel(linkedProduct.category) ?? 'Not entered'}
            </Text>
            <Text variant="bodySm" tone="muted">
              Ingredients: {linkedProduct.ingredients.length} saved ·{' '}
              {linkedProduct.isOpened
                ? linkedProduct.openedAt
                  ? `opened ${linkedProduct.openedAt}`
                  : 'opened date unknown'
                : 'not opened'}
            </Text>
            <Text variant="bodySm" tone="muted">
              Freshness:{' '}
              {linkedProduct.paoMonths ? `${linkedProduct.paoMonths} month PAO` : 'no PAO'}
              {linkedProduct.expiryDate ? ` · printed date ${linkedProduct.expiryDate}` : ''}
            </Text>
          </View>
        ) : (
          <View className="mt-3 rounded-[18px] border border-hairline bg-paper-raised p-4">
            <Text variant="body" className="font-sans-semibold">
              No Shelf item is linked
            </Text>
            <Text variant="bodySm" tone="muted" className="mt-1">
              You can start a new product intake. The match stays saved if you cancel or saving
              fails.
            </Text>
          </View>
        )}

        {linkedProduct && !linkedArchived ? (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel="Use catalog name, brand, and category"
            accessibilityHint="Ingredients, opened date, PAO, and printed expiry will stay unchanged"
            accessibilityState={{
              checked: useCatalogIdentity,
              disabled: busy !== null,
              busy: busy === 'apply',
            }}
            disabled={busy !== null}
            onPress={() => {
              haptics.select();
              setUseCatalogIdentity((value) => !value);
            }}
            className="mt-4 min-h-[56px] flex-row items-center gap-3 rounded-[16px] border border-hairline bg-paper-raised px-4 py-3"
          >
            <View
              className="h-[22px] w-[22px] items-center justify-center rounded-[6px]"
              style={{
                borderWidth: 1.5,
                borderColor: useCatalogIdentity ? colors.clay : colors.hairlineStrong,
                backgroundColor: useCatalogIdentity ? colors.clay : 'transparent',
              }}
            >
              {useCatalogIdentity ? <Text tone="inverse">✓</Text> : null}
            </View>
            <View className="flex-1">
              <Text variant="bodySm" className="font-sans-semibold">
                Use catalog name, brand, and category
              </Text>
              <Text variant="label" tone="muted" className="mt-0.5">
                Ingredients and freshness always stay as entered
              </Text>
            </View>
          </Pressable>
        ) : null}

        {linkedArchived ? (
          <View accessibilityRole="alert" className="mt-4 rounded-[14px] bg-clay-tint p-4">
            <Text variant="bodySm" tone="clay">
              This linked product is archived, so the match cannot be applied. You can dismiss it
              below.
            </Text>
          </View>
        ) : null}

        {feedback ? (
          <View accessibilityRole="alert" className="mt-4 rounded-[14px] bg-clay-tint p-4">
            <Text variant="bodySm" tone="clay">
              {feedback.message}
            </Text>
          </View>
        ) : null}

        {!linkedArchived ? (
          <Button
            label={
              busy === 'apply'
                ? 'Checking catalog...'
                : linkedProduct
                  ? 'Confirm catalog match'
                  : 'Add as a new product'
            }
            disabled={busy !== null}
            accessibilityState={{ disabled: busy !== null, busy: busy === 'apply' }}
            className="mt-5 min-h-[52px] py-3"
            onPress={() => void (linkedProduct ? applyLinkedMatch() : startUnlinkedIntake())}
          />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss this catalog match"
          accessibilityState={{ disabled: busy !== null, busy: busy === 'reject' }}
          disabled={busy !== null}
          onPress={() => void rejectMatch()}
          className="mt-2 min-h-[48px] items-center justify-center rounded-pill px-4 py-2"
        >
          <Text variant="bodySm" tone="muted" className="font-sans-semibold">
            {busy === 'reject' ? 'Dismissing...' : 'Not a match'}
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
