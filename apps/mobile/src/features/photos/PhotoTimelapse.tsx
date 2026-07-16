import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  Modal,
  Pressable,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RouteIconButton, Text } from '@/components/ui';
import { colors } from '@/theme/tokens';

import { PhotoImage } from './PhotoImage';
import { parseLocalDate } from './timeline';
import {
  TIMELAPSE_FRAME_DURATION_MS,
  nextTimelapseIndex,
  previousTimelapseIndex,
  timelapseProgress,
  type TimelapseFrame,
} from './timelapse';

const PLAYER_BACKGROUND = '#16130F';

function frameDate(ymd: string): string {
  return parseLocalDate(ymd).toLocaleDateString('en-US', {
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
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const frameCount = frames.length;
  const safeIndex = Math.min(Math.max(index, 0), Math.max(frameCount - 1, 0));
  const current = frames[safeIndex] ?? null;
  const atStart = safeIndex === 0;
  const atEnd = safeIndex >= frameCount - 1;
  const pressureChrome = fontScale >= 1.5 ? 340 : 270;
  const imageHeight = Math.max(180, Math.min(height - pressureChrome, (width - 32) * (4 / 3), 540));
  const imageWidth = Math.min(width - 32, imageHeight * (3 / 4), 430);
  const progress = timelapseProgress(safeIndex, frameCount);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!mounted) return;
      setReduceMotion(enabled);
      setPlaying(!enabled && frameCount > 1);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReduceMotion(enabled);
      if (enabled) setPlaying(false);
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [frameCount]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') setPlaying(false);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!playing || reduceMotion !== false || atEnd) return;
    const timer = setTimeout(() => {
      const next = nextTimelapseIndex(safeIndex, frameCount);
      setIndex(next);
      if (next >= frameCount - 1) setPlaying(false);
    }, TIMELAPSE_FRAME_DURATION_MS);
    return () => clearTimeout(timer);
  }, [atEnd, frameCount, playing, reduceMotion, safeIndex]);

  function previous() {
    setPlaying(false);
    setIndex((currentIndex) => previousTimelapseIndex(currentIndex, frameCount));
  }

  function next() {
    setPlaying(false);
    setIndex((currentIndex) => nextTimelapseIndex(currentIndex, frameCount));
  }

  function togglePlayback() {
    if (reduceMotion !== false || frameCount < 2) return;
    if (atEnd) {
      setIndex(0);
      setPlaying(true);
      return;
    }
    setPlaying((currentPlaying) => !currentPlaying);
  }

  function close() {
    setPlaying(false);
    onClose();
  }

  function adjustFrame(actionName: string) {
    if (actionName === 'increment') next();
    if (actionName === 'decrement') previous();
  }

  const playbackLabel = atEnd
    ? 'Replay time-lapse'
    : playing
      ? 'Pause time-lapse'
      : 'Play time-lapse';
  const playbackGlyph = atEnd ? '↺' : playing ? 'Ⅱ' : '▶';

  return (
    <Modal
      visible
      animationType="none"
      presentationStyle="fullScreen"
      accessibilityLabel="Quiet photo time-lapse"
      onRequestClose={close}
    >
      <SafeAreaView className="flex-1" style={{ backgroundColor: PLAYER_BACKGROUND }}>
        <View accessibilityViewIsModal className="flex-1 px-4 pb-4">
          <View className="flex-row items-center gap-3 py-2">
            <RouteIconButton
              accessibilityLabel="Close time-lapse"
              glyph="×"
              tone="night"
              onPress={close}
            />
            <View className="flex-1">
              <Text variant="titleSm" tone="inverse" numberOfLines={2}>
                Quiet time-lapse
              </Text>
              <Text variant="bodySm" tone="inverseMuted" numberOfLines={2}>
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
                  key={current.id}
                  uri={current.localUri}
                  photoId={current.id}
                  rendition="display"
                  requestPriority="interactive"
                  accessible={false}
                  contentFit="contain"
                  fallbackTone={colors.nightSurface}
                  style={{ flex: 1 }}
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
                disabled={frameCount < 2}
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
        </View>
      </SafeAreaView>
    </Modal>
  );
}
