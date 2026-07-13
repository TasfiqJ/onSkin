import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { PHOTO_COPY } from '@/features/photos/copy';
import { useAppLock } from '@/lib/applock/AppLockProvider';
import { appLockUserMessage } from '@/lib/errors/userFacing';
import { colors } from '@/theme/tokens';

const BG = '#16130F';
const SAGE = '#9DB18A';

export function PhotoTimelineLockGate({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { appUnlocked, enabled, photoTimelineUnlocked, unlockPhotoTimeline } = useAppLock();
  const [lockFeedback, setLockFeedback] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const unlockInFlight = useRef(false);
  const locked = enabled && !photoTimelineUnlocked;

  const requestUnlock = useCallback(async () => {
    if (unlockInFlight.current) return;
    unlockInFlight.current = true;
    setUnlocking(true);
    try {
      const status = await unlockPhotoTimeline();
      if (status === 'success') setLockFeedback(null);
      else if (status === 'unavailable') setLockFeedback(appLockUserMessage());
    } finally {
      unlockInFlight.current = false;
      setUnlocking(false);
    }
  }, [unlockPhotoTimeline]);

  useEffect(() => {
    if (locked && appUnlocked) void requestUnlock();
  }, [appUnlocked, locked, requestUnlock]);

  if (!locked) return children;

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: BG, paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="flex-1 items-center justify-center px-7">
        <View
          className="mb-6 h-[78px] w-[78px] items-center justify-center rounded-[24px]"
          style={{ backgroundColor: 'rgba(244,239,231,0.1)' }}
        >
          <Text style={{ color: SAGE, fontSize: 30 }}>🔒</Text>
        </View>
        <Text
          variant="title"
          style={{ color: colors.cream, fontSize: 30, lineHeight: 33, textAlign: 'center' }}
        >
          {PHOTO_COPY.lock.title}
        </Text>
        <Text
          variant="bodySm"
          className="mt-2.5 text-center"
          style={{ color: 'rgba(244,239,231,0.6)', maxWidth: 280, lineHeight: 21 }}
        >
          {PHOTO_COPY.lock.body}
        </Text>
        {lockFeedback ? (
          <View
            className="mt-4 rounded-[16px] px-4 py-3"
            style={{
              maxWidth: 300,
              borderWidth: 1,
              borderColor: 'rgba(244,239,231,0.16)',
              backgroundColor: 'rgba(244,239,231,0.1)',
            }}
          >
            <Text
              accessibilityRole="alert"
              variant="bodySm"
              className="text-center"
              style={{ color: colors.cream, lineHeight: 20 }}
            >
              {lockFeedback}
            </Text>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={PHOTO_COPY.lock.unlock}
          accessibilityState={{ disabled: unlocking }}
          disabled={unlocking}
          onPress={() => {
            setLockFeedback(null);
            void requestUnlock();
          }}
          className={`${lockFeedback ? 'mt-5' : 'mt-7'} min-h-[52px] flex-row items-center justify-center rounded-pill px-8 py-3`}
          style={{ backgroundColor: colors.cream, opacity: unlocking ? 0.68 : 1 }}
        >
          <Text className="font-sans-semibold" style={{ color: BG, fontSize: 16 }}>
            {unlocking ? 'Unlocking...' : PHOTO_COPY.lock.unlock}
          </Text>
        </Pressable>
      </View>
      <View
        className="mb-10 flex-row items-center gap-3.5 rounded-[18px] p-4"
        style={{ backgroundColor: 'rgba(244,239,231,0.07)', marginHorizontal: 4 }}
      >
        <View className="flex-1">
          <Text className="font-sans-bold" style={{ color: colors.cream, fontSize: 14 }}>
            {PHOTO_COPY.lock.storageTitle}
          </Text>
          <Text
            style={{
              color: 'rgba(244,239,231,0.5)',
              fontSize: 12,
              lineHeight: 17,
              fontFamily: 'HankenGrotesk-Regular',
            }}
          >
            {PHOTO_COPY.lock.storageBody}
          </Text>
        </View>
      </View>
    </View>
  );
}
