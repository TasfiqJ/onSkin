import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { RouteIconButton, Sheet, Text } from '@/components/ui';
import { trackProductAddStarted } from '@/features/shelf/analytics';
import { useIntake } from '@/features/shelf/IntakeContext';
import { APP_SHELF_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

// A barcode miss is never a dead end. Contribution-back is not promised until
// the source workflow is approved.
export default function NoMatchScreen() {
  const { reset } = useIntake();

  const goOcr = () => {
    haptics.select();
    trackProductAddStarted('miss_label');
    reset({ addedVia: 'ocr' });
    router.replace('/shelf/ocr');
  };
  const goManual = () => {
    haptics.select();
    trackProductAddStarted('miss_manual');
    reset({ addedVia: 'manual' });
    router.replace('/shelf/manual');
  };

  return (
    <Sheet tone="night" fallbackRoute={APP_SHELF_ROUTE} scroll>
      <View className="mb-4 flex-row items-start justify-between">
        <View
          className="h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(244,239,231,0.08)' }}
        >
          <Text className="text-[18px]" tone="inverseMuted">
            ?
          </Text>
        </View>
        <RouteIconButton
          accessibilityLabel="Close"
          glyph="x"
          tone="night"
          onPress={() => backOrReplace(router, APP_SHELF_ROUTE)}
        />
      </View>
      <Text
        variant="title"
        tone="inverse"
        className="text-[30px] leading-[33px]"
        accessibilityRole="header"
      >
        We don&apos;t have this one yet.
      </Text>
      <Text variant="body" tone="inverseMuted" className="mt-2">
        That barcode isn&apos;t in our database yet. No problem. Add it another way, then report any
        wrong details from the product page.
      </Text>

      <View className="mt-6 gap-2.5">
        <Pressable
          accessibilityRole="button"
          onPress={goOcr}
          className="flex-row items-center gap-3.5 rounded-[18px] p-4"
          style={{ backgroundColor: 'rgba(244,239,231,0.08)' }}
        >
          <View className="h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-clay-bright/20">
            <Text className="font-sans-bold text-clay-bright">I</Text>
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
          style={{ backgroundColor: 'rgba(244,239,231,0.08)' }}
        >
          <View className="h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-clay-bright/20">
            <Text className="font-sans-bold text-clay-bright">+</Text>
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
          manual fallback keeps the shelf working
        </Text>
      </View>
    </Sheet>
  );
}
