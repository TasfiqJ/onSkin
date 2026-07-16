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
    const copy = readSource('features/photos/copy.ts');
    const lockGate = readSource('features/photos/PhotoTimelineLockGate.tsx');

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
    expect(lockGate).toContain('PHOTO_COPY.lock.storageTitle');
    expect(lockGate).toContain('PHOTO_COPY.lock.storageBody');
    expect(lockGate).toContain('accessibilityLabel={PHOTO_COPY.lock.unlock}');
    expect(copy).toContain("storageTitle: 'Device-only photo storage'");
    expect(copy).toContain('Cloud backup is not available in this build.');
    expect(copy).not.toContain('cloudTitle');
    expect(copy).not.toContain('cloudOff');
  });

  it('gates every sensitive Progress entry with one shared timeline unlock', () => {
    const routes = [
      readAppRoute('(tabs)/progress.tsx'),
      readAppRoute('progress/capture.tsx'),
      readAppRoute('progress/review.tsx'),
      readAppRoute('progress/[id].tsx'),
    ];
    const provider = readSource('lib/applock/AppLockProvider.tsx');
    const gate = readSource('features/photos/PhotoTimelineLockGate.tsx');

    for (const source of routes) {
      expect(source).toContain(
        "import { PhotoTimelineLockGate } from '@/features/photos/PhotoTimelineLockGate';",
      );
      expect(source).toContain('<PhotoTimelineLockGate>');
      expect(source).toContain('</PhotoTimelineLockGate>');
      expect(source.indexOf('<ProGate')).toBeLessThan(source.indexOf('<PhotoTimelineLockGate>'));
    }
    expect(readAppRoute('progress/about.tsx')).not.toContain('PhotoTimelineLockGate');
    expect(provider).toContain('photoTimelineUnlocked');
    expect(provider).toContain('setPhotoTimelineUnlocked(false);');
    expect(provider).toContain('appUnlocked: loaded && !locked');
    expect(gate).toContain('const locked = enabled && !photoTimelineUnlocked;');
    expect(gate).toContain('if (!locked) return children;');
  });

  it('keeps encrypted storage failures out of empty and missing-photo states', () => {
    const routeSources = [
      readAppRoute('(tabs)/progress.tsx'),
      readAppRoute('progress/capture.tsx'),
      readAppRoute('progress/review.tsx'),
      readAppRoute('progress/[id].tsx'),
    ];
    const storageGate = readSource('features/photos/PhotoStorageGate.tsx');
    const routeSource = readSource('features/photos/ProgressPhotoRouteSource.tsx');
    const photosHook = readSource('features/photos/usePhotos.ts');
    const copy = readSource('features/photos/copy.ts');

    const [progressTab, ...standaloneRoutes] = routeSources;
    expect(progressTab).toContain(
      "import { PhotoStorageBoundary } from '@/features/photos/PhotoStorageGate';",
    );
    expect(progressTab).toContain('<PhotoStorageBoundary query={viewModel.photos} tone="paper">');
    expect(progressTab).toContain('</PhotoStorageBoundary>');
    expect(progressTab.indexOf('<PhotoTimelineLockGate>')).toBeLessThan(
      progressTab.indexOf('<ProgressRouteBoundary'),
    );

    for (const source of standaloneRoutes) {
      expect(source).toContain(
        "import { ProgressPhotoRouteSource } from '@/features/photos/ProgressPhotoRouteSource';",
      );
      expect(source).toContain('<ProgressPhotoRouteSource');
      expect(source).toContain('</ProgressPhotoRouteSource>');
      expect(source.indexOf('<PhotoTimelineLockGate>')).toBeLessThan(
        source.indexOf('<ProgressPhotoRouteSource'),
      );
    }
    for (const source of standaloneRoutes) {
      expect(source).toContain(
        '<ProgressPhotoRouteSource onExit={() => router.replace(APP_PROGRESS_ROUTE)}>',
      );
      expect(source).not.toContain("usePhotos('front')");
    }
    expect(readAppRoute('progress/about.tsx')).not.toContain('ProgressPhotoRouteSource');

    expect(storageGate).toContain('export function PhotoStorageBoundary({');
    expect(storageGate).toContain(
      'const { isError, isFetchedAfterMount, isFetching, isPending, refetch } = query;',
    );
    expect(storageGate).toContain('export function PhotoStorageGate(props: PhotoStorageGateProps)');
    expect(storageGate).toContain("const query = usePhotos('front');");
    expect(storageGate).toContain('<PhotoStorageBoundary {...props} query={query} />');
    expect(storageGate).toContain("'observing' | 'forcing' | 'failed' | 'validated'");
    expect(storageGate).toContain('const [forceValidationOnMount] = useState(');
    expect(storageGate).toContain('const result = await entryRefetch();');
    expect(storageGate).toContain('const result = await refetch();');
    expect(storageGate).toContain('if (result.isError)');
    expect(storageGate).toContain('if (entryValidated && !isPending && !storageUnavailable)');
    expect(storageGate).toContain('accessibilityRole="alert"');
    expect(storageGate).toContain('accessibilityState={{ disabled: retryBusy }}');
    expect(storageGate).toContain('className="min-h-[56px]');
    expect(storageGate).toContain('className="min-h-[48px]');
    expect(routeSource.match(/useLocalDateBoundary\(\)/g)).toHaveLength(1);
    expect(routeSource.match(/usePhotosFromBoundary\(boundary, 'front'\)/g)).toHaveLength(1);
    expect(routeSource).toContain('<PhotoStorageBoundary query={query} onExit={onExit}>');
    expect(routeSource).toContain('{query.data ? children(query.data) : null}');
    expect(copy).toContain("title: 'Your timeline could not open.'");
    expect(copy).toContain('Your photos and notes were not changed.');

    expect(photosHook).toContain('EXPO_PUBLIC_E2E_PROGRESS_STORAGE_FAILURE');
    expect(photosHook).toContain("fixture === 'unavailable'");
    expect(photosHook).toContain("fixture !== 'unavailable_once'");
    expect(photosHook).toContain('if (storageFailure) throw storageFailure;');
    expect(photosHook.indexOf('if (storageFailure) throw storageFailure;')).toBeLessThan(
      photosHook.indexOf('await loadPhotos()'),
    );
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
    expect(source).toContain(
      'const showPrepReminder = !(shortPhone || (compact && (saveFailed || reconsentRequired)));',
    );
    expect(source).toContain('fontSize: shortPhone ? 25 : compact ? 27 : 30');
    expect(source).toContain('lineHeight: shortPhone ? 27 : compact ? 29 : undefined');
    expect(source).toContain('marginBottom: shortPhone ? 6 : compact ? 10 : 16');
    expect(source).toContain('fontSize: shortPhone ? 13 : compact ? 14 : 14.5');
    expect(source).toContain('lineHeight: shortPhone ? 17 : compact ? 19 : 21');
    expect(source).toContain('fontSize: shortPhone ? 10 : compact ? 10.5 : 11');
    expect(source).toContain('lineHeight: shortPhone ? 13 : compact ? 15 : undefined');
    expect(source).toContain('marginBottom: shortPhone ? 6 : compact ? 8 : 14');
    expect(source.match(/height: 48/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
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

  it('does not render capture chrome until exact current photo consent is proven', () => {
    const source = readAppRoute('progress/capture.tsx');
    const consentGateIndex = source.indexOf('if (!consentIsCurrent) {');
    const captureHeaderIndex = source.indexOf(
      '<View className="flex-row items-center justify-between px-6">',
    );

    expect(consentGateIndex).toBeGreaterThan(-1);
    expect(captureHeaderIndex).toBeGreaterThan(consentGateIndex);
    expect(source).toContain(
      'const canShowCamera =\n    consentIsCurrent &&\n    env.nativeCameraEnabled',
    );
    expect(source).toContain('readPhotoCaptureConsent()');
    expect(source).toContain('photoCaptureConsentNeedsChoice(consentResult)');
    expect(source).toContain('function ConsentReadRecoveryGate');
    expect(source).toContain('function ConsentReadLoadingGate');
    expect(source).toContain('accessibilityLabel={PHOTO_COPY.capture.consentReadLoadingTitle}');
    expect(source).toContain('accessibilityRole="progressbar"');
    expect(source).toContain(
      'accessibilityValue={{ text: PHOTO_COPY.capture.consentReadLoadingBody }}',
    );
    expect(source).toContain('accessibilityState={{ busy: retrying, disabled: retrying }}');
    expect(source).toContain("'Retry reading saved photo choice'");
    expect(source).toContain('retrying={currentConsentReadState.retrying}');
    expect(source).toContain('onRetry={() => loadPhotoCaptureConsent(true)}');
    expect(source).toContain('PHOTO_CONSENT_READ_TIMEOUT_MS');
    expect(source).toContain('consentReadGenerationRef.current += 1');
    expect(source).toContain('consentGrantInFlightRef.current = true');
    expect(source).toContain('PhotoCaptureConsentStateChangedError');
    expect(source).toContain('result: error.result');
    expect(source).toContain("writeUncertain={consentSaveFailure === 'uncertain'}");
    expect(source).toContain('router.replace(APP_PROGRESS_ROUTE)');
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
    expect(capture).toContain('photoWidth: String(stagedCapture.width)');
    expect(capture).toContain('photoHeight: String(stagedCapture.height)');
    expect(capture).toContain('captureSessionId: stagedCapture.handle.operationId');
    expect(capture).toContain('CaptureStagingCleanupError');
    expect(capture).toContain('captureCleanupRetryRef');
    expect(capture).toContain('retryCaptureCleanup');
    expect(capture).toContain('disabled={capturing}');
    expect(capture).not.toContain('capturedUri:');
    expect(review).not.toContain('capturedUri?: string;');
    expect(review).toContain('resolveCapturedPhoto(captureSessionId)');
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
    expect(review).toContain("photos.reference?.qualitySource === 'post_capture_measurement'");
    expect(review).toContain('.mutateAsync({');
    expect(review).toContain('.then(() => {');
    expect(review).toContain('const saveInFlightRef = useRef(false);');
    expect(review).toContain('saveInFlightRef.current = true;');
    expect(review).toContain('saveInFlightRef.current = false;');
    expect(review).toContain('if (saveInFlightRef.current) return;');
    expect(review).toContain('disabled={add.isPending || cleanupInFlight}');
    expect(review).toContain('.catch(() => {');
    expect(review).toContain('setSaveFailed(true);');
    expect(review).toContain('const discardAndNavigate = (navigate: () => void) => {');
    expect(review).toContain('usePreventRemove(Boolean(captureSessionId)');
    expect(review).toContain('await resolveCapturedPhoto(captureSessionId)');
    expect(review).toContain('if (handle) await cleanupCapturedPhoto(handle);');
    expect(review).toContain('navigation.dispatch(action);');
    expect(review).not.toContain('cleanupCapturedPhoto(handle).catch(() => undefined)');
    expect(review).toContain('setCleanupFailed(true)');
    expect(review).toContain('outside every conditional storage, lock,');
    expect(review).toContain('if (!isOwnerQueryScopeCurrent(ownerScope)) return;');
    expect(review).not.toContain('cleanupCapturedPhoto(handle).catch(() => undefined)');
    expect(review).not.toContain('onSettled: () => {');
    expect(review).not.toContain('Number(params.alignment');
    expect(review).not.toContain('Number(params.lighting');

    expect(analysis).toContain("Platform.OS !== 'web'");
    expect(analysis).toContain("typeof __DEV__ === 'undefined' || !__DEV__");
    expect(analysis).toContain('EXPO_PUBLIC_E2E_PROGRESS_CAPTURE_ANALYSIS');
    expect(analysis).toContain('ANALYSIS_TIMEOUT_MS');
    expect(analysis).toContain('const analysisTerminal =');
    expect(analysis).toContain('if (!analysisUri || analysisTerminal) return;');
    expect(analysis).toContain('}, [analysisTerminal, analysisUri, ownerScope]);');
    expect(analysis).toContain('isOwnerQueryScopeCurrent(ownerScope)');
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
    expect(nativeDetector).toContain('runOwnerQueryOperation(ownerScope');
    expect(nativeDetector).toContain('detector.detectFaces(uri)');
    expect(nativeDetector).toContain('lease.assertCurrent()');
    expect(nativeDetector).toContain('isOwnerQueryScopeCurrent(ownerScope)');
    expect(nativeDetector).toContain('if (!faces)');
    expect(lighting).toContain('SAMPLE_WIDTH = 64');
    expect(lighting).toContain('withStagedPhotoAnalysisJpeg');
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

  it('isolates single-photo note typing below the full detail image shell', () => {
    const source = readAppRoute('progress/[id].tsx');
    const editorStart = source.indexOf('function PhotoNoteEditor({');
    const detailStart = source.indexOf('function PhotoDetailScreenContent({ photos }');
    const editor = source.slice(editorStart, detailStart);
    const detail = source.slice(detailStart);

    expect(editorStart).toBeGreaterThan(-1);
    expect(detailStart).toBeGreaterThan(editorStart);
    expect(editor).toContain('initialNotes: string;');
    expect(editor).toContain('onCommit: (notes: string) => void;');
    expect(editor).toContain('const [draft, setDraft] = useState(initialNotes);');
    expect(editor).toContain('const draftRef = useRef(initialNotes);');
    expect(editor).toContain('draftRef.current = notes;');
    expect(editor).toContain('<TextInput');
    expect(editor).toContain('value={draft}');
    expect(editor).toContain('onChangeText={updateDraft}');
    expect(editor).toContain('onBlur={() => onCommit(draftRef.current)}');
    expect(editor).toContain('placeholder={PHOTO_COPY.detail.notePlaceholder}');
    expect(editor).toContain('placeholderTextColor="rgba(244,239,231,0.35)"');
    expect(editor).toContain('multiline');
    expect(editor).toContain('borderRadius: 16');
    expect(editor).toContain("backgroundColor: 'rgba(244,239,231,0.06)'");
    expect(editor).toContain('padding: 16');
    expect(editor).toContain("marginBottom: 'auto'");
    expect(editor).toContain("fontFamily: 'HankenGrotesk-Regular'");
    expect(editor).toContain('fontSize: 13.5');
    expect(editor).toContain('lineHeight: 20');
    expect(editor).toContain('minHeight: 24');
    expect(editor).not.toContain('usePhotoActions');
    expect(editor).not.toContain('<PhotoImage');

    expect(detail).toContain('const { reference, remove, note } = usePhotoActions();');
    expect(detail).toContain('uri={photo.localUri}');
    expect(detail).toContain('photoId={photo.id}');
    expect(detail).toContain('rendition="display"');
    expect(detail).toContain('requestPriority="interactive"');
    expect(detail).toContain('<PhotoNoteEditor');
    expect(detail).toContain('key={photo.id}');
    expect(detail).toContain("initialNotes={photo.notes ?? ''}");
    expect(detail).toContain('onCommit={(notes) => note.mutate({ id: photo.id, notes })}');
    expect(detail).not.toContain('const [draft, setDraft]');
    expect(detail).not.toContain('<TextInput');
    expect(source).not.toContain('memo(PhotoImage');
  });

  it('recovers direct review entries without a captured photo', () => {
    const source = readAppRoute('progress/review.tsx');
    const copy = readSource('features/photos/copy.ts');

    expect(copy).toContain("missingEyebrow: 'Photo not captured'");
    expect(copy).toContain("missingTitle: 'No photo to review yet.'");
    expect(source).toContain('function isNonBlank(value: string | null): value is string');
    expect(source).toContain("const hasCapturedPhoto = captureSource.status === 'ready';");
    expect(source).toContain('await resolveCapturedPhoto(captureSessionId)');
    expect(source).toContain('if (handle) await cleanupCapturedPhoto(handle);');
    expect(source).toContain('<PhotoImage uri={capturedUri}');
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

    expect(source).toContain('const wasEmpty = photos.count === 0;');
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
    expect(source).toContain('const fixture = e2eProgressPhotoFixture();');
    expect(source).toContain('if (!fixture) await recoverPhotoStoreMutations();');
    expect(source).toContain('const photos = fixture ?? (await loadPhotos());');
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
    expect(source).toContain('FlatList,');
    expect(source).toContain('SectionList,');
    expect(source).toContain("} from 'react-native';");
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
      'accessibilityLabel={`Choose ${short(takenLocalDate)} as the ${target} comparison photo`}',
    );
    expect(source).not.toContain('role="dialog"');
    expect(source).not.toContain('aria-modal');
    expect(source).not.toContain('onPress={() => {}}');
  });

  it('virtualizes and viewability-gates thumbnail-first comparison picker demand', () => {
    const source = readAppRoute('(tabs)/progress.tsx');
    const pickerStart = source.indexOf('function PairPickerPhoto');
    const picker = source.slice(pickerStart, source.indexOf('function CompareView', pickerStart));

    expect(picker).toContain('function PairPickerPhoto({');
    expect(picker).toContain('<FlatList');
    expect(picker).toContain('horizontal');
    expect(picker).toContain(
      'const latestFirstPhotos = useMemo(() => photos.slice().reverse(), [photos]);',
    );
    expect(picker).toContain('data={latestFirstPhotos}');
    expect(picker).toContain('keyExtractor={(photo) => photo.id}');
    expect(picker).toContain('showsHorizontalScrollIndicator={false}');
    expect(picker).toContain('contentContainerStyle={{ gap: 10 }}');
    expect(picker).toContain('renderItem={({ item: photo }) => (');
    expect(picker).toContain('localUri={photo.localUri}');
    expect(picker).toContain('thumbnailLocalUri={photo.thumbnailLocalUri}');
    expect(picker).toContain('{(thumbnailLocalUri ?? localUri) ? (');
    expect(picker).toContain('uri={thumbnailLocalUri ?? localUri}');
    expect(picker).toContain('photoId={id}');
    expect(picker).toContain('rendition="thumbnail"');
    expect(picker).toContain('requestPriority="visible"');
    expect(picker).toContain('active={which !== null && visiblePhotoIds.has(photo.id)}');
    expect(picker).toContain('viewabilityConfig={PHOTO_VIEWABILITY_CONFIG}');
    expect(picker).toContain('onViewableItemsChanged={onPickerViewableItemsChanged}');
    expect(picker).toContain('style={{ width: 92, aspectRatio: 3 / 4 }}');
    expect(picker).toContain('accessibilityHint="Updates the side-by-side comparison pair"');
    expect(picker).toContain('accessibilityState={{ selected }}');
    expect(picker).toContain('onPress={() => onSelect(id)}');
    expect(picker).not.toContain('<ScrollView');
    expect(picker).toContain('initialNumToRender={4}');
    expect(picker).toContain('maxToRenderPerBatch={4}');
    expect(picker).toContain('windowSize={5}');
    expect(picker).not.toContain('removeClippedSubviews');
  });

  it('owns one Progress photo/date source and virtualizes timeline rows with SectionList', () => {
    const source = readAppRoute('(tabs)/progress.tsx');
    const viewModel = readSource('features/photos/useProgressRouteViewModel.ts');
    const photosHook = readSource('features/photos/usePhotos.ts');

    expect(source.match(/useLocalDateBoundary\(\)/g)).toHaveLength(1);
    expect(source.match(/useProgressRouteViewModel\(boundary\)/g)).toHaveLength(1);
    expect(source).not.toContain("usePhotos('front')");
    expect(viewModel).toContain("const photos = usePhotosFromBoundary(boundary, 'front');");
    expect(photosHook).toContain('export function usePhotosFromBoundary(');
    expect(photosHook).toContain('return usePhotosFromBoundary(boundary, series);');
    expect(source).toContain('<SectionList');
    expect(source).toContain('sections={sections}');
    expect(source).toContain('keyExtractor={(item) => item.key}');
    expect(source).toContain('renderItem={renderTimelineRow}');
    expect(source).toContain('viewabilityConfig={PHOTO_VIEWABILITY_CONFIG}');
    expect(source).toContain('onViewableItemsChanged={onTimelineViewableItemsChanged}');
    expect(source).toContain('uri={photo.thumbnailLocalUri ?? photo.localUri}');
    expect(source).toContain('active={!timelapseVisible && visibleRowKeys.has(item.key)}');
    expect(source).toContain('stickySectionHeadersEnabled={false}');
    expect(source).toContain('initialNumToRender={6}');
    expect(source).toContain('maxToRenderPerBatch={6}');
    expect(source).toContain('windowSize={7}');
    expect(source).toContain('const TimelinePhotosRow = memo(');
    expect(source).not.toContain('{data.monthGroups.map(');
  });

  it('tears down image-bearing Progress content while retaining lightweight presentation state', () => {
    const source = readAppRoute('(tabs)/progress.tsx');
    const gate = readSource('features/subscription/ProGate.tsx');

    expect(gate).toContain('const isFocused = useIsFocused();');
    expect(gate).toContain('if (!isFocused) return null;');
    expect(source.indexOf('<ProGate feature="photo_timeline">')).toBeLessThan(
      source.indexOf('<ProgressRouteBoundary'),
    );
    expect(source).toContain(
      "const [mode, setMode] = useState<'compare' | 'timeline'>('compare');",
    );
    expect(source).toContain(
      'const [compareSelection, setCompareSelection] = useState<CompareSelection>({});',
    );
    expect(source).toContain('const selectComparisonPhoto = useCallback(');
    expect(source).toContain('compareSelection={compareSelection}');
    expect(source).toContain('onSelectComparisonPhoto={selectComparisonPhoto}');
    expect(source).toContain('selection={compareSelection}');
    expect(source).toContain('if (picking) onSelectPhoto(picking, id);');
    expect(source).toContain('function ProgressTrendBoundary({');
    expect(source).toContain('return phase7Flags.trend ? (');
    expect(source).not.toContain('useTrendInsightFromPhotos(photos, { enabled: false })');
  });

  it('plays real local time-lapse frames with finite and reduced-motion-safe controls', () => {
    const source = readAppRoute('(tabs)/progress.tsx');
    const player = readSource('features/photos/PhotoTimelapse.tsx');

    expect(source).toContain("import { PhotoTimelapse } from '@/features/photos/PhotoTimelapse';");
    expect(source).toContain("import { timelapseFrames } from '@/features/photos/timelapse';");
    expect(source).toContain(
      'const frames = useMemo(() => timelapseFrames(data.series), [data.series]);',
    );
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
