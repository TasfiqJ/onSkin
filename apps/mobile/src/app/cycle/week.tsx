import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RouteIconButton, Text } from '@/components/ui';
import { canUseRoutineCadence } from '@/features/routine/reviewGate';
import { withProGate } from '@/features/subscription/ProGate';
import { friendlyWeekday, slotLabel } from '@/features/scheduler/projection';
import { useCycle, type CycleData } from '@/features/scheduler/useCycle';
import { backOrReplace } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

// Week / cycle overview (design screen 01, docs/05 §6.1). A calm dark surface
// showing the stable AM block + the rotating PM cycle. Only tonight is tinted,
// with the "next acid night" line from the projection. No counts, no pressure.
function WeekScreen() {
  const { data } = useCycle();

  const cadenceReady = canUseRoutineCadence();
  const cycle = cadenceReady ? (data?.cycle ?? null) : null;
  const variantLabel = !cadenceReady
    ? 'review gate'
    : cycle
      ? `${cycle.variant}, ${cycle.lengthNights} nights`
      : 'simple daily';
  const resolution = cadenceReady && data ? resolutionNote(data) : null;
  const schedulerNote = cadenceReady ? (data?.notes[0] ?? null) : null;

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-night">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-7 pb-10">
        <View className="mt-2 flex-row items-center justify-between">
          <RouteIconButton
            accessibilityLabel="Back"
            tone="night"
            onPress={() => backOrReplace(router)}
          />
          {cadenceReady ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cycle settings"
              onPress={() => {
                haptics.select();
                router.push('/cycle/settings');
              }}
              className="min-h-[48px] min-w-[48px] items-center justify-center px-2"
            >
              <Text className="font-sans-semibold text-[13px]" style={{ color: colors.clayBright }}>
                Settings
              </Text>
            </Pressable>
          ) : (
            <View className="min-h-[48px] min-w-[48px]" />
          )}
        </View>

        <Text variant="label" tone="inverseMuted" className="mt-1 uppercase">
          Your cycle · {variantLabel}
        </Text>
        <Text
          variant="title"
          tone="inverse"
          className="mt-1 text-[34px] leading-[38px]"
          accessibilityRole="header"
        >
          This week, by night.
        </Text>

        {cadenceReady && data?.paused ? (
          <Banner
            text="Your cycle is paused. Resume whenever you're ready."
            onPress={() => router.push('/cycle/disruption')}
          />
        ) : cadenceReady && data?.recovery.active ? (
          <Banner
            text={`Recovery mode · day ${data.recovery.day} of ${data.recovery.days}. Barrier support only.`}
            onPress={() => router.push('/cycle/recovery')}
          />
        ) : null}

        {/* Stable AM block */}
        <View
          className="mt-4 flex-row items-center gap-3 rounded-2xl px-4 py-3.5"
          style={{ backgroundColor: colors.nightSurface }}
        >
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

        {!cadenceReady ? (
          <ReviewGateEmptyState />
        ) : cycle ? (
          <>
            <Text variant="label" tone="inverseMuted" className="mb-2.5 mt-5">
              EVENINGS
            </Text>
            <View className="gap-2">
              {data!.weekAhead.map((p, i) => {
                const tonight = i === 0;
                const cycleNightNumber = p.night.index + 1;
                const cycleNightLabel = formatCycleNightLabel(cycleNightNumber);
                const isNextAcid =
                  p.dateISO === data!.nextAcidNight && p.night.slot === 'exfoliate';
                return (
                  <Pressable
                    key={p.dateISO}
                    accessibilityRole="button"
                    accessibilityLabel={`${p.weekday}: ${slotLabel(p.night.slot)} night, cycle night ${cycleNightNumber} of ${cycle.lengthNights}${tonight ? ', tonight' : ''}`}
                    onPress={() => {
                      haptics.select();
                      router.push({
                        pathname: '/cycle/why-tonight',
                        params: { date: p.dateISO },
                      });
                    }}
                    className="flex-row items-center gap-3.5 rounded-2xl px-4 py-3.5"
                    style={
                      tonight
                        ? {
                            backgroundColor: 'rgba(217,161,131,0.12)',
                            borderWidth: 1.5,
                            borderColor: 'rgba(217,161,131,0.4)',
                          }
                        : { backgroundColor: colors.nightSurface }
                    }
                  >
                    <Text
                      className="w-[56px] font-sans-semibold text-[11.5px]"
                      style={{ color: tonight ? colors.clayBright : 'rgba(244,239,231,0.45)' }}
                    >
                      {cycleNightLabel}
                    </Text>
                    <View className="flex-1">
                      <Text className="font-sans-bold text-[15px]" style={{ color: colors.cream }}>
                        {slotLabel(p.night.slot)}
                        {tonight ? (
                          <Text style={{ color: colors.clayBright, fontWeight: '500' }}>
                            {' '}
                            · tonight
                          </Text>
                        ) : null}
                        {isNextAcid && !tonight ? (
                          <Text className="text-[11px]" style={{ color: colors.clayBright }}>
                            {'  '}next acid night
                          </Text>
                        ) : null}
                      </Text>
                      <Text
                        className="mt-0.5 text-[12.5px]"
                        style={{ color: 'rgba(244,239,231,0.45)' }}
                      >
                        {nightSub(p.night.slot, p.night.productName)}
                      </Text>
                    </View>
                    {tonight ? (
                      <View
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: colors.clayBright }}
                      />
                    ) : (
                      <Text className="text-[12px]" style={{ color: 'rgba(244,239,231,0.4)' }}>
                        {p.weekday}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {resolution ? (
              <View
                className="mt-4 flex-row items-start gap-3 rounded-[18px]"
                style={{
                  backgroundColor: 'rgba(217,161,131,0.10)',
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                }}
              >
                <View
                  className="rounded-full"
                  style={{ width: 7, height: 7, marginTop: 5, backgroundColor: colors.clayBright }}
                />
                <Text
                  className="flex-1 text-[13.5px] leading-[21px]"
                  style={{ color: 'rgba(244,239,231,0.78)' }}
                >
                  {resolution.lead}
                  <Text className="font-sans-bold" style={{ color: colors.cream }}>
                    {resolution.tail}
                  </Text>
                </Text>
              </View>
            ) : null}

            {schedulerNote ? <SchedulerNote note={schedulerNote} /> : null}

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                haptics.select();
                router.push('/cycle/disruption');
              }}
              className="mt-6 min-h-[48px] items-center justify-center py-2"
            >
              <Text variant="label" style={{ color: colors.clayBright }}>
                Need a break? →
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <View
              className="mt-6 rounded-2xl px-5 py-6"
              style={{ backgroundColor: colors.nightSurface }}
            >
              <Text className="font-sans-semibold text-[15px]" style={{ color: colors.cream }}>
                No actives to cycle yet.
              </Text>
              <Text
                className="mt-2 text-[13px]"
                style={{ color: 'rgba(244,239,231,0.55)', lineHeight: 19 }}
              >
                Your routine is a simple daily morning and evening. Add a retinoid or an exfoliating
                acid and we&apos;ll build your cycle.
              </Text>
            </View>
            {schedulerNote ? <SchedulerNote note={schedulerNote} /> : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ReviewGateEmptyState() {
  return (
    <View className="mt-6 rounded-2xl px-5 py-6" style={{ backgroundColor: colors.nightSurface }}>
      <Text className="font-sans-semibold text-[15px]" style={{ color: colors.cream }}>
        Cycle guidance is under review.
      </Text>
      <Text
        className="mt-2 text-[13px]"
        style={{ color: 'rgba(244,239,231,0.55)', lineHeight: 19 }}
      >
        Your AM/PM routine still works. We publish skin-cycling cadence only after dermatologist and
        cosmetic-chemist review.
      </Text>
    </View>
  );
}

function SchedulerNote({ note }: { note: string }) {
  const opensPhasedIntro = /add your/i.test(note);
  const noteStyle = {
    backgroundColor: 'rgba(217,161,131,0.08)',
    borderColor: 'rgba(217,161,131,0.18)',
    borderWidth: 1,
  };

  if (opensPhasedIntro) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Review phased introduction"
        onPress={() => {
          haptics.select();
          router.push('/cycle/phased-intro');
        }}
        className="mt-4 min-h-[48px] flex-row items-center gap-3 rounded-[18px] px-4 py-3"
        style={noteStyle}
      >
        <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.clayBright }} />
        <Text
          className="flex-1 text-[13.5px] leading-[20px]"
          style={{ color: 'rgba(244,239,231,0.78)' }}
        >
          {note}
        </Text>
        <Text className="text-[16px]" style={{ color: 'rgba(244,239,231,0.45)' }}>
          ›
        </Text>
      </Pressable>
    );
  }

  return (
    <View className="mt-4 flex-row items-start gap-3 rounded-[18px] px-4 py-3" style={noteStyle}>
      <View
        className="mt-[7px] h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: colors.clayBright }}
      />
      <Text
        className="flex-1 text-[13.5px] leading-[20px]"
        style={{ color: 'rgba(244,239,231,0.72)' }}
      >
        {note}
      </Text>
    </View>
  );
}

function Banner({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="mt-4 flex-row items-center gap-3 rounded-2xl px-4 py-3.5"
      style={{ backgroundColor: 'rgba(217,161,131,0.1)' }}
    >
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
  if (slot === 'recover')
    return productName ? `${productName} · barrier support` : 'Barrier support';
  return productName ?? '';
}

function formatCycleNightLabel(cycleNightNumber: number): string {
  return `Night ${cycleNightNumber}`;
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
