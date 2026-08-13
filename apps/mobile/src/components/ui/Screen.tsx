import { useEffect, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { cn } from '@/lib/cn';
import { markStartupPhase } from '@/lib/observability/operationTiming';
import { statusBarStyleForSurface } from '@/theme/systemBarPolicy';
import { colors } from '@/theme/tokens';

// Screen scaffold with safe-area insets + the page background. tone="night" for
// the PM-routine and capture screens (design spec: those are always dark).
export type ScreenProps = {
  children: ReactNode;
  tone?: 'paper' | 'night';
  edges?: readonly Edge[];
  className?: string;
};

export function Screen({
  children,
  tone = 'paper',
  edges = ['top', 'bottom'],
  className,
}: ScreenProps) {
  useEffect(() => {
    markStartupPhase('first_meaningful_content');
  }, []);
  const markFirstRouteInteraction = () => {
    markStartupPhase('first_route_interaction_observed');
  };

  return (
    <>
      <StatusBar style={statusBarStyleForSurface(tone)} />
      <SafeAreaView
        edges={edges}
        onPointerDown={markFirstRouteInteraction}
        onTouchStart={markFirstRouteInteraction}
        className={cn('flex-1', tone === 'night' ? 'bg-night' : 'bg-paper')}
        style={{ backgroundColor: tone === 'night' ? colors.night : colors.paper }}
      >
        <View className={cn('flex-1 px-6', className)}>{children}</View>
      </SafeAreaView>
    </>
  );
}
