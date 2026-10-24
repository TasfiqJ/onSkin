import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RouteIconButton, Text } from '@/components/ui';
import { colors } from '@/theme/tokens';

/** Read failure cannot become an editable default or an unreachable blank page. */
export function NotificationPreferenceReadState({ title, failed, retrying, onRetry, onBack }: {
  title: string;
  failed: boolean;
  retrying: boolean;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.greige }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View className="mb-4 flex-row items-center gap-3">
          <RouteIconButton accessibilityLabel="Back" onPress={onBack} />
          <Text variant="title" style={{ flexShrink: 1 }}>{title}</Text>
        </View>
        <View accessibilityRole={failed ? 'alert' : undefined} accessibilityLiveRegion="polite"
          accessibilityState={{ busy: retrying }} className="rounded-card bg-paper-raised p-4">
          <Text variant="bodySm">
            {failed ? 'Reminder preferences are unavailable. Your saved choices have not been replaced.' : 'Checking saved reminder preferences…'}
          </Text>
          {failed ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Try loading reminder preferences again"
              accessibilityState={{ disabled: retrying, busy: retrying }} disabled={retrying}
              onPress={onRetry} style={{ minHeight: 48, justifyContent: 'center' }}>
              <Text variant="bodySm" className="font-sans-semibold">{retrying ? 'Trying…' : 'Try again'}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
