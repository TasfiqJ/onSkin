import { View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { cn } from '@/lib/cn';
import { colors } from '@/theme/tokens';

export function ActiveScheduleUnavailableNotice({
  className,
  onRetry,
  retrying,
  tone = 'paper',
}: {
  className?: string;
  onRetry: () => void;
  retrying: boolean;
  tone?: 'paper' | 'night';
}) {
  const night = tone === 'night';
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      className={cn('rounded-[18px] p-4', className)}
      style={{
        backgroundColor: night ? 'rgba(244,239,231,0.08)' : colors.paperRaised,
        borderColor: night ? 'rgba(244,239,231,0.14)' : colors.hairlineStrong,
        borderWidth: 1,
      }}
    >
      <Text
        variant="body"
        className="font-sans-semibold"
        style={{ color: night ? colors.cream : colors.ink }}
      >
        Active schedule unavailable
      </Text>
      <Text
        variant="bodySm"
        className="mt-1.5"
        style={{ color: night ? 'rgba(244,239,231,0.68)' : colors.muted, lineHeight: 20 }}
      >
        Your saved cadence wasn&apos;t reset. Active-night guidance is paused until OnSkin can read
        it safely. Your daily basics are still available.
      </Text>
      <Button
        accessibilityLabel="Retry loading active schedule"
        className="mt-4 min-h-[48px] py-3"
        disabled={retrying}
        label={retrying ? 'Trying...' : 'Try again'}
        onPress={onRetry}
        variant={night ? 'inverse' : 'primary'}
      />
    </View>
  );
}
