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

  it('keeps the empty Progress first-photo CTA above the floating tab bar on shortest phones', () => {
    const source = readAppRoute('(tabs)/progress.tsx');

    expect(source).toContain('function FirstRun({ compact = false }: { compact?: boolean })');
    expect(source).toContain('const { height } = useWindowDimensions();');
    expect(source).toContain('const compactFirstRun = height < 520;');
    expect(source).toContain("contentContainerClassName={compactFirstRun ? 'pb-28' : 'pb-8'}");
    expect(source).toContain('<FirstRun compact={compactFirstRun} />');
    expect(source).toContain("compact ? 'pb-28 pt-1' : 'flex-1 justify-center pb-6'");
    expect(source).toContain("compact ? 'mb-2 p-3' : 'mb-5'");
    expect(source).toContain('fontSize: compact ? 22 : 26');
    expect(source).toContain("className={compact ? 'mt-1.5 text-[12.5px]' : 'mt-3'}");
    expect(source).toContain('lineHeight: compact ? 17 : 22');
    expect(source).toContain("compact ? 'mt-2.5 flex-row' : 'mt-5 flex-row'");
    expect(source).toContain("'mb-2 flex-row items-center gap-2.5 px-1'");
    expect(source).toContain("'mb-7 flex-row items-center gap-2.5 px-1'");
    expect(source).toContain("className={compact ? 'text-[12.5px]' : undefined}");
    expect(source).toContain("'h-[52px] items-center justify-center rounded-pill'");
    expect(source).toContain("'h-14 items-center justify-center rounded-pill'");
    expect(source).not.toContain("compact ? 'mb-3 p-4' : 'mb-5'");
    expect(source).not.toContain('fontSize: compact ? 24 : 26');
    expect(source).not.toContain("'mb-4 flex-row items-center gap-2.5 px-1'");
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
    expect(source).toContain('const height = useWindowDimensions().height;');
    expect(source).toContain('const compact = height < 640;');
    expect(source).toContain('const shortPhone = height < 520;');
    expect(source).toContain('const showPrepReminder = !(shortPhone || (compact && saveFailed));');
    expect(source).toContain('fontSize: shortPhone ? 25 : compact ? 27 : 30');
    expect(source).toContain('lineHeight: shortPhone ? 27 : compact ? 29 : undefined');
    expect(source).toContain('marginBottom: shortPhone ? 6 : compact ? 10 : 16');
    expect(source).toContain('fontSize: shortPhone ? 13 : compact ? 14 : 14.5');
    expect(source).toContain('lineHeight: shortPhone ? 17 : compact ? 19 : 21');
    expect(source).toContain('fontSize: shortPhone ? 10 : compact ? 10.5 : 11');
    expect(source).toContain('lineHeight: shortPhone ? 13 : compact ? 15 : undefined');
    expect(source).toContain('marginBottom: shortPhone ? 6 : compact ? 8 : 14');
    expect(source.match(/height: 48/g)).toHaveLength(5);
    expect(source).toContain("const NIGHT_SECONDARY_ACTION_BG = 'rgba(244,239,231,0.08)'");
    expect(source).toContain("const NIGHT_SECONDARY_ACTION_TEXT = 'rgba(244,239,231,0.84)'");
    expect(source).toContain("const NIGHT_FOOTNOTE_TEXT = 'rgba(244,239,231,0.76)'");
    expect(source).toContain("const NIGHT_CONSENT_OVERLAY_BG = '#100D0A'");
    expect(source).toContain('backgroundColor={NIGHT_CONSENT_OVERLAY_BG}');
    expect(source).toContain("color: 'rgba(244,239,231,0.9)'");
    expect(source).toContain("color: 'rgba(244,239,231,0.88)'");
    expect(source).toContain('height: compact ? 52 : 56');
    expect(source).toContain('EXPO_PUBLIC_E2E_PROGRESS_CAPTURE_FAILURE');
    expect(source).toContain('EXPO_PUBLIC_E2E_PROGRESS_CAMERA_PERMISSION');
    expect(source).toContain('PhotoCaptureFailureGate');
    expect(source).toContain('setPhotoCaptureFailed(true)');
    expect(source).toContain('setSettingsOpenFailed(true)');
    expect(source).toContain('CAMERA_FAILURE_COPY.progressSettingsTitle');
    expect(source).toContain('CAMERA_FAILURE_COPY.progressSettingsBody');
    expect(source).toContain('alertOnFailure: false');
    expect(source).toContain('{canAttemptCapture ? (');
    expect(source).toContain('Try photo again');
    expect(source).toContain('Open settings');
    expect(source).not.toContain('Alert.alert(CAMERA_FAILURE_COPY.progressCaptureTitle');
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

  it('uses measured post-capture quality and never timer-generated scores', () => {
    const capture = readAppRoute('progress/capture.tsx');
    const review = readAppRoute('progress/review.tsx');
    const detail = readAppRoute('progress/[id].tsx');
    const analysis = readSource('features/photos/useCaptureAnalysis.ts');
    const nativeProvider = readSource('features/photos/CaptureAnalysisProvider.native.tsx');
    const fallbackProvider = readSource('features/photos/CaptureAnalysisProvider.tsx');
    const nativeDetector = readSource('features/photos/useDetectedFaces.native.ts');
    const lighting = readSource('features/photos/analyzePhotoLighting.ts');

    expect(capture).toContain("signal_source: 'post_capture_measurement'");
    expect(capture).toContain('photoWidth: String(shot.width)');
    expect(capture).toContain('photoHeight: String(shot.height)');
    expect(capture).toContain('PHOTO_COPY.capture.qualityCheck');
    expect(capture).not.toContain('useGuidedCaptureSignals');
    expect(capture).not.toContain('camera_preview_estimate');
    expect(capture).not.toContain('setInterval');
    expect(capture).not.toContain('alignment: String(');
    expect(capture).not.toContain('lighting: String(');

    expect(review).toContain('CaptureAnalysisProvider');
    expect(review).toContain('useCaptureAnalysis');
    expect(review).toContain('alignmentScore: analysis.framing.score');
    expect(review).toContain('lightingScore: analysis.lighting.score');
    expect(review).toContain("? ('post_capture_measurement' as const)");
    expect(review).toContain('qualitySource,');
    expect(review).toContain("data?.reference?.qualitySource === 'post_capture_measurement'");
    expect(review).toContain('onSuccess: () => {');
    expect(review).toContain('const saveInFlightRef = useRef(false);');
    expect(review).toContain('saveInFlightRef.current = true;');
    expect(review).toContain('saveInFlightRef.current = false;');
    expect(review).toContain('if (saveInFlightRef.current) return;');
    expect(review).toContain('disabled={add.isPending}');
    expect(review).toContain('onError: () => {');
    expect(review).toContain('setSaveFailed(true);');
    expect(review).toContain('const discardCapturedPhoto = () => {');
    expect(review).toContain('.catch(() => undefined)');
    expect(review).not.toContain('onSettled: () => {');
    expect(review).not.toContain('Number(params.alignment');
    expect(review).not.toContain('Number(params.lighting');

    expect(analysis).toContain("Platform.OS !== 'web'");
    expect(analysis).toContain("typeof __DEV__ === 'undefined' || !__DEV__");
    expect(analysis).toContain('EXPO_PUBLIC_E2E_PROGRESS_CAPTURE_ANALYSIS');
    expect(analysis).toContain('ANALYSIS_TIMEOUT_MS');
    expect(analysis).toContain('const analysisTerminal =');
    expect(analysis).toContain('if (!analysisUri || analysisTerminal) return;');
    expect(analysis).toContain('}, [analysisTerminal, analysisUri]);');
    expect(analysis.indexOf('if (timedOutUri === analysisUri)')).toBeLessThan(
      analysis.indexOf("} else if (faceResult.status === 'done')"),
    );
    expect(analysis).toContain(
      'const lighting = timedOutUri === analysisUri ? unavailableLighting() : currentLighting;',
    );
    expect(nativeProvider).toContain('FaceDetectionProvider');
    expect(nativeProvider).toContain('deferInitialization');
    expect(nativeProvider).toContain("performanceMode: 'accurate'");
    expect(fallbackProvider).not.toContain('@infinitered/react-native-mlkit-face-detection');
    expect(nativeDetector).toContain('useFaceDetection');
    expect(nativeDetector).toContain('await detector.initialize()');
    expect(nativeDetector).toContain('validatedFaceObservations(await detector.detectFaces(uri))');
    expect(nativeDetector).toContain('if (!faces)');
    expect(lighting).toContain('SAMPLE_WIDTH = 64');
    expect(lighting).toContain('sampleFile.delete()');
    expect(detail).toContain("photo.qualitySource === 'post_capture_measurement'");
    expect(detail).toContain("? 'Capture checks recorded'");
    expect(detail).toContain(": 'Quality not measured'");
    expect(detail).not.toContain("'Aligned · well-lit'");
  });

  it('keeps review actions compact and reachable on short phones', () => {
    const source = readAppRoute('progress/review.tsx');

    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('const compact = height < 700');
    expect(source).toContain('Math.round(height * 0.54)');
    expect(source).toContain('height: photoHeight');
    expect(source).toContain('<ScrollView');
    expect(source).toContain('flexGrow: 1');
    expect(source).toContain('showsVerticalScrollIndicator={false}');
    expect(source).toContain('marginBottom: compact ? 12 : 18');
    expect(source).toContain('marginVertical: compact ? 12 : 18');
    expect(source).toContain('paddingVertical: compact ? 12 : 14');
    expect(source).toContain('paddingBottom: insets.bottom + (compact ? 16 : 24)');
    expect(source).not.toContain('height: 380, borderRadius: 24');
  });

  it('keeps single-photo detail actions and share failures stable on compact phones', () => {
    const source = readAppRoute('progress/[id].tsx');
    const copy = readSource('features/photos/copy.ts');

    expect(source).toContain(
      'const [shareFeedback, setShareFeedback] = useState<string | null>(null);',
    );
    expect(source).toContain(
      'const [shareConfirmVisible, setShareConfirmVisible] = useState(false);',
    );
    expect(source).toContain(
      'const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);',
    );
    expect(source).toContain(
      'const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);',
    );
    expect(source).toContain('const scrollRef = useRef<ScrollView>(null);');
    expect(source).toContain(
      'const photoHeight = compact ? Math.min(240, Math.round(height * 0.38)) : 330;',
    );
    expect(source).toContain('const actionFeedback = deleteFeedback ?? shareFeedback;');
    expect(source).toContain('function nudgeActionFeedbackIntoView()');
    expect(source).toContain('scrollRef.current?.scrollToEnd({ animated: true })');
    expect(source).toContain('requestAnimationFrame(scrollToEnd);');
    expect(source).toContain('setTimeout(scrollToEnd, 280);');
    expect(source).toContain('<ScrollView');
    expect(source).toContain('ref={scrollRef}');
    expect(source).toContain(
      'contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 20 }}',
    );
    expect(source).toContain('height: photoHeight');
    expect(source).toContain('marginBottom: compact ? 10 : 14');
    expect(source).toContain("flexWrap: 'wrap'");
    expect(source).toContain('const shared = await sharePhotoImageOnly(photo);');
    expect(source).toContain('if (!shared) {');
    expect(source).toContain('setShareFeedback(PHOTO_COPY.detail.shareUnavailable);');
    expect(source).toContain('setShareConfirmVisible(true);');
    expect(source).toContain('function e2ePhotoDeleteFailure(): boolean');
    expect(source).toContain("process.env.EXPO_PUBLIC_E2E_PHOTO_DELETE_FAILURE === '1'");
    expect(source).toContain('setDeleteConfirmVisible(true);');
    expect(source).toContain('async function deleteCurrentPhoto()');
    expect(source).toContain('await remove.mutateAsync(id);');
    expect(source).toContain('setDeleteFeedback(PHOTO_COPY.detail.deleteUnavailable);');
    expect(source).toContain('nudgeActionFeedbackIntoView();');
    expect(source).toContain('{PHOTO_COPY.detail.shareTitle}');
    expect(source).toContain('{PHOTO_COPY.detail.shareBody}');
    expect(source).toContain('{PHOTO_COPY.detail.deleteTitle}');
    expect(source).toContain('{PHOTO_COPY.detail.deleteBody}');
    expect(source).toContain("remove.isPending ? 'Deleting...' : PHOTO_COPY.detail.deleteConfirm");
    expect(source).toContain('accessibilityState={{ disabled: remove.isPending }}');
    expect(source).toContain('onPress={() => void shareCurrentPhoto()}');
    expect(source).toContain('onPress={() => void deleteCurrentPhoto()}');
    expect(source).toContain('{!shareConfirmVisible && !deleteConfirmVisible ? (');
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).toContain('marginBottom: 12');
    expect(source).not.toContain('bottom: insets.bottom + 82');
    expect(copy).toContain("deleteTitle: 'Delete this photo?'");
    expect(copy).toContain('deleteBody: "It\'s removed from your phone. This can\'t be undone."');
    expect(copy).toContain("deleteConfirm: 'Delete photo'");
    expect(copy).toContain(
      'deleteUnavailable:\n      "We couldn\'t delete this photo right now. It stays on this phone unless you try again.",',
    );
    expect(source).not.toContain('Alert.alert');
    expect(source).not.toContain('Alert.alert(PHOTO_COPY.detail.shareTitle');
    expect(source).not.toContain('height: 330,\n          borderRadius: 20');
    expect(source).not.toContain(
      "style={{ flexDirection: 'row', gap: 8, paddingTop: 16, paddingBottom: insets.bottom + 20 }}",
    );
    expect(source).not.toContain('onPress: () => void sharePhotoImageOnly(photo)');
  });

  it('recovers direct review entries without a captured photo', () => {
    const source = readAppRoute('progress/review.tsx');
    const copy = readSource('features/photos/copy.ts');

    expect(copy).toContain("missingEyebrow: 'Photo not captured'");
    expect(copy).toContain("missingTitle: 'No photo to review yet.'");
    expect(source).toContain('function isNonBlank(value: string | null): value is string');
    expect(source).toContain('const hasCapturedPhoto = isNonBlank(capturedUri);');
    expect(source).toContain(
      'if (!hasCapturedPhoto || add.isPending || saveInFlightRef.current) return;',
    );
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
    expect(source).toContain("track('photo_captured', { on_device: true })");
    expect(source).not.toContain('result: verdict.flag');
    expect(source).toContain("track('first_photo_captured')");
    expect(source).toContain("track('photo_baseline_added', { on_device: true })");
  });

  it('keeps the populated progress fixture gated to explicit E2E runs', () => {
    const source = readSource('features/photos/usePhotos.ts');
    const entitlement = readSource('features/subscription/useEntitlement.ts');

    expect(source).toContain("if (typeof __DEV__ === 'undefined' || !__DEV__) return null;");
    expect(source).toContain("process.env.EXPO_PUBLIC_E2E_PROGRESS_PHOTOS !== 'populated'");
    expect(source).toContain("'data:image/png;base64,");
    expect(source).toContain('localUri: E2E_PROGRESS_PHOTO_URI');
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
      "import { Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';",
    );
    expect(source).toContain('const { height: viewportHeight } = useWindowDimensions();');
    expect(source).toContain('const sheetMaxHeight = Math.max(0, viewportHeight - 44);');
    expect(source).toContain('const insets = useSafeAreaInsets();');
    expect(source).toContain(
      'const sheetPaddingBottom = insets.bottom > 0 ? Math.max(40, insets.bottom + 24) : undefined;',
    );
    expect(source).toContain(
      'sheetPaddingBottom === undefined\n              ? { maxHeight: sheetMaxHeight }',
    );
    expect(source).toContain(': { maxHeight: sheetMaxHeight, paddingBottom: sheetPaddingBottom }');
    expect(source).toContain('accessibilityViewIsModal');
    expect(source).toContain(
      'accessibilityLabel={`Choose ${short(p.takenLocalDate)} as the ${target} comparison photo`}',
    );
    expect(source).not.toContain('role="dialog"');
    expect(source).not.toContain('aria-modal');
    expect(source).not.toContain('onPress={() => {}}');
  });

  it('plays real local time-lapse frames with finite and reduced-motion-safe controls', () => {
    const source = readAppRoute('(tabs)/progress.tsx');
    const player = readSource('features/photos/PhotoTimelapse.tsx');

    expect(source).toContain("import { PhotoTimelapse } from '@/features/photos/PhotoTimelapse';");
    expect(source).toContain("import { timelapseFrames } from '@/features/photos/timelapse';");
    expect(source).toContain('const frames = timelapseFrames(data.series);');
    expect(source).toContain('{frames.length > 1 ? (');
    expect(source).toContain(
      'accessibilityLabel="Play a quiet time-lapse of your local photo series"',
    );
    expect(source).toContain('onPress={() => setTimelapseVisible(true)}');
    expect(source).toContain('<PhotoTimelapse');
    expect(source).not.toContain('TIMELAPSE_UNAVAILABLE');

    expect(player).toContain('AccessibilityInfo.isReduceMotionEnabled()');
    expect(player).toContain("AccessibilityInfo.addEventListener('reduceMotionChanged'");
    expect(player).toContain("AppState.addEventListener('change'");
    expect(player).toContain("if (state !== 'active') setPlaying(false);");
    expect(player).toContain('reduceMotion !== false');
    expect(player).toContain('if (reduceMotion !== false || frameCount < 2) return;');
    expect(player).toContain('{reduceMotion === false ? (');
    expect(player).toContain('if (next >= frameCount - 1) setPlaying(false);');
    expect(player).toContain('accessibilityRole="adjustable"');
    expect(player).toContain('animationType="none"');
    expect(player).toContain('accessibilityLabel="Quiet photo time-lapse"');
    expect(player).toContain('accessibilityViewIsModal');
    expect(player).not.toContain('role="dialog"');
    expect(player).not.toContain('aria-modal');
    expect(player).toContain("{ name: 'decrement', label: 'Previous photo' }");
    expect(player).toContain("{ name: 'increment', label: 'Next photo' }");
    expect(player).toContain('On this phone only. No scores or automatic judgments.');
    expect(player).not.toContain("track('");
    expect(source).not.toContain("Alert.alert('Quiet time-lapse'");
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
