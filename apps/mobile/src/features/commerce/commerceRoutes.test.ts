import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
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
});
