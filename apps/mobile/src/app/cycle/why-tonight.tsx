import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Button, Sheet, Text } from '@/components/ui';
import { useCycle } from '@/features/scheduler/useCycle';
import { track } from '@/lib/analytics/track';
import { colors } from '@/theme/tokens';

// "Why is this on tonight?" (design screen 02, docs/05 §6.3). The reasoning
// trace, calm and claim-safe, surfacing that every step is traceable to a rule,
// the profile, or the user's own choice. The trust counterpart to the conflict
// detail (docs/02 §7.3).
const SLOT_TITLE: Record<string, string> = {
  retinoid: 'Tonight is retinoid night.',
  exfoliate: 'Tonight is exfoliation night.',
  recover: "Tonight is a recovery night.",
  other_active: 'Tonight is an active night.',
};

function TraceRow({ tag, children, last }: { tag: string; children: string; last?: boolean }) {
  return (
    <View
      className="flex-row gap-3.5 py-3.5"
      style={last ? undefined : { borderBottomWidth: 1, borderBottomColor: 'rgba(244,239,231,0.08)' }}>
      <Text className="w-14 font-mono text-[11px]" style={{ color: colors.clayBright }}>
        {tag}
      </Text>
      <Text className="flex-1 text-[14px]" style={{ color: 'rgba(244,239,231,0.8)', lineHeight: 22 }}>
        {children}
      </Text>
    </View>
  );
}

export default function WhyTonightScreen() {
  const { data } = useCycle();
  const cycle = data?.cycle;
  const tonight = data?.tonight;

  useEffect(() => {
    track('why_tonight_viewed');
  }, []);

  if (!cycle || !tonight) {
    return (
      <Sheet tone="night">
        <Text variant="body" tone="inverseMuted" className="py-6 text-center">
          No cycle is running yet. Add an active to get started.
        </Text>
        <Button label="Got it" variant="inverse" onPress={() => router.back()} />
      </Sheet>
    );
  }

  const retinoidName = cycle.nights.find((n) => n.slot === 'retinoid')?.productName ?? null;
  const acidName = cycle.nights.find((n) => n.slot === 'exfoliate')?.productName ?? null;
  const hasVitC = cycle.amDaily.some((a) => a.className === 'vitamin_c');
  const retinoidNightsPerCycle = cycle.nights.filter((n) => n.slot === 'retinoid').length;
  const hasBothPotent = !!retinoidName && !!acidName;

  return (
    <Sheet tone="night">
      <Text variant="label" className="mb-2.5" style={{ color: colors.clayBright }}>
        WHY THIS, TONIGHT?
      </Text>
      <Text variant="title" tone="inverse" className="text-[30px] leading-[34px]" accessibilityRole="header">
        {SLOT_TITLE[tonight.night.slot] ?? 'Tonight.'}
      </Text>

      <View className="mt-4">
        <TraceRow tag="CYCLE">
          {`You're on night ${tonight.index + 1} of your ${cycle.variant} cycle. The ${tonight.night.slot === 'recover' ? 'recovery' : tonight.night.slot} slot.`}
        </TraceRow>
        {hasBothPotent ? (
          <TraceRow tag="APART">
            {`Your ${acidName} is on alternate nights so it and your retinoid don't compound irritation. Recommendation, not a rule.`}
          </TraceRow>
        ) : null}
        {hasVitC ? (
          <TraceRow tag="AM">Your vitamin C lives in your mornings. Off the night cycle.</TraceRow>
        ) : null}
        <TraceRow tag="PACE" last>
          {retinoidNightsPerCycle > 0
            ? `${retinoidNightsPerCycle} retinoid night${retinoidNightsPerCycle === 1 ? '' : 's'} per cycle while your skin builds tolerance.`
            : 'Recovery nights focus on barrier support. Ceramides and hydration.'}
        </TraceRow>
      </View>

      <View className="my-5 rounded-2xl px-4 py-3.5" style={{ backgroundColor: 'rgba(217,161,131,0.1)' }}>
        <Text className="text-[12.5px]" style={{ color: 'rgba(244,239,231,0.6)', lineHeight: 19 }}>
          Every step here is traceable to a rule, your profile, or a choice you made. Never a black
          box.
        </Text>
      </View>

      <Button label="Got it" variant="inverse" onPress={() => router.back()} />
    </Sheet>
  );
}
