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
import { CatalogReportConfirmation } from '@/features/catalog/CatalogReportConfirmation';
import { parseIngredientText } from '@/features/catalog/ingredientParser';
import {
  catalogIntakeProvenance,
  isCatalogProductId,
  reportCatalogIssue,
  searchCatalog,
  type CatalogReportInput,
  type CatalogProductSummary,
} from '@/features/catalog/client';
import { catalogQualityLabel, sourceDisplayName } from '@/features/catalog/copy';
import type { CatalogQualityGrade } from '@/features/catalog/quality';
import {
  catalogReportFeedback,
  type CatalogReportFeedback,
} from '@/features/catalog/reportPresentation';
import {
  cancelCatalogReportOperation,
  createCatalogReportOperation,
  editCatalogReportOperation,
  finishCatalogReportOperation,
  markCatalogReportOperationAttempted,
  type CatalogReportOperation,
} from '@/features/catalog/reportOperation';
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

function normalizeCategory(value: string | null | undefined): ProductCategory | null {
  return value && categoryIds.has(value as ProductCategory) ? (value as ProductCategory) : null;
}

function normalizeQuality(value: string | null | undefined): CatalogQualityGrade {
  return value && qualityGrades.has(value) ? (value as CatalogQualityGrade) : 'unverified';
}

function productKey(product: CatalogProductSummary): string {
  return product.id ?? `${product.source}-${product.barcode}-${product.name}`;
}

