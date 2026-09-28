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
    expect(source).toContain('aria-hidden={!backdropAccessible}');
    expect(source).toContain('accessibilityElementsHidden={!backdropAccessible}');
    expect(source).toContain('focusable={backdropAccessible}');
    expect(source).toContain("importantForAccessibility={backdropAccessible ? 'auto' : 'no'}");
    expect(source).toContain('tabIndex={backdropAccessible ? 0 : -1}');
    expect(source).toContain('type AppFallbackRoute');
    expect(source).toContain('fallbackRoute?: AppFallbackRoute');
    expect(source).toContain('fallbackRoute = APP_HOME_ROUTE');
    expect(source).toContain('onClose ?? (() => backOrReplace(router, fallbackRoute))');
    expect(source).toContain('backOrReplace(router, fallbackRoute)');
    expect(source).toContain("import { useSafeAreaInsets } from 'react-native-safe-area-context';");
    expect(source).toContain('const insets = useSafeAreaInsets();');
    expect(source).toContain('insets.bottom > 0 ? Math.max(40, insets.bottom + 24) : undefined;');
    expect(source).toContain("'overflow-hidden rounded-t-sheet px-7 pb-10 pt-4'");
    expect(source).toContain(
      '...(sheetPaddingBottom === undefined ? {} : { paddingBottom: sheetPaddingBottom })',
    );
    expect(source).toContain('aria-modal');
    expect(source).toContain('role="dialog"');
    expect(source).toContain('accessibilityViewIsModal');
  });

  it('returns Shelf sheet backdrops to Shelf on direct entry', () => {
    for (const route of ['shelf/replenish.tsx', 'shelf/opened.tsx', 'shelf/no-match.tsx']) {
      const source = readAppRoute(route);

      expect(source, `${route} should declare a Shelf fallback`).toContain('APP_SHELF_ROUTE');
      expect(source, `${route} should pass the fallback to Sheet`).toContain(
        route === 'shelf/opened.tsx'
          ? 'fallbackRoute={fallbackRoute}'
          : 'fallbackRoute={APP_SHELF_ROUTE}',
      );
    }
    const opened = readAppRoute('shelf/opened.tsx');
    expect(opened).toContain("origin === 'onboarding'");
    expect(opened).toContain('APP_ONBOARDING_PRODUCTS_ROUTE');
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

      expect(
        source,
        `${route} should not call native settings without failure handling`,
      ).not.toContain('Linking.openSettings()');
      expect(source, `${route} should use the shared app settings helper`).toContain(
        'openAppSettings',
      );
    }
  });

  it('surfaces camera capture and mount failures', () => {
    const copy = readSource('features/native/camera/failureCopy.ts');
    const cameraLifecycle = readSource('features/native/camera/useCameraAccessLifecycle.ts');
    const progressCapture = readAppRoute('progress/capture.tsx');
    const shelfOcr = readAppRoute('shelf/ocr.tsx');
    const shelfScan = readAppRoute('shelf/scan.tsx');

    expect(copy).toContain('progressCaptureTitle');
    expect(copy).toContain('shelfSettingsTitle');
    expect(copy).toContain('labelCaptureTitle');
    expect(copy).toContain('CAMERA_PERMISSION_FAILURE_COPY');
    expect(copy).toContain('refresh_failed: {');
    expect(copy).toContain("retryLabel: 'Check camera again'");
    expect(copy).toContain('request_failed: {');
    expect(copy).toContain("retryLabel: 'Try camera access again'");
    expect(cameraLifecycle).toContain('setCameraUnavailable(true)');
    expect(cameraLifecycle).toContain('retryCameraMount: retryCamera');
    expect(progressCapture).toContain('CameraUnavailableGate');
    expect(progressCapture).toContain('onMountError={cameraAccess.onCameraMountError}');
    expect(progressCapture).toContain('onRetry={cameraAccess.retryCameraMount}');
    expect(progressCapture).toContain('PhotoCaptureFailureGate');
    expect(progressCapture).toContain('EXPO_PUBLIC_E2E_PROGRESS_CAPTURE_FAILURE');
    expect(progressCapture).toContain('setPhotoCaptureFailed(true)');
    expect(progressCapture).toContain('setSettingsOpenFailed(true)');
    expect(progressCapture).toContain('accessibilityRole="alert"');
    expect(progressCapture).toContain('Try photo again');
    expect(progressCapture).toContain('CAMERA_FAILURE_COPY.progressSettingsTitle');
    expect(progressCapture).toContain('alertOnFailure: false');
    expect(progressCapture).toContain('{canAttemptCapture ? (');
    expect(progressCapture).toContain('CAMERA_FAILURE_COPY.progressCaptureTitle');
    expect(progressCapture).toContain('CAMERA_FAILURE_COPY.progressCaptureBody');
    expect(progressCapture).toContain('permissionFailureCopy={permissionFailureCopy}');
    expect(progressCapture).toContain('permissionFailureCopy?.retryLabel ?? askLabel');
    expect(progressCapture).toContain('disabled={!captureReady || capturing}');
    expect(progressCapture).not.toContain('Alert.alert(CAMERA_FAILURE_COPY.progressCaptureTitle');
    expect(shelfOcr).toContain('cameraAccess.markCameraUnavailable(cameraGeneration)');
    expect(shelfOcr).toContain("'Try camera again'");
    expect(shelfOcr).toContain('setLabelCaptureFailed(true)');
    expect(shelfOcr).toContain('accessibilityRole="alert"');
    expect(shelfOcr).toContain('Try label photo again');
    expect(shelfOcr).not.toContain('Alert.alert(CAMERA_FAILURE_COPY.labelCaptureTitle');
    expect(shelfOcr).not.toContain('Alert.alert(CAMERA_FAILURE_COPY.labelUnavailableTitle');
    expect(shelfOcr).toContain('CAMERA_FAILURE_COPY.labelUnavailableTitle');
    expect(shelfOcr).toContain('CAMERA_PERMISSION_FAILURE_COPY[cameraAccess.permissionFailure]');
    expect(shelfScan).toContain('CAMERA_PERMISSION_FAILURE_COPY[permissionFailure]');
    for (const routeSource of [shelfOcr, shelfScan]) {
      expect(routeSource).toContain('EXPO_PUBLIC_E2E_SHELF_CAMERA_PERMISSION');
      expect(routeSource).toContain('CAMERA_FAILURE_COPY.shelfSettingsTitle');
      expect(routeSource).toContain('CAMERA_FAILURE_COPY.shelfSettingsBody');
      expect(routeSource).toContain('setSettingsOpenFailed(true)');
      expect(routeSource).toContain('alertOnFailure: false');
    }
  });
});
