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
  compact?: boolean;
};

export function OptionCard({
  title,
  subtitle,
  selected = false,
  onPress,
  className,
  compact = false,
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
        'flex-row items-center justify-between rounded-card border px-5',
        compact ? 'min-h-[60px] py-3' : 'min-h-[64px] py-4',
        selected ? 'border-clay bg-clay/5' : 'border-hairline bg-paper-raised',
        className,
      )}
    >
      <View className="flex-1 pr-3">
        <Text className={cn('font-sans-medium text-ink', compact ? 'text-[15.5px]' : 'text-[17px]')}>
          {title}
        </Text>
        {subtitle ? (
          <Text className={cn('mt-0.5 font-sans text-muted', compact ? 'text-[12px]' : 'text-[13px]')}>
            {subtitle}
          </Text>
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
