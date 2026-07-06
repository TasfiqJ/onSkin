import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { RouteIconButton, Screen, Text } from '@/components/ui';
import { COMMERCE_COPY } from '@/features/commerce/copy';
import { shippableStacks } from '@/features/commerce/stacks';
import { APP_YOU_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { colors } from '@/theme/tokens';

// The shoppable-stacks list (docs/10 §4). Expert/derm-reviewed routines as shoppable
// collections. Launch-gated (B-DERM-REVIEW). In production only reviewed stacks show;
// the honest empty state otherwise.
export default function StacksScreen() {
  const stacks = shippableStacks();

  return (
    <Screen edges={['top']}>
      <View className="flex-row items-center gap-3 pb-2 pt-1">
        <RouteIconButton
          accessibilityLabel="Back"
          onPress={() => backOrReplace(router, APP_YOU_ROUTE)}
        />
        <Text variant="body" className="font-sans-semibold" tone="muted">
          Shoppable routines
        </Text>
      </View>

      <Text variant="title" className="mt-2">
        Shoppable routines
      </Text>
      <Text variant="bodySm" tone="muted" className="mt-1.5">
        Expert-reviewed routines, in order. {COMMERCE_COPY.stack.subtitle.toLowerCase()}
      </Text>

      {stacks.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text variant="body" tone="muted" className="text-center">
            Reviewed routines are on the way. We publish them only after a dermatologist signs off.
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10 pt-5">
          {stacks.map((s) => (
            <Pressable
              key={s.slug}
              accessibilityRole="button"
              accessibilityLabel={s.title}
              onPress={() =>
                router.push({ pathname: '/commerce/stack/[slug]', params: { slug: s.slug } })
              }
              className="mb-3 rounded-card bg-paper-raised p-5"
              style={{ borderWidth: 1, borderColor: colors.hairline }}
            >
              <View
                className="mb-2.5 flex-row items-center gap-1.5 self-start rounded-pill px-3 py-1.5"
                style={{
                  backgroundColor: s.curatorKind === 'derm' ? colors.sageTint : colors.clayTint,
                }}
              >
                <Text
                  style={{
                    color: s.curatorKind === 'derm' ? colors.sage : colors.clay,
                    fontSize: 10,
                  }}
                >
                  ✦
                </Text>
                <Text
                  className="font-mono text-[10px]"
                  style={{ color: s.curatorKind === 'derm' ? colors.sageDeep : colors.clayDeep }}
                >
                  {COMMERCE_COPY.stack.chipFor(s.curatorKind)}
                </Text>
              </View>
              <Text variant="titleSm" className="text-[20px] leading-[24px]">
                {s.title}
              </Text>
              <Text variant="bodySm" tone="muted" className="mt-1">
                {s.items.length} products · {s.curator}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
