import { router, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

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

// Bottom tab bar (design spec): Today · Progress · Shelf · You. A small clay dot
// marks the active tab; labels are Hanken Grotesk.
function Dot({ focused }: { focused: boolean }) {
  return (
    <View
      style={{
        width: 5,
        height: 5,
        borderRadius: 3,
        marginBottom: 2,
        backgroundColor: focused ? colors.clay : 'transparent',
      }}
    />
  );
}

export default function TabsLayout() {
  useExpiryReoffer();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.paper,
          borderTopColor: colors.hairline,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 12 },
      }}>
      <Tabs.Screen
        name="today"
        options={{ title: 'Today', tabBarIcon: ({ focused }) => <Dot focused={focused} /> }}
      />
      <Tabs.Screen
        name="progress"
        options={{ title: 'Progress', tabBarIcon: ({ focused }) => <Dot focused={focused} /> }}
      />
      <Tabs.Screen
        name="shelf"
        options={{ title: 'Shelf', tabBarIcon: ({ focused }) => <Dot focused={focused} /> }}
      />
      <Tabs.Screen
        name="you"
        options={{ title: 'You', tabBarIcon: ({ focused }) => <Dot focused={focused} /> }}
      />
    </Tabs>
  );
}
