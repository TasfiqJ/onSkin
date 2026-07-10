import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { colors } from '@/theme/tokens';

import { useAuth } from './AuthProvider';

const COPY = {
  loading: 'Securing account data...',
  eyebrow: 'Account change paused',
  title: 'Your private data could not be cleared.',
  body: 'The next account is still locked out. Try again to finish clearing private data from the previous account.',
  retry: 'Try again',
} as const;

export function SessionBoundaryGate({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { initializing, sessionBoundaryError, retrySessionBoundary } = useAuth();

  if (!initializing && !sessionBoundaryError) return children;

  if (!sessionBoundaryError) {
    return (
      <View
        accessibilityLabel={COPY.loading}
        accessibilityLiveRegion="polite"
        className="flex-1 items-center justify-center px-7"
        style={{ backgroundColor: colors.paper }}
      >
        <Text variant="bodySm" tone="muted" className="text-center">
          {COPY.loading}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 28,
        paddingTop: insets.top + 32,
        paddingBottom: insets.bottom + 32,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View accessibilityLiveRegion="polite" accessibilityRole="alert">
        <Text variant="label" style={{ color: colors.clayDeep, textAlign: 'center' }}>
          {COPY.eyebrow}
        </Text>
        <Text
          variant="title"
          className="mt-3"
          style={{ color: colors.ink, fontSize: 30, lineHeight: 34, textAlign: 'center' }}
        >
          {COPY.title}
        </Text>
        <Text variant="bodySm" tone="muted" className="mt-3 text-center" style={{ lineHeight: 22 }}>
          {COPY.body}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        className="mt-7 min-h-[56px] items-center justify-center rounded-pill px-6 py-3"
        onPress={() => void retrySessionBoundary()}
        style={{ backgroundColor: colors.ink }}
      >
        <Text className="font-sans-semibold" style={{ color: colors.paper, fontSize: 16 }}>
          {COPY.retry}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
