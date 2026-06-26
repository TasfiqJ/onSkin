import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { reviewedCategoryPao } from '@/features/intelligence/pao';
import { categoryLabel, PRODUCT_CATEGORIES, type ProductCategory } from '@/features/shelf/categories';
import { useIntake } from '@/features/shelf/IntakeContext';
import { cn } from '@/lib/cn';
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

const inputClass =
  'rounded-[14px] border border-hairline bg-paper-raised px-4 text-[15px] text-ink font-sans-medium';

export default function ManualAddScreen() {
  const { draft, update } = useIntake();
  const [name, setName] = useState(draft.name);
  const [brand, setBrand] = useState(draft.brand ?? '');
  const [category, setCategory] = useState<ProductCategory | null>(draft.category);
  const [ingredients, setIngredients] = useState(draft.ingredients.join(', '));
  const [pickerOpen, setPickerOpen] = useState(false);

  const paoFromCategory = reviewedCategoryPao(category);

  const canContinue = name.trim().length > 0;

  const onContinue = () => {
    const tokens = ingredients
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    update({
      name: name.trim(),
      brand: brand.trim() || null,
      category,
      ingredients: tokens,
      paoMonths: paoFromCategory,
      paoSource: paoFromCategory != null ? 'category_default' : 'unknown',
    });
    router.push('/shelf/opened');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="mt-2 flex-row items-center justify-between">
        <Text variant="bodySm" tone="muted" onPress={() => router.back()}>
          Cancel
        </Text>
        <Text variant="body" className="font-sans-semibold">
          Add by hand
        </Text>
        <View className="w-12" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-4" keyboardShouldPersistTaps="handled">
        <Text variant="bodySm" tone="muted" className="mb-5 mt-3">
          The floor under every other path. This always works, even fully offline.
        </Text>

        <View className="gap-3.5">
          <View>
            <FieldLabel>Product name</FieldLabel>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Gentle Retinol Night Serum"
              placeholderTextColor={colors.mutedLight}
              className={cn(inputClass, 'h-[50px]')}
            />
          </View>

          <View className="flex-row gap-3">
            <View className="flex-[1.3]">
              <FieldLabel>Brand</FieldLabel>
              <TextInput
                value={brand}
                onChangeText={setBrand}
                placeholder="Brand"
                placeholderTextColor={colors.mutedLight}
                className={cn(inputClass, 'h-[50px]')}
              />
            </View>
            <View className="flex-1">
              <FieldLabel>Category</FieldLabel>
              <Pressable
                accessibilityRole="button"
                onPress={() => setPickerOpen((o) => !o)}
                className={cn(inputClass, 'h-[50px] flex-row items-center justify-between')}>
                <Text className="font-sans-medium text-[15px]" tone={category ? 'ink' : 'muted'}>
                  {category ? categoryLabel(category) : 'Choose'}
                </Text>
                <Text tone="muted">▾</Text>
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
                    'flex-row items-center justify-between px-4 py-3',
                    i > 0 && 'border-t border-hairline',
                  )}>
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
                style={{ color: colors.mutedFaint, textTransform: 'none', letterSpacing: 0 }}>
                {' · optional, we’ll find the actives'}
              </Text>
            </Text>
            <TextInput
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
          <View className="flex-row items-center gap-3 rounded-[16px] bg-clay-tint px-4 py-3.5">
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

      <Button label="Continue" variant="accent" disabled={!canContinue} onPress={onContinue} />
    </Screen>
  );
}
