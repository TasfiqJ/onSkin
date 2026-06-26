import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { useCycleMutations } from '@/features/scheduler/useCycle';
import { cn } from '@/lib/cn';
import { colors } from '@/theme/tokens';

// 07 · Weekly tolerance check-in (design 07, docs/03 §4). The ONLY assessment , 
// optional, explicitly non-diagnostic. That tunes the ramp cadence. Each answer
// states exactly what the app will do (comfortable → offer step-up; dry → hold;
// irritated → add recovery & ease off).
const OPTIONS = [
  { id: 'comfortable', title: 'Comfortable', sub: 'We may offer a small step-up', swatch: colors.sageTint, dot: colors.sage, restingBorder: colors.hairline },
  { id: 'a_bit_dry', title: 'A bit dry', sub: "We'll hold your pace steady", swatch: colors.clayTint, dot: colors.clayBright, restingBorder: colors.hairline },
  // Irritated carries a pre-emphasised amber inset border at rest (design 07).
  { id: 'irritated', title: 'Irritated', sub: "We'll add recovery nights & ease off", swatch: 'rgba(176,122,60,0.14)', dot: colors.amber, restingBorder: 'rgba(176,122,60,0.4)' },
] as const;

export default function ToleranceScreen() {
  const [selected, setSelected] = useState<string | null>(null);
  const m = useCycleMutations();

  // Each answer states what the app does (docs/03 §4 / docs/05 §7). "Irritated"
  // triggers auto de-escalation: pause actives, start a barrier-recovery window.
  const onSave = async () => {
    if (selected === 'irritated') {
      await m.beginRecovery(7, 'irritation');
      router.replace('/cycle/recovery');
      return;
    }
    router.back();
  };

  return (
    <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(32,27,21,0.45)' }}>
      <Pressable className="absolute inset-0" accessibilityRole="button" accessibilityLabel="Dismiss" onPress={() => router.back()} />
      <View className="rounded-t-sheet bg-paper px-7 pb-10 pt-4">
        <View className="mb-5 h-[5px] w-10 self-center rounded-[3px]" style={{ backgroundColor: 'rgba(32,27,21,0.15)' }} />
        <Pressable accessibilityRole="button" className="mb-1 self-end" onPress={() => router.back()}>
          <Text variant="body" tone="muted" className="font-sans-semibold text-[14px]">
            Skip
          </Text>
        </Pressable>
        <Text variant="label" tone="clay" className="font-mono">
          ONE QUICK CHECK-IN
        </Text>
        <Text variant="title" className="mt-2.5 text-[33px]">
          How did your skin feel this week?
        </Text>
        <Text variant="bodySm" tone="muted" className="mt-2 text-[14px]">
          It only tunes your pace. Nothing here is a diagnosis. Optional, always.
        </Text>

        <View className="mt-6 gap-2.5">
          {OPTIONS.map((o) => (
            <Pressable
              key={o.id}
              accessibilityRole="button"
              accessibilityState={{ selected: selected === o.id }}
              className={cn('flex-row items-center gap-3.5 rounded-[18px] bg-paper-raised p-4')}
              style={{ borderWidth: selected === o.id ? 2 : 1, borderColor: selected === o.id ? colors.clay : o.restingBorder }}
              onPress={() => setSelected(o.id)}>
              <View className="h-[34px] w-[34px] items-center justify-center rounded-full" style={{ backgroundColor: o.swatch }}>
                <View className="h-3 w-3 rounded-full" style={{ backgroundColor: o.dot }} />
              </View>
              <View className="flex-1">
                <Text className="font-sans-bold text-[15.5px]">{o.title}</Text>
                <Text className="mt-0.5 text-[12.5px]" style={{ color: colors.muted }}>
                  {o.sub}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        <Button className="mt-6" label="Save" disabled={!selected} onPress={onSave} />
      </View>
    </View>
  );
}
