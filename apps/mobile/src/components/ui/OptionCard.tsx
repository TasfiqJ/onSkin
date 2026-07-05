import { Pressable, Text, View } from 'react-native';

import { cn } from '@/lib/cn';
import { haptics } from '@/theme/haptics';

// Large tappable selection card (design spec): the premium tap target for goals
// and single-select quiz answers. Title + optional subtitle, selected state with
// a clay ring + dot. 44pt+ target, accessibility label included.
export type OptionCardProps = {
  title: string;
  subtitle?: string;
  selected?: boolean;
  onPress?: () => void;
  className?: string;
};

export function OptionCard({
  title,
  subtitle,
  selected = false,
  onPress,
  className,
}: OptionCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      aria-pressed={selected}
      onPress={() => {
        haptics.select();
        onPress?.();
      }}
      className={cn(
        'min-h-[64px] flex-row items-center justify-between rounded-card border px-5 py-4',
        selected ? 'border-clay bg-clay/5' : 'border-hairline bg-paper-raised',
        className,
      )}
    >
      <View className="flex-1 pr-3">
        <Text className="font-sans-medium text-[17px] text-ink">{title}</Text>
        {subtitle ? (
          <Text className="mt-0.5 font-sans text-[13px] text-muted">{subtitle}</Text>
        ) : null}
      </View>
      <View
        className={cn(
          'h-5 w-5 items-center justify-center rounded-full border',
          selected ? 'border-clay bg-clay' : 'border-greige-deep bg-transparent',
        )}
      >
        {selected ? <View className="h-2 w-2 rounded-full bg-paper" /> : null}
      </View>
    </Pressable>
  );
}
