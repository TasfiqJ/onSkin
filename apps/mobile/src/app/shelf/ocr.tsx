import { CameraView, useCameraPermissions } from 'expo-camera';
import { randomUUID } from 'expo-crypto';
import { Image } from 'expo-image';
import { router, useIsFocused, useNavigation } from 'expo-router';
import { usePreventRemove, type NavigationAction } from 'expo-router/react-navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { Button, RouteIconButton, Screen, Text } from '@/components/ui';
import {
  parseIngredientText,
  type ParsedIngredientToken,
} from '@/features/catalog/ingredientParser';
import { tagLabel } from '@/features/intelligence/presentation';
import { CAMERA_FAILURE_COPY } from '@/features/native/camera/failureCopy';
import {
  createLabelPhotoLifecycle,
  type LabelPhotoCleanupReason,
} from '@/features/native/camera/labelPhotoLifecycle';
import {
  labelPhotoFileSystem,
  retryLabelPhotoStartupScavenge,
  startLabelPhotoStartupScavenge,
} from '@/features/native/camera/labelPhotoStartup';
import {
  advanceLabelOcrCapture,
  applyLabelOcrRecognition,
  adoptLabelOcrSuggestion,
  beginLabelOcrReviewAttempt,
  createLabelOcrCoordinator,
  createLabelOcrReviewState,
  editLabelOcrReviewText,
  LABEL_CAPTURE_ANALYTICS_SOURCE,
  labelOcrNativeAdapter,
  labelOcrNativeAvailability,
  labelOcrAccessibilityAnnouncement,
  trackLabelRecognitionCompleted,
  type LabelOcrCancellationReason,
  type LabelOcrReviewState,
  type LabelOcrTranscript,
} from '@/features/native/ocr';
import { useIntake } from '@/features/shelf/IntakeContext';
import { BRAND } from '@/lib/brand';
import { cn } from '@/lib/cn';
import { track } from '@/lib/analytics/track';
import { env } from '@/lib/env';
import { openAppSettings } from '@/lib/navigation/appSettings';
import { APP_SHELF_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

type CaptureState = 'camera' | 'capturing' | 'review';
type RecognitionState =
  | 'disabled'
  | 'idle'
  | 'running'
  | 'ready'
  | 'no_text'
  | 'timed_out'
  | 'failed'
  | 'misconfigured';
type LabelPhotoLifecycle = ReturnType<typeof createLabelPhotoLifecycle>;
type LabelOcrCoordinator = ReturnType<typeof createLabelOcrCoordinator>;
type DevShelfOcrResult = 'recognized' | 'no_text' | 'timed_out' | 'failed';
type ProtectedOcrNavigation =
  | Readonly<{ kind: 'action'; action: NavigationAction }>
  | Readonly<{ kind: 'manual' }>
  | Readonly<{ kind: 'back' }>;

function devShelfOcrCaptureFailureMode(): 'once' | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  return process.env.EXPO_PUBLIC_E2E_SHELF_OCR_CAPTURE_FAILURE === 'once' ? 'once' : null;
}

function devShelfOcrResultMode(): DevShelfOcrResult | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__ || Platform.OS !== 'web') return null;
  const fixture = process.env.EXPO_PUBLIC_E2E_SHELF_OCR_RESULT?.trim().toLowerCase();
  return fixture === 'recognized' ||
    fixture === 'no_text' ||
    fixture === 'timed_out' ||
    fixture === 'failed'
    ? fixture
    : null;
}

function devShelfOcrTranscript(): LabelOcrTranscript {
  return Object.freeze({
    text: 'Aqua, Glycerin, Niacinamide, 水, Ниацинамид',
    confidenceCue: 'ambiguous',
    truncated: true,
    lines: Object.freeze([
      Object.freeze({
        text: 'Aqua, Glycerin',
        alternativeText: null,
        boundingBox: Object.freeze({ x: 0.08, y: 0.78, width: 0.84, height: 0.08 }),
        confidenceCue: 'clear',
        sourceObservationIndex: 0,
      }),
      Object.freeze({
        text: 'Niacinamide, 水',
        alternativeText: 'Nicotinamide, 水',
        boundingBox: Object.freeze({ x: 0.08, y: 0.66, width: 0.84, height: 0.08 }),
        confidenceCue: 'ambiguous',
        sourceObservationIndex: 1,
      }),
      Object.freeze({
        text: 'Ниацинамид',
        alternativeText: null,
        boundingBox: Object.freeze({ x: 0.08, y: 0.54, width: 0.84, height: 0.08 }),
        confidenceCue: 'review',
        sourceObservationIndex: 2,
      }),
    ]),
  });
}

function devShelfCameraPermissionMode(): 'denied_no_retry' | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  return process.env.EXPO_PUBLIC_E2E_SHELF_CAMERA_PERMISSION === 'denied_no_retry'
    ? 'denied_no_retry'
    : null;
}

function primaryTag(token: ParsedIngredientToken): string {
  return token.tags[0] ? tagLabel(token.tags[0]) : 'Review';
}

