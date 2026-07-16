import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { router, useIsFocused } from 'expo-router';
import {
  memo,
  Profiler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import {
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
  type IngredientParseResult,
  type ParsedIngredientToken,
} from '@/features/catalog/ingredientParser';
import {
  OCR_INGREDIENT_TEXT_MAX_LENGTH,
  OCR_PREVIEW_ACTIVE_TOKEN_LIMIT,
  OCR_PREVIEW_DEBOUNCE_MS,
  boundOcrIngredientText,
  hasOcrIngredientText,
} from '@/features/catalog/ocrReview';
import {
  readOcrReviewRenderDiagnostics,
  recordOcrCapturePanelRender,
  recordOcrDraftChange,
  recordOcrEditorCommit,
  recordOcrExactSubmission,
  recordOcrPreviewParse,
  recordOcrPreviewRender,
  recordOcrReviewScreenRender,
} from '@/features/catalog/ocrRenderDiagnostics';
import { tagLabel } from '@/features/intelligence/presentation';
import { CAMERA_FAILURE_COPY } from '@/features/native/camera/failureCopy';
import {
  captureLabelForReview,
  CaptureStagingCleanupError,
  cleanupStagedCapture,
} from '@/features/photos/captureStaging';
import { useIntake } from '@/features/shelf/IntakeContext';
import { cn } from '@/lib/cn';
import { track } from '@/lib/analytics/track';
import { env } from '@/lib/env';
import { openAppSettings } from '@/lib/navigation/appSettings';
import { APP_SHELF_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { isOwnerQueryScopeCurrent, runOwnerQueryOperation } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';
import type { PlaintextStagingHandle } from '@/lib/storage/plaintextStaging';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

type CaptureState = 'camera' | 'capturing' | 'review';

function devShelfOcrCaptureFailureMode(): 'once' | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  return process.env.EXPO_PUBLIC_E2E_SHELF_OCR_CAPTURE_FAILURE === 'once' ? 'once' : null;
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

function publishOcrReviewRenderDiagnostics(): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__ || typeof document === 'undefined') return;

  const editor = document.getElementById('ocr-review-editor');
  if (!editor) return;
  const diagnostics = readOcrReviewRenderDiagnostics();
  editor.setAttribute('data-ocr-screen-renders', String(diagnostics.screenRenders));
  editor.setAttribute('data-ocr-capture-panel-renders', String(diagnostics.capturePanelRenders));
  editor.setAttribute('data-ocr-editor-commits', String(diagnostics.editorCommits));
  editor.setAttribute(
    'data-ocr-editor-duration-total-ms',
    String(diagnostics.editorDurationTotalMs),
  );
  editor.setAttribute('data-ocr-editor-duration-max-ms', String(diagnostics.editorDurationMaxMs));
  editor.setAttribute('data-ocr-draft-changes', String(diagnostics.draftChanges));
  editor.setAttribute('data-ocr-preview-parses', String(diagnostics.previewParses));
  editor.setAttribute('data-ocr-preview-renders', String(diagnostics.previewRenders));
  editor.setAttribute('data-ocr-exact-submissions', String(diagnostics.exactSubmissions));
}

function recordOcrEditorProfilerCommit(
  _id: string,
  _phase: 'mount' | 'update' | 'nested-update',
  actualDuration: number,
): void {
  recordOcrEditorCommit(actualDuration);
  publishOcrReviewRenderDiagnostics();
}

type OcrCapturePanelProps = Readonly<{
  state: CaptureState;
  capturedUri: string | null;
  labelCaptureFailed: boolean;
  cameraUnavailable: boolean;
  canShowCamera: boolean;
  canShowPermissionRecovery: boolean;
  canAskCameraPermission: boolean;
  settingsOpenFailed: boolean;
  isFocused: boolean;
  ultraShortPhone: boolean;
  splitShortPhone: boolean;
  cameraRef: RefObject<CameraView | null>;
  onCameraMountError: () => void;
  onRequestCameraAccess: () => void;
  onOpenCameraSettings: () => void;
}>;

