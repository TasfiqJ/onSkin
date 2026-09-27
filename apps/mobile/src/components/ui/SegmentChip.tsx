import { Pressable } from 'react-native';

import { cn } from '@/lib/cn';
import { haptics } from '@/theme/haptics';

import { Text } from './Text';

export type SegmentChipProps = {
  label: string;
  accessibilityLabel?: string;
  selected?: boolean;
  onPress?: () => void;
  className?: string;
};

export function SegmentChip({
  label,
  accessibilityLabel,
  selected = false,
  onPress,
  className,
}: SegmentChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      aria-pressed={selected}
      onPress={() => {
        haptics.select();
        onPress?.();
      }}
      style={{ minHeight: 48 }}
      className={cn(
        'min-h-[48px] justify-center rounded-pill border px-[18px] py-2.5',
        selected ? 'border-ink bg-ink' : 'border-hairline-strong bg-paper-raised',
        className,
      )}
    >
      <Text
        className={cn(
          'font-sans-semibold text-[13px]',
          selected ? 'text-paper' : 'text-muted-strong',
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}
