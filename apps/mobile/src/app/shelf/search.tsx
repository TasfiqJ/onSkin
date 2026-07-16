import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { memo, Profiler, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputChangeEventData,
} from 'react-native';

import { Button, RouteIconButton, Screen, StateLoading, StateNotice, Text } from '@/components/ui';
import { parseIngredientText } from '@/features/catalog/ingredientParser';
import {
  catalogIntakeProvenance,
  reportCatalogIssue,
  searchCatalog,
  type CatalogProductSummary,
} from '@/features/catalog/client';
import { catalogQualityLabel, sourceDisplayName } from '@/features/catalog/copy';
import type { CatalogQualityGrade } from '@/features/catalog/quality';
import {
  CATALOG_SEARCH_MAX_QUERY_LENGTH,
  isCatalogSearchQueryEligible,
  normalizeCatalogSearchQuery,
} from '@/features/catalog/searchQuery';
import { CatalogSearchRequestCoordinator } from '@/features/catalog/searchRequestCoordinator';
import {
  readCatalogSearchRenderDiagnostics,
  recordCatalogSearchCancelled,
  recordCatalogSearchCardRender,
  recordCatalogSearchComposerCommit,
  recordCatalogSearchDraftChange,
  recordCatalogSearchDuplicateSubmit,
  recordCatalogSearchPublished,
  recordCatalogSearchResultsCommit,
  recordCatalogSearchStarted,
} from '@/features/catalog/searchRenderDiagnostics';
import { trackProductAddStarted } from '@/features/shelf/analytics';
import { PRODUCT_CATEGORIES, type ProductCategory } from '@/features/shelf/categories';
import { useIntake } from '@/features/shelf/IntakeContext';
import { track } from '@/lib/analytics/track';
import { BRAND } from '@/lib/brand';
import { cn } from '@/lib/cn';
import { APP_SHELF_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { isRequestCancellation } from '@/lib/network/requestPolicy';
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

type FeedbackCopy = Readonly<{
  title: string;
  message: string;
}>;

type WrongMatchFeedback = FeedbackCopy &
  Readonly<{
    productKey: string;
  }>;

type CatalogSearchNotice = Readonly<{
  kind: 'empty' | 'offline' | 'error';
  title: string;
  body: string;
}>;

function normalizeCategory(value: string | null | undefined): ProductCategory | null {
  return value && categoryIds.has(value as ProductCategory) ? (value as ProductCategory) : null;
}

function normalizeQuality(value: string | null | undefined): CatalogQualityGrade {
  return value && qualityGrades.has(value) ? (value as CatalogQualityGrade) : 'unverified';
}

function productKey(product: CatalogProductSummary): string {
  return product.id ?? `${product.source}-${product.barcode}-${product.name}`;
}

function publishCatalogSearchRenderDiagnostics(): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__ || typeof document === 'undefined') return;

  const results = document.getElementById('catalog-search-results');
  if (!results) return;
  const diagnostics = readCatalogSearchRenderDiagnostics();
  results.setAttribute('data-catalog-composer-commits', String(diagnostics.composerCommits));
  results.setAttribute(
    'data-catalog-composer-duration-total-ms',
    String(diagnostics.composerDurationTotalMs),
  );
  results.setAttribute(
    'data-catalog-composer-duration-max-ms',
    String(diagnostics.composerDurationMaxMs),
  );
  results.setAttribute('data-catalog-draft-changes', String(diagnostics.draftChanges));
  results.setAttribute('data-catalog-results-commits', String(diagnostics.resultsCommits));
  results.setAttribute('data-catalog-card-renders', String(diagnostics.cardRenders));
  results.setAttribute('data-catalog-search-starts', String(diagnostics.searchStarts));
  results.setAttribute('data-catalog-cancellations', String(diagnostics.cancellations));
  results.setAttribute('data-catalog-publications', String(diagnostics.publications));
  results.setAttribute('data-catalog-duplicate-submits', String(diagnostics.duplicateSubmits));
}

function recordCatalogComposerProfilerCommit(
  _id: string,
  _phase: 'mount' | 'update' | 'nested-update',
  actualDuration: number,
): void {
  recordCatalogSearchComposerCommit(actualDuration);
  publishCatalogSearchRenderDiagnostics();
}

function recordCatalogResultsProfilerCommit(): void {
  recordCatalogSearchResultsCommit();
  publishCatalogSearchRenderDiagnostics();
}

