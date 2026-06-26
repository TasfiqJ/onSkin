import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Sheet, Text } from '@/components/ui';
import { useIntake } from '@/features/shelf/IntakeContext';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

// No-match fork (design screen 01, docs/04 §4.1). A barcode that isn't in Open
// Beauty Facts is never a dead end. Route to OCR or manual, and queue the unknown
// product for contribute-back (ODbL, §4.6). Calm, dark sheet.
export default function NoMatchScreen() {
  const { reset } = useIntake();

  const goOcr = () => {
    haptics.select();
    reset({ addedVia: 'ocr' });
    router.replace('/shelf/ocr');
  };
  const goManual = () => {
    haptics.select();
    reset({ addedVia: 'manual' });
    router.replace('/shelf/manual');
  };

  return (
    <Sheet tone="night">
      <View
        className="mb-4 h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: 'rgba(244,239,231,0.08)' }}>
        <Text className="text-[18px]" tone="inverseMuted">
          ⌕
        </Text>
      </View>
      <Text variant="title" tone="inverse" className="text-[30px] leading-[33px]" accessibilityRole="header">
        We don&apos;t have this one yet.
      </Text>
      <Text variant="body" tone="inverseMuted" className="mt-2">
        That barcode isn&apos;t in our database yet. No problem. Add it another way, and we&apos;ll
        add it back for everyone.
      </Text>

      <View className="mt-6 gap-2.5">
        <Pressable
          accessibilityRole="button"
          onPress={goOcr}
          className="flex-row items-center gap-3.5 rounded-[18px] p-4"
          style={{ backgroundColor: 'rgba(244,239,231,0.08)' }}>
          <View className="h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-clay-bright/20">
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
          <View className="h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-clay-bright/20">
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

      <View className="mt-5 flex-row items-center justify-center gap-2">
        <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.sageMuted }} />
        <Text variant="label" tone="inverseMuted">
          new products are contributed back to Open Beauty Facts
        </Text>
      </View>
    </Sheet>
  );
}
