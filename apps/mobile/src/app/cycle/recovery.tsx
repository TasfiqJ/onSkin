import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { useCycle, useCycleMutations } from '@/features/scheduler/useCycle';

// Recovery mode (design screen 06, docs/05 §7) — auto de-escalation. Irritation or
// a procedure → actives paused, barrier repair for ~7–10 days, ease back in. Calm,
// framed as strengthening, never a setback. Non-diagnostic.
export default function RecoveryScreen() {
  const { data } = useCycle();
  const m = useCycleMutations();
  const rec = data?.recovery;

  if (!rec?.active) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View className="mt-2">
          <Pressable accessibilityRole="button" onPress={() => router.back()} className="py-2">
            <Text className="font-sans-semibold">‹</Text>
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center">
          <Text variant="body" tone="muted">
            No recovery in progress — your cycle is running normally.
          </Text>
        </View>
      </Screen>
    );
  }

  const pct = Math.round((rec.day / rec.days) * 100);
  const paused = [
    ...(data?.cycle?.nights.filter((n) => n.productName).map((n) => n.productName!) ?? []),
    ...(data?.cycle?.amDaily.filter((a) => a.className === 'vitamin_c').map((a) => a.name) ?? []),
  ];
  const uniquePaused = [...new Set(paused)];
  const fromIrritation = rec.reason === 'irritation';

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-6">
        <View className="mt-2">
          <Pressable accessibilityRole="button" onPress={() => router.back()} className="py-2">
            <Text className="font-sans-semibold">‹</Text>
          </Pressable>
        </View>

        <View className="mt-1 flex-row items-center gap-2 self-start rounded-pill px-4 py-2" style={{ backgroundColor: '#E6ECE0' }}>
          <View className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: '#4F7A4A' }} />
          <Text className="font-sans-bold text-[12.5px]" style={{ color: '#3F6A3A' }}>
            Recovery mode · day {rec.day} of {rec.days}
          </Text>
        </View>

        <Text variant="title" className="mt-4 text-[32px] leading-[35px]" accessibilityRole="header">
          We&apos;ve eased off for now.
        </Text>
        <Text variant="body" tone="muted" className="mt-2">
          {fromIrritation
            ? 'You told us your skin felt irritated, so we paused your actives and switched to barrier repair. This isn’t a setback — it’s how skin gets stronger.'
            : 'After your treatment, we paused your actives and switched to barrier repair. We’ll ease back in gently.'}
        </Text>

        {/* Progress */}
        <View className="mt-5 rounded-card border border-hairline bg-paper-raised p-5">
          <View className="mb-3 flex-row items-baseline justify-between">
            <Text variant="body" className="font-sans-bold">
              Resting your barrier
            </Text>
            <Text variant="label" style={{ color: '#4F7A4A' }}>
              {rec.day} / {rec.days}
            </Text>
          </View>
          <View className="h-2 overflow-hidden rounded-pill" style={{ backgroundColor: '#EDE5D8' }}>
            <View style={{ width: `${pct}%`, height: '100%', backgroundColor: '#4F7A4A', borderRadius: 4 }} />
          </View>
          <View className="mt-2.5 flex-row justify-between">
            <Text variant="bodySm" tone="muted">
              Paused actives
            </Text>
            <Text variant="bodySm" tone="muted">
              Reintroduce gradually →
            </Text>
          </View>
        </View>

        {/* Paused actives */}
        {uniquePaused.length ? (
          <View className="mt-3.5 rounded-card p-4" style={{ backgroundColor: '#F1ECE3' }}>
            <Text variant="bodySm" tone="muted" className="mb-2.5 font-sans-bold">
              Paused until you&apos;re comfortable
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {uniquePaused.map((name) => (
                <View key={name} className="rounded-pill bg-paper-raised px-3 py-1.5">
                  <Text className="font-sans-semibold text-[12px] line-through" tone="muted">
                    {name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View className="mt-3.5 flex-row gap-3 rounded-2xl border border-hairline bg-paper-raised px-4 py-3.5">
          <View className="mt-1.5 h-[7px] w-[7px] rounded-full bg-muted" />
          <Text variant="bodySm" tone="muted" className="flex-1">
            Feeling better already? You can ease back in early — we&apos;ll start with one active.
          </Text>
        </View>

        <Button
          className="mt-6"
          label="Ease back in"
          onPress={async () => {
            await m.finishRecovery();
            router.back();
          }}
        />
      </ScrollView>
    </Screen>
  );
}
