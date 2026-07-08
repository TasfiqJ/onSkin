import { router } from 'expo-router';
import { Pressable, View, useWindowDimensions } from 'react-native';

import { RouteIconButton, Sheet, Text } from '@/components/ui';
import { trackProductAddStarted } from '@/features/shelf/analytics';
import { useIntake } from '@/features/shelf/IntakeContext';
import { cn } from '@/lib/cn';
import { APP_SHELF_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

// A barcode miss is never a dead end. Contribution-back is not promised until
// the source workflow is approved.
export default function NoMatchScreen() {
  const { reset } = useIntake();
  const { height } = useWindowDimensions();
  const shortPhone = height < 520;

  const goOcr = () => {
    haptics.select();
    trackProductAddStarted('miss_label');
    reset({ addedVia: 'ocr' });
    router.replace('/shelf/ocr');
  };
  const goSearch = () => {
    haptics.select();
    trackProductAddStarted('miss_search');
    reset({ addedVia: 'search' });
    router.replace('/shelf/search');
  };
  const goManual = () => {
    haptics.select();
    trackProductAddStarted('miss_manual');
    reset({ addedVia: 'manual' });
    router.replace('/shelf/manual');
  };

  return (
    <Sheet
      tone="night"
      fallbackRoute={APP_SHELF_ROUTE}
      scroll
      backdropAccessible={false}
      className={shortPhone ? 'px-6 pb-5 pt-3' : undefined}
    >
      <View className={cn(shortPhone ? 'mb-2' : 'mb-4', 'flex-row items-start justify-between')}>
        <View
          className={cn(
            shortPhone ? 'h-10 w-10' : 'h-12 w-12',
            'items-center justify-center rounded-full',
          )}
          style={{ backgroundColor: 'rgba(244,239,231,0.08)' }}
        >
          <Text className={shortPhone ? 'text-[16px]' : 'text-[18px]'} tone="inverseMuted">
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
        className={shortPhone ? 'text-[26px] leading-[29px]' : 'text-[30px] leading-[33px]'}
        accessibilityRole="header"
      >
        We don&apos;t have this one yet.
      </Text>
      <Text
        variant="body"
        tone="inverseMuted"
        className={shortPhone ? 'mt-1 text-[13px] leading-[19px]' : 'mt-2'}
      >
        That barcode isn&apos;t in our database yet. No problem. Add it another way, then report any
        wrong details from the product page.
      </Text>

      <View className={shortPhone ? 'mt-3 gap-1.5' : 'mt-4 gap-2'}>
        <NoMatchAction
          icon="S"
          title="Search catalog"
          subtitle="Try name or brand instead"
          compact={shortPhone}
          onPress={goSearch}
        />
        <NoMatchAction
          icon="I"
          title="Scan the ingredient list"
          subtitle="We'll read the INCI text"
          compact={shortPhone}
          onPress={goOcr}
        />
        <NoMatchAction
          icon="+"
          title="Add it by hand"
          subtitle="Always works, even offline"
          compact={shortPhone}
          onPress={goManual}
        />
      </View>

      {!shortPhone ? (
        <View className="mt-5 flex-row items-center justify-center gap-2">
          <View
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: colors.sageMuted }}
          />
          <Text variant="label" tone="inverseMuted">
            manual fallback keeps the shelf working
          </Text>
        </View>
      ) : null}
    </Sheet>
  );
}

function NoMatchAction({
  icon,
  title,
  subtitle,
  compact,
  onPress,
}: {
  icon: string;
  title: string;
  subtitle: string;
  compact: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={cn(
        compact ? 'min-h-[54px] gap-3 rounded-[16px] p-2.5' : 'gap-3.5 rounded-[18px] p-3',
        'flex-row items-center',
      )}
      style={{ backgroundColor: 'rgba(244,239,231,0.08)' }}
    >
      <View
        className={cn(
          compact ? 'h-8 w-8 rounded-[9px]' : 'h-[34px] w-[34px] rounded-[10px]',
          'items-center justify-center bg-clay-bright/20',
        )}
      >
        <Text className="font-sans-bold text-clay-bright">{icon}</Text>
      </View>
      <View className="flex-1">
        <Text
          variant="body"
          tone="inverse"
          className={
            compact ? 'text-[14px] leading-[18px] font-sans-semibold' : 'font-sans-semibold'
          }
        >
          {title}
        </Text>
        <Text
          variant="bodySm"
          tone="inverseMuted"
          className={compact ? 'text-[12px] leading-[16px]' : undefined}
        >
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}
