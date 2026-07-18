import { CameraView, useCameraPermissions } from 'expo-camera';
import { randomUUID } from 'expo-crypto';
import { Image } from 'expo-image';
import { router, useIsFocused } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  type ParsedIngredientToken,
} from '@/features/catalog/ingredientParser';
import { tagLabel } from '@/features/intelligence/presentation';
import { CAMERA_FAILURE_COPY } from '@/features/native/camera/failureCopy';
import {
  createLabelPhotoLifecycle,
  scavengeStaleLabelPhotos,
  type LabelPhotoCleanupReason,
  type LabelPhotoFileSystem,
} from '@/features/native/camera/labelPhotoLifecycle';
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
type LabelPhotoLifecycle = ReturnType<typeof createLabelPhotoLifecycle>;

// The legacy flag is retained for release configuration compatibility, but no
// native image-to-text adapter is wired yet. Keep UI and telemetry truthful
// until an implementation and physical-device privacy/accuracy gate exist.
const NATIVE_OCR_ADAPTER_AVAILABLE = false;

const labelPhotoFileSystem: LabelPhotoFileSystem = {
  cacheDirectory: FileSystem.cacheDirectory,
  deleteAsync: FileSystem.deleteAsync,
  moveAsync: FileSystem.moveAsync,
  readDirectoryAsync: FileSystem.readDirectoryAsync,
};

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