type CatalogSearchComposerProps = Readonly<{
  initialQuery: string;
  searching: boolean;
  onDraftChange: (draft: string) => void;
  onSubmit: (draft: string) => void;
}>;

const CatalogSearchComposer = memo(function CatalogSearchComposer({
  initialQuery,
  searching,
  onDraftChange,
  onSubmit,
}: CatalogSearchComposerProps) {
  const initialDraft = normalizeCatalogSearchQuery(initialQuery);
  const [draft, setDraft] = useState(initialDraft);
  const draftRef = useRef(initialDraft);
  const canSubmit = isCatalogSearchQueryEligible(draft);
  const canPressSearch = canSubmit && !searching;

  const updateDraft = useCallback(
    (next: string) => {
      const bounded = next.slice(0, CATALOG_SEARCH_MAX_QUERY_LENGTH);
      if (bounded === draftRef.current) return;
      draftRef.current = bounded;
      recordCatalogSearchDraftChange();
      setDraft(bounded);
      onDraftChange(bounded);
    },
    [onDraftChange],
  );

  const handleNativeChange = useCallback(
    (event: NativeSyntheticEvent<TextInputChangeEventData> & { target?: { value?: string } }) => {
      const next = event.nativeEvent.text ?? event.target?.value;
      if (typeof next === 'string') updateDraft(next);
    },
    [updateDraft],
  );

  const submitDraft = useCallback(() => {
    if (isCatalogSearchQueryEligible(draftRef.current)) onSubmit(draftRef.current);
  }, [onSubmit]);

  return (
    <View className="mt-4 flex-row items-center gap-2">
      <TextInput
        accessibilityLabel="Catalog search query"
        value={draft}
        maxLength={CATALOG_SEARCH_MAX_QUERY_LENGTH}
        onChange={handleNativeChange}
        onChangeText={updateDraft}
        onSubmitEditing={submitDraft}
        placeholder="Brand or product name"
        placeholderTextColor={colors.mutedLight}
        className="h-[50px] min-w-0 flex-1 rounded-[14px] border border-hairline bg-paper-raised px-4 font-sans-medium text-[15px] text-ink"
        returnKeyType="search"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ busy: searching, disabled: !canPressSearch }}
        disabled={!canPressSearch}
        onPress={submitDraft}
        className={cn(
          'h-[50px] min-w-[72px] shrink-0 items-center justify-center rounded-[14px] px-3',
          canPressSearch ? 'bg-ink' : 'bg-greige-chip',
        )}
      >
        <Text
          className="font-sans-semibold text-[14px]"
          tone={canPressSearch ? 'inverse' : 'muted'}
        >
          Search
        </Text>
      </Pressable>
    </View>
  );
});

type CatalogResultCardProps = Readonly<{
  product: CatalogProductSummary;
  reporting: boolean;
  feedback: FeedbackCopy | null;
  onChoose: (product: CatalogProductSummary) => void;
  onReport: (product: CatalogProductSummary) => void;
}>;

