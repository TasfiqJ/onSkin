import { useRef, useState, type ReactNode } from 'react';
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

export function PhotoStorageGate({ children, tone = 'night', onExit }: PhotoStorageGateProps) {
  const insets = useSafeAreaInsets();
  const source = usePhotos('front');
  const [retryFailed, setRetryFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const retryInFlight = useRef(false);
  const night = tone === 'night';
  const backgroundColor = night ? NIGHT_BG : colors.paper;
  const foregroundColor = night ? colors.cream : colors.ink;
  const mutedColor = night ? 'rgba(244,239,231,0.68)' : colors.muted;

  if (source.sourceReady && source.data !== undefined && source.isSourceCurrent()) {
    return children;
  }

  if (source.isLoading || source.isRefreshing || retrying) {
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
    if (retryInFlight.current) return;
    retryInFlight.current = true;
    setRetryFailed(false);
    setRetrying(true);
    try {
      await source.retry();
    } catch {
      setRetryFailed(true);
    } finally {
      retryInFlight.current = false;
      setRetrying(false);
    }
  }

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
          accessibilityState={{ disabled: retrying }}
          disabled={retrying}
          onPress={() => void retry()}
          className="min-h-[56px] items-center justify-center rounded-pill px-6 py-3"
          style={{
            backgroundColor: night ? colors.cream : colors.ink,
            opacity: retrying ? 0.68 : 1,
          }}
        >
          <Text
            className="font-sans-semibold"
            style={{ color: night ? NIGHT_BG : colors.paper, fontSize: 16 }}
          >
            {retrying ? PHOTO_COPY.storage.retrying : PHOTO_COPY.storage.retry}
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
