import { Pressable, type PressableProps, View, type ViewStyle } from 'react-native';

import { cn } from '@/lib/cn';
import { colors } from '@/theme/tokens';

type ToggleSwitchStyle = PressableProps['style'];

const TOUCH_TARGET_STYLE = {
  width: 52,
  minWidth: 52,
  height: 48,
  minHeight: 44,
  alignItems: 'center',
  justifyContent: 'center',
} satisfies ViewStyle;

export type ToggleSwitchProps = Omit<
  PressableProps,
  'accessibilityRole' | 'accessibilityState' | 'children' | 'onPress' | 'style'
> & {
  value: boolean;
  onChange: (value: boolean) => void;
  activeTrackColor?: string;
  className?: string;
  inactiveTrackColor?: string;
  thumbColor?: string;
  style?: ToggleSwitchStyle;
};

export function ToggleSwitch({
  value,
  onChange,
  disabled,
  activeTrackColor = colors.clay,
  inactiveTrackColor = '#D8D0C2',
  thumbColor = colors.paperRaised,
  className,
  style,
  ...rest
}: ToggleSwitchProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      aria-checked={value}
      aria-disabled={disabled ? true : undefined}
      disabled={disabled}
      onPress={() => onChange(!value)}
      className={cn('h-12 min-h-[44px] w-[52px] items-center justify-center', className)}
      style={(state) => [
        TOUCH_TARGET_STYLE,
        disabled ? { opacity: 0.58 } : null,
        state.pressed && !disabled ? { opacity: 0.82 } : null,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      <View
        className="h-[24px] w-[42px] justify-center rounded-pill px-0.5"
        style={{
          backgroundColor: value ? activeTrackColor : inactiveTrackColor,
          pointerEvents: 'none',
        }}
      >
        <View
          className="h-[20px] w-[20px] rounded-full"
          style={{
            backgroundColor: thumbColor,
            pointerEvents: 'none',
            transform: [{ translateX: value ? 18 : 0 }],
          }}
        />
      </View>
    </Pressable>
  );
}
