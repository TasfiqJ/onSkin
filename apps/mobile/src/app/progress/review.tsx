import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove, type NavigationAction } from 'expo-router/react-navigation';
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RouteIconButton, Text } from '@/components/ui';
import { CaptureAnalysisProvider } from '@/features/photos/CaptureAnalysisProvider';
import { PHOTO_COPY, QUALITY_NOTE } from '@/features/photos/copy';
import {
  createCaptureAnalysisCoordinator,
  type CaptureAnalysisCoordinator,
} from '@/features/photos/captureAnalysisCoordinator';
import { localDay } from '@/features/photos/date';
import { PhotoStorageGate } from '@/features/photos/PhotoStorageGate';
import { PhotoTimelineLockGate } from '@/features/photos/PhotoTimelineLockGate';
import type { FramingAssessment, LightingAssessment } from '@/features/photos/captureAnalysis';
import {
  createProgressCaptureReviewLifecycle,
  trustedExpoCameraCaptureUri,
  trustedProgressCaptureLocalDate,
  trustedProgressCaptureSessionId,
  trustedProgressCaptureTimeOfDay,
  type ProgressCaptureSource,
} from '@/features/photos/progressCapturePrivacy';
import { retainProgressReviewCleanup } from '@/features/photos/progressCaptureReviewCleanup';
import { reviewQuality } from '@/features/photos/quality';
import { parseLocalDate } from '@/features/photos/timeline';
import { useCaptureAnalysis } from '@/features/photos/useCaptureAnalysis';
import { usePhotoActions, usePhotos } from '@/features/photos/usePhotos';
import { ProGate } from '@/features/subscription/ProGate';
import { track } from '@/lib/analytics/track';
import { APP_PROGRESS_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import type { TimeOfDay } from '@layerwell/types';

// Review & retake (docs/06 §2, design screen 02). Quality is FLAGGED, never blocked
// (D-029). The calm note compares to the series reference, and Save always works.

const BG = '#16130F';
const SAGE = '#9DB18A';
const MAX_E2E_DATA_URI_LENGTH = 256_000;

type ReviewRouteParams = {
  analysisFixture?: string;
  captureSessionId?: string;
  capturedUri?: string;
  photoWidth?: string;
  photoHeight?: string;
  timeOfDay?: string;
  takenLocalDate?: string;
};

type ProtectedReviewNavigation =
  | Readonly<{ kind: 'action'; action: NavigationAction }>
  | Readonly<{ kind: 'progress' }>
  | Readonly<{ kind: 'retake' }>;

type SaveCaptureResult = 'navigating' | 'save_failed' | 'cleanup_failed' | 'busy';

type ReviewCaptureBoundaryState = Readonly<{
  actionBusy: boolean;
  analysisCoordinator: CaptureAnalysisCoordinator;
  captureSessionId: string | null;
  capturePersisted: boolean;
  capturedUri: string | null;
  cleanupFailed: boolean;
  takenLocalDate: string;
  timeOfDay: TimeOfDay | null;
  discardAndNavigate: (target: 'progress' | 'retake') => Promise<void>;
  saveCapture: (
    persist: (uri: string) => Promise<void>,
    onPersisted: () => void,
  ) => Promise<SaveCaptureResult>;
}>;

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

function positiveNumber(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 20_000 ? parsed : null;
}

function devProgressReviewFixtureUri(value: unknown, fixtureName: unknown): string | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__ || Platform.OS !== 'web') return null;
  if (process.env.EXPO_PUBLIC_E2E_PROGRESS_CAPTURE_ANALYSIS !== 'enabled') return null;
  if (
    fixtureName !== 'matched' &&
    fixtureName !== 'adjust' &&
    fixtureName !== 'no_face' &&
    fixtureName !== 'unavailable'
  ) {
    return null;
  }
  if (
    typeof value !== 'string' ||
    value.length > MAX_E2E_DATA_URI_LENGTH ||
    !/^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/u.test(value)
  ) {
    return null;
  }
  return value;
}

function progressCaptureSource(params: ReviewRouteParams): ProgressCaptureSource | null {
  const nativeUri = trustedExpoCameraCaptureUri(params.capturedUri, FileSystem.cacheDirectory);
  if (nativeUri !== null) return { uri: nativeUri, disposable: true };

  const fixtureUri = devProgressReviewFixtureUri(params.capturedUri, params.analysisFixture);
  return fixtureUri === null ? null : { uri: fixtureUri, disposable: false };
}

