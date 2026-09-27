import { Pressable } from 'react-native';

import { cn } from '@/lib/cn';
import { haptics } from '@/theme/haptics';

import { Text } from './Text';

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
      accessibilityLabel={label}
      aria-pressed={selected}
      onPress={() => {
        haptics.select();
        onPress?.();
      }}
      style={{ minHeight: 48 }}
      className={cn(
        'min-h-[48px] items-center justify-center rounded-pill border px-4 py-2.5',
        selected ? 'border-clay bg-clay-tint' : 'border-hairline-strong bg-paper-raised',
        className,
      )}
    >
      <Text
        className={cn(
          'font-sans-semibold text-[14px]',
          selected ? 'text-clay-deep' : 'text-ink-soft',
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}
