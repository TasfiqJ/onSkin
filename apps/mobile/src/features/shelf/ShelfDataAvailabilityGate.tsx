import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { colors } from '@/theme/tokens';

import { useShelf } from './useShelf';

export const SHELF_AVAILABILITY_COPY = {
  loading: 'Opening your Shelf...',
  eyebrow: 'Private Shelf',
  title: 'Shelf data unavailable',
  body: "We couldn't safely read the private Shelf data this screen needs. OnSkin did not reset or remove it. Shelf-based guidance and changes are paused until OnSkin can read it again.",
  retry: 'Try again',
  retrying: 'Trying again...',
  retryFailed: 'Your private Shelf data is still unavailable. OnSkin did not reset or remove it.',
} as const;

export type DataAvailabilityCopy = {
  eyebrow: string;
  title: string;
  body: string;
  retry: string;
  retrying: string;
  retryFailed: string;
};

export const PRIVATE_GUIDANCE_AVAILABILITY_COPY: DataAvailabilityCopy = {
  eyebrow: 'Private data',
  title: 'Guidance unavailable',
  body: "We couldn't safely read the private data this guidance needs. OnSkin did not reset or remove it. Guidance and related actions are paused until OnSkin can read it again.",
  retry: 'Try again',
  retrying: 'Trying again...',
  retryFailed: 'The private data is still unavailable. OnSkin did not reset or remove it.',
};

type RetryResult = void | { isError?: boolean };

export function ShelfDataUnavailableNotice({
  onRetry,
  retrying,
  onExit,
  exitLabel = 'Back',
  copy = SHELF_AVAILABILITY_COPY,
}: {
  onRetry: () => Promise<RetryResult>;
  retrying: boolean;
  onExit?: () => void;
  exitLabel?: string;
  copy?: DataAvailabilityCopy;
}) {
  const [retryFailed, setRetryFailed] = useState(false);

  async function retry(): Promise<void> {
    if (retrying) return;
    setRetryFailed(false);
    const result = await onRetry();
    if (result && result.isError) setRetryFailed(true);
  }

  return (
    <View className="w-full max-w-[420px] self-center">
      <View accessibilityLiveRegion="polite" accessibilityRole="alert">
        <Text variant="label" style={{ color: colors.clayDeep, textAlign: 'center' }}>
          {copy.eyebrow}
        </Text>
        <Text
          variant="title"
          className="mt-3"
          style={{ color: colors.ink, fontSize: 30, lineHeight: 34, textAlign: 'center' }}
        >
          {copy.title}
        </Text>
        <Text variant="bodySm" tone="muted" className="mt-3 text-center" style={{ lineHeight: 22 }}>
          {copy.body}
        </Text>
        {retryFailed ? (
          <Text
            variant="bodySm"
            className="mt-3 text-center"
            style={{ color: colors.ink, lineHeight: 20 }}
          >
            {copy.retryFailed}
          </Text>
        ) : null}
      </View>

      <View className="mt-7 gap-2.5">
        <Pressable
          accessibilityLabel="Retry loading private Shelf data"
          accessibilityRole="button"
          accessibilityState={{ disabled: retrying }}
          disabled={retrying}
          onPress={() => void retry()}
          className="min-h-[56px] items-center justify-center rounded-pill px-6 py-3"
          style={{ backgroundColor: colors.ink, opacity: retrying ? 0.68 : 1 }}
        >
          <Text className="font-sans-semibold" style={{ color: colors.paper, fontSize: 16 }}>
            {retrying ? copy.retrying : copy.retry}
          </Text>
        </Pressable>
        {onExit ? (
          <Pressable
            accessibilityRole="button"
            onPress={onExit}
            className="min-h-[48px] items-center justify-center rounded-pill border border-hairline-strong bg-paper-raised px-6 py-3"
          >
            <Text className="font-sans-semibold" style={{ color: colors.ink, fontSize: 15 }}>
              {exitLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function ShelfDataAvailabilityGate({
  children,
  onExit,
  exitLabel,
}: {
  children: ReactNode;
  onExit?: () => void;
  exitLabel?: string;
}) {
  const insets = useSafeAreaInsets();
  const query = useShelf();

  if (!query.isPending && !query.isError) return children;

  if (query.isPending) {
    return (
      <View
        accessibilityLabel={SHELF_AVAILABILITY_COPY.loading}
        accessibilityLiveRegion="polite"
        className="flex-1 items-center justify-center px-7"
        style={{ backgroundColor: colors.paper }}
      >
        <Text variant="bodySm" tone="muted" className="text-center">
          {SHELF_AVAILABILITY_COPY.loading}
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
      <ShelfDataUnavailableNotice
        onRetry={query.refetch}
        retrying={query.isFetching}
        onExit={onExit}
        exitLabel={exitLabel}
      />
    </ScrollView>
  );
}
