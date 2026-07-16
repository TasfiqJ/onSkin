import { View } from 'react-native';

import { Button, StateLoading, StateNotice } from '@/components/ui';

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
        <StateNotice
          kind="unavailable"
          presentation="plain"
          align="center"
          title="Check-ins unavailable"
          body="Your history wasn't reset. OnSkin can't safely read it right now, so check-offs are paused."
        >
          <Button
            accessibilityLabel="Retry loading check-ins"
            className="mt-6"
            disabled={retrying}
            label={retrying ? 'Trying...' : 'Try again'}
            onPress={onRetry}
          />
        </StateNotice>
      ) : (
        <StateLoading label="Loading check-ins..." />
      )}
    </View>
  );
}
