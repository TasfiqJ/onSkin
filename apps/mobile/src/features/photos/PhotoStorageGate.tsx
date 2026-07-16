import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { PHOTO_COPY } from '@/features/photos/copy';
import { usePhotos } from '@/features/photos/usePhotos';
import { colors } from '@/theme/tokens';

const NIGHT_BG = '#16130F';

type PhotoStorageGateProps = {
  children: ReactNode;
  tone?: 'night' | 'paper';
  onExit?: () => void;
};

export type PhotoStorageQuery = Pick<
  ReturnType<typeof usePhotos>,
  'isError' | 'isFetchedAfterMount' | 'isFetching' | 'isPending' | 'refetch'
>;

export type PhotoStorageBoundaryProps = PhotoStorageGateProps & {
  query: PhotoStorageQuery;
};

/** Render storage availability from the photo query already owned by a route. */
export function PhotoStorageBoundary({
  children,
  query,
  tone = 'night',
  onExit,
}: PhotoStorageBoundaryProps) {
  const insets = useSafeAreaInsets();
  const { isError, isFetchedAfterMount, isFetching, isPending, refetch } = query;
  const validationAttemptRef = useRef(0);
  const mountedRef = useRef(false);
  const [entryRefetch] = useState<PhotoStorageQuery['refetch']>(() => refetch);
  const [forceValidationOnMount] = useState(
    () => !isError && !isFetchedAfterMount && !isFetching && !isPending,
  );
  const [entryValidation, setEntryValidation] = useState<
    'observing' | 'forcing' | 'failed' | 'validated'
  >(
    isError && !isFetching && !isPending
      ? 'failed'
      : forceValidationOnMount
        ? 'forcing'
        : 'observing',
  );
  const [retryInFlight, setRetryInFlight] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const night = tone === 'night';
  const backgroundColor = night ? NIGHT_BG : colors.paper;
  const foregroundColor = night ? colors.cream : colors.ink;
  const mutedColor = night ? 'rgba(244,239,231,0.68)' : colors.muted;

  useEffect(() => {
    mountedRef.current = true;
    if (!forceValidationOnMount) {
      return () => {
        mountedRef.current = false;
        validationAttemptRef.current += 1;
      };
    }

    const attempt = ++validationAttemptRef.current;

    async function validateEntry() {
      try {
        const result = await entryRefetch();
        if (!mountedRef.current || attempt !== validationAttemptRef.current) return;
        setEntryValidation(result.isError ? 'failed' : 'validated');
      } catch {
        if (!mountedRef.current || attempt !== validationAttemptRef.current) return;
        setEntryValidation('failed');
      }
    }

    void validateEntry();

    return () => {
      mountedRef.current = false;
      validationAttemptRef.current += 1;
    };
  }, [entryRefetch, forceValidationOnMount]);

  useEffect(() => {
    if (entryValidation !== 'observing' || !isFetchedAfterMount || isFetching || isPending) {
      return;
    }

    let active = true;
    const outcome = isError ? 'failed' : 'validated';
    void Promise.resolve().then(() => {
      if (active) setEntryValidation(outcome);
    });

    return () => {
      active = false;
    };
  }, [entryValidation, isError, isFetchedAfterMount, isFetching, isPending]);

  const entryValidated = entryValidation === 'validated';
  const showInitialLoading = entryValidation === 'forcing' || entryValidation === 'observing';
  const showQueryLoading = entryValidated && isPending;
  const storageUnavailable = entryValidation === 'failed' || isError || retryInFlight;

  if (entryValidated && !isPending && !storageUnavailable) return children;

  if (showInitialLoading || showQueryLoading) {
    return (
      <View
        accessibilityLabel={PHOTO_COPY.storage.loading}
        accessibilityLiveRegion="polite"
        className="flex-1 items-center justify-center px-7"
        style={{ backgroundColor }}
      >
        <Text variant="bodySm" style={{ color: mutedColor, textAlign: 'center' }}>
          {PHOTO_COPY.storage.loading}
        </Text>
      </View>
    );
  }

  async function retry() {
    if (isFetching || retryInFlight) return;
    const attempt = ++validationAttemptRef.current;
    setRetryFailed(false);
    setRetryInFlight(true);

    try {
      const result = await refetch();
      if (!mountedRef.current || attempt !== validationAttemptRef.current) return;
      if (result.isError) {
        setEntryValidation('failed');
        setRetryFailed(true);
      } else {
        setEntryValidation('validated');
      }
    } catch {
      if (!mountedRef.current || attempt !== validationAttemptRef.current) return;
      setEntryValidation('failed');
      setRetryFailed(true);
    } finally {
      if (mountedRef.current && attempt === validationAttemptRef.current) {
        setRetryInFlight(false);
      }
    }
  }

  const retryBusy = isFetching || retryInFlight;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 28,
        paddingTop: insets.top + 32,
        paddingBottom: insets.bottom + (night ? 32 : 120),
      }}
      showsVerticalScrollIndicator={false}
    >
      <View accessibilityLiveRegion="polite" accessibilityRole="alert">
        <Text
          variant="label"
          style={{ color: night ? 'rgba(244,239,231,0.48)' : colors.clayDeep, textAlign: 'center' }}
        >
          {PHOTO_COPY.storage.eyebrow}
        </Text>
        <Text
          variant="title"
          className="mt-3"
          style={{ color: foregroundColor, fontSize: 30, lineHeight: 34, textAlign: 'center' }}
        >
          {PHOTO_COPY.storage.title}
        </Text>
        <Text
          variant="bodySm"
          className="mt-3 text-center"
          style={{ color: mutedColor, lineHeight: 22 }}
        >
          {PHOTO_COPY.storage.body}
        </Text>
        {retryFailed ? (
          <Text
            variant="bodySm"
            className="mt-3 text-center"
            style={{ color: foregroundColor, lineHeight: 20 }}
          >
            {PHOTO_COPY.storage.retryFailed}
          </Text>
        ) : null}
      </View>

      <View className="mt-7 gap-2.5">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: retryBusy }}
          disabled={retryBusy}
          onPress={() => void retry()}
          className="min-h-[56px] items-center justify-center rounded-pill px-6 py-3"
          style={{
            backgroundColor: night ? colors.cream : colors.ink,
            opacity: retryBusy ? 0.68 : 1,
          }}
        >
          <Text
            className="font-sans-semibold"
            style={{ color: night ? NIGHT_BG : colors.paper, fontSize: 16 }}
          >
            {retryBusy ? PHOTO_COPY.storage.retrying : PHOTO_COPY.storage.retry}
          </Text>
        </Pressable>
        {onExit ? (
          <Pressable
            accessibilityRole="button"
            onPress={onExit}
            className="min-h-[48px] items-center justify-center rounded-pill px-6 py-3"
            style={{
              backgroundColor: night ? 'rgba(244,239,231,0.1)' : colors.paperRaised,
              borderColor: night ? 'rgba(244,239,231,0.12)' : colors.hairlineStrong,
              borderWidth: 1,
            }}
          >
            <Text className="font-sans-semibold" style={{ color: foregroundColor, fontSize: 15 }}>
              {PHOTO_COPY.storage.exit}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

/** Standalone boundary retained for direct routes that do not own a photo source. */
export function PhotoStorageGate(props: PhotoStorageGateProps) {
  const query = usePhotos('front');
  return <PhotoStorageBoundary {...props} query={query} />;
}