function wrongMatchReportInput(product: CatalogProductSummary): CatalogReportInput | null {
  if (!isCatalogProductId(product.id)) return null;
  return {
    correctionType: 'wrong_match',
    productId: product.id,
    barcode: product.barcode,
    description: 'wrong_match reported from catalog search result',
    proposedPayload: {
      productName: product.name,
      brand: product.brand,
      category: product.category,
      sourceName: sourceDisplayName(product.source),
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
  };
}

export default function CatalogSearchScreen() {
  const { draft, update, reset } = useIntake();
  const { e2eQuery } = useLocalSearchParams<{ e2eQuery?: string | string[] }>();
  const rawE2EQuery = Array.isArray(e2eQuery) ? e2eQuery[0] : (e2eQuery ?? '');
  const initialSearchQuery =
    typeof __DEV__ !== 'undefined' && __DEV__ && Platform.OS === 'web' ? rawE2EQuery : '';
  const autoSearchStarted = useRef(false);
  const searchGeneration = useRef(0);
  const activeSearch = useRef<{ generation: number; query: string } | null>(null);
  const reportSubmissionInFlight = useRef(false);
  const queryRef = useRef(initialSearchQuery.slice(0, 120));
  const [query, setQuery] = useState(() => initialSearchQuery.slice(0, 120));
  const [results, setResults] = useState<CatalogProductSummary[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [lastNoMatchQuery, setLastNoMatchQuery] = useState<string | null>(null);
  const [confirmingMissingProduct, setConfirmingMissingProduct] = useState(false);
  const [missingProductName, setMissingProductName] = useState('');
  const [missingReportOperation, setMissingReportOperation] =
    useState<CatalogReportOperation | null>(null);
  const [reportingMissingProduct, setReportingMissingProduct] = useState(false);
  const [missingProductFeedback, setMissingProductFeedback] =
    useState<CatalogReportFeedback | null>(null);
  const [confirmingWrongMatchId, setConfirmingWrongMatchId] = useState<string | null>(null);
  const [reportingWrongMatchId, setReportingWrongMatchId] = useState<string | null>(null);
  const [wrongMatchFeedback, setWrongMatchFeedback] = useState<{
    productKey: string;
    title: string;
    message: string;
  } | null>(null);
  const [wrongMatchReportOperations, setWrongMatchReportOperations] = useState(
    () => new Map<string, CatalogReportOperation>(),
  );
  const [searching, setSearching] = useState(false);
  const reportBusy = reportingMissingProduct || reportingWrongMatchId !== null;
  const canSearch = query.trim().length >= 2 && !searching && !reportBusy;

  const updateQuery = useCallback((next: string) => {
    if (next === queryRef.current) return;

    queryRef.current = next;
    searchGeneration.current += 1;
    activeSearch.current = null;
    setQuery(next);
    setSearching(false);
    setResults([]);
    setMessage(null);
    setLastNoMatchQuery(null);
    setConfirmingMissingProduct(false);
    setMissingProductName('');
    setMissingReportOperation(null);
    setMissingProductFeedback(null);
    setConfirmingWrongMatchId(null);
    setWrongMatchReportOperations(new Map());
    setWrongMatchFeedback(null);
  }, []);

  const handleQueryChange = (
    event: NativeSyntheticEvent<TextInputChangeEventData> & { target?: { value?: string } },
  ) => {
    const next = event.nativeEvent.text ?? event.target?.value;
    if (typeof next === 'string') updateQuery(next);
  };

  const runSearch = useCallback(async (queryOverride?: string) => {
    const cleaned = (queryOverride ?? queryRef.current).trim();
    if (
      cleaned.length < 2 ||
      activeSearch.current?.query === cleaned ||
      reportSubmissionInFlight.current
    ) {
      return;
    }

    const generation = searchGeneration.current + 1;
    searchGeneration.current = generation;
    activeSearch.current = { generation, query: cleaned };
    setSearching(true);
    setResults([]);
    setMessage(null);
    setLastNoMatchQuery(null);
    setConfirmingMissingProduct(false);
    setMissingProductName('');
    setMissingReportOperation(null);
    setMissingProductFeedback(null);
    setConfirmingWrongMatchId(null);
    setWrongMatchReportOperations(new Map());
    setWrongMatchFeedback(null);

    try {
      const response = await searchCatalog(cleaned);
      if (searchGeneration.current !== generation) return;

      setResults(response.products ?? []);
      const noProducts = !response.products?.length;
      setMessage(
        response.result === 'offline' || response.result === 'error'
          ? "Couldn't reach the product catalog. Add this product by hand for now."
          : !noProducts
            ? null
            : 'No catalog match yet. Add it by hand for now.',
      );
      if (response.result === 'no_match' && noProducts) {
        setLastNoMatchQuery(cleaned);
        track('catalog_lookup_no_match', { lookup_type: 'search' });
      }
    } catch {
      if (searchGeneration.current !== generation) return;

      setResults([]);
      setLastNoMatchQuery(null);
      setMessage("Couldn't reach the product catalog. Add this product by hand for now.");
    } finally {
      if (searchGeneration.current === generation) {
        activeSearch.current = null;
        setSearching(false);
      }
    }
  }, []);

  useEffect(
    () => () => {
      searchGeneration.current += 1;
      activeSearch.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!initialSearchQuery || autoSearchStarted.current) return;
    autoSearchStarted.current = true;
    void runSearch(initialSearchQuery);
  }, [initialSearchQuery, runSearch]);

  const missingReportDraft = (productName: string): CatalogReportInput => ({
    correctionType: 'missing_product',
    description: 'missing_product reported from catalog search',
    proposedPayload: { productName: productName.trim() },
    clientContext: {
      addedVia: 'search',
      platform: Platform.OS,
      route: 'shelf_search',
    },
  });

  const openMissingProductConfirmation = () => {
    if (!lastNoMatchQuery || reportSubmissionInFlight.current) return;
    setMissingProductName(lastNoMatchQuery);
    setMissingReportOperation(
      (current) => current ?? createCatalogReportOperation(missingReportDraft(lastNoMatchQuery)),
    );
    setMissingProductFeedback(null);
    setConfirmingWrongMatchId(null);
    setConfirmingMissingProduct(true);
  };

  const reportMissingProduct = async () => {
    const productName = missingProductName.trim();
    if (
      productName.length < 2 ||
      !missingReportOperation ||
      reportSubmissionInFlight.current ||
      reportingMissingProduct
    ) {
      return;
    }
    const attempted = markCatalogReportOperationAttempted(missingReportOperation);
    setMissingReportOperation(attempted);
    reportSubmissionInFlight.current = true;
    setReportingMissingProduct(true);
    setMissingProductFeedback(null);
    try {
      const outcome = await reportCatalogIssue(attempted.input);
      setMissingReportOperation(finishCatalogReportOperation(attempted, outcome));
      setMissingProductFeedback(catalogReportFeedback(outcome));
    } catch {
      setMissingReportOperation(attempted);
      setMissingProductFeedback(catalogReportFeedback({ result: 'offline_or_withdrawn' }));
    } finally {
      setConfirmingMissingProduct(false);
      setReportingMissingProduct(false);
      reportSubmissionInFlight.current = false;
    }
  };

  const openWrongMatchConfirmation = (product: CatalogProductSummary) => {
    const key = productKey(product);
    const input = wrongMatchReportInput(product);
    if (!input || reportSubmissionInFlight.current) return;
    if (!wrongMatchReportOperations.has(key)) {
      setWrongMatchReportOperations((current) => {
        if (current.has(key)) return current;
        const next = new Map(current);
        next.set(key, createCatalogReportOperation(input));
        return next;
      });
    }
    setWrongMatchFeedback(null);
    setConfirmingMissingProduct(false);
    setConfirmingWrongMatchId(key);
  };

  const reportWrongMatch = async (product: CatalogProductSummary) => {
    const key = productKey(product);
    const operation = wrongMatchReportOperations.get(key);
    if (!operation || reportSubmissionInFlight.current || reportingWrongMatchId) return;

    const attempted = markCatalogReportOperationAttempted(operation);
    setWrongMatchReportOperations((current) => {
      const next = new Map(current);
      next.set(key, attempted);
      return next;
    });

    reportSubmissionInFlight.current = true;
    setReportingWrongMatchId(key);
    setWrongMatchFeedback(null);
    try {
      const outcome = await reportCatalogIssue(attempted.input);
      const retained = finishCatalogReportOperation(attempted, outcome);
      setWrongMatchReportOperations((current) => {
        const next = new Map(current);
        if (retained) next.set(key, retained);
        else next.delete(key);
        return next;
      });
      setWrongMatchFeedback({
        productKey: key,
        ...catalogReportFeedback(outcome),
      });
    } catch {
      setWrongMatchReportOperations((current) => {
        const next = new Map(current);
        next.set(key, attempted);
        return next;
      });
      setWrongMatchFeedback({
        productKey: key,
        ...catalogReportFeedback({ result: 'offline_or_withdrawn' }),
      });
    } finally {
      setConfirmingWrongMatchId(null);
      setReportingWrongMatchId(null);
      reportSubmissionInFlight.current = false;
    }
  };

  const goManual = () => {
    haptics.select();
    trackProductAddStarted('catalog_manual');
    reset({ addedVia: 'manual', name: query.trim(), barcode: draft.barcode });
    router.replace('/shelf/manual');
  };

  const chooseProduct = (product: CatalogProductSummary) => {
    haptics.select();
    const provenance = catalogIntakeProvenance(product);
    const parsed = product.rawIngredientsText
      ? parseIngredientText(product.rawIngredientsText)
      : null;
    update({
      name: product.name,
      brand: product.brand,
      category: normalizeCategory(product.category),
      barcode: product.barcode,
      catalogProductId: product.id,
      catalogSourceId: provenance.catalogSourceId,
      catalogSource: product.source,
      catalogSourceName: product.catalog_sources?.display_name ?? sourceDisplayName(product.source),
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
      paoMonths: provenance.paoMonths,
      paoSource: provenance.paoSource,
      expiryDate: provenance.expiryDate,
      addedVia: 'search',
    });
    router.push('/shelf/opened');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="mt-2 flex-row items-center justify-between">
        <RouteIconButton
          accessibilityLabel="Back"
          disabled={reportBusy}
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
          editable={!reportBusy}
          onChange={handleQueryChange}
          onChangeText={updateQuery}
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
                accessibilityState={{
                  busy: reportingMissingProduct,
                  disabled: reportingMissingProduct,
                }}
                disabled={reportingMissingProduct}
                onPress={openMissingProductConfirmation}
                className="mt-3 min-h-[48px] self-start items-center justify-center rounded-pill px-1"
              >
                <Text variant="bodySm" tone="clay" className="font-sans-semibold">
                  Report missing product
                </Text>
              </Pressable>
            ) : null}
            {confirmingMissingProduct && missingReportOperation ? (
              <View className="mt-2.5">
                <CatalogReportConfirmation
                  input={missingReportOperation.input}
                  busy={reportingMissingProduct}
                  confirmDisabled={missingProductName.trim().length < 2}
                  onCancel={() => {
                    setMissingReportOperation((current) => cancelCatalogReportOperation(current));
                    setConfirmingMissingProduct(false);
                  }}
                  onConfirm={() => void reportMissingProduct()}
                >
                  <Text variant="label" tone="muted">
                    Confirm or edit the name printed on the product.
                  </Text>
                  <TextInput
                    accessibilityLabel="Product name for report"
                    value={missingProductName}
                    onChangeText={(next) => {
                      if (reportingMissingProduct) return;
                      setMissingProductName(next);
                      setMissingProductFeedback(null);
                      setMissingReportOperation((current) =>
                        current
                          ? editCatalogReportOperation(current, missingReportDraft(next))
                          : current,
                      );
                    }}
                    editable={!reportingMissingProduct}
                    maxLength={120}
                    autoCapitalize="words"
                    placeholder="Product name"
                    placeholderTextColor={colors.mutedLight}
                    className="mt-2 min-h-[48px] rounded-[12px] border border-hairline bg-paper px-3 font-sans-medium text-[15px] text-ink"
                  />
                </CatalogReportConfirmation>
              </View>
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
            const reportDraft = wrongMatchReportInput(product);
            const reportOperation = wrongMatchReportOperations.get(key);
            const confirmingThisMatch = confirmingWrongMatchId === key;
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
                    accessibilityState={{ disabled: reportBusy }}
                    disabled={reportBusy}
                    onPress={() => chooseProduct(product)}
                    className="min-h-[48px] flex-1 basis-[148px] items-center justify-center rounded-pill bg-ink px-4 py-2"
                  >
                    <Text variant="bodySm" tone="inverse" className="font-sans-semibold">
                      Use this match
                    </Text>
                  </Pressable>
                  {reportDraft ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{
                        busy: reportingThisMatch,
                        disabled: reportBusy,
                      }}
                      disabled={reportBusy}
                      onPress={() => openWrongMatchConfirmation(product)}
                      className="min-h-[48px] flex-1 basis-[148px] items-center justify-center rounded-pill border border-hairline bg-paper px-4 py-2"
                    >
                      <Text variant="bodySm" tone="clay" className="font-sans-semibold">
                        Not this product
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                {confirmingThisMatch && reportOperation ? (
                  <View className="mt-2.5">
                    <CatalogReportConfirmation
                      input={reportOperation.input}
                      busy={reportingThisMatch}
                      onCancel={() => {
                        const retained = cancelCatalogReportOperation(reportOperation);
                        setWrongMatchReportOperations((current) => {
                          const next = new Map(current);
                          if (retained) next.set(key, retained);
                          else next.delete(key);
                          return next;
                        });
                        setConfirmingWrongMatchId(null);
                      }}
                      onConfirm={() => void reportWrongMatch(product)}
                    />
                  </View>
                ) : null}
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
        <Button label="Add by hand" variant="ghost" disabled={reportBusy} onPress={goManual} />
      </View>
    </Screen>
  );
}
