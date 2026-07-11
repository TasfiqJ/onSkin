import { View } from 'react-native';

import { Text } from '@/components/ui';
import { cn } from '@/lib/cn';
import { colors } from '@/theme/tokens';

export function CycleMutationError({ className }: { className?: string }) {
  return (
    <View
      accessibilityRole="alert"
      className={cn('mt-3 rounded-[8px] bg-clay-tint p-3.5', className)}
    >
      <Text className="font-sans-semibold text-[13.5px]" style={{ color: colors.ink }}>
        Change not saved
      </Text>
      <Text variant="bodySm" tone="muted" className="mt-1 text-[12.5px]">
        Your previous cycle is still in place. Try again when private storage is available.
      </Text>
    </View>
  );
}
