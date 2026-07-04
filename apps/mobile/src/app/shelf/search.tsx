import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { parseIngredientText } from '@/features/catalog/ingredientParser';
import { searchCatalog, type CatalogProductSummary } from '@/features/catalog/client';
import { catalogQualityLabel, sourceDisplayName } from '@/features/catalog/copy';
import type { CatalogQualityGrade } from '@/features/catalog/quality';
import { PRODUCT_CATEGORIES, type ProductCategory } from '@/features/shelf/categories';
import { useIntake } from '@/features/shelf/IntakeContext';
import { track } from '@/lib/analytics/track';
import { cn } from '@/lib/cn';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

const categoryIds = new Set(PRODUCT_CATEGORIES.map((category) => category.id));
const qualityGrades = new Set(['verified', 'usable', 'limited', 'unverified', 'blocked']);

function normalizeCategory(value: string | null | undefined): ProductCategory | null {
  return value && categoryIds.has(value as ProductCategory) ? (value as ProductCategory) : null;
}

function normalizeQuality(value: string | null | undefined): CatalogQualityGrade {
  return value && qualityGrades.has(value) ? (value as CatalogQualityGrade) : 'unverified';
}

export default function CatalogSearchScreen() {
  const { update, reset } = useIntake();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogProductSummary[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const runSearch = async () => {
    const cleaned = query.trim();
    if (cleaned.length < 2 || searching) return;
    setSearching(true);
    const response = await searchCatalog(cleaned);
    setResults(response.products ?? []);
    setMessage(
      response.result === 'offline'
        ? 'Catalog search needs the backend. Add this product by hand for now.'
        : response.products?.length
          ? null
          : 'No catalog match yet. Add it by hand for now.',
    );
    if (!response.products?.length) track('catalog_lookup_no_match', { lookup_type: 'search' });
    setSearching(false);
  };

  const goManual = () => {
    haptics.select();
    reset({ addedVia: 'manual', name: query.trim() });
    router.replace('/shelf/manual');
  };

  const chooseProduct = (product: CatalogProductSummary) => {
    haptics.select();
    const parsed = product.rawIngredientsText ? parseIngredientText(product.rawIngredientsText) : null;
    update({
      name: product.name,
      brand: product.brand,
      category: normalizeCategory(product.category),
      barcode: product.barcode,
      catalogProductId: product.id,
      catalogSource: product.source,
      catalogSourceName: sourceDisplayName(product.source),
      catalogSourceRef: product.source_ref ?? null,
      catalogSourceUrl: product.source_url ?? null,
      catalogSourceSnapshotDate: product.source_snapshot_date ?? null,
      catalogMatchQuality: normalizeQuality(product.quality_grade),
      dataQualityScore: product.data_quality_score ?? null,
      ingredientParseStatus: parsed?.status ?? product.ingredient_parse_status ?? null,
      ingredientParseConfidence: parsed?.confidence ?? product.ingredient_parse_confidence ?? null,
      parserVersion: parsed?.parserVersion ?? null,
      sourceDisclosureAckAt: new Date().toISOString(),
      ingredients: parsed?.tokens.map((token) => token.displayName) ?? [],
      paoMonths: product.default_pao_months ?? null,
      paoSource: product.default_pao_months != null ? 'catalog' : 'unknown',
      addedVia: 'search',
    });
    router.push('/shelf/opened');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="mt-2 flex-row items-center justify-between">
        <Text variant="bodySm" tone="muted" onPress={() => router.back()}>
          Back
        </Text>
        <Text variant="body" className="font-sans-semibold">
          Search catalog
        </Text>
        <View className="w-10" />
      </View>

      <View className="mt-4 flex-row gap-2">
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={runSearch}
          placeholder="Brand or product name"
          placeholderTextColor={colors.mutedLight}
          className="h-[50px] flex-1 rounded-[14px] border border-hairline bg-paper-raised px-4 font-sans-medium text-[15px] text-ink"
          returnKeyType="search"
        />
        <Pressable
          accessibilityRole="button"
          onPress={runSearch}
          className={cn(
            'h-[50px] items-center justify-center rounded-[14px] px-4',
            query.trim().length >= 2 ? 'bg-ink' : 'bg-greige-chip',
          )}>
          <Text className="font-sans-semibold text-[14px]" tone={query.trim().length >= 2 ? 'inverse' : 'muted'}>
            Search
          </Text>
        </Pressable>
      </View>

      <Text variant="bodySm" tone="muted" className="mt-3">
        Search uses the OnSkin catalog only. Public API search is not used for live typing.
      </Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-4">
        {message ? (
          <View className="mt-4 rounded-[16px] bg-greige-chip px-4 py-3.5">
            <Text variant="bodySm" tone="muted">
              {message}
            </Text>
          </View>
        ) : null}

        <View className="mt-4 gap-2.5">
          {results.map((product) => (
            <Pressable
              key={product.id ?? `${product.source}-${product.barcode}-${product.name}`}
              accessibilityRole="button"
              onPress={() => chooseProduct(product)}
              className="rounded-[16px] border border-hairline bg-paper-raised px-4 py-3.5">
              <Text variant="body" className="font-sans-semibold">
                {product.name}
              </Text>
              <Text variant="bodySm" tone="muted" className="mt-0.5">
                {[product.brand, sourceDisplayName(product.source), catalogQualityLabel(product.quality_grade)]
                  .filter(Boolean)
                  .join(' / ')}
              </Text>
              {product.barcode ? (
                <Text variant="label" tone="muted" className="mt-1">
                  barcode {product.barcode}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Button label="Add by hand" variant="ghost" onPress={goManual} />
    </Screen>
  );
}
