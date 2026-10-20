import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';

export function NotificationPreferenceSaveNotice({ pending, onRetry }: {
  pending: boolean;
  onRetry: () => void;
}) {
  return (
    <View accessibilityRole="alert" className="mb-3 rounded-card bg-paper-raised p-4">
      <Text variant="bodySm">
        Your preferences may be saved, but reminders were not confirmed. Try again.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Try saving reminder preferences again"
        disabled={pending}
        onPress={onRetry}
        className="min-h-[48px] justify-center"
      >
        <Text variant="bodySm" className="font-sans-semibold">Try again</Text>
      </Pressable>
    </View>
  );
}
