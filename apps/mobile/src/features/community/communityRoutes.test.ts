import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

describe('Community route contracts', () => {
  it('keeps the community hub safe for direct entry', () => {
    const source = readAppRoute('community/index.tsx');

    expect(source).not.toContain('router.back()');
    expect(source).toContain('APP_YOU_ROUTE');
    expect(source).toContain('backOrReplace(router, APP_YOU_ROUTE)');
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

      expect(source).toContain(
        '<DeferredSurface surface="communityPosting" fallbackRoute={APP_COMMUNITY_ROUTE} />',
      );
    }
  });
});