function ReviewScreenContent({
  params,
  boundary,
}: {
  params: ReviewRouteParams;
  boundary: ReviewCaptureBoundaryState;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const compact = height < 700;
  const photoHeight = compact ? Math.max(286, Math.min(330, Math.round(height * 0.54))) : 380;
  const {
    actionBusy,
    analysisCoordinator,
    captureSessionId,
    capturePersisted,
    capturedUri,
    cleanupFailed,
    discardAndNavigate,
    saveCapture,
    takenLocalDate,
    timeOfDay,
  } = boundary;
  const hasCapturedPhoto = isNonBlank(capturedUri);
  const analysis = useCaptureAnalysis({
    uri: hasCapturedPhoto ? capturedUri : null,
    width: positiveNumber(params.photoWidth),
    height: positiveNumber(params.photoHeight),
    fixtureName: params.analysisFixture,
    coordinator: analysisCoordinator,
  });

  const { data } = usePhotos('front');
  const { add } = usePhotoActions();
  const [saveFailed, setSaveFailed] = useState(false);
  const verdict = reviewQuality({
    framing: analysis.framing,
    lighting: analysis.lighting,
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
  async function save() {
    if (!hasCapturedPhoto || add.isPending || actionBusy) return;

    setSaveFailed(false);
    const wasEmpty = (data?.count ?? 0) === 0;
    let createdNow = false;
    const result = await saveCapture(
      async (trustedUri) => {
        const outcome = await add.mutateAsync({
          takenLocalDate,
          timeOfDay,
          alignmentScore: analysis.framing.score,
          lightingScore: analysis.lighting.score,
          headRoll: analysis.framing.headRoll,
          headYaw: analysis.framing.headYaw,
          headPitch: analysis.framing.headPitch,
          qualitySource,
          captureSessionId,
          localUri: trustedUri,
        });
        createdNow = outcome.createdNow;
      },
      () => {
        if (!createdNow) return;
        try {
          track('photo_captured', { on_device: true });
          if (wasEmpty) {
            track('first_photo_captured');
            track('photo_baseline_added', { on_device: true });
          }
        } catch {
          // Telemetry cannot roll back a committed local photo.
        }
      },
    );
    if (result === 'save_failed') setSaveFailed(true);
  }

  if (!hasCapturedPhoto) {
    return (
      <View
        style={{ flex: 1, backgroundColor: BG, paddingTop: insets.top + 16, paddingHorizontal: 24 }}
      >
        <RouteIconButton
          accessibilityLabel="Close"
          glyph="x"
          onPress={() => void discardAndNavigate('progress')}
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
            onPress={() => void discardAndNavigate('retake')}
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
            onPress={() => void discardAndNavigate('progress')}
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
          <Image
            source={{ uri: capturedUri }}
            style={{ flex: 1 }}
            contentFit="cover"
            cachePolicy="none"
          />
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

        {cleanupFailed ? (
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
              Temporary photo cleanup needs another try
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
              {capturePersisted
                ? 'Your encrypted photo is safe on this phone, but the temporary camera copy could not be removed yet. Try finishing cleanup again.'
                : 'The photo has not been uploaded, but its temporary local copy could not be removed yet. Try the action again to finish cleanup.'}
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
            disabled={add.isPending || actionBusy}
            onPress={() => void discardAndNavigate('retake')}
            style={{
              flex: 1,
              height: 56,
              borderRadius: 999,
              backgroundColor: 'rgba(244,239,231,0.1)',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: add.isPending || actionBusy ? 0.6 : 1,
            }}
          >
            <Text style={{ fontFamily: 'HankenGrotesk-SemiBold', fontSize: 16, color: '#F4EFE7' }}>
              {capturePersisted ? 'Take another' : PHOTO_COPY.review.retake}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={add.isPending || actionBusy}
            onPress={() => void save()}
            style={{
              flex: 1.4,
              height: 56,
              borderRadius: 999,
              backgroundColor: '#F4EFE7',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: add.isPending || actionBusy ? 0.6 : 1,
            }}
          >
            <Text style={{ fontFamily: 'HankenGrotesk-SemiBold', fontSize: 16, color: BG }}>
              {capturePersisted && cleanupFailed ? 'Finish cleanup' : PHOTO_COPY.review.save}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
      <RouteIconButton
        accessibilityLabel="Close"
        disabled={add.isPending || actionBusy}
        glyph="x"
        onPress={() => void discardAndNavigate('progress')}
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
  const routeParams = useLocalSearchParams<ReviewRouteParams>();
  const [params] = useState<ReviewRouteParams>(() => routeParams);
  const [source] = useState<ProgressCaptureSource | null>(() => progressCaptureSource(params));
  const [captureMetadata] = useState(() => {
    const captureSessionId = source?.disposable
      ? trustedProgressCaptureSessionId(params.captureSessionId)
      : null;
    const timeOfDay = trustedProgressCaptureTimeOfDay(params.timeOfDay);
    const trustedTakenLocalDate = trustedProgressCaptureLocalDate(params.takenLocalDate);
    return {
      captureSessionId,
      nativeMetadataValid:
        source?.disposable !== true ||
        (captureSessionId !== null && timeOfDay !== null && trustedTakenLocalDate !== null),
      takenLocalDate: trustedTakenLocalDate ?? localDay(),
      timeOfDay,
    };
  });
  const [analysisCoordinator] = useState(() => createCaptureAnalysisCoordinator());
  const [lifecycle] = useState(() =>
    createProgressCaptureReviewLifecycle(FileSystem, source, analysisCoordinator),
  );
  const navigation = useNavigation();
  const mountedRef = useRef(false);
  const navigationInFlightRef = useRef(false);
  const pendingNavigationRef = useRef<ProtectedReviewNavigation | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [capturePersisted, setCapturePersisted] = useState(false);
  const [cleanupFailed, setCleanupFailed] = useState(false);
  const [routeRemovalReady, setRouteRemovalReady] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // A gate/account forced unmount has no route UI left to own retry. Move
      // the exact lifecycle into the process owner before attempting cleanup.
      void retainProgressReviewCleanup(lifecycle).catch(() => undefined);
    };
  }, [lifecycle]);

  const discardAndAuthorize = async (pending: ProtectedReviewNavigation): Promise<void> => {
    if (routeRemovalReady || navigationInFlightRef.current) return;
    navigationInFlightRef.current = true;
    setActionBusy(true);
    setCleanupFailed(false);
    try {
      await lifecycle.discard();
      if (!mountedRef.current) return;
      pendingNavigationRef.current = pending;
      setRouteRemovalReady(true);
    } catch {
      navigationInFlightRef.current = false;
      if (mountedRef.current) {
        setCapturePersisted(lifecycle.hasPersisted());
        setCleanupFailed(true);
        setActionBusy(false);
      }
    }
  };

  // The guard lives outside entitlement, lock, storage, and analysis gates so
  // every route exit owns the same raw-photo cleanup contract.
  usePreventRemove(source !== null && !routeRemovalReady, ({ data }) => {
    void discardAndAuthorize({ kind: 'action', action: data.action });
  });

  useEffect(() => {
    if (!routeRemovalReady) return;
    const pending = pendingNavigationRef.current;
    if (pending === null) return;
    pendingNavigationRef.current = null;
    if (pending.kind === 'action') {
      navigation.dispatch(pending.action);
    } else if (pending.kind === 'retake') {
      router.replace('/progress/capture');
    } else {
      backOrReplace(router, APP_PROGRESS_ROUTE);
    }
  }, [navigation, routeRemovalReady]);

  const boundary: ReviewCaptureBoundaryState = {
    actionBusy,
    analysisCoordinator,
    captureSessionId: captureMetadata.captureSessionId,
    capturePersisted,
    capturedUri: source !== null && captureMetadata.nativeMetadataValid ? source.uri : null,
    cleanupFailed,
    discardAndNavigate: (target) => discardAndAuthorize({ kind: target }),
    saveCapture: async (persist, onPersisted) => {
      if (navigationInFlightRef.current) return 'busy';
      navigationInFlightRef.current = true;
      setActionBusy(true);
      setCleanupFailed(false);
      try {
        await lifecycle.save(persist, () => {
          if (mountedRef.current) setCapturePersisted(true);
          onPersisted();
        });
        if (mountedRef.current) {
          pendingNavigationRef.current = { kind: 'progress' };
          setRouteRemovalReady(true);
        }
        return 'navigating';
      } catch {
        const persisted = lifecycle.hasPersisted();
        const cleanupPending = lifecycle.hasPendingCleanup();
        navigationInFlightRef.current = false;
        if (mountedRef.current) {
          setCapturePersisted(persisted);
          setCleanupFailed(cleanupPending);
          setActionBusy(false);
        }
        return cleanupPending ? 'cleanup_failed' : 'save_failed';
      }
    },
    takenLocalDate: captureMetadata.takenLocalDate,
    timeOfDay: captureMetadata.timeOfDay,
  };

  return (
    <ProGate feature="photo_timeline">
      <PhotoTimelineLockGate>
        <PhotoStorageGate onExit={() => router.replace(APP_PROGRESS_ROUTE)}>
          <CaptureAnalysisProvider>
            <ReviewScreenContent params={params} boundary={boundary} />
          </CaptureAnalysisProvider>
        </PhotoStorageGate>
      </PhotoTimelineLockGate>
    </ProGate>
  );
}
