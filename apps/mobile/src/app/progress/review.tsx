import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { PHOTO_COPY, QUALITY_NOTE } from '@/features/photos/copy';
import { localDay } from '@/features/photos/date';
import { reviewQuality } from '@/features/photos/quality';
import { parseLocalDate } from '@/features/photos/timeline';
import { usePhotoActions, usePhotos } from '@/features/photos/usePhotos';
import { ProGate } from '@/features/subscription/ProGate';
import { track } from '@/lib/analytics/track';
import { APP_PROGRESS_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import type { TimeOfDay } from '@onskin/types';

// Review & retake (docs/06 §2, design screen 02). Quality is FLAGGED, never blocked
// (D-029). The calm note compares to the series reference, and Save always works.

const BG = '#16130F';
const SAGE = '#9DB18A';

function fmt(ymd: string): string {
  return parseLocalDate(ymd).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function Chip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(22,19,15,0.78)',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
      }}
    >
      <View
        style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ok ? SAGE : '#D9A183' }}
      />
      <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 11.5, color: '#F4EFE7' }}>
        {label}
      </Text>
    </View>
  );
}

function ReviewScreenContent() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    alignment?: string;
    lighting?: string;
    headRoll?: string;
    headYaw?: string;
    headPitch?: string;
    captureSessionId?: string;
    capturedUri?: string;
    timeOfDay?: string;
    takenLocalDate?: string;
  }>();
  const alignment = Number(params.alignment ?? 0.9);
  const lighting = Number(params.lighting ?? 0.85);
  const headRoll = params.headRoll != null ? Number(params.headRoll) : null;
  const headYaw = params.headYaw != null ? Number(params.headYaw) : null;
  const headPitch = params.headPitch != null ? Number(params.headPitch) : null;
  const capturedUri = params.capturedUri ?? null;
  const timeOfDay = (params.timeOfDay as TimeOfDay) ?? null;
  const takenLocalDate = params.takenLocalDate ?? localDay();

  const { data } = usePhotos('front');
  const { add } = usePhotoActions();
  const refLighting = data?.reference?.lightingScore ?? null;
  const verdict = reviewQuality({ alignment, lighting, refLighting });
  const closeToProgress = () => {
    if (capturedUri) void FileSystem.deleteAsync(capturedUri, { idempotent: true });
    backOrReplace(router, APP_PROGRESS_ROUTE);
  };

  function save() {
    const wasEmpty = (data?.count ?? 0) === 0;
    add.mutate(
      {
        takenLocalDate,
        timeOfDay,
        alignmentScore: alignment,
        lightingScore: lighting,
        headRoll,
        headYaw,
        headPitch,
        captureSessionId: params.captureSessionId ?? null,
        localUri: capturedUri,
      },
      {
        onSettled: () => {
          track('photo_captured', { on_device: true, result: verdict.flag });
          if (wasEmpty) track('first_photo_captured');
          router.replace(APP_PROGRESS_ROUTE);
        },
      },
    );
  }

  return (
    <View
      style={{ flex: 1, backgroundColor: BG, paddingTop: insets.top + 16, paddingHorizontal: 24 }}
    >
      <Text
        variant="label"
        style={{ color: 'rgba(244,239,231,0.45)', textAlign: 'center', marginBottom: 18 }}
      >
        {`${PHOTO_COPY.review.eyebrow} · ${fmt(takenLocalDate)}`}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={closeToProgress}
        style={{
          position: 'absolute',
          left: 24,
          top: insets.top + 10,
          zIndex: 5,
          paddingVertical: 8,
          paddingRight: 12,
        }}
      >
        <Text
          style={{
            fontFamily: 'HankenGrotesk_600SemiBold',
            fontSize: 15,
            color: 'rgba(244,239,231,0.65)',
          }}
        >
          Close
        </Text>
      </Pressable>

      {/* captured photo */}
      <View
        style={{ height: 380, borderRadius: 24, overflow: 'hidden', backgroundColor: '#2A251E' }}
      >
        {capturedUri ? (
          <Image source={{ uri: capturedUri }} style={{ flex: 1 }} contentFit="cover" />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="label" style={{ color: 'rgba(244,239,231,0.3)' }}>
              your photo
            </Text>
          </View>
        )}
        <View style={{ position: 'absolute', left: 14, bottom: 14, flexDirection: 'row', gap: 8 }}>
          <Chip label="Aligned" ok={verdict.aligned} />
          <Chip label="Well-lit" ok={verdict.wellLit} />
        </View>
      </View>

      {/* calm quality note */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 11,
          marginVertical: 18,
          paddingVertical: 14,
          paddingHorizontal: 18,
          borderRadius: 16,
          backgroundColor: 'rgba(157,177,138,0.12)',
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: SAGE,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: BG, fontSize: 12 }}>✓</Text>
        </View>
        <Text
          style={{
            flex: 1,
            fontFamily: 'HankenGrotesk_400Regular',
            fontSize: 14,
            color: 'rgba(244,239,231,0.85)',
            lineHeight: 20,
          }}
        >
          {QUALITY_NOTE[verdict.flag]}
        </Text>
      </View>

      <View style={{ flex: 1 }} />

      <View style={{ flexDirection: 'row', gap: 12, paddingBottom: insets.bottom + 24 }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (capturedUri) void FileSystem.deleteAsync(capturedUri, { idempotent: true });
            router.replace('/progress/capture');
          }}
          style={{
            flex: 1,
            height: 56,
            borderRadius: 999,
            backgroundColor: 'rgba(244,239,231,0.1)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 16, color: '#F4EFE7' }}>
            {PHOTO_COPY.review.retake}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={add.isPending}
          onPress={save}
          style={{
            flex: 1.4,
            height: 56,
            borderRadius: 999,
            backgroundColor: '#F4EFE7',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: add.isPending ? 0.6 : 1,
          }}
        >
          <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 16, color: BG }}>
            {PHOTO_COPY.review.save}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function ReviewScreen() {
  return (
    <ProGate feature="photo_timeline">
      <ReviewScreenContent />
    </ProGate>
  );
}
