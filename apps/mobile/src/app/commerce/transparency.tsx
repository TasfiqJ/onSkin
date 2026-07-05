import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { COMMERCE_COPY } from '@/features/commerce/copy';
import { LockGlyph } from '@/features/commerce/LockGlyph';
import { track } from '@/lib/analytics/track';
import { APP_YOU_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { colors } from '@/theme/tokens';

// Surface 03 (docs/10 §7). The transparency page. A Wirecutter-grade explainer of the
// church-and-state separation: the single highest-leverage trust artifact. Dark
// (#1B1813), calm, four numbered principles, the "sometimes we earn nothing" integrity
// standard, and the privacy footer ("we never send anything about your skin").
export default function TransparencyScreen() {
  useEffect(() => {
    track('transparency_viewed');
  }, []);

  return (
    <Screen tone="night" edges={['top']}>
      <View className="flex-row items-center gap-3 pb-2 pt-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => backOrReplace(router, APP_YOU_ROUTE)}
          className="h-7 w-7 items-center justify-center rounded-full"
          style={{ borderWidth: 1, borderColor: colors.hairlineDark }}
        >
          <Text style={{ color: colors.cream }}>‹</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
        <Text variant="label" className="mt-2" style={{ color: colors.clayBright }}>
          {COMMERCE_COPY.transparency.eyebrow}
        </Text>
        <Text
          variant="title"
          tone="inverse"
          className="mt-3.5 text-[31px] leading-[34px]"
          accessibilityRole="header"
        >
          {COMMERCE_COPY.transparency.title}
        </Text>

        <View className="mt-6 gap-[18px]">
          {COMMERCE_COPY.transparency.principles.map((p, i) => (
            <View key={p.title} className="flex-row gap-3.5">
              <Text
                className="font-mono text-[11px]"
                style={{ color: colors.clayBright, paddingTop: 2 }}
              >
                {String(i + 1).padStart(2, '0')}
              </Text>
              <View className="flex-1">
                <Text className="font-sans-bold text-[14.5px]" style={{ color: colors.cream }}>
                  {p.title}
                </Text>
                <Text
                  className="mt-1 text-[13px]"
                  style={{ color: 'rgba(244,239,231,0.66)', lineHeight: 20 }}
                >
                  {p.body}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View
          className="mt-8 flex-row items-center gap-2.5 pt-4"
          style={{ borderTopWidth: 1, borderTopColor: colors.hairlineDark }}
        >
          <LockGlyph size={13} color={colors.clayBright} />
          <Text
            className="flex-1 text-[12px]"
            style={{ color: 'rgba(244,239,231,0.6)', lineHeight: 17 }}
          >
            {COMMERCE_COPY.transparency.footer}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
