import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { colors } from '@/theme/tokens';

// 10 · Widgets + Live Activity (design 10, docs/03 §9.9). Lock-screen Live Activity
// for the in-progress evening routine + two home-screen widgets (tonight's step +
// the protected streak). Platform-gated (iOS WidgetKit/ActivityKit; Android
// equivalents) — re-verify at build (docs/00 §6, B-VERIFY at build). This is the
// design preview of those native surfaces. (Gradient/blur approximated.)
function Segments({ filled, total, color }: { filled: number; total: number; color: string }) {
  return (
    <View className="flex-row gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className="h-[5px] flex-1 rounded-pill"
          style={{ backgroundColor: i < filled ? color : 'rgba(244,239,231,0.18)' }}
        />
      ))}
    </View>
  );
}

export default function WidgetsScreen() {
  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#201B15' }}>
      <View className="flex-1 items-center px-6 pt-10">
        {/* Lock-screen clock */}
        <Text className="font-mono text-[13px] tracking-[1px]" style={{ color: 'rgba(244,239,231,0.55)' }}>
          THU 13 JUNE
        </Text>
        <Text className="mt-1 text-[78px]" style={{ color: colors.cream, fontWeight: '600', lineHeight: 80 }}>
          9:41
        </Text>

        {/* Live Activity */}
        <View
          className="mt-10 w-full rounded-card p-5"
          style={{ backgroundColor: 'rgba(244,239,231,0.1)', borderWidth: 1, borderColor: 'rgba(244,239,231,0.12)' }}>
          <View className="mb-3.5 flex-row items-center gap-3">
            <View className="h-8 w-8 items-center justify-center rounded-[9px]" style={{ backgroundColor: colors.clay }}>
              <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.cream }} />
            </View>
            <View className="flex-1">
              <Text className="font-sans-bold text-[14px]" style={{ color: colors.cream }}>
                OnSkin · Retinoid night
              </Text>
              <Text className="text-[12px]" style={{ color: 'rgba(244,239,231,0.55)' }}>
                Evening routine · 1 of 3
              </Text>
            </View>
            <Text className="font-mono text-[11px]" style={{ color: colors.clayBright }}>
              NEXT
            </Text>
          </View>
          <Segments filled={1} total={3} color={colors.clayBright} />
          <Text className="mt-3 text-[13px]" style={{ color: 'rgba(244,239,231,0.7)' }}>
            Up next — Retinol 0.3% · pea-sized
          </Text>
        </View>

        {/* Home-screen widgets */}
        <Text className="mb-2.5 mt-5 self-center font-mono text-[10.5px] uppercase tracking-[1px]" style={{ color: 'rgba(244,239,231,0.4)' }}>
          Home-screen widget
        </Text>
        <View className="flex-row gap-3.5">
          {/* Widget A — Tonight (light) */}
          <View className="rounded-[26px] p-[18px]" style={{ width: 140, height: 140, backgroundColor: colors.paper }}>
            <Text className="font-mono text-[10px] uppercase" style={{ color: colors.clay }}>
              Tonight
            </Text>
            <Text variant="titleSm" className="mt-1 text-[24px]">
              Retinoid night
            </Text>
            <View className="flex-1" />
            <View className="flex-row gap-1">
              {[0, 1, 2].map((i) => (
                <View key={i} className="h-[5px] flex-1 rounded-pill" style={{ backgroundColor: i < 1 ? colors.clay : '#E3D8C9' }} />
              ))}
            </View>
            <Text className="mt-1.5 text-[11.5px]" style={{ color: colors.muted }}>
              1 of 3 done
            </Text>
          </View>

          {/* Widget B — Streak (dark) */}
          <View className="rounded-[26px] p-[18px]" style={{ width: 140, height: 140, backgroundColor: colors.night, borderWidth: 1, borderColor: 'rgba(244,239,231,0.1)' }}>
            <Text className="font-mono text-[10px] uppercase" style={{ color: colors.clayBright }}>
              Streak
            </Text>
            <View className="mt-1 flex-row items-baseline gap-1.5">
              <Text className="text-[40px]" style={{ color: colors.cream, fontWeight: '700' }}>
                12
              </Text>
              <Text className="text-[13px]" style={{ color: 'rgba(244,239,231,0.5)' }}>
                days
              </Text>
            </View>
            <View className="flex-1" />
            <View className="flex-row gap-1">
              {[true, true, false, true, true].map((on, i) => (
                <View
                  key={i}
                  className="h-2.5 flex-1 rounded-[3px]"
                  style={{ backgroundColor: on ? colors.clay : 'rgba(244,239,231,0.14)' }}
                />
              ))}
            </View>
            <Text className="mt-1.5 text-[11.5px]" style={{ color: 'rgba(244,239,231,0.5)' }}>
              protected
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
