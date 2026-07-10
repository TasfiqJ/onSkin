import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { Text } from '@/components/ui';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

import { PhotoImage } from './PhotoImage';

// Before/after comparison (docs/06 §4, design screen 04). A draggable vertical
// divider wipes between the two photos; the side-by-side mode (the accessible
// default, docs/06 §4) places them adjacent. NO numbers, no "improvement %". Just
// the two photos and their dates. expo-image renders each encrypted on-device file;
// the flat fallback appears only when a legacy or damaged record has no usable bytes.

export type ComparePhoto = { uri: string | null; date: string; tone: string };
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

function Panel({ photo }: { photo: ComparePhoto }) {
  if (photo.uri) {
    return (
      <PhotoImage
        uri={photo.uri}
        style={{ flex: 1 }}
        contentFit="cover"
        fallbackTone={photo.tone}
      />
    );
  }
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: photo.tone,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="label" style={{ color: 'rgba(32,27,21,0.28)' }}>
        your photo
      </Text>
    </View>
  );
}

function DateChip({ date, dark, onPress }: { date: string; dark?: boolean; onPress?: () => void }) {
  const inner = (
    <View
      className="min-h-[48px] min-w-[72px] items-center justify-center rounded-pill px-3.5 py-2"
      style={{ backgroundColor: dark ? 'rgba(32,27,21,0.85)' : 'rgba(250,247,242,0.92)' }}
    >
      <Text variant="label" style={{ color: dark ? colors.cream : colors.ink, fontSize: 11.5 }}>
        {date}
      </Text>
    </View>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Change to a different date (currently ${date})`}
      onPress={onPress}
      className="min-h-[48px] min-w-[72px]"
    >
      {inner}
    </Pressable>
  ) : (
    inner
  );
}

export function CompareSlider({
  before,
  after,
  sideBySide,
  onPickBefore,
  onPickAfter,
}: {
  before: ComparePhoto;
  after: ComparePhoto;
  sideBySide: boolean;
  onPickBefore?: () => void;
  onPickAfter?: () => void;
}) {
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  const start = useSharedValue(0);
  const wsv = useSharedValue(0);

  function onLayout(width: number) {
    setW(width);
    wsv.value = width;
    if (x.value === 0) x.value = width * 0.52;
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
      // a gentle endpoint tick (docs/06 §4 haptics)
      if (x.value <= 2 || x.value >= wsv.value - 2) runOnJS(haptics.select)();
    });

  // "before" clipped to the left [0..x]; "after" is the full base on the right.
  const beforeClip = useAnimatedStyle(() => ({ width: x.value }));
  const dividerStyle = useAnimatedStyle(() => ({ left: x.value - 1.25 }));
  const handleStyle = useAnimatedStyle(() => ({ left: x.value - 23 }));

  if (sideBySide) {
    return (
      <View className="flex-row gap-2">
        {[before, after].map((p, i) => (
          <View
            key={i}
            className="flex-1 overflow-hidden rounded-card"
            style={{ height: 368, borderWidth: 1, borderColor: colors.hairline }}
          >
            <Panel photo={p} />
            <View className="absolute left-2.5 top-2.5">
              <DateChip
                date={p.date}
                dark={i === 1}
                onPress={i === 0 ? onPickBefore : onPickAfter}
              />
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View
      className="overflow-hidden rounded-card"
      style={{ height: 368, borderWidth: 1, borderColor: colors.hairline }}
      onLayout={(e) => onLayout(e.nativeEvent.layout.width)}
    >
      <GestureDetector gesture={pan}>
        <View style={{ flex: 1 }}>
          {/* base = after (right side) */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <Panel photo={after} />
          </View>
          {/* before clipped to the left */}
          <Animated.View
            style={[
              { position: 'absolute', top: 0, bottom: 0, left: 0, overflow: 'hidden' },
              beforeClip,
            ]}
          >
            <View style={{ width: w, height: '100%' }}>
              <Panel photo={before} />
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
            accessibilityRole="adjustable"
            accessibilityLabel="Drag to compare before and after"
            style={[
              {
                position: 'absolute',
                top: '50%',
                marginTop: -23,
                width: 46,
                height: 46,
                borderRadius: 23,
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
            <Text style={{ color: colors.ink, fontSize: 13 }}>‹</Text>
            <Text style={{ color: colors.ink, fontSize: 13 }}>›</Text>
          </Animated.View>
          {/* date chips. Tap to pick which two captures to compare (docs/06 §4) */}
          <View className="absolute left-3.5 top-3.5">
            <DateChip date={before.date} onPress={onPickBefore} />
          </View>
          <View className="absolute right-3.5 top-3.5">
            <DateChip date={after.date} dark onPress={onPickAfter} />
          </View>
          <View className="absolute bottom-3.5 left-3.5">
            <Text variant="label" tone="muted" style={{ fontSize: 10 }}>
              drag to wipe · tap a date to change
            </Text>
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}