const CatalogResultCard = memo(function CatalogResultCard({
  product,
  reporting,
  feedback,
  onChoose,
  onReport,
}: CatalogResultCardProps) {
  recordCatalogSearchCardRender();

  return (
    <View className="rounded-[16px] border border-hairline bg-paper-raised px-4 py-3.5">
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
          onPress={() => onChoose(product)}
          className="min-h-[48px] flex-1 basis-[148px] items-center justify-center rounded-pill bg-ink px-4 py-2"
        >
          <Text variant="bodySm" tone="inverse" className="font-sans-semibold">
            Use this match
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: reporting, disabled: reporting }}
          disabled={reporting}
          onPress={() => onReport(product)}
          className="min-h-[48px] flex-1 basis-[148px] items-center justify-center rounded-pill border border-hairline bg-paper px-4 py-2"
        >
          <Text variant="bodySm" tone="clay" className="font-sans-semibold">
            {reporting ? 'Sending report...' : 'Not this product'}
          </Text>
        </Pressable>
      </View>
      {feedback ? (
        <View accessibilityRole="alert" className="mt-2.5 rounded-[14px] bg-clay-tint px-4 py-3">
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
});

export default function CatalogSearchScreen() {
  const { update, reset } = useIntake();
  const isFocused = useIsFocused();
  const { e2eQuery } = useLocalSearchParams<{ e2eQuery?: string | string[] }>();
  const rawE2EQuery = Array.isArray(e2eQuery) ? e2eQuery[0] : (e2eQuery ?? '');
  const initialSearchQuery = normalizeCatalogSearchQuery(
    typeof __DEV__ !== 'undefined' && __DEV__ && Platform.OS === 'web' ? rawE2EQuery : '',
  );
  const autoSearchStarted = useRef(false);
  const searchRequestsRef = useRef<CatalogSearchRequestCoordinator | null>(null);
  searchRequestsRef.current ??= new CatalogSearchRequestCoordinator();
  const searchRequests = searchRequestsRef.current;
  const mounted = useRef(true);
  const latestDraftRef = useRef(initialSearchQuery);
  const reportingWrongMatchIdRef = useRef<string | null>(null);
  const [results, setResults] = useState<CatalogProductSummary[]>([]);
  const [notice, setNotice] = useState<CatalogSearchNotice | null>(null);
  const [lastNoMatchQuery, setLastNoMatchQuery] = useState<string | null>(null);
  const [reportingMissingProduct, setReportingMissingProduct] = useState(false);
  const [missingProductFeedback, setMissingProductFeedback] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [reportingWrongMatchId, setReportingWrongMatchId] = useState<string | null>(null);
  const [wrongMatchFeedback, setWrongMatchFeedback] = useState<WrongMatchFeedback | null>(null);
  const [searching, setSearching] = useState(false);

  const abortActiveSearch = useCallback(
    (publishIdle = true) => {
      if (!searchRequests.cancel()) return false;
      recordCatalogSearchCancelled();
      if (publishIdle && mounted.current) setSearching(false);
      publishCatalogSearchRenderDiagnostics();
      return true;
    },
    [searchRequests],
  );

  const handleDraftChange = useCallback(
    (draft: string) => {
      latestDraftRef.current = draft;
      const active = searchRequests.current();
      if (active && normalizeCatalogSearchQuery(draft) !== active.query) abortActiveSearch();
    },
    [abortActiveSearch, searchRequests],
  );

  const runSearch = useCallback(
    async (submittedQuery: string) => {
      const cleaned = normalizeCatalogSearchQuery(submittedQuery);
      if (!isCatalogSearchQueryEligible(cleaned)) return;

      const begin = searchRequests.begin(cleaned);
      if (begin.kind === 'duplicate') {
        recordCatalogSearchDuplicateSubmit();
        publishCatalogSearchRenderDiagnostics();
        return;
      }
      if (begin.superseded) {
        recordCatalogSearchCancelled();
        publishCatalogSearchRenderDiagnostics();
      }

      const { controller } = begin.request;
      recordCatalogSearchStarted();
      setSearching(true);
      setNotice(null);
      setLastNoMatchQuery(null);
      setMissingProductFeedback(null);
      setWrongMatchFeedback(null);
      try {
        const response = await searchCatalog(cleaned, { signal: controller.signal });
        if (!searchRequests.canPublish(controller, mounted.current)) return;
        track('catalog_search', { result: response.result });
        setResults(response.products ?? []);
        const noProducts = !response.products?.length;
        setNotice(
          response.result === 'offline'
            ? {
                kind: 'offline',
                title: 'Catalog offline',
                body: "Couldn't reach the product catalog. Your Shelf still works, and you can add this product by hand.",
              }
            : response.result === 'error'
              ? {
                  kind: 'error',
                  title: 'Catalog search failed',
                  body: "Couldn't search the product catalog. Add this product by hand or try again.",
                }
              : noProducts
                ? {
                    kind: 'empty',
                    title: 'No catalog match',
                    body: 'No reviewed catalog match yet. Add it by hand for now.',
                  }
                : null,
        );
        if (response.result === 'no_match' && noProducts) setLastNoMatchQuery(cleaned);
        if (noProducts) track('catalog_lookup_no_match', { lookup_type: 'search' });
        recordCatalogSearchPublished();
      } catch (error) {
        if (!searchRequests.canPublish(controller, mounted.current) || isRequestCancellation(error))
          return;
        track('catalog_search', { result: 'error' });
        setResults([]);
        setNotice({
          kind: 'error',
          title: 'Catalog search failed',
          body: "Couldn't search the product catalog. Add this product by hand or try again.",
        });
        recordCatalogSearchPublished();
      } finally {
        if (searchRequests.finish(controller) && mounted.current) setSearching(false);
      }
    },
    [searchRequests],
  );

  const submitSearch = useCallback(
    (draft: string) => {
      void runSearch(draft);
    },
    [runSearch],
  );

  useEffect(() => {
    if (!isFocused || !initialSearchQuery || autoSearchStarted.current) return;
    autoSearchStarted.current = true;
    void runSearch(initialSearchQuery);
  }, [initialSearchQuery, isFocused, runSearch]);

  useLayoutEffect(() => {
    if (!isFocused) abortActiveSearch();
  }, [abortActiveSearch, isFocused]);

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abortActiveSearch(false);
    };
  }, [abortActiveSearch]);

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

  const reportWrongMatch = useCallback(async (product: CatalogProductSummary) => {
    const key = productKey(product);
    if (reportingWrongMatchIdRef.current) return;

    reportingWrongMatchIdRef.current = key;
    setReportingWrongMatchId(key);
    setWrongMatchFeedback(null);
    const sourceName = sourceDisplayName(product.source);
    try {
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
      if (mounted.current) {
        setWrongMatchFeedback({
          productKey: key,
          ...(result.ok ? CATALOG_WRONG_MATCH_SENT : CATALOG_WRONG_MATCH_NOT_SENT),
        });
      }
    } catch {
      if (mounted.current) {
        setWrongMatchFeedback({ productKey: key, ...CATALOG_WRONG_MATCH_NOT_SENT });
      }
    } finally {
      reportingWrongMatchIdRef.current = null;
      if (mounted.current) setReportingWrongMatchId(null);
    }
  }, []);

  const goManual = useCallback(() => {
    haptics.select();
    trackProductAddStarted('catalog_manual');
    reset({ addedVia: 'manual', name: latestDraftRef.current.trim() });
    router.replace('/shelf/manual');
  }, [reset]);

  const chooseProduct = useCallback(
    (product: CatalogProductSummary) => {
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
        catalogSourceName:
          product.catalog_sources?.display_name ?? sourceDisplayName(product.source),
        catalogSourceRef: product.source_ref ?? null,
        catalogSourceUrl: product.source_url ?? null,
        catalogSourceSnapshotDate: product.source_snapshot_date ?? null,
        catalogMatchQuality: normalizeQuality(product.quality_grade),
        dataQualityScore: product.data_quality_score ?? null,
        ingredientParseStatus: parsed?.status ?? product.ingredient_parse_status ?? null,
        ingredientParseConfidence:
          parsed?.confidence ?? product.ingredient_parse_confidence ?? null,
        parserVersion: parsed?.parserVersion ?? null,
        sourceDisclosureAckAt: new Date().toISOString(),
        ingredients: parsed?.tokens.map((token) => token.displayName) ?? [],
        paoMonths: provenance.paoMonths,
        paoSource: provenance.paoSource,
        expiryDate: provenance.expiryDate,
        addedVia: 'search',
      });
      router.push('/shelf/opened');
    },
    [update],
  );

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

      <Profiler id="catalog-search-composer" onRender={recordCatalogComposerProfilerCommit}>
        <CatalogSearchComposer
          initialQuery={initialSearchQuery}
          searching={searching}
          onDraftChange={handleDraftChange}
          onSubmit={submitSearch}
        />
      </Profiler>

      <Text variant="bodySm" tone="muted" className="mt-3">
        Search uses the {BRAND.appName} catalog only. Public API search is not used for live typing.
      </Text>

      <Profiler id="catalog-search-results" onRender={recordCatalogResultsProfilerCommit}>
        <ScrollView
          nativeID="catalog-search-results"
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-4"
        >
          {searching ? (
            <StateLoading label="Searching the catalog..." className="mt-6 py-6" />
          ) : notice ? (
            <StateNotice
              kind={notice.kind}
              className="mt-4"
              title={notice.title}
              body={notice.body}
            >
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
            </StateNotice>
          ) : null}

          <View className="mt-4 gap-2.5">
            {searching
              ? null
              : results.map((product) => {
                  const key = productKey(product);
                  return (
                    <CatalogResultCard
                      key={key}
                      product={product}
                      reporting={reportingWrongMatchId === key}
                      feedback={wrongMatchFeedback?.productKey === key ? wrongMatchFeedback : null}
                      onChoose={chooseProduct}
                      onReport={reportWrongMatch}
                    />
                  );
                })}
          </View>
        </ScrollView>
      </Profiler>

      <View className="pb-8 pt-2">
        <Button label="Add by hand" variant="ghost" onPress={goManual} />
      </View>
    </Screen>
  );
}