export default function OcrScreen() {
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const labelPhotoLifecycleRef = useRef<LabelPhotoLifecycle | null>(null);
  const labelPhotoStartupRef = useRef<Promise<void>>(Promise.resolve());
  const mountedRef = useRef(false);
  const captureInFlightRef = useRef(false);
  const navigationInFlightRef = useRef(false);
  const [state, setState] = useState<CaptureState>('camera');
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [labelCaptureFailed, setLabelCaptureFailed] = useState(false);
  const [photoCleanupBusy, setPhotoCleanupBusy] = useState(false);
  const [photoCleanupFailed, setPhotoCleanupFailed] = useState(false);
  const [photoScavengeFailed, setPhotoScavengeFailed] = useState(false);
  const [settingsOpenFailed, setSettingsOpenFailed] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [rawText, setRawText] = useState('');
  const [simulateCaptureFailureOnce, setSimulateCaptureFailureOnce] = useState(
    () => devShelfOcrCaptureFailureMode() === 'once',
  );
  const { update } = useIntake();

  useEffect(() => {
    const lifecycle = createLabelPhotoLifecycle(labelPhotoFileSystem, randomUUID);
    labelPhotoLifecycleRef.current = lifecycle;
    mountedRef.current = true;
    const startup = scavengeStaleLabelPhotos(labelPhotoFileSystem).then(() => undefined);
    labelPhotoStartupRef.current = startup;
    void startup.catch(() => {
      if (mountedRef.current && labelPhotoLifecycleRef.current === lifecycle) {
        setPhotoScavengeFailed(true);
      }
    });

    return () => {
      mountedRef.current = false;
      if (labelPhotoLifecycleRef.current === lifecycle) {
        labelPhotoLifecycleRef.current = null;
      }
      void lifecycle.dispose().catch(() => undefined);
    };
  }, []);

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
  const canAttemptCapture = !photoScavengeFailed && (canShowCamera || simulateCaptureFailureOnce);
  const parsed = useMemo(() => parseIngredientText(rawText), [rawText]);
  const activeTokens = parsed.tokens.filter((token) => token.tags.length > 0);
  const lowConfidence = parsed.tokens.find((token) => token.isUnmatched);
  const canContinue = rawText.trim().length > 0;
  const { height: viewportHeight } = useWindowDimensions();
  const ultraShortPhone = viewportHeight < 460;
  const splitShortPhone = viewportHeight < 410;

  const cleanupLabelPhoto = async (reason: LabelPhotoCleanupReason): Promise<boolean> => {
    const lifecycle = labelPhotoLifecycleRef.current;
    if (!lifecycle) return true;
    try {
      await lifecycle.cleanup(reason);
      if (mountedRef.current) {
        setCapturedUri(null);
        setPhotoCleanupFailed(false);
      }
      return true;
    } catch {
      if (mountedRef.current) setPhotoCleanupFailed(true);
      return false;
    }
  };

  const capture = async () => {
    const lifecycle = labelPhotoLifecycleRef.current;
    if (
      !lifecycle ||
      (!cameraRef.current && !simulateCaptureFailureOnce) ||
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
      const managedUri = await lifecycle.adoptCapturedPhoto(photo.uri);
      if (!mountedRef.current || labelPhotoLifecycleRef.current !== lifecycle) {
        await lifecycle.cleanup('cancel');
        return;
      }
      setCapturedUri(managedUri);
      setState('review');
      track('label_capture_photo_taken', {
        native_ocr_enabled: NATIVE_OCR_ADAPTER_AVAILABLE,
      });
    } catch {
      await lifecycle?.cleanup('capture_failure').catch(() => undefined);
      if (mountedRef.current) {
        setCapturedUri(lifecycle?.current() ?? null);
        setPhotoCleanupFailed(Boolean(lifecycle?.hasPendingCleanup()));
        setLabelCaptureFailed(true);
        setState('review');
      }
    } finally {
      captureInFlightRef.current = false;
    }
  };

  const onContinue = async () => {
    if (!canContinue || navigationInFlightRef.current || photoCleanupBusy) return;
    navigationInFlightRef.current = true;
    setPhotoCleanupBusy(true);
    haptics.select();
    const cleaned = await cleanupLabelPhoto('continue');
    if (!cleaned) {
      navigationInFlightRef.current = false;
      if (mountedRef.current) setPhotoCleanupBusy(false);
      return;
    }
    track('ingredient_parse_completed', {
      source: 'ocr_label_capture',
      native_ocr_enabled: NATIVE_OCR_ADAPTER_AVAILABLE,
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
  };

  const cancelAndGoBack = async () => {
    if (navigationInFlightRef.current || photoCleanupBusy) return;
    navigationInFlightRef.current = true;
    setPhotoCleanupBusy(true);
    haptics.select();
    const cleaned = await cleanupLabelPhoto('cancel');
    if (!cleaned) {
      navigationInFlightRef.current = false;
      if (mountedRef.current) setPhotoCleanupBusy(false);
      return;
    }
    backOrReplace(router, APP_SHELF_ROUTE);
  };

  const retryLabelCapture = async () => {
    if (photoCleanupBusy) return;
    setPhotoCleanupBusy(true);
    haptics.select();
    const cleaned = await cleanupLabelPhoto('retake');
    if (mountedRef.current) setPhotoCleanupBusy(false);
    if (!cleaned || !mountedRef.current) return;
    setState('camera');
    setLabelCaptureFailed(false);
  };

  const retryPhotoScavenging = async () => {
    if (photoCleanupBusy || labelPhotoLifecycleRef.current?.hasPendingCleanup()) return;
    setPhotoCleanupBusy(true);
    haptics.select();
    const startup = scavengeStaleLabelPhotos(labelPhotoFileSystem).then(() => undefined);
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
    await cleanupLabelPhoto('capture_failure');
    if (!mountedRef.current) return;
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
            capturedUri ? (
              <Image source={{ uri: capturedUri }} style={{ flex: 1 }} contentFit="cover" />
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

        {!splitShortPhone ? (
          <View
            className={cn(
              ultraShortPhone
                ? 'mt-2 rounded-[14px] bg-greige-chip p-3'
                : 'mt-3 rounded-[14px] bg-greige-chip p-3.5',
            )}
          >
            <Text variant="bodySm" tone="muted" style={{ lineHeight: ultraShortPhone ? 18 : 19 }}>
              On-device OCR is not enabled in this build yet. Use the captured label as a reference,
              then type or paste the ingredients below.
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
          <>
            <Text variant="eyebrow" tone="clay" className="mt-5">
              Editable label text
            </Text>
            <TextInput
              accessibilityLabel="Ingredient label text"
              value={rawText}
              onChangeText={setRawText}
              multiline
              placeholder="Type or paste the INCI list from the label"
              placeholderTextColor={colors.mutedLight}
              className="mt-2 min-h-[132px] rounded-[16px] border border-hairline bg-paper-raised p-4 font-sans text-[14px] leading-5 text-ink"
              textAlignVertical="top"
            />

            {rawText.trim().length > 0 ? (
              <>
                <Text variant="bodySm" tone="muted" className="mt-3">
                  Parser confidence: {Math.round(parsed.confidence * 100)}%. Low-confidence tokens
                  stay visible for review.
                </Text>
                <Text variant="eyebrow" tone="clay" className="mt-4">
                  Parsed actives
                </Text>
                <View className="mt-2.5 gap-2">
                  {activeTokens.map((token) => (
                    <View
                      key={token.rawToken}
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
