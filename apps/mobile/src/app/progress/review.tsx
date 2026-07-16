import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RouteIconButton, Text } from '@/components/ui';
import { CaptureAnalysisProvider } from '@/features/photos/CaptureAnalysisProvider';
import { cleanupCapturedPhoto, resolveCapturedPhoto } from '@/features/photos/captureStaging';
import { PHOTO_COPY, QUALITY_NOTE } from '@/features/photos/copy';
import { localDay } from '@/features/photos/date';
import { PhotoImage } from '@/features/photos/PhotoImage';
import { PhotoTimelineLockGate } from '@/features/photos/PhotoTimelineLockGate';
import { ProgressPhotoRouteSource } from '@/features/photos/ProgressPhotoRouteSource';
import type { FramingAssessment, LightingAssessment } from '@/features/photos/captureAnalysis';
import { reviewQuality } from '@/features/photos/quality';
import { parseLocalDate } from '@/features/photos/timeline';
import { useCaptureAnalysis } from '@/features/photos/useCaptureAnalysis';
import { usePhotoActions, type PhotosQueryData } from '@/features/photos/usePhotos';
import { ProGate } from '@/features/subscription/ProGate';
import {
  motionAwareModalAnimation,
  useReduceMotionPreference,
} from '@/lib/accessibility/useReduceMotionPreference';
import { track } from '@/lib/analytics/track';
import { APP_PROGRESS_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { isOwnerQueryScopeCurrent, runOwnerQueryOperation } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';
import type { PlaintextStagingHandle } from '@/lib/storage/plaintextStaging';
import type { TimeOfDay } from '@onskin/types';

// Review & retake (docs/06 §2, design screen 02). Quality is FLAGGED, never blocked
// (D-029). The calm note compares to the series reference, and Save always works.

const BG = '#16130F';
const SAGE = '#9DB18A';

function fmt(ymd: string): string {
  return parseLocalDate(ymd).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

type ChipTone = 'good' | 'adjust' | 'neutral';

function toneColor(tone: ChipTone): string {
  return tone === 'good' ? SAGE : tone === 'adjust' ? '#D9A183' : '#B6ADA2';
}

function Chip({ label, tone }: { label: string; tone: ChipTone }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(22,19,15,0.78)',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: toneColor(tone) }} />
      <Text style={{ fontFamily: 'HankenGrotesk-SemiBold', fontSize: 11.5, color: '#F4EFE7' }}>
        {label}
      </Text>
    </View>
  );
}

function framingChip(framing: FramingAssessment): { label: string; tone: ChipTone } {
  switch (framing.state) {
    case 'matched':
      return { label: PHOTO_COPY.review.framingMatched, tone: 'good' };
    case 'adjust':
      return { label: PHOTO_COPY.review.framingAdjust, tone: 'adjust' };
    case 'no_face':
      return { label: PHOTO_COPY.review.framingNoFace, tone: 'adjust' };
    case 'multiple_faces':
      return { label: PHOTO_COPY.review.framingMultipleFaces, tone: 'adjust' };
    case 'checking':
      return { label: 'Checking framing', tone: 'neutral' };
    default:
      return { label: PHOTO_COPY.review.framingUnavailable, tone: 'neutral' };
  }
}

function lightingChip(lighting: LightingAssessment): { label: string; tone: ChipTone } {
  switch (lighting.state) {
    case 'good':
      return { label: PHOTO_COPY.review.lightingGood, tone: 'good' };
    case 'too_dark':
      return { label: PHOTO_COPY.review.lightingDark, tone: 'adjust' };
    case 'too_bright':
      return { label: PHOTO_COPY.review.lightingBright, tone: 'adjust' };
    case 'uneven':
      return { label: PHOTO_COPY.review.lightingUneven, tone: 'adjust' };
    case 'checking':
      return { label: 'Checking light', tone: 'neutral' };
    default:
      return { label: PHOTO_COPY.review.lightingUnavailable, tone: 'neutral' };
  }
}

function isNonBlank(value: string | null): value is string {
  return value != null && value.trim().length > 0;
}

function positiveNumber(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

type CaptureSourceState =
  | { status: 'resolving' }
  | { status: 'ready'; handle: PlaintextStagingHandle }
  | { status: 'missing' }
  | { status: 'unavailable' };

type ReviewScreenContentProps = {
  cleanupInFlight: boolean;
  photos: PhotosQueryData;
  setCriticalOperationInFlight: (inFlight: boolean) => void;
};

function ReviewScreenContent({
  cleanupInFlight,
  photos,
  setCriticalOperationInFlight,
}: ReviewScreenContentProps) {
  const insets = useSafeAreaInsets();
  const ownerScope = useOwnerQueryScope();
  const { height } = useWindowDimensions();
  const compact = height < 700;
  const photoHeight = compact ? Math.max(286, Math.min(330, Math.round(height * 0.54))) : 380;
  const params = useLocalSearchParams<{
    analysisFixture?: string;
    captureSessionId?: string;
    photoWidth?: string;
    photoHeight?: string;
    timeOfDay?: string;
    takenLocalDate?: string;
  }>();
  const captureSessionId = isNonBlank(params.captureSessionId ?? null)
    ? params.captureSessionId!
    : null;
  const [captureLookup, setCaptureLookup] = useState<{
    captureSessionId: string | null;
    source: CaptureSourceState;
  }>({
    captureSessionId: null,
    source: { status: 'resolving' },
  });
  const [captureLookupRevision, setCaptureLookupRevision] = useState(0);
  const captureSource: CaptureSourceState = !captureSessionId
    ? { status: 'missing' }
    : captureLookup.captureSessionId === captureSessionId
      ? captureLookup.source
      : { status: 'resolving' };
  const capturedUri = captureSource.status === 'ready' ? captureSource.handle.uri : null;
  const hasCapturedPhoto = captureSource.status === 'ready';
  const timeOfDay = (params.timeOfDay as TimeOfDay) ?? null;
  const takenLocalDate = params.takenLocalDate ?? localDay();
  const analysis = useCaptureAnalysis({
    uri: hasCapturedPhoto ? capturedUri : null,
    width: positiveNumber(params.photoWidth),
    height: positiveNumber(params.photoHeight),
    fixtureName: params.analysisFixture,
  });

  const { add } = usePhotoActions();
  const [saveFailed, setSaveFailed] = useState(false);
  const saveInFlightRef = useRef(false);

  useEffect(() => {
    let active = true;
    if (!captureSessionId) {
      return () => {
        active = false;
      };
    }

    void runOwnerQueryOperation(ownerScope, () => resolveCapturedPhoto(captureSessionId))
      .then((handle) => {
        if (!active) return;
        setCaptureLookup({
          captureSessionId,
          source: handle ? { status: 'ready', handle } : { status: 'missing' },
        });
      })
      .catch(() => {
        if (active && isOwnerQueryScopeCurrent(ownerScope)) {
          setCaptureLookup({ captureSessionId, source: { status: 'unavailable' } });
        }
      });

    return () => {
      active = false;
    };
  }, [captureLookupRevision, captureSessionId, ownerScope]);

  const refLighting =
    photos.reference?.qualitySource === 'post_capture_measurement'
      ? photos.reference.lightingScore
      : null;
  const verdict = reviewQuality({
    framing: analysis.framing,
    lighting: analysis.lighting,
    refLighting,
  });
  const noteTone: ChipTone =
    analysis.status === 'checking' || verdict.flag === 'unmeasured'
      ? 'neutral'
      : verdict.flag === 'matched'
        ? 'good'
        : 'adjust';
  const noteBackgroundColor =
    noteTone === 'good'
      ? 'rgba(157,177,138,0.12)'
      : noteTone === 'adjust'
        ? 'rgba(217,161,131,0.12)'
        : 'rgba(182,173,162,0.12)';
  const qualitySource =
    analysis.framing.score != null || analysis.lighting.score != null
      ? ('post_capture_measurement' as const)
      : null;
  const discardAndNavigate = (navigate: () => void) => {
    if (saveInFlightRef.current || cleanupInFlight) return;
    navigate();
  };
  const closeToProgress = () => {
    discardAndNavigate(() => backOrReplace(router, APP_PROGRESS_ROUTE));
  };

  function save() {
    if (!hasCapturedPhoto || add.isPending || saveInFlightRef.current) return;

    saveInFlightRef.current = true;
    setCriticalOperationInFlight(true);
    setSaveFailed(false);
    const wasEmpty = photos.count === 0;
    void add
      .mutateAsync({
        takenLocalDate,
        timeOfDay,
        alignmentScore: analysis.framing.score,
        lightingScore: analysis.lighting.score,
        headRoll: analysis.framing.headRoll,
        headYaw: analysis.framing.headYaw,
        headPitch: analysis.framing.headPitch,
        qualitySource,
        captureSessionId: params.captureSessionId ?? null,
        localUri: capturedUri,
      })
      .then(() => {
        setCriticalOperationInFlight(false);
        if (!isOwnerQueryScopeCurrent(ownerScope)) return;
        saveInFlightRef.current = false;
        track('photo_captured', { on_device: true });
        if (wasEmpty) {
          track('first_photo_captured');
          track('photo_baseline_added', { on_device: true });
        }
        router.replace(APP_PROGRESS_ROUTE);
      })
      .catch(() => {
        setCriticalOperationInFlight(false);
        if (!isOwnerQueryScopeCurrent(ownerScope)) return;
        saveInFlightRef.current = false;
        setSaveFailed(true);
      })
      .finally(() => {
        // Per-call mutation callbacks may be dropped when a gate unmounts this
        // child. A direct promise continuation always releases the outer guard.
        setCriticalOperationInFlight(false);
      });
  }

  if (captureSource.status === 'resolving') {
    return (
      <View
        accessibilityLabel={PHOTO_COPY.storage.loading}
        accessibilityLiveRegion="polite"
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG }}
      >
        <Text variant="bodySm" style={{ color: 'rgba(244,239,231,0.68)', textAlign: 'center' }}>
          {PHOTO_COPY.storage.loading}
        </Text>
      </View>
    );
  }

  if (captureSource.status === 'unavailable') {
    return (
      <View
        accessibilityLiveRegion="polite"
        style={{
          flex: 1,
          justifyContent: 'center',
          gap: 16,
          paddingHorizontal: 28,
          backgroundColor: BG,
        }}
      >
        <Text variant="title" style={{ color: '#F4EFE7', textAlign: 'center' }}>
          {PHOTO_COPY.storage.title}
        </Text>
        <Text variant="bodySm" style={{ color: 'rgba(244,239,231,0.68)', textAlign: 'center' }}>
          {PHOTO_COPY.storage.body}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setCaptureLookup({ captureSessionId, source: { status: 'resolving' } });
            setCaptureLookupRevision((revision) => revision + 1);
          }}
          style={{
            minHeight: 56,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 999,
            backgroundColor: '#F4EFE7',
          }}
        >
          <Text style={{ fontFamily: 'HankenGrotesk-SemiBold', fontSize: 16, color: BG }}>
            {PHOTO_COPY.storage.retry}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => backOrReplace(router, APP_PROGRESS_ROUTE)}
          style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: 'HankenGrotesk-SemiBold', fontSize: 15, color: '#F4EFE7' }}>
            {PHOTO_COPY.storage.exit}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (!hasCapturedPhoto) {
    return (
      <View
        style={{ flex: 1, backgroundColor: BG, paddingTop: insets.top + 16, paddingHorizontal: 24 }}
      >
        <RouteIconButton
          accessibilityLabel="Close"
          glyph="x"
          onPress={() => backOrReplace(router, APP_PROGRESS_ROUTE)}
          tone="night"
          style={{
            position: 'absolute',
            left: 24,
            top: insets.top + 8,
            zIndex: 5,
            backgroundColor: 'rgba(244,239,231,0.12)',
            borderColor: 'transparent',
          }}
        />

        <View style={{ flex: 1, justifyContent: 'center', gap: 14 }}>
          <Text variant="label" style={{ color: 'rgba(244,239,231,0.48)', textAlign: 'center' }}>
            {PHOTO_COPY.review.missingEyebrow}
          </Text>
          <Text
            style={{
              fontFamily: 'HankenGrotesk-SemiBold',
              fontSize: 24,
              lineHeight: 30,
              color: '#F4EFE7',
              textAlign: 'center',
            }}
          >
            {PHOTO_COPY.review.missingTitle}
          </Text>
          <Text
            style={{
              fontFamily: 'HankenGrotesk-Regular',
              fontSize: 15,
              lineHeight: 22,
              color: 'rgba(244,239,231,0.76)',
              textAlign: 'center',
            }}
          >
            {PHOTO_COPY.review.missingBody}
          </Text>
        </View>

        <View style={{ gap: 12, paddingBottom: insets.bottom + (compact ? 16 : 24) }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/progress/capture')}
            style={{
              height: 56,
              borderRadius: 999,
              backgroundColor: '#F4EFE7',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontFamily: 'HankenGrotesk-SemiBold', fontSize: 16, color: BG }}>
              {PHOTO_COPY.review.missingCapture}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => backOrReplace(router, APP_PROGRESS_ROUTE)}
            style={{
              height: 56,
              borderRadius: 999,
              backgroundColor: 'rgba(244,239,231,0.1)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontFamily: 'HankenGrotesk-SemiBold', fontSize: 16, color: '#F4EFE7' }}>
              {PHOTO_COPY.review.missingBack}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 16,
          paddingHorizontal: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          variant="label"
          style={{
            color: 'rgba(244,239,231,0.45)',
            textAlign: 'center',
            marginBottom: compact ? 12 : 18,
          }}
        >
          {`${PHOTO_COPY.review.eyebrow} · ${fmt(takenLocalDate)}`}
        </Text>

        {/* captured photo */}
        <View
          style={{
            height: photoHeight,
            borderRadius: 24,
            overflow: 'hidden',
            backgroundColor: '#2A251E',
          }}
        >
          <PhotoImage uri={capturedUri} style={{ flex: 1 }} contentFit="cover" />
          <View
            style={{
              position: 'absolute',
              left: 14,
              right: 14,
              bottom: 14,
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <Chip {...framingChip(analysis.framing)} />
            <Chip {...lightingChip(analysis.lighting)} />
          </View>
        </View>

        {/* calm quality note */}
        <View
          accessibilityLiveRegion="polite"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 11,
            marginVertical: compact ? 12 : 18,
            paddingVertical: compact ? 12 : 14,
            paddingHorizontal: 18,
            borderRadius: 16,
            backgroundColor: noteBackgroundColor,
          }}
        >
          <View
            style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: toneColor(noteTone) }}
          />
          <Text
            style={{
              flex: 1,
              fontFamily: 'HankenGrotesk-Regular',
              fontSize: 14,
              color: 'rgba(244,239,231,0.85)',
              lineHeight: 20,
            }}
          >
            {analysis.status === 'checking'
              ? PHOTO_COPY.review.checking
              : QUALITY_NOTE[verdict.flag]}
          </Text>
        </View>

        {saveFailed ? (
          <View
            accessibilityRole="alert"
            style={{
              borderRadius: 14,
              borderWidth: 1,
              borderColor: 'rgba(217,161,131,0.42)',
              backgroundColor: 'rgba(217,161,131,0.12)',
              paddingHorizontal: 14,
              paddingVertical: 10,
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                fontFamily: 'HankenGrotesk-SemiBold',
                fontSize: 13.5,
                color: '#F4EFE7',
              }}
            >
              {PHOTO_COPY.review.saveFailedTitle}
            </Text>
            <Text
              style={{
                fontFamily: 'HankenGrotesk-Regular',
                fontSize: 13,
                lineHeight: 18,
                color: 'rgba(244,239,231,0.78)',
                marginTop: 2,
              }}
            >
              {PHOTO_COPY.review.saveFailedBody}
            </Text>
          </View>
        ) : null}

        <View style={{ flex: 1 }} />

        <View
          style={{
            flexDirection: 'row',
            gap: 12,
            paddingBottom: insets.bottom + (compact ? 16 : 24),
          }}
        >
          <Pressable
            accessibilityRole="button"
            disabled={add.isPending || cleanupInFlight}
            onPress={() => {
              if (saveInFlightRef.current) return;
              discardAndNavigate(() => router.replace('/progress/capture'));
            }}
            style={{
              flex: 1,
              height: 56,
              borderRadius: 999,
              backgroundColor: 'rgba(244,239,231,0.1)',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: add.isPending ? 0.6 : 1,
            }}
          >
            <Text style={{ fontFamily: 'HankenGrotesk-SemiBold', fontSize: 16, color: '#F4EFE7' }}>
              {PHOTO_COPY.review.retake}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={add.isPending || cleanupInFlight}
            onPress={save}
            style={{
              flex: 1.4,
              height: 56,
              borderRadius: 999,
              backgroundColor: '#F4EFE7',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: add.isPending ? 0.6 : 1,
            }}
          >
            <Text style={{ fontFamily: 'HankenGrotesk-SemiBold', fontSize: 16, color: BG }}>
              {PHOTO_COPY.review.save}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
      <RouteIconButton
        accessibilityLabel="Close"
        disabled={add.isPending || cleanupInFlight}
        glyph="x"
        onPress={closeToProgress}
        tone="night"
        style={{
          position: 'absolute',
          left: 24,
          top: insets.top + 8,
          zIndex: 5,
          backgroundColor: 'rgba(244,239,231,0.12)',
          borderColor: 'transparent',
        }}
      />
    </View>
  );
}

