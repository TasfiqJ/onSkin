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

  it('recovers unavailable stack details without a dead empty state', () => {
    const source = readAppRoute('commerce/stack/[slug].tsx');

    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('const compactMissingStack = height < 640');
    expect(source).toContain('<ScrollView');
    expect(source).toContain('Stack unavailable');
    expect(source).toContain('This routine is not available right now.');
    expect(source).toContain('review disclosures or product availability');
    expect(source).toContain('Current');
    expect(source).toContain('stacks are still available');
    expect(source).toContain('label="Back to stacks"');
    expect(source).toContain('router.replace(APP_COMMERCE_STACKS_ROUTE)');
    expect(source).toContain('label="How paid links work"');
    expect(source).toContain("router.replace('/commerce/transparency')");
    expect(source).not.toContain('This routine isn’t available right now.');
    expect(source).not.toContain('<View className="flex-1 items-center justify-center px-6">');
  });

  it('returns deferred commerce direct entries to You', () => {
    const source = readAppRoute('commerce/_layout.tsx');

    expect(source).toContain('surface="commerce"');
    expect(source).toContain('fallbackRoute={APP_YOU_ROUTE}');
    expect(source).toContain('fallbackLabel="Back to You"');
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
    expect(source).toContain('useSafeAreaInsets');
    expect(source).toContain('sheetMaxHeight');
    expect(source).toContain('const { height: viewportHeight } = useWindowDimensions();');
    expect(source).toContain('const insets = useSafeAreaInsets();');
    expect(source).toContain(
      'const sheetMaxHeight = viewportHeight > 44 ? viewportHeight - 44 : 524;',
    );
    expect(source).toContain('insets.bottom > 0 ? Math.max(32, insets.bottom + 24) : undefined');
    expect(source).toContain('maxHeight: sheetMaxHeight');
    expect(source).toContain('aria-modal');
    expect(source).toContain('role="dialog"');
    expect(source).toContain('accessibilityLabel={COMMERCE_COPY.consent.title}');
    expect(source).toContain('accessibilityViewIsModal');
    expect(source).toContain('aria-hidden');
    expect(source).toContain('accessibilityElementsHidden');
    expect(source).toContain('tabIndex={-1}');
    expect(source).toContain('paddingBottom: footerPaddingBottom');
    expect(source).toContain('<ScrollView');
    expect(source).toContain('style={{ flexShrink: 1 }}');
    expect(source).toContain('className="h-[48px] items-center justify-center"');
    expect(source).not.toContain('viewportHeight > 0 ? Math.max(0, viewportHeight - 44) : 524');
    expect(source).not.toContain('height - 48');
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

  it('requires admitted catalog provenance before recommendation commerce can render', () => {
    const whereToBuy = readFeatureFile('WhereToBuy.tsx');
    const recommendationDetail = readAppRoute('recommendations/[id].tsx');

    expect(whereToBuy).toContain('isAdmittedCatalogProductProvenance(provenance)');
    expect(whereToBuy).toContain(
      'if (!phase7Flags.commerce || !isAdmittedCatalogProductProvenance(provenance)) return null;',
    );
    expect(recommendationDetail).toContain('<WhereToBuy provenance={rec.provenance} />');
    expect(recommendationDetail).not.toContain('<WhereToBuy productType={rec.productType} />');
  });

  it('keeps stack detail paid-link disclosure actions touchable on phones', () => {
    const source = readAppRoute('commerce/stack/[slug].tsx');

    expect(source).not.toContain('hitSlop={6}');
    expect(source).toContain(
      'style={{ minHeight: 96, borderWidth: 1, borderColor: colors.hairline }}',
    );
    expect(source).toContain("'How stack paid links work'");
    expect(source).toContain("'How stack link consent works'");
    expect(source).toContain(
      'className="mt-3 min-h-[48px] self-start justify-center rounded-pill px-3"',
    );
    expect(source).toContain('style={{ minHeight: 48, backgroundColor: colors.clayTint }}');
  });

  it('keeps stack paid links visually locked until commerce consent', () => {
    const source = readAppRoute('commerce/stack/[slug].tsx');

    expect(source).toContain('const itemAccessibilityLabel = consented');
    expect(source).toContain('where-to-buy locked until consent');
    expect(source).toContain('COMMERCE_COPY.stack.lockedChip');
    expect(source).toContain('COMMERCE_COPY.stack.lockedDisclosure');
    expect(source).toContain('LockGlyph size={12}');
    expect(source).toContain('consented ? COMMERCE_COPY.stack.disclosure');
    expect(source).toContain("consented ? 'How stack paid links work'");
  });

  it('keeps paid-link recovery inline instead of native blocking alerts', () => {
    const whereToBuy = readFeatureFile('WhereToBuy.tsx');
    const stackDetail = readAppRoute('commerce/stack/[slug].tsx');
    const notice = readFeatureFile('CommerceLinkNotice.tsx');

    expect(whereToBuy).not.toContain('Alert');
    expect(stackDetail).not.toContain('Alert');
    expect(whereToBuy).toContain('CommerceLinkNotice');
    expect(stackDetail).toContain('CommerceLinkNotice');
    expect(whereToBuy).toContain('setLinkFeedback');
    expect(stackDetail).toContain('setLinkFeedback');
    expect(notice).toContain('accessibilityRole="alert"');
    expect(notice).toContain('colors.clayTint');
  });
});
