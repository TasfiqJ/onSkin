import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { PHOTO_COPY } from '@/features/photos/copy';
import { createPhotoShareFile, deletePhotoShareFile } from '@/features/photos/encryptedStorage';
import { PhotoImage } from '@/features/photos/PhotoImage';
import { parseLocalDate } from '@/features/photos/timeline';
import { usePhotoActions, usePhotos } from '@/features/photos/usePhotos';
import { ProGate } from '@/features/subscription/ProGate';
import { track } from '@/lib/analytics/track';
import { APP_PROGRESS_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';

// Single-photo detail (docs/06 §4, design screen 06). Date, quality, your note,
// set-reference, explicit photo share, delete. All on-device.

const BG = '#16130F';
const SAGE = '#9DB18A';

function PhotoDetailScreenContent() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = usePhotos('front');
  const { reference, remove, note } = usePhotoActions();
  const photo = data?.all.find((p) => p.id === id);
  const [draft, setDraft] = useState(photo?.notes ?? '');
  const closeToProgress = () => backOrReplace(router, APP_PROGRESS_ROUTE);

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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={closeToProgress}
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: 'rgba(244,239,231,0.12)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#F4EFE7', fontSize: 16 }}>{'<'}</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#F4EFE7' }}>Photo not found.</Text>
        </View>
      </View>
    );
  }

  const dateLabel = parseLocalDate(photo.takenLocalDate).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });
  const aligned = (photo.alignmentScore ?? 0) >= 0.85 && (photo.lightingScore ?? 0) >= 0.7;

  function confirmDelete() {
    Alert.alert('Delete this photo?', 'It’s removed from your phone. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => remove.mutate(id, { onSettled: closeToProgress }),
      },
    ]);
  }

  async function sharePhotoImageOnly() {
    if (photo?.localUri && (await Sharing.isAvailableAsync())) {
      let shareUri: string | null = null;
      try {
        shareUri = await createPhotoShareFile(photo.localUri, photo.id);
        await Sharing.shareAsync(shareUri);
      } finally {
        await deletePhotoShareFile(shareUri, photo.localUri);
      }
    } else {
      Alert.alert(PHOTO_COPY.detail.shareTitle, PHOTO_COPY.detail.shareUnavailable);
    }
  }

  function confirmShare() {
    Alert.alert(PHOTO_COPY.detail.shareTitle, PHOTO_COPY.detail.shareBody, [
      { text: 'Cancel', style: 'cancel' },
      { text: PHOTO_COPY.detail.shareConfirm, onPress: () => void sharePhotoImageOnly() },
    ]);
  }

  return (
    <View
      style={{ flex: 1, backgroundColor: BG, paddingTop: insets.top + 12, paddingHorizontal: 24 }}
    >
      <View className="mb-4 flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={closeToProgress}
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: 'rgba(244,239,231,0.12)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#F4EFE7', fontSize: 16 }}>‹</Text>
        </Pressable>
        <Text style={{ fontFamily: 'HankenGrotesk_700Bold', fontSize: 14, color: '#F4EFE7' }}>
          {dateLabel}
        </Text>
        <View style={{ width: 34 }} />
      </View>

      {/* photo */}
      <View
        style={{
          height: 330,
          borderRadius: 20,
          overflow: 'hidden',
          backgroundColor: '#2A251E',
          marginBottom: 14,
        }}
      >
        {photo.localUri ? (
          <PhotoImage uri={photo.localUri} style={{ flex: 1 }} />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="label" style={{ color: 'rgba(244,239,231,0.3)' }}>
              your photo
            </Text>
          </View>
        )}
      </View>

      {/* quality + time chips */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
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
              fontFamily: 'HankenGrotesk_600SemiBold',
              fontSize: 12,
              color: 'rgba(244,239,231,0.8)',
            }}
          >
            {aligned ? 'Aligned · well-lit' : 'Kept as taken'}
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
                fontFamily: 'HankenGrotesk_600SemiBold',
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
              style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 12, color: '#D9A183' }}
            >
              reference
            </Text>
          </View>
        ) : null}
      </View>

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
            fontFamily: 'HankenGrotesk_400Regular',
            fontSize: 13.5,
            color: 'rgba(244,239,231,0.85)',
            lineHeight: 20,
            minHeight: 24,
          }}
        />
      </View>

      {/* actions */}
      <View
        style={{ flexDirection: 'row', gap: 8, paddingTop: 16, paddingBottom: insets.bottom + 20 }}
      >
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
          <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 13, color: '#F4EFE7' }}>
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
    </View>
  );
}

export default function PhotoDetailScreen() {
  return (
    <ProGate feature="photo_timeline">
      <PhotoDetailScreenContent />
    </ProGate>
  );
}
