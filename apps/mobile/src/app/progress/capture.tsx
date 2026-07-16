import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useIsFocused } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RouteIconButton, Text } from '@/components/ui';
import { CAMERA_FAILURE_COPY } from '@/features/native/camera/failureCopy';
import { PHOTO_CAPTURE_CONSENT } from '@/features/onboarding/consentCopy';
import { applyPhotoCaptureConsent } from '@/features/photos/applyCaptureConsent';
import {
  capturePhotoForReview,
  CaptureStagingCleanupError,
  cleanupCapturedPhoto,
  type StagedPhotoCapture,
} from '@/features/photos/captureStaging';
import {
  grantPhotoCaptureConsent,
  isCurrentPhotoCaptureConsent,
  photoCaptureConsentNeedsChoice,
  type PhotoCaptureConsentCurrentResult,
  type PhotoCaptureConsentReadResult,
  PhotoCaptureConsentStateChangedError,
  PhotoCaptureConsentWriteUncertainError,
  readPhotoCaptureConsent,
} from '@/features/photos/consent';
import { PHOTO_COPY } from '@/features/photos/copy';
import { localDay, timeOfDayNow } from '@/features/photos/date';
import { PhotoImage } from '@/features/photos/PhotoImage';
import { PhotoTimelineLockGate } from '@/features/photos/PhotoTimelineLockGate';
import { ProgressPhotoRouteSource } from '@/features/photos/ProgressPhotoRouteSource';
import type { PhotosQueryData } from '@/features/photos/usePhotos';
import { ProGate } from '@/features/subscription/ProGate';
import { track } from '@/lib/analytics/track';
import { env } from '@/lib/env';
import { openAppSettings } from '@/lib/navigation/appSettings';
import { APP_PROGRESS_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { isOwnerQueryScopeCurrent, runOwnerQueryOperation } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';
import { haptics } from '@/theme/haptics';

const BG = '#16130F';
const GUIDE = '#9DB18A';
const READY = '#9DB18A';
const NIGHT_SECONDARY_ACTION_BG = 'rgba(244,239,231,0.08)';
const NIGHT_SECONDARY_ACTION_TEXT = 'rgba(244,239,231,0.84)';
const NIGHT_FOOTNOTE_TEXT = 'rgba(244,239,231,0.76)';
const NIGHT_CONSENT_OVERLAY_BG = '#100D0A';
const PHOTO_CONSENT_READ_TIMEOUT_MS = 10_000;

type ConsentSaveFailure = 'failed' | 'uncertain' | null;

type ConsentReadViewState = {
  ownerGeneration: number;
  result: PhotoCaptureConsentReadResult | null;
  retrying: boolean;
  retryFailed: boolean;
};

function devPhotoConsentFailureMode(): 'once' | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  const fixture = process.env.EXPO_PUBLIC_E2E_PHOTO_CONSENT_FAILURE?.trim().toLowerCase();
  return fixture === 'once' ? fixture : null;
}

function devProgressCaptureFailureMode(): 'once' | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  return process.env.EXPO_PUBLIC_E2E_PROGRESS_CAPTURE_FAILURE === 'once' ? 'once' : null;
}

function devProgressCameraPermissionMode(): 'denied_no_retry' | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  return process.env.EXPO_PUBLIC_E2E_PROGRESS_CAMERA_PERMISSION === 'denied_no_retry'
    ? 'denied_no_retry'
    : null;
}

function CaptureOverlay({
  backgroundColor = 'rgba(10,8,6,0.9)',
  compact = false,
  children,
}: {
  backgroundColor?: string;
  compact?: boolean;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: compact ? 'flex-start' : 'center',
        paddingHorizontal: 28,
        paddingTop: insets.top + (compact ? 16 : 28),
        paddingBottom: insets.bottom + (compact ? 20 : 28),
      }}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

