import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useIsFocused } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RouteIconButton, Text } from '@/components/ui';
import { CAMERA_FAILURE_COPY } from '@/features/native/camera/failureCopy';
import { useGuidedCaptureSignals } from '@/features/native/camera/guidedSignals';
import { PHOTO_CAPTURE_CONSENT } from '@/features/onboarding/consentCopy';
import { applyPhotoCaptureConsent } from '@/features/photos/applyCaptureConsent';
import { grantPhotoCaptureConsent, hasPhotoCaptureConsent } from '@/features/photos/consent';
import { PHOTO_COPY } from '@/features/photos/copy';
import { localDay, timeOfDayNow } from '@/features/photos/date';
import { PhotoImage } from '@/features/photos/PhotoImage';
import { coachingLine, lightingState } from '@/features/photos/quality';
import { usePhotos } from '@/features/photos/usePhotos';
import { ProGate } from '@/features/subscription/ProGate';
import { track } from '@/lib/analytics/track';
import { env } from '@/lib/env';
import { openAppSettings } from '@/lib/navigation/appSettings';
import { APP_PROGRESS_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';

const BG = '#16130F';
const GUIDE = '#9DB18A';
const READY = '#9DB18A';
const NIGHT_SECONDARY_ACTION_BG = 'rgba(244,239,231,0.08)';
const NIGHT_SECONDARY_ACTION_TEXT = 'rgba(244,239,231,0.84)';
const NIGHT_FOOTNOTE_TEXT = 'rgba(244,239,231,0.76)';
const NIGHT_CONSENT_OVERLAY_BG = '#100D0A';

function devPhotoConsentFailureMode(): 'once' | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  return process.env.EXPO_PUBLIC_E2E_PHOTO_CONSENT_FAILURE === 'once' ? 'once' : null;
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
  saveFailed,
  onGrant,
  onCancel,
}: {
  granting: boolean;
  saveFailed: boolean;
  onGrant: () => void;
  onCancel: () => void;
}) {
  const compact = useWindowDimensions().height < 640;
  const showPrepReminder = !(compact && saveFailed);

  return (
    <CaptureOverlay backgroundColor={NIGHT_CONSENT_OVERLAY_BG} compact={compact}>
      <Text
        style={{
          fontFamily: 'InstrumentSerif_400Regular',
          fontSize: compact ? 27 : 30,
          lineHeight: compact ? 29 : undefined,
          color: '#F4EFE7',
          marginBottom: compact ? 10 : 16,
        }}
      >
        Your photos stay on this phone.
      </Text>
      {(
        [
          ['What', PHOTO_CAPTURE_CONSENT.what],
          ['Why', PHOTO_CAPTURE_CONSENT.why],
          ['Never', PHOTO_CAPTURE_CONSENT.never],
        ] as const
      ).map(([k, v]) => (
        <View key={k} style={{ marginBottom: compact ? 9 : 14 }}>
          <Text variant="label" style={{ color: '#D9A183', marginBottom: 2 }}>
            {k.toUpperCase()}
          </Text>
          <Text
            style={{
              fontFamily: 'HankenGrotesk_400Regular',
              fontSize: compact ? 14 : 14.5,
              color: 'rgba(244,239,231,0.9)',
              lineHeight: compact ? 19 : 21,
            }}
          >
            {v}
          </Text>
        </View>
      ))}
      <Text
        style={{
          fontFamily: 'IBMPlexMono_400Regular',
          fontSize: compact ? 10.5 : 11,
          color: NIGHT_FOOTNOTE_TEXT,
          lineHeight: compact ? 15 : undefined,
          marginTop: compact ? 2 : 6,
          marginBottom: compact ? 8 : 14,
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
              fontFamily: 'HankenGrotesk_500Medium',
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
              fontFamily: 'HankenGrotesk_600SemiBold',
              fontSize: compact ? 12.5 : 13.5,
              color: '#F4EFE7',
              marginBottom: compact ? 0 : 2,
            }}
          >
            {compact
              ? `${PHOTO_COPY.capture.consentFailedTitle}. ${PHOTO_COPY.capture.consentFailedBody}`
              : PHOTO_COPY.capture.consentFailedTitle}
          </Text>
          {compact ? null : (
            <Text
              style={{
                fontFamily: 'HankenGrotesk_400Regular',
                fontSize: 13,
                color: 'rgba(244,239,231,0.86)',
                lineHeight: 18,
              }}
            >
              {PHOTO_COPY.capture.consentFailedBody}
            </Text>
          )}
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
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
        <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 16, color: BG }}>
          {granting ? 'Saving choice' : 'Take photos. On device only'}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onCancel}
        style={{
          height: 48,
          marginTop: compact ? 4 : 8,
          borderRadius: 999,
          backgroundColor: NIGHT_SECONDARY_ACTION_BG,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: 'HankenGrotesk_500Medium',
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
          fontFamily: 'InstrumentSerif_400Regular',
          fontSize: 30,
          color: '#F4EFE7',
          marginBottom: 12,
        }}
      >
        {CAMERA_FAILURE_COPY.progressUnavailableTitle}
      </Text>
      <Text
        style={{
          fontFamily: 'HankenGrotesk_400Regular',
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
        <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 16, color: BG }}>
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
            fontFamily: 'HankenGrotesk_500Medium',
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
  onAsk,
  onCancel,
}: {
  canAskAgain: boolean;
  onAsk: () => void;
  onCancel: () => void;
}) {
  return (
    <CaptureOverlay>
      <Text
        style={{
          fontFamily: 'InstrumentSerif_400Regular',
          fontSize: 30,
          color: '#F4EFE7',
          marginBottom: 12,
        }}
      >
        Camera access is needed for progress photos.
      </Text>
      <Text
        style={{
          fontFamily: 'HankenGrotesk_400Regular',
          fontSize: 14.5,
          color: 'rgba(244,239,231,0.78)',
          lineHeight: 21,
          marginBottom: 22,
        }}
      >
        The photo is captured on this device and saved into encrypted app-private storage.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={canAskAgain ? onAsk : () => void openAppSettings()}
        style={{
          height: 56,
          borderRadius: 999,
          backgroundColor: '#F4EFE7',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 16, color: BG }}>
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
            fontFamily: 'HankenGrotesk_500Medium',
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

function CaptureScreenContent() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [consented, setConsented] = useState<boolean | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [grantingConsent, setGrantingConsent] = useState(false);
  const [consentSaveFailed, setConsentSaveFailed] = useState(false);
  const simulatedPhotoConsentFailureUsed = useRef(false);
  const photoConsentFailureMode = devPhotoConsentFailureMode();
  const { data } = usePhotos('front');

  useEffect(() => {
    void hasPhotoCaptureConsent().then(setConsented);
  }, []);

  const canShowCamera =
    consented === true &&
    env.nativeCameraEnabled &&
    Platform.OS !== 'web' &&
    Boolean(permission?.granted) &&
    !cameraUnavailable;
  const { signals, ready } = useGuidedCaptureSignals(cameraReady && canShowCamera);
  const coaching = coachingLine(signals);
  const light = lightingState(signals);
  const referenceUri = data?.reference?.localUri ?? null;
  const closeToProgress = () => backOrReplace(router, APP_PROGRESS_ROUTE);

  async function capture() {
    if (consented !== true || !cameraRef.current || !canShowCamera || capturing) return;
    setCapturing(true);
    try {
      const shot = await cameraRef.current.takePictureAsync({
        quality: 0.76,
        base64: false,
        exif: false,
        shutterSound: true,
      });
      haptics.success();
      const captureSessionId = randomUUID();
      track('photo_capture_still_taken', { signal_source: 'camera_preview_estimate' });
      router.replace({
        pathname: '/progress/review',
        params: {
          alignment: String(signals.alignment),
          lighting: String(light.fill),
          headRoll: String(signals.roll),
          headYaw: String(signals.yaw),
          headPitch: String(signals.pitch),
          captureSessionId,
          capturedUri: shot.uri,
          timeOfDay: timeOfDayNow(),
          takenLocalDate: localDay(),
        },
      });
    } catch {
      setCapturing(false);
      Alert.alert(
        CAMERA_FAILURE_COPY.progressCaptureTitle,
        CAMERA_FAILURE_COPY.progressCaptureBody,
      );
    }
  }

  async function grantCaptureConsent() {
    if (grantingConsent) return;
    setConsentSaveFailed(false);
    setGrantingConsent(true);
    const grant =
      photoConsentFailureMode === 'once' && !simulatedPhotoConsentFailureUsed.current
        ? async () => {
            simulatedPhotoConsentFailureUsed.current = true;
            throw new Error('E2E_PHOTO_CONSENT_FAILURE');
          }
        : grantPhotoCaptureConsent;
    try {
      await applyPhotoCaptureConsent({
        grant,
        requestPermission: requestPermission as () => Promise<unknown>,
        onSaved: () => {
          setConsentSaveFailed(false);
          setConsented(true);
        },
        onFailure: () => {
          setConsentSaveFailed(true);
          Alert.alert(PHOTO_COPY.capture.consentFailedTitle, PHOTO_COPY.capture.consentFailedBody);
        },
      });
    } finally {
      setGrantingConsent(false);
    }
  }

  if (consented !== true) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: consented === false ? NIGHT_CONSENT_OVERLAY_BG : BG,
        }}
      >
        {consented === false ? (
          <ConsentGate
            granting={grantingConsent}
            saveFailed={consentSaveFailed}
            onGrant={() => void grantCaptureConsent()}
            onCancel={closeToProgress}
          />
        ) : (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: BG,
            }}
          />
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG, paddingTop: insets.top + 16 }}>
      <View className="flex-row items-center justify-between px-6">
        <RouteIconButton
          accessibilityLabel="Close"
          glyph="x"
          onPress={closeToProgress}
          tone="night"
          style={{
            backgroundColor: 'rgba(244,239,231,0.12)',
            borderColor: 'transparent',
          }}
        />
        <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14, color: '#F4EFE7' }}>
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
            borderColor: ready ? 'rgba(157,177,138,0.9)' : 'rgba(244,239,231,0.55)',
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
              fontFamily: 'IBMPlexMono_400Regular',
              fontSize: 10,
              color: 'rgba(244,239,231,0.75)',
              textAlign: 'center',
              lineHeight: 16,
            }}
          >
            {PHOTO_COPY.capture.ghostHint}
          </Text>
          <Text
            style={{
              fontFamily: 'IBMPlexMono_400Regular',
              fontSize: 9,
              color: 'rgba(244,239,231,0.5)',
              textAlign: 'center',
              marginTop: 8,
            }}
          >
            preview quality estimate
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
              backgroundColor: ready ? READY : '#D9A183',
            }}
          />
          <Text
            style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14.5, color: '#F4EFE7' }}
          >
            {coaching}
          </Text>
        </View>
      </View>

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
        <View className="mb-5 flex-row items-center" style={{ gap: 14 }}>
          <Text
            style={{
              width: 58,
              fontFamily: 'HankenGrotesk_600SemiBold',
              fontSize: 12.5,
              color: 'rgba(244,239,231,0.6)',
            }}
          >
            {PHOTO_COPY.capture.lightingLabel}
          </Text>
          <View
            style={{
              flex: 1,
              height: 5,
              borderRadius: 3,
              backgroundColor: 'rgba(244,239,231,0.14)',
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${Math.round(light.fill * 100)}%`,
                height: '100%',
                backgroundColor: READY,
                borderRadius: 3,
              }}
            />
          </View>
          <Text style={{ fontFamily: 'HankenGrotesk_700Bold', fontSize: 13, color: READY }}>
            {light.label}
          </Text>
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
            disabled={!canShowCamera || !cameraReady || capturing}
            onPress={() => void capture()}
            style={{
              width: 78,
              height: 78,
              borderRadius: 39,
              borderWidth: 4,
              borderColor: READY,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: canShowCamera && cameraReady && !capturing ? 1 : 0.55,
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
                  fontFamily: 'HankenGrotesk_700Bold',
                  fontSize: 11,
                  color: BG,
                  textAlign: 'center',
                  lineHeight: 13,
                }}
              >
                {capturing ? 'Saving' : PHOTO_COPY.capture.autoReady}
              </Text>
            </View>
          </Pressable>
          <Text
            style={{
              width: 104,
              textAlign: 'right',
              fontFamily: 'IBMPlexMono_400Regular',
              fontSize: 10,
              lineHeight: 15,
              color: 'rgba(244,239,231,0.42)',
            }}
          >
            {PHOTO_COPY.capture.onDevice}
          </Text>
        </View>
      </View>

      {cameraUnavailable ? (
        <CameraUnavailableGate
          onRetry={() => {
            setCameraUnavailable(false);
            setCameraReady(false);
          }}
          onCancel={closeToProgress}
        />
      ) : !canShowCamera ? (
        <PermissionGate
          canAskAgain={permission?.canAskAgain ?? true}
          onAsk={() => void requestPermission()}
          onCancel={closeToProgress}
        />
      ) : null}
    </View>
  );
}

export default function CaptureScreen() {
  return (
    <ProGate feature="photo_timeline">
      <CaptureScreenContent />
    </ProGate>
  );
}
