import { Pressable, View } from 'react-native';

import { cn } from '@/lib/cn';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

import { Text } from './Text';

export type OptionCardProps = {
  title: string;
  subtitle?: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  className?: string;
  compact?: boolean;
  tight?: boolean;
};

export function OptionCard({
  title,
  subtitle,
  selected = false,
  disabled = false,
  onPress,
  className,
  compact = false,
  tight = false,
}: OptionCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      aria-pressed={selected}
      disabled={disabled}
      onPress={() => {
        haptics.select();
        onPress?.();
      }}
      style={({ pressed }) => ({
        opacity: pressed ? 0.9 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
      className={cn(
        'flex-row items-center justify-between rounded-[22px] border',
        tight
          ? 'min-h-[52px] px-4 py-2'
          : compact
            ? 'min-h-[60px] px-5 py-3'
            : 'min-h-[64px] px-5 py-4',
        selected ? 'border-clay bg-clay-tint' : 'border-hairline bg-paper-raised',
        disabled && 'opacity-60',
        className,
      )}
    >
      <View className="flex-1 pr-3">
        <Text
          className={cn(
            'font-sans-semibold text-ink',
            compact || tight ? 'text-[15.5px]' : 'text-[17px]',
          )}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            className={cn(
              'mt-0.5 font-sans text-muted',
              compact || tight ? 'text-[12.5px] leading-[17px]' : 'text-[13.5px] leading-[18px]',
            )}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View
        className="h-[22px] w-[22px] items-center justify-center rounded-full"
        style={{
          backgroundColor: selected ? colors.clay : colors.paperRaised,
          borderColor: selected ? colors.clay : colors.greigeDeep,
          borderWidth: 1.5,
        }}
      >
        {selected ? (
          <Text style={{ color: colors.paperRaised, fontSize: 12, lineHeight: 14 }}>✓</Text>
        ) : null}
      </View>
    </Pressable>
  );
}
