import type { RoutineType } from '@onskin/types';
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
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BehaviouralTriggers } from '@/features/notifications/BehaviouralTriggers';
import { pendingLifecycleRouteResult } from '@/features/subscription/lifecycle';
import { currentRoutineType } from '@/features/today/useToday';
import { useAuth } from '@/lib/auth/AuthProvider';
import { isOwnerQueryScopeCurrent } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';
import { colors } from '@/theme/tokens';

// On app entry, present the honest reverse-trial re-offer / graceful-downgrade once
// when Pro has lapsed (docs/08 §6/§13). Pure local check, offline-safe, fires once
// per expiry; gated taps surface the contextual upsell thereafter.
function useExpiryReoffer() {
  const { user } = useAuth();
  const ownerScope = useOwnerQueryScope();
  const storeUserId = user?.id ?? null;
  useEffect(() => {
    if (!storeUserId) return;
    let mounted = true;
    void pendingLifecycleRouteResult(new Date().toISOString(), {
      expectedStoreUserId: storeUserId,
    }).then((result) => {
      if (!mounted || result.status !== 'route' || !isOwnerQueryScopeCurrent(ownerScope)) {
        return;
      }
      const { prompt } = result;
      router.push({
        pathname: prompt.route,
        params: { lifecyclePromptId: prompt.promptId },
      });
    });
    return () => {
      mounted = false;
    };
  }, [ownerScope, storeUserId]);
}

type TabIconName = 'today' | 'progress' | 'shelf' | 'you';

const ICON_SIZE = 21;
const FLOATING_TAB_BAR_HEIGHT = 66;
const FLOATING_TAB_BAR_BOTTOM = Platform.select({ ios: 12, android: 12, web: 14, default: 12 });
const FLOATING_TAB_BAR_CLEARANCE = FLOATING_TAB_BAR_HEIGHT + 36;
const FLOATING_TAB_BAR_GAP = 24;
const FLOATING_TAB_BAR_SIDE_MARGIN = 12;
const FLOATING_TAB_BAR_MAX_WIDTH = 402;
const FLOATING_TAB_BAR_HORIZONTAL_PADDING = 0;
const MIN_TAB_TOUCH_TARGET = 52;
const TAB_ITEM_HEIGHT = 54;
const COMPACT_PROGRESS_TAB_LABEL_MAX_WIDTH = 430;
const TAB_ICON_BY_ROUTE: Record<string, TabIconName> = {
  progress: 'progress',
  shelf: 'shelf',
  today: 'today',
  you: 'you',
};

const TAB_BAR_SHADOW = Platform.select({
  android: {
    elevation: 12,
  },
  ios: {
    shadowColor: colors.ink,
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
  },
  web: {
    boxShadow: '0px 18px 34px rgba(32, 27, 21, 0.13), 0px 2px 10px rgba(32, 27, 21, 0.07)',
  } as ViewStyle,
  default: {},
}) as ViewStyle;

function tabSceneBackground(routeName: string, todayRoutineType: RoutineType) {
  return routeName === 'today' && todayRoutineType === 'PM' ? colors.night : colors.paper;
}

const WEB_TAB_ITEM_FOCUS_RESET = Platform.select({
  web: {
    outlineStyle: 'none',
  } as unknown as ViewStyle,
  default: {},
}) as ViewStyle;

