import { Pressable } from 'react-native';

import { cn } from '@/lib/cn';
import { haptics } from '@/theme/haptics';

import { Text } from './Text';

// Single-select segment chip for the Shelf filters (docs/04 §5.1): ink fill +
// paper text when selected, outlined + muted when not. Distinct from the
// multi-select Chip (which fills clay-tint).
export type SegmentChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  className?: string;
};

export function SegmentChip({ label, selected = false, onPress, className }: SegmentChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        haptics.select();
        onPress?.();
      }}
      className={cn(
        'min-h-[40px] justify-center rounded-pill px-[18px] py-2.5',
        selected ? 'bg-ink' : 'border border-hairline-strong bg-paper-raised',
        className,
      )}>
      <Text className={cn('font-sans-semibold text-[13px]', selected ? 'text-paper' : 'text-muted')}>
        {label}
      </Text>
    </Pressable>
  );
}
