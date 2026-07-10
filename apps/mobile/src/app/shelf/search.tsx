import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputChangeEventData,
} from 'react-native';

import { Button, RouteIconButton, Screen, Text } from '@/components/ui';
import { parseIngredientText } from '@/features/catalog/ingredientParser';
import {
  reportCatalogIssue,
  searchCatalog,
  type CatalogProductSummary,
} from '@/features/catalog/client';
import { catalogQualityLabel, sourceDisplayName } from '@/features/catalog/copy';
import type { CatalogQualityGrade } from '@/features/catalog/quality';
import { trackProductAddStarted } from '@/features/shelf/analytics';
import { PRODUCT_CATEGORIES, type ProductCategory } from '@/features/shelf/categories';
import { useIntake } from '@/features/shelf/IntakeContext';
import { track } from '@/lib/analytics/track';
import { BRAND } from '@/lib/brand';
import { cn } from '@/lib/cn';
import { APP_SHELF_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

const categoryIds = new Set(PRODUCT_CATEGORIES.map((category) => category.id));
const qualityGrades = new Set(['verified', 'usable', 'limited', 'unverified', 'blocked']);
const CATALOG_MISSING_SENT = {
  title: 'Report sent',
  message: 'Thanks. Missing-product reports help prioritize catalog review before launch.',
};
const CATALOG_MISSING_NOT_SENT = {
  title: 'Report not sent',
  message: 'Catalog reporting is not configured on this build. Add it by hand for now.',
};
const CATALOG_WRONG_MATCH_SENT = {
  title: 'Report sent',
  message: 'Thanks. Wrong-match reports help keep the catalog trustworthy before launch.',
};
const CATALOG_WRONG_MATCH_NOT_SENT = {
  title: 'Report not sent',
  message:
    'Catalog reporting is not configured on this build. Add by hand or choose another match.',
};

function normalizeCategory(value: string | null | undefined): ProductCategory | null {
  return value && categoryIds.has(value as ProductCategory) ? (value as ProductCategory) : null;
}

function normalizeQuality(value: string | null | undefined): CatalogQualityGrade {
  return value && qualityGrades.has(value) ? (value as CatalogQualityGrade) : 'unverified';
}

function productKey(product: CatalogProductSummary): string {
  return product.id ?? `${product.source}-${product.barcode}-${product.name}`;
}

export default function CatalogSearchScreen() {
  const { update, reset } = useIntake();
  const { e2eQuery } = useLocalSearchParams<{ e2eQuery?: string | string[] }>();
  const rawE2EQuery = Array.isArray(e2eQuery) ? e2eQuery[0] : (e2eQuery ?? '');
  const initialSearchQuery =
    typeof __DEV__ !== 'undefined' && __DEV__ && Platform.OS === 'web' ? rawE2EQuery : '';
  const autoSearchStarted = useRef(false);
  const [query, setQuery] = useState(() => initialSearchQuery.slice(0, 120));
  const [results, setResults] = useState<CatalogProductSummary[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [lastNoMatchQuery, setLastNoMatchQuery] = useState<string | null>(null);
  const [reportingMissingProduct, setReportingMissingProduct] = useState(false);
  const [missingProductFeedback, setMissingProductFeedback] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [reportingWrongMatchId, setReportingWrongMatchId] = useState<string | null>(null);
  const [wrongMatchFeedback, setWrongMatchFeedback] = useState<{
    productKey: string;
    title: string;
    message: string;
  } | null>(null);
  const [searching, setSearching] = useState(false);
  const canSearch = query.trim().length >= 2 && !searching;

  const handleQueryChange = (
    event: NativeSyntheticEvent<TextInputChangeEventData> & { target?: { value?: string } },
  ) => {
    const next = event.nativeEvent.text ?? event.target?.value;
    if (typeof next === 'string') setQuery(next);
  };

  const runSearch = useCallback(
    async (queryOverride?: string) => {
      const cleaned = (queryOverride ?? query).trim();
      if (cleaned.length < 2 || searching) return;
      setSearching(true);
      setLastNoMatchQuery(null);
      setMissingProductFeedback(null);
      setWrongMatchFeedback(null);
      const response = await searchCatalog(cleaned);
      setResults(response.products ?? []);
      const noProducts = !response.products?.length;
      setMessage(
        response.result === 'offline' || response.result === 'error'
          ? "Couldn't reach the product catalog. Add this product by hand for now."
          : !noProducts
            ? null
            : 'No catalog match yet. Add it by hand for now.',
      );
      if (response.result === 'no_match' && noProducts) setLastNoMatchQuery(cleaned);
      if (noProducts) track('catalog_lookup_no_match', { lookup_type: 'search' });
      setSearching(false);
    },
    [query, searching],
  );

  useEffect(() => {
    if (!initialSearchQuery || autoSearchStarted.current) return;
    autoSearchStarted.current = true;
    void runSearch(initialSearchQuery);
  }, [initialSearchQuery, runSearch]);

  const reportMissingProduct = async () => {
    if (!lastNoMatchQuery || reportingMissingProduct) return;
    setReportingMissingProduct(true);
    setMissingProductFeedback(null);
    const result = await reportCatalogIssue({
      correctionType: 'missing_product',
      description: 'missing_product reported from catalog search',
      proposedPayload: { productName: lastNoMatchQuery },
      clientContext: {
        addedVia: 'search',
        platform: Platform.OS,
        route: 'shelf_search',
      },
    });
    setMissingProductFeedback(result.ok ? CATALOG_MISSING_SENT : CATALOG_MISSING_NOT_SENT);
    setReportingMissingProduct(false);
  };

  const reportWrongMatch = async (product: CatalogProductSummary) => {
    const key = productKey(product);
    if (reportingWrongMatchId) return;

    setReportingWrongMatchId(key);
    setWrongMatchFeedback(null);
    const sourceName = sourceDisplayName(product.source);
    const result = await reportCatalogIssue({
      correctionType: 'wrong_match',
      productId: product.id,
      barcode: product.barcode,
      description: 'wrong_match reported from catalog search result',
      proposedPayload: {
        productName: product.name,
        brand: product.brand,
        barcode: product.barcode,
        category: product.category,
        sourceName,
        sourceUrl: product.source_url ?? null,
        qualityIssue: 'wrong_match',
      },
      clientContext: {
        addedVia: 'search',
        quality: normalizeQuality(product.quality_grade),
        source: product.source,
        platform: Platform.OS,
        route: 'shelf_search',
      },
    });
    setWrongMatchFeedback({
      productKey: key,
      ...(result.ok ? CATALOG_WRONG_MATCH_SENT : CATALOG_WRONG_MATCH_NOT_SENT),
    });
    setReportingWrongMatchId(null);
  };

  const goManual = () => {
    haptics.select();
    trackProductAddStarted('catalog_manual');
    reset({ addedVia: 'manual', name: query.trim() });
    router.replace('/shelf/manual');
  };

  const chooseProduct = (product: CatalogProductSummary) => {
    haptics.select();
    const parsed = product.rawIngredientsText
      ? parseIngredientText(product.rawIngredientsText)
      : null;
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
        <RouteIconButton
          accessibilityLabel="Back"
          onPress={() => backOrReplace(router, APP_SHELF_ROUTE)}
        />
        <Text variant="body" className="font-sans-semibold">
          Search catalog
        </Text>
        <View className="w-[44px]" />
      </View>

      <View className="mt-4 flex-row items-center gap-2">
        <TextInput
          accessibilityLabel="Catalog search query"
          value={query}
          onChange={handleQueryChange}
          onChangeText={setQuery}
          onSubmitEditing={() => void runSearch()}
          placeholder="Brand or product name"
          placeholderTextColor={colors.mutedLight}
          className="h-[50px] min-w-0 flex-1 rounded-[14px] border border-hairline bg-paper-raised px-4 font-sans-medium text-[15px] text-ink"
          returnKeyType="search"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: searching, disabled: !canSearch }}
          disabled={!canSearch}
          onPress={() => void runSearch()}
          className={cn(
            'h-[50px] min-w-[72px] shrink-0 items-center justify-center rounded-[14px] px-3',
            canSearch ? 'bg-ink' : 'bg-greige-chip',
          )}
        >
          <Text className="font-sans-semibold text-[14px]" tone={canSearch ? 'inverse' : 'muted'}>
            Search
          </Text>
        </Pressable>
      </View>

      <Text variant="bodySm" tone="muted" className="mt-3">
        Search uses the {BRAND.appName} catalog only. Public API search is not used for live typing.
      </Text>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-4"
      >
        {message ? (
          <View className="mt-4 rounded-[16px] bg-greige-chip px-4 py-3.5">
            <Text variant="bodySm" tone="muted">
              {message}
            </Text>
            {lastNoMatchQuery ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ busy: reportingMissingProduct }}
                disabled={reportingMissingProduct}
                onPress={reportMissingProduct}
                className="mt-3 min-h-[48px] self-start items-center justify-center rounded-pill px-1"
              >
                <Text variant="bodySm" tone="clay" className="font-sans-semibold">
                  {reportingMissingProduct ? 'Sending report...' : 'Report missing product'}
                </Text>
              </Pressable>
            ) : null}
            {missingProductFeedback ? (
              <View
                accessibilityRole="alert"
                className="mt-2.5 rounded-[14px] bg-clay-tint px-4 py-3"
              >
                <Text variant="label" style={{ color: colors.clayDeep }}>
                  {missingProductFeedback.title}
                </Text>
                <Text
                  variant="bodySm"
                  className="mt-1"
                  style={{ color: colors.clayDeep, lineHeight: 19 }}
                >
                  {missingProductFeedback.message}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View className="mt-4 gap-2.5">
          {results.map((product) => {
            const key = productKey(product);
            const reportingThisMatch = reportingWrongMatchId === key;
            const feedback = wrongMatchFeedback?.productKey === key ? wrongMatchFeedback : null;

            return (
              <View
                key={key}
                className="rounded-[16px] border border-hairline bg-paper-raised px-4 py-3.5"
              >
                <Text variant="body" className="font-sans-semibold">
                  {product.name}
                </Text>
                <Text variant="bodySm" tone="muted" className="mt-0.5">
                  {[
                    product.brand,
                    sourceDisplayName(product.source),
                    catalogQualityLabel(product.quality_grade),
                  ]
                    .filter(Boolean)
                    .join(' / ')}
                </Text>
                {product.barcode ? (
                  <Text variant="label" tone="muted" className="mt-1">
                    barcode {product.barcode}
                  </Text>
                ) : null}
                <View className="mt-3 flex-row flex-wrap gap-2">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Use ${product.name} match`}
                    onPress={() => chooseProduct(product)}
                    className="min-h-[48px] flex-1 basis-[148px] items-center justify-center rounded-pill bg-ink px-4 py-2"
                  >
                    <Text variant="bodySm" tone="inverse" className="font-sans-semibold">
                      Use this match
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ busy: reportingThisMatch, disabled: reportingThisMatch }}
                    disabled={reportingThisMatch}
                    onPress={() => reportWrongMatch(product)}
                    className="min-h-[48px] flex-1 basis-[148px] items-center justify-center rounded-pill border border-hairline bg-paper px-4 py-2"
                  >
                    <Text variant="bodySm" tone="clay" className="font-sans-semibold">
                      {reportingThisMatch ? 'Sending report...' : 'Not this product'}
                    </Text>
                  </Pressable>
                </View>
                {feedback ? (
                  <View
                    accessibilityRole="alert"
                    className="mt-2.5 rounded-[14px] bg-clay-tint px-4 py-3"
                  >
                    <Text variant="label" style={{ color: colors.clayDeep }}>
                      {feedback.title}
                    </Text>
                    <Text
                      variant="bodySm"
                      className="mt-1"
                      style={{ color: colors.clayDeep, lineHeight: 19 }}
                    >
                      {feedback.message}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View className="pb-8 pt-2">
        <Button label="Add by hand" variant="ghost" onPress={goManual} />
      </View>
    </Screen>
  );
}
