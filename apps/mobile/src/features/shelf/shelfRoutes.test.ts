import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

function readFeatureFile(path: string): string {
  return readFileSync(fileURLToPath(new URL(`./${path}`, import.meta.url)), 'utf8');
}

function expectShelfFallback(route: string): void {
  const source = readAppRoute(route);

  expect(source, `${route} should not rely on direct-entry history`).not.toContain('router.back()');
  expect(source, `${route} should know how to return to Shelf`).toContain('APP_SHELF_ROUTE');
}

function expectTouchableRouteIcon(route: string): void {
  const source = readAppRoute(route);

  expect(source, `${route} should use the shared 44pt route icon button`).toContain(
    'RouteIconButton',
  );
  expect(source, `${route} should not keep 30px route controls`).not.toContain('h-[30px]');
  expect(source, `${route} should not keep 34px route controls`).not.toContain('h-[34px]');
  expect(source, `${route} should not keep text-only route escapes`).not.toMatch(
    /<Text[^>]+onPress=\{\(\) => backOrReplace\(router, APP_SHELF_ROUTE\)\}/,
  );
}

describe('Shelf route mobile contracts', () => {
  it('keeps the intuitive /shelf/add path on the manual-add intake surface', () => {
    const source = readAppRoute('shelf/add.tsx');

    expect(source).toContain('Redirect');
    expect(source).toContain('href="/shelf/manual"');
    expect(source).not.toContain('This product is no longer on your shelf');
  });

  it('keeps direct-entry Shelf screens safe for no-history launches', () => {
    for (const route of [
      'shelf/[id].tsx',
      'shelf/archive.tsx',
      'shelf/search.tsx',
      'shelf/manual.tsx',
      'shelf/ocr.tsx',
      'shelf/scan.tsx',
      'shelf/catalog-recovery.tsx',
      'shelf/no-match.tsx',
      'shelf/opened.tsx',
      'shelf/replenish.tsx',
    ]) {
      expectShelfFallback(route);
    }
  });

  it('keeps Shelf route escape controls touchable on phones', () => {
    for (const route of [
      'shelf/[id].tsx',
      'shelf/archive.tsx',
      'shelf/search.tsx',
      'shelf/manual.tsx',
      'shelf/ocr.tsx',
      'shelf/scan.tsx',
      'shelf/catalog-recovery.tsx',
    ]) {
      expectTouchableRouteIcon(route);
    }
  });

  it('keeps scan fallback rows complete on compact text-pressure phones', () => {
    const source = readAppRoute('shelf/scan.tsx');

    expect(source).toContain('const { height, width } = useWindowDimensions();');
    expect(source).toContain(
      'const supportFloorTextPressureScan = width <= 430 && height >= 640 && height <= 700;',
    );
    expect(source).toContain('const splitShortScanSurface = height < 460;');
    expect(source).toContain('const compactScanSurface = height < 640');
    expect(source).toContain('hideSubtitle={compactScanSurface}');
    expect(source).toContain('hideSubtitle?: boolean;');
    expect(source).toContain('accessibilityLabel?: string;');
    expect(source).toContain('accessibilityLabel={accessibilityLabel ?? `${title}. ${subtitle}`}');
    expect(source).toContain(
      "compact\n          ? 'min-h-[48px] flex-row items-center gap-2.5 rounded-[15px] px-2.5 py-1.5'",
    );
    expect(source).toContain('{hideSubtitle ? null : (');
    expect(source).not.toContain("? 'flex-row items-center gap-3 rounded-[16px] px-3 py-2.5'");
  });

  it('keeps add and replenishment sheets scrollable on short phones', () => {
    for (const route of ['shelf/no-match.tsx', 'shelf/opened.tsx', 'shelf/replenish.tsx']) {
      const source = readAppRoute(route);

      expect(source, `${route} should opt into capped-sheet scrolling`).toContain('scroll');
      expect(source, `${route} should declare a Shelf fallback`).toContain(
        route === 'shelf/opened.tsx'
          ? 'fallbackRoute={fallbackRoute}'
          : 'fallbackRoute={APP_SHELF_ROUTE}',
      );
    }
  });

  it('does not rely on a tiny exposed backdrop as the only close control on short sheets', () => {
    for (const route of ['shelf/no-match.tsx', 'shelf/opened.tsx']) {
      const source = readAppRoute(route);

      expect(source, `${route} should provide a visible 44pt close affordance`).toContain(
        'RouteIconButton',
      );
      expect(source, `${route} should label the visible sheet close action`).toContain(
        'accessibilityLabel="Close"',
      );
      expect(source, `${route} should return direct entries to Shelf`).toContain(
        route === 'shelf/opened.tsx'
          ? 'backOrReplace(router, fallbackRoute)'
          : 'backOrReplace(router, APP_SHELF_ROUTE)',
      );
    }

    const noMatchSource = readAppRoute('shelf/no-match.tsx');
    expect(noMatchSource).toContain('tone="night"');
    expect(noMatchSource).toContain('fallbackRoute={APP_SHELF_ROUTE}');
    expect(noMatchSource).toContain('scroll');
    expect(noMatchSource).toContain('backdropAccessible={false}');
  });

  it('keeps barcode no-match recovery from dead-ending before manual add', () => {
    const source = readAppRoute('shelf/no-match.tsx');

    expect(source).toContain('useLocalSearchParams');
    expect(source).toContain('reportCatalogIssue');
    expect(source).toContain('barcodeRecoveryReportInput');
    expect(source).toContain('const barcode =');
    expect(source).toContain('const wrongProductId =');
    expect(source).toContain(
      'const reportDraft = barcodeRecoveryReportInput({ barcode, wrongProductId });',
    );
    expect(source).toContain("trackProductAddStarted('miss_search')");
    expect(source).toContain("reset({ addedVia: 'search', barcode })");
    expect(source).toContain("reset({ addedVia: 'ocr', barcode })");
    expect(source).toContain("router.replace('/shelf/search')");
    expect(source).toContain("reset({ addedVia: 'manual', barcode })");
    expect(source).toContain('Search catalog');
    expect(source).toContain('Add the ingredient list');
    expect(source).toContain('Add it by hand');
    expect(source).toContain('Report missing product');
    expect(source).toContain('const reportSubmissionInFlight = useRef(false);');
    expect(source).toContain('const [confirmingReport, setConfirmingReport] = useState(false);');
    expect(source).toContain('openReportConfirmation');
    expect(source).toContain('reportSubmissionInFlight.current = true;');
    expect(source).toContain('createCatalogReportOperation(reportDraft)');
    expect(source).toContain('reportCatalogIssue(attempted.input)');
    expect(source).toContain('{reportDraft ? (');
    expect(source).toContain('<CatalogReportConfirmation');
    expect(source).toContain('tone="night"');
    expect(source).toContain('onConfirm={() => void reportMissingProduct()}');
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).not.toContain('Alert.alert');

    const analytics = readFeatureFile('analytics.ts');

    expect(analytics).toContain("'miss_search'");
  });

  it('keeps catalog search wrong-match reporting obvious before add', () => {
    const source = readAppRoute('shelf/search.tsx');

    expect(source).toContain('reportCatalogIssue');
    expect(source).toContain('const reportWrongMatch = async (product: CatalogProductSummary)');
    expect(source).toContain('const openWrongMatchConfirmation');
    expect(source).toContain('useLocalSearchParams');
    expect(source).toContain("typeof __DEV__ !== 'undefined' && __DEV__ && Platform.OS === 'web'");
    expect(source).toContain('initialSearchQuery.slice(0, 120)');
    expect(source).toContain('const autoSearchStarted = useRef(false);');
    expect(source).toContain('void runSearch(initialSearchQuery);');
    expect(source).toContain("correctionType: 'wrong_match'");
    expect(source).toContain('wrong_match reported from catalog search result');
    expect(source).toContain('productId: product.id');
    expect(source).toContain('barcode: product.barcode');
    expect(source).toContain('sourceName');
    expect(source).toContain('sourceUrl: product.source_url ?? null');
    expect(source).toContain("route: 'shelf_search'");
    expect(source).toContain('catalogReportFeedback(outcome)');
    expect(source).toContain('<CatalogReportConfirmation');
    expect(source).toContain('onConfirm={() => void reportWrongMatch(product)}');
    expect(source).toContain('Use this match');
    expect(source).toContain('Not this product');
    expect(source).toContain('min-h-[48px] flex-1 basis-[148px]');
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).toContain(
      "reset({ addedVia: 'manual', name: query.trim(), barcode: draft.barcode })",
    );
    expect(source).not.toContain('Alert.alert');
    expect(source).not.toContain('import { Alert');
  });

  it('keeps barcode no-match recovery visible on the shortest supported phones', () => {
    const source = readAppRoute('shelf/no-match.tsx');

    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('const { height, width } = useWindowDimensions();');
    expect(source).toContain('const shortPhone = height < 700 || width <= 430;');
    expect(source).toContain('const ultraShortPhone = height < 560 || width <= 320;');
    expect(source).toContain('const supportFloorPhone = width <= 320 && height < 520;');
    expect(source).toContain('const splitShortPhone = height < 410;');
    expect(source).toContain('const microShortPhone = height < 380;');
    expect(source).toContain('const tallTextPressurePhone =');
    expect(source).toContain('(width <= 430 && height >= 900 && height < 980) ||');
    expect(source).toContain('(height <= 430 && width >= 900 && width < 980);');
    expect(source).toContain('const compactPressurePhone = shortPhone;');
    expect(source).toContain('const showScanRecovery = !supportFloorPhone;');
    expect(source).toContain("? 'min-h-[320px] px-6 pb-2 pt-2'");
    expect(source).toContain("? 'min-h-[320px] px-6 pb-3 pt-2'");
    expect(source).toMatch(/:\s*shortPhone\s*\?\s*'min-h-\[340px\] px-6 pb-4 pt-2'/);
    expect(source).toContain("? 'absolute right-0 top-0 z-10'");
    expect(source).toContain(
      "microShortPhone ? undefined : 'flex-row items-start justify-between'",
    );
    expect(source).toContain('{microShortPhone ? null : (');
    expect(source).toContain("ultraShortPhone\n              ? 'mb-0'");
    expect(source).toContain('{!shortPhone ? (');
    expect(source).toContain("? 'Not the right product.'");
    expect(source).toContain("? 'Not found yet.'");
    expect(source).toContain("? 'pr-12 text-[19px] leading-[22px]'");
    expect(source).toContain("? 'text-[21px] leading-[24px]'");
    expect(source).toContain("? 'mt-1 gap-1'");
    expect(source).toContain("? 'mt-2 gap-1'");
    expect(source).toContain(
      'const compactSecondaryRecoveryStyle = microShortPhone ? { marginTop: 24 } : undefined;',
    );
    expect(source).toContain('? { marginTop: 24 }');
    expect(source).toContain('const compactScanRecoveryStyle = undefined;');
    expect(source).toContain('const compactManualRecoveryStyle = supportFloorPhone');
    expect(source).toContain('? undefined');
    expect(source).toContain('{showScanRecovery ? (');
    expect(source).toContain('<View style={compactSecondaryRecoveryStyle}>');
    expect(source).toContain('? { marginTop: 40 }');
    expect(source).toContain('tallTextPressurePhone');
    expect(source).toContain('? { marginTop: 64 }');
    expect(source).not.toContain('translateY');
    expect(source).toContain('<View style={compactManualRecoveryStyle}>');
    expect(source).toContain('style={compactScanRecoveryStyle}');
    expect(source).toContain("backgroundColor: 'rgba(244,239,231,0.08)'");
    expect(source).toContain('opacity: disabled ? 0.45 : 1');
    expect(source).toContain('accessibilityState={{ disabled }}');
    expect(source).toContain('compact={shortPhone}');
    expect(source).toContain('ultraCompact={shortPhone}');
    expect(source).toContain('hideSubtitle={compactPressurePhone}');
    expect(source).toContain('hideSubtitle?: boolean;');
    expect(source).toContain('{hideSubtitle ? null : (');
    expect(source).toContain(
      "title={compactPressurePhone ? 'Add ingredients' : 'Add the ingredient list'}",
    );
    expect(source).toContain(
      'accessibilityLabel="Add the ingredient list. Take a label photo or type it"',
    );
    expect(source).toContain('accessibilityLabel?: string;');
    expect(source).toContain('accessibilityLabel={accessibilityLabel ?? `${title}. ${subtitle}`}');
    expect(source).toContain("'min-h-[48px] gap-2.5 rounded-[15px] px-2.5 py-1.5'");
    expect(source).toContain('min-h-[54px]');
    expect(source).toContain('!shortPhone ? (');
  });

  it('keeps text exits buffered above 44px when a label is clearer than an icon', () => {
    const source = readAppRoute('shelf/replenish.tsx');

    expect(source).toContain('min-h-[48px] items-center justify-center py-2');
    expect(source).not.toContain('min-h-[44px] items-center justify-center py-2');
    expect(source).not.toContain('className="mt-3 items-center py-2"');
    expect(source).not.toContain('className="items-center py-2"');
  });

  it('keeps Shelf card replace nudges buffered above sub-pixel 44px targets', () => {
    const source = readAppRoute('(tabs)/shelf.tsx');

    expect(source).toContain('accessibilityLabel={`Replace ${item.name}`}');
    expect(source).toContain('className="rounded-[18px] bg-paper-raised p-4"');
    expect(source).toContain('className="flex-row items-center gap-3.5"');
    expect(source).toContain('ml-[64px] mt-2 min-h-[48px] min-w-[84px]');
    expect(source).toContain('border border-clay/20 bg-clay-tint');
    expect(source).toContain('minHeight: 48');
    expect(source).toContain('minWidth: 84');
    expect(source).not.toContain('ml-[64px] mt-2 min-h-[44px] min-w-[84px]');
    expect(source).not.toContain('minHeight: 44');
    expect(source).not.toContain('hitSlop={6}');
    expect(source).not.toContain('className="mt-1 self-start"');
    expect(source).not.toContain('event.stopPropagation()');
  });

  it('keeps the Shelf scan action from overlaying product cards on short phones', () => {
    const source = readAppRoute('(tabs)/shelf.tsx');

    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('const compactShelf = height < 640;');
    expect(source).toContain('<ScanShelfButton source="scan_inline" />');
    expect(source).not.toContain('source="scan_fab"');
    expect(source).not.toContain('className="absolute inset-x-0 bottom-4 items-center"');
  });

  it('keeps the compact no-archive empty Shelf usable in the first viewport', () => {
    const source = readAppRoute('(tabs)/shelf.tsx');

    expect(source).toContain('const compactShelf = height < 640;');
    expect(source).toContain('const shortShelf = height < 520');
    expect(source).toContain('const splitShortShelf = height < 410;');
    expect(source).toContain('const compactFilterLabels = compactShelf;');
    expect(source).toContain('function SkeletonShelf({ compactFilterLabels }');
    expect(source).toContain('<SkeletonShelf compactFilterLabels={compactFilterLabels} />');
    expect(source).toContain("label={compactFilterLabels && l === 'Expiring' ? '7d' : l}");
    expect(source).toContain("? '7d'");
    expect(source).toContain('accessibilityLabel={f ===');
    expect(source).toContain("className={compactFilterLabels ? 'px-2.5' : undefined}");
    expect(source).toContain('const isEmpty = !isLoading && items.length === 0;');
    expect(source).toContain('splitShort: boolean;');
    expect(source).toContain('splitShort={splitShortShelf}');
    expect(source).toContain('const compactNoArchiveShort = compact && !hasArchive && shortPhone;');
    expect(source).toContain(": splitShort\n              ? 'items-center px-2 pb-28 pt-0'");
    expect(source).toContain("? 'items-center px-2 pb-28 pt-2'");
    expect(source).toContain(": 'items-center px-2 pb-24 pt-7'");
    expect(source).toContain('{!splitShort ? (');
    expect(source).toContain("compactNoArchiveShort ? 'mb-3'");
    expect(source).toContain('width={compactNoArchiveShort ? 38 : 46}');
    expect(source).toContain('height={compactNoArchiveShort ? 56 : 68}');
    expect(source).toContain('Let&apos;s build your cabinet.');
    expect(source).toContain("? 'max-w-[280px] text-center text-[25px] leading-[29px]'");
    expect(source).toContain('Add what you already use. Scan a barcode, or add it by hand.');
    expect(source).toContain('We&apos;ll handle freshness');
    expect(source).toContain('Scan a barcode, or add it by hand.');
    expect(source).toContain("? 'mt-1.5 max-w-[270px] text-center text-[14px] leading-[19px]'");
    expect(source).toContain("compactNoArchiveShort ? 'mt-4 gap-2'");
    expect(source).toContain("trackProductAddStarted('empty_scan');");
    expect(source).toContain("router.push('/shelf/scan');");
    expect(source).toContain('className="h-14 items-center justify-center rounded-pill bg-ink"');
    expect(source).toContain("trackProductAddStarted('empty_manual');");
    expect(source).toContain("router.push('/shelf/manual');");
    expect(source).toContain("? 'h-[48px] items-center justify-center'");
    expect(source).toContain(": 'h-[50px] items-center justify-center'");
    expect(source).toContain('<ScanShelfButton source="scan_inline" />');
    expect(source).not.toContain('!isEmpty && !showLoading ? (');
  });

  it('surfaces a first-routine handoff once the shelf has real products', () => {
    const source = readAppRoute('(tabs)/shelf.tsx');

    expect(source).toContain('function RoutineHandoffCard');
    expect(source).toContain(
      '<RoutineHandoffCard hasConflict={Boolean(data?.banner)} productCount={items.length} />',
    );
    expect(source).toContain('First routine');
    expect(source).toContain('Build my routine');
    expect(source).toContain("router.push('/routine/plan')");
    expect(source).toContain('Missing steps stay visible, not invented.');
    expect(source).toContain('instead of making you remember it');
    expect(source).toContain('className="mt-3 min-h-[52px] py-3"');
  });

  it('recovers stale product-detail direct entries without a dead empty state', () => {
    const source = readAppRoute('shelf/[id].tsx');

    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('const compactMissingDetail = height < 640');
    expect(source).toContain(
      'const supportFloorTextPressureDetail = width <= 390 && height >= 640 && height < 700;',
    );
    expect(source).toContain(
      'const compactMissingDetail = height < 640 || supportFloorTextPressureDetail;',
    );
    expect(source).toContain('<ScrollView');
    expect(source).toContain('Product unavailable');
    expect(source).toContain('This product is no longer on your shelf.');
    expect(source).toContain('It may have been removed or archived on this device.');
    expect(source).toContain('Your Shelf is still safe.');
    expect(source).toContain('label="Back to Shelf"');
    expect(source).toContain('router.replace(APP_SHELF_ROUTE)');
    expect(source).toContain('label="Add a product"');
    expect(source).toContain('className="min-h-[52px] py-3"');
    expect(source).toContain("router.replace('/shelf/manual')");
    expect(source).not.toContain('<View className="flex-1 items-center justify-center">');
  });

  it('recovers stale replenishment direct entries without a close-only dead end', () => {
    const source = readAppRoute('shelf/replenish.tsx');

    expect(source).toContain('<Sheet fallbackRoute={APP_SHELF_ROUTE} scroll>');
    expect(source).toContain('This replacement prompt is no longer active.');
    expect(source).toContain('we won&apos;t reuse its');
    expect(source).toContain('Back to Shelf');
    expect(source).toContain('router.replace(APP_SHELF_ROUTE)');
    expect(source).toContain('Add a product');
    expect(source).toContain("router.replace('/shelf/manual')");
    expect(source).not.toContain('This product is no longer on your shelf.');
    expect(source).not.toContain('Close');
  });

  it('keeps replenishment copy tied to freshness without manufactured scarcity', () => {
    const source = readAppRoute('shelf/replenish.tsx');

    expect(source).toContain("const expired = item.badge.kind === 'expired';");
    expect(source).toContain("const countdown = item.badge.kind === 'countdown';");
    expect(source).toContain('may be past its best');
    expect(source).toContain('PAO or printed date');
    expect(source).toContain('calm replacement reminder, not an alarm');
    expect(source).toContain('No urgency is added.');
    expect(source).not.toContain('nearly finished');
    expect(source).not.toContain('running low');
    expect(source).not.toContain("don't run out");
  });

  it('keeps replenishment similar-options recovery inline after commerce consent', () => {
    const source = readAppRoute('shelf/replenish.tsx');

    expect(source).not.toContain('Alert.alert');
    expect(source).not.toContain('import { Alert');
    expect(source).toContain('CommerceLinkNotice');
    expect(source).toContain('feedback: CommerceLinkFeedback');
    expect(source).toContain('activeSimilarFeedback');
    expect(source).toContain('setSimilarFeedback({');
    expect(source).toContain('COMMERCE_COPY.whereToBuy.emptyState');
  });

  it('keeps archived products reachable when the active Shelf is empty', () => {
    const source = readAppRoute('(tabs)/shelf.tsx');

    expect(source).toContain('function EmptyShelf({');
    expect(source).toContain('archiveCount: number;');
    expect(source).toContain('compact: boolean;');
    expect(source).toContain('shortPhone: boolean;');
    expect(source).toContain('splitShort: boolean;');
    expect(source).toContain('splitShort={splitShortShelf}');
    expect(source).toContain('const hasArchive = archiveCount > 0;');
    expect(source).toContain('const compactWithArchive = compact && hasArchive;');
    expect(source).toContain('const compactNoArchiveShort = compact && !hasArchive && shortPhone;');
    expect(source).toContain(": splitShort\n              ? 'items-center px-2 pb-28 pt-0'");
    expect(source).toContain("? 'items-center px-2 pb-28 pt-2'");
    expect(source).toContain(': compactNoArchiveShort');
    expect(source).toContain(": 'items-center px-2 pb-24 pt-7'");
    expect(source).toContain(": 'flex-1 items-center justify-center px-2 pb-16'");
    expect(source).toContain('{!splitShort ? (');
    expect(source).toContain(
      "compactNoArchiveShort ? 'mb-3' : compactWithArchive ? 'mb-4' : 'mb-7'",
    );
    expect(source).toContain(
      "compactNoArchiveShort ? 'mt-4 gap-2' : compactWithArchive ? 'mt-5 gap-2' : 'mt-8 gap-3'",
    );
    expect(source).toContain('width={compactNoArchiveShort ? 38 : 46}');
    expect(source).toContain('height={compactNoArchiveShort ? 56 : 68}');
    expect(source).toContain('{hasArchive ? (');
    expect(source).toContain('accessibilityLabel={`View archive, ${archiveCount} archived ${');
    expect(source).toContain("archiveCount === 1 ? 'product' : 'products'");
    expect(source).toContain("router.push('/shelf/archive');");
    expect(source).toContain('className="min-h-[48px] items-center justify-center py-2"');
    expect(source).toContain('className="mt-6 min-h-[48px] items-center justify-center py-2"');
    expect(source).not.toContain('function EmptyShelf()');
    expect(source).not.toContain('<EmptyShelf />');
    expect(source).not.toContain('<EmptyShelf archiveCount={archiveCount} />');
    expect(source).not.toContain(
      '<EmptyShelf archiveCount={archiveCount} compact={compactShelf} />',
    );
    expect(source).not.toContain('className="mt-6 items-center py-2"');
  });

  it('keeps the Shelf scan torch switch buffered above sub-pixel 44px targets', () => {
    const source = readAppRoute('shelf/scan.tsx');

    expect(source).toContain('min-h-[48px] min-w-[48px] items-center justify-center px-2');
    expect(source).not.toContain('min-h-[44px] min-w-[44px] items-center justify-center px-2');
  });

  it('keeps the Shelf scan fallback readable on short phones without a fake reticle', () => {
    const source = readAppRoute('shelf/scan.tsx');

    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('const { height, width } = useWindowDimensions();');
    expect(source).toContain(
      'const supportFloorTextPressureScan = width <= 430 && height >= 640 && height <= 700;',
    );
    expect(source).toContain('const compactScanSurface = height < 640');
    expect(source).toContain('const splitShortScanSurface = height < 460;');
    expect(source).toContain('const showScanPreview = !splitShortScanSurface || canShowCamera;');
    expect(source).toContain('splitShortScanSurface ? { minHeight: 68 } : undefined');
    expect(source).toContain("{ position: 'relative', zIndex: 2 }");
    expect(source).toContain('{showScanPreview ? (');
    expect(source).toContain("title={compactScanSurface ? 'Scan label' : 'Scan ingredient label'}");
    expect(source).toContain(
      'accessibilityLabel="Scan ingredient label. Capture label, then type from it"',
    );
    expect(source).toContain("'h-[96px] w-full overflow-hidden rounded-[18px] bg-night-elevated'");
    expect(source).toContain("'h-[152px] w-full overflow-hidden rounded-[20px] bg-night-elevated'");
    expect(source).toContain('{canShowCamera ? (');
    expect(source).toContain("'absolute left-8 right-8 top-[34px] h-8 rounded-[12px]'");
    expect(source).toContain("'absolute left-8 right-8 top-[54px] h-11 rounded-[14px]'");
    expect(source).toContain('!compactScanSurface ? (');
    expect(source).toContain("'rounded-t-sheet bg-night-surface px-5 pb-4 pt-3'");
    expect(source).toContain("style={{ position: 'relative', zIndex: 1 }}");
    expect(source).toContain("state.kind === 'idle' && compactScanSurface ? null");
    expect(source).toContain("className={compactScanSurface ? 'gap-1.5' : 'gap-2.5'}");
    expect(source).toContain('subtitle="Capture label, then type from it"');
    expect(source).not.toContain('Review editable OCR');
    expect(source).toContain('title="Search catalog"');
    expect(source).toContain('subtitle="Use reviewed matches"');
    expect(source).toContain('compact={compactScanSurface}');
    expect(source).toContain('hideSubtitle={compactScanSurface}');
    expect(source).toContain('compact?: boolean;');
    expect(source).toContain('hideSubtitle?: boolean;');
    expect(source).toContain(
      "? 'min-h-[48px] flex-row items-center gap-2.5 rounded-[15px] px-2.5 py-1.5'",
    );
    expect(source).toContain('{hideSubtitle ? null : (');
    expect(source).toContain('numberOfLines={compact ? 1 : undefined}');
    expect(source).toContain('EXPO_PUBLIC_E2E_SHELF_CAMERA_PERMISSION');
    expect(source).toContain("devShelfCameraPermissionMode(): 'denied_no_retry' | null");
    expect(source).toContain('const [settingsOpenFailed, setSettingsOpenFailed] = useState(false)');
    expect(source).toContain('setSettingsOpenFailed(true)');
    expect(source).toContain('CAMERA_FAILURE_COPY.shelfSettingsTitle');
    expect(source).toContain('CAMERA_FAILURE_COPY.shelfSettingsBody');
    expect(source).toContain('alertOnFailure: false');
    expect(source).toContain('canShowPermissionRecovery');
    expect(source).toContain('canAskCameraPermission');
    expect(source).toContain(
      'min-h-[48px] items-center justify-center rounded-pill bg-paper px-5 py-3',
    );
    expect(source).not.toContain('title="Capture the ingredient label"');
    expect(source).not.toContain(
      '<View\n              className="absolute left-8 right-8 top-[118px] h-28 rounded-[18px]"',
    );
  });

  it('requests the system camera prompt only from the focused user-entered Scan route', () => {
    const source = readAppRoute('shelf/scan.tsx');

    expect(source).toContain('const permissionRequestStarted = useRef(false);');
    expect(source).toContain(
      'Entering Scan is the user-initiated context for the system permission',
    );
    expect(source).toMatch(
      /useEffect\(\(\) => \{[\s\S]*?!isFocused[\s\S]*?permission\?\.status !== 'undetermined'[\s\S]*?permissionRequestStarted\.current[\s\S]*?void requestPermission\(\)\.catch/,
    );
    expect(source).toContain('permissionRequestStarted.current = true;');
    expect(source).toContain("canAskCameraPermission ? 'Continue' : 'Open settings'");
    expect(source).not.toContain("'Allow camera'");
    expect(source).not.toContain('>Allow camera<');
  });

  it('fails a development external-candidate fixture closed without an Add action', () => {
    const source = readAppRoute('shelf/scan.tsx');
    const externalFixture = source.match(
      /case 'external_candidate':([\s\S]*?)case 'no_match':/,
    )?.[1];

    expect(externalFixture).toBeDefined();
    expect(externalFixture).toContain("kind: 'error'");
    expect(externalFixture).toContain('This catalog response is not eligible. Add it another way.');
    expect(externalFixture).not.toContain("kind: 'matched'");
    expect(externalFixture).not.toContain('Add this');
    expect(source).toContain("if (response.result === 'matched')");
    expect(source).not.toContain(
      "response.result === 'matched' || response.result === 'external_candidate'",
    );
    expect(source).toMatch(/state\.kind === 'matched'[\s\S]*?<Text[^>]*>Add this<\/Text>/);
  });

  it('distinguishes true scan no-match from offline lookup recovery', () => {
    const source = readAppRoute('shelf/scan.tsx');

    expect(source).toContain('EXPO_PUBLIC_E2E_SHELF_SCAN_RESULT');
    expect(source).toContain("typeof __DEV__ === 'undefined' || !__DEV__");
    expect(source).toContain("| { kind: 'offline'; barcode: string }");
    expect(source).toContain("case 'offline':");
    expect(source).toContain("return { kind: 'offline', barcode };");
    expect(source).toContain("if (response.result === 'offline')");
    expect(source).toContain("setState({ kind: 'offline', barcode: normalized.lookupValue });");
    expect(source).toContain(
      'function noMatchRoute(barcode: string, wrongProductId?: string | null)',
    );
    expect(source).toContain("pathname: '/shelf/no-match' as const");
    expect(source).toContain('...(wrongProductId ? { wrongProductId } : {})');
    expect(source).toContain('router.push(noMatchRoute(state.barcode))');
    expect(source).toContain('router.push(noMatchRoute(state.barcode, state.product.id))');
    expect(source).toContain('Barcode {state.barcode} is not in the catalog yet.');
    expect(source).toContain(
      'Couldn&apos;t reach the product catalog for barcode {state.barcode}.',
    );
    expect(source).toContain('the shelf still works offline');
    expect(source).toContain("{state.kind === 'no_match' && (");
    expect(source).not.toContain(
      "response.result === 'no_match' ||\n          response.result === 'too_short' ||\n          response.result === 'offline'",
    );
  });

  it('keeps the Shelf catalog search row inside narrow phones', () => {
    const source = readAppRoute('shelf/search.tsx');

    expect(source).toContain(
      'className="h-[50px] min-w-0 flex-1 rounded-[14px] border border-hairline bg-paper-raised px-4',
    );
    expect(source).toContain(
      "'h-[50px] min-w-[72px] shrink-0 items-center justify-center rounded-[14px] px-3'",
    );
    expect(source).not.toContain('className="h-[50px] flex-1 rounded-[14px]');
    expect(source).not.toContain("'h-[50px] items-center justify-center rounded-[14px] px-4'");
  });

  it('keeps the Shelf catalog manual fallback buffered above the phone bottom edge', () => {
    const source = readAppRoute('shelf/search.tsx');

    expect(source).toContain('className="flex-1"');
    expect(source).toContain('<View className="pb-8 pt-2">');
    expect(source).toContain('label="Add by hand"');
    expect(source).toContain('variant="ghost"');
    expect(source).toContain('disabled={reportBusy}');
    expect(source).toContain('onPress={goManual}');
    expect(source).toContain('reportCatalogIssue');
    expect(source).toContain('lastNoMatchQuery');
    expect(source).toContain('Report missing product');
    expect(source).toContain('missing_product reported from catalog search');
    expect(source).toContain('accessibilityLabel="Product name for report"');
    expect(source).toContain('Confirm or edit the name printed on the product.');
    expect(source).toContain(
      'const missingReportDraft = (productName: string): CatalogReportInput => ({',
    );
    expect(source).toContain('proposedPayload: { productName: productName.trim() }');
    expect(source).toContain('editCatalogReportOperation(current, missingReportDraft(next))');
    expect(source).toContain("route: 'shelf_search'");
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).toContain(
      "Couldn't reach the product catalog. Add this product by hand for now.",
    );
    expect(source).not.toContain('backend');
    expect(source).not.toContain(
      '\n      <Button label="Add by hand" variant="ghost" onPress={goManual} />\n    </Screen>',
    );
    expect(source).not.toContain('<View className="pb-4 pt-2">');
  });

  it('keeps Shelf manual add picker options clear of the fixed footer on short phones', () => {
    const source = readAppRoute('shelf/manual.tsx');

    expect(source).toContain('function CategoryPickerSheet');
    expect(source).toContain('if (!visible) return null;');
    expect(source).toContain('className="absolute inset-0 justify-end"');
    expect(source).toContain(
      "style={{ backgroundColor: 'rgba(32,27,21,0.4)', zIndex: 20, elevation: 20 }}",
    );
    expect(source).toContain('accessibilityLabel="Choose product category"');
    expect(source).toContain('accessibilityLabel="Dismiss category picker"');
    expect(source).toContain('accessibilityLabel="Close category picker"');
    expect(source).toContain('useSafeAreaInsets');
    expect(source).toContain('const { height: viewportHeight } = useWindowDimensions();');
    expect(source).toContain('Platform,');
    expect(source).toContain('useWindowDimensions,');
    expect(source).toContain('fontScale = 1,');
    expect(source).toContain('const ultraShortPhone = viewportHeight < 460;');
    expect(source).toContain('const splitShortPhone = viewportHeight < 410;');
    expect(source).toContain(
      "viewportWidth <= 390 && viewportHeight < 700 && (fontScale >= 1.3 || Platform.OS === 'web')",
    );
    expect(source).toContain(
      'const compactManualPhone = viewportHeight < 600 || supportFloorTextPressureManualPhone;',
    );
    expect(source).toContain(
      'const showManualIngredientsField = !supportFloorTextPressureManualPhone;',
    );
    expect(source).toContain('const insets = useSafeAreaInsets();');
    expect(source).toContain('const ultraShortSheet = viewportHeight < 460;');
    expect(source).toContain('const sheetMaxHeight = Math.max(0, viewportHeight - 48);');
    expect(source).toContain('insets.bottom > 0 ? Math.max(40, insets.bottom + 24) : undefined');
    expect(source).toContain('aria-modal');
    expect(source).toContain('role="dialog"');
    expect(source).toContain('accessibilityLabel="Choose product category"');
    expect(source).toContain('className="flex-1"');
    expect(source).toContain("splitShortPhone ? 'pb-40' : compactManualPhone ? 'pb-36' : 'pb-24'");
    expect(source).toContain('{!compactManualPhone ? (');
    expect(source).toContain("className={compactManualPhone ? 'gap-2' : 'gap-3'}");
    expect(source).toContain(
      "className={cn(inputClass, compactManualPhone ? 'h-[48px]' : 'h-[50px]')}",
    );
    expect(source).toContain("<View className={compactManualPhone ? 'pb-2 pt-1' : 'pb-3 pt-1'}>");
    expect(source).toContain("className={compactManualPhone ? 'min-h-[52px] py-3' : undefined}");
    expect(source).toContain(
      "return category === 'other' ? 'Other' : (categoryLabel(category) ?? 'Choose');",
    );
    expect(source).toContain('{categoryFieldLabel(category)}');
    expect(source).toMatch(
      /accessibilityLabel=\{\s*category\s*\?\s*`Category, \$\{categoryFieldLabel\(category\)\}`\s*:\s*'Category'\s*\}/,
    );
    expect(source).toContain("className={compactManualPhone ? 'flex-[0.82]' : 'flex-1'}");
    expect(source).toContain("className={compactManualPhone ? 'flex-[1.28]' : 'flex-[1.1]'}");
    expect(source).toContain("compactManualPhone ? 'h-[48px]' : 'h-[50px]'");
    expect(source).toContain(
      "compactManualPhone ? 'h-[48px] gap-0.5 px-2.5' : 'h-[50px] gap-1 px-3'",
    );
    expect(source).toContain('compactManualPhone');
    expect(source).toContain('const manualIngredientsDeferredStyle = splitShortPhone');
    expect(source).toContain('? { marginTop: 300 }');
    expect(source).toContain('? { marginTop: 616 }');
    expect(source).toContain('compactManualPhone\n      ? { marginTop: 616 }');
    expect(source).toContain('{showManualIngredientsField ? (');
    expect(source).toContain('style={manualIngredientsDeferredStyle}');
    expect(source).toContain('keyboardShouldPersistTaps="handled"');
    expect(source).toContain(
      'className="overflow-hidden rounded-t-sheet bg-paper px-6 pb-10 pt-4"',
    );
    expect(source).toContain('{ height: sheetMaxHeight, maxHeight: sheetMaxHeight }');
    expect(source).toContain('paddingBottom: sheetPaddingBottom');
    expect(source).toContain("'min-w-0 flex-1 font-sans-medium leading-[18px]'");
    expect(source).toContain("compactManualPhone ? 'text-[13px]' : 'text-[14px]'");
    expect(source).toContain('numberOfLines={1}');
    expect(source).toContain('ellipsizeMode="tail"');
    expect(source).toContain(
      'className="min-h-[52px] flex-row items-center justify-between rounded-[14px] border border-hairline bg-paper-raised px-4 py-3"',
    );
    expect(source).toContain("contentContainerClassName={ultraShortSheet ? 'pb-14' : 'pb-6'}");
    expect(source).toContain('keyboardShouldPersistTaps="handled"');
    expect(source).toContain('<CategoryPickerSheet');
    expect(source).not.toContain('const pickerSheetMaxHeight = Math.max(320, height - 48);');
    expect(source).not.toContain('sheetMaxHeight={pickerSheetMaxHeight}');
    expect(source).not.toContain('<View className="flex-[1.3]">');
    expect(source).not.toContain(
      "className={cn(inputClass, 'h-[50px] flex-row items-center justify-between')}",
    );
    expect(source).not.toContain('className="font-sans-medium text-[15px]"');
    expect(source).not.toContain('contentContainerClassName="pb-4"');
    expect(source).not.toContain('import { Modal');
    expect(source).not.toContain('<Modal');
    expect(source).not.toContain('animationType="slide"');
    expect(source).not.toContain("contentContainerClassName={pickerOpen ? 'pb-32' : 'pb-24'}");
    expect(source).not.toContain('contentContainerClassName="pb-24"');
    expect(source).not.toContain('nestedScrollEnabled');
    expect(source).not.toContain('style={{ maxHeight: 192 }}');
    expect(source).not.toContain("'flex-row items-center justify-between px-4 py-3'");
  });

  it('exposes an optional package barcode and blocks malformed manual values', () => {
    const source = readAppRoute('shelf/manual.tsx');

    expect(source).toContain('normalizeManualBarcode,');
    expect(source).toContain("const initialBarcode = presetCategory ? '' : (draft.barcode ?? '');");
    expect(source).toContain('const [barcode, setBarcode] = useState(initialBarcode);');
    expect(source).toContain('const normalizedBarcode = barcode.trim()');
    expect(source).toContain('normalizeManualBarcode(barcode, eightDigitFormat)');
    expect(source).toContain('const barcodeInvalid =');
    expect(source).toContain(
      'barcode.trim().length > 0 && !barcodeNeedsFormat && normalizedBarcode === null;',
    );
    expect(source).toContain(
      'const barcodeChecksumInvalid = normalizedBarcode?.validChecksum === false;',
    );
    expect(source).toContain(
      'name.trim().length > 0 && !barcodeNeedsFormat && !barcodeInvalid && !barcodeChecksumInvalid;',
    );
    expect(source).toContain('<FieldLabel>Barcode (optional)</FieldLabel>');
    expect(source).toContain('accessibilityLabel="Barcode, optional"');
    expect(source).toContain('accessibilityHint="Enter the numbers printed below the barcode"');
    expect(source).toContain('keyboardType="number-pad"');
    expect(source).toContain('inputMode="numeric"');
    expect(source).toContain('{barcodeInvalid || barcodeChecksumInvalid ? (');
    expect(source).toContain('Check the numbers. This barcode checksum does not match.');
    expect(source).toContain('Enter a complete 8, 12, 13, or 14 digit barcode from the package.');
    expect(source).toContain('barcode: normalizedBarcode?.lookupValue ?? null,');
  });

  it('keeps Shelf OCR manual review controls from overlapping on short phones', () => {
    const source = readAppRoute('shelf/ocr.tsx');

    expect(source).toContain('EXPO_PUBLIC_E2E_SHELF_OCR_CAPTURE_FAILURE');
    expect(source).toContain('EXPO_PUBLIC_E2E_SHELF_CAMERA_PERMISSION');
    expect(source).toContain("typeof __DEV__ === 'undefined' || !__DEV__");
    expect(source).toContain("new Error('E2E_SHELF_OCR_CAPTURE_FAILURE')");
    expect(source).toContain('const [labelCaptureFailed, setLabelCaptureFailed] = useState(false)');
    expect(source).toContain('const [settingsOpenFailed, setSettingsOpenFailed] = useState(false)');
    expect(source).toContain('setLabelCaptureFailed(true)');
    expect(source).toContain('setSettingsOpenFailed(true)');
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).toContain('CAMERA_FAILURE_COPY.labelCaptureTitle');
    expect(source).toContain('CAMERA_FAILURE_COPY.labelCaptureBody');
    expect(source).toContain('CAMERA_FAILURE_COPY.shelfSettingsTitle');
    expect(source).toContain('CAMERA_FAILURE_COPY.shelfSettingsBody');
    expect(source).toContain('Try label photo again');
    expect(source).toContain('const NATIVE_OCR_ADAPTER_AVAILABLE = false;');
    expect(source).toContain('On-device OCR is not enabled in this build yet.');
    expect(source).not.toContain('On-device OCR is enabled for this build.');
    expect(source).not.toContain('native_ocr_enabled: env.nativeOcrEnabled');
    expect(source).toContain('alertOnFailure: false');
    expect(source).toContain('canShowPermissionRecovery');
    expect(source).toContain('canAskCameraPermission');
    expect(source).toContain(
      'min-h-[48px] items-center justify-center rounded-pill bg-paper px-5 py-3',
    );
    expect(source).toContain('{canShowCamera || capturedUri ? (');
    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('const ultraShortPhone = viewportHeight < 460;');
    expect(source).toContain('const splitShortPhone = viewportHeight < 410;');
    expect(source).toContain("state === 'review' ? 'pb-28' : ultraShortPhone ? 'pb-3' : 'pb-5'");
    expect(source).toContain("? 'mt-2 h-[140px]'");
    expect(source).toContain(": ultraShortPhone\n                ? 'mt-3 h-[176px]'");
    expect(source).toContain("ultraShortPhone ? 'top-[48px] h-[78px]' : 'top-[64px] h-[96px]'");
    expect(source).toContain("className={ultraShortPhone ? 'min-h-[52px] py-3' : undefined}");
    expect(source).toContain('{!splitShortPhone ? (');
    expect(source).toContain("{state === 'review' ? (");
    expect(source).toContain(
      "label={photoCleanupBusy ? 'Removing temporary photo...' : 'Looks right. Continue'}",
    );
    expect(source).toContain('onPress={() => void onContinue()}');
    expect(source).toContain('disabled={!canContinue || photoCleanupBusy}');
    expect(source).not.toContain('Alert.alert(CAMERA_FAILURE_COPY.labelCaptureTitle');
    expect(source).not.toContain('contentContainerClassName="pb-5"');
  });

  it('keeps barcode lookup outcomes wired to the owner-scoped shelf scan log', () => {
    const source = readAppRoute('shelf/scan.tsx');

    expect(source).toContain(
      "import { recordShelfScan, shelfScanResultFromLookup } from '@/features/shelf/scanLog';",
    );
    expect(source).toContain('const scanResult = shelfScanResultFromLookup(response.result)');
    expect(source).toContain('void recordShelfScan({');
    expect(source).toContain(
      'if (scanResult !== null) void recordShelfScan({ result: scanResult });',
    );
    expect(source).not.toContain("shelfScanResultFromLookup('lookup_error')");
  });

  it('makes offline catalog retry an explicit accessible scan action', () => {
    const source = readAppRoute('shelf/scan.tsx');

    expect(source).toContain("state.kind === 'offline' || state.kind === 'error'");
    expect(source).toContain('const queueRetryWhenOnline = async () =>');
    expect(source).toContain('await enqueueCatalogLookup({');
    expect(source).toContain('onPress={() => void queueRetryWhenOnline()}');
    expect(source).toContain('accessibilityLabel={`Retry barcode ${recoveryBarcode} when online`}');
    expect(source).toContain(
      'accessibilityHint="Saves an encrypted first-party catalog retry on this device"',
    );
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).toContain('Retry when online');
    expect(source).toContain('Nothing was added or changed. Try again.');
    expect(source).toContain(
      'className="min-h-[48px] flex-1 items-center justify-center rounded-pill bg-paper px-4 py-3"',
    );
    expect(source).toContain(
      'className="min-h-[48px] items-center justify-center rounded-pill px-4 py-3"',
    );
  });

  it('keeps ready catalog candidates visible and explicitly reviewable from Shelf', () => {
    const shelf = readAppRoute('(tabs)/shelf.tsx');
    const review = readAppRoute('shelf/catalog-recovery.tsx');

    expect(shelf).toContain("queryKey: ['catalog-lookup-ready']");
    expect(shelf).toContain('readReadyCatalogLookups');
    expect(shelf).toContain('Catalog match ready');
    expect(shelf).toContain('Review match');
    expect(shelf).toContain("pathname: '/shelf/catalog-recovery'");

    expect(review).toContain('Compare before saving');
    expect(review).toContain('Reviewed catalog candidate');
    expect(review).toContain('Currently on your Shelf');
    expect(review).toContain('Use catalog name, brand, and category');
    expect(review).toContain('Ingredients and freshness always stay as entered');
    expect(review).toContain('Confirm catalog match');
    expect(review).toContain('Not a match');
    expect(review).toContain('accessibilityRole="checkbox"');
    expect(review).toContain('accessibilityRole="alert"');
  });

  it('revalidates and mutates before consuming, while unlinked intake carries a recovery token', () => {
    const review = readAppRoute('shelf/catalog-recovery.tsx');
    const opened = readAppRoute('shelf/opened.tsx');
    const recovery = readFeatureFile('catalogLookupRecovery.ts');
    const queue = readFileSync(
      fileURLToPath(new URL('../../lib/offline/catalogLookupQueue.ts', import.meta.url)),
      'utf8',
    );

    const applyStart = review.indexOf('const applyLinkedMatch = async () =>');
    const revalidateAt = review.indexOf('await revalidateCatalogRecovery(ready)', applyStart);
    const mutateAt = review.indexOf('await mutations.applyCatalogRecovery({', applyStart);
    const consumeAt = review.indexOf('await acceptReadyCatalogLookup({', applyStart);
    expect(applyStart).toBeGreaterThan(-1);
    expect(revalidateAt).toBeGreaterThan(applyStart);
    expect(mutateAt).toBeGreaterThan(revalidateAt);
    expect(consumeAt).toBeGreaterThan(mutateAt);
    expect(review).toContain('expectedShelfProductId: linkedProduct.id');
    expect(review).toContain('expectedShelfProductId: ready.shelfProductId');
    expect(review).toContain('if (!accepted)');
    expect(review).toContain('if (!rejected)');

    expect(review).toContain('reset(catalogRecoveryIntakePatch(revalidated.product, token))');
    expect(recovery).toContain('catalogRecoveryToken: token');
    expect(review).toContain("router.push('/shelf/opened')");
    expect(review).toContain('The match stays saved if you cancel or saving');
    expect(review).toContain('fails.');

    const addAt = opened.indexOf('const addedProduct = await m.add({');
    const finalizeAt = opened.indexOf('await finalizeCatalogLookupAfterShelfSave({');
    expect(addAt).toBeGreaterThan(-1);
    expect(finalizeAt).toBeGreaterThan(addAt);

    const finalizerAt = recovery.indexOf(
      'export async function finalizeCatalogLookupAfterShelfSave',
    );
    const atomicAcceptAt = recovery.indexOf(
      'await dependencies.acceptAfterShelfSave({',
      finalizerAt,
    );
    expect(atomicAcceptAt).toBeGreaterThan(finalizerAt);

    const queueFinalizerAt = queue.indexOf(
      'export async function acceptReadyCatalogLookupAfterShelfSave',
    );
    const bindCandidateAt = queue.indexOf(
      'consumed = { ...ready, shelfProductId };',
      queueFinalizerAt,
    );
    const requireUnboundAt = queue.indexOf('ready.shelfProductId === null', queueFinalizerAt);
    const consumeCandidateAt = queue.indexOf('return false;', bindCandidateAt);
    expect(requireUnboundAt).toBeGreaterThan(queueFinalizerAt);
    expect(bindCandidateAt).toBeGreaterThan(requireUnboundAt);
    expect(bindCandidateAt).toBeGreaterThan(queueFinalizerAt);
    expect(consumeCandidateAt).toBeGreaterThan(bindCandidateAt);
  });

  it('keeps opened-date and PAO chips buffered above sub-pixel 44px targets', () => {
    const source = readAppRoute('shelf/opened.tsx');

    expect(source).toContain("import { Pressable, View } from 'react-native';");
    expect(source).toContain('const hasProductDraft =');
    expect(source).toContain('if (!hasProductDraft)');
    expect(source).toContain('accessibilityLabel="Add product by hand"');
    expect(source).toContain("router.replace('/shelf/manual')");
    expect(source).toContain('if (!hasProductDraft || !productName || !canSave || saving) return;');
    expect(source).toContain('accessibilityRole="radio"');
    expect(source).toContain('accessibilityLabel={title}');
    expect(source).toContain('accessibilityHint={subtitle}');
    expect(source).toContain('name: productName');
    expect(source).toContain('const addedProduct = await m.add({');
    expect(source).toContain('params: { addedProductId: addedProduct.id }');
    expect(source).not.toContain("name: draft.name || 'Product'");
    expect(source).toContain('<Sheet fallbackRoute={fallbackRoute} backdropAccessible={false}>');
    expect(source).toContain(
      '<Sheet fallbackRoute={fallbackRoute} scroll backdropAccessible={false}>',
    );
    expect(source).toContain('APP_ONBOARDING_PRODUCTS_ROUTE');
    expect(source).toContain('LocalDateField');
    expect(source).toContain('label="Exact opened date"');
    expect(source).toContain('confirmedFromLabel: true');
    expect(source).toContain('Choose the months printed beside the open-jar symbol.');
    expect(source).toContain('Not on label');
    expect(source).toContain('className="mb-3 flex-row items-start justify-between"');
    expect(source).toContain('className="text-[28px] leading-[31px]"');
    expect(source).toContain(
      'variant="bodySm" tone="muted" className="mt-1.5 text-[13px] leading-[18px]"',
    );
    expect(source).toContain(
      'className="mt-4 min-h-[48px] items-center justify-center rounded-pill bg-ink px-5 py-2"',
    );
    expect(source).toContain(
      'Freshness starts after we know the product. Start with the name, then we&apos;ll ask when',
    );
    expect(source).toContain("'min-h-[48px] items-center justify-center rounded-pill px-3.5 py-2'");
    expect(source).toContain("'min-h-[48px] items-center justify-center rounded-pill px-4 py-2'");
    expect(source).not.toContain('<Sheet fallbackRoute={fallbackRoute} scroll>');
    expect(source).not.toContain(
      "'min-h-[44px] items-center justify-center rounded-pill px-3.5 py-2'",
    );
    expect(source).not.toContain(
      "'min-h-[44px] items-center justify-center rounded-pill px-4 py-2'",
    );
    expect(source).not.toContain("'rounded-pill px-3.5 py-2'");
    expect(source).not.toContain("'rounded-pill px-4 py-2'");
  });

  it('keeps Shelf product detail management actions above sub-pixel 44px targets', () => {
    const source = readAppRoute('shelf/[id].tsx');

    expect(source).toContain('function MoreOptionsGlyph');
    expect(source).toContain('<MoreOptionsGlyph />');
    expect(source).toContain('accessibilityElementsHidden');
    expect(source).not.toContain('<Text className="text-[14px] text-ink">...</Text>');
    expect(source).toContain('className="flex-1 overflow-hidden" style={{ minHeight: 0 }}');
    expect(source).toContain('contentContainerClassName="pb-6"');
    expect(source).toContain('className="flex-1"');
    expect(source).not.toContain(
      '<ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-4">',
    );
    expect(source).toContain('className="h-[48px] w-[48px] items-center justify-center');
    expect(source).toContain('className="mt-3 min-h-[48px] self-start items-center');
    expect(source).toContain('accessibilityLabel="Edit opened date"');
    expect(source).toContain(
      'className="min-h-[56px] flex-row items-center justify-between border-b border-hairline py-3"',
    );
    expect(source).toContain('className="min-h-[56px] flex-row items-center justify-between"');
    expect(source).toContain(
      'className="min-h-[48px] items-center justify-center rounded-pill border border-hairline bg-paper-raised px-3.5 py-2"',
    );
    expect(source).toContain(
      'className="min-h-[48px] items-center justify-center rounded-pill px-3.5 py-2"',
    );
    expect(source).toContain('className="mt-2.5 min-h-[48px] items-center justify-center');
    expect(source).not.toContain('className="h-[44px] w-[44px]');
    expect(source).not.toContain('className="mt-3 self-start py-1"');
  });

  it('keeps product-detail lifecycle and catalog-report recovery route-owned', () => {
    const source = readAppRoute('shelf/[id].tsx');

    expect(source).toContain(
      "type ProductDetailSheet = 'manage' | 'report' | 'report-confirm' | null;",
    );
    expect(source).toContain('function ProductDetailActionSheet');
    expect(source).toContain('accessibilityLabel={title}');
    expect(source).toContain('const [activeSheet, setActiveSheet]');
    expect(source).toContain('const [catalogReportFeedback, setCatalogReportFeedback]');
    expect(source).toContain("setActiveSheet('manage')");
    expect(source).toContain("setActiveSheet('report')");
    expect(source).toContain("setActiveSheet('report-confirm')");
    expect(source).toContain('Mark discarded');
    expect(source).toContain('Remove completely');
    expect(source).toContain('Wrong product match');
    expect(source).toContain('Missing catalog product');
    expect(source).toContain("openCatalogReportConfirmation('missing_product')");
    expect(source).toContain('Ingredient issue');
    expect(source).toContain('Expiry or PAO issue');
    expect(source).toContain('proposedPayload: {');
    expect(source).toContain('productName: p.name');
    expect(source).toContain('brand: p.brand');
    expect(source).not.toContain(
      'proposedPayload: {\n        productName: p.name,\n        brand: p.brand,\n        barcode:',
    );
    expect(source).toContain(
      "sourceName: correctionType === 'missing_product' ? null : catalogSourceLabel",
    );
    expect(source).toContain(
      "sourceUrl: correctionType === 'missing_product' ? null : p.catalogSourceUrl",
    );
    expect(source).toContain("p.paoSource === 'catalog' || p.paoSource === 'category_default'");
    expect(source).toContain('qualityIssue: correctionType');
    expect(source).toContain('platform: Platform.OS');
    expect(source).toContain('isCatalogProductId(p.catalogProductId)');
    expect(source).toContain('catalogProductId === null');
    expect(source).toContain('{canReportMissingProduct ? (');
    expect(source).toContain('{catalogProductId ? (');
    expect(source).toContain('reportSubmissionInFlight.current = true;');
    expect(source).toContain('feedbackForCatalogReport(outcome)');
    expect(source).toContain("activeSheet === 'report-confirm'");
    expect(source).toContain('<CatalogReportConfirmation');
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).not.toContain('Alert.alert');
    expect(source).not.toContain('import { Alert');
  });

  it('allows an unsuperseded finished unit to reach the replacement action', () => {
    const source = readAppRoute('shelf/replenish.tsx');

    expect(source).toContain('...(data?.archive ?? [])');
    expect(source).toContain('await m.replace(item.id)');
    expect(source).not.toMatch(/running low|running out|nearly finished/i);
  });

  it('does not describe unresolved product-detail conflicts as already paired', () => {
    const source = readAppRoute('shelf/[id].tsx');

    expect(source).toContain("'Timing note with '");
    expect(source).not.toContain("'Paired with '");
  });

  it('keeps product-detail routine placement explicit and actionable', () => {
    const source = readAppRoute('shelf/[id].tsx');

    expect(source).toContain('function RoutineUsageCard');
    expect(source).toContain('Routine role');
    expect(source).toContain('Review routine placement');
    expect(source).toContain('Build routine from shelf');
    expect(source).toContain('Not placed in a routine yet.');
    expect(source).toContain('Build an AM/PM draft from your shelf.');
    expect(source).toContain("router.push('/routine/plan')");
    expect(source).toContain("import { useCycle } from '@/features/scheduler/useCycle';");
    expect(source).toContain('const { data: cycleData } = useCycle();');
    expect(source).toContain('cycleNightNumbers: cycleNightNumbers?.length');
    expect(source).toContain("usage.cycleNightNumbers.join(', ')");
    expect(source).not.toContain('pm.cyclingNight');
    expect(source).toContain('{!archived ? <RoutineUsageCard usage={usage} /> : null}');
  });

  it('keys repeated product-detail conflict rows by rule and product pair', () => {
    const source = readAppRoute('shelf/[id].tsx');

    expect(source).toContain(
      "import { conflictDetailRoute, conflictKey } from '@/features/intelligence/conflictIdentity';",
    );
    expect(source).toContain('key={conflictKey(c)}');
    expect(source).toContain('router.push(conflictDetailRoute(c))');
    expect(source).not.toContain('key={c.rule.id}');
  });
});
