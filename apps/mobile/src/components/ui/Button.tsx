import { Pressable, type PressableProps } from 'react-native';

import { cn } from '@/lib/cn';
import { haptics } from '@/theme/haptics';

import { Text } from './Text';

type ButtonVariant = 'primary' | 'accent' | 'ghost' | 'inverse' | 'inverseGhost';

const CONTAINER: Record<ButtonVariant, string> = {
  primary: 'bg-ink',
  accent: 'bg-clay',
  inverse: 'border border-hairline-strong bg-paper-raised',
  ghost: 'bg-transparent',
  inverseGhost: 'border border-cream/15 bg-cream/10',
};
const LABEL: Record<ButtonVariant, string> = {
  primary: 'text-paper',
  accent: 'text-paper',
  inverse: 'text-ink',
  ghost: 'text-ink',
  inverseGhost: 'text-cream',
};

export type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: ButtonVariant;
  fullWidth?: boolean;
  className?: string;
};

export function Button({
  label,
  variant = 'primary',
  fullWidth = true,
  className,
  onPress,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={(e) => {
        haptics.select();
        onPress?.(e);
      }}
      style={({ pressed }) => ({
        opacity: pressed ? 0.92 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
      className={cn(
        'min-h-[54px] items-center justify-center rounded-pill px-6 py-3.5',
        CONTAINER[variant],
        fullWidth && 'w-full',
        disabled && 'opacity-40',
        className,
      )}
      {...rest}
    >
      <Text className={cn('font-sans-semibold text-[16px]', LABEL[variant])}>{label}</Text>
    </Pressable>
  );
}
