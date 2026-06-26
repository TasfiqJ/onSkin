import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { PHOTO_CAPTURE_CONSENT } from '@/features/onboarding/consentCopy';
import { grantPhotoCaptureConsent, hasPhotoCaptureConsent } from '@/features/photos/consent';
import { PHOTO_COPY } from '@/features/photos/copy';
import { localDay, timeOfDayNow } from '@/features/photos/date';
import { capturedSignals, demoReadySignals } from '@/features/photos/mockSignals';
import { coachingLine, lightingState } from '@/features/photos/quality';
import { haptics } from '@/theme/haptics';

// Guided capture (docs/06 §3, design screen 01). The dark palette keeps the face
// the brightest thing on screen. The live feed + on-device face-detection frame
// processor (alignment/pose/quality) + frame-buffer luminance check + auto-capture
// are the device-build pipeline (B-CAMERA); here the full designed chrome is
// rendered and the shutter performs a simulated capture so the timeline flow is
// exercisable end-to-end. NO faceprint is ever stored (docs/06 §7).

const BG = '#16130F'; // the photo design's near-black capture backdrop
const GUIDE = '#9DB18A'; // sage alignment guide
const READY = '#9DB18A';

function ConsentGate({ onGrant }: { onGrant: () => void }) {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10,8,6,0.92)', padding: 28, justifyContent: 'center' }}>
      <Text style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 30, color: '#F4EFE7', marginBottom: 16 }}>
        Your photos stay on this phone.
      </Text>
      {([['What', PHOTO_CAPTURE_CONSENT.what], ['Why', PHOTO_CAPTURE_CONSENT.why], ['Never', PHOTO_CAPTURE_CONSENT.never]] as const).map(
        ([k, v]) => (
          <View key={k} style={{ marginBottom: 14 }}>
            <Text variant="label" style={{ color: '#D9A183', marginBottom: 2 }}>
              {k.toUpperCase()}
            </Text>
            <Text style={{ fontFamily: 'HankenGrotesk_400Regular', fontSize: 14.5, color: 'rgba(244,239,231,0.85)', lineHeight: 21 }}>
              {v}
            </Text>
          </View>
        ),
      )}
      <Text style={{ fontFamily: 'IBMPlexMono_400Regular', fontSize: 11, color: 'rgba(244,239,231,0.45)', marginTop: 6, marginBottom: 14 }}>
        {PHOTO_CAPTURE_CONSENT.footnote}
      </Text>
      {/* Skin-prep guidance for comparable captures (docs/06 §3). */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 22 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#9DB18A' }} />
        <Text style={{ fontFamily: 'HankenGrotesk_500Medium', fontSize: 12.5, color: 'rgba(244,239,231,0.7)', flex: 1, lineHeight: 17 }}>
          {PHOTO_COPY.capture.skinPrep}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onGrant}
        style={{ height: 56, borderRadius: 999, backgroundColor: '#F4EFE7', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 16, color: BG }}>Take photos. On device only</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ marginTop: 12, alignItems: 'center' }}>
        <Text style={{ fontFamily: 'HankenGrotesk_500Medium', fontSize: 15, color: 'rgba(244,239,231,0.6)' }}>Not now</Text>
      </Pressable>
    </View>
  );
}

