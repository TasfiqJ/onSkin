import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));
const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readSource(path: string): string {
  return readFileSync(`${SRC_DIR}/${path}`, 'utf8');
}

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

describe('Sheet route contracts', () => {
  it('uses safe back fallback for default backdrop dismissals', () => {
    const source = readSource('components/ui/Sheet.tsx');

    expect(source).not.toContain('router.back()');
    expect(source).not.toContain('className="absolute inset-0"');
    expect(source).toContain('className="flex-1"');
    expect(source).toContain('type AppFallbackRoute');
    expect(source).toContain('fallbackRoute?: AppFallbackRoute');
    expect(source).toContain('fallbackRoute = APP_HOME_ROUTE');
    expect(source).toContain('onClose ?? (() => backOrReplace(router, fallbackRoute))');
    expect(source).toContain('backOrReplace(router, fallbackRoute)');
  });

  it('returns Shelf sheet backdrops to Shelf on direct entry', () => {
    for (const route of ['shelf/replenish.tsx', 'shelf/opened.tsx', 'shelf/no-match.tsx']) {
      const source = readAppRoute(route);

      expect(source, `${route} should declare a Shelf fallback`).toContain('APP_SHELF_ROUTE');
      expect(source, `${route} should pass the fallback to Sheet`).toContain(
        'fallbackRoute={APP_SHELF_ROUTE}',
      );
    }
  });

  it('returns scheduler and paywall sheet backdrops through safe exits', () => {
    for (const route of [
      'cycle/why-tonight.tsx',
      'cycle/disruption.tsx',
      'cycle/phased-intro.tsx',
    ]) {
      const source = readAppRoute(route);

      expect(source, `${route} should declare a Today fallback`).toContain('APP_HOME_ROUTE');
      expect(source, `${route} should pass the fallback to Sheet`).toContain(
        'fallbackRoute={APP_HOME_ROUTE}',
      );
    }

    expect(readAppRoute('paywall/upsell.tsx')).toContain('onClose={() => dismissPaywall(router)}');
  });
});

describe('Permission recovery contracts', () => {
  it('uses the shared settings opener for native permission recovery', () => {
    for (const route of ['progress/capture.tsx', 'shelf/ocr.tsx', 'shelf/scan.tsx']) {
      const source = readAppRoute(route);

      expect(source, `${route} should not call native settings without failure handling`).not.toContain(
        'Linking.openSettings()',
      );
      expect(source, `${route} should use the shared app settings helper`).toContain(
        'openAppSettings',
      );
    }
  });

  it('surfaces camera capture and mount failures', () => {
    const copy = readSource('features/native/camera/failureCopy.ts');
    const progressCapture = readAppRoute('progress/capture.tsx');
    const shelfOcr = readAppRoute('shelf/ocr.tsx');

    expect(copy).toContain('progressCaptureTitle');
    expect(copy).toContain('labelCaptureTitle');
    expect(progressCapture).toContain('CameraUnavailableGate');
    expect(progressCapture).toContain('setCameraUnavailable(true)');
    expect(progressCapture).toContain('Alert.alert(CAMERA_FAILURE_COPY.progressCaptureTitle');
    expect(progressCapture).toContain('disabled={!canShowCamera || !cameraReady || capturing}');
    expect(shelfOcr).toContain('setCameraUnavailable(true)');
    expect(shelfOcr).toContain('Alert.alert(CAMERA_FAILURE_COPY.labelCaptureTitle');
    expect(shelfOcr).toContain('CAMERA_FAILURE_COPY.labelUnavailableTitle');
  });
});
