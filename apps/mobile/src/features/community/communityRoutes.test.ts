import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

function expectTouchableRouteIcon(route: string): void {
  const source = readAppRoute(route);

  expect(source, `${route} should use the shared 44pt route icon button`).toContain(
    'RouteIconButton',
  );
  expect(source, `${route} should not shrink route icons below phone touch targets`).not.toContain(
    'h-7 w-7',
  );
}

describe('Community route contracts', () => {
  it('keeps the community hub safe for direct entry', () => {
    const source = readAppRoute('community/index.tsx');

    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('const compactCommunity = height < 640');
    expect(source).toContain('const narrowCompactCommunity = compactCommunity && width < 360');
    expect(source).not.toContain('router.back()');
    expect(source).toContain('APP_YOU_ROUTE');
    expect(source).toContain('backOrReplace(router, APP_YOU_ROUTE)');
    expect(source).toContain('RouteIconButton');
    expect(source).not.toContain('hitSlop={8}');
    expect(source).toContain(
      'className="min-h-[48px] min-w-[48px] items-center justify-center px-2"',
    );
    expect(source).not.toContain(
      'className="min-h-[44px] min-w-[44px] items-center justify-center px-2"',
    );
  });

  it('keeps the Skin Notes hub cards compact on shortest phone web', () => {
    const source = readAppRoute('community/index.tsx');

    expect(source).toContain('const shortCommunity = height < 520;');
    expect(source).toContain('const ultraShortCommunity = height < 460;');
    expect(source).toContain('const splitShortCommunity = height < 410;');
    expect(source).toContain('const microShortCommunity = height < 380;');
    expect(source).toContain(
      'const supportFloorTextPressureCommunity = width <= 430 && height < 700;',
    );
    expect(source).toContain('const modernPhoneCommunity = height < 980;');
    expect(source).toContain('const boundaryModernTextPressureCommunity =');
    expect(source).toContain(
      'width > 390 && width <= 414 && height >= 840 && height < 900;',
    );
    expect(source).toContain("ultraShortCommunity\n              ? 'pb-20 pt-0'");
    expect(source).toContain(
      "shortCommunity ? 'mt-0 text-[26px]' : compactCommunity ? 'mt-1 text-[28px]' : 'mt-3'",
    );
    expect(source).toContain(
      "shortCommunity ? 'mt-0 text-[12.5px]' : compactCommunity ? 'mt-0.5 text-[13px]' : 'mt-1'",
    );
    expect(source).toContain('short={shortCommunity}');
    expect(source).toContain('{groups.map((g, groupIndex) => {');
    expect(source).toContain('const keepSectionBelowFold = microShortCommunity && groupIndex > 0;');
    expect(source).toContain('const keepUltraShortNarrowSectionBelowFold =');
    expect(source).toContain('ultraShortCommunity && narrowCompactCommunity && groupIndex > 0;');
    expect(source).toContain(
      'const keepNarrowSectionBelowFold = narrowCompactCommunity && groupIndex > 0;',
    );
    expect(source).toContain('const keepSupportFloorSectionBelowFold =');
    expect(source).toContain('supportFloorTextPressureCommunity && groupIndex > 0;');
    expect(source).toContain(
      "modernPhoneCommunity && !narrowCompactCommunity && g.topic.slug === 'sunscreen';",
    );
    expect(source).toContain('const keepBoundaryModernRetinoidsBelowFold =');
    expect(source).toContain(
      "boundaryModernTextPressureCommunity && g.topic.slug === 'retinoids';",
    );
    expect(source).toContain('const keepNextSectionBelowFold =');
    expect(source).toContain("narrowCompactCommunity && g.topic.slug === 'sensitive-skin';");
    expect(source).toContain('keepSectionBelowFold\n                    ? { marginTop: 112 }');
    expect(source).toContain(
      'keepUltraShortNarrowSectionBelowFold\n                      ? { marginTop: 176 }',
    );
    expect(source).toContain(': keepSupportFloorSectionBelowFold');
    expect(source).toContain('? { marginTop: 160 }');
    expect(source).toContain(': keepNarrowSectionBelowFold');
    expect(source).toContain('? { marginTop: 140 }');
    expect(source).toContain(': keepShortModernSectionBelowFold');
    expect(source).toContain('? { marginTop: 48 }');
    expect(source).toContain(': keepBoundaryModernRetinoidsBelowFold');
    expect(source).toContain('? { marginTop: 72 }');
    expect(source).toContain('? { marginBottom: 64 }');
    expect(source).toContain('const keepNextNoteBelowFold = splitShortCommunity && noteIndex > 0;');
    expect(source).toContain(
      'const keepNarrowNextNoteBelowFold = narrowCompactCommunity && noteIndex > 0;',
    );
    expect(source).toContain('const keepModernSensitiveNoteBelowFold =');
    expect(source).toContain('const keepSupportFloorSensitiveFirstNoteBelowFold =');
    expect(source).toContain('const keepSupportFloorSensitiveNoteBelowFold =');
    expect(source).toContain(
      "g.topic.slug === 'sensitive-skin' &&\n                    noteIndex > 0;",
    );
    expect(source).toContain(
      'keepNextNoteBelowFold\n                          ? { marginTop: 72 }',
    );
    expect(source).toContain(': keepSupportFloorSensitiveFirstNoteBelowFold');
    expect(source).toContain('? { marginTop: 280 }');
    expect(source).toContain(': keepSupportFloorSensitiveNoteBelowFold');
    expect(source).toContain('? { marginTop: 224 }');
    expect(source).toContain(': keepModernSensitiveNoteBelowFold');
    expect(source).toContain('? { marginTop: 160 }');
    expect(source).toContain(': keepNarrowNextNoteBelowFold');
    expect(source).toContain("short\n          ? 'mb-1 rounded-[14px] bg-paper-raised p-2'");
    expect(source).toContain("shortCommunity\n                      ? 'mb-1 pl-0.5 text-[10px]'");
    expect(source).toContain('style={{ lineHeight: short ? 15 : compact ? 16 : 19 }}');
    expect(source).toContain('style={{ lineHeight: short ? 13 : compact ? 14 : 18 }}');
  });

  it('keeps nested community routes safe for direct entry', () => {
    for (const route of [
      'community/ask.tsx',
      'community/people-like-you.tsx',
      'community/note/[id].tsx',
    ]) {
      const source = readAppRoute(route);

      expect(source, `${route} should not depend on direct-entry history`).not.toContain(
        'router.back()',
      );
      expect(source, `${route} should recover direct entries to Community`).toContain(
        'APP_COMMUNITY_ROUTE',
      );
      expect(source, `${route} should guard native back with a fallback`).toContain(
        'backOrReplace(router, APP_COMMUNITY_ROUTE)',
      );
    }
  });

  it('returns deferred community direct entries to Community', () => {
    for (const route of ['community/ask.tsx', 'community/people-like-you.tsx']) {
      const source = readAppRoute(route);

      expect(source).toContain('surface="communityPosting"');
      expect(source).toContain('fallbackRoute={APP_COMMUNITY_ROUTE}');
      expect(source).toContain('fallbackLabel="Back to Skin Notes"');
    }
  });

  it('keeps community route escape controls touchable on phones', () => {
    for (const route of [
      'community/ask.tsx',
      'community/people-like-you.tsx',
      'community/note/[id].tsx',
    ]) {
      expectTouchableRouteIcon(route);
    }
  });

  it('keeps Skin Note share failures visible on the note surface', () => {
    const source = readAppRoute('community/note/[id].tsx');
    const feedbackIndex = source.indexOf('accessibilityRole="alert"');
    const actionRowIndex = source.indexOf(
      "className={shareFeedback ? 'mt-3 flex-row gap-3' : 'mt-4 flex-row gap-3'}",
    );

    expect(source).toContain("import { useEffect, useRef, useState } from 'react';");
    expect(source).toContain(
      "import { SHARE_FAILURE_MESSAGE, shareSkinNote } from '@/features/community/shareNote';",
    );
    expect(source).toContain(
      'const [shareFeedback, setShareFeedback] = useState<string | null>(null);',
    );
    expect(source).toContain('const scrollRef = useRef<ScrollView>(null);');
    expect(source).toContain('const shared = await shareSkinNote(note);');
    expect(source).toContain('if (!shared) {');
    expect(source).toContain('setShareFeedback(SHARE_FAILURE_MESSAGE);');
    expect(source).toContain('scrollRef.current?.scrollToEnd({ animated: true });');
    expect(source).toContain('ref={scrollRef}');
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).toContain('className="mt-3 text-center"');
    expect(source).toContain(
      "className={shareFeedback ? 'mt-3 flex-row gap-3' : 'mt-4 flex-row gap-3'}",
    );
    expect(feedbackIndex).toBeGreaterThan(-1);
    expect(actionRowIndex).toBeGreaterThan(-1);
    expect(feedbackIndex).toBeLessThan(actionRowIndex);
  });

  it('recovers missing Skin Note details without a dead empty state', () => {
    const source = readAppRoute('community/note/[id].tsx');

    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('const compactMissingNote = height < 640 || width <= 430;');
    expect(source).toContain('const splitShortMissingNote = height < 410;');
    expect(source).toContain('const narrowCompactMissingNote = compactMissingNote && width < 360;');
    expect(source).toContain(
      'const supportFloorMissingNote = splitShortMissingNote || narrowCompactMissingNote;',
    );
    expect(source).toContain('<ScrollView');
    expect(source).toContain("justifyContent: supportFloorMissingNote ? 'flex-start' : 'center'");
    expect(source).toContain(
      'paddingBottom: splitShortMissingNote ? 12 : compactMissingNote ? 16 : 38',
    );
    expect(source).toContain(
      'paddingTop: splitShortMissingNote ? 2 : narrowCompactMissingNote ? 0 : 0',
    );
    expect(source).toContain('{supportFloorMissingNote ? null : (');
    expect(source).toContain('Note unavailable');
    expect(source).toContain('This Skin Note is not available right now.');
    expect(source).toContain("{narrowCompactMissingNote\n                ? 'Note unavailable.'");
    expect(source).toContain('It may have been updated or removed during expert review.');
    expect(source).toContain('Current Skin Notes are still');
    expect(source).toContain(
      "supportFloorMissingNote\n                ? 'Updated or removed during review. Current notes are in the library.'",
    );
    expect(source).toContain("className={supportFloorMissingNote ? 'mt-2' : 'mt-6'}");
    expect(source).toContain("label={supportFloorMissingNote ? 'Back' : 'Back to Skin Notes'}");
    expect(source).toContain(
      "className={supportFloorMissingNote ? 'min-h-[48px] py-2' : undefined}",
    );
    expect(source).toContain('accessibilityLabel="Back to Skin Notes"');
    expect(source).toContain('router.replace(APP_COMMUNITY_ROUTE)');
    expect(source).not.toContain('This note isn’t available right now.');
    expect(source).not.toContain('<View className="flex-1 items-center justify-center px-6">');
  });

  it('keeps community consent text exits at least 44px tall', () => {
    const source = readAppRoute('community/ask.tsx');

    expect(source).toContain(
      'min-h-[48px] flex-row items-center gap-3 rounded-xl bg-paper-raised px-3.5 py-3',
    );
    expect(source).toContain('className="pb-2 pt-3"');
    expect(source).toContain('className="h-[48px] items-center justify-center"');
    expect(source).not.toContain('className="h-[44px] items-center justify-center"');
  });

  it('keeps anonymous ask deferred submission inline and route-owned', () => {
    const source = readAppRoute('community/ask.tsx');

    expect(source).not.toContain('Alert');
    expect(source).toContain("import { useEffect, useMemo, useRef, useState } from 'react';");
    expect(source).toContain('const scrollRef = useRef<ScrollView>(null);');
    expect(source).toContain('deferredNoticeVisible');
    expect(source).toContain('requestAnimationFrame');
    expect(source).toContain('scrollRef.current?.scrollToEnd({ animated: true })');
    expect(source).toContain('ref={scrollRef}');
    expect(source).toContain('setDeferredNoticeVisible(true)');
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).toContain('COMMUNITY_COPY.ask.deferredTitle');
    expect(source).toContain('COMMUNITY_COPY.ask.deferredBody');
  });
});
