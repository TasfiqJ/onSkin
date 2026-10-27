import { useCallback, useState, type RefObject } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { Text } from '@/components/ui';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

import {
  COMPARE_DIVIDER_DEFAULT_PERCENT,
  compareDividerValueText,
  moveCompareDividerPercent,
  normalizeCompareDividerPercent,
} from './compareAccessibility';
import { PhotoImage } from './PhotoImage';

// Before/after comparison (docs/06 §4, design screen 04). A draggable vertical
// divider wipes between the two photos; the side-by-side mode (the accessible
// default, docs/06 §4) places them adjacent. NO numbers, no "improvement %". Just
// the two photos and their dates. expo-image renders each encrypted on-device file;
// missing or unreadable bytes have explicit recovery copy, never a fabricated preview.

export type ComparePhoto = {
  id: string;
  uri: string | null;
  date: string;
  tone: string;
  captureSessionId?: string | null;
};
const HANDLE_SHADOW =
  Platform.OS === 'web'
    ? { boxShadow: '0 3px 12px rgba(0, 0, 0, 0.28)' }
    : {
        shadowColor: '#000',
        shadowOpacity: 0.28,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
      };

function Panel({ photo, active }: { photo: ComparePhoto; active: boolean }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const ready = useCallback(() => setStatus('ready'), []);
  const failed = useCallback(() => setStatus('error'), []);
  if (!photo.uri || status === 'error') {
    return (
      <View style={{ flex: 1, backgroundColor: photo.tone, justifyContent: 'center', padding: 12 }}>
        <Text variant="bodySm">{photo.uri ? 'Cannot read photo.' : 'No image bytes.'}</Text>
        {photo.uri ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Try reading ${photo.date} photo again`}
            onPress={() => {
              setStatus('loading');
              setAttempt((value) => value + 1);
            }}
            style={{ minHeight: 48, paddingVertical: 12 }}
          >
            <Text variant="bodySm">Try image again</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <PhotoImage
        key={attempt}
        uri={photo.uri}
        photoId={photo.id}
        captureSessionId={photo.captureSessionId}
        rendition="display"
        requestPriority="interactive"
        active={active}
        style={{ flex: 1 }}
        contentFit="contain"
        fallbackTone={photo.tone}
        onDisplayReady={ready}
        onDisplayError={failed}
        accessible
        accessibilityLabel={`Photo captured ${photo.date}`}
      />
      {!active || status !== 'ready' ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: photo.tone,
            justifyContent: 'center',
            padding: 12,
          }}
        >
          <Text variant="bodySm">
            {active ? 'Opening photo…' : 'Preview paused while choosing.'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function DateChip({
  date,
  label,
  onPress,
  trigger,
}: {
  date: string;
  label: string;
  onPress?: () => void;
  trigger?: RefObject<View | null>;
}) {
  return (
    <Pressable
      ref={trigger}
      accessibilityRole="button"
      accessibilityLabel={`Change ${label.toLowerCase()} photo (currently ${date})`}
      onPress={onPress}
      className="min-h-[48px] min-w-[72px] items-center justify-center rounded-pill px-3.5 py-2"
      style={{
        backgroundColor: colors.paperRaised,
        borderWidth: 1,
        borderColor: colors.hairlineStrong,
      }}
    >
      <Text variant="bodySm">
        {label} · {date} · Change photo
      </Text>
    </Pressable>
  );
}

export function CompareSlider({
  before,
  after,
  sideBySide,
  active = true,
  onPickBefore,
  onPickAfter,
  beforeLabel = 'Before',
  afterLabel = 'After',
  beforeTrigger,
  afterTrigger,
}: {
  before: ComparePhoto;
  after: ComparePhoto;
  sideBySide: boolean;
  active?: boolean;
  onPickBefore?: () => void;
  onPickAfter?: () => void;
  beforeLabel?: string;
  afterLabel?: string;
  beforeTrigger?: RefObject<View | null>;
  afterTrigger?: RefObject<View | null>;
}) {
  const [w, setW] = useState(0);
  const [dividerPercent, setDividerPercent] = useState(COMPARE_DIVIDER_DEFAULT_PERCENT);
  const x = useSharedValue(0);
  const start = useSharedValue(0);
  const wsv = useSharedValue(0);

  function onLayout(width: number) {
    setW(width);
    wsv.value = width;
    x.value = width * (dividerPercent / 100);
  }

  function publishGesturePosition(value: number) {
    setDividerPercent(normalizeCompareDividerPercent(value));
  }

  function adjustDivider(actionName: string) {
    const next = moveCompareDividerPercent(dividerPercent, actionName);
    if (next === dividerPercent) return;
    setDividerPercent(next);
    x.value = wsv.value * (next / 100);
  }

  const pan = Gesture.Pan()
    .onBegin(() => {
      start.value = x.value;
    })
    .onChange((e) => {
      const next = start.value + e.translationX;
      x.value = Math.max(0, Math.min(wsv.value, next));
    })
    .onEnd(() => {
      const width = wsv.value;
      if (width > 0) runOnJS(publishGesturePosition)((x.value / width) * 100);
      // a gentle endpoint tick (docs/06 §4 haptics)
      if (x.value <= 2 || x.value >= wsv.value - 2) runOnJS(haptics.select)();
    });

  // "before" clipped to the left [0..x]; "after" is the full base on the right.
  const beforeClip = useAnimatedStyle(() => ({ width: x.value }));
  const dividerStyle = useAnimatedStyle(() => ({ left: x.value - 1.25 }));
  const handleStyle = useAnimatedStyle(() => ({ left: x.value - 24 }));

  if (before.id === after.id)
    return <Text variant="bodySm">Choose two different photo records.</Text>;
  const controls = (
    <View className="mb-3 gap-2">
      <DateChip
        date={before.date}
        label={beforeLabel}
        onPress={onPickBefore}
        trigger={beforeTrigger}
      />
      <DateChip date={after.date} label={afterLabel} onPress={onPickAfter} trigger={afterTrigger} />
    </View>
  );
  if (sideBySide) {
    return (
      <View onLayout={(event) => onLayout(Math.max(0, event.nativeEvent.layout.width - 2))}>
        {controls}
        <View className="flex-row gap-2">
          {[before, after].map((photo, index) => (
            <View
              key={`${index}:${photo.id}:${photo.uri}:${active}`}
              className="flex-1 overflow-hidden rounded-card"
              style={{ height: 300, borderWidth: 1, borderColor: colors.hairline }}
            >
              <Panel photo={photo} active={active} />
            </View>
          ))}
        </View>
        <Text variant="bodySm" className="mt-3">
          If an image cannot open, use its date control to choose another photo.
        </Text>
      </View>
    );
  }

  return (
    <View onLayout={(event) => onLayout(Math.max(0, event.nativeEvent.layout.width - 2))}>
      {controls}
      <View
        className="overflow-hidden rounded-card"
        style={{ height: 368, borderWidth: 1, borderColor: colors.hairline }}
      >
        <GestureDetector gesture={pan}>
          <View style={{ flex: 1 }}>
            {/* base = after (right side) */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
              <Panel key={`${after.id}:${after.uri}:${active}`} photo={after} active={active} />
            </View>
            {/* before clipped to the left */}
            <Animated.View
              style={[
                { position: 'absolute', top: 0, bottom: 0, left: 0, overflow: 'hidden' },
                beforeClip,
              ]}
            >
              <View style={{ width: w, height: '100%' }}>
                <Panel
                  key={`${before.id}:${before.uri}:${active}`}
                  photo={before}
                  active={active}
                />
              </View>
            </Animated.View>
            {/* divider */}
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: 2.5,
                  backgroundColor: colors.paper,
                },
                dividerStyle,
              ]}
            />
            {/* handle */}
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: '50%',
                  marginTop: -24,
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: colors.paper,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 5,
                  ...HANDLE_SHADOW,
                },
                handleStyle,
              ]}
            >
              <View
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel={`${beforeLabel} ${before.date} and ${afterLabel.toLowerCase()} ${after.date} image divider`}
                accessibilityHint="Swipe up or down to move the divider. Use Side by side for a non-gesture view."
                accessibilityValue={{
                  min: 0,
                  max: 100,
                  now: dividerPercent,
                  text: compareDividerValueText(dividerPercent, beforeLabel.toLowerCase()),
                }}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={dividerPercent}
                aria-valuetext={compareDividerValueText(dividerPercent, beforeLabel.toLowerCase())}
                accessibilityActions={[
                  {
                    name: 'decrement',
                    label: `Show less of the ${beforeLabel.toLowerCase()} photo`,
                  },
                  {
                    name: 'increment',
                    label: `Show more of the ${beforeLabel.toLowerCase()} photo`,
                  },
                ]}
                onAccessibilityAction={(event) => adjustDivider(event.nativeEvent.actionName)}
                style={{
                  width: '100%',
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 5,
                }}
              >
                <Text style={{ color: colors.ink, fontSize: 13 }}>‹</Text>
                <Text style={{ color: colors.ink, fontSize: 13 }}>›</Text>
              </View>
            </Animated.View>
          </View>
        </GestureDetector>
      </View>
      <Text variant="bodySm" className="mt-3">
        {compareDividerValueText(dividerPercent, beforeLabel.toLowerCase())}. This describes image
        visibility only.
      </Text>
      <View className="mt-2 gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show less of the first image"
          onPress={() => adjustDivider('decrement')}
          style={{ minHeight: 48, justifyContent: 'center', padding: 12 }}
        >
          <Text variant="bodySm">Show less of the first image</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show more of the first image"
          onPress={() => adjustDivider('increment')}
          style={{ minHeight: 48, justifyContent: 'center', padding: 12 }}
        >
          <Text variant="bodySm">Show more of the first image</Text>
        </Pressable>
      </View>
    </View>
  );
}
