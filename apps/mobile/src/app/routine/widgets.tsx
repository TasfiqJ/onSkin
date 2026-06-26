import { router } from 'expo-router';
import { ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { useNotifPrefs, useUpdateNotifPrefs } from '@/features/notifications/useNotifications';
import { withProGate } from '@/features/subscription/ProGate';
import { colors } from '@/theme/tokens';

// Widgets & Live Activity (docs/07 §5/§6, design screens 05/06/07). These are the
// in-app PREVIEWS of the native home-screen widgets, the one-tap interactive
// check-off, and the PM Live Activity. The actual WidgetKit/Glance/ActivityKit
// surfaces need a custom dev build (B-WIDGETS); the live-activity OPT-IN is wired
// here. No react-native-svg in the project → geometric Views (e.g. the progress
// ring is approximated), per the established convention.

function Bars({ filled, total, on, off }: { filled: number; total: number; on: string; off: string }) {
  return (
    <View className="flex-row gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} className="h-[5px] flex-1 rounded-pill" style={{ backgroundColor: i < filled ? on : off }} />
      ))}
    </View>
  );
}

function WidgetsScreen() {
  const { data: p } = useNotifPrefs();
  const update = useUpdateNotifPrefs();

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.greige }} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-12">
        <View className="mb-1 flex-row items-center gap-3 pt-1">
          <Text accessibilityRole="button" onPress={() => router.back()} variant="body" style={{ fontSize: 22 }}>
            ‹
          </Text>
          <Text variant="title" style={{ fontSize: 28 }}>
            Widgets
          </Text>
        </View>
        <Text variant="bodySm" tone="muted" className="mb-5 ml-9">
          One to three things, readable in a glance. (Previews. The home-screen widgets arrive in the device build.)
        </Text>

        {/* Widget gallery (design 05) */}
        <View className="flex-row flex-wrap" style={{ gap: 14 }}>
          {/* Tonight (hero, clay ring) */}
          <View
            className="rounded-[22px] p-[18px]"
            style={{ width: '47%', aspectRatio: 1, backgroundColor: colors.paper, borderWidth: 2, borderColor: colors.clay }}>
            <Text variant="label" tone="clay" style={{ fontSize: 9.5 }}>
              TONIGHT
            </Text>
            <Text variant="titleSm" className="mt-1.5" style={{ fontSize: 24, lineHeight: 25 }}>
              Retinoid night
            </Text>
            <View className="flex-1" />
            <Bars filled={1} total={3} on={colors.clay} off={colors.greigeDeep} />
            <Text className="mt-2" style={{ fontSize: 11.5, color: colors.muted }}>
              1 of 3 done
            </Text>
          </View>
          {/* Today ring */}
          <View
            className="items-center justify-center rounded-[22px] p-[18px]"
            style={{ width: '47%', aspectRatio: 1, backgroundColor: colors.paper }}>
            <View className="h-[62px] w-[62px] items-center justify-center rounded-full" style={{ backgroundColor: colors.greigeDeep }}>
              <View className="h-[46px] w-[46px] items-center justify-center rounded-full" style={{ backgroundColor: colors.paper }}>
                <Text className="font-sans-bold" style={{ fontSize: 15 }}>
                  2/4
                </Text>
              </View>
            </View>
            <Text variant="bodySm" tone="muted" className="mt-2.5">
              Today
            </Text>
          </View>
          {/* Streak (dark) */}
          <View className="rounded-[22px] p-[18px]" style={{ width: '47%', aspectRatio: 1, backgroundColor: '#16130F' }}>
            <Text variant="label" style={{ fontSize: 9.5, color: colors.clayBright }}>
              STREAK
            </Text>
            <View className="mt-1.5 flex-row items-baseline gap-1">
              <Text style={{ fontSize: 34, fontWeight: '700', color: colors.cream, lineHeight: 36 }}>12</Text>
              <Text style={{ fontSize: 12, color: 'rgba(244,239,231,0.5)' }}>days</Text>
            </View>
            <View className="flex-1" />
            <View className="flex-row gap-1">
              {[true, true, false, true, true].map((on, i) => (
                <View key={i} className="aspect-square flex-1 rounded-[3px]" style={{ backgroundColor: on ? colors.clay : 'rgba(244,239,231,0.14)' }} />
              ))}
            </View>
            <Text className="mt-2" style={{ fontSize: 11.5, color: 'rgba(244,239,231,0.5)' }}>
              protected
            </Text>
          </View>
          {/* Cycle */}
          <View className="rounded-[22px] p-[18px]" style={{ width: '47%', aspectRatio: 1, backgroundColor: colors.paper }}>
            <Text variant="label" tone="clay" style={{ fontSize: 9.5 }}>
              CYCLE
            </Text>
            <Text className="mt-1.5 font-sans-bold" style={{ fontSize: 14 }}>
              Night 2 of 4
            </Text>
            <View className="flex-1 justify-end gap-1.5">
              <Bars filled={0} total={4} on={colors.clay} off={colors.greigeDeep} />
              <View style={{ position: 'absolute', left: 0, top: 0 }} />
              <Text variant="bodySm" tone="muted">
                Retinoid
              </Text>
            </View>
          </View>
        </View>

        {/* One-tap check-off (design 06) */}
        <Text variant="label" tone="muted" className="mb-2 ml-1 mt-6" style={{ fontSize: 10, letterSpacing: 1 }}>
          ONE-TAP CHECK-OFF
        </Text>
        <View className="rounded-[26px] bg-paper-raised p-5">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="font-sans-bold" style={{ fontSize: 15 }}>
              Morning routine
            </Text>
            <Text variant="label" tone="muted">
              2 of 4
            </Text>
          </View>
          {/* done */}
          <View className="flex-row items-center gap-3 py-2" style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(32,27,21,0.06)' }}>
            <View className="h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: colors.clay }}>
              <Text style={{ color: colors.paper, fontSize: 11 }}>✓</Text>
            </View>
            <Text style={{ color: colors.mutedLight, textDecorationLine: 'line-through', fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14 }}>
              Vitamin C serum
            </Text>
          </View>
          {/* tappable next */}
          <View className="flex-row items-center gap-3 py-2">
            <View className="h-6 w-6 rounded-full" style={{ borderWidth: 2, borderColor: colors.clay }} />
            <Text className="flex-1 font-sans-semibold" style={{ fontSize: 14 }}>
              Ceramide moisturizer
            </Text>
            <Text variant="label" tone="clay" style={{ fontSize: 10 }}>
              TAP
            </Text>
          </View>
          {/* todo */}
          <View className="flex-row items-center gap-3 py-2">
            <View className="h-6 w-6 rounded-full" style={{ borderWidth: 1.5, borderColor: 'rgba(32,27,21,0.18)' }} />
            <Text className="font-sans-semibold" style={{ fontSize: 14 }}>
              Mineral SPF 50
            </Text>
          </View>
        </View>
        <Text variant="bodySm" tone="muted" className="ml-1 mt-2.5">
          Check it off right from the home screen. No need to open the app (iOS 17 / Android).
        </Text>

        {/* Evening Live Activity (design 07) */}
        <Text variant="label" tone="muted" className="mb-2 ml-1 mt-6" style={{ fontSize: 10, letterSpacing: 1 }}>
          EVENING LIVE ACTIVITY
        </Text>
        <View className="rounded-card p-5" style={{ backgroundColor: '#16130F' }}>
          <View className="mb-3.5 flex-row items-center gap-3">
            <View className="h-[34px] w-[34px] items-center justify-center rounded-[10px]" style={{ backgroundColor: colors.clay }}>
              <View className="h-3 w-3 rounded-full" style={{ backgroundColor: colors.cream }} />
            </View>
            <View className="flex-1">
              <Text className="font-sans-bold" style={{ fontSize: 15, color: colors.cream }}>
                OnSkin · Retinoid night
              </Text>
              <Text style={{ fontSize: 12.5, color: 'rgba(244,239,231,0.55)', fontFamily: 'HankenGrotesk_400Regular' }}>
                Evening routine · 1 of 3
              </Text>
            </View>
            <Text variant="label" style={{ color: colors.clayBright, fontSize: 11 }}>
              NEXT
            </Text>
          </View>
          <Bars filled={1} total={3} on={colors.clayBright} off="rgba(244,239,231,0.18)" />
          <View className="mt-3.5 flex-row items-center gap-3">
            <View className="h-[22px] w-[22px] rounded-full" style={{ borderWidth: 2, borderColor: colors.clayBright }} />
            <View className="flex-1">
              <Text className="font-sans-semibold" style={{ fontSize: 14, color: colors.cream }}>
                Up next · Retinol 0.3% · pea-sized
              </Text>
            </View>
          </View>
        </View>
        <View className="mt-3 flex-row items-center justify-between rounded-[18px] bg-paper-raised px-[18px] py-3.5">
          <View className="flex-1 pr-3">
            <Text variant="body" className="font-sans-semibold">
              Show on the Lock Screen
            </Text>
            <Text variant="bodySm" tone="muted">
              Opt-in · starts at your PM reminder, ends when you’re done
            </Text>
          </View>
          <Switch
            value={p?.liveActivityEnabled ?? false}
            onValueChange={(v) => update.mutate({ liveActivityEnabled: v })}
            trackColor={{ true: colors.clay, false: '#D8D0C2' }}
            thumbColor={colors.paperRaised}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Widgets & Live Activity are part of the reminders/widgets value prop (docs/08 §2.2).
export default withProGate('reminders_widgets', WidgetsScreen);
