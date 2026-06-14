import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { useIntake } from '@/features/shelf/IntakeContext';
import { haptics } from '@/theme/haptics';

// Barcode scan entry (docs/04 §4.1). The on-device camera read → Open Beauty Facts
// lookup (one call per scan) is the hero, but the live camera + OBF API + catalog
// seed are blocked (B-CATALOG-SEED + native camera, shared with the photo slice).
// This screen renders the on-device framing promise and routes to the always-
// available fallbacks (OCR / manual) and, for an unknown barcode, the no-match
// fork. So no path ever dead-ends.
export default function ScanScreen() {
  const { reset } = useIntake();

  const goManual = () => {
    haptics.select();
    reset({ addedVia: 'manual' });
    router.push('/shelf/manual');
  };
  const goOcr = () => {
    haptics.select();
    reset({ addedVia: 'ocr' });
    router.push('/shelf/ocr');
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-night">
      {/* Camera viewport placeholder with a framing reticle. */}
      <View className="flex-1 px-6">
        <View className="mt-2 flex-row items-center justify-between">
          <Pressable accessibilityRole="button" onPress={() => router.back()} className="py-2">
            <Text className="font-sans-semibold text-[15px]" tone="inverseMuted">
              Close
            </Text>
          </Pressable>
          <Text variant="label" tone="inverseMuted">
            torch
          </Text>
        </View>

        <View className="flex-1 items-center justify-center">
          <View
            className="h-40 w-72 rounded-2xl"
            style={{ borderWidth: 2, borderColor: 'rgba(244,239,231,0.55)' }}
          />
          <Text variant="body" tone="inverseMuted" className="mt-6">
            Line up the barcode
          </Text>
          <View className="mt-3 flex-row items-center gap-2">
            <View className="h-1.5 w-1.5 rounded-full bg-clay-bright" />
            <Text variant="label" tone="inverseMuted">
              Scanning happens on your device
            </Text>
          </View>
        </View>
      </View>

      {/* Fallback sheet. The floor under the hero (docs/04 §4.2-§4.4). */}
      <View className="rounded-t-sheet bg-night-surface px-7 pb-10 pt-6">
        <Text variant="bodySm" tone="inverseMuted" className="mb-4">
          Live barcode scanning arrives with the camera build. Until then, add a product another
          way. These always work.
        </Text>
        <View className="gap-2.5">
          <Pressable
            accessibilityRole="button"
            onPress={goOcr}
            className="flex-row items-center gap-3.5 rounded-[18px] p-4"
            style={{ backgroundColor: 'rgba(244,239,231,0.08)' }}>
            <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-clay-bright/20">
              <Text className="font-sans-bold text-clay-bright">≡</Text>
            </View>
            <View className="flex-1">
              <Text variant="body" tone="inverse" className="font-sans-semibold">
                Scan the ingredient list
              </Text>
              <Text variant="bodySm" tone="inverseMuted">
                We&apos;ll read the INCI text
              </Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={goManual}
            className="flex-row items-center gap-3.5 rounded-[18px] p-4"
            style={{ backgroundColor: 'rgba(244,239,231,0.08)' }}>
            <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-clay-bright/20">
              <Text className="font-sans-bold text-clay-bright">✎</Text>
            </View>
            <View className="flex-1">
              <Text variant="body" tone="inverse" className="font-sans-semibold">
                Add it by hand
              </Text>
              <Text variant="bodySm" tone="inverseMuted">
                Always works, even offline
              </Text>
            </View>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          className="mt-5 items-center py-1"
          onPress={() => {
            haptics.select();
            router.push('/shelf/no-match');
          }}>
          <Text variant="label" tone="inverseMuted">
            Preview: product not found →
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