function ConsentGate({
  granting,
  reconsentRequired,
  saveFailure,
  onGrant,
  onCancel,
}: {
  granting: boolean;
  reconsentRequired: boolean;
  saveFailure: ConsentSaveFailure;
  onGrant: () => void;
  onCancel: () => void;
}) {
  const height = useWindowDimensions().height;
  const compact = height < 640;
  const shortPhone = height < 520;
  const saveFailed = saveFailure !== null;
  const showPrepReminder = !(shortPhone || (compact && (saveFailed || reconsentRequired)));
  const saveFailureTitle =
    saveFailure === 'uncertain'
      ? PHOTO_COPY.capture.consentWriteUncertainTitle
      : PHOTO_COPY.capture.consentFailedTitle;
  const saveFailureBody =
    saveFailure === 'uncertain'
      ? PHOTO_COPY.capture.consentWriteUncertainBody
      : PHOTO_COPY.capture.consentFailedBody;

  return (
    <CaptureOverlay backgroundColor={NIGHT_CONSENT_OVERLAY_BG} compact={compact}>
      <Text
        style={{
          fontFamily: 'InstrumentSerif-Regular',
          fontSize: shortPhone ? 25 : compact ? 27 : 30,
          lineHeight: shortPhone ? 27 : compact ? 29 : undefined,
          color: '#F4EFE7',
          marginBottom: shortPhone ? 6 : compact ? 10 : 16,
        }}
      >
        {PHOTO_CAPTURE_CONSENT.title}
      </Text>
      {reconsentRequired ? (
        <Text
          accessibilityRole="alert"
          style={{
            fontFamily: 'HankenGrotesk-Medium',
            fontSize: shortPhone ? 12.5 : 13.5,
            color: '#D9A183',
            lineHeight: shortPhone ? 16 : 18,
            marginBottom: shortPhone ? 6 : compact ? 9 : 14,
          }}
        >
          {PHOTO_COPY.capture.reconsentNotice}
        </Text>
      ) : null}
      {(
        [
          ['What', PHOTO_CAPTURE_CONSENT.what],
          ['Why', PHOTO_CAPTURE_CONSENT.why],
          ['Never', PHOTO_CAPTURE_CONSENT.never],
        ] as const
      ).map(([k, v]) => (
        <View key={k} style={{ marginBottom: shortPhone ? 6 : compact ? 9 : 14 }}>
          <Text variant="label" style={{ color: '#D9A183', marginBottom: shortPhone ? 1 : 2 }}>
            {k.toUpperCase()}
          </Text>
          <Text
            style={{
              fontFamily: 'HankenGrotesk-Regular',
              fontSize: shortPhone ? 13 : compact ? 14 : 14.5,
              color: 'rgba(244,239,231,0.9)',
              lineHeight: shortPhone ? 17 : compact ? 19 : 21,
            }}
          >
            {v}
          </Text>
        </View>
      ))}
      <Text
        style={{
          fontFamily: 'IBMPlexMono-Regular',
          fontSize: shortPhone ? 10 : compact ? 10.5 : 11,
          color: NIGHT_FOOTNOTE_TEXT,
          lineHeight: shortPhone ? 13 : compact ? 15 : undefined,
          marginTop: shortPhone ? 0 : compact ? 2 : 6,
          marginBottom: shortPhone ? 6 : compact ? 8 : 14,
        }}
      >
        {PHOTO_CAPTURE_CONSENT.footnote}
      </Text>
      {showPrepReminder ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: compact ? 14 : 22,
          }}
        >
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#9DB18A' }} />
          <Text
            style={{
              fontFamily: 'HankenGrotesk-Medium',
              fontSize: compact ? 12 : 12.5,
              color: 'rgba(244,239,231,0.88)',
              flex: 1,
              lineHeight: compact ? 16 : 17,
            }}
          >
            {PHOTO_COPY.capture.skinPrep}
          </Text>
        </View>
      ) : null}
      {saveFailed ? (
        <View
          accessibilityRole="alert"
          style={{
            borderRadius: compact ? 12 : 14,
            backgroundColor: 'rgba(217,161,131,0.13)',
            borderWidth: 1,
            borderColor: 'rgba(217,161,131,0.36)',
            paddingHorizontal: compact ? 12 : 14,
            paddingVertical: compact ? 7 : 10,
            marginBottom: compact ? 7 : 12,
          }}
        >
          <Text
            style={{
              fontFamily: 'HankenGrotesk-SemiBold',
              fontSize: compact ? 12.5 : 13.5,
              color: '#F4EFE7',
              marginBottom: compact ? 0 : 2,
            }}
          >
            {compact ? `${saveFailureTitle}. ${saveFailureBody}` : saveFailureTitle}
          </Text>
          {compact ? null : (
            <Text
              style={{
                fontFamily: 'HankenGrotesk-Regular',
                fontSize: 13,
                color: 'rgba(244,239,231,0.86)',
                lineHeight: 18,
              }}
            >
              {saveFailureBody}
            </Text>
          )}
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: granting }}
        disabled={granting}
        onPress={onGrant}
        style={{
          height: compact ? 52 : 56,
          borderRadius: 999,
          backgroundColor: '#F4EFE7',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: granting ? 0.6 : 1,
        }}
      >
        <Text style={{ fontFamily: 'HankenGrotesk-SemiBold', fontSize: 16, color: BG }}>
          {granting ? 'Saving choice' : 'Take photos. On device only'}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: granting }}
        disabled={granting}
        onPress={onCancel}
        style={{
          height: 48,
          marginTop: compact ? 4 : 8,
          borderRadius: 999,
          backgroundColor: NIGHT_SECONDARY_ACTION_BG,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: granting ? 0.6 : 1,
        }}
      >
        <Text
          style={{
            fontFamily: 'HankenGrotesk-Medium',
            fontSize: 15,
            color: NIGHT_SECONDARY_ACTION_TEXT,
          }}
        >
          Not now
        </Text>
      </Pressable>
    </CaptureOverlay>
  );
}

