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

    expect(source).toContain(
      '<DeferredSurface surface="shareCard" fallbackRoute={APP_SHELF_ROUTE} />',
    );
  });
});
