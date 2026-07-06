import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));
const FEATURE_DIR = fileURLToPath(new URL('./', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

function readFeatureFile(path: string): string {
  return readFileSync(`${FEATURE_DIR}/${path}`, 'utf8');
}

function expectTouchableRouteIcon(route: string): void {
  const source = readAppRoute(route);

  expect(source, `${route} should use the shared 44pt route icon button`).toContain(
    'RouteIconButton',
  );
  expect(source, `${route} should not shrink route icons below phone touch targets`).not.toContain(
    'h-7 w-7',
  );
  expect(source, `${route} should not keep a 36px dismiss route icon`).not.toContain('h-9 w-9');
}

describe('Commerce route contracts', () => {
  it('keeps top-level commerce trust surfaces safe for direct entry', () => {
    for (const route of [
      'commerce/stacks.tsx',
      'commerce/transparency.tsx',
      'commerce/consent.tsx',
    ]) {
      const source = readAppRoute(route);

      expect(source, `${route} should not depend on direct-entry history`).not.toContain(
        'router.back()',
      );
      expect(source, `${route} should recover direct entries to You`).toContain('APP_YOU_ROUTE');
      expect(source, `${route} should guard native back with a fallback`).toContain(
        'backOrReplace(router, APP_YOU_ROUTE)',
      );
    }
  });

  it('keeps stack detail exits safe for direct entry', () => {
    const source = readAppRoute('commerce/stack/[slug].tsx');

    expect(source).not.toContain('router.back()');
    expect(source).toContain('APP_COMMERCE_STACKS_ROUTE');
    expect(source).toContain('backOrReplace(router, APP_COMMERCE_STACKS_ROUTE)');
  });

  it('returns deferred commerce direct entries to You', () => {
    const source = readAppRoute('commerce/_layout.tsx');

    expect(source).toContain(
      '<DeferredSurface surface="commerce" fallbackRoute={APP_YOU_ROUTE} />',
    );
  });

  it('keeps commerce route escape controls touchable on phones', () => {
    for (const route of [
      'commerce/stacks.tsx',
      'commerce/transparency.tsx',
      'commerce/consent.tsx',
      'commerce/stack/[slug].tsx',
    ]) {
      expectTouchableRouteIcon(route);
    }
  });

  it('keeps the commerce consent sheet reachable on short phones', () => {
    const source = readAppRoute('commerce/consent.tsx');

    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('sheetMaxHeight');
    expect(source).toContain('height - 48');
    expect(source).toContain('maxHeight: sheetMaxHeight');
    expect(source).toContain('<ScrollView');
    expect(source).toContain('style={{ flexShrink: 1 }}');
    expect(source).toContain('className="h-[48px] items-center justify-center"');
    expect(source).not.toContain('className="h-[44px] items-center justify-center"');
    expect(source).not.toContain('h-[42px]');
  });

  it('keeps where-to-buy secondary actions visible and touchable on phones', () => {
    const source = readFeatureFile('WhereToBuy.tsx');

    expect(source).not.toContain('hitSlop={6}');
    expect(source).toContain(
      'style={{ minHeight: 88, borderWidth: 1, borderColor: colors.hairline }}',
    );
    expect(source).toContain('accessibilityLabel={COMMERCE_COPY.whereToBuy.lockedCta}');
    expect(source).toContain(
      'className="mt-3 min-h-[48px] self-start justify-center rounded-pill px-4"',
    );
    expect(source).toContain('accessibilityLabel="How where-to-buy links work"');
    expect(source).toContain('accessibilityLabel="Add this product to your shelf instead"');
    expect(source.match(/minHeight: 48/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it('keeps stack detail paid-link disclosure actions touchable on phones', () => {
    const source = readAppRoute('commerce/stack/[slug].tsx');

    expect(source).not.toContain('hitSlop={6}');
    expect(source).toContain(
      'style={{ minHeight: 96, borderWidth: 1, borderColor: colors.hairline }}',
    );
    expect(source).toContain('accessibilityLabel="How stack paid links work"');
    expect(source).toContain(
      'className="mt-3 min-h-[48px] self-start justify-center rounded-pill px-3"',
    );
    expect(source).toContain('style={{ minHeight: 48, backgroundColor: colors.clayTint }}');
  });
});
