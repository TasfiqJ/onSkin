import { ActivityIndicator, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { colors } from '@/theme/tokens';

export function CompletionHistoryState({
  failed,
  retrying,
  onRetry,
}: {
  failed: boolean;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center px-6 py-12">
      {failed ? (
        <>
          <Text variant="title" className="text-center">
            Check-ins unavailable
          </Text>
          <Text variant="body" tone="muted" className="mt-3 text-center">
            Your history wasn&apos;t reset. OnSkin can&apos;t safely read it right now, so
            check-offs are paused.
          </Text>
          <Button
            accessibilityLabel="Retry loading check-ins"
            className="mt-6"
            disabled={retrying}
            label={retrying ? 'Trying...' : 'Try again'}
            onPress={onRetry}
          />
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.clay} />
          <Text variant="bodySm" tone="muted" className="mt-3">
            Loading check-ins...
          </Text>
        </>
      )}
    </View>
  );
}