export default function ReviewScreen() {
  const navigation = useNavigation();
  const ownerScope = useOwnerQueryScope();
  const reduceMotion = useReduceMotionPreference();
  const params = useLocalSearchParams<{ captureSessionId?: string }>();
  const captureSessionId = isNonBlank(params.captureSessionId ?? null)
    ? params.captureSessionId!
    : null;
  const [cleanupFailed, setCleanupFailed] = useState(false);
  const [cleanupInFlight, setCleanupInFlight] = useState(false);
  const cleanupInFlightRef = useRef(false);
  const criticalOperationInFlightRef = useRef(false);
  const pendingActionRef = useRef<Parameters<typeof navigation.dispatch>[0] | null>(null);

  const attemptRemoval = (action: Parameters<typeof navigation.dispatch>[0]) => {
    pendingActionRef.current = action;
    if (criticalOperationInFlightRef.current || cleanupInFlightRef.current) return;
    cleanupInFlightRef.current = true;
    setCleanupFailed(false);
    setCleanupInFlight(true);
    void runOwnerQueryOperation(ownerScope, async (lease) => {
      const handle = captureSessionId ? await resolveCapturedPhoto(captureSessionId) : null;
      if (handle) await cleanupCapturedPhoto(handle);
      lease.assertCurrent();
    })
      .then(() => {
        if (!isOwnerQueryScopeCurrent(ownerScope)) return;
        setCleanupFailed(false);
        navigation.dispatch(action);
      })
      .catch(() => {
        if (isOwnerQueryScopeCurrent(ownerScope)) setCleanupFailed(true);
      })
      .finally(() => {
        cleanupInFlightRef.current = false;
        if (isOwnerQueryScopeCurrent(ownerScope)) setCleanupInFlight(false);
      });
  };

  // This guard deliberately lives outside every conditional storage, lock,
  // subscription, and analysis gate so those gates cannot unmount the cleanup
  // owner while the review route (and its journaled plaintext) still exists.
  usePreventRemove(Boolean(captureSessionId), ({ data: { action } }) => {
    attemptRemoval(action);
  });

  const retryCleanup = () => {
    const pendingAction = pendingActionRef.current;
    if (pendingAction) attemptRemoval(pendingAction);
  };

  return (
    <>
      <ProGate feature="photo_timeline">
        <PhotoTimelineLockGate>
          <ProgressPhotoRouteSource onExit={() => router.replace(APP_PROGRESS_ROUTE)}>
            {(photos) => (
              <CaptureAnalysisProvider>
                <ReviewScreenContent
                  cleanupInFlight={cleanupInFlight}
                  photos={photos}
                  setCriticalOperationInFlight={(inFlight) => {
                    criticalOperationInFlightRef.current = inFlight;
                  }}
                />
              </CaptureAnalysisProvider>
            )}
          </ProgressPhotoRouteSource>
        </PhotoTimelineLockGate>
      </ProGate>
      <Modal
        animationType={motionAwareModalAnimation(reduceMotion, 'fade')}
        onRequestClose={retryCleanup}
        transparent
        visible={cleanupFailed}
      >
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(22,19,15,0.82)',
            paddingHorizontal: 28,
          }}
        >
          <View
            accessibilityRole="alert"
            style={{
              width: '100%',
              maxWidth: 420,
              gap: 12,
              borderRadius: 20,
              backgroundColor: '#F4EFE7',
              padding: 22,
            }}
          >
            <Text variant="title" style={{ color: BG, textAlign: 'center' }}>
              Photo cleanup needs another try
            </Text>
            <Text variant="bodySm" style={{ color: '#625B52', textAlign: 'center' }}>
              OnSkin kept this screen open so the temporary photo is not left behind.
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={cleanupInFlight}
              onPress={retryCleanup}
              style={{
                minHeight: 52,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 999,
                backgroundColor: BG,
                opacity: cleanupInFlight ? 0.6 : 1,
              }}
            >
              <Text style={{ color: '#F4EFE7', fontFamily: 'HankenGrotesk-SemiBold' }}>
                {cleanupInFlight ? 'Clearing photo…' : 'Try again'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