function ConsentReadRecoveryGate({
  retrying,
  retryFailed,
  writeUncertain,
  onRetry,
  onCancel,
}: {
  retrying: boolean;
  retryFailed: boolean;
  writeUncertain: boolean;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const compact = useWindowDimensions().height < 640;
  const title = writeUncertain
    ? PHOTO_COPY.capture.consentWriteUncertainTitle
    : PHOTO_COPY.capture.consentReadTitle;
  const body = writeUncertain
    ? PHOTO_COPY.capture.consentWriteUncertainBody
    : PHOTO_COPY.capture.consentReadBody;

  return (
    <CaptureOverlay backgroundColor={NIGHT_CONSENT_OVERLAY_BG} compact={compact}>
      <View accessibilityRole="alert" accessibilityLiveRegion="polite">
        <Text
          style={{
            fontFamily: 'InstrumentSerif-Regular',
            fontSize: compact ? 28 : 30,
            lineHeight: compact ? 31 : 34,
            color: '#F4EFE7',
            marginBottom: compact ? 9 : 12,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: 'HankenGrotesk-Regular',
            fontSize: compact ? 14 : 14.5,
            color: 'rgba(244,239,231,0.78)',
            lineHeight: compact ? 19 : 21,
            marginBottom: retryFailed ? 12 : compact ? 18 : 22,
          }}
        >
          {body}
        </Text>
        {retryFailed ? (
          <Text
            style={{
              fontFamily: 'HankenGrotesk-Medium',
              fontSize: 13,
              color: '#D9A183',
              lineHeight: 18,
              marginBottom: compact ? 18 : 22,
            }}
          >
            {PHOTO_COPY.capture.consentReadRetryFailed}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          retrying ? PHOTO_COPY.capture.consentReadRetrying : 'Retry reading saved photo choice'
        }
        accessibilityState={{ busy: retrying, disabled: retrying }}
        disabled={retrying}
        onPress={onRetry}
        style={{
          height: 56,
          borderRadius: 999,
          backgroundColor: '#F4EFE7',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: retrying ? 0.6 : 1,
        }}
      >
        <Text style={{ fontFamily: 'HankenGrotesk-SemiBold', fontSize: 16, color: BG }}>
          {retrying ? PHOTO_COPY.capture.consentReadRetrying : PHOTO_COPY.capture.consentReadRetry}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onCancel}
        style={{
          height: 48,
          marginTop: 8,
          borderRadius: 999,
          backgroundColor: NIGHT_SECONDARY_ACTION_BG,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: 'HankenGrotesk-Medium',
            fontSize: 15,
            color: NIGHT_SECONDARY_ACTION_TEXT,
          }}
        >
          {PHOTO_COPY.capture.consentReadExit}
        </Text>
      </Pressable>
    </CaptureOverlay>
  );
}

function ConsentReadLoadingGate({ onCancel }: { onCancel: () => void }) {
  const compact = useWindowDimensions().height < 640;

  return (
    <CaptureOverlay backgroundColor={NIGHT_CONSENT_OVERLAY_BG} compact={compact}>
      <View
        accessibilityLabel={PHOTO_COPY.capture.consentReadLoadingTitle}
        accessibilityLiveRegion="polite"
        accessibilityRole="progressbar"
        accessibilityValue={{ text: PHOTO_COPY.capture.consentReadLoadingBody }}
      >
        <Text
          style={{
            fontFamily: 'InstrumentSerif-Regular',
            fontSize: compact ? 28 : 30,
            lineHeight: compact ? 31 : 34,
            color: '#F4EFE7',
            marginBottom: compact ? 9 : 12,
          }}
        >
          {PHOTO_COPY.capture.consentReadLoadingTitle}
        </Text>
        <Text
          style={{
            fontFamily: 'HankenGrotesk-Regular',
            fontSize: compact ? 14 : 14.5,
            color: 'rgba(244,239,231,0.78)',
            lineHeight: compact ? 19 : 21,
            marginBottom: compact ? 18 : 22,
          }}
        >
          {PHOTO_COPY.capture.consentReadLoadingBody}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onCancel}
        style={{
          height: 48,
          borderRadius: 999,
          backgroundColor: NIGHT_SECONDARY_ACTION_BG,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: 'HankenGrotesk-Medium',
            fontSize: 15,
            color: NIGHT_SECONDARY_ACTION_TEXT,
          }}
        >
          {PHOTO_COPY.capture.consentReadExit}
        </Text>
      </Pressable>
    </CaptureOverlay>
  );
}

