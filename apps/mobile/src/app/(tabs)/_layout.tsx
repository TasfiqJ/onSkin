import { router, Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { useEffect, useState } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BehaviouralTriggers } from '@/features/notifications/BehaviouralTriggers';
import { pendingLifecycleRoute } from '@/features/subscription/lifecycle';
import { colors } from '@/theme/tokens';

// On app entry, present the honest reverse-trial re-offer / graceful-downgrade once
// when Pro has lapsed (docs/08 §6/§13). Pure local check, offline-safe, fires once
// per expiry; gated taps surface the contextual upsell thereafter.
function useExpiryReoffer() {
  useEffect(() => {
    void pendingLifecycleRoute(new Date().toISOString()).then((route) => {
      if (route) router.push(route);
    });
  }, []);
}

type TabIconName = 'today' | 'progress' | 'shelf' | 'you';

const ICON_SIZE = 22;
const FLOATING_TAB_BAR_HEIGHT = 90;
const FLOATING_TAB_BAR_BOTTOM = Platform.select({ ios: 16, android: 12, default: 12 });
const FLOATING_TAB_BAR_CLEARANCE = FLOATING_TAB_BAR_HEIGHT + 36;
const FLOATING_TAB_BAR_GAP = 24;
const TAB_ICON_BY_ROUTE: Record<string, TabIconName> = {
  progress: 'progress',
  shelf: 'shelf',
  today: 'today',
  you: 'you',
};

const TAB_BAR_SHADOW = Platform.select({
  android: {
    elevation: 8,
  },
  ios: {
    shadowColor: colors.ink,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
  },
  web: {
    boxShadow: '0px 18px 35px rgba(32, 27, 21, 0.14)',
  } as ViewStyle,
  default: {},
}) as ViewStyle;

function IconPart({ style }: { style: StyleProp<ViewStyle> }) {
  return <View style={style} />;
}

function TodayIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconCanvas}>
      {[0, 1, 2, 3].map((index) => (
        <IconPart
          key={index}
          style={[
            styles.gridDot,
            {
              backgroundColor: color,
              left: index % 2 === 0 ? 4 : 13,
              top: index < 2 ? 4 : 13,
            },
          ]}
        />
      ))}
    </View>
  );
}

function ProgressIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconCanvas}>
      <IconPart
        style={[styles.progressBar, { backgroundColor: color, height: 8, left: 5, top: 10 }]}
      />
      <IconPart
        style={[styles.progressBar, { backgroundColor: color, height: 15, left: 11, top: 3 }]}
      />
      <IconPart
        style={[styles.progressBar, { backgroundColor: color, height: 11, left: 17, top: 7 }]}
      />
    </View>
  );
}

function ShelfIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconCanvas}>
      <IconPart style={[styles.shelfLine, { backgroundColor: color, top: 6 }]} />
      <IconPart style={[styles.shelfLine, { backgroundColor: color, top: 12 }]} />
      <IconPart style={[styles.shelfLine, { backgroundColor: color, top: 18 }]} />
      <IconPart style={[styles.shelfPost, { backgroundColor: color, left: 4 }]} />
      <IconPart style={[styles.shelfPost, { backgroundColor: color, right: 4 }]} />
    </View>
  );
}

function YouIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconCanvas}>
      <IconPart style={[styles.userHead, { borderColor: color }]} />
      <IconPart style={[styles.userShoulders, { borderColor: color }]} />
    </View>
  );
}

function TabBarIcon({ focused, name }: { focused: boolean; name: TabIconName }) {
  const iconColor = focused ? colors.clayDeep : colors.ink;
  const Icon =
    name === 'today'
      ? TodayIcon
      : name === 'progress'
        ? ProgressIcon
        : name === 'shelf'
          ? ShelfIcon
          : YouIcon;

  return (
    <View style={[styles.iconShell, focused ? styles.iconShellActive : null]}>
      <Icon color={iconColor} />
    </View>
  );
}

function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return visible;
}

