import { router, Tabs, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabBarIcon } from '@/components/navigation/TabBarIcon';
import { DockButton, FloatingDock } from '@/components/navigation/DockMotion';
import { useRoutineClock } from '@/features/today/useRoutineClock';
import { FONT_FAMILY_TOKENS as fontFamilies } from '../../../font-assets';
import { BehaviouralTriggers } from '@/features/notifications/BehaviouralTriggers';
import { pendingLifecycleRoute } from '@/features/subscription/lifecycle';
import { useAuth } from '@/lib/auth/AuthProvider';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { colors } from '@/theme/tokens';

function useExpiryReoffer() {
  const { user } = useAuth();
  const storeUserId = user?.id ?? null;
  useEffect(() => {
    if (!storeUserId) return;
    let mounted = true;
    void runAccountGenerationOperation(async (lease) => {
      const route = await pendingLifecycleRoute(new Date().toISOString());
      lease.assertCurrent();
      if (!mounted || !route) return;
      router.push(route === '/paywall/reoffer' ? '/paywall/upsell' : route);
    }).catch(() => {
      // Account changes or unavailable private storage must not navigate.
    });
    return () => {
      mounted = false;
    };
  }, [storeUserId]);
}

export default function TabsLayout() {
  useExpiryReoffer();
  const pathname = usePathname();
  const { phase: routineType } = useRoutineClock();
  const dark = pathname.endsWith('/today') && routineType === 'PM';
  const insets = useSafeAreaInsets();
  const backgroundColor = dark ? colors.night : colors.paper;
  const inactiveColor = dark ? colors.mutedLight : colors.mutedStrong;

  // One floating dock on every supported platform. Reserve space for controls
  // above it so the last row stays reachable without scrolling behind the bar.
  return (
    <>
      <BehaviouralTriggers />
      <Tabs
        tabBar={(props) => <FloatingDock {...props} />}
        safeAreaInsets={{ bottom: 0 }}
        screenOptions={{
          headerShown: false,
          tabBarButton: (props) => <DockButton {...props} dark={dark} />,
          sceneStyle: { backgroundColor, paddingBottom: 96 + insets.bottom },
          tabBarActiveTintColor: dark ? colors.cream : colors.ink,
          tabBarInactiveTintColor: inactiveColor,
          tabBarStyle: {
            backgroundColor: dark ? colors.nightSurface : colors.paper,
            borderRadius: 32,
            borderColor: dark ? colors.hairlineDark : colors.hairlineStrong,
            borderWidth: 1,
            borderTopWidth: 1,
            height: 72,
            paddingTop: 4,
            paddingBottom: 4,
            paddingHorizontal: 8,
            boxShadow: dark ? '0 6px 24px rgba(0,0,0,0.3)' : '0 6px 24px rgba(32,27,21,0.12)',
          },
          tabBarItemStyle: { minHeight: 48 },
          tabBarLabelPosition: 'below-icon',
          tabBarIconStyle: { height: 32 },
          tabBarLabelStyle: {
            fontSize: 11,
            lineHeight: 16,
            fontFamily: fontFamilies['sans-semibold'],
            marginTop: 2,
          },
        }}
      >
        <Tabs.Screen
          name="today"
          options={{
            title: 'Today',
            tabBarIcon: ({ focused }) => <TabBarIcon name="today" focused={focused} dark={dark} />,
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: 'Progress',
            tabBarIcon: ({ focused }) => (
              <TabBarIcon name="progress" focused={focused} dark={dark} />
            ),
          }}
        />
        <Tabs.Screen
          name="shelf"
          options={{
            title: 'Shelf',
            tabBarIcon: ({ focused }) => <TabBarIcon name="shelf" focused={focused} dark={dark} />,
          }}
        />
        <Tabs.Screen
          name="you"
          options={{
            title: 'You',
            tabBarIcon: ({ focused }) => <TabBarIcon name="you" focused={focused} dark={dark} />,
          }}
        />
      </Tabs>
    </>
  );
}
