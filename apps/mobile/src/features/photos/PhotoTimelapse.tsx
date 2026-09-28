import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import {
  AppState,
  Modal,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RouteIconButton, Text } from '@/components/ui';
import { useReduceMotionPreference } from '@/lib/accessibility/useReduceMotionPreference';
import { colors } from '@/theme/tokens';

import { PhotoImage } from './PhotoImage';
import { focusTimelapseElementAfterLayout } from './timelapseFocus';
import { parseLocalDate } from './timeline';
import {
  TIMELAPSE_FRAME_DURATION_MS,
  timelapseFrameSignature,
  timelapseProgress,
  type TimelapseFrame,
} from './timelapse';
import {
  createTimelapsePlaybackState,
  timelapsePlaybackReducer,
} from './timelapsePlayback';

const PLAYER_BACKGROUND = '#16130F';

function frameDate(ymd: string): string {
  return parseLocalDate(ymd).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function PlaybackButton({
  accessibilityLabel,
  disabled = false,
  glyph,
  primary = false,
  onPress,
}: {
  accessibilityLabel: string;
  disabled?: boolean;
  glyph: string;
  primary?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={
        primary
          ? 'h-14 w-14 items-center justify-center rounded-full'
          : 'h-12 w-12 items-center justify-center rounded-full'
      }
      style={{
        backgroundColor: primary ? colors.cream : 'rgba(244,239,231,0.1)',
        borderWidth: primary ? 0 : 1,
        borderColor: colors.hairlineDark,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text
        style={{
          color: primary ? colors.ink : colors.cream,
          fontSize: primary ? 19 : 18,
          lineHeight: 22,
        }}
      >
        {glyph}
      </Text>
    </Pressable>
  );
}

export function PhotoTimelapse({
  frames,
  onClose,
}: {
  frames: TimelapseFrame[];
  onClose: () => void;
}) {
  const { fontScale, height, width } = useWindowDimensions();
  const frameCount = frames.length;
  const frameSignature = useMemo(() => timelapseFrameSignature(frames), [frames]);
  const reduceMotion = useReduceMotionPreference();
  const [playback, dispatch] = useReducer(
    timelapsePlaybackReducer,
    undefined,
    () =>
      createTimelapsePlaybackState(
        frameCount,
        AppState.currentState === 'active',
        frameSignature,
      ),
  );
  const headingRef = useRef<View>(null);
  const safeIndex = playback.index;
  const current = frames[safeIndex] ?? null;
  const atStart = safeIndex === 0;
  const atEnd = safeIndex >= frameCount - 1;
  const pressureChrome = fontScale >= 1.5 ? 340 : 270;
  const imageHeight = Math.max(180, Math.min(height - pressureChrome, (width - 32) * (4 / 3), 540));
  const imageWidth = Math.min(width - 32, imageHeight * (3 / 4), 430);
  const progress = timelapseProgress(safeIndex, frameCount);

  useEffect(
    () => dispatch({ type: 'frames-changed', frameCount, frameSignature }),
    [frameCount, frameSignature],
  );

  useEffect(() => dispatch({ type: 'motion', reduceMotion }), [reduceMotion]);

  useEffect(() => {
    return focusTimelapseElementAfterLayout(() => headingRef.current);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      dispatch({ type: 'app-state', active: state === 'active' });
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!playback.playing || playback.frameStatus !== 'ready' || atEnd) return;
    const timer = setTimeout(() => {
      dispatch({ type: 'timer-elapsed' });
    }, TIMELAPSE_FRAME_DURATION_MS);
    return () => clearTimeout(timer);
  }, [atEnd, playback.frameStatus, playback.playing, safeIndex]);

  const frameReady = useCallback(
    () =>
      dispatch({ type: 'frame-ready', index: safeIndex, revision: playback.frameRevision }),
    [playback.frameRevision, safeIndex],
  );
  const frameError = useCallback(
    () =>
      dispatch({ type: 'frame-error', index: safeIndex, revision: playback.frameRevision }),
    [playback.frameRevision, safeIndex],
  );

  function previous() {
    dispatch({ type: 'previous' });
  }

  function next() {
    dispatch({ type: 'next' });
  }

  function togglePlayback() {
    dispatch({ type: 'toggle' });
  }

  function close() {
    if (playback.playing) dispatch({ type: 'toggle' });
    onClose();
  }

  function retryFrame() {
    dispatch({ type: 'retry-frame' });
  }

  function adjustFrame(actionName: string) {
    if (actionName === 'increment') next();
    if (actionName === 'decrement') previous();
  }

  const playbackLabel =
    playback.frameStatus === 'error'
      ? 'Retry this photo before playing the time-lapse'
      : atEnd
        ? 'Replay time-lapse'
        : playback.playing
          ? 'Pause time-lapse'
          : 'Play time-lapse';
  const playbackGlyph = atEnd ? '↺' : playback.playing ? 'Ⅱ' : '▶';

  return (
    <Modal
      visible
      animationType="none"
      presentationStyle="fullScreen"
      accessibilityLabel="Quiet photo time-lapse"
      onRequestClose={close}
    >
      <SafeAreaView className="flex-1" style={{ backgroundColor: PLAYER_BACKGROUND }}>
        <ScrollView
          accessibilityViewIsModal
          onAccessibilityEscape={close}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingBottom: 16 }}
        >
          <View className="flex-row items-center gap-3 py-2">
            <RouteIconButton
              accessibilityLabel="Close time-lapse"
              glyph="×"
              tone="night"
              onPress={close}
            />
            <View
              ref={headingRef}
              accessible
              accessibilityRole="header"
              accessibilityLabel="Quiet time-lapse. Your photos, oldest to newest."
              className="flex-1"
            >
              <Text accessible={false} variant="titleSm" tone="inverse">
                Quiet time-lapse
              </Text>
              <Text accessible={false} variant="bodySm" tone="inverseMuted">
                Your photos, oldest to newest
              </Text>
            </View>
          </View>

          <View className="flex-1 items-center justify-center">
            {current ? (
              <View
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel="Time-lapse photo"
                accessibilityValue={{
                  min: 1,
                  max: frameCount,
                  now: safeIndex + 1,
                  text: frameDate(current.takenLocalDate),
                }}
                accessibilityActions={[
                  { name: 'decrement', label: 'Previous photo' },
                  { name: 'increment', label: 'Next photo' },
                ]}
                onAccessibilityAction={(event) => adjustFrame(event.nativeEvent.actionName)}
                className="overflow-hidden rounded-card"
                style={{
                  width: imageWidth,
                  height: imageHeight,
                  borderWidth: 1,
                  borderColor: colors.hairlineDark,
                  backgroundColor: colors.nightSurface,
                }}
              >
                <PhotoImage
                  key={`${current.id}:${playback.frameRevision}`}
                  uri={current.localUri}
                  photoId={current.id}
                  captureSessionId={current.captureSessionId}
                  rendition="display"
                  requestPriority="interactive"
                  accessible={false}
                  contentFit="contain"
                  fallbackTone={colors.nightSurface}
                  style={{ flex: 1 }}
                  onDisplayReady={frameReady}
                  onDisplayError={frameError}
                />
                <View
                  className="absolute bottom-3 left-3 rounded-pill px-3 py-2"
                  style={{ backgroundColor: 'rgba(22,19,15,0.82)' }}
                >
                  <Text variant="label" tone="inverse">
                    {frameDate(current.takenLocalDate)}
                  </Text>
                </View>
              </View>
            ) : (
              <Text variant="body" tone="inverseMuted">
                No local photo frames are available.
              </Text>
            )}

            <View
              className="mt-3 h-1.5 overflow-hidden rounded-full"
              style={{ width: imageWidth, backgroundColor: 'rgba(244,239,231,0.14)' }}
            >
              <View
                className="h-full rounded-full"
                style={{ width: `${progress * 100}%`, backgroundColor: colors.clayBright }}
              />
            </View>
            <Text variant="label" tone="inverseMuted" className="mt-2">
              {frameCount > 0 ? `${safeIndex + 1} of ${frameCount}` : '0 of 0'}
            </Text>
          </View>

          {playback.frameStatus === 'error' ? (
            <View accessibilityRole="alert" className="mb-3 items-center gap-2">
              <Text variant="bodySm" tone="inverseMuted" className="text-center">
                This photo couldn&apos;t be displayed. It stays encrypted on this phone.
              </Text>
              <PlaybackButton
                accessibilityLabel="Retry displaying this photo"
                glyph="↻"
                onPress={retryFrame}
              />
            </View>
          ) : null}

          {reduceMotion ? (
            <Text
              accessibilityRole="alert"
              variant="bodySm"
              tone="inverseMuted"
              className="mb-3 text-center"
            >
              Reduced motion is on. Review each photo with the previous and next controls.
            </Text>
          ) : null}

          <View className="flex-row items-center justify-center gap-6">
            <PlaybackButton
              accessibilityLabel="Previous photo"
              disabled={atStart || frameCount < 2}
              glyph="‹"
              onPress={previous}
            />
            {reduceMotion === false ? (
              <PlaybackButton
                accessibilityLabel={playbackLabel}
                disabled={frameCount < 2 || playback.frameStatus === 'error'}
                glyph={playbackGlyph}
                primary
                onPress={togglePlayback}
              />
            ) : null}
            <PlaybackButton
              accessibilityLabel="Next photo"
              disabled={atEnd || frameCount < 2}
              glyph="›"
              onPress={next}
            />
          </View>
          <Text variant="bodySm" tone="inverseMuted" className="mt-3 text-center">
            On this phone only. No scores or automatic judgments.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
