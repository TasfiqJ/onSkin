import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, StateLoading, StateNotice } from '@/components/ui';
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
  retryAccessibilityLabel = 'Retry loading private data',
}: {
  onRetry: () => Promise<RetryResult>;
  retrying: boolean;
  onExit?: () => void;
  exitLabel?: string;
  copy?: DataAvailabilityCopy;
  retryAccessibilityLabel?: string;
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
      <StateNotice
        kind="unavailable"
        presentation="plain"
        align="center"
        title={copy.title}
        body={copy.body}
        detail={retryFailed ? copy.retryFailed : null}
        accessibilityLabel={`${copy.eyebrow}. ${copy.title}`}
      >
        <View className="mt-7 w-full gap-2.5">
          <Button
            accessibilityLabel={retryAccessibilityLabel}
            disabled={retrying}
            label={retrying ? copy.retrying : copy.retry}
            onPress={() => void retry()}
          />
          {onExit ? (
            <Button
              className="min-h-[48px] py-3"
              label={exitLabel}
              onPress={onExit}
              variant="ghost"
            />
          ) : null}
        </View>
      </StateNotice>
    </View>
  );
}

export type ShelfAvailabilityQuery = Pick<
  ReturnType<typeof useShelf>,
  'isPending' | 'isError' | 'isFetching' | 'refetch'
>;

export type ShelfDataAvailabilityBoundaryProps = {
  query: ShelfAvailabilityQuery;
  children: ReactNode;
  onExit?: () => void;
  exitLabel?: string;
};

/** Render Shelf availability from a query already owned by the current route. */
export function ShelfDataAvailabilityBoundary({
  query,
  children,
  onExit,
  exitLabel,
}: ShelfDataAvailabilityBoundaryProps) {
  const insets = useSafeAreaInsets();

  if (!query.isPending && !query.isError) return children;

  if (query.isPending) {
    return (
      <View
        accessibilityLabel={SHELF_AVAILABILITY_COPY.loading}
        accessibilityLiveRegion="polite"
        className="flex-1 items-center justify-center px-7"
        style={{ backgroundColor: colors.paper }}
      >
        <StateLoading label={SHELF_AVAILABILITY_COPY.loading} />
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
        retryAccessibilityLabel="Retry loading private Shelf data"
      />
    </ScrollView>
  );
}

export type ShelfDataAvailabilityGateProps = Omit<ShelfDataAvailabilityBoundaryProps, 'query'>;

/** Standalone Shelf boundary. Route view models should pass their owned query above. */
export function ShelfDataAvailabilityGate(props: ShelfDataAvailabilityGateProps) {
  const query = useShelf();
  return <ShelfDataAvailabilityBoundary {...props} query={query} />;
}
