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
    ]) {
      expectTouchableRouteIcon(route);
    }
  });

  it('keeps scan fallback rows complete on compact text-pressure phones', () => {
    const source = readAppRoute('shelf/scan.tsx');

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
        'fallbackRoute={APP_SHELF_ROUTE}',
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
        'backOrReplace(router, APP_SHELF_ROUTE)',
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

    expect(source).toContain("trackProductAddStarted('miss_search')");
    expect(source).toContain("reset({ addedVia: 'search' })");
    expect(source).toContain("router.replace('/shelf/search')");
    expect(source).toContain('Search catalog');
    expect(source).toContain('Scan the ingredient list');
    expect(source).toContain('Add it by hand');

    const analytics = readFeatureFile('analytics.ts');

    expect(analytics).toContain("'miss_search'");
  });

  it('keeps barcode no-match recovery visible on the shortest supported phones', () => {
    const source = readAppRoute('shelf/no-match.tsx');

    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('const shortPhone = height < 600');
    expect(source).toContain('const ultraShortPhone = height < 460;');
    expect(source).toContain('const splitShortPhone = height < 410;');
    expect(source).toContain('const microShortPhone = height < 380;');
    expect(source).toContain('const compactPressurePhone = shortPhone;');
    expect(source).toContain("? 'px-6 pb-2 pt-2'");
    expect(source).toContain("? 'px-6 pb-3 pt-2'");
    expect(source).toMatch(/:\s*shortPhone\s*\?\s*'px-6 pb-4 pt-2'/);
    expect(source).toContain("? 'absolute right-0 top-0 z-10'");
    expect(source).toContain(
      "microShortPhone ? undefined : 'flex-row items-start justify-between'",
    );
    expect(source).toContain('{microShortPhone ? null : (');
    expect(source).toContain("ultraShortPhone\n              ? 'mb-0'");
    expect(source).toContain('{!shortPhone ? (');
    expect(source).toContain(
      "{compactPressurePhone ? 'Not found yet.' : 'We don&apos;t have this one yet.'}",
    );
    expect(source).toContain("? 'pr-12 text-[19px] leading-[22px]'");
    expect(source).toContain("? 'text-[21px] leading-[24px]'");
    expect(source).toContain("? 'mt-1 gap-1'");
    expect(source).toContain("? 'mt-2 gap-1'");
    expect(source).toContain('style={');
    expect(source).toContain('compactPressurePhone');
    expect(source).toContain('? { marginTop: 32 }');
    expect(source).toContain('compact={shortPhone}');
    expect(source).toContain('ultraCompact={shortPhone}');
    expect(source).toContain('hideSubtitle={compactPressurePhone}');
    expect(source).toContain('hideSubtitle?: boolean;');
    expect(source).toContain('{hideSubtitle ? null : (');
    expect(source).toContain(
      "title={compactPressurePhone ? 'Scan ingredients' : 'Scan the ingredient list'}",
    );
    expect(source).toContain(
      'accessibilityLabel="Scan the ingredient list. We\'ll read the INCI text"',
    );
    expect(source).toContain('accessibilityLabel?: string;');
    expect(source).toContain('accessibilityLabel={accessibilityLabel ?? `${title}. ${subtitle}`}');
    expect(source).toContain("'min-h-[48px] gap-2.5 rounded-[15px] px-2.5 py-2'");
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
    expect(source).toContain('const compactShelf = height < 640');
    expect(source).toContain('<ScanShelfButton floating={false} source="scan_inline" />');
    expect(source).toContain('!isEmpty && !showLoading && !compactShelf');
    expect(source).toContain('<ScanShelfButton floating source="scan_fab" />');
    expect(source).not.toContain('!isEmpty && !showLoading ? (');
  });

  it('keeps the compact no-archive empty Shelf usable in the first viewport', () => {
    const source = readAppRoute('(tabs)/shelf.tsx');

    expect(source).toContain('const compactShelf = height < 640');
    expect(source).toContain('const shortShelf = height < 520');
    expect(source).toContain('const splitShortShelf = height < 410;');
    expect(source).toContain('const compactFilterLabels = compactShelf;');
    expect(source).toContain('function SkeletonShelf({ compactFilterLabels }');
    expect(source).toContain('<SkeletonShelf compactFilterLabels={compactFilterLabels} />');
    expect(source).toContain("label={compactFilterLabels && l === 'Expiring' ? 'Exp.' : l}");
    expect(source).toContain("? 'Exp.'");
    expect(source).toContain('accessibilityLabel={f ===');
    expect(source).toContain("className={compactFilterLabels ? 'px-3' : undefined}");
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
    expect(source).toContain('!isEmpty && !showLoading && !compactShelf');
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
    expect(source).toContain('const compactScanSurface = height < 640');
    expect(source).toContain('const splitShortScanSurface = height < 460;');
    expect(source).toContain('const showScanPreview = !splitShortScanSurface || canShowCamera;');
    expect(source).toContain('style={splitShortScanSurface ? { minHeight: 68 } : undefined}');
    expect(source).toContain('{showScanPreview ? (');
    expect(source).toContain("title={compactScanSurface ? 'Scan label' : 'Scan ingredient label'}");
    expect(source).toContain('accessibilityLabel="Scan ingredient label. Review editable OCR"');
    expect(source).toContain("'h-[96px] w-full overflow-hidden rounded-[18px] bg-night-elevated'");
    expect(source).toContain("'h-[152px] w-full overflow-hidden rounded-[20px] bg-night-elevated'");
    expect(source).toContain('{canShowCamera ? (');
    expect(source).toContain("'absolute left-8 right-8 top-[34px] h-8 rounded-[12px]'");
    expect(source).toContain("'absolute left-8 right-8 top-[54px] h-11 rounded-[14px]'");
    expect(source).toContain('!compactScanSurface ? (');
    expect(source).toContain("'rounded-t-sheet bg-night-surface px-5 pb-4 pt-3'");
    expect(source).toContain("state.kind === 'idle' && compactScanSurface ? null");
    expect(source).toContain("className={compactScanSurface ? 'gap-1.5' : 'gap-2.5'}");
    expect(source).toContain('subtitle="Review editable OCR"');
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

  it('distinguishes true scan no-match from offline lookup recovery', () => {
    const source = readAppRoute('shelf/scan.tsx');

    expect(source).toContain('EXPO_PUBLIC_E2E_SHELF_SCAN_RESULT');
    expect(source).toContain("typeof __DEV__ === 'undefined' || !__DEV__");
    expect(source).toContain("| { kind: 'offline'; barcode: string }");
    expect(source).toContain("case 'offline':");
    expect(source).toContain("return { kind: 'offline', barcode };");
    expect(source).toContain("if (response.result === 'offline')");
    expect(source).toContain("setState({ kind: 'offline', barcode: normalized.lookupValue });");
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

    expect(source).toContain('<View className="pb-8 pt-2">');
    expect(source).toContain('<Button label="Add by hand" variant="ghost" onPress={goManual} />');
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
    expect(source).toContain('const ultraShortPhone = viewportHeight < 460;');
    expect(source).toContain('const splitShortPhone = viewportHeight < 410;');
    expect(source).toContain('const compactManualPhone = viewportHeight < 600;');
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
    expect(source).toContain('? { marginTop: 344 }');
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
    expect(source).toMatch(/\{state === 'review' \? \(\s*<Button label="Looks right\. Continue"/);
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
    expect(source).toContain("result: shelfScanResultFromLookup('lookup_error')");
  });

  it('keeps opened-date and PAO chips buffered above sub-pixel 44px targets', () => {
    const source = readAppRoute('shelf/opened.tsx');

    expect(source).toContain('const hasProductDraft =');
    expect(source).toContain('if (!hasProductDraft)');
    expect(source).toContain('accessibilityLabel="Add product by hand"');
    expect(source).toContain("router.replace('/shelf/manual')");
    expect(source).toContain('if (!hasProductDraft || !productName || !canSave || saving) return;');
    expect(source).toContain('name: productName');
    expect(source).not.toContain("name: draft.name || 'Product'");
    expect(source).toContain('<Sheet fallbackRoute={APP_SHELF_ROUTE} backdropAccessible={false}>');
    expect(source).toContain(
      '<Sheet fallbackRoute={APP_SHELF_ROUTE} scroll backdropAccessible={false}>',
    );
    expect(source).toContain("'min-h-[48px] items-center justify-center rounded-pill px-3.5 py-2'");
    expect(source).toContain("'min-h-[48px] items-center justify-center rounded-pill px-4 py-2'");
    expect(source).not.toContain('<Sheet fallbackRoute={APP_SHELF_ROUTE} scroll>');
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

    expect(source).toContain("type ProductDetailSheet = 'manage' | 'report' | null;");
    expect(source).toContain('function ProductDetailActionSheet');
    expect(source).toContain('accessibilityLabel={title}');
    expect(source).toContain('const [activeSheet, setActiveSheet]');
    expect(source).toContain('const [catalogReportFeedback, setCatalogReportFeedback]');
    expect(source).toContain("setActiveSheet('manage')");
    expect(source).toContain("setActiveSheet('report')");
    expect(source).toContain('Mark discarded');
    expect(source).toContain('Remove completely');
    expect(source).toContain('Wrong product match');
    expect(source).toContain('Ingredient issue');
    expect(source).toContain('Expiry or PAO issue');
    expect(source).toContain('CATALOG_REPORT_NOT_SENT');
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).not.toContain('Alert.alert');
    expect(source).not.toContain('import { Alert');
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
    expect(source).toContain('{!archived ? <RoutineUsageCard usage={usage} /> : null}');
  });

  it('keys repeated product-detail conflict rows by rule and product pair', () => {
    const source = readAppRoute('shelf/[id].tsx');

    expect(source).toContain(
      "import { conflictKey } from '@/features/intelligence/conflictIdentity';",
    );
    expect(source).toContain('key={conflictKey(c)}');
    expect(source).not.toContain('key={c.rule.id}');
  });
});
