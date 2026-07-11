import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button, RouteIconButton, Screen, Text } from '@/components/ui';
import { CycleMutationError } from '@/features/scheduler/CycleMutationError';
import { useCycleMutations } from '@/features/scheduler/useCycle';
import { cn } from '@/lib/cn';
import { backOrReplace } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';

// Post-procedure recovery (design screen 05, docs/05 §6.4/§7). After a peel or
// facial, pause actives and simplify to barrier basics for a chosen window, then
// resume. Claim-safe, never alarmist.
const REST = [3, 5, 7];
const BARRIER_BASICS = ['Gentle cleanser', 'Barrier moisturizer. Ceramides', 'SPF every morning'];

export default function ProcedureScreen() {
  const m = useCycleMutations();
  const [days, setDays] = useState(5);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  async function beginRecovery() {
    if (saving) return;
    setSaving(true);
    setSaveFailed(false);
    try {
      await m.beginRecovery(days, 'procedure');
      router.replace('/cycle/recovery');
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
        <View className="mt-2">
          <RouteIconButton
            accessibilityLabel="Back"
            disabled={saving}
            onPress={() => backOrReplace(router)}
          />
        </View>

        <View className="mt-2 h-12 w-12 items-center justify-center rounded-full bg-clay-tint">
          <Text className="text-[18px] text-clay">◇</Text>
        </View>
        <Text
          variant="title"
          className="mt-5 text-[31px] leading-[34px]"
          accessibilityRole="header"
        >
          Let&apos;s give your skin a few days.
        </Text>
        <Text variant="body" tone="muted" className="mt-2">
          After a peel or facial, actives can be too much. We&apos;ll pause them and keep things
          simple. Then ease back in.
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
                accessibilityState={{ disabled: saving, selected: sel }}
                disabled={saving}
                onPress={() => {
                  haptics.select();
                  setDays(d);
                  setSaveFailed(false);
                }}
                className={cn(
                  'min-h-[58px] flex-1 items-center justify-center rounded-[14px] bg-paper-raised py-3.5',
                  sel ? 'border-2 border-clay' : 'border border-hairline-strong',
                )}
                style={{ opacity: saving ? 0.55 : 1 }}
              >
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
                <View
                  className="h-[18px] w-[18px] items-center justify-center rounded-full"
                  style={{ backgroundColor: '#4F7A4A' }}
                >
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
        {saveFailed ? <CycleMutationError /> : null}
      </ScrollView>

      <View className="bg-paper pb-4 pt-3">
        <Button
          disabled={saving}
          label={saving ? 'Starting recovery...' : saveFailed ? 'Try again' : 'Start recovery'}
          onPress={() => void beginRecovery()}
        />
      </View>
    </Screen>
  );
}
