import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

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

  const paoFromCategory = reviewedCategoryPao(category);

  const canContinue = name.trim().length > 0;

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
        contentContainerClassName={pickerOpen ? 'pb-32' : 'pb-24'}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="bodySm" tone="muted" className="mb-4 mt-3">
          The floor under every other path. This always works, even fully offline.
        </Text>

        <View className="gap-3">
          <View>
            <FieldLabel>Product name</FieldLabel>
            <TextInput
              accessibilityLabel="Product name"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Gentle Retinol Night Serum"
              placeholderTextColor={colors.mutedLight}
              className={cn(inputClass, 'h-[50px]')}
            />
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <FieldLabel>Brand</FieldLabel>
              <TextInput
                accessibilityLabel="Brand"
                value={brand}
                onChangeText={setBrand}
                placeholder="Brand"
                placeholderTextColor={colors.mutedLight}
                className={cn(inputClass, 'h-[50px]')}
              />
            </View>
            <View className="flex-[1.1]">
              <FieldLabel>Category</FieldLabel>
              <Pressable
                accessibilityLabel={category ? `Category, ${categoryLabel(category)}` : 'Category'}
                accessibilityHint="Choose product category"
                accessibilityRole="button"
                onPress={() => setPickerOpen((o) => !o)}
                className="h-[50px] flex-row items-center justify-between gap-1 rounded-[14px] border border-hairline bg-paper-raised px-3"
              >
                <Text
                  className="min-w-0 flex-1 font-sans-medium text-[14px] leading-[18px]"
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

          {pickerOpen ? (
            <View className="rounded-[14px] border border-hairline bg-paper-raised">
              {PRODUCT_CATEGORIES.map((c, i) => (
                <Pressable
                  key={c.id}
                  accessibilityRole="button"
                  onPress={() => {
                    setCategory(c.id);
                    setPickerOpen(false);
                  }}
                  className={cn(
                    'min-h-[48px] flex-row items-center justify-between px-4 py-3',
                    i > 0 && 'border-t border-hairline',
                  )}
                >
                  <Text variant="bodySm" className="font-sans-medium">
                    {c.label}
                  </Text>
                  {category === c.id ? <Text tone="clay">✓</Text> : null}
                </Pressable>
              ))}
            </View>
          ) : null}

          <View>
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
              className={cn(inputClass, 'min-h-[64px] py-3')}
              style={{ textAlignVertical: 'top' }}
            />
          </View>

          {/* PAO pre-fill note (honest, from the category default. Editable next). */}
          <View className="flex-row items-center gap-3 rounded-[16px] bg-clay-tint px-4 py-3">
            <View className="h-[7px] w-[7px] rounded-full bg-clay" />
            <Text variant="bodySm" tone="muted" className="flex-1">
              {paoFromCategory != null ? (
                <>
                  We&apos;ll pre-fill the PAO from your category.{' '}
                  <Text variant="bodySm" className="font-sans-semibold text-clay-deep">
                    {categoryLabel(category)?.toLowerCase()} defaults to ~{paoFromCategory} months.
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
        </View>
      </ScrollView>

      <View className="pb-3 pt-1">
        <Button label="Continue" variant="accent" disabled={!canContinue} onPress={onContinue} />
      </View>
    </Screen>
  );
}