function FloatingTabBar({ descriptors, insets, navigation, state }: BottomTabBarProps) {
  const keyboardVisible = useKeyboardVisible();
  const tabBarBottom = Math.max(insets.bottom, FLOATING_TAB_BAR_BOTTOM);

  if (keyboardVisible) {
    return null;
  }

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.floatingTabBar, { bottom: tabBarBottom }, TAB_BAR_SHADOW]}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title;
        const displayLabel = label ?? route.name;
        const iconName = TAB_ICON_BY_ROUTE[route.name] ?? 'today';
        const labelColor = focused ? colors.clayDeep : colors.ink;

        const onPress = () => {
          const event = navigation.emit({
            canPreventDefault: true,
            target: route.key,
            type: 'tabPress',
          });

          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            target: route.key,
            type: 'tabLongPress',
          });
        };

        return (
          <Pressable
            key={route.key}
            aria-selected={focused}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            hitSlop={4}
            onLongPress={onLongPress}
            onPress={onPress}
            style={({ pressed }) => [styles.tabItem, pressed ? styles.tabItemPressed : null]}
          >
            <TabBarIcon focused={focused} name={iconName} />
            <Text
              adjustsFontSizeToFit
              maxFontSizeMultiplier={1.08}
              minimumFontScale={0.88}
              numberOfLines={1}
              style={[styles.tabLabel, focused ? styles.tabLabelActive : null, { color: labelColor }]}
            >
              {displayLabel}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const tabBarBottom = Math.max(insets.bottom, FLOATING_TAB_BAR_BOTTOM);
  const tabSceneClearance = FLOATING_TAB_BAR_HEIGHT + tabBarBottom + FLOATING_TAB_BAR_GAP;

  useExpiryReoffer();
  return (
    <>
      {/* Evaluates the behavioural/promotional notification triggers on background. */}
      <BehaviouralTriggers />
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: [styles.tabScene, { paddingBottom: tabSceneClearance }],
          tabBarActiveTintColor: colors.clayDeep,
          tabBarInactiveTintColor: colors.ink,
          tabBarHideOnKeyboard: true,
          tabBarShowLabel: false,
        }}
      >
        <Tabs.Screen
          name="today"
          options={{
            title: 'Today',
            tabBarAccessibilityLabel: 'Today tab',
            tabBarIcon: ({ focused }) => <TabBarIcon focused={focused} name="today" />,
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: 'Progress',
            tabBarAccessibilityLabel: 'Progress tab',
            tabBarIcon: ({ focused }) => <TabBarIcon focused={focused} name="progress" />,
          }}
        />
        <Tabs.Screen
          name="shelf"
          options={{
            title: 'Shelf',
            tabBarAccessibilityLabel: 'Shelf tab',
            tabBarIcon: ({ focused }) => <TabBarIcon focused={focused} name="shelf" />,
          }}
        />
        <Tabs.Screen
          name="you"
          options={{
            title: 'You',
            tabBarAccessibilityLabel: 'You tab',
            tabBarIcon: ({ focused }) => <TabBarIcon focused={focused} name="you" />,
          }}
        />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  gridDot: {
    borderRadius: 2.5,
    height: 5,
    position: 'absolute',
    width: 5,
  },
  iconCanvas: {
    height: ICON_SIZE,
    position: 'relative',
    width: ICON_SIZE,
  },
  iconShell: {
    alignItems: 'center',
    borderRadius: 16,
    height: 28,
    justifyContent: 'center',
    width: 42,
  },
  iconShellActive: {
    backgroundColor: colors.clayTint,
  },
  progressBar: {
    borderRadius: 2,
    bottom: 4,
    position: 'absolute',
    width: 3,
  },
  shelfLine: {
    borderRadius: 1.5,
    height: 2,
    left: 4,
    position: 'absolute',
    width: 14,
  },
  shelfPost: {
    borderRadius: 1,
    height: 14,
    position: 'absolute',
    top: 5,
    width: 2,
  },
  floatingTabBar: {
    alignItems: 'center',
    backgroundColor: colors.paperRaised,
    borderColor: colors.hairlineStrong,
    borderRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    height: FLOATING_TAB_BAR_HEIGHT,
    justifyContent: 'center',
    left: 16,
    paddingBottom: 8,
    paddingHorizontal: 8,
    paddingTop: 8,
    position: 'absolute',
    right: 16,
  },
  tabLabel: {
    flexShrink: 1,
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: 13,
    includeFontPadding: false,
    letterSpacing: 0,
    lineHeight: 18,
    minHeight: 22,
    minWidth: 0,
    overflow: 'visible',
    textAlign: 'center',
    width: '100%',
  },
  tabLabelActive: {
    fontFamily: 'HankenGrotesk_700Bold',
  },
  tabItem: {
    alignItems: 'center',
    borderRadius: 18,
    flex: 1,
    flexBasis: 0,
    height: 72,
    justifyContent: 'center',
    minHeight: 72,
    minWidth: 0,
    paddingBottom: 0,
    paddingTop: 0,
  },
  tabItemPressed: {
    opacity: 0.72,
  },
  tabScene: {
    paddingBottom: FLOATING_TAB_BAR_CLEARANCE,
  },
  userHead: {
    borderRadius: 5,
    borderWidth: 2,
    height: 9,
    left: 6.5,
    position: 'absolute',
    top: 4,
    width: 9,
  },
  userShoulders: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 2,
    borderBottomWidth: 0,
    height: 7,
    left: 4,
    position: 'absolute',
    top: 15,
    width: 14,
  },
});
