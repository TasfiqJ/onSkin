import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { cn } from '@/lib/cn';
import { APP_HOME_ROUTE, backOrReplace, type AppFallbackRoute } from '@/lib/navigation/safeBack';

// Bottom sheet over a dimmed backdrop. The opened-date linchpin (docs/04 §4.5),
// the no-match fork (§4.1, tone="night"), and the replenishment prompt (§6).
// Tapping the backdrop dismisses. Present the route as a transparentModal so the
// dim shows through.
export type SheetProps = {
  children: ReactNode;
  tone?: 'paper' | 'night';
  onClose?: () => void;
  fallbackRoute?: AppFallbackRoute;
  scroll?: boolean;
  backdropAccessible?: boolean;
  className?: string;
};

export function Sheet({
  children,
  tone = 'paper',
  onClose,
  fallbackRoute = APP_HOME_ROUTE,
  scroll = false,
  backdropAccessible = true,
  className,
}: SheetProps) {
  const close = onClose ?? (() => backOrReplace(router, fallbackRoute));
  const Body = scroll ? ScrollView : View;
  const { height } = useWindowDimensions();
  const backdropReserve = backdropAccessible ? 48 : 12;
  const sheetMaxHeight = Math.max(280, height - backdropReserve);

  return (
    <View className="flex-1" style={{ backgroundColor: 'rgba(32,27,21,0.4)' }}>
      <Pressable
        className="flex-1"
        accessible={backdropAccessible}
        {...(backdropAccessible
          ? { accessibilityRole: 'button' as const, accessibilityLabel: 'Dismiss' }
          : {})}
        onPress={close}
      />
      <View
        className={cn(
          'overflow-hidden rounded-t-sheet px-7 pb-10 pt-4',
          tone === 'night' ? 'bg-night-surface' : 'bg-paper',
          className,
        )}
        style={{ maxHeight: sheetMaxHeight }}
      >
        <View
          className="mx-auto mb-5 h-[5px] w-10 rounded-[3px]"
          style={{
            backgroundColor: tone === 'night' ? 'rgba(244,239,231,0.18)' : 'rgba(32,27,21,0.15)',
          }}
        />
        <Body
          {...(scroll
            ? { showsVerticalScrollIndicator: false, style: { flexShrink: 1 } }
            : {})}
        >
          {children}
        </Body>
      </View>
    </View>
  );
}
