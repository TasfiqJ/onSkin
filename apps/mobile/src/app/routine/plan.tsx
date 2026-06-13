import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { setCycleAnchor } from '@/features/routine/cycleAnchor';
import { usePlan } from '@/features/routine/usePlan';
import { colors } from '@/theme/tokens';

// 01 · Plan built — "Start today" (design screen 01, docs/03 §2). The deterministic
// generator's output: sequenced AM, skin-cycling PM with the ramp default, and an
// honest gap note (never fabricates a product). CTA begins the daily loop.

function MorningRow({ index, name, synergy }: { index: number; name: string; synergy?: boolean }) {
  return (
    <View className="flex-row items-center gap-3 py-1.5">
      <Text className="w-3.5 font-mono text-[11px]" style={{ color: '#C0B7A6' }}>
        {index}
      </Text>
      <Text variant="body" className="font-sans-medium text-[14.5px]">
        {name}
      </Text>
      {synergy ? (
        <View className="ml-1 rounded-md bg-sage-tint px-1.5 py-0.5">
          <Text className="font-sans-medium text-[11px]" style={{ color: colors.sage }}>
            + SPF synergy
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function EveningRow({ nightLabel, name, suffix, accent }: { nightLabel: string; name: string; suffix: string; accent: boolean }) {
  return (
    <View className="flex-row items-center gap-3 py-1.5">
      <Text className="w-9 font-mono text-[11px]" style={{ color: accent ? colors.clayBright : 'rgba(244,239,231,0.4)' }}>
        {nightLabel}
      </Text>
      <Text className="font-sans-medium text-[14.5px]" style={{ color: colors.cream }}>
        {name}
      </Text>
      <Text className="font-sans text-[11px]" style={{ color: 'rgba(244,239,231,0.5)' }}>
        {suffix}
      </Text>
    </View>
  );
}

export default function PlanScreen() {
  const { data } = usePlan();
  const plan = data?.plan;

  const exfoliant = plan?.pm.find((s) => s.role === 'exfoliant');
  const retinoid = plan?.pm.find((s) => s.role === 'treatment');
  const retRamp = plan?.ramp.find((r) => r.name === retinoid?.name);
  const hasVitCSynergy = plan?.conflicts.some(
    (c) => c.rule.interactionType === 'synergy' && (c.rule.tagA === 'vitamin_c' || c.rule.tagB === 'vitamin_c'),
  );

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-1 pt-4">
        <Text variant="label" tone="clay" className="font-mono">
          BUILT FOR DRY, SENSITIVE SKIN
        </Text>
        <Text variant="title" className="mt-2">
          Your routine, in order.
        </Text>

        {/* Morning card */}
        <View className="mt-5 rounded-card bg-paper-raised p-5" style={{ borderWidth: 1, borderColor: colors.hairline }}>
          <View className="mb-3 flex-row items-center gap-2.5">
            <View className="h-[18px] w-[18px] items-center justify-center rounded-full bg-clay-tint">
              <View className="h-1.5 w-1.5 rounded-full bg-clay" />
            </View>
            <Text className="font-mono text-[13px] uppercase tracking-[1px]" style={{ color: colors.clayDeep }}>
              Morning
            </Text>
          </View>
          {plan?.am.map((s, i) => (
            <MorningRow key={s.productId} index={i + 1} name={s.name} synergy={s.role === 'antioxidant' && hasVitCSynergy} />
          ))}
        </View>

        {/* Evening card (skin cycling) — dark */}
        <View className="mt-3 rounded-card p-5" style={{ backgroundColor: colors.night }}>
          <View className="mb-3 flex-row items-center gap-2.5">
            <View className="h-[18px] w-[18px] items-center justify-center rounded-full" style={{ backgroundColor: colors.nightSurface }}>
              <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.clayBright }} />
            </View>
            <Text className="font-mono text-[13px] uppercase tracking-[1px]" style={{ color: colors.clayBright }}>
              Evening · skin cycling
            </Text>
          </View>
          {exfoliant ? <EveningRow nightLabel="N1" name={exfoliant.name} suffix="exfoliate" accent={false} /> : null}
          {retinoid ? (
            <EveningRow
              nightLabel="N2"
              name={retinoid.name}
              suffix={retRamp ? `${retRamp.state.freqPerWeek}×/week to start` : 'tonight'}
              accent
            />
          ) : null}
          <EveningRow nightLabel="N3–4" name="Recover" suffix="ceramide only" accent={false} />
        </View>

        {/* Honest gap note — only when a category is missing */}
        {plan?.gaps.length ? (
          <View className="mt-3.5 flex-row gap-2.5 rounded-2xl bg-greige-chip px-4 py-3">
            <View className="mt-1.5 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.muted }} />
            <Text variant="bodySm" tone="muted" className="flex-1 text-[12.5px]">
              {plan.gaps[0]}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="pb-2">
        <Button
          label="Start today"
          variant="accent"
          onPress={() => {
            void setCycleAnchor(); // anchor the skin cycle to today
            router.replace('/today');
          }}
        />
      </View>
    </Screen>
  );
}
