import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RouteIconButton, Text } from '@/components/ui';
import { PHOTO_COPY } from '@/features/photos/copy';
import { PhotoImage } from '@/features/photos/PhotoImage';
import { PhotoStorageGate } from '@/features/photos/PhotoStorageGate';
import { PhotoTimelineLockGate } from '@/features/photos/PhotoTimelineLockGate';
import { purgeSensitiveImageMemory } from '@/features/photos/sensitiveImageMemory';
import { sharePhotoImageOnly } from '@/features/photos/sharePhoto';
import { parseLocalDate } from '@/features/photos/timeline';
import { usePhotoActions, usePhotos } from '@/features/photos/usePhotos';
import { ProGate } from '@/features/subscription/ProGate';
import {
  motionAllowed,
  useReduceMotionPreference,
} from '@/lib/accessibility/useReduceMotionPreference';
import { track } from '@/lib/analytics/track';
import { APP_PROGRESS_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';

// Single-photo detail (docs/06 §4, design screen 06). Date, quality, your note,
// set-reference, explicit photo share, delete. All on-device.

const BG = '#16130F';
const SAGE = '#9DB18A';

function e2ePhotoDeleteFailure(): boolean {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return false;
  return process.env.EXPO_PUBLIC_E2E_PHOTO_DELETE_FAILURE === '1';
}

function PhotoDetailScreenContent() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotionPreference();
  const { height } = useWindowDimensions();
  const compact = height < 640;
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = usePhotos('front');
  const { reference, remove, note } = usePhotoActions();
  const photo = data?.all.find((p) => p.id === id);
  const [draft, setDraft] = useState(photo?.notes ?? '');
  const [shareConfirmVisible, setShareConfirmVisible] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const closeToProgress = () => backOrReplace(router, APP_PROGRESS_ROUTE);

  // Missing-photo UI is only valid after a current authoritative store read.
  // PhotoStorageGate owns loading/unavailable/retry presentation.
  if (!data) return null;

  if (!photo) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: BG,
          paddingTop: insets.top + 12,
          paddingHorizontal: 24,
        }}
      >
        <RouteIconButton
          accessibilityLabel="Back"
          onPress={closeToProgress}
          tone="night"
          style={{
            backgroundColor: 'rgba(244,239,231,0.12)',
            borderColor: 'transparent',
          }}
        />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingTop: compact ? 56 : 72,
            paddingBottom: insets.bottom + (compact ? 18 : 28),
          }}
        >
          <View style={{ gap: compact ? 12 : 14, paddingVertical: compact ? 18 : 24 }}>
            <Text variant="label" style={{ color: 'rgba(244,239,231,0.48)', textAlign: 'center' }}>
              {PHOTO_COPY.detail.missingEyebrow}
            </Text>
            <Text
              style={{
                fontFamily: 'HankenGrotesk-SemiBold',
                fontSize: compact ? 23 : 26,
                lineHeight: compact ? 29 : 32,
                color: '#F4EFE7',
                textAlign: 'center',
              }}
            >
              {PHOTO_COPY.detail.missingTitle}
            </Text>
            <Text
              style={{
                fontFamily: 'HankenGrotesk-Regular',
                fontSize: 15,
                lineHeight: 22,
                color: 'rgba(244,239,231,0.76)',
                textAlign: 'center',
              }}
            >
              {PHOTO_COPY.detail.missingBody}
            </Text>
          </View>

          <View style={{ gap: 12, marginTop: compact ? 8 : 16 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/progress/capture')}
              style={{
                minHeight: 56,
                borderRadius: 999,
                backgroundColor: '#F4EFE7',
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 18,
                paddingVertical: 12,
              }}
            >
              <Text style={{ fontFamily: 'HankenGrotesk-SemiBold', fontSize: 16, color: BG }}>
                {PHOTO_COPY.detail.missingCapture}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={closeToProgress}
              style={{
                minHeight: 56,
                borderRadius: 999,
                backgroundColor: 'rgba(244,239,231,0.1)',
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 18,
                paddingVertical: 12,
              }}
            >
              <Text
                style={{
                  fontFamily: 'HankenGrotesk-SemiBold',
                  fontSize: 16,
                  color: '#F4EFE7',
                }}
              >
                {PHOTO_COPY.detail.missingBack}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  const dateLabel = parseLocalDate(photo.takenLocalDate).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });
  const captureQualityLabel =
    photo.qualitySource === 'post_capture_measurement'
      ? 'Capture checks recorded'
      : 'Quality not measured';
  const photoHeight = compact ? Math.min(240, Math.round(height * 0.38)) : 330;
  const actionFeedback = deleteFeedback ?? shareFeedback;

  function nudgeActionFeedbackIntoView() {
    const scrollToEnd = () =>
      scrollRef.current?.scrollToEnd({ animated: motionAllowed(reduceMotion) });
    requestAnimationFrame(scrollToEnd);
    setTimeout(scrollToEnd, 120);
    setTimeout(scrollToEnd, 280);
  }

  function confirmDelete() {
    setShareConfirmVisible(false);
    setShareFeedback(null);
    setDeleteFeedback(null);
    setDeleteConfirmVisible(true);
  }

  async function deleteCurrentPhoto() {
    if (!photo) return;
    setDeleteFeedback(null);
    setDeleteConfirmVisible(false);
    try {
      if (e2ePhotoDeleteFailure()) throw new Error('E2E_PHOTO_DELETE_FAILURE');
      await remove.mutateAsync(id);
      // Do not leave the deleted-photo surface until the native decoded cache
      // has answered. A failed clear remains fail-closed in the lifecycle gate.
      await purgeSensitiveImageMemory();
      closeToProgress();
    } catch {
      setDeleteFeedback(PHOTO_COPY.detail.deleteUnavailable);
      nudgeActionFeedbackIntoView();
    }
  }

  async function shareCurrentPhoto() {
    if (!photo) return;
    setDeleteFeedback(null);
    setShareFeedback(null);
    setShareConfirmVisible(false);
    const shared = await sharePhotoImageOnly(photo);
    if (!shared) {
      setShareFeedback(PHOTO_COPY.detail.shareUnavailable);
      nudgeActionFeedbackIntoView();
    }
  }

  function confirmShare() {
    setDeleteConfirmVisible(false);
    setDeleteFeedback(null);
    setShareFeedback(null);
    setShareConfirmVisible(true);
  }

  return (
    <View
      style={{ flex: 1, backgroundColor: BG, paddingTop: insets.top + 12, paddingHorizontal: 24 }}
    >
      <View className="mb-4 flex-row items-center justify-between">
        <RouteIconButton
          accessibilityLabel="Back"
          onPress={closeToProgress}
          tone="night"
          style={{
            backgroundColor: 'rgba(244,239,231,0.12)',
            borderColor: 'transparent',
          }}
        />
        <Text style={{ fontFamily: 'HankenGrotesk-Bold', fontSize: 14, color: '#F4EFE7' }}>
          {dateLabel}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 20 }}
      >
        {/* photo */}
        <View
          style={{
            height: photoHeight,
            borderRadius: 20,
            overflow: 'hidden',
            backgroundColor: '#2A251E',
            marginBottom: compact ? 10 : 14,
          }}
        >
          {photo.localUri ? (
            <PhotoImage
              uri={photo.localUri}
              photoId={photo.id}
              captureSessionId={photo.captureSessionId}
              rendition="display"
              requestPriority="interactive"
              style={{ flex: 1 }}
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="label" style={{ color: 'rgba(244,239,231,0.3)' }}>
                your photo
              </Text>
            </View>
          )}
        </View>

        {/* quality + time chips */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: 'rgba(244,239,231,0.08)',
              borderRadius: 999,
              paddingHorizontal: 13,
              paddingVertical: 7,
            }}
          >
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: SAGE }} />
            <Text
              style={{
                fontFamily: 'HankenGrotesk-SemiBold',
                fontSize: 12,
                color: 'rgba(244,239,231,0.8)',
              }}
            >
              {captureQualityLabel}
            </Text>
          </View>
          {photo.timeOfDay ? (
            <View
              style={{
                backgroundColor: 'rgba(244,239,231,0.08)',
                borderRadius: 999,
                paddingHorizontal: 13,
                paddingVertical: 7,
              }}
            >
              <Text
                style={{
                  fontFamily: 'HankenGrotesk-SemiBold',
                  fontSize: 12,
                  color: 'rgba(244,239,231,0.8)',
                }}
              >
                {photo.timeOfDay}
              </Text>
            </View>
          ) : null}
          {photo.isReference ? (
            <View
              style={{
                backgroundColor: 'rgba(176,122,60,0.18)',
                borderRadius: 999,
                paddingHorizontal: 13,
                paddingVertical: 7,
              }}
            >
              <Text
                style={{ fontFamily: 'HankenGrotesk-SemiBold', fontSize: 12, color: '#D9A183' }}
              >
                reference
              </Text>
            </View>
          ) : null}
        </View>

        {actionFeedback ? (
          <View
            accessibilityRole="alert"
            style={{
              backgroundColor: '#211C16',
              borderColor: 'rgba(244,239,231,0.14)',
              borderRadius: 16,
              borderWidth: 1,
              marginBottom: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
            }}
          >
            <Text
              style={{
                color: 'rgba(244,239,231,0.84)',
                fontFamily: 'HankenGrotesk-Regular',
                fontSize: 13,
                lineHeight: 18,
                textAlign: 'center',
              }}
            >
              {actionFeedback}
            </Text>
          </View>
        ) : null}

        {/* note */}
        <View
          style={{
            borderRadius: 16,
            backgroundColor: 'rgba(244,239,231,0.06)',
            padding: 16,
            marginBottom: 'auto',
          }}
        >
          <Text variant="label" style={{ color: 'rgba(244,239,231,0.4)', marginBottom: 6 }}>
            {PHOTO_COPY.detail.noteLabel.toUpperCase()}
          </Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onBlur={() => note.mutate({ id, notes: draft })}
            placeholder={PHOTO_COPY.detail.notePlaceholder}
            placeholderTextColor="rgba(244,239,231,0.35)"
            multiline
            style={{
              fontFamily: 'HankenGrotesk-Regular',
              fontSize: 13.5,
              color: 'rgba(244,239,231,0.85)',
              lineHeight: 20,
              minHeight: 24,
            }}
          />
        </View>

        {!shareConfirmVisible && !deleteConfirmVisible ? (
          <View style={{ flexDirection: 'row', gap: 8, paddingTop: 16 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                haptics.select();
                reference.mutate(id);
                track('reference_reset');
              }}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 13,
                backgroundColor: 'rgba(244,239,231,0.1)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{ fontFamily: 'HankenGrotesk-SemiBold', fontSize: 13, color: '#F4EFE7' }}
              >
                {PHOTO_COPY.detail.setReference}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={PHOTO_COPY.detail.shareLabel}
              onPress={confirmShare}
              style={{
                width: 48,
                height: 48,
                borderRadius: 13,
                backgroundColor: 'rgba(244,239,231,0.1)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#F4EFE7', fontSize: 16 }}>↗</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete photo"
              onPress={confirmDelete}
              style={{
                width: 48,
                height: 48,
                borderRadius: 13,
                backgroundColor: 'rgba(176,122,60,0.18)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#D9A183', fontSize: 16 }}>🗑</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
      {shareConfirmVisible ? (
        <View
          style={{
            position: 'absolute',
            left: 24,
            right: 24,
            bottom: insets.bottom + 20,
            backgroundColor: '#211C16',
            borderColor: 'rgba(244,239,231,0.16)',
            borderRadius: 18,
            borderWidth: 1,
            padding: 14,
          }}
        >
          <Text
            style={{
              color: '#F4EFE7',
              fontFamily: 'HankenGrotesk-SemiBold',
              fontSize: 14,
              lineHeight: 19,
            }}
          >
            {PHOTO_COPY.detail.shareTitle}
          </Text>
          <Text
            style={{
              color: 'rgba(244,239,231,0.76)',
              fontFamily: 'HankenGrotesk-Regular',
              fontSize: 13,
              lineHeight: 18,
              marginTop: 4,
            }}
          >
            {PHOTO_COPY.detail.shareBody}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShareConfirmVisible(false)}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 13,
                backgroundColor: 'rgba(244,239,231,0.08)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: 'rgba(244,239,231,0.82)',
                  fontFamily: 'HankenGrotesk-SemiBold',
                  fontSize: 13,
                }}
              >
                Cancel
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void shareCurrentPhoto()}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 13,
                backgroundColor: '#F4EFE7',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: BG,
                  fontFamily: 'HankenGrotesk-SemiBold',
                  fontSize: 13,
                }}
              >
                {PHOTO_COPY.detail.shareConfirm}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {deleteConfirmVisible ? (
        <View
          style={{
            position: 'absolute',
            left: 24,
            right: 24,
            bottom: insets.bottom + 20,
            backgroundColor: '#211C16',
            borderColor: 'rgba(244,239,231,0.16)',
            borderRadius: 18,
            borderWidth: 1,
            padding: 14,
          }}
        >
          <Text
            style={{
              color: '#F4EFE7',
              fontFamily: 'HankenGrotesk-SemiBold',
              fontSize: 14,
              lineHeight: 19,
            }}
          >
            {PHOTO_COPY.detail.deleteTitle}
          </Text>
          <Text
            style={{
              color: 'rgba(244,239,231,0.76)',
              fontFamily: 'HankenGrotesk-Regular',
              fontSize: 13,
              lineHeight: 18,
              marginTop: 4,
            }}
          >
            {PHOTO_COPY.detail.deleteBody}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: remove.isPending }}
              disabled={remove.isPending}
              onPress={() => setDeleteConfirmVisible(false)}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 13,
                backgroundColor: 'rgba(244,239,231,0.08)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: 'rgba(244,239,231,0.82)',
                  fontFamily: 'HankenGrotesk-SemiBold',
                  fontSize: 13,
                }}
              >
                Cancel
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: remove.isPending }}
              disabled={remove.isPending}
              onPress={() => void deleteCurrentPhoto()}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 13,
                backgroundColor: '#D9A183',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: BG,
                  fontFamily: 'HankenGrotesk-SemiBold',
                  fontSize: 13,
                }}
              >
                {remove.isPending ? 'Deleting...' : PHOTO_COPY.detail.deleteConfirm}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function PhotoDetailScreen() {
  return (
    <ProGate feature="photo_timeline">
      <PhotoTimelineLockGate>
        <PhotoStorageGate onExit={() => router.replace(APP_PROGRESS_ROUTE)}>
          <PhotoDetailScreenContent />
        </PhotoStorageGate>
      </PhotoTimelineLockGate>
    </ProGate>
  );
}
