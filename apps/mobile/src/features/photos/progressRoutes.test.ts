import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

function expectRouteEscapeButton(route: string): void {
  const source = readAppRoute(route);

  expect(source, `${route} should use the shared 44pt route button`).toContain(
    'RouteIconButton',
  );
  expect(source, `${route} should not keep 34px route controls`).not.toContain('width: 34');
  expect(source, `${route} should not keep 34px route controls`).not.toContain('height: 34');
  expect(source, `${route} should not keep 36px route controls`).not.toContain('width: 36');
  expect(source, `${route} should not keep 36px route controls`).not.toContain('height: 36');
}

describe('Progress route mobile contracts', () => {
  it('keeps direct-entry progress exits touchable on phones', () => {
    for (const route of [
      'progress/[id].tsx',
      'progress/capture.tsx',
      'progress/review.tsx',
      'progress/about.tsx',
    ]) {
      expectRouteEscapeButton(route);
    }
  });

  it('keeps capture permission and recovery gates scrollable on short phones', () => {
    const source = readAppRoute('progress/capture.tsx');

    expect(source).toContain('function CaptureOverlay');
    expect(source).toContain('<ScrollView');
    expect(source).toContain(
      "contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 28 }}",
    );
    expect(source.match(/style=\{\{ height: 44, marginTop: 8/g)).toHaveLength(3);
    expect(source).not.toContain("style={{ marginTop: 12, alignItems: 'center' }}");
  });
});
