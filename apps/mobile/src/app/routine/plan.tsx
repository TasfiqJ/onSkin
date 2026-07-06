import { useEffect, useRef } from 'react';

import { router } from 'expo-router';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import { Button, RouteIconButton, Screen, Text } from '@/components/ui';
import { setCycleAnchor } from '@/features/routine/cycleAnchor';
import { usePlan } from '@/features/routine/usePlan';
import { track } from '@/lib/analytics/track';
import { APP_YOU_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { colors } from '@/theme/tokens';

// 01 · Plan built. "Start today" (design screen 01, docs/03 §2). The deterministic
// generator's output: sequenced AM, skin-cycling PM with the ramp default, and an
// honest gap note (never fabricates a product). CTA begins the daily loop.

function MorningRow({
  compact,
  index,
  name,
  synergy,
}: {
  compact: boolean;
  index: number;
  name: string;
  synergy?: boolean;
}) {
  return (
    <View
      className={compact ? 'flex-row items-center gap-3 py-1' : 'flex-row items-center gap-3 py-1.5'}
    >
      <Text className="w-3.5 font-mono text-[11px]" style={{ color: colors.mutedFaint }}>
        {index}
      </Text>
      <Text
        variant="body"
        className={compact ? 'font-sans-medium text-[14px]' : 'font-sans-medium text-[14.5px]'}
      >
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

function EveningRow({
  compact,
  nightLabel,
  name,
  suffix,
  accent,
}: {
  compact: boolean;
  nightLabel: string;
  name: string;
  suffix: string;
  accent: boolean;
}) {
  return (
    <View
      className={compact ? 'flex-row items-center gap-3 py-1' : 'flex-row items-center gap-3 py-1.5'}
    >
      <Text
        className="w-9 font-mono text-[11px]"
        style={{ color: accent ? colors.clayBright : 'rgba(244,239,231,0.4)' }}
      >
        {nightLabel}
      </Text>
      <Text
        className={compact ? 'font-sans-medium text-[14px]' : 'font-sans-medium text-[14.5px]'}
        style={{ color: colors.cream }}
      >
        {name}
      </Text>
      <Text className="flex-1 font-sans text-[11px]" style={{ color: 'rgba(244,239,231,0.5)' }}>
        {suffix}
      </Text>
    </View>
  );
}

export default function PlanScreen() {
  const { height } = useWindowDimensions();
  const { data } = usePlan();
  const plan = data?.plan;
  const trackedPlanView = useRef(false);
  const compactPlan = height < 640;

  const exfoliant = plan?.pm.find((s) => s.role === 'exfoliant');
  const retinoid = plan?.pm.find((s) => s.role === 'treatment');
  const retRamp = plan?.ramp.find((r) => r.name === retinoid?.name);
  const hasVitCSynergy = plan?.conflicts.some(
    (c) =>
      c.rule.interactionType === 'synergy' &&
      (c.rule.tagA === 'vitamin_c' || c.rule.tagB === 'vitamin_c'),
  );

  useEffect(() => {
    if (!data || trackedPlanView.current) {
      return;
    }

    trackedPlanView.current = true;

    const source = data.isExample ? 'example' : 'routine_plan';
    const insightCount = data.plan.conflicts.length + data.plan.gaps.length + 1;

    track('routine_created', { source });
    track('first_routine_created', { source });

    if (!data.isExample) {
      track('first_useful_insight', { count: insightCount, source: 'routine_plan' });
    }

    if (data.plan.conflicts.length > 0) {
      track('conflict_detected', { count: data.plan.conflicts.length });
    }
  }, [data]);

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-1" style={{ overflow: 'hidden' }}>
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-[112px]"
        >
          <View className={compactPlan ? 'flex-row items-center' : 'flex-row items-center pt-1'}>
            <RouteIconButton
              accessibilityLabel="Back"
              onPress={() => backOrReplace(router, APP_YOU_ROUTE)}
            />
          </View>

          <View className={compactPlan ? 'pt-1' : 'pt-2'}>
            <Text variant="label" tone="clay" className="font-mono text-[11.5px] tracking-[1.15px]">
              {data?.profileLabel ?? 'BUILDING YOUR ROUTINE'}
            </Text>
            <Text
              variant="title"
              className="mt-2"
              style={{ fontSize: compactPlan ? 30 : 34, lineHeight: compactPlan ? 33 : 37 }}
            >
              Your routine, in order.
            </Text>

            {/* Morning card */}
            <View
              className={
                compactPlan
                  ? 'mt-3 rounded-[22px] bg-paper-raised'
                  : 'mt-5 rounded-[22px] bg-paper-raised'
              }
              style={{
                paddingHorizontal: compactPlan ? 18 : 20,
                paddingVertical: compactPlan ? 14 : 18,
                borderWidth: 1,
                borderColor: colors.hairline,
              }}
            >
              <View
                className={
                  compactPlan
                    ? 'mb-2 flex-row items-center gap-2.5'
                    : 'mb-3 flex-row items-center gap-2.5'
                }
              >
                <View className="h-[18px] w-[18px] items-center justify-center rounded-full bg-clay-tint">
                  <View className="h-1.5 w-1.5 rounded-full bg-clay" />
                </View>
                <Text
                  className="font-mono text-[13px] uppercase tracking-[1px]"
                  style={{ color: colors.clayDeep }}
                >
                  Morning
                </Text>
              </View>
              {plan?.am.map((s, i) => (
                <MorningRow
                  key={s.productId}
                  compact={compactPlan}
                  index={i + 1}
                  name={s.name}
                  synergy={s.role === 'antioxidant' && hasVitCSynergy}
                />
              ))}
            </View>

            {/* Evening card (skin cycling). Dark */}
            <View
              className={compactPlan ? 'mt-2.5 rounded-[22px]' : 'mt-3 rounded-[22px]'}
              style={{
                backgroundColor: colors.night,
                paddingHorizontal: compactPlan ? 18 : 20,
                paddingVertical: compactPlan ? 14 : 18,
              }}
            >
              <View
                className={
                  compactPlan
                    ? 'mb-2 flex-row items-center gap-2.5'
                    : 'mb-3 flex-row items-center gap-2.5'
                }
              >
                <View
                  className="h-[18px] w-[18px] items-center justify-center rounded-full"
                  style={{ backgroundColor: colors.nightSurface }}
                >
                  <View
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: colors.clayBright }}
                  />
                </View>
                <Text
                  className="font-mono text-[13px] uppercase tracking-[1px]"
                  style={{ color: colors.clayBright }}
                >
                  Evening · skin cycling
                </Text>
              </View>
              {exfoliant ? (
                <EveningRow
                  compact={compactPlan}
                  nightLabel="N1"
                  name={exfoliant.name.replace(/\s*Toner$/i, '')}
                  suffix="exfoliate"
                  accent={false}
                />
              ) : null}
              {retinoid ? (
                <EveningRow
                  compact={compactPlan}
                  nightLabel="N2"
                  name={retinoid.name}
                  suffix={retRamp ? `${retRamp.state.freqPerWeek}×/week to start` : 'tonight'}
                  accent
                />
              ) : null}
              <EveningRow
                compact={compactPlan}
                nightLabel="N3–4"
                name="Recover"
                suffix="ceramide only"
                accent={false}
              />
            </View>

            {/* Honest gap note. Only when a category is missing */}
            {plan?.gaps.length ? (
              <View
                className={
                  compactPlan
                    ? 'mt-8 flex-row gap-2.5 rounded-2xl bg-greige-chip px-4 py-3'
                    : 'mt-3.5 flex-row gap-2.5 rounded-2xl bg-greige-chip px-4 py-3'
                }
              >
                <View
                  className="mt-1.5 h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: colors.muted }}
                />
                <Text variant="bodySm" tone="muted" className="flex-1 text-[12.5px]">
                  {plan.gaps[0]}
                </Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>

      <View
        className="pt-2 pb-4"
        style={{
          backgroundColor: colors.paper,
          marginHorizontal: -24,
          paddingHorizontal: 24,
          zIndex: 10,
        }}
      >
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
