import { Pressable, View } from 'react-native';

import { RouteIconButton, Screen, Text } from '@/components/ui';
import { colors } from '@/theme/tokens';

export function DirectPaywallLoading() {
  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center">
        <Text variant="body" tone="muted">
          Checking your plan...
        </Text>
      </View>
    </Screen>
  );
}

export function DirectPaywallRecovery({
  isRetrying,
  onClose,
  onRetry,
}: {
  isRetrying: boolean;
  onClose: () => void;
  onRetry: () => void;
}) {
  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-row justify-end pt-1">
        <RouteIconButton
          accessibilityLabel="Close plan recovery"
          glyph="x"
          tone="muted"
          onPress={onClose}
        />
      </View>
      <View className="flex-1 justify-center pb-8">
        <View
          className="rounded-card bg-paper-raised p-5"
          style={{ borderWidth: 1, borderColor: colors.hairline }}
        >
          <Text variant="label" tone="muted">
            PRO ACCESS
          </Text>
          <Text
            accessibilityRole="alert"
            variant="title"
            className="mt-2"
            style={{ fontSize: 28, lineHeight: 32 }}
          >
            Plan status unavailable
          </Text>
          <Text variant="body" tone="muted" className="mt-2">
            We could not verify your plan. Purchase actions stay unavailable until you try again.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry plan verification"
            disabled={isRetrying}
            onPress={onRetry}
            className="mt-5 min-h-[48px] items-center justify-center rounded-pill px-4"
            style={{ backgroundColor: isRetrying ? colors.mutedLight : colors.clay }}
          >
            <Text className="font-sans-semibold" style={{ color: colors.paper, fontSize: 16 }}>
              {isRetrying ? 'Checking...' : 'Retry'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

export function DirectPaywallRedirecting() {
  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-1" />
    </Screen>
  );
}
