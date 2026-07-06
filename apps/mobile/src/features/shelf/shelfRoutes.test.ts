import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
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

  it('keeps archived products reachable when the active Shelf is empty', () => {
    const source = readAppRoute('(tabs)/shelf.tsx');

    expect(source).toContain('function EmptyShelf({ archiveCount }: { archiveCount: number })');
    expect(source).toContain('<EmptyShelf archiveCount={archiveCount} />');
    expect(source).toContain('{archiveCount > 0 ? (');
    expect(source).toContain('accessibilityLabel={`View archive, ${archiveCount} archived ${');
    expect(source).toContain("archiveCount === 1 ? 'product' : 'products'");
    expect(source).toContain("router.push('/shelf/archive');");
    expect(source).toContain('className="min-h-[48px] items-center justify-center py-2"');
    expect(source).toContain('className="mt-6 min-h-[48px] items-center justify-center py-2"');
    expect(source).not.toContain('function EmptyShelf()');
    expect(source).not.toContain('<EmptyShelf />');
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
    expect(source).toContain("'h-[152px] w-full overflow-hidden rounded-[20px] bg-night-elevated'");
    expect(source).toContain('{canShowCamera ? (');
    expect(source).toContain("'absolute left-8 right-8 top-[54px] h-11 rounded-[14px]'");
    expect(source).toContain('!compactScanSurface ? (');
    expect(source).toContain("'rounded-t-sheet bg-night-surface px-5 pb-6 pt-5'");
    expect(source).toContain('title="Scan ingredient label"');
    expect(source).toContain('subtitle="Review editable OCR"');
    expect(source).toContain('title="Search catalog"');
    expect(source).toContain('subtitle="Use reviewed matches"');
    expect(source).not.toContain('title="Capture the ingredient label"');
    expect(source).not.toContain('<View\n              className="absolute left-8 right-8 top-[118px] h-28 rounded-[18px]"');
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

  it('keeps Shelf OCR manual review controls from overlapping on short phones', () => {
    const source = readAppRoute('shelf/ocr.tsx');

    expect(source).toContain(
      "contentContainerClassName={state === 'review' ? 'pb-24' : 'pb-5'}",
    );
    expect(source).toContain("{state === 'review' ? (");
    expect(source).toMatch(
      /\{state === 'review' \? \(\s*<Button label="Looks right\. Continue"/,
    );
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

  it('does not describe unresolved product-detail conflicts as already paired', () => {
    const source = readAppRoute('shelf/[id].tsx');

    expect(source).toContain("'Timing note with '");
    expect(source).not.toContain("'Paired with '");
  });
});
