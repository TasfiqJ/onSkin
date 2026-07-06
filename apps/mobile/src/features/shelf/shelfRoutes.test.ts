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

  it('keeps text exits at least 44px tall when a label is clearer than an icon', () => {
    const source = readAppRoute('shelf/replenish.tsx');

    expect(source).toContain('min-h-[44px] items-center justify-center py-2');
    expect(source).not.toContain('className="mt-3 items-center py-2"');
    expect(source).not.toContain('className="items-center py-2"');
  });

  it('keeps Shelf card replace nudges as visible 44pt phone targets', () => {
    const source = readAppRoute('(tabs)/shelf.tsx');

    expect(source).toContain('accessibilityLabel={`Replace ${item.name}`}');
    expect(source).toContain('className="rounded-[18px] bg-paper-raised p-4"');
    expect(source).toContain('className="flex-row items-center gap-3.5"');
    expect(source).toContain('ml-[64px] mt-2 min-h-[44px] min-w-[84px]');
    expect(source).toContain('border border-clay/20 bg-clay-tint');
    expect(source).toContain('minHeight: 44');
    expect(source).toContain('minWidth: 84');
    expect(source).not.toContain('hitSlop={6}');
    expect(source).not.toContain('className="mt-1 self-start"');
    expect(source).not.toContain('event.stopPropagation()');
  });

  it('keeps opened-date and PAO chips above the 44pt phone target', () => {
    const source = readAppRoute('shelf/opened.tsx');

    expect(source).toContain("'min-h-[44px] items-center justify-center rounded-pill px-3.5 py-2'");
    expect(source).toContain("'min-h-[44px] items-center justify-center rounded-pill px-4 py-2'");
    expect(source).not.toContain("'rounded-pill px-3.5 py-2'");
    expect(source).not.toContain("'rounded-pill px-4 py-2'");
  });
});
