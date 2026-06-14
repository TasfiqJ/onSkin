import type { DisruptionReason } from '@onskin/types';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Sheet, Text } from '@/components/ui';
import { useCycleMutations } from '@/features/scheduler/useCycle';
import { cn } from '@/lib/cn';
import { haptics } from '@/theme/haptics';

// Disruption hub (design screen 04, docs/05 §6.4/§7). Breaks are managed, not
// punished. Skip / pause / travel / procedure; resume re-anchors where you left
// off. Nothing breaks the streak (docs/03 §6).
function Option({
  glyph,
  title,
  sub,
  firm,
  onPress,
}: {
  glyph: string;
  title: string;
  sub: string;
  firm?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptics.select();
        onPress();
      }}
      className={cn(
        'flex-row items-center gap-3.5 rounded-[18px] bg-paper-raised p-4',
        firm ? 'border border-amber/40' : 'border border-hairline',
      )}>
      <View
        className="h-[38px] w-[38px] items-center justify-center rounded-xl"
        style={{ backgroundColor: firm ? 'rgba(176,122,60,0.14)' : '#F1ECE3' }}>
        <Text className="text-[16px]" style={{ color: firm ? '#B07A3C' : '#8A8071' }}>
          {glyph}
        </Text>
      </View>
      <View className="flex-1">
        <Text variant="body" className="font-sans-bold">
          {title}
        </Text>
        <Text variant="bodySm" tone="muted">
          {sub}
        </Text>
      </View>
    </Pressable>
  );
}

export default function DisruptionScreen() {
  const m = useCycleMutations();

  const act = async (fn: () => Promise<void>) => {
    await fn();
    router.back();
  };

  const pause = (reason: DisruptionReason) => act(() => m.pause(reason));

  return (
    <Sheet>
      <Text variant="title" className="text-[30px] leading-[34px]" accessibilityRole="header">
        Life happens.
      </Text>
      <Text variant="body" tone="muted" className="mt-2">
        Take a break whenever you need. Nothing breaks, and we&apos;ll pick up right where you left
        off.
      </Text>

      <View className="mt-6 gap-2.5">
        <Option glyph="‖" title="Skip tonight" sub="Just this once. The cycle continues" onPress={() => act(m.skip)} />
        <Option glyph="◴" title="Pause my routine" sub="Vacation, illness, a break" onPress={() => pause('break')} />
        <Option glyph="→" title="Travel mode" sub="Trim to essentials while away" onPress={() => pause('travel')} />
        <Option
          glyph="◇"
          title="I had a facial or peel"
          sub="Pause actives, let skin recover"
          firm
          onPress={() => {
            haptics.select();
            router.replace('/cycle/procedure');
          }}
        />
      </View>
    </Sheet>
  );
}