function CameraUnavailableGate({
  onRetry,
  onCancel,
}: {
  onRetry: () => void;
  onCancel: () => void;
}) {
  return (
    <CaptureOverlay>
      <Text
        style={{
          fontFamily: 'InstrumentSerif-Regular',
          fontSize: 30,
          lineHeight: 34,
          color: '#F4EFE7',
          marginBottom: 12,
        }}
      >
        {CAMERA_FAILURE_COPY.progressUnavailableTitle}
      </Text>
      <Text
        style={{
          fontFamily: 'HankenGrotesk-Regular',
          fontSize: 14.5,
          color: 'rgba(244,239,231,0.78)',
          lineHeight: 21,
          marginBottom: 22,
        }}
      >
        {CAMERA_FAILURE_COPY.progressUnavailableBody}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={{
          height: 56,
          borderRadius: 999,
          backgroundColor: '#F4EFE7',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontFamily: 'HankenGrotesk-SemiBold', fontSize: 16, color: BG }}>
          Try camera again
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onCancel}
        style={{
          height: 48,
          marginTop: 8,
          borderRadius: 999,
          backgroundColor: NIGHT_SECONDARY_ACTION_BG,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: 'HankenGrotesk-Medium',
            fontSize: 15,
            color: NIGHT_SECONDARY_ACTION_TEXT,
          }}
        >
          Not now
        </Text>
      </Pressable>
    </CaptureOverlay>
  );
}

function PhotoCaptureFailureGate({
  onRetry,
  onCancel,
  cleanupFailed = false,
}: {
  onRetry: () => void;
  onCancel: () => void;
  cleanupFailed?: boolean;
}) {
  return (
    <CaptureOverlay>
      <View accessibilityRole="alert">
        <Text
          style={{
            fontFamily: 'InstrumentSerif-Regular',
            fontSize: 30,
            lineHeight: 34,
            color: '#F4EFE7',
            marginBottom: 12,
          }}
        >
          {cleanupFailed
            ? 'Photo cleanup needs another try'
            : CAMERA_FAILURE_COPY.progressCaptureTitle}
        </Text>
        <Text
          style={{
            fontFamily: 'HankenGrotesk-Regular',
            fontSize: 14.5,
            color: 'rgba(244,239,231,0.78)',
            lineHeight: 21,
            marginBottom: 22,
          }}
        >
          {cleanupFailed
            ? 'OnSkin kept this screen open so the temporary photo is not left behind.'
            : CAMERA_FAILURE_COPY.progressCaptureBody}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={{
          height: 56,
          borderRadius: 999,
          backgroundColor: '#F4EFE7',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontFamily: 'HankenGrotesk-SemiBold', fontSize: 16, color: BG }}>
          {cleanupFailed ? 'Try cleanup again' : 'Try photo again'}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onCancel}
        style={{
          height: 48,
          marginTop: 8,
          borderRadius: 999,
          backgroundColor: NIGHT_SECONDARY_ACTION_BG,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: 'HankenGrotesk-Medium',
            fontSize: 15,
            color: NIGHT_SECONDARY_ACTION_TEXT,
          }}
        >
          Not now
        </Text>
      </Pressable>
    </CaptureOverlay>
  );
}

