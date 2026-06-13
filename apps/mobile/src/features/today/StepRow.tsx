import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { cn } from '@/lib/cn';
import { haptics } from '@/theme/haptics';

// A single routine step with a tappable check circle (design spec p.8/9).
// Completions are append-only, so tapping checks off (no un-check).
export type StepRowProps = {
  name: string;
  instruction: string | null;
  done: boolean;
  isNext: boolean;
  dark: boolean;
  onPress: () => void;
};

export function StepRow({ name, instruction, done, isNext, dark, onPress }: StepRowProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={name}
      onPress={() => {
        if (!done) haptics.success();
        onPress();
      }}
      className="flex-row items-start border-t py-4"
      style={{ borderTopColor: dark ? '#3A322A' : '#E0D9CC' }}>
      <View
        className={cn(
          'mt-0.5 h-6 w-6 items-center justify-center rounded-full border-2',
          done ? 'border-clay bg-clay' : dark ? 'border-cream/20' : 'border-greige-deep',
        )}>
        {done ? <View className="h-2 w-2 rounded-full bg-paper" /> : null}
      </View>
      <View className="ml-3 flex-1">
        <View className="flex-row items-center justify-between">
          <Text variant="body" tone={dark ? 'inverse' : 'ink'} className="font-sans-medium">
            {name}
          </Text>
          {isNext ? (
            <Text variant="label" tone="clay">
              NEXT
            </Text>
          ) : null}
        </View>
        {instruction ? (
          <Text variant="bodySm" tone={dark ? 'inverseMuted' : 'muted'} className="mt-0.5">
            {instruction}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