function initialRecognitionState(): RecognitionState {
  if (devShelfOcrResultMode() !== null) return 'idle';
  if (!env.nativeOcrEnabled) return 'disabled';
  return labelOcrNativeAvailability() === 'configured' ? 'idle' : 'misconfigured';
}

function recognitionAvailable(): boolean {
  return env.nativeOcrEnabled && labelOcrNativeAvailability() === 'configured';
}

export default function OcrScreen() {
  const isFocused = useIsFocused();
  const navigation = useNavigation();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const labelPhotoLifecycleRef = useRef<LabelPhotoLifecycle | null>(null);
  const labelOcrCoordinatorRef = useRef<LabelOcrCoordinator | null>(null);
  const devOcrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announcedRecognitionStateRef = useRef<RecognitionState | null>(null);
  const labelPhotoStartupRef = useRef<Promise<void>>(Promise.resolve());
  const captureDrainRef = useRef<Promise<void>>(Promise.resolve());
  const protectedNavigationRef = useRef<ProtectedOcrNavigation | null>(null);
  const routeExitInFlightRef = useRef(false);
  const capturedUriRef = useRef<string | null>(null);
  const [reviewState, setReviewState] = useState<LabelOcrReviewState>(createLabelOcrReviewState);
  const reviewStateRef = useRef<LabelOcrReviewState>(reviewState);
  const mountedRef = useRef(false);
  const captureInFlightRef = useRef(false);
  const navigationInFlightRef = useRef(false);
  const [state, setState] = useState<CaptureState>('camera');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [labelCaptureFailed, setLabelCaptureFailed] = useState(false);
  const [photoCleanupBusy, setPhotoCleanupBusy] = useState(false);
  const [photoCleanupFailed, setPhotoCleanupFailed] = useState(false);
  const [photoScavengeFailed, setPhotoScavengeFailed] = useState(false);
  const [routeRemovalReady, setRouteRemovalReady] = useState(false);
  const [settingsOpenFailed, setSettingsOpenFailed] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [recognitionState, setRecognitionState] =
    useState<RecognitionState>(initialRecognitionState);
  const [latestTranscript, setLatestTranscript] = useState<LabelOcrTranscript | null>(null);
  const [simulateCaptureFailureOnce, setSimulateCaptureFailureOnce] = useState(
    () => devShelfOcrCaptureFailureMode() === 'once',
  );
  const { update } = useIntake();

  useEffect(() => {
    const lifecycle = createLabelPhotoLifecycle(labelPhotoFileSystem, randomUUID);
    const coordinator = createLabelOcrCoordinator({
      adapter: labelOcrNativeAdapter,
      createRequestId: randomUUID,
    });
    labelPhotoLifecycleRef.current = lifecycle;
    labelOcrCoordinatorRef.current = coordinator;
    mountedRef.current = true;
    const startup = startLabelPhotoStartupScavenge().then(() => undefined);
    labelPhotoStartupRef.current = startup;
    void startup.catch(() => {
      if (mountedRef.current && labelPhotoLifecycleRef.current === lifecycle) {
        setPhotoScavengeFailed(true);
      }
    });

    return () => {
      mountedRef.current = false;
      if (devOcrTimerRef.current !== null) clearTimeout(devOcrTimerRef.current);
      devOcrTimerRef.current = null;
      if (labelPhotoLifecycleRef.current === lifecycle) {
        labelPhotoLifecycleRef.current = null;
      }
      if (labelOcrCoordinatorRef.current === coordinator) {
        labelOcrCoordinatorRef.current = null;
      }
      void coordinator
        .dispose()
        .then(() => lifecycle.dispose())
        .catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios' || announcedRecognitionStateRef.current === recognitionState) {
      return;
    }
    announcedRecognitionStateRef.current = recognitionState;
    const announcement = labelOcrAccessibilityAnnouncement(recognitionState);
    if (announcement !== null) {
      AccessibilityInfo.announceForAccessibilityWithOptions(announcement, { queue: true });
    }
  }, [recognitionState]);

  const cameraPermissionMode = devShelfCameraPermissionMode();
  const forceDeniedCameraPermission = cameraPermissionMode === 'denied_no_retry';
  const cameraEnabled = env.nativeCameraEnabled && Platform.OS !== 'web';
  const permissionGranted = forceDeniedCameraPermission ? false : Boolean(permission?.granted);
  const canAskCameraPermission = forceDeniedCameraPermission
    ? false
    : (permission?.canAskAgain ?? true);
  const canShowPermissionRecovery =
    !permissionGranted && (forceDeniedCameraPermission || (cameraEnabled && Boolean(permission)));
  const canShowCamera = cameraEnabled && permissionGranted && !cameraUnavailable;
  const devOcrResult = devShelfOcrResultMode();
  const canAttemptCapture =
    !photoScavengeFailed &&
    ((canShowCamera && cameraReady) || simulateCaptureFailureOnce || devOcrResult !== null);
  const rawText = reviewState.text;
  const parsed = useMemo(() => parseIngredientText(rawText), [rawText]);
  const activeTokens = parsed.tokens.filter((token) => token.tags.length > 0);
  const lowConfidence = parsed.tokens.find((token) => token.isUnmatched);
  const canContinue = rawText.trim().length > 0;
  const { height: viewportHeight } = useWindowDimensions();
  const ultraShortPhone = viewportHeight < 460;
  const splitShortPhone = viewportHeight < 410;

  const commitReviewState = (
    updateState: (current: LabelOcrReviewState) => LabelOcrReviewState,
  ): LabelOcrReviewState => {
    const next = updateState(reviewStateRef.current);
    reviewStateRef.current = next;
    if (mountedRef.current) setReviewState(next);
    return next;
  };

  const cancelAndDrainRecognition = async (
    reason: LabelOcrCancellationReason,
  ): Promise<boolean> => {
    if (devOcrTimerRef.current !== null) clearTimeout(devOcrTimerRef.current);
    devOcrTimerRef.current = null;
    const coordinator = labelOcrCoordinatorRef.current;
    if (!coordinator) return true;
    try {
      await coordinator.cancelAndDrain(reason);
      return true;
    } catch {
      if (mountedRef.current) setRecognitionState('failed');
      return false;
    }
  };

  const cleanupLabelPhoto = async (reason: LabelPhotoCleanupReason): Promise<boolean> => {
    const lifecycle = labelPhotoLifecycleRef.current;
    if (!lifecycle) return true;
    try {
      await lifecycle.cleanup(reason);
      if (mountedRef.current) {
        capturedUriRef.current = null;
        setCapturedUri(null);
        setPhotoCleanupFailed(false);
      }
      return true;
    } catch {
      if (mountedRef.current) setPhotoCleanupFailed(true);
      return false;
    }
  };

  const recognizeManagedPhoto = async (
    lifecycle: LabelPhotoLifecycle,
    managedUri: string,
    captureReviewState: LabelOcrReviewState,
  ): Promise<void> => {
    const coordinator = labelOcrCoordinatorRef.current;
    if (!env.nativeOcrEnabled) {
      if (mountedRef.current) setRecognitionState('disabled');
      return;
    }
    if (!coordinator || labelOcrNativeAvailability() !== 'configured') {
      if (mountedRef.current) setRecognitionState('misconfigured');
      return;
    }

    const fence = beginLabelOcrReviewAttempt(captureReviewState);
    if (mountedRef.current) {
      setLatestTranscript(null);
      setRecognitionState('running');
    }

    const recognitionStartedAt = performance.now();
    const result = await coordinator.recognize({
      managedPhotoUri: managedUri,
      captureGeneration: captureReviewState.captureGeneration,
    });
    trackLabelRecognitionCompleted({
      result: result.status,
      elapsedMs: performance.now() - recognitionStartedAt,
    });
    if (
      !mountedRef.current ||
      labelPhotoLifecycleRef.current !== lifecycle ||
      lifecycle.current() !== managedUri ||
      capturedUriRef.current !== managedUri ||
      result.captureGeneration !== reviewStateRef.current.captureGeneration
    ) {
      return;
    }

    if (result.status === 'recognized') {
      commitReviewState((current) =>
        applyLabelOcrRecognition(current, fence, result.transcript.text),
      );
      setLatestTranscript(result.transcript);
      setRecognitionState('ready');
      return;
    }
    setLatestTranscript(null);
    if (result.status === 'no_text') {
      setRecognitionState('no_text');
    } else if (result.status === 'timed_out') {
      setRecognitionState('timed_out');
    } else if (result.status === 'cancelled' && result.reason === 'native') {
      setRecognitionState('failed');
    } else if (result.status === 'failed') {
      setRecognitionState(
        result.reason === 'not_configured' ||
          result.reason === 'unavailable' ||
          result.reason === 'misconfigured'
          ? 'misconfigured'
          : 'failed',
      );
    }
  };

  const runDevOcrResult = (
    fixture: DevShelfOcrResult,
    captureReviewState: LabelOcrReviewState,
  ): void => {
    const fence = beginLabelOcrReviewAttempt(captureReviewState);
    setLatestTranscript(null);
    setRecognitionState('running');
    devOcrTimerRef.current = setTimeout(() => {
      devOcrTimerRef.current = null;
      if (
        !mountedRef.current ||
        reviewStateRef.current.captureGeneration !== captureReviewState.captureGeneration
      ) {
        return;
      }
      if (fixture === 'recognized') {
        const transcript = devShelfOcrTranscript();
        commitReviewState((current) => applyLabelOcrRecognition(current, fence, transcript.text));
        setLatestTranscript(transcript);
        setRecognitionState('ready');
      } else {
        setLatestTranscript(null);
        setRecognitionState(fixture);
      }
    }, 500);
  };

  const capture = async () => {
    const lifecycle = labelPhotoLifecycleRef.current;
    if (
      !lifecycle ||
      (!cameraRef.current && !simulateCaptureFailureOnce && devOcrResult === null) ||
      (canShowCamera && !cameraReady && !simulateCaptureFailureOnce && devOcrResult === null) ||
      captureInFlightRef.current ||
      photoCleanupBusy
    ) {
      return;
    }
    captureInFlightRef.current = true;
    haptics.select();
    setState('capturing');
    setLabelCaptureFailed(false);
    setPhotoCleanupFailed(false);
    try {
      try {
        await labelPhotoStartupRef.current;
      } catch {
        if (mountedRef.current && labelPhotoLifecycleRef.current === lifecycle) {
          setPhotoScavengeFailed(true);
          setState('camera');
        }
        return;
      }
      if (!mountedRef.current || labelPhotoLifecycleRef.current !== lifecycle) return;
      const captureReviewState = commitReviewState(advanceLabelOcrCapture);
      if (devOcrResult !== null) {
        capturedUriRef.current = null;
        setCapturedUri(null);
        setState('review');
        track('label_capture_photo_taken', { native_ocr_enabled: false });
        runDevOcrResult(devOcrResult, captureReviewState);
        return;
      }
      if (simulateCaptureFailureOnce) {
        setSimulateCaptureFailureOnce(false);
        throw new Error('E2E_SHELF_OCR_CAPTURE_FAILURE');
      }
      const photo = await cameraRef.current!.takePictureAsync({
        quality: 0.72,
        base64: false,
        exif: false,
        shutterSound: false,
      });
      const managedUri = await lifecycle.adoptCapturedPhoto(photo?.uri);
      if (!mountedRef.current || labelPhotoLifecycleRef.current !== lifecycle) {
        await lifecycle.cleanup('cancel');
        return;
      }
      capturedUriRef.current = managedUri;
      setCapturedUri(managedUri);
      setState('review');
      track('label_capture_photo_taken', {
        native_ocr_enabled: recognitionAvailable(),
      });
      // Recognition owns a separate failure boundary. A Vision failure must
      // retain the managed photo as a local reference and preserve manual text.
      void recognizeManagedPhoto(lifecycle, managedUri, captureReviewState);
    } catch {
      await lifecycle?.cleanup('capture_failure').catch(() => undefined);
      if (mountedRef.current) {
        const retainedUri = lifecycle?.current() ?? null;
        capturedUriRef.current = retainedUri;
        setCapturedUri(retainedUri);
        setPhotoCleanupFailed(Boolean(lifecycle?.hasPendingCleanup()));
        setLabelCaptureFailed(true);
        setState('review');
      }
    } finally {
      captureInFlightRef.current = false;
    }
  };

  const startCapture = (): void => {
    // Never replace the active drain with the resolved no-op returned by
    // `capture()`'s in-flight guard. Route cleanup must retain the promise for
    // the real Camera write until it settles.
    if (captureInFlightRef.current || photoCleanupBusy) return;
    const attempt = capture();
    captureDrainRef.current = attempt.then(
      () => undefined,
      () => undefined,
    );
    void attempt;
  };

  const prepareProtectedRouteRemoval = async (
    pendingNavigation: ProtectedOcrNavigation,
  ): Promise<void> => {
    if (routeRemovalReady || routeExitInFlightRef.current || navigationInFlightRef.current) {
      return;
    }
    routeExitInFlightRef.current = true;
    setPhotoCleanupBusy(true);
    let authorized = false;
    try {
      await captureDrainRef.current;
      if (!mountedRef.current) return;
      const recognitionStopped = await cancelAndDrainRecognition('navigation');
      if (!recognitionStopped) return;
      const cleaned = await cleanupLabelPhoto('cancel');
      if (!cleaned || !mountedRef.current) return;
      protectedNavigationRef.current = pendingNavigation;
      authorized = true;
      setRouteRemovalReady(true);
    } finally {
      if (!authorized) {
        routeExitInFlightRef.current = false;
        if (mountedRef.current) setPhotoCleanupBusy(false);
      }
    }
  };

  // Arm the guard before capture begins so a same-frame hardware/swipe-back
  // cannot race the first state update and unmount a newly created photo.
  const shouldPreventRouteRemoval = !routeRemovalReady;

  usePreventRemove(shouldPreventRouteRemoval, ({ data }) => {
    void prepareProtectedRouteRemoval({ kind: 'action', action: data.action });
  });

  useEffect(() => {
    if (!routeRemovalReady) return;
    const pendingNavigation = protectedNavigationRef.current;
    if (pendingNavigation === null) return;
    protectedNavigationRef.current = null;
    if (pendingNavigation.kind === 'action') {
      navigation.dispatch(pendingNavigation.action);
    } else if (pendingNavigation.kind === 'manual') {
      router.replace('/shelf/manual');
    } else {
      backOrReplace(router, APP_SHELF_ROUTE);
    }
  }, [navigation, routeRemovalReady]);

  const onContinue = async () => {
    if (!canContinue || navigationInFlightRef.current || photoCleanupBusy) return;
    navigationInFlightRef.current = true;
    setPhotoCleanupBusy(true);
    haptics.select();
    await captureDrainRef.current;
    if (!mountedRef.current) return;
    const recognitionStopped = await cancelAndDrainRecognition('manual_continue');
    if (!recognitionStopped) {
      navigationInFlightRef.current = false;
      if (mountedRef.current) setPhotoCleanupBusy(false);
      return;
    }
    const cleaned = await cleanupLabelPhoto('continue');
    if (!cleaned) {
      navigationInFlightRef.current = false;
      if (mountedRef.current) setPhotoCleanupBusy(false);
      return;
    }
    const finalParsed = parseIngredientText(reviewStateRef.current.text);
    track('ingredient_parse_completed', {
      source: LABEL_CAPTURE_ANALYTICS_SOURCE,
      native_ocr_enabled: recognitionAvailable(),
      result: finalParsed.status,
      count: finalParsed.tokens.length,
    });
    update({
      ingredients: finalParsed.tokens.map((token) => token.displayName),
      addedVia: 'ocr',
      ingredientParseStatus: finalParsed.status,
      ingredientParseConfidence: finalParsed.confidence,
      parserVersion: finalParsed.parserVersion,
    });
    protectedNavigationRef.current = { kind: 'manual' };
    setRouteRemovalReady(true);
  };

  const cancelAndGoBack = async () => {
    if (navigationInFlightRef.current || photoCleanupBusy) return;
    navigationInFlightRef.current = true;
    setPhotoCleanupBusy(true);
    haptics.select();
    await captureDrainRef.current;
    if (!mountedRef.current) return;
    const recognitionStopped = await cancelAndDrainRecognition('navigation');
    if (!recognitionStopped) {
      navigationInFlightRef.current = false;
      if (mountedRef.current) setPhotoCleanupBusy(false);
      return;
    }
    const cleaned = await cleanupLabelPhoto('cancel');
    if (!cleaned) {
      navigationInFlightRef.current = false;
      if (mountedRef.current) setPhotoCleanupBusy(false);
      return;
    }
    protectedNavigationRef.current = { kind: 'back' };
    setRouteRemovalReady(true);
  };

  const retryLabelCapture = async () => {
    if (photoCleanupBusy) return;
    setPhotoCleanupBusy(true);
    haptics.select();
    await captureDrainRef.current;
    if (!mountedRef.current) return;
    const recognitionStopped = await cancelAndDrainRecognition('retake');
    if (!recognitionStopped) {
      if (mountedRef.current) setPhotoCleanupBusy(false);
      return;
    }
    const cleaned = await cleanupLabelPhoto('retake');
    if (mountedRef.current) setPhotoCleanupBusy(false);
    if (!cleaned || !mountedRef.current) return;
    setLatestTranscript(null);
    setRecognitionState(initialRecognitionState());
    setCameraReady(false);
    setState('camera');
    setLabelCaptureFailed(false);
  };

  const retryPhotoScavenging = async () => {
    if (photoCleanupBusy || labelPhotoLifecycleRef.current?.hasPendingCleanup()) return;
    setPhotoCleanupBusy(true);
    haptics.select();
    const startup = retryLabelPhotoStartupScavenge().then(() => undefined);
    labelPhotoStartupRef.current = startup;
    try {
      await startup;
      if (mountedRef.current) setPhotoScavengeFailed(false);
    } catch {
      if (mountedRef.current) setPhotoScavengeFailed(true);
    } finally {
      if (mountedRef.current) setPhotoCleanupBusy(false);
    }
  };

  const handleCameraMountError = async () => {
    setPhotoCleanupBusy(true);
    await captureDrainRef.current;
    if (!mountedRef.current) return;
    const recognitionStopped = await cancelAndDrainRecognition('camera_failure');
    if (recognitionStopped) await cleanupLabelPhoto('capture_failure');
    if (!mountedRef.current) return;
    setPhotoCleanupBusy(false);
    setCameraReady(false);
    setCameraUnavailable(true);
    setLabelCaptureFailed(false);
    setState('review');
  };

  const requestCameraAccess = () => {
    haptics.select();
    setSettingsOpenFailed(false);
    void requestPermission();
  };

  const openShelfCameraSettings = async () => {
    haptics.select();
    setSettingsOpenFailed(false);
    const opened = await openAppSettings({
      failureTitle: CAMERA_FAILURE_COPY.shelfSettingsTitle,
      failureMessage: CAMERA_FAILURE_COPY.shelfSettingsBody,
      alertOnFailure: false,
    });
    if (!opened) setSettingsOpenFailed(true);
  };

  const useRecognizedSuggestion = () => {
    if (navigationInFlightRef.current || photoCleanupBusy) return;
    haptics.select();
    commitReviewState(adoptLabelOcrSuggestion);
  };

  const unclearLines =
    latestTranscript?.lines.filter((line) => line.confidenceCue !== 'clear') ?? [];
  const displayedUnclearLines = unclearLines.slice(0, 3);
  const recognitionDisclosure =
    devOcrResult !== null
      ? 'Development-only deterministic OCR state. It does not exercise Apple Vision or a device photo.'
      : recognitionState === 'disabled'
        ? 'On-device OCR is not enabled in this build yet. Use the captured label as a reference, then type or paste the ingredients below.'
        : recognitionState === 'misconfigured'
          ? "Automatic label reading isn't available in this build. Type or paste the ingredients below."
          : 'Text is read on this iPhone. The temporary photo is removed when you continue, retake, or leave.';

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="mt-2 flex-row items-center justify-between">
        <RouteIconButton
          accessibilityLabel="Back"
          disabled={photoCleanupBusy}
          onPress={() => void cancelAndGoBack()}
        />
        <Text variant="body" className="font-sans-semibold">
          Read the label
        </Text>
        <View className="w-[44px]" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName={state === 'review' ? 'pb-28' : ultraShortPhone ? 'pb-3' : 'pb-5'}
      >
        <View
          className={cn(
            splitShortPhone
              ? 'mt-2 h-[140px]'
              : ultraShortPhone
                ? 'mt-3 h-[176px]'
                : 'mt-4 h-[230px]',
            'overflow-hidden rounded-[18px] bg-night-elevated',
          )}
        >
          {state === 'review' ? (
            capturedUri && !photoCleanupBusy ? (
              <Image
                source={{ uri: capturedUri }}
                cachePolicy="none"
                style={{ flex: 1 }}
                contentFit="cover"
              />
            ) : (
              <View className="flex-1 items-center justify-center px-6">
                <Text variant="body" tone="inverse" className="text-center font-sans-semibold">
                  {devOcrResult !== null
                    ? 'Deterministic OCR review fixture'
                    : labelCaptureFailed
                      ? CAMERA_FAILURE_COPY.labelCaptureTitle
                      : cameraUnavailable
                        ? CAMERA_FAILURE_COPY.labelUnavailableTitle
                        : 'Capture the ingredient panel'}
                </Text>
                <Text variant="bodySm" tone="inverseMuted" className="mt-2 text-center">
                  {devOcrResult !== null
                    ? 'This development state proves only the review interface and interactions.'
                    : labelCaptureFailed
                      ? CAMERA_FAILURE_COPY.labelCaptureBody
                      : cameraUnavailable
                        ? CAMERA_FAILURE_COPY.labelUnavailableBody
                        : 'Use the editable text below to keep adding this product.'}
                </Text>
              </View>
            )
          ) : canShowCamera ? (
            <CameraView
              ref={cameraRef}
              active={isFocused}
              animateShutter
              facing="back"
              mode="picture"
              onCameraReady={() => setCameraReady(true)}
              onMountError={() => void handleCameraMountError()}
              style={{ flex: 1 }}
            />
          ) : (
            <View className="flex-1 items-center justify-center px-6">
              <Text variant="body" tone="inverse" className="text-center font-sans-semibold">
                {cameraUnavailable
                  ? CAMERA_FAILURE_COPY.labelUnavailableTitle
                  : 'Capture the ingredient panel'}
              </Text>
              <Text variant="bodySm" tone="inverseMuted" className="mt-2 text-center">
                {cameraUnavailable
                  ? CAMERA_FAILURE_COPY.labelUnavailableBody
                  : 'Camera permission lets you keep the label beside the editable text. Manual entry still works.'}
              </Text>
              {canShowPermissionRecovery ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={
                    canAskCameraPermission
                      ? requestCameraAccess
                      : () => void openShelfCameraSettings()
                  }
                  className="mt-5 min-h-[48px] items-center justify-center rounded-pill bg-paper px-5 py-3"
                >
                  <Text className="font-sans-semibold text-night">
                    {canAskCameraPermission ? 'Allow camera' : 'Open settings'}
                  </Text>
                </Pressable>
              ) : null}
              {settingsOpenFailed ? (
                <View
                  accessibilityRole="alert"
                  className="mt-4 w-full rounded-[14px] p-3.5"
                  style={{
                    borderWidth: 1,
                    borderColor: 'rgba(217,161,131,0.45)',
                    backgroundColor: 'rgba(217,161,131,0.14)',
                  }}
                >
                  <Text variant="bodySm" tone="inverse" className="font-sans-semibold">
                    {CAMERA_FAILURE_COPY.shelfSettingsTitle}
                  </Text>
                  <Text variant="bodySm" tone="inverseMuted" className="mt-1">
                    {CAMERA_FAILURE_COPY.shelfSettingsBody}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
          {canShowCamera || capturedUri ? (
            <View
              className={cn(
                ultraShortPhone ? 'top-[48px] h-[78px]' : 'top-[64px] h-[96px]',
                'absolute left-5 right-5 rounded-[10px]',
              )}
              style={{
                pointerEvents: 'none',
                borderWidth: 2,
                borderColor: 'rgba(217,161,131,0.65)',
              }}
            />
          ) : null}
        </View>

        {state === 'review' && (labelCaptureFailed || cameraUnavailable) ? (
          <View
            accessibilityRole="alert"
            className="mt-4 rounded-[14px] border border-clay/30 bg-clay-tint p-3.5"
          >
            <Text variant="bodySm" className="font-sans-semibold">
              {labelCaptureFailed
                ? CAMERA_FAILURE_COPY.labelCaptureTitle
                : CAMERA_FAILURE_COPY.labelUnavailableTitle}
            </Text>
            <Text variant="bodySm" tone="muted" className="mt-1">
              {labelCaptureFailed
                ? CAMERA_FAILURE_COPY.labelCaptureBody
                : CAMERA_FAILURE_COPY.labelUnavailableBody}
            </Text>
            {labelCaptureFailed ? (
              <Pressable
                accessibilityRole="button"
                disabled={photoCleanupBusy}
                className="mt-3 min-h-[48px] items-center justify-center rounded-pill bg-paper-raised px-4 py-2"
                onPress={() => void retryLabelCapture()}
              >
                <Text className="font-sans-semibold text-ink">Try label photo again</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {photoCleanupFailed ? (
          <View
            accessibilityRole="alert"
            className="mt-4 rounded-[14px] border border-clay/30 bg-clay-tint p-3.5"
          >
            <Text variant="bodySm" className="font-sans-semibold">
              Temporary photo cleanup needs another try
            </Text>
            <Text variant="bodySm" tone="muted" className="mt-1">
              {BRAND.appName} has not uploaded the photo, but its temporary local copy could not be
              removed yet. Try the action again to finish cleanup.
            </Text>
          </View>
        ) : null}

        {photoScavengeFailed ? (
          <View
            accessibilityRole="alert"
            className="mt-4 rounded-[14px] border border-clay/30 bg-clay-tint p-3.5"
          >
            <Text variant="bodySm" className="font-sans-semibold">
              Previous label-photo cleanup needs another try
            </Text>
            <Text variant="bodySm" tone="muted" className="mt-1">
              Photo capture is paused until {BRAND.appName} can verify its temporary cache cleanup.
              You can still continue with manual text.
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={photoCleanupBusy}
              className="mt-3 min-h-[48px] items-center justify-center rounded-pill bg-paper-raised px-4 py-2"
              onPress={() => void retryPhotoScavenging()}
            >
              <Text className="font-sans-semibold text-ink">Retry photo cleanup</Text>
            </Pressable>
          </View>
        ) : null}

        {!splitShortPhone || recognitionState !== 'disabled' ? (
          <View
            className={cn(
              ultraShortPhone
                ? 'mt-2 rounded-[14px] bg-greige-chip p-3'
                : 'mt-3 rounded-[14px] bg-greige-chip p-3.5',
            )}
          >
            <Text variant="bodySm" tone="muted" style={{ lineHeight: ultraShortPhone ? 18 : 19 }}>
              {recognitionDisclosure}
            </Text>
          </View>
        ) : null}

        {state !== 'review' ? (
          <Button
            label={
              state === 'capturing'
                ? 'Capturing...'
                : canAttemptCapture
                  ? 'Capture label'
                  : 'Continue with manual text'
            }
            className={ultraShortPhone ? 'min-h-[52px] py-3' : undefined}
            onPress={canAttemptCapture ? startCapture : () => setState('review')}
            disabled={state === 'capturing' || photoCleanupBusy}
          />
        ) : null}

        {state === 'review' ? (
          <>
            {recognitionState === 'running' ? (
              <View
                accessibilityLiveRegion="polite"
                className="mt-4 flex-row items-center gap-3 rounded-[14px] border border-hairline bg-paper-raised p-3.5"
              >
                <ActivityIndicator accessibilityLabel="Reading ingredient label" />
                <View className="flex-1">
                  <Text variant="bodySm" className="font-sans-semibold">
                    Reading the ingredient label…
                  </Text>
                  <Text variant="bodySm" tone="muted" className="mt-1">
                    You can type while this finishes. Your edits will not be replaced.
                  </Text>
                </View>
              </View>
            ) : null}

            {recognitionState === 'ready' && latestTranscript ? (
              <View
                accessibilityLiveRegion="polite"
                className="mt-4 rounded-[14px] border border-clay/30 bg-clay-tint p-3.5"
              >
                <Text variant="bodySm" className="font-sans-semibold">
                  {reviewState.suggestion
                    ? 'Recognized text is ready. Your edits were kept.'
                    : 'Text is ready to check.'}
                </Text>
                <Text variant="bodySm" tone="muted" className="mt-1">
                  Compare it with the package before continuing.
                </Text>
                {reviewState.suggestion ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: photoCleanupBusy }}
                    disabled={photoCleanupBusy}
                    className="mt-3 min-h-[48px] items-center justify-center rounded-pill bg-paper-raised px-4 py-2"
                    onPress={useRecognizedSuggestion}
                  >
                    <Text className="font-sans-semibold text-ink">Use recognized text</Text>
                  </Pressable>
                ) : null}
                {displayedUnclearLines.length > 0 ? (
                  <View className="mt-3 gap-2">
                    <Text variant="bodySm" className="font-sans-semibold">
                      Check {unclearLines.length} unclear{' '}
                      {unclearLines.length === 1 ? 'line' : 'lines'}
                    </Text>
                    {displayedUnclearLines.map((line) => (
                      <Text
                        key={`${line.sourceObservationIndex}-${line.text}`}
                        variant="bodySm"
                        tone="muted"
                      >
                        {line.alternativeText
                          ? `“${line.text}” or “${line.alternativeText}”`
                          : `“${line.text}”`}
                      </Text>
                    ))}
                    {unclearLines.length > displayedUnclearLines.length ? (
                      <Text variant="bodySm" tone="muted">
                        And {unclearLines.length - displayedUnclearLines.length} more.
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                {latestTranscript.truncated ? (
                  <Text variant="bodySm" tone="muted" className="mt-3 font-sans-semibold">
                    The scan may be incomplete. Add any missing ingredients before continuing.
                  </Text>
                ) : null}
              </View>
            ) : null}

            {recognitionState === 'no_text' ? (
              <View
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
                className="mt-4 rounded-[14px] border border-clay/30 bg-clay-tint p-3.5"
              >
                <Text variant="bodySm" className="font-sans-semibold">
                  No readable text found
                </Text>
                <Text variant="bodySm" tone="muted" className="mt-1">
                  Retake in even light, or type or paste the list below.
                </Text>
              </View>
            ) : null}

            {recognitionState === 'timed_out' ? (
              <View
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
                className="mt-4 rounded-[14px] border border-clay/30 bg-clay-tint p-3.5"
              >
                <Text variant="bodySm" className="font-sans-semibold">
                  Label reading took too long
                </Text>
                <Text variant="bodySm" tone="muted" className="mt-1">
                  Retake the photo or keep using manual text.
                </Text>
              </View>
            ) : null}

            {recognitionState === 'failed' ? (
              <View
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
                className="mt-4 rounded-[14px] border border-clay/30 bg-clay-tint p-3.5"
              >
                <Text variant="bodySm" className="font-sans-semibold">
                  The label wasn’t read
                </Text>
                <Text variant="bodySm" tone="muted" className="mt-1">
                  Your photo and typed text are still here. Retake or continue manually.
                </Text>
              </View>
            ) : null}

            {capturedUri || devOcrResult !== null ? (
              <Pressable
                accessibilityRole="button"
                disabled={photoCleanupBusy}
                className="mt-4 min-h-[48px] items-center justify-center rounded-pill border border-hairline bg-paper-raised px-4 py-2"
                onPress={() => void retryLabelCapture()}
              >
                <Text className="font-sans-semibold text-ink">Retake label photo</Text>
              </Pressable>
            ) : null}

            <Text variant="eyebrow" tone="clay" className="mt-5">
              Editable label text
            </Text>
            <TextInput
              accessibilityLabel="Ingredient label text"
              accessibilityHint="Check recognized text against the package, then correct or add anything missing"
              value={rawText}
              editable={!photoCleanupBusy}
              onChangeText={(text) => {
                if (navigationInFlightRef.current) return;
                commitReviewState((current) => editLabelOcrReviewText(current, text));
              }}
              maxLength={32_768}
              multiline
              placeholder="Type or paste the INCI list from the label"
              placeholderTextColor={colors.mutedLight}
              className="mt-2 min-h-[132px] rounded-[16px] border border-hairline bg-paper-raised p-4 font-sans text-[14px] leading-5 text-ink"
              textAlignVertical="top"
            />

            {rawText.trim().length > 0 ? (
              <>
                <Text variant="bodySm" tone="muted" className="mt-3">
                  Ingredient parsing:{' '}
                  {parsed.status === 'parsed' ? 'ready to review' : 'check the highlighted text'}.
                  Unknown tokens stay visible for correction.
                </Text>
                <Text variant="eyebrow" tone="clay" className="mt-4">
                  Parsed actives
                </Text>
                <View className="mt-2.5 gap-2">
                  {activeTokens.map((token) => (
                    <View
                      key={`${token.position}-${token.rawToken}`}
                      className="flex-row items-center gap-3 rounded-[14px] border border-hairline bg-paper-raised p-3.5"
                    >
                      <View className="h-[18px] w-[18px] items-center justify-center rounded-full bg-clay">
                        <Text className="text-[10px] text-paper">{'\u2713'}</Text>
                      </View>
                      <Text variant="bodySm" className="flex-1 font-sans-semibold">
                        {token.displayName}
                      </Text>
                      <Text variant="label" tone="muted">
                        {primaryTag(token)}
                      </Text>
                    </View>
                  ))}
                  {lowConfidence ? (
                    <View
                      className="flex-row items-center gap-3 rounded-[14px] border border-dashed bg-greige-chip p-3.5"
                      style={{ borderColor: 'rgba(32,27,21,0.18)' }}
                    >
                      <View className="h-[18px] w-[18px] rounded-full border-[1.5px] border-muted-light" />
                      <Text variant="bodySm" tone="muted" className="flex-1 font-sans-semibold">
                        &quot;{lowConfidence.rawToken}&quot;. Not sure
                      </Text>
                      <Text variant="bodySm" tone="clay" className="font-sans-semibold">
                        Edit text
                      </Text>
                    </View>
                  ) : null}
                </View>
              </>
            ) : null}
          </>
        ) : state === 'capturing' ? (
          <View className="mt-4 flex-row items-center gap-2">
            <ActivityIndicator />
            <Text variant="bodySm" tone="muted">
              Capturing label
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {state === 'review' ? (
        <Button
          label={photoCleanupBusy ? 'Removing temporary photo...' : 'Looks right. Continue'}
          onPress={() => void onContinue()}
          disabled={!canContinue || photoCleanupBusy}
        />
      ) : null}
    </Screen>
  );
}
