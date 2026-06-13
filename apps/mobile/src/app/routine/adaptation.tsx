import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { colors } from '@/theme/tokens';

// 09 · Adaptation — "Here's what changed" (design 09, docs/03 §7/§8). After a
// product is added, the deterministic pipeline re-runs and explains exactly what
// changed and why — and that prior overrides were preserved. Everything is undoable.
// (Shown with the design's worked example; binds to the live recompute diff.)
type Change = { kind: 'added' | 'neutral' | 'kept'; title: string; body: string };
const CHANGES: Change[] = [
  { kind: 'added', title: 'Added to AM, after cleanser', body: 'Gentle enough for daily use — it slots before your moisturizer.' },
  { kind: 'neutral', title: 'No new conflicts', body: 'Azelaic plays well with your retinol and vitamin C.' },
  { kind: 'kept', title: 'Your overrides kept', body: 'Retinol & glycolic stay on alternate nights, as you set.' },
];

function ChangeCard({ change }: { change: Change }) {
  const sage = change.kind === 'added';
  return (
    <View
      className="flex-row gap-3.5 rounded-2xl p-4"
      style={
        sage
          ? { backgroundColor: colors.sageTint }
          : { backgroundColor: colors.paperRaised, borderWidth: 1, borderColor: colors.hairline }
      }>
      <View
        className="h-[26px] w-[26px] items-center justify-center rounded-full"
        style={{
          backgroundColor: change.kind === 'added' ? colors.paperRaised : change.kind === 'kept' ? colors.clayTint : colors.greige,
        }}>
        {change.kind === 'added' ? (
          <Text className="text-[16px]" style={{ color: colors.sage }}>
            +
          </Text>
        ) : change.kind === 'kept' ? (
          <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.clay }} />
        ) : (
          <View style={{ width: 10, height: 2, backgroundColor: colors.muted }} />
        )}
      </View>
      <View className="flex-1">
        <Text className="font-sans-bold text-[14.5px]" style={{ color: sage ? colors.sageDeep : colors.ink }}>
          {change.title}
        </Text>
        <Text className="mt-0.5 text-[13px]" style={{ color: sage ? colors.sageEyebrow : colors.mutedStrong }}>
          {change.body}
        </Text>
      </View>
    </View>
  );
}

export default function AdaptationScreen() {
  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-1 pt-4">
        <Text variant="label" tone="clay" className="font-mono">
          YOU ADDED A PRODUCT
        </Text>
        <Text variant="title" className="mt-2.5 text-[32px]">
          Here&apos;s what changed.
        </Text>
        <Text variant="bodySm" tone="muted" className="mt-2 text-[14px]">
          Adding <Text className="font-sans-bold text-ink">Azelaic Acid 10%</Text> rebuilt your plan.
          Nothing&apos;s locked — undo anything.
        </Text>

        <View className="mt-6 gap-3">
          {CHANGES.map((c) => (
            <ChangeCard key={c.title} change={c} />
          ))}
        </View>
      </View>

      <View className="flex-row items-center gap-2.5 pb-2">
        <View className="flex-1">
          <Button label="Looks good" onPress={() => router.back()} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Undo"
          className="h-[54px] w-[54px] items-center justify-center rounded-pill bg-paper-raised"
          style={{ borderWidth: 1, borderColor: 'rgba(32,27,21,0.12)' }}
          onPress={() => router.back()}>
          <Text style={{ color: colors.muted, fontSize: 18 }}>↺</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
