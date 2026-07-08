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

  it('recovers stale direct photo-detail entries without a dead empty state', () => {
    const source = readAppRoute('progress/[id].tsx');
    const copy = readSource('features/photos/copy.ts');

    expect(copy).toContain("missingEyebrow: 'Photo unavailable'");
    expect(copy).toContain("missingTitle: 'This photo is no longer on this phone.'");
    expect(copy).toContain("missingCapture: 'Take a new photo'");
    expect(copy).toContain("missingBack: 'Back to Progress'");
    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('const compact = height < 640');
    expect(source).toContain('<ScrollView');
    expect(source).toContain('PHOTO_COPY.detail.missingEyebrow');
    expect(source).toContain('PHOTO_COPY.detail.missingTitle');
    expect(source).toContain('PHOTO_COPY.detail.missingBody');
    expect(source).toContain('PHOTO_COPY.detail.missingCapture');
    expect(source).toContain('PHOTO_COPY.detail.missingBack');
    expect(source).toContain("router.replace('/progress/capture')");
    expect(source).toContain('minHeight: 56');
    expect(source).not.toContain('Photo not found.');
  });

  it('keeps capture permission and recovery gates scrollable on short phones', () => {
    const source = readAppRoute('progress/capture.tsx');

    expect(source).toContain('function CaptureOverlay');
    expect(source).toContain('<ScrollView');
    expect(source).toContain("justifyContent: compact ? 'flex-start' : 'center'");
    expect(source).toContain('const insets = useSafeAreaInsets();');
    expect(source).toContain('paddingTop: insets.top + (compact ? 16 : 28)');
    expect(source).toContain('paddingBottom: insets.bottom + (compact ? 20 : 28)');
    expect(source).toContain('useWindowDimensions().height < 640');
    expect(source.match(/height: 48/g)).toHaveLength(4);
    expect(source).toContain("const NIGHT_SECONDARY_ACTION_BG = 'rgba(244,239,231,0.08)'");
    expect(source).toContain("const NIGHT_SECONDARY_ACTION_TEXT = 'rgba(244,239,231,0.84)'");
    expect(source).toContain("const NIGHT_FOOTNOTE_TEXT = 'rgba(244,239,231,0.76)'");
    expect(source).toContain("const NIGHT_CONSENT_OVERLAY_BG = '#100D0A'");
    expect(source).toContain('backgroundColor={NIGHT_CONSENT_OVERLAY_BG}');
    expect(source).toContain("color: 'rgba(244,239,231,0.9)'");
    expect(source).toContain("color: 'rgba(244,239,231,0.88)'");
    expect(source).toContain('height: compact ? 52 : 56');
    expect(source).not.toContain('backgroundColor="rgba(10,8,6,0.92)"');
    expect(source).not.toContain("const NIGHT_FOOTNOTE_TEXT = 'rgba(244,239,231,0.64)'");
    expect(source).not.toContain("fontSize: 15,\n            color: 'rgba(244,239,231,0.6)'");
    expect(source).not.toContain("color: 'rgba(244,239,231,0.45)'");
    expect(source).toContain('width: 48,\n            height: 48,');
    expect(source).not.toContain('width: 44,\n            height: 44,');
    expect(source).not.toContain('height: 44, marginTop: 8');
    expect(source).not.toContain("style={{ marginTop: 12, alignItems: 'center' }}");
  });

  it('does not render capture chrome until photo consent is saved', () => {
    const source = readAppRoute('progress/capture.tsx');
    const consentGateIndex = source.indexOf('if (consented !== true) {');
    const captureHeaderIndex = source.indexOf(
      '<View className="flex-row items-center justify-between px-6">',
    );

    expect(consentGateIndex).toBeGreaterThan(-1);
    expect(captureHeaderIndex).toBeGreaterThan(consentGateIndex);
    expect(source).toContain(
      'const canShowCamera =\n    consented === true &&\n    env.nativeCameraEnabled',
    );
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

  it('recovers direct review entries without a captured photo', () => {
    const source = readAppRoute('progress/review.tsx');
    const copy = readSource('features/photos/copy.ts');

    expect(copy).toContain("missingEyebrow: 'Photo not captured'");
    expect(copy).toContain("missingTitle: 'No photo to review yet.'");
    expect(source).toContain('function isNonBlank(value: string | null): value is string');
    expect(source).toContain('const hasCapturedPhoto = isNonBlank(capturedUri);');
    expect(source).toContain('if (!hasCapturedPhoto || add.isPending) return;');
    expect(source).toContain('if (!hasCapturedPhoto) {');
    expect(source).toContain('PHOTO_COPY.review.missingEyebrow');
    expect(source).toContain('PHOTO_COPY.review.missingCapture');
    expect(source).toContain('PHOTO_COPY.review.missingBack');
    expect(source).toContain("router.replace('/progress/capture')");
    expect(source).not.toContain('your photo');
  });

  it('keeps the first saved photo wired to both baseline analytics names', () => {
    const source = readAppRoute('progress/review.tsx');

    expect(source).toContain('const wasEmpty = (data?.count ?? 0) === 0;');
    expect(source).toContain("track('photo_captured', { on_device: true, result: verdict.flag })");
    expect(source).toContain("track('first_photo_captured')");
    expect(source).toContain("track('photo_baseline_added', { on_device: true })");
  });

  it('keeps the populated progress fixture gated to explicit E2E runs', () => {
    const source = readSource('features/photos/usePhotos.ts');
    const entitlement = readSource('features/subscription/useEntitlement.ts');

    expect(source).toContain("process.env.EXPO_PUBLIC_E2E_PROGRESS_PHOTOS !== 'populated'");
    expect(source).toContain('e2e-front-2026-04-01');
    expect(source).toContain('e2e-front-2026-05-12');
    expect(source).toContain('e2e-front-2026-06-24');
    expect(source).toContain('const photos = e2eProgressPhotoFixture() ?? (await loadPhotos());');
    expect(entitlement).toContain("fixture !== 'expired_store'");
    expect(entitlement).toContain("fixture !== 'expired_reverse_trial'");
    expect(entitlement).toContain("if (fixture === 'store_pro')");
    expect(entitlement).toContain("store: 'app_store'");
    expect(entitlement).toContain("managementUrl: 'https://apps.apple.com/account/subscriptions'");
    expect(entitlement).toContain('function e2eEntitlementState(): SubscriptionState | null');
  });

  it('keeps the compare photo picker dismissible without inert sheet buttons', () => {
    const source = readAppRoute('(tabs)/progress.tsx');

    expect(source).toContain(
      "const title = which === 'before' ? 'Choose the first photo' : 'Choose the second photo';",
    );
    expect(source).toContain('accessibilityLabel={title}');
    expect(source).toContain('accessibilityLabel="Dismiss photo picker"');
    expect(source).toContain('accessibilityRole="button"');
    expect(source).toContain(
      'className="flex-1"\n          accessibilityLabel="Dismiss photo picker"',
    );
    expect(source).toContain(
      "import { Alert, Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';",
    );
    expect(source).toContain('const { height: viewportHeight } = useWindowDimensions();');
    expect(source).toContain('const sheetMaxHeight = Math.max(0, viewportHeight - 44);');
    expect(source).toContain('const insets = useSafeAreaInsets();');
    expect(source).toContain('const sheetPaddingBottom = insets.bottom > 0 ? Math.max(40, insets.bottom + 24) : undefined;');
    expect(source).toContain(
      'sheetPaddingBottom === undefined\n              ? { maxHeight: sheetMaxHeight }',
    );
    expect(source).toContain(
      ': { maxHeight: sheetMaxHeight, paddingBottom: sheetPaddingBottom }',
    );
    expect(source).toContain('accessibilityViewIsModal');
    expect(source).toContain(
      'accessibilityLabel={`Choose ${short(p.takenLocalDate)} as the ${target} comparison photo`}',
    );
    expect(source).not.toContain('role="dialog"');
    expect(source).not.toContain('aria-modal');
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
