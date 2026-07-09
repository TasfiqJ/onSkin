import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, RouteIconButton, Screen, Text } from '@/components/ui';
import { parseIngredientText } from '@/features/catalog/ingredientParser';
import { reviewedCategoryPao } from '@/features/intelligence/pao';
import {
  categoryLabel,
  PRODUCT_CATEGORIES,
  type ProductCategory,
} from '@/features/shelf/categories';
import { useIntake } from '@/features/shelf/IntakeContext';
import { track } from '@/lib/analytics/track';
import { cn } from '@/lib/cn';
import { APP_SHELF_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { colors } from '@/theme/tokens';

// Add by hand (design screen 03, docs/04 §4.4). The always-works floor under
// every other path. Name, brand, category (drives the default PAO), optional
// INCI (parsed for actives). Continues to the opened-date linchpin (§4.5).
function FieldLabel({ children }: { children: string }) {
  return (
    <Text variant="label" tone="muted" className="mb-1.5 uppercase">
      {children}
    </Text>
  );
}

function categoryFieldLabel(category: ProductCategory | null): string {
  if (!category) return 'Choose';
  return category === 'other' ? 'Other' : (categoryLabel(category) ?? 'Choose');
}

const inputClass =
  'rounded-[14px] border border-hairline bg-paper-raised px-4 text-[15px] text-ink font-sans-medium';

function CategoryPickerSheet({
  visible,
  selectedCategory,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedCategory: ProductCategory | null;
  onSelect: (category: ProductCategory) => void;
  onClose: () => void;
}) {
  const { height: viewportHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const ultraShortSheet = viewportHeight < 460;
  const sheetMaxHeight = Math.max(0, viewportHeight - 48);
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
          <View className="mb-3 flex-row items-center justify-between gap-3">
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
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerClassName={ultraShortSheet ? 'pb-14' : 'pb-6'}
            keyboardShouldPersistTaps="handled"
          >
            <View className="gap-2">
              {PRODUCT_CATEGORIES.map((c) => {
                const selected = selectedCategory === c.id;
                return (
                  <Pressable
                    key={c.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Category, ${c.label}`}
                    accessibilityState={{ selected }}
                    onPress={() => onSelect(c.id)}
                    className="min-h-[52px] flex-row items-center justify-between rounded-[14px] border border-hairline bg-paper-raised px-4 py-3"
                  >
                    <Text variant="bodySm" className="flex-1 font-sans-semibold">
                      {c.label}
                    </Text>
                    {selected ? <Text tone="clay">✓</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

export default function ManualAddScreen() {
  const { draft, update } = useIntake();
  // Arriving from an accepted recommendation (docs/09 §11): the rec passes the
  // category so the form is pre-filled. With a preset we start the other fields
  // fresh rather than inheriting a stale prior-intake draft.
  const params = useLocalSearchParams<{ presetCategory?: string }>();
  const presetCategory =
    params.presetCategory && PRODUCT_CATEGORIES.some((c) => c.id === params.presetCategory)
      ? (params.presetCategory as ProductCategory)
      : null;
  const [name, setName] = useState(presetCategory ? '' : draft.name);
  const [brand, setBrand] = useState(presetCategory ? '' : (draft.brand ?? ''));
  const [category, setCategory] = useState<ProductCategory | null>(
    presetCategory ?? draft.category,
  );
  const [ingredients, setIngredients] = useState(
    presetCategory ? '' : draft.ingredients.join(', '),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const { fontScale = 1, height: viewportHeight, width: viewportWidth } = useWindowDimensions();
  const ultraShortPhone = viewportHeight < 460;
  const splitShortPhone = viewportHeight < 410;
  const supportFloorTextPressureManualPhone =
    viewportWidth <= 390 && viewportHeight < 700 && (fontScale >= 1.3 || Platform.OS === 'web');
  const compactManualPhone = viewportHeight < 600 || supportFloorTextPressureManualPhone;
  const showManualIngredientsField = !supportFloorTextPressureManualPhone;
  const manualIngredientsDeferredStyle = splitShortPhone
    ? { marginTop: 300 }
    : compactManualPhone
      ? { marginTop: 616 }
      : undefined;

  const paoFromCategory = reviewedCategoryPao(category);

  const canContinue = name.trim().length > 0;

  const selectCategory = (nextCategory: ProductCategory) => {
    setCategory(nextCategory);
    setPickerOpen(false);
  };

  const onContinue = () => {
    const parsed = ingredients.trim() ? parseIngredientText(ingredients) : null;
    const tokens = parsed?.tokens.map((token) => token.displayName) ?? [];
    if (parsed) {
      track('ingredient_parse_completed', {
        source: 'manual',
        result: parsed.status,
        count: parsed.tokens.length,
      });
    }
    update({
      name: name.trim(),
      brand: brand.trim() || null,
      category,
      ingredients: tokens,
      ingredientParseStatus: parsed?.status ?? null,
      ingredientParseConfidence: parsed?.confidence ?? null,
      parserVersion: parsed?.parserVersion ?? null,
      paoMonths: paoFromCategory,
      paoSource: paoFromCategory != null ? 'category_default' : 'unknown',
    });
    router.push('/shelf/opened');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="mt-2 flex-row items-center justify-between">
        <RouteIconButton
          accessibilityLabel="Cancel"
          glyph="x"
          onPress={() => backOrReplace(router, APP_SHELF_ROUTE)}
        />
        <Text variant="body" className="font-sans-semibold">
          Add by hand
        </Text>
        <View className="w-[44px]" />
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName={
          splitShortPhone ? 'pb-40' : compactManualPhone ? 'pb-36' : 'pb-24'
        }
        keyboardShouldPersistTaps="handled"
      >
        {!compactManualPhone ? (
          <Text variant="bodySm" tone="muted" className="mb-4 mt-3">
            The floor under every other path. This always works, even fully offline.
          </Text>
        ) : null}

        <View className={compactManualPhone ? 'gap-2' : 'gap-3'}>
          <View>
            <FieldLabel>Product name</FieldLabel>
            <TextInput
              accessibilityLabel="Product name"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Gentle Retinol Night Serum"
              placeholderTextColor={colors.mutedLight}
              className={cn(inputClass, compactManualPhone ? 'h-[48px]' : 'h-[50px]')}
            />
          </View>

          <View className={compactManualPhone ? 'flex-row gap-2' : 'flex-row gap-3'}>
            <View className={compactManualPhone ? 'flex-[0.82]' : 'flex-1'}>
              <FieldLabel>Brand</FieldLabel>
              <TextInput
                accessibilityLabel="Brand"
                value={brand}
                onChangeText={setBrand}
                placeholder="Brand"
                placeholderTextColor={colors.mutedLight}
                className={cn(inputClass, compactManualPhone ? 'h-[48px]' : 'h-[50px]')}
              />
            </View>
            <View className={compactManualPhone ? 'flex-[1.28]' : 'flex-[1.1]'}>
              <FieldLabel>Category</FieldLabel>
              <Pressable
                accessibilityLabel={
                  category ? `Category, ${categoryFieldLabel(category)}` : 'Category'
                }
                accessibilityHint="Choose product category"
                accessibilityRole="button"
                onPress={() => setPickerOpen((o) => !o)}
                className={cn(
                  compactManualPhone ? 'h-[48px] gap-0.5 px-2.5' : 'h-[50px] gap-1 px-3',
                  'flex-row items-center justify-between rounded-[14px] border border-hairline bg-paper-raised',
                )}
              >
                <Text
                  className={cn(
                    'min-w-0 flex-1 font-sans-medium leading-[18px]',
                    compactManualPhone ? 'text-[13px]' : 'text-[14px]',
                  )}
                  tone={category ? 'ink' : 'muted'}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {categoryFieldLabel(category)}
                </Text>
                <Text tone="muted" className="shrink-0">
                  ▾
                </Text>
              </Pressable>
            </View>
          </View>

          {showManualIngredientsField ? (
            <View style={manualIngredientsDeferredStyle}>
              <Text variant="label" tone="muted" className="mb-1.5 uppercase">
                Ingredients
                <Text
                  className="font-mono text-[10.5px]"
                  style={{ color: colors.mutedFaint, textTransform: 'none', letterSpacing: 0 }}
                >
                  {' · optional, we’ll find the actives'}
                </Text>
              </Text>
              <TextInput
                accessibilityLabel="Ingredients"
                value={ingredients}
                onChangeText={setIngredients}
                placeholder="Paste or type the INCI list…"
                placeholderTextColor={colors.mutedLight}
                multiline
                className={cn(
                  inputClass,
                  ultraShortPhone ? 'min-h-[52px] py-2.5' : 'min-h-[64px] py-3',
                )}
                style={{ textAlignVertical: 'top' }}
              />
            </View>
          ) : null}

          {!ultraShortPhone ? (
            /* PAO pre-fill note (honest, from the category default. Editable next). */
            <View className="flex-row items-center gap-3 rounded-[16px] bg-clay-tint px-4 py-3">
              <View className="h-[7px] w-[7px] rounded-full bg-clay" />
              <Text variant="bodySm" tone="muted" className="flex-1">
                {paoFromCategory != null ? (
                  <>
                    We&apos;ll pre-fill the PAO from your category.{' '}
                    <Text variant="bodySm" className="font-sans-semibold text-clay-deep">
                      {categoryLabel(category)?.toLowerCase()} defaults to ~{paoFromCategory}{' '}
                      months.
                    </Text>{' '}
                    You can change it next.
                  </>
                ) : category ? (
                  <>You can set the PAO on the next step. Straight from the label.</>
                ) : (
                  <>Pick a category and we&apos;ll estimate the PAO. You can change it next.</>
                )}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View className={compactManualPhone ? 'pb-2 pt-1' : 'pb-3 pt-1'}>
        <Button
          label="Continue"
          variant="accent"
          disabled={!canContinue}
          className={compactManualPhone ? 'min-h-[52px] py-3' : undefined}
          onPress={onContinue}
        />
      </View>
      <CategoryPickerSheet
        visible={pickerOpen}
        selectedCategory={category}
        onSelect={selectCategory}
        onClose={() => setPickerOpen(false)}
      />
    </Screen>
  );
}
