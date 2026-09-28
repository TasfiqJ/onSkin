import { useEffect, useState } from 'react';
import {
  Animated,
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {
  BottomTabBar,
  type BottomTabBarProps,
  type BottomTabBarButtonProps,
} from 'expo-router/js-tabs';
import { PlatformPressable } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  shouldReduceMotion,
  useReduceMotionPreference,
} from '@/lib/accessibility/useReduceMotionPreference';
import { colors } from '@/theme/tokens';

const scrollListeners = new Set<(offset: number) => void>();

/** Scroll position only; never retains user content or changes list ownership. */
export function reportDockScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
  const offset = Math.max(0, event.nativeEvent.contentOffset.y);
  scrollListeners.forEach((listener) => listener(offset));
}

export function FloatingDock(props: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const reduced = shouldReduceMotion(useReduceMotionPreference());
  const [progress] = useState(() => new Animated.Value(0));
  const activeKey = props.state.routes[props.state.index].key;

  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    if (reduced) return;
    let previous = 0;
    let target = 0;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const settle = (next: number) => {
      if (next === target) return;
      target = next;
      Animated.timing(progress, {
        toValue: next,
        duration: next ? 180 : 260,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    };
    const onScroll = (offset: number) => {
      const delta = offset - previous;
      previous = offset;
      if (offset < 12 || delta < -4) settle(0);
      else if (delta > 4) settle(1);
      clearTimeout(idle);
      idle = setTimeout(() => settle(0), 240);
    };
    scrollListeners.add(onScroll);
    return () => {
      scrollListeners.delete(onScroll);
      clearTimeout(idle);
      progress.stopAnimation();
    };
  }, [activeKey, progress, reduced]);

  return (
    <Animated.View
      testID="floating-dock"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: Math.max(insets.bottom, 12) + 4,
        transform: [
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 4] }) },
          { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.99] }) },
        ],
      }}
    >
      <BottomTabBar {...props} />
    </Animated.View>
  );
}

export function DockButton({
  dark,
  style,
  onHoverIn,
  onHoverOut,
  onFocus,
  onBlur,
  onPressIn,
  onPressOut,
  onPress,
  ...props
}: BottomTabBarButtonProps & { dark: boolean }) {
  const reduced = shouldReduceMotion(useReduceMotionPreference());
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [activity] = useState(() => new Animated.Value(0));
  const selected = props['aria-selected'] === true;
  useEffect(() => {
    activity.stopAnimation();
    if (reduced) {
      activity.setValue(0);
      return;
    }
    const animation = Animated.spring(activity, {
      toValue: pressed ? -1 : hovered || focused ? 1 : selected ? 0.15 : 0,
      damping: 22,
      stiffness: 280,
      mass: 0.7,
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [activity, focused, hovered, pressed, reduced, selected]);
  return (
    <PlatformPressable
      {...props}
      pressOpacity={1}
      onPress={(event) => {
        // Mouse clicks do not need a persistent keyboard focus ring.
        if ('detail' in event.nativeEvent && event.nativeEvent.detail !== 0) setFocused(false);
        onPress?.(event);
      }}
      onHoverIn={(event) => {
        setHovered(true);
        onHoverIn?.(event);
      }}
      onHoverOut={(event) => {
        setHovered(false);
        onHoverOut?.(event);
      }}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      onPressIn={(event) => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      style={[
        style,
        {
          borderRadius: 24,
          backgroundColor:
            hovered || focused || pressed
              ? dark
                ? colors.nightElevated
                : colors.clayTint
              : 'transparent',
          borderWidth: 1,
          borderColor: focused ? (dark ? colors.clayBright : colors.clay) : 'transparent',
          transform: [
            {
              translateY: activity.interpolate({ inputRange: [-1, 0, 1], outputRange: [1, 0, -2] }),
            },
            {
              scale: activity.interpolate({
                inputRange: [-1, 0, 1],
                outputRange: [0.97, 1, 1.025],
              }),
            },
          ],
        },
      ]}
    />
  );
}
