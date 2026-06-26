import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { withProGate } from '@/features/subscription/ProGate';
import { friendlyWeekday, slotLabel } from '@/features/scheduler/projection';
import { useCycle, type CycleData } from '@/features/scheduler/useCycle';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

// Week / cycle overview (design screen 01, docs/05 §6.1). A calm dark surface
// showing the stable AM block + the rotating PM cycle. Only tonight is tinted,
// with the "next acid night" line from the projection. No counts, no pressure.
function WeekScreen() {
  const { data } = useCycle();

  const cycle = data?.cycle ?? null;
  const variantLabel = cycle ? `${cycle.variant}, ${cycle.lengthNights} nights` : 'simple daily';
  const note = data ? resolutionNote(data) : null;

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-night">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-7 pb-10">
        <View className="mt-2 flex-row items-center justify-between">
          <Pressable accessibilityRole="button" onPress={() => router.back()} className="py-2 pr-3">
            <Text className="font-sans-semibold" tone="inverseMuted">
              ‹
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              haptics.select();
              router.push('/cycle/settings');
            }}>
            <Text className="font-sans-semibold text-[13px]" style={{ color: colors.clayBright }}>
              Settings
            </Text>
          </Pressable>
        </View>

        <Text variant="label" tone="inverseMuted" className="mt-1 uppercase">
          Your cycle · {variantLabel}
        </Text>
        <Text variant="title" tone="inverse" className="mt-1 text-[34px] leading-[38px]" accessibilityRole="header">
          This week, by night.
        </Text>

        {data?.paused ? (
          <Banner text="Your cycle is paused. Resume whenever you're ready." onPress={() => router.push('/cycle/disruption')} />
        ) : data?.recovery.active ? (
          <Banner
            text={`Recovery mode · day ${data.recovery.day} of ${data.recovery.days}. Barrier support only.`}
            onPress={() => router.push('/cycle/recovery')}
          />
        ) : null}

        {/* Stable AM block */}
        <View className="mt-4 flex-row items-center gap-3 rounded-2xl px-4 py-3.5" style={{ backgroundColor: colors.nightSurface }}>
          <Text variant="label" tone="inverseMuted" className="w-12">
            EVERY AM
          </Text>
          <Text className="flex-1 text-[13px]" style={{ color: 'rgba(244,239,231,0.75)' }}>
            {amSummary(data?.cycle?.amDaily)}
          </Text>
          <Text variant="label" tone="inverseMuted">
            stable
          </Text>
        </View>

        {cycle ? (
          <>
            <Text variant="label" tone="inverseMuted" className="mb-2.5 mt-5">
              EVENINGS
            </Text>
            <View className="gap-2">
              {data!.weekAhead.map((p, i) => {
                const tonight = i === 0;
                const isNextAcid = p.dateISO === data!.nextAcidNight && p.night.slot === 'exfoliate';
                return (
                  <Pressable
                    key={p.dateISO}
                    accessibilityRole="button"
                    accessibilityLabel={`${p.weekday}: ${slotLabel(p.night.slot)} night${tonight ? ', tonight' : ''}`}
                    onPress={() => {
                      haptics.select();
                      if (tonight) router.push('/cycle/why-tonight');
                    }}
                    className="flex-row items-center gap-3.5 rounded-2xl px-4 py-3.5"
                    style={
                      tonight
                        ? { backgroundColor: 'rgba(217,161,131,0.12)', borderWidth: 1.5, borderColor: 'rgba(217,161,131,0.4)' }
                        : { backgroundColor: colors.nightSurface }
                    }>
                    <Text
                      className="w-[30px] font-mono text-[12px]"
                      style={{ color: tonight ? colors.clayBright : 'rgba(244,239,231,0.45)' }}>
                      N{i + 1}
                    </Text>
                    <View className="flex-1">
                      <Text className="font-sans-bold text-[15px]" style={{ color: colors.cream }}>
                        {slotLabel(p.night.slot)}
                        {tonight ? <Text style={{ color: colors.clayBright, fontWeight: '500' }}> · tonight</Text> : null}
                        {isNextAcid && !tonight ? (
                          <Text className="text-[11px]" style={{ color: colors.clayBright }}>
                            {'  '}next acid night
                          </Text>
                        ) : null}
                      </Text>
                      <Text className="mt-0.5 text-[12.5px]" style={{ color: 'rgba(244,239,231,0.45)' }}>
                        {nightSub(p.night.slot, p.night.productName)}
                      </Text>
                    </View>
                    {tonight ? (
                      <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.clayBright }} />
                    ) : (
                      <Text className="text-[12px]" style={{ color: 'rgba(244,239,231,0.4)' }}>
                        {p.weekday}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {note ? (
              <View
                className="mt-4 flex-row items-start gap-3 rounded-[18px]"
                style={{ backgroundColor: 'rgba(217,161,131,0.10)', paddingHorizontal: 20, paddingVertical: 16 }}>
                <View
                  className="rounded-full"
                  style={{ width: 7, height: 7, marginTop: 5, backgroundColor: colors.clayBright }}
                />
                <Text className="flex-1 text-[13.5px] leading-[21px]" style={{ color: 'rgba(244,239,231,0.78)' }}>
                  {note.lead}
                  <Text className="font-sans-bold" style={{ color: colors.cream }}>
                    {note.tail}
                  </Text>
                </Text>
              </View>
            ) : null}

            {data!.notes.length ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  if (/add your/i.test(data!.notes[0]!)) {
                    haptics.select();
                    router.push('/cycle/phased-intro');
                  }
                }}
                className="mt-4">
                <Text className="text-[12.5px]" style={{ color: 'rgba(244,239,231,0.5)', lineHeight: 18 }}>
                  {data!.notes[0]}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                haptics.select();
                router.push('/cycle/disruption');
              }}
              className="mt-6 items-center py-2">
              <Text variant="label" style={{ color: colors.clayBright }}>
                Need a break? →
              </Text>
            </Pressable>
          </>
        ) : (
          <View className="mt-6 rounded-2xl px-5 py-6" style={{ backgroundColor: colors.nightSurface }}>
            <Text className="font-sans-semibold text-[15px]" style={{ color: colors.cream }}>
              No actives to cycle yet.
            </Text>
            <Text className="mt-2 text-[13px]" style={{ color: 'rgba(244,239,231,0.55)', lineHeight: 19 }}>
              Your routine is a simple daily morning and evening. Add a retinoid or an exfoliating acid
              and we&apos;ll build your cycle.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Banner({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="mt-4 flex-row items-center gap-3 rounded-2xl px-4 py-3.5"
      style={{ backgroundColor: 'rgba(217,161,131,0.1)' }}>
      <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.clayBright }} />
      <Text className="flex-1 text-[13px]" style={{ color: 'rgba(244,239,231,0.8)' }}>
        {text}
      </Text>
      <Text style={{ color: 'rgba(244,239,231,0.4)' }}>›</Text>
    </Pressable>
  );
}

function amSummary(amDaily: { className: string }[] | undefined): string {
  const hasVitC = amDaily?.some((a) => a.className === 'vitamin_c');
  return `${hasVitC ? 'Vitamin C → ' : ''}moisturizer → SPF`;
}

function nightSub(slot: string, productName: string | null): string {
  if (slot === 'recover') return productName ? `${productName} · barrier support` : 'Barrier support';
  return productName ?? '';
}

/** The frame-07 resolution note. Surfaced only when tonight is a retinoid night and
 *  an exfoliating acid is being held back, naming the next acid night. Renders the
 *  alternate_nights conflict as the calm "they're better apart" line, em-dash-free. */
function resolutionNote(data: CycleData): { lead: string; tail: string } | null {
  const cycle = data.cycle;
  if (!cycle || data.tonight?.night.slot !== 'retinoid') return null;
  const acid = cycle.nights.find((n) => n.slot === 'exfoliate')?.productName;
  if (!acid || !data.nextAcidNight) return null;
  return {
    lead: `Because tonight is retinoid night, your ${acid.toLowerCase()} is held back. They're better apart. `,
    tail: `Next acid night: ${friendlyWeekday(data.nextAcidNight)}.`,
  };
}

// The full skin-cycling scheduler is a Pro value prop (docs/08 §2.2). Gated.
export default withProGate('scheduler', WeekScreen);
