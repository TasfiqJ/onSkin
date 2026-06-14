import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/lib/cn';

// Bottom sheet over a dimmed backdrop. The opened-date linchpin (docs/04 §4.5),
// the no-match fork (§4.1, tone="night"), and the replenishment prompt (§6).
// Tapping the backdrop dismisses. Present the route as a transparentModal so the
// dim shows through.
export type SheetProps = {
  children: ReactNode;
  tone?: 'paper' | 'night';
  onClose?: () => void;
  scroll?: boolean;
  className?: string;
};

export function Sheet({ children, tone = 'paper', onClose, scroll = false, className }: SheetProps) {
  const close = onClose ?? (() => router.back());
  const Body = scroll ? ScrollView : View;
  return (
    <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(32,27,21,0.4)' }}>
      <Pressable
        className="absolute inset-0"
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={close}
      />
      <View
        className={cn(
          'rounded-t-sheet px-7 pb-10 pt-4',
          tone === 'night' ? 'bg-night-surface' : 'bg-paper',
          className,
        )}>
        <View
          className="mx-auto mb-5 h-[5px] w-10 rounded-[3px]"
          style={{ backgroundColor: tone === 'night' ? 'rgba(244,239,231,0.18)' : 'rgba(32,27,21,0.15)' }}
        />
        <Body {...(scroll ? { showsVerticalScrollIndicator: false } : {})}>{children}</Body>
      </View>
    </View>
  );
}