export default function CaptureScreen() {
  const insets = useSafeAreaInsets();
  const [consented, setConsented] = useState<boolean | null>(null);

  useEffect(() => {
    void hasPhotoCaptureConsent().then(setConsented);
  }, []);

  // The live chrome is driven by the REAL quality engine over a (mock until
  // B-CAMERA) signal, so the coaching line + lighting label/bar are computed, not
  // hardcoded. The live evolving pose stream arrives with the camera.
  const signals = useMemo(() => demoReadySignals(), []);
  const coaching = coachingLine(signals);
  const light = lightingState(signals);

  function capture() {
    // Never capture before the photo_capture consent is known + granted
    // (docs/06 §7). The gate below covers the loading window; this is the guard.
    if (consented !== true) return;
    haptics.success();
    // The captured frame's scores come from the engine over a slightly-varied
    // signal (B-CAMERA supplies the real on-device scores), so saved photos differ
    // and the review "darker than usual" comparison can fire across real captures,
    // instead of every photo getting two frozen constants.
    const shot = capturedSignals(Math.random());
    const alignment = shot.alignment;
    const lighting = lightingState(shot).fill;
    router.replace({
      pathname: '/progress/review',
      params: {
        alignment: String(alignment),
        lighting: String(lighting),
        timeOfDay: timeOfDayNow(),
        takenLocalDate: localDay(),
      },
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG, paddingTop: insets.top + 16 }}>
      {/* top chrome */}
      <View className="flex-row items-center justify-between px-6">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(244,239,231,0.12)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#F4EFE7', fontSize: 15 }}>✕</Text>
        </Pressable>
        <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14, color: '#F4EFE7' }}>Front · weekly</Text>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(244,239,231,0.12)' }} />
      </View>

      {/* face zone. Ghost + alignment guide + coaching */}
      <View className="flex-1 items-center justify-center">
        {/* ghost of the previous photo */}
        <View
          style={{ position: 'absolute', width: 210, height: 270, borderRadius: 130, backgroundColor: 'rgba(217,161,131,0.10)', transform: [{ translateX: 8 }, { translateY: -6 }] }}
        />
        {/* alignment guide */}
        <View
          style={{
            width: 218,
            height: 282,
            borderRadius: 130,
            borderWidth: 2,
            borderColor: 'rgba(157,177,138,0.85)',
            borderStyle: 'dashed',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <View style={{ position: 'absolute', top: -10, width: 8, height: 8, borderRadius: 4, backgroundColor: GUIDE }} />
          <Text style={{ fontFamily: 'IBMPlexMono_400Regular', fontSize: 10, color: 'rgba(244,239,231,0.4)', textAlign: 'center', lineHeight: 16 }}>
            {PHOTO_COPY.capture.ghostHint}
          </Text>
          <Text style={{ fontFamily: 'IBMPlexMono_400Regular', fontSize: 9, color: 'rgba(244,239,231,0.28)', textAlign: 'center', marginTop: 8 }}>
            preview · live in device build
          </Text>
        </View>
        {/* coaching line */}
        <View
          style={{ position: 'absolute', bottom: 18, backgroundColor: 'rgba(22,19,15,0.82)', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#D9A183' }} />
          <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14.5, color: '#F4EFE7' }}>{coaching}</Text>
        </View>
      </View>

      {/* bottom controls */}
      <View style={{ backgroundColor: 'rgba(22,19,15,0.9)', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 26, paddingTop: 20, paddingBottom: insets.bottom + 24 }}>
        <View className="mb-5 flex-row items-center" style={{ gap: 14 }}>
          <Text style={{ width: 58, fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 12.5, color: 'rgba(244,239,231,0.6)' }}>
            {PHOTO_COPY.capture.lightingLabel}
          </Text>
          <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(244,239,231,0.14)', overflow: 'hidden' }}>
            <View style={{ width: `${Math.round(light.fill * 100)}%`, height: '100%', backgroundColor: READY, borderRadius: 3 }} />
          </View>
          <Text style={{ fontFamily: 'HankenGrotesk_700Bold', fontSize: 13, color: READY }}>{light.label}</Text>
        </View>
        <View className="flex-row items-center justify-between">
          <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: 'rgba(244,239,231,0.1)' }} />
          {/* ready shutter. Auto-fires when matched (here: tap to capture) */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Capture photo"
            onPress={capture}
            style={{ width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: READY, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: READY, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: 'HankenGrotesk_700Bold', fontSize: 11, color: BG, textAlign: 'center', lineHeight: 13 }}>
                {PHOTO_COPY.capture.autoReady}
              </Text>
            </View>
          </Pressable>
          <Text style={{ width: 104, textAlign: 'right', fontFamily: 'IBMPlexMono_400Regular', fontSize: 10, lineHeight: 15, color: 'rgba(244,239,231,0.42)' }}>
            {PHOTO_COPY.capture.onDevice}
          </Text>
        </View>
      </View>

      {consented === false ? (
        <ConsentGate
          onGrant={() => {
            void grantPhotoCaptureConsent();
            setConsented(true);
          }}
        />
      ) : consented === null ? (
        // Block the shutter until the consent flag is known (fail closed, docs/06 §7).
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: BG }} />
      ) : null}
    </View>
  );
}
