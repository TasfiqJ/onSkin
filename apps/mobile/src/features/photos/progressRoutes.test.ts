import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));
const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

function readSource(path: string): string {
  return readFileSync(`${SRC_DIR}/${path}`, 'utf8');
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
  it('keeps legacy /photos direct entries inside the Progress photo surfaces', () => {
    const capture = readAppRoute('photos/capture.tsx');
    const review = readAppRoute('photos/review.tsx');
    const detail = readAppRoute('photos/[id].tsx');

    expect(capture).toContain('Redirect');
    expect(capture).toContain('href="/progress/capture"');
    expect(review).toContain('Redirect');
    expect(review).toContain('href="/progress/review"');
    expect(detail).toContain("pathname: '/progress/[id]'");
    expect(detail).toContain('useLocalSearchParams');
  });

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

  it('keeps review actions above the short-phone fold', () => {
    const source = readAppRoute('progress/review.tsx');

    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('const compact = height < 640');
    expect(source).toContain('Math.round(height * 0.54)');
    expect(source).toContain('height: photoHeight');
    expect(source).toContain('marginBottom: compact ? 12 : 18');
    expect(source).toContain('marginVertical: compact ? 12 : 18');
    expect(source).toContain('paddingVertical: compact ? 12 : 14');
    expect(source).toContain('paddingBottom: insets.bottom + (compact ? 16 : 24)');
    expect(source).not.toContain('height: 380, borderRadius: 24');
  });

  it('keeps the compare photo picker dismissible without inert sheet buttons', () => {
    const source = readAppRoute('(tabs)/progress.tsx');

    expect(source).toContain('accessibilityLabel="Dismiss photo picker"');
    expect(source).toContain('accessibilityRole="button"');
    expect(source).toContain(
      'className="flex-1"\n          accessibilityLabel="Dismiss photo picker"',
    );
    expect(source).toContain('accessibilityViewIsModal');
    expect(source).not.toContain('onPress={() => {}}');
  });

  it('buffers populated comparison controls on small phones', () => {
    const source = readAppRoute('(tabs)/progress.tsx');
    const slider = readSource('features/photos/CompareSlider.tsx');

    expect(source).toContain(
      'min-h-[48px] min-w-[96px] items-center justify-center rounded-pill px-[18px] py-2.5',
    );
    expect(source).toContain(
      'className="mt-3 min-h-[48px] flex-row items-center justify-center gap-1.5 rounded-pill px-4 py-2"',
    );
    expect(source).toContain('className="mt-4 gap-2.5"');
    expect(source).toContain(
      'className="min-h-[48px] self-start items-center justify-center rounded-pill px-3"',
    );
    expect(source).toContain(
      'className="min-h-[48px] items-center justify-center rounded-pill px-4 py-2"',
    );
    expect(source).toContain(
      'className="min-h-[48px] flex-row items-center justify-center gap-1.5 rounded-pill px-4 py-2"',
    );
    expect(source).not.toContain('className="rounded-pill px-[18px] py-2.5"');
    expect(source).not.toContain(
      'className="mt-3 flex-row items-center gap-1.5 rounded-pill px-3.5 py-2"',
    );
    expect(source).not.toContain('className="rounded-pill px-3.5 py-2"');

    expect(slider).toContain(
      'className="min-h-[48px] min-w-[72px] items-center justify-center rounded-pill px-3.5 py-2"',
    );
    expect(slider).not.toContain('className="rounded-pill px-3.5 py-1.5"');
  });
});