const WEB_TAB_ITEM_FOCUS_RING = Platform.select({
  web: {
    boxShadow: '0px 0px 0px 2px rgba(165, 105, 75, 0.24)',
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
  const iconColor = focused ? colors.paperRaised : colors.mutedStrong;
  const Icon =
    name === 'today'
      ? TodayIcon
      : name === 'progress'
        ? ProgressIcon
        : name === 'shelf'
          ? ShelfIcon
          : YouIcon;

  return (
    <View style={styles.iconShell}>
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
  const [focusRingRouteKey, setFocusRingRouteKey] = useState<string | null>(null);
  const tabBarBottom = Math.max(insets.bottom, FLOATING_TAB_BAR_BOTTOM);
  const { width: viewportWidth } = useWindowDimensions();
  const tabBarWidth = Math.min(
    viewportWidth - FLOATING_TAB_BAR_SIDE_MARGIN * 2,
    FLOATING_TAB_BAR_MAX_WIDTH,
  );
  const tabBarHorizontalInset = Math.max(
    FLOATING_TAB_BAR_SIDE_MARGIN,
    (viewportWidth - tabBarWidth) / 2,
  );
  const compactProgressTabLabel = viewportWidth <= COMPACT_PROGRESS_TAB_LABEL_MAX_WIDTH;
  if (keyboardVisible) {
    return null;
  }

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.floatingTabBar,
        { bottom: tabBarBottom, left: tabBarHorizontalInset, right: tabBarHorizontalInset },
        TAB_BAR_SHADOW,
      ]}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title;
        const displayLabel = label ?? route.name;
        const visibleLabel =
          compactProgressTabLabel && route.name === 'progress' ? 'Prog.' : displayLabel;
        const iconName = TAB_ICON_BY_ROUTE[route.name] ?? 'today';
        const labelColor = focused ? colors.paperRaised : colors.inkSoft;

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
            hitSlop={{ bottom: 6, left: 2, right: 2, top: 6 }}
            onBlur={() =>
              setFocusRingRouteKey((currentKey) => (currentKey === route.key ? null : currentKey))
            }
            onFocus={() => setFocusRingRouteKey(route.key)}
            onLongPress={onLongPress}
            onPress={onPress}
            style={({ pressed }) => [
              styles.tabItem,
              WEB_TAB_ITEM_FOCUS_RESET,
              focusRingRouteKey === route.key ? WEB_TAB_ITEM_FOCUS_RING : null,
              pressed ? styles.tabItemPressed : null,
            ]}
            testID={`bottom-tab-${route.name}`}
          >
            <View style={[styles.tabItemFrame, focused ? styles.tabItemActive : null]}>
              <View style={styles.tabItemContent}>
                <TabBarIcon focused={focused} name={iconName} />
                <Text
                  ellipsizeMode="tail"
                  adjustsFontSizeToFit
                  maxFontSizeMultiplier={1.08}
                  minimumFontScale={0.84}
                  numberOfLines={1}
                  style={[
                    styles.tabLabel,
                    focused ? styles.tabLabelActive : null,
                    { color: labelColor },
                  ]}
                >
                  {visibleLabel}
                </Text>
              </View>
            </View>
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
  const todayRoutineType = currentRoutineType();

  useExpiryReoffer();
  return (
    <>
      {/* Evaluates the behavioural/promotional notification triggers on background. */}
      <BehaviouralTriggers />
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={({ route }) => ({
          headerShown: false,
          sceneStyle: [
            styles.tabScene,
            {
              backgroundColor: tabSceneBackground(route.name, todayRoutineType),
              paddingBottom: tabSceneClearance,
            },
          ],
          tabBarActiveTintColor: colors.ink,
          tabBarInactiveTintColor: colors.mutedStrong,
          tabBarHideOnKeyboard: true,
          tabBarShowLabel: false,
        })}
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
    height: 28,
    justifyContent: 'center',
    width: 42,
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
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: colors.hairlineStrong,
    borderRadius: 33,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    height: FLOATING_TAB_BAR_HEIGHT,
    justifyContent: 'center',
    paddingBottom: 6,
    paddingHorizontal: FLOATING_TAB_BAR_HORIZONTAL_PADDING,
    paddingTop: 6,
    position: 'absolute',
    zIndex: 50,
  },
  tabLabel: {
    flexShrink: 1,
    fontFamily: 'HankenGrotesk-SemiBold',
    fontSize: 12.5,
    includeFontPadding: false,
    letterSpacing: 0,
    lineHeight: 17,
    marginTop: 0,
    minHeight: 19,
    minWidth: 0,
    overflow: 'visible',
    paddingBottom: 1,
    paddingTop: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    width: '100%',
  },
  tabLabelActive: {
    fontFamily: 'HankenGrotesk-Bold',
  },
  tabItem: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    flexBasis: 0,
    height: TAB_ITEM_HEIGHT,
    justifyContent: 'center',
    minHeight: MIN_TAB_TOUCH_TARGET,
    minWidth: 0,
    paddingBottom: 0,
    paddingHorizontal: 1,
    paddingTop: 0,
  },
  tabItemFrame: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 25,
    borderWidth: StyleSheet.hairlineWidth,
    height: 50,
    justifyContent: 'center',
    width: '94%',
  },
  tabItemContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  tabItemActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
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