const OcrCapturePanel = memo(function OcrCapturePanel({
  state,
  capturedUri,
  labelCaptureFailed,
  cameraUnavailable,
  canShowCamera,
  canShowPermissionRecovery,
  canAskCameraPermission,
  settingsOpenFailed,
  isFocused,
  ultraShortPhone,
  splitShortPhone,
  cameraRef,
  onCameraMountError,
  onRequestCameraAccess,
  onOpenCameraSettings,
}: OcrCapturePanelProps) {
  recordOcrCapturePanelRender();

  return (
    <View
      className={cn(
        splitShortPhone ? 'mt-2 h-[140px]' : ultraShortPhone ? 'mt-3 h-[176px]' : 'mt-4 h-[230px]',
        'overflow-hidden rounded-[18px] bg-night-elevated',
      )}
    >
      {state === 'review' ? (
        capturedUri ? (
          <Image
            source={{ uri: capturedUri }}
            style={{ flex: 1 }}
            contentFit="cover"
            cachePolicy="none"
            transition={0}
          />
        ) : (
          <View className="flex-1 items-center justify-center px-6">
            <Text variant="body" tone="inverse" className="text-center font-sans-semibold">
              {labelCaptureFailed
                ? CAMERA_FAILURE_COPY.labelCaptureTitle
                : cameraUnavailable
                  ? CAMERA_FAILURE_COPY.labelUnavailableTitle
                  : 'Capture the ingredient panel'}
            </Text>
            <Text variant="bodySm" tone="inverseMuted" className="mt-2 text-center">
              {labelCaptureFailed
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
          onMountError={onCameraMountError}
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
              onPress={canAskCameraPermission ? onRequestCameraAccess : onOpenCameraSettings}
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
  );
});

type OcrParsedPreviewProps = Readonly<{
  previewText: string;
}>;

const OcrParsedPreview = memo(function OcrParsedPreview({ previewText }: OcrParsedPreviewProps) {
  recordOcrPreviewRender();
  const parsed: IngredientParseResult = useMemo(() => {
    recordOcrPreviewParse();
    return parseIngredientText(previewText);
  }, [previewText]);
  const allActiveTokens = parsed.tokens.filter((token) => token.tags.length > 0);
  const activeTokens = allActiveTokens.slice(0, OCR_PREVIEW_ACTIVE_TOKEN_LIMIT);
  const hiddenActiveTokenCount = allActiveTokens.length - activeTokens.length;
  const lowConfidence = parsed.tokens.find((token) => token.isUnmatched);
  const lowConfidenceCount = parsed.unknownTokens.length;

  return (
    <>
      <Text variant="bodySm" tone="muted" className="mt-3">
        Parser confidence: {Math.round(parsed.confidence * 100)}%.{' '}
        {lowConfidenceCount === 0
          ? 'No low-confidence tokens detected.'
          : `${lowConfidenceCount} low-confidence ${lowConfidenceCount === 1 ? 'token remains' : 'tokens remain'} in the editable text. The first is shown below.`}
      </Text>
      <Text variant="eyebrow" tone="clay" className="mt-4">
        Parsed actives
      </Text>
      <View className="mt-2.5 gap-2">
        {activeTokens.map((token) => (
          <View
            key={token.position}
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
        {hiddenActiveTokenCount > 0 ? (
          <Text variant="bodySm" tone="muted">
            Showing the first {OCR_PREVIEW_ACTIVE_TOKEN_LIMIT} detected actives. Continue to keep
            all {allActiveTokens.length} parsed actives.
          </Text>
        ) : null}
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
  );
});

type OcrReviewEditorProps = Readonly<{
  initialText: string;
  onDraftChange: (draft: string) => void;
  onEligibilityChange: (eligible: boolean) => void;
}>;

const OcrReviewEditor = memo(function OcrReviewEditor({
  initialText,
  onDraftChange,
  onEligibilityChange,
}: OcrReviewEditorProps) {
  const boundedInitialText = boundOcrIngredientText(initialText);
  const [rawText, setRawText] = useState(boundedInitialText);
  const [previewText, setPreviewText] = useState(boundedInitialText);
  const rawTextRef = useRef(boundedInitialText);
  const eligibilityRef = useRef(hasOcrIngredientText(boundedInitialText));

  useEffect(() => {
    if (rawText === previewText) return;
    const timeout = setTimeout(() => setPreviewText(rawText), OCR_PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [previewText, rawText]);

  const previewPending = rawText !== previewText;
  const hasText = hasOcrIngredientText(rawText);
  const previewHasText = hasOcrIngredientText(previewText);

  const updateRawText = useCallback(
    (next: string) => {
      const bounded = boundOcrIngredientText(next);
      if (bounded === rawTextRef.current) return;
      rawTextRef.current = bounded;
      recordOcrDraftChange();
      setRawText(bounded);
      onDraftChange(bounded);

      const eligible = hasOcrIngredientText(bounded);
      if (eligible !== eligibilityRef.current) {
        eligibilityRef.current = eligible;
        onEligibilityChange(eligible);
      }
    },
    [onDraftChange, onEligibilityChange],
  );

  return (
    <Profiler id="ocr-review-editor" onRender={recordOcrEditorProfilerCommit}>
      <View nativeID="ocr-review-editor">
        <Text variant="eyebrow" tone="clay" className="mt-5">
          Editable label text
        </Text>
        <TextInput
          accessibilityLabel="Ingredient label text"
          value={rawText}
          maxLength={OCR_INGREDIENT_TEXT_MAX_LENGTH}
          onChangeText={updateRawText}
          multiline
          placeholder="Type or paste the INCI list from the label"
          placeholderTextColor={colors.mutedLight}
          className="mt-2 min-h-[132px] rounded-[16px] border border-hairline bg-paper-raised p-4 font-sans text-[14px] leading-5 text-ink"
          textAlignVertical="top"
        />
        <Text variant="label" tone="muted" className="mt-2 text-right">
          {rawText.length} / {OCR_INGREDIENT_TEXT_MAX_LENGTH} characters
        </Text>

        {hasText ? (
          <>
            <Text accessibilityLiveRegion="polite" variant="bodySm" tone="muted" className="mt-3">
              {previewPending
                ? 'Updating ingredient preview. Existing results may be out of date.'
                : 'Ingredient preview updated.'}
            </Text>
            {previewHasText ? <OcrParsedPreview previewText={previewText} /> : null}
          </>
        ) : null}
      </View>
    </Profiler>
  );
});

export default function OcrScreen() {
  const ownerScope = useOwnerQueryScope();
  const mountedRef = useRef(true);
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [state, setState] = useState<CaptureState>('camera');
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [labelCaptureFailed, setLabelCaptureFailed] = useState(false);
  const [captureCleanupFailed, setCaptureCleanupFailed] = useState(false);
  const [settingsOpenFailed, setSettingsOpenFailed] = useState(false);
  const [capturedHandle, setCapturedHandle] = useState<PlaintextStagingHandle | null>(null);
  const cleanupInFlightRef = useRef(false);
  const captureCleanupRetryRef = useRef<(() => Promise<void>) | null>(null);
  const rawTextRef = useRef('');
  const [reviewInitialText, setReviewInitialText] = useState('');
  const [canContinue, setCanContinue] = useState(false);
  const [simulateCaptureFailureOnce, setSimulateCaptureFailureOnce] = useState(
    () => devShelfOcrCaptureFailureMode() === 'once',
  );
  const { update } = useIntake();

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
  const canAttemptCapture = canShowCamera || simulateCaptureFailureOnce;
  const capturedUri = capturedHandle?.uri ?? null;
  const { height: viewportHeight } = useWindowDimensions();
  const ultraShortPhone = viewportHeight < 460;
  const splitShortPhone = viewportHeight < 410;
  const canPublish = () => mountedRef.current && isOwnerQueryScopeCurrent(ownerScope);

  recordOcrReviewScreenRender();

  useEffect(() => {
    publishOcrReviewRenderDiagnostics();
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(
    () => () => {
      const retryCleanup = captureCleanupRetryRef.current;
      if (retryCleanup || capturedHandle) {
        void runOwnerQueryOperation(ownerScope, async () => {
          if (retryCleanup) {
            await retryCleanup();
            captureCleanupRetryRef.current = null;
          }
          if (capturedHandle) await cleanupStagedCapture(capturedHandle);
        }).catch(() => undefined);
      }
    },
    [capturedHandle, ownerScope],
  );

  const capture = async () => {
    if ((!cameraRef.current && !simulateCaptureFailureOnce) || state === 'capturing') return;
    haptics.select();
    setState('capturing');
    setLabelCaptureFailed(false);
    setCaptureCleanupFailed(false);
    let stagedHandle: PlaintextStagingHandle | null = null;
    try {
      const staged = await runOwnerQueryOperation(ownerScope, (lease) =>
        captureLabelForReview(lease, async () => {
          if (simulateCaptureFailureOnce) {
            setSimulateCaptureFailureOnce(false);
            throw new Error('E2E_SHELF_OCR_CAPTURE_FAILURE');
          }
          return cameraRef.current!.takePictureAsync({
            quality: 0.72,
            base64: false,
            exif: false,
            shutterSound: false,
          });
        }),
      );
      stagedHandle = staged.handle;
      if (!canPublish()) {
        await cleanupStagedCapture(staged.handle);
        stagedHandle = null;
        return;
      }
      setCapturedHandle(staged.handle);
      setState('review');
      track('label_capture_photo_taken', { native_ocr_enabled: env.nativeOcrEnabled });
    } catch (error) {
      if (stagedHandle) await cleanupStagedCapture(stagedHandle).catch(() => undefined);
      if (canPublish()) {
        if (error instanceof CaptureStagingCleanupError) {
          captureCleanupRetryRef.current = error.retryCleanup;
          setCaptureCleanupFailed(true);
        }
        setCapturedHandle(null);
        setLabelCaptureFailed(true);
        setState('review');
      }
    }
  };

  const cleanupAndNavigate = (publish: () => void) => {
    if (cleanupInFlightRef.current) return;
    cleanupInFlightRef.current = true;
    setCaptureCleanupFailed(false);
    void runOwnerQueryOperation(ownerScope, async (lease) => {
      const retryCleanup = captureCleanupRetryRef.current;
      if (retryCleanup) {
        await retryCleanup();
        captureCleanupRetryRef.current = null;
      }
      if (capturedHandle) await cleanupStagedCapture(capturedHandle);
      lease.assertCurrent();
    })
      .then(() => {
        if (!canPublish()) return;
        setCapturedHandle(null);
        publish();
      })
      .catch((error: unknown) => {
        if (canPublish()) {
          if (error instanceof CaptureStagingCleanupError) {
            captureCleanupRetryRef.current = error.retryCleanup;
          }
          setCaptureCleanupFailed(true);
        }
      })
      .finally(() => {
        if (canPublish()) cleanupInFlightRef.current = false;
      });
  };

  const handleReviewDraftChange = useCallback((draft: string) => {
    rawTextRef.current = draft;
  }, []);

  const onContinue = () => {
    if (cleanupInFlightRef.current) return;
    const rawText = rawTextRef.current;
    if (!hasOcrIngredientText(rawText)) return;
    const parsed = parseIngredientText(rawText);
    haptics.select();
    cleanupAndNavigate(() => {
      recordOcrExactSubmission();
      publishOcrReviewRenderDiagnostics();
      track('ingredient_parse_completed', {
        source: 'ocr_label_capture',
        native_ocr_enabled: env.nativeOcrEnabled,
        result: parsed.status,
        count: parsed.tokens.length,
      });
      update({
        ingredients: parsed.tokens.map((token) => token.displayName),
        addedVia: 'ocr',
        ingredientParseStatus: parsed.status,
        ingredientParseConfidence: parsed.confidence,
        parserVersion: parsed.parserVersion,
      });
      router.replace('/shelf/manual');
    });
  };

  const requestCameraAccess = useCallback(() => {
    haptics.select();
    setSettingsOpenFailed(false);
    void requestPermission();
  }, [requestPermission]);

  const openShelfCameraSettings = useCallback(() => {
    haptics.select();
    setSettingsOpenFailed(false);
    void openAppSettings({
      failureTitle: CAMERA_FAILURE_COPY.shelfSettingsTitle,
      failureMessage: CAMERA_FAILURE_COPY.shelfSettingsBody,
      alertOnFailure: false,
    }).then((opened) => {
      if (!opened && mountedRef.current) setSettingsOpenFailed(true);
    });
  }, []);

  const handleCameraMountError = useCallback(() => {
    setCameraUnavailable(true);
    setCapturedHandle(null);
    setLabelCaptureFailed(false);
    setState('review');
  }, []);

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="mt-2 flex-row items-center justify-between">
        <RouteIconButton
          accessibilityLabel="Back"
          disabled={state === 'capturing'}
          onPress={() => cleanupAndNavigate(() => backOrReplace(router, APP_SHELF_ROUTE))}
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
        <OcrCapturePanel
          state={state}
          capturedUri={capturedUri}
          labelCaptureFailed={labelCaptureFailed}
          cameraUnavailable={cameraUnavailable}
          canShowCamera={canShowCamera}
          canShowPermissionRecovery={canShowPermissionRecovery}
          canAskCameraPermission={canAskCameraPermission}
          settingsOpenFailed={settingsOpenFailed}
          isFocused={isFocused}
          ultraShortPhone={ultraShortPhone}
          splitShortPhone={splitShortPhone}
          cameraRef={cameraRef}
          onCameraMountError={handleCameraMountError}
          onRequestCameraAccess={requestCameraAccess}
          onOpenCameraSettings={openShelfCameraSettings}
        />

        {captureCleanupFailed ? (
          <View
            accessibilityRole="alert"
            className="mt-4 rounded-[14px] border border-clay/30 bg-clay-tint p-3.5"
          >
            <Text variant="bodySm" className="font-sans-semibold">
              Temporary photo cleanup needs another try
            </Text>
            <Text variant="bodySm" tone="muted" className="mt-1">
              OnSkin kept this screen open so the label photo is not left behind. Try your action
              again.
            </Text>
          </View>
        ) : null}

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
                className="mt-3 min-h-[48px] items-center justify-center rounded-pill bg-paper-raised px-4 py-2"
                onPress={() => {
                  haptics.select();
                  cleanupAndNavigate(() => {
                    setReviewInitialText(rawTextRef.current);
                    setState('camera');
                    setLabelCaptureFailed(false);
                  });
                }}
              >
                <Text className="font-sans-semibold text-ink">Try label photo again</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {!splitShortPhone ? (
          <View
            className={cn(
              ultraShortPhone
                ? 'mt-2 rounded-[14px] bg-greige-chip p-3'
                : 'mt-3 rounded-[14px] bg-greige-chip p-3.5',
            )}
          >
            <Text variant="bodySm" tone="muted" style={{ lineHeight: ultraShortPhone ? 18 : 19 }}>
              {env.nativeOcrEnabled
                ? 'On-device OCR is enabled for this build. Check the text before saving.'
                : 'On-device OCR is not enabled in this build yet. Use the captured label as a reference, then type or paste the ingredients below.'}
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
            onPress={canAttemptCapture ? () => void capture() : () => setState('review')}
          />
        ) : null}

        {state === 'review' ? (
          <OcrReviewEditor
            initialText={reviewInitialText}
            onDraftChange={handleReviewDraftChange}
            onEligibilityChange={setCanContinue}
          />
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
        <Button label="Looks right. Continue" onPress={onContinue} disabled={!canContinue} />
      ) : null}
    </Screen>
  );
}
