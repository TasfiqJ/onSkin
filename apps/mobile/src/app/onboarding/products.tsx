import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Button, Card, Chip, Screen, Text } from '@/components/ui';
import { reviewedCategoryPao } from '@/features/intelligence/pao';
import { ONBOARDING_PRODUCT_CATEGORIES } from '@/features/onboarding/productCategories';
import { useShelfMutations } from '@/features/shelf/mutations';
import { useShelf } from '@/features/shelf/useShelf';
import { track } from '@/lib/analytics/track';
import { colors } from '@/theme/tokens';

// 06 · Current products intake (docs/01 §2 step 6, docs/04 §4.7). Seeds the shelf with
// addedVia:'onboarding' so the reveal and the first routine/conflict pass are built
// from the user's REAL products (the conflict engine tags off the name). Skip stays
// visible. The full barcode/OCR intake lives on the Shelf (docs/04); this is the
// lightweight first-population that was previously a dead skip-only screen.
export default function ProductsScreen() {
  const { data } = useShelf();
  const m = useShelfMutations();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const added = data?.items ?? [];

  async function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const pao = category ? reviewedCategoryPao(category) : null;
    await m.add({
      name: trimmed,
      category,
      addedVia: 'onboarding',
      paoMonths: pao,
      paoSource: pao != null ? 'category_default' : 'unknown',
    });
    setName('');
    setCategory(null);
  }

  function go() {
    track('screen_viewed', { screen_name: 'products_intake', count: added.length });
    router.push('/onboarding/analyzing');
  }

  return (
    <Screen>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-28"
      >
        <Text variant="title" className="mt-6">
          What&apos;s on your shelf?
        </Text>
        <Text variant="body" tone="muted" className="mt-3">
          Add the products you already use so we build around them. Even just the name helps us spot
          conflicts. You can add more anytime from your Shelf.
        </Text>

        <Card className="mt-6">
          <Text variant="label" tone="muted" className="mb-2">
            PRODUCT NAME
          </Text>
          <TextInput
            accessibilityLabel="Product name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Retinol 0.3% Night Serum"
            placeholderTextColor={colors.mutedLight}
            className="rounded-card border border-hairline bg-paper px-4 py-3.5 font-sans text-base text-ink"
            returnKeyType="done"
            onSubmitEditing={() => void add()}
          />
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
          <Button
            className="mt-4"
            label="Add to shelf"
            variant="inverse"
            disabled={!name.trim()}
            onPress={() => void add()}
          />
        </Card>

        {added.length > 0 ? (
          <View className="mt-5">
            <Text variant="label" tone="muted" className="mb-2">
              {added.length} ON YOUR SHELF
            </Text>
            <View className="gap-2">
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
                    onPress={() => void m.remove(it.id)}
                    className="h-12 w-12 items-center justify-center rounded-full"
                    style={({ pressed }) => (pressed ? { opacity: 0.72 } : undefined)}
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

      <View className="bg-paper pb-4 pt-2">
        <Button label={added.length > 0 ? 'Continue' : 'Skip for now'} onPress={go} />
      </View>
    </Screen>
  );
}
