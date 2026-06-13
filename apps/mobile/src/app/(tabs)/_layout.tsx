import { Tabs } from 'expo-router';
import { View } from 'react-native';

import { colors } from '@/theme/tokens';

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
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.paper,
          borderTopColor: colors.greigeLine,
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
