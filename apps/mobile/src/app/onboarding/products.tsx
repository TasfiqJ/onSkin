import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Chip, Screen, Text } from '@/components/ui';
import { reviewedCategoryPao } from '@/features/intelligence/pao';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import { ONBOARDING_PRODUCT_CATEGORIES } from '@/features/onboarding/productCategories';
import { trackProductAddStarted } from '@/features/shelf/analytics';
import type { ProductCategory } from '@/features/shelf/categories';
import { useIntake } from '@/features/shelf/IntakeContext';
import { useShelfMutations } from '@/features/shelf/mutations';
import { ShelfDataAvailabilityGate } from '@/features/shelf/ShelfDataAvailabilityGate';
import { useShelf } from '@/features/shelf/useShelf';
import {
  motionAllowed,
  useReduceMotionPreference,
} from '@/lib/accessibility/useReduceMotionPreference';
import { pseudoLocalizeString } from '@/lib/accessibility/pseudoLocalization';
import { track } from '@/lib/analytics/track';
import { colors } from '@/theme/tokens';

const ONBOARDING_PRODUCT_TARGET = 3;

function CategoryPickerSheet({
  visible,
  selectedCategory,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedCategory: ProductCategory | null;
  onSelect: (category: ProductCategory | null) => void;
  onClose: () => void;
}) {
  const { height: viewportHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sheetMaxHeight = Math.max(0, viewportHeight - 52);
  const sheetPaddingBottom = insets.bottom > 0 ? Math.max(40, insets.bottom + 24) : undefined;

  if (!visible) return null;

  return (
    <View
      className="absolute inset-0 justify-end"
      style={{ backgroundColor: 'rgba(32,27,21,0.4)', zIndex: 20, elevation: 20 }}
    >
      <View className="flex-1 justify-end">
        <Pressable
          className="flex-1"
          accessibilityLabel="Dismiss category picker"
          accessibilityRole="button"
          onPress={onClose}
        />
        <View
          aria-modal
          role="dialog"
          accessibilityLabel="Choose product category"
          accessibilityViewIsModal
          className="overflow-hidden rounded-t-sheet bg-paper px-6 pb-10 pt-4"
          style={
            sheetPaddingBottom === undefined
              ? { height: sheetMaxHeight, maxHeight: sheetMaxHeight }
              : {
                  height: sheetMaxHeight,
                  maxHeight: sheetMaxHeight,
                  paddingBottom: sheetPaddingBottom,
                }
          }
        >
          <View
            className="mx-auto mb-4 h-[5px] w-10 rounded-[3px]"
            style={{ backgroundColor: 'rgba(32,27,21,0.15)' }}
          />
          <View className="mb-4 flex-row items-center justify-between gap-3">
            <Text variant="titleSm" className="flex-1">
              Product category
            </Text>
            <Pressable
              accessibilityLabel="Close category picker"
              accessibilityRole="button"
              className="min-h-[48px] min-w-[64px] items-center justify-center rounded-pill px-3"
              onPress={onClose}
            >
              <Text variant="bodySm" className="font-sans-semibold" style={{ color: colors.clay }}>
                Close
              </Text>
            </Pressable>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ flexShrink: 1 }}
            contentContainerClassName="pb-6"
            keyboardShouldPersistTaps="handled"
          >
            <View className="flex-row flex-wrap gap-2">
              {ONBOARDING_PRODUCT_CATEGORIES.map((c) => (
                <Chip
                  key={c.id}
                  label={c.label}
                  selected={selectedCategory === c.id}
                  className="px-4"
                  onPress={() => onSelect(selectedCategory === c.id ? null : c.id)}
                />
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

// 06 · Current products intake (docs/01 §2 step 6, docs/04 §4.7). Seeds the shelf with
// addedVia:'onboarding' so the reveal and the first routine/conflict pass are built
// from the user's REAL products (the conflict engine tags off the name). Skip stays
// visible. The full barcode/OCR intake lives on the Shelf (docs/04); this is the
// lightweight first-population that was previously a dead skip-only screen.
export default function ProductsScreen() {
  const { addedProductId } = useLocalSearchParams<{ addedProductId?: string }>();

  return (
    <ShelfDataAvailabilityGate
      onExit={() => router.replace('/onboarding/goals')}
      exitLabel="Back to goals"
    >
      <ProductsScreenContent key={addedProductId ?? 'initial-add'} />
    </ShelfDataAvailabilityGate>
  );
}

function ProductsScreenContent() {
  const reduceMotion = useReduceMotionPreference();
  const { fontScale = 1, height, width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const { goals } = useOnboarding();
  const { reset: resetIntake } = useIntake();
  const { data } = useShelf();
  const m = useShelfMutations();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProductCategory | null>(null);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeFailed, setRemoveFailed] = useState(false);
  const added = data?.items ?? [];
  const supportFloorTextPressurePhone =
    width <= 430 && height >= 640 && height < 700 && (fontScale >= 1.3 || Platform.OS === 'web');
  const modernTextPressurePhone =
    width <= 390 && height >= 800 && height < 900 && (fontScale >= 1.3 || Platform.OS === 'web');
  const splitShortPhone = height < 460;
  const compactPhone =
    height < 640 || supportFloorTextPressurePhone || modernTextPressurePhone || splitShortPhone;
  const showIntroCopy = !modernTextPressurePhone && !splitShortPhone;
  const showProgressBody = !modernTextPressurePhone && !splitShortPhone;
  const compactFooterAdds = compactPhone && name.trim().length > 0;
  const showCompactCategoryFooter = compactFooterAdds;
  const remainingToTarget = Math.max(ONBOARDING_PRODUCT_TARGET - added.length, 0);
  const hasTargetProducts = remainingToTarget === 0;
  const showContinueAnyway = added.length > 0 && !hasTargetProducts && !compactFooterAdds;
  const productsBottomPaddingClass =
    splitShortPhone && showContinueAnyway && added.length === 1
      ? 'pb-44'
      : showContinueAnyway
        ? 'pb-36'
        : 'pb-28';
  const remainingProductNoun = remainingToTarget === 1 ? 'product' : 'products';
  const continueAnywayLabel = `Continue with ${added.length} ${
    added.length === 1 ? 'product' : 'products'
  }`;
  const footerPrimaryLabel = compactFooterAdds
    ? 'Add to shelf'
    : hasTargetProducts
      ? 'Continue'
      : added.length > 0
        ? `Add ${remainingToTarget} more`
        : 'Skip for now';
  const progressBody = hasTargetProducts
    ? 'Good. That is enough for a stronger first routine, and you can still add more later.'
    : added.length > 0
      ? `${remainingToTarget} more ${remainingProductNoun} gives your first insight more to work with.`
      : 'Three products gives your first routine enough context to spot useful gaps or timing notes.';
  const selectedCategoryLabel =
    ONBOARDING_PRODUCT_CATEGORIES.find((c) => c.id === category)?.label ?? null;

  useEffect(() => {
    trackProductAddStarted('onboarding');
  }, []);

  function focusNextProduct() {
    scrollRef.current?.scrollTo({ y: 0, animated: motionAllowed(reduceMotion) });
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function selectCategory(nextCategory: ProductCategory | null) {
    setCategory(nextCategory);
    setCategoryPickerOpen(false);
  }

  function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const pao = category ? reviewedCategoryPao(category) : null;
    resetIntake({
      name: trimmed,
      category,
      addedVia: 'onboarding',
      catalogSource: 'user_local',
      catalogMatchQuality: 'manual',
      paoMonths: pao,
      paoSource: pao != null ? 'category_default' : 'unknown',
    });
    setCategoryPickerOpen(false);
    router.push({ pathname: '/shelf/opened', params: { origin: 'onboarding' } });
  }

  function go() {
    if (goals.length === 0) {
      router.replace('/onboarding/goals');
      return;
    }
    track('screen_viewed', { screen_name: 'products_intake', count: added.length });
    router.push('/onboarding/analyzing');
  }

  async function removeProduct(id: string): Promise<void> {
    if (removingId) return;
    setRemovingId(id);
    setRemoveFailed(false);
    try {
      await m.remove(id);
    } catch {
      setRemoveFailed(true);
    } finally {
      setRemovingId(null);
    }
  }

  function footerAction() {
    if (compactFooterAdds) {
      add();
      return;
    }
    if (added.length === 0 || hasTargetProducts) {
      go();
      return;
    }
    focusNextProduct();
  }

  return (
    <Screen>
      <View
        className="flex-1 overflow-hidden"
        aria-hidden={categoryPickerOpen || undefined}
        accessibilityElementsHidden={categoryPickerOpen}
        importantForAccessibility={categoryPickerOpen ? 'no-hide-descendants' : 'auto'}
        style={{ minHeight: 0 }}
      >
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerClassName={productsBottomPaddingClass}
        >
          <Text
            variant="title"
            className={splitShortPhone ? 'mt-3' : compactPhone ? 'mt-4' : 'mt-6'}
            style={splitShortPhone ? { fontSize: 27, lineHeight: 30 } : undefined}
          >
            What&apos;s on your shelf?
          </Text>
          {showIntroCopy ? (
            <Text variant="body" tone="muted" className={compactPhone ? 'mt-2' : 'mt-3'}>
              Add the products you already use so we build around them. Even just the name helps us
              spot conflicts. You can add more anytime from your Shelf.
            </Text>
          ) : null}
          <View
            className={
              splitShortPhone
                ? 'mt-3 rounded-2xl bg-greige-chip px-4 py-2.5'
                : compactPhone
                  ? 'mt-3 rounded-2xl bg-greige-chip px-4 py-3'
                  : 'mt-4 rounded-2xl bg-greige-chip px-4 py-3'
            }
            style={{ borderWidth: 1, borderColor: colors.hairline }}
          >
            <Text variant="label" tone="clay">
              {Math.min(added.length, ONBOARDING_PRODUCT_TARGET)} OF {ONBOARDING_PRODUCT_TARGET}{' '}
              PRODUCTS
            </Text>
            {showProgressBody ? (
              <Text variant="bodySm" tone="muted" className="mt-1">
                {progressBody}
              </Text>
            ) : null}
          </View>

          <Card
            className={
              splitShortPhone
                ? 'mt-3 p-4'
                : modernTextPressurePhone
                  ? 'mt-3 p-4'
                  : compactPhone
                    ? 'mt-4 p-4'
                    : 'mt-6'
            }
          >
            <Text variant="label" tone="muted" className="mb-2">
              PRODUCT NAME
            </Text>
            <TextInput
              ref={inputRef}
              accessibilityLabel="Product name"
              value={name}
              onChangeText={setName}
              placeholder={pseudoLocalizeString('e.g. Retinol serum')}
              placeholderTextColor={colors.mutedLight}
              className="rounded-card border border-hairline bg-paper px-4 py-3.5 font-sans text-base text-ink"
              returnKeyType="done"
              onSubmitEditing={add}
            />
            {!compactPhone ? (
              <>
                <Text variant="label" tone="muted" className="mb-2 mt-4">
                  CATEGORY · OPTIONAL
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {ONBOARDING_PRODUCT_CATEGORIES.map((c) => (
                    <Chip
                      key={c.id}
                      label={c.label}
                      selected={category === c.id}
                      onPress={() => setCategory(category === c.id ? null : c.id)}
                    />
                  ))}
                </View>
              </>
            ) : null}
            {!compactPhone ? (
              <Button
                className="mt-4"
                label="Add to shelf"
                variant="inverse"
                disabled={!name.trim()}
                onPress={add}
              />
            ) : null}
          </Card>

          {added.length > 0 ? (
            <View className="mt-5">
              <Text variant="label" tone="muted" className="mb-2">
                {added.length} ON YOUR SHELF
              </Text>
              <View className="gap-2">
                {removeFailed ? (
                  <View accessibilityRole="alert" className="rounded-card bg-clay-tint px-4 py-3">
                    <Text variant="bodySm" className="font-sans-semibold">
                      Product not removed
                    </Text>
                    <Text variant="bodySm" tone="muted" className="mt-1">
                      Your saved Shelf remains unchanged. Try again when private storage is
                      available.
                    </Text>
                  </View>
                ) : null}
                {added.map((it) => (
                  <View
                    key={it.id}
                    className="flex-row items-center justify-between rounded-card bg-paper-raised px-4 py-3"
                    style={{ borderWidth: 1, borderColor: colors.hairline }}
                  >
                    <Text variant="body" className="flex-1 font-sans-medium">
                      {it.name}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${it.name}`}
                      accessibilityState={{ disabled: removingId != null }}
                      disabled={removingId != null}
                      onPress={() => void removeProduct(it.id)}
                      className="h-12 w-12 items-center justify-center rounded-full"
                      style={({ pressed }) => ({
                        opacity: removingId === it.id ? 0.5 : pressed ? 0.72 : 1,
                      })}
                    >
                      <Text variant="body" tone="muted" style={{ fontSize: 18 }}>
                        ×
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>

      {compactPhone ? (
        <CategoryPickerSheet
          visible={categoryPickerOpen}
          selectedCategory={category}
          onSelect={selectCategory}
          onClose={() => setCategoryPickerOpen(false)}
        />
      ) : null}
      <View
        className="bg-paper pb-4 pt-2"
        aria-hidden={categoryPickerOpen || undefined}
        accessibilityElementsHidden={categoryPickerOpen}
        importantForAccessibility={categoryPickerOpen ? 'no-hide-descendants' : 'auto'}
      >
        {showCompactCategoryFooter ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              selectedCategoryLabel
                ? `Category, ${selectedCategoryLabel}`
                : 'Choose product category'
            }
            onPress={() => setCategoryPickerOpen((open) => !open)}
            className="mb-2 min-h-[48px] flex-row items-center justify-between rounded-card border border-hairline bg-paper-raised px-4 py-3"
            style={({ pressed }) => (pressed ? { opacity: 0.82 } : undefined)}
          >
            <View className="flex-1 pr-3">
              <Text variant="label" tone="muted">
                CATEGORY · OPTIONAL
              </Text>
              <Text variant="body" className="mt-0.5 font-sans-medium">
                {selectedCategoryLabel ?? 'Choose category'}
              </Text>
            </View>
            <Text variant="body" tone="muted" style={{ fontSize: 18 }}>
              &gt;
            </Text>
          </Pressable>
        ) : null}
        <Button label={footerPrimaryLabel} onPress={footerAction} />
        {showContinueAnyway ? (
          <Button
            label={continueAnywayLabel}
            variant="ghost"
            className="mt-1 min-h-[48px] py-2"
            onPress={go}
          />
        ) : null}
      </View>
    </Screen>
  );
}
