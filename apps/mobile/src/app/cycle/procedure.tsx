import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { useCycleMutations } from '@/features/scheduler/useCycle';
import { cn } from '@/lib/cn';
import { haptics } from '@/theme/haptics';

// Post-procedure recovery (design screen 05, docs/05 §6.4/§7). After a peel or
// facial, pause actives and simplify to barrier basics for a chosen window, then
// resume. Claim-safe, never alarmist.
const REST = [3, 5, 7];
const BARRIER_BASICS = ['Gentle cleanser', 'Barrier moisturizer — ceramides', 'SPF every morning'];

export default function ProcedureScreen() {
  const m = useCycleMutations();
  const [days, setDays] = useState(5);

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="mt-2">
        <Pressable accessibilityRole="button" onPress={() => router.back()} className="py-2">
          <Text className="font-sans-semibold">‹</Text>
        </Pressable>
      </View>

      <View className="mt-2 h-12 w-12 items-center justify-center rounded-full bg-clay-tint">
        <Text className="text-[18px] text-clay">◇</Text>
      </View>
      <Text variant="title" className="mt-5 text-[31px] leading-[34px]" accessibilityRole="header">
        Let&apos;s give your skin a few days.
      </Text>
      <Text variant="body" tone="muted" className="mt-2">
        After a peel or facial, actives can be too much. We&apos;ll pause them and keep things simple
        — then ease back in.
      </Text>

      <Text variant="eyebrow" tone="clay" className="mb-2.5 mt-6">
        How long to rest?
      </Text>
      <View className="flex-row gap-2">
        {REST.map((d) => {
          const sel = days === d;
          return (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityState={{ selected: sel }}
              onPress={() => {
                haptics.select();
                setDays(d);
              }}
              className={cn(
                'flex-1 items-center rounded-[14px] bg-paper-raised py-3.5',
                sel ? 'border-2 border-clay' : 'border border-hairline-strong',
              )}>
              <Text className="font-sans-bold text-[18px]" tone={sel ? 'clay' : 'ink'}>
                {d}
              </Text>
              <Text variant="bodySm" tone="muted">
                days
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="mt-6 rounded-card p-5" style={{ backgroundColor: '#E6ECE0' }}>
        <Text variant="eyebrow" className="mb-3" style={{ color: '#4F7A4A' }}>
          While you recover
        </Text>
        <View className="gap-2.5">
          {BARRIER_BASICS.map((b) => (
            <View key={b} className="flex-row items-center gap-2.5">
              <View className="h-[18px] w-[18px] items-center justify-center rounded-full" style={{ backgroundColor: '#4F7A4A' }}>
                <Text className="text-[10px]" style={{ color: '#E6ECE0' }}>
                  ✓
                </Text>
              </View>
              <Text className="text-[14px]" style={{ color: '#456040' }}>
                {b}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View className="flex-1" />
      <Button
        label="Start recovery"
        onPress={async () => {
          await m.beginRecovery(days, 'procedure');
          router.replace('/cycle/recovery');
        }}
      />
    </Screen>
  );
}
