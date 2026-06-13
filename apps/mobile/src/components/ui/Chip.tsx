import { Pressable, Text } from 'react-native';

import { cn } from '@/lib/cn';
import { haptics } from '@/theme/haptics';

// Multi-select chip (design spec): for sensitivities/allergies and other
// multi-select inputs. Pill, bordered, fills clay-tinted when selected.
export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  className?: string;
};

export function Chip({ label, selected = false, onPress, className }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        haptics.select();
        onPress?.();
      }}
      className={cn(
        'min-h-[40px] items-center justify-center rounded-pill border px-4 py-2',
        selected ? 'border-clay bg-clay/10' : 'border-hairline bg-paper-raised',
        className,
      )}>
      <Text className={cn('font-sans-medium text-[14px]', selected ? 'text-clay' : 'text-ink')}>
        {label}
      </Text>
    </Pressable>
  );
}