function PermissionGate({
  canAskAgain,
  settingsOpenFailed,
  onAsk,
  onOpenSettings,
  onCancel,
}: {
  canAskAgain: boolean;
  settingsOpenFailed: boolean;
  onAsk: () => void;
  onOpenSettings: () => void;
  onCancel: () => void;
}) {
  return (
    <CaptureOverlay>
      <Text
        style={{
          fontFamily: 'InstrumentSerif-Regular',
          fontSize: 30,
          lineHeight: 34,
          color: '#F4EFE7',
          marginBottom: 12,
        }}
      >
        Camera access is needed for progress photos.
      </Text>
      <Text
        style={{
          fontFamily: 'HankenGrotesk-Regular',
          fontSize: 14.5,
          color: 'rgba(244,239,231,0.78)',
          lineHeight: 21,
          marginBottom: 22,
        }}
      >
        The photo is captured on this device and saved into encrypted app-private storage.
      </Text>
      {settingsOpenFailed ? (
        <View
          accessibilityRole="alert"
          style={{
            borderRadius: 14,
            backgroundColor: 'rgba(217,161,131,0.13)',
            borderWidth: 1,
            borderColor: 'rgba(217,161,131,0.36)',
            paddingHorizontal: 14,
            paddingVertical: 10,
            marginBottom: 14,
          }}
        >
          <Text
            style={{
              fontFamily: 'HankenGrotesk-SemiBold',
              fontSize: 13.5,
              color: '#F4EFE7',
              marginBottom: 2,
            }}
          >
            {CAMERA_FAILURE_COPY.progressSettingsTitle}
          </Text>
          <Text
            style={{
              fontFamily: 'HankenGrotesk-Regular',
              fontSize: 13,
              color: 'rgba(244,239,231,0.86)',
              lineHeight: 18,
            }}
          >
            {CAMERA_FAILURE_COPY.progressSettingsBody}
          </Text>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={canAskAgain ? onAsk : onOpenSettings}
        style={{
          height: 56,
          borderRadius: 999,
          backgroundColor: '#F4EFE7',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontFamily: 'HankenGrotesk-SemiBold', fontSize: 16, color: BG }}>
          {canAskAgain ? 'Allow camera' : 'Open settings'}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onCancel}
        style={{
          height: 48,
          marginTop: 8,
          borderRadius: 999,
          backgroundColor: NIGHT_SECONDARY_ACTION_BG,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: 'HankenGrotesk-Medium',
            fontSize: 15,
            color: NIGHT_SECONDARY_ACTION_TEXT,
          }}
        >
          Not now
        </Text>
      </Pressable>
    </CaptureOverlay>
  );
}

function CaptureScreenContent({ photos }: { photos: PhotosQueryData }) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const ownerScope = useOwnerQueryScope();
  const mountedRef = useRef(true);
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [consentReadState, setConsentReadState] = useState<ConsentReadViewState>(() => ({
    ownerGeneration: ownerScope.generation,
    result: null,
    retrying: false,
    retryFailed: false,
  }));
  const consentReadGenerationRef = useRef(0);
  const consentReadInFlightRef = useRef<number | null>(null);
  const consentGrantInFlightRef = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [photoCaptureFailed, setPhotoCaptureFailed] = useState(false);
  const [captureCleanupFailed, setCaptureCleanupFailed] = useState(false);
  const [settingsOpenFailed, setSettingsOpenFailed] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const cleanupInFlightRef = useRef(false);
  const captureCleanupRetryRef = useRef<(() => Promise<void>) | null>(null);
  const [grantingConsent, setGrantingConsent] = useState(false);
  const [consentSaveFailure, setConsentSaveFailure] = useState<ConsentSaveFailure>(null);
  const simulatedPhotoConsentFailureUsed = useRef(false);
  const photoConsentFailureMode = devPhotoConsentFailureMode();
  const [simulateProgressCaptureFailureOnce, setSimulateProgressCaptureFailureOnce] = useState(
    () => devProgressCaptureFailureMode() === 'once',
  );
  const progressCameraPermissionMode = devProgressCameraPermissionMode();

  const canPublish = useCallback(
    () => mountedRef.current && isOwnerQueryScopeCurrent(ownerScope),
    [ownerScope],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const retryCleanup = captureCleanupRetryRef.current;
      if (retryCleanup) {
        void runOwnerQueryOperation(ownerScope, retryCleanup).catch(() => undefined);
      }
    };
  }, [ownerScope]);

  const loadPhotoCaptureConsent = useCallback(
    (retry: boolean) => {
      if (consentReadInFlightRef.current !== null) return;
      const generation = ++consentReadGenerationRef.current;
      consentReadInFlightRef.current = generation;
      if (retry) {
        setConsentReadState((current) => ({
          ownerGeneration: ownerScope.generation,
          result: current.ownerGeneration === ownerScope.generation ? current.result : null,
          retrying: true,
          retryFailed: false,
        }));
      }

      const timeout = setTimeout(() => {
        if (generation !== consentReadGenerationRef.current || !canPublish()) return;
        consentReadGenerationRef.current += 1;
        consentReadInFlightRef.current = null;
        setConsentReadState({
          ownerGeneration: ownerScope.generation,
          result: {
            status: 'unavailable',
            source: 'primary',
            reason: 'storage_unavailable',
            consent: null,
          },
          retrying: false,
          retryFailed: retry,
        });
      }, PHOTO_CONSENT_READ_TIMEOUT_MS);

      void runOwnerQueryOperation(ownerScope, () => readPhotoCaptureConsent())
        .then((result) => {
          if (generation !== consentReadGenerationRef.current || !canPublish()) return;
          setConsentSaveFailure(null);
          setConsentReadState({
            ownerGeneration: ownerScope.generation,
            result,
            retrying: false,
            retryFailed:
              retry &&
              !isCurrentPhotoCaptureConsent(result) &&
              !photoCaptureConsentNeedsChoice(result),
          });
        })
        .catch(() => {
          if (generation !== consentReadGenerationRef.current || !canPublish()) return;
          setConsentReadState({
            ownerGeneration: ownerScope.generation,
            result: {
              status: 'unavailable',
              source: 'primary',
              reason: 'storage_unavailable',
              consent: null,
            },
            retrying: false,
            retryFailed: retry,
          });
        })
        .finally(() => {
          clearTimeout(timeout);
          if (consentReadInFlightRef.current === generation) {
            consentReadInFlightRef.current = null;
          }
          if (generation === consentReadGenerationRef.current && canPublish()) {
            setConsentReadState((current) =>
              current.ownerGeneration === ownerScope.generation && current.retrying
                ? { ...current, retrying: false }
                : current,
            );
          }
        });
    },
    [canPublish, ownerScope],
  );

  useEffect(() => {
    consentReadGenerationRef.current += 1;
    consentReadInFlightRef.current = null;
    const start = setTimeout(() => loadPhotoCaptureConsent(false), 0);
    return () => clearTimeout(start);
  }, [loadPhotoCaptureConsent]);

  const currentConsentReadState =
    consentReadState.ownerGeneration === ownerScope.generation
      ? consentReadState
      : {
          ownerGeneration: ownerScope.generation,
          result: null,
          retrying: false,
          retryFailed: false,
        };
  const consentResult = currentConsentReadState.result;

  const consentIsCurrent = consentResult !== null && isCurrentPhotoCaptureConsent(consentResult);
  const consentNeedsChoice =
    consentResult !== null && photoCaptureConsentNeedsChoice(consentResult);
  const reconsentRequired =
    consentResult?.status === 'available' && consentResult.state === 'reconsent_required';

  const canShowCamera =
    consentIsCurrent &&
    env.nativeCameraEnabled &&
    Platform.OS !== 'web' &&
    Boolean(permission?.granted) &&
    !cameraUnavailable;
  const canAttemptCapture = canShowCamera || simulateProgressCaptureFailureOnce;
  const canAskCameraPermission =
    progressCameraPermissionMode === 'denied_no_retry' ? false : (permission?.canAskAgain ?? true);
  const captureReady =
    (canShowCamera && cameraReady && !photoCaptureFailed) || simulateProgressCaptureFailureOnce;
  const referenceUri = photos.reference?.localUri ?? null;
  const retryCaptureCleanup = (onSuccess: () => void) => {
    if (cleanupInFlightRef.current) return;
    const retryCleanup = captureCleanupRetryRef.current;
    if (!retryCleanup) {
      onSuccess();
      return;
    }
    cleanupInFlightRef.current = true;
    void runOwnerQueryOperation(ownerScope, retryCleanup)
      .then(() => {
        if (!canPublish()) return;
        captureCleanupRetryRef.current = null;
        setCaptureCleanupFailed(false);
        onSuccess();
      })
      .catch((error: unknown) => {
        if (!canPublish()) return;
        if (error instanceof CaptureStagingCleanupError) {
          captureCleanupRetryRef.current = error.retryCleanup;
        }
        setCaptureCleanupFailed(true);
        setPhotoCaptureFailed(true);
      })
      .finally(() => {
        cleanupInFlightRef.current = false;
      });
  };
  const closeToProgress = () => {
    if (capturing || grantingConsent) return;
    retryCaptureCleanup(() => backOrReplace(router, APP_PROGRESS_ROUTE));
  };
  const returnToProgress = () => {
    if (capturing || grantingConsent) return;
    retryCaptureCleanup(() => router.replace(APP_PROGRESS_ROUTE));
  };

  async function capture() {
    if (
      !consentIsCurrent ||
      (!cameraRef.current && !simulateProgressCaptureFailureOnce) ||
      !canAttemptCapture ||
      capturing
    ) {
      return;
    }
    setCapturing(true);
    setPhotoCaptureFailed(false);
    const stagedCaptureRef: { current: StagedPhotoCapture | null } = { current: null };
    try {
      await runOwnerQueryOperation(ownerScope, async (lease) => {
        if (simulateProgressCaptureFailureOnce) {
          setSimulateProgressCaptureFailureOnce(false);
          throw new Error('E2E_PROGRESS_CAPTURE_FAILURE');
        }
        const stagedCapture = await capturePhotoForReview(lease, () =>
          cameraRef.current!.takePictureAsync({
            quality: 0.76,
            base64: false,
            exif: false,
            shutterSound: true,
          }),
        );
        stagedCaptureRef.current = stagedCapture;
        lease.assertCurrent();
        if (!canPublish()) {
          await cleanupCapturedPhoto(stagedCapture.handle);
          stagedCaptureRef.current = null;
          return;
        }
        haptics.success();
        track('photo_capture_still_taken', { signal_source: 'post_capture_measurement' });
        lease.assertCurrent();
        router.replace({
          pathname: '/progress/review',
          params: {
            captureSessionId: stagedCapture.handle.operationId,
            photoWidth: String(stagedCapture.width),
            photoHeight: String(stagedCapture.height),
            timeOfDay: timeOfDayNow(),
            takenLocalDate: localDay(),
          },
        });
      });
    } catch (error) {
      if (stagedCaptureRef.current) {
        const handle = stagedCaptureRef.current.handle;
        try {
          await cleanupCapturedPhoto(handle);
        } catch {
          if (canPublish()) {
            captureCleanupRetryRef.current = () => cleanupCapturedPhoto(handle);
            setCaptureCleanupFailed(true);
          }
        }
      }
      if (canPublish()) {
        if (error instanceof CaptureStagingCleanupError) {
          captureCleanupRetryRef.current = error.retryCleanup;
          setCaptureCleanupFailed(true);
        }
        setCapturing(false);
        setPhotoCaptureFailed(true);
      }
    }
  }

  async function openCameraSettings() {
    setSettingsOpenFailed(false);
    const opened = await openAppSettings({
      failureTitle: CAMERA_FAILURE_COPY.progressSettingsTitle,
      failureMessage: CAMERA_FAILURE_COPY.progressSettingsBody,
      alertOnFailure: false,
    });
    if (!opened) setSettingsOpenFailed(true);
  }

  async function grantCaptureConsent() {
    if (consentGrantInFlightRef.current) return;
    consentGrantInFlightRef.current = true;
    consentReadGenerationRef.current += 1;
    setConsentSaveFailure(null);
    setGrantingConsent(true);
    const grant: () => Promise<PhotoCaptureConsentCurrentResult> =
      photoConsentFailureMode === 'once' && !simulatedPhotoConsentFailureUsed.current
        ? async (): Promise<PhotoCaptureConsentCurrentResult> => {
            simulatedPhotoConsentFailureUsed.current = true;
            throw new Error('E2E_PHOTO_CONSENT_FAILURE');
          }
        : grantPhotoCaptureConsent;
    try {
      await applyPhotoCaptureConsent({
        grant,
        requestPermission: requestPermission as () => Promise<unknown>,
        onSaved: (result) => {
          if (!canPublish()) return false;
          setConsentSaveFailure(null);
          setConsentReadState({
            ownerGeneration: ownerScope.generation,
            result,
            retrying: false,
            retryFailed: false,
          });
          return true;
        },
        onFailure: (error) => {
          if (!canPublish()) return;
          if (error instanceof PhotoCaptureConsentStateChangedError) {
            setConsentSaveFailure(null);
            setConsentReadState({
              ownerGeneration: ownerScope.generation,
              result: error.result,
              retrying: false,
              retryFailed: false,
            });
            return;
          }
          const uncertain = error instanceof PhotoCaptureConsentWriteUncertainError;
          setConsentSaveFailure(uncertain ? 'uncertain' : 'failed');
          if (uncertain) {
            setConsentReadState({
              ownerGeneration: ownerScope.generation,
              result: {
                status: 'unavailable',
                source: 'primary',
                reason: 'storage_unavailable',
                consent: null,
              },
              retrying: false,
              retryFailed: false,
            });
          }
        },
      });
    } finally {
      consentGrantInFlightRef.current = false;
      if (canPublish()) setGrantingConsent(false);
    }
  }

  if (!consentIsCurrent) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: consentNeedsChoice ? NIGHT_CONSENT_OVERLAY_BG : BG,
        }}
      >
        {consentNeedsChoice ? (
          <ConsentGate
            granting={grantingConsent}
            reconsentRequired={reconsentRequired}
            saveFailure={consentSaveFailure}
            onGrant={() => void grantCaptureConsent().catch(() => undefined)}
            onCancel={closeToProgress}
          />
        ) : consentResult !== null ? (
          <ConsentReadRecoveryGate
            retrying={currentConsentReadState.retrying}
            retryFailed={currentConsentReadState.retryFailed}
            writeUncertain={consentSaveFailure === 'uncertain'}
            onRetry={() => loadPhotoCaptureConsent(true)}
            onCancel={returnToProgress}
          />
        ) : (
          <ConsentReadLoadingGate onCancel={returnToProgress} />
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG, paddingTop: insets.top + 16 }}>
      <View className="flex-row items-center justify-between px-6">
        <RouteIconButton
          accessibilityLabel="Close"
          disabled={capturing}
          glyph="x"
          onPress={closeToProgress}
          tone="night"
          style={{
            backgroundColor: 'rgba(244,239,231,0.12)',
            borderColor: 'transparent',
          }}
        />
        <Text style={{ fontFamily: 'HankenGrotesk-SemiBold', fontSize: 14, color: '#F4EFE7' }}>
          Front · weekly
        </Text>
        <View
          style={{
            width: 48,
            height: 48,
          }}
        />
      </View>

      <View className="flex-1 items-center justify-center">
        <View style={{ position: 'absolute', width: '100%', height: '100%', overflow: 'hidden' }}>
          {canShowCamera ? (
            <CameraView
              ref={cameraRef}
              active={isFocused}
              animateShutter
              facing="front"
              mirror
              mode="picture"
              onCameraReady={() => setCameraReady(true)}
              onMountError={() => {
                setCameraReady(false);
                setCameraUnavailable(true);
              }}
              style={{ flex: 1 }}
            />
          ) : null}
        </View>
        {referenceUri ? (
          <View
            style={{
              position: 'absolute',
              width: 210,
              height: 270,
              borderRadius: 130,
              opacity: 0.18,
              overflow: 'hidden',
              transform: [{ translateX: 8 }, { translateY: -6 }],
            }}
          >
            <PhotoImage uri={referenceUri} style={{ flex: 1 }} />
          </View>
        ) : (
          <View
            style={{
              position: 'absolute',
              width: 210,
              height: 270,
              borderRadius: 130,
              backgroundColor: 'rgba(217,161,131,0.10)',
              transform: [{ translateX: 8 }, { translateY: -6 }],
            }}
          />
        )}
        <View
          style={{
            width: 218,
            height: 282,
            borderRadius: 130,
            borderWidth: 2,
            borderColor: 'rgba(244,239,231,0.62)',
            borderStyle: 'dashed',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: -10,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: GUIDE,
            }}
          />
          <Text
            style={{
              fontFamily: 'IBMPlexMono-Regular',
              fontSize: 10,
              color: 'rgba(244,239,231,0.75)',
              textAlign: 'center',
              lineHeight: 16,
            }}
          >
            {referenceUri ? PHOTO_COPY.capture.ghostHint : PHOTO_COPY.capture.guideHint}
          </Text>
          <Text
            style={{
              fontFamily: 'IBMPlexMono-Regular',
              fontSize: 9,
              color: 'rgba(244,239,231,0.5)',
              textAlign: 'center',
              marginTop: 8,
            }}
          >
            framing guide
          </Text>
        </View>
        <View
          style={{
            position: 'absolute',
            bottom: 18,
            backgroundColor: 'rgba(22,19,15,0.82)',
            borderRadius: 999,
            paddingHorizontal: 20,
            paddingVertical: 11,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: '#D9A183',
            }}
          />
          <Text style={{ fontFamily: 'HankenGrotesk-SemiBold', fontSize: 14.5, color: '#F4EFE7' }}>
            {PHOTO_COPY.capture.guideHint}
          </Text>
        </View>
      </View>

      {canAttemptCapture ? (
        <View
          style={{
            backgroundColor: 'rgba(22,19,15,0.9)',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 26,
            paddingTop: 20,
            paddingBottom: insets.bottom + 24,
          }}
        >
          <View className="mb-5 flex-row items-center" style={{ gap: 12 }}>
            <Text
              style={{
                flex: 1,
                fontFamily: 'HankenGrotesk-SemiBold',
                fontSize: 12.5,
                color: 'rgba(244,239,231,0.76)',
              }}
            >
              {PHOTO_COPY.capture.qualityCheck}
            </Text>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: READY,
              }}
            />
          </View>
          <View className="flex-row items-center justify-between">
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 13,
                backgroundColor: 'rgba(244,239,231,0.1)',
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Capture photo"
              disabled={!captureReady || capturing}
              onPress={() => void capture()}
              style={{
                width: 78,
                height: 78,
                borderRadius: 39,
                borderWidth: 4,
                borderColor: READY,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: captureReady && !capturing ? 1 : 0.55,
              }}
            >
              <View
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: 31,
                  backgroundColor: READY,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontFamily: 'HankenGrotesk-Bold',
                    fontSize: 11,
                    color: BG,
                    textAlign: 'center',
                    lineHeight: 13,
                  }}
                >
                  {capturing ? 'Saving' : PHOTO_COPY.capture.shutter}
                </Text>
              </View>
            </Pressable>
            <Text
              style={{
                width: 104,
                textAlign: 'right',
                fontFamily: 'IBMPlexMono-Regular',
                fontSize: 10,
                lineHeight: 15,
                color: 'rgba(244,239,231,0.42)',
              }}
            >
              {PHOTO_COPY.capture.onDevice}
            </Text>
          </View>
        </View>
      ) : null}

      {photoCaptureFailed ? (
        <PhotoCaptureFailureGate
          cleanupFailed={captureCleanupFailed}
          onRetry={() => {
            retryCaptureCleanup(() => {
              setPhotoCaptureFailed(false);
              setCaptureCleanupFailed(false);
            });
          }}
          onCancel={closeToProgress}
        />
      ) : cameraUnavailable ? (
        <CameraUnavailableGate
          onRetry={() => {
            setCameraUnavailable(false);
            setCameraReady(false);
          }}
          onCancel={closeToProgress}
        />
      ) : !canAttemptCapture ? (
        <PermissionGate
          canAskAgain={canAskCameraPermission}
          settingsOpenFailed={settingsOpenFailed}
          onAsk={() => {
            setSettingsOpenFailed(false);
            void requestPermission();
          }}
          onOpenSettings={() => void openCameraSettings()}
          onCancel={closeToProgress}
        />
      ) : null}
    </View>
  );
}

export default function CaptureScreen() {
  return (
    <ProGate feature="photo_timeline">
      <PhotoTimelineLockGate>
        <ProgressPhotoRouteSource onExit={() => router.replace(APP_PROGRESS_ROUTE)}>
          {(photos) => <CaptureScreenContent photos={photos} />}
        </ProgressPhotoRouteSource>
      </PhotoTimelineLockGate>
    </ProGate>
  );
}
