import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

describe('Conflict route contracts', () => {
  it('keeps conflict detail and share-card exits safe for direct entry', () => {
    for (const route of ['conflict/[ruleId].tsx', 'share/conflict/[ruleId].tsx']) {
      const source = readAppRoute(route);

      expect(source, `${route} should not depend on direct-entry history`).not.toContain(
        'router.back()',
      );
      expect(source, `${route} should recover direct entries to Shelf`).toContain(
        'APP_SHELF_ROUTE',
      );
      expect(source, `${route} should guard native back with a fallback`).toContain(
        'backOrReplace(router, APP_SHELF_ROUTE)',
      );
    }
  });

  it('returns deferred share-card direct entries to Shelf', () => {
    const source = readAppRoute('share/conflict/[ruleId].tsx');

    expect(source).toContain('surface="shareCard"');
    expect(source).toContain('fallbackRoute={APP_SHELF_ROUTE}');
    expect(source).toContain('fallbackLabel="Back to Shelf"');
  });

  it('does not claim conflict-detail placement without scheduler output', () => {
    const source = readAppRoute('conflict/[ruleId].tsx');

    expect(source).toContain('Keep retinol and glycolic on different evenings.');
    expect(source).not.toMatch(/Already in your plan|already reflected/i);
    expect(source).not.toContain('Retinol on cycling night 2, glycolic on night 1');
    expect(source).not.toContain("We've left both in your AM routine");
  });

  it('keeps direct conflict details behind the launch-gated shelf conflict source', () => {
    const source = readAppRoute('conflict/[ruleId].tsx');

    expect(source).toContain("import { useShelf } from '@/features/shelf/useShelf';");
    expect(source).toContain('const { data } = useShelf();');
    expect(source).toContain('data?.conflicts.find((c) => c.rule.id === ruleId)');
    expect(source).not.toContain('STARTER_RULES');
    expect(source).not.toContain('detectConflicts(');
    expect(source).not.toContain('shippableRules(');
  });

  it('tracks conflict choices without sending rule or product identifiers', () => {
    const source = readAppRoute('conflict/[ruleId].tsx');

    expect(source).toContain("track('conflict_resolution_chosen', { action, source: 'detail' })");
    expect(source).toContain("track('conflict_overridden', { source: 'detail' })");
    expect(source).not.toContain("track('conflict_resolution_chosen', { rule");
    expect(source).not.toContain("track('conflict_overridden', { rule");
    expect(source).not.toContain("track('conflict_resolution_chosen', { product");
    expect(source).not.toContain("track('conflict_overridden', { product");
  });

  it('keeps dense conflict sheets scrollable and actions touchable on short phones', () => {
    const source = readAppRoute('conflict/[ruleId].tsx');

    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('const sheetMaxHeight = Math.max(320, height - 24)');
    expect(source).toContain('maxHeight: sheetMaxHeight');
    expect(source).toContain('<ScrollView');
    expect(source).toContain('contentContainerClassName="pb-10"');
    expect(source).toContain('className="min-h-[48px] items-center justify-center py-2"');
    expect(source).toContain('className="mt-4 min-h-[48px] items-center justify-center"');
    expect(source).toContain('className="min-h-[48px] items-center justify-center py-3"');
    expect(source).not.toContain('className="items-center py-2"');
    expect(source).not.toContain('className="mt-4 items-center"');
  });
});
