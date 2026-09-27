import { router, Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { BehaviouralTriggers } from '@/features/notifications/BehaviouralTriggers';
import { pendingLifecycleRoute } from '@/features/subscription/lifecycle';
import { colors } from '@/theme/tokens';

// The iOS release uses the system tab bar instead of drawing a second navigation
// system in JavaScript. On current iOS this picks up Liquid Glass, accessibility,
// safe-area behavior and system interaction changes automatically. The app keeps
// its own warm editorial palette in the content layer; glass stays navigation.
function useExpiryReoffer() {
  useEffect(() => {
    void pendingLifecycleRoute(new Date().toISOString()).then((route) => {
      if (route) router.push(route);
    });
  }, []);
}

export default function TabsLayout() {
  useExpiryReoffer();

  if (Platform.OS === 'web') {
    return (
      <>
        <BehaviouralTriggers />
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.clay,
            tabBarInactiveTintColor: colors.mutedStrong,
            tabBarLabelStyle: {
              fontFamily: 'HankenGrotesk-SemiBold',
              fontSize: 13,
              lineHeight: 18,
            },
            tabBarItemStyle: { minHeight: 56 },
            tabBarStyle: {
              backgroundColor: colors.paperRaised,
              borderTopColor: colors.hairlineStrong,
              height: 84,
              paddingBottom: 12,
              paddingTop: 8,
            },
          }}
        >
          <Tabs.Screen name="today" options={{ title: 'Today', tabBarIcon: () => null }} />
          <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: () => null }} />
          <Tabs.Screen name="shelf" options={{ title: 'Shelf', tabBarIcon: () => null }} />
          <Tabs.Screen name="you" options={{ title: 'You', tabBarIcon: () => null }} />
        </Tabs>
      </>
    );
  }

  return (
    <>
      <BehaviouralTriggers />
      <NativeTabs
        disableTransparentOnScrollEdge
        minimizeBehavior="onScrollDown"
        tintColor={colors.clay}
      >
        <NativeTabs.Trigger name="today">
          <NativeTabs.Trigger.Icon
            sf={{ default: 'house', selected: 'house.fill' }}
            md={{ default: 'home', selected: 'home' }}
          />
          <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="progress">
          <NativeTabs.Trigger.Icon
            sf={{ default: 'chart.line.uptrend.xyaxis', selected: 'chart.line.uptrend.xyaxis' }}
            md={{ default: 'trending_up', selected: 'trending_up' }}
          />
          <NativeTabs.Trigger.Label>Progress</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="shelf">
          <NativeTabs.Trigger.Icon
            sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }}
            md={{ default: 'inventory_2', selected: 'inventory_2' }}
          />
          <NativeTabs.Trigger.Label>Shelf</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="you">
          <NativeTabs.Trigger.Icon
            sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
            md={{ default: 'person', selected: 'person' }}
          />
          <NativeTabs.Trigger.Label>You</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </>
  );
}
