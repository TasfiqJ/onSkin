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

  it('keeps the Skin Notes hub cards compact on short phones', () => {
    const source = readAppRoute('community/index.tsx');

    expect(source).toContain(
      "contentContainerClassName={compactCommunity ? 'pb-12 pt-2' : 'pb-10 pt-5'}",
    );
    expect(source).toContain(
      "className={compactCommunity ? 'mt-1 text-[28px]' : 'mt-3'}",
    );
    expect(source).toContain(
      "className={compactCommunity ? 'mt-0.5 text-[13px]' : 'mt-1'}",
    );
    expect(source).toContain(
      "<NoteCard key={note.id} note={note} compact={compactCommunity} />",
    );
    expect(source).toContain('const keepNextSectionBelowFold =');
    expect(source).toContain("narrowCompactCommunity && g.topic.slug === 'sensitive-skin';");
    expect(source).toContain(
      'style={keepNextSectionBelowFold ? { marginBottom: 64 } : undefined}',
    );
    expect(source).toContain("'mb-1.5 rounded-[16px] bg-paper-raised p-2.5'");
    expect(source).toContain("style={{ lineHeight: compact ? 16 : 19 }}");
    expect(source).toContain("style={{ lineHeight: compact ? 14 : 18 }}");
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
    expect(source).toContain('const [shareFeedback, setShareFeedback] = useState<string | null>(null);');
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
    expect(source).toContain('const compactMissingNote = height < 640');
    expect(source).toContain('<ScrollView');
    expect(source).toContain('Note unavailable');
    expect(source).toContain('This Skin Note is not available right now.');
    expect(source).toContain('It may have been updated or removed during expert review.');
    expect(source).toContain('Current Skin Notes are still');
    expect(source).toContain('label="Back to Skin Notes"');
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
