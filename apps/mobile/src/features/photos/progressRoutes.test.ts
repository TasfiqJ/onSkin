import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

function expectRouteEscapeButton(route: string): void {
  const source = readAppRoute(route);

  expect(source, `${route} should use the shared 44pt route button`).toContain('RouteIconButton');
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
    expect(source).toContain("justifyContent: compact ? 'flex-start' : 'center'");
    expect(source).toContain('useWindowDimensions().height < 640');
    expect(source.match(/height: 48/g)).toHaveLength(4);
    expect(source).toContain('width: 48,\n            height: 48,');
    expect(source).not.toContain('width: 44,\n            height: 44,');
    expect(source).not.toContain('height: 44, marginTop: 8');
    expect(source).not.toContain("style={{ marginTop: 12, alignItems: 'center' }}");
  });

  it('keeps the compare photo picker dismissible without inert sheet buttons', () => {
    const source = readAppRoute('(tabs)/progress.tsx');

    expect(source).toContain('accessibilityLabel="Dismiss photo picker"');
    expect(source).toContain('accessibilityRole="button"');
    expect(source).toContain('className="flex-1"\n          accessibilityLabel="Dismiss photo picker"');
    expect(source).toContain('accessibilityViewIsModal');
    expect(source).not.toContain('onPress={() => {}}');
  });
});
