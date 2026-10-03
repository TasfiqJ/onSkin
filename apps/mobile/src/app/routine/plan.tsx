import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { router } from 'expo-router';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { Button, RouteIconButton, Screen, Text } from '@/components/ui';
import { recordRoutinePlanAnalytics } from '@/features/routine/activationAnalytics';
import {
  routineInsightCount,
  routineFirstInsightCopy,
  type RoutineFirstInsightCopy,
} from '@/features/routine/firstInsight';
import {
  canUseRoutineCadence,
  canUseRoutineRecovery,
  canUseRoutineSequencing,
} from '@/features/routine/reviewGate';
import { usePlan } from '@/features/routine/usePlan';
import { PlanSourceNotice, planSourceViewState, routineCycleViewState } from '@/features/routine/PlanSourceNotice';
import { classLabel } from '@/features/scheduler/classes';
import { CycleMutationError } from '@/features/scheduler/CycleMutationError';
import { cycleActiveSummaries, cycleRecoveryNightNumbers } from '@/features/scheduler/projection';
import { useCycle, useCycleMutations } from '@/features/scheduler/useCycle';
import { APP_YOU_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { colors } from '@/theme/tokens';

// Plan built. "Start today" (design screen 01, docs/03). The deterministic
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
      className={
        compact ? 'flex-row items-center gap-3 py-1' : 'flex-row items-center gap-3 py-1.5'
      }
    >
      <Text className="w-3.5 font-mono text-[11px]" style={{ color: colors.mutedFaint }}>
        {index}
      </Text>
      <Text
        variant="body"
        numberOfLines={compact ? 2 : 1}
        className={
          compact
            ? 'min-w-0 flex-1 font-sans-medium text-[14px]'
            : 'min-w-0 flex-1 font-sans-medium text-[14.5px]'
        }
        style={{ flexShrink: 1, minWidth: 0 }}
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
  const compactNumberLabel = compact && /^\d+$/.test(nightLabel);

  return (
    <View
      className={
        compact ? 'flex-row items-center gap-3 py-1' : 'flex-row items-center gap-3 py-1.5'
      }
    >
      <Text
        className={
          compactNumberLabel ? 'w-5 font-mono text-[11px]' : 'w-[68px] font-mono text-[11px]'
        }
        style={{ color: accent ? colors.clayBright : 'rgba(244,239,231,0.4)' }}
      >
        {nightLabel}
      </Text>
      <View className="min-w-0 flex-1">
        <Text
          numberOfLines={compact ? 2 : 1}
          className={compact ? 'font-sans-medium text-[14px]' : 'font-sans-medium text-[14.5px]'}
          style={{ color: colors.cream, flexShrink: 1, minWidth: 0 }}
        >
          {name}
        </Text>
        <Text
          numberOfLines={2}
          className="mt-0.5 font-sans text-[11px]"
          style={{ color: 'rgba(244,239,231,0.5)' }}
        >
          {suffix}
        </Text>
      </View>
    </View>
  );
}

function additionalNightSuffix(nightNumbers: number[]): string {
  return nightNumbers.length > 1 ? ` · also nights ${nightNumbers.slice(1).join(', ')}` : '';
}

function FirstInsightCard({
  compact,
  copy,
  onReviewSafety,
}: {
  compact: boolean;
  copy: RoutineFirstInsightCopy;
  onReviewSafety?: () => void;
}) {
  return (
    <View
      className={
        compact
          ? 'mt-2 rounded-2xl bg-clay-tint px-3.5 py-2.5'
          : 'mt-4 rounded-[18px] bg-clay-tint px-4 py-3.5'
      }
      style={{ borderWidth: 1, borderColor: 'rgba(172,116,84,0.16)' }}
    >
      <Text className="font-mono text-[11px] uppercase" style={{ color: colors.clayDeep }}>
        {copy.eyebrow}
      </Text>
      <Text
        className={
          compact ? 'mt-0.5 font-sans-semibold text-[15px]' : 'mt-1 font-sans-semibold text-[17px]'
        }
        style={{ color: colors.ink }}
      >
        {copy.title}
      </Text>
      <Text
        variant="bodySm"
        tone="muted"
        className={compact ? 'mt-1 text-[12.5px]' : 'mt-1.5 text-[13px]'}
      >
        {copy.body}
      </Text>
      {onReviewSafety ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Review pregnancy and breastfeeding setting"
          onPress={onReviewSafety}
          className="mt-2 min-h-[48px] flex-row items-center justify-between border-t border-hairline pt-2"
        >
          <Text className="font-sans-semibold text-[13px]" style={{ color: colors.clayDeep }}>
            Review setting
          </Text>
          <Text aria-hidden style={{ color: colors.clayDeep }}>
            ›
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function PlanScreen() {
  const { height } = useWindowDimensions();
  const planSource = usePlan();
  const sourceState = planSourceViewState(planSource);
  const data = sourceState === 'ready' ? planSource.data : undefined;
  const cycleSource = useCycle();
  const cycleState = routineCycleViewState(planSource, cycleSource);
  // Never pass unconfirmed cycle data into presentation, including neutral paths.
  const cycleData = cycleState === 'ready' ? cycleSource.data : undefined;
  function cycleCurrent(afterConfigCommit = false): boolean {
    const current = routineCycleViewState(planSource, cycleSource, { afterConfigCommit });
    return current === cycleState && (current === 'not-required' || current === 'ready');
  }
  const cycleMutations = useCycleMutations();
  // State from a predecessor lease is invisible on the successor's first render.
  // The attempt identity also protects queued settlement updates within a lease.
  const [startUi, setStartUi] = useState<{
    authority: typeof planSource.orderLease;
    attempt: object;
    status: 'starting' | 'failed' | 'idle';
  } | null>(null);
  const starting = startUi?.authority === planSource.orderLease && startUi?.status === 'starting';
  const startFailed = startUi?.authority === planSource.orderLease && startUi?.status === 'failed';
  const mounted = useRef(false);
  const startAttempt = useRef<object | null>(null);
  useLayoutEffect(() => {
    mounted.current = true;
    startAttempt.current = null;
    return () => {
      mounted.current = false;
      startAttempt.current = null;
    };
  }, [planSource.orderLease]);
  const plan = data?.plan;
  const trackedPlanView = useRef(false);
  const compactPlan = height <= 640;
  const planScrollBottomPadding = compactPlan ? 144 : 112;

  async function startToday() {
    if (!mounted.current || starting || startAttempt.current ||
        !planSource.isSourceCurrent() || !cycleCurrent()) return;
    const attempt = {};
    startAttempt.current = attempt;
    setStartUi({ authority: planSource.orderLease, attempt, status: 'starting' });
    try {
      let configCommitted = false;
      if (canUseRoutineCadence() && canUseRoutineRecovery() && cycleData?.cycle) {
        await cycleMutations.start();
        configCommitted = true;
      }
      if (!mounted.current || startAttempt.current !== attempt ||
          !planSource.isSourceCurrent() || !cycleCurrent(configCommitted)) return;
      router.replace('/today');
    } catch {
      if (mounted.current && startAttempt.current === attempt && planSource.isSourceCurrent()) {
        setStartUi({ authority: planSource.orderLease, attempt, status: 'failed' });
      }
    } finally {
      if (mounted.current && startAttempt.current === attempt) {
        startAttempt.current = null;
        setStartUi((current) =>
          current?.attempt === attempt && current.status === 'starting'
            ? { ...current, status: 'idle' }
            : current,
        );
      }
    }
  }

  const exampleExfoliant = data?.isExample
    ? plan?.pm.find((step) => step.role === 'exfoliant')
    : undefined;
  const exampleRetinoid = data?.isExample
    ? plan?.pm.find((step) => step.role === 'treatment')
    : undefined;
  const exampleRetinoidRamp = plan?.ramp.find(
    (item) => item.productId === exampleRetinoid?.productId,
  );
  const canonicalCycle = data && !data.isExample ? (cycleData?.cycle ?? null) : null;
  const cycleSummaries = canonicalCycle ? cycleActiveSummaries(canonicalCycle) : [];
  const recoveryNightNumbers = canonicalCycle ? cycleRecoveryNightNumbers(canonicalCycle) : [];
  const hasCycle = data?.isExample ? plan?.cycle != null : canonicalCycle != null;
  const awaitingCanonicalCycle =
    data?.isExample === false && plan?.cycle != null && cycleData === undefined;
  const hasSafetyExclusions = Boolean(plan?.safetyExclusions.length);
  const hasBarrierStep = plan?.pm.some((s) => s.role === 'moisturiser') ?? false;
  const hasVitCSynergy = plan?.conflicts.some(
    (c) =>
      c.rule.interactionType === 'synergy' &&
      (c.rule.tagA === 'vitamin_c' || c.rule.tagB === 'vitamin_c'),
  );
  const firstInsight = plan ? routineFirstInsightCopy(plan, data?.isExample ?? true) : null;

  useEffect(() => {
    if (!data || !planSource.isSourceCurrent() ||
        (cycleState !== 'ready' && cycleState !== 'not-required') || trackedPlanView.current) {
      return;
    }

    trackedPlanView.current = true;

    const source = data.isExample ? 'example' : 'routine_plan';
    const routineStepCount = data.plan.am.length + data.plan.pm.length;
    const insightCount = routineInsightCount(data.plan);

    void recordRoutinePlanAnalytics({
      routineStepCount,
      insightCount,
      isExample: data.isExample,
      source,
    });
  }, [data, planSource, cycleState]);

  const planNote =
    canUseRoutineSequencing() && plan && plan.unplacedProducts.length === 0
      ? (plan.gaps[0] ?? null)
      : null;

  if (sourceState !== 'ready') {
    return (
      <Screen edges={['top', 'bottom']}>
        <PlanSourceNotice
          loading={sourceState === 'loading'}
          onRetry={() => void planSource.retry().catch(() => undefined)}
          onBack={() => backOrReplace(router, APP_YOU_ROUTE)}
        />
      </Screen>
    );
  }

  if (cycleState === 'loading' || cycleState === 'unavailable') {
    return (
      <Screen edges={['top', 'bottom']}>
        <PlanSourceNotice
          cycle
          loading={cycleState === 'loading'}
          onRetry={() => void cycleSource.retry().catch(() => undefined)}
          onBack={() => backOrReplace(router, APP_YOU_ROUTE)}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-1" style={{ minHeight: 0, overflow: 'hidden' }}>
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: planScrollBottomPadding }}
        >
          <View className={compactPlan ? 'flex-row items-center' : 'flex-row items-center pt-1'}>
            <RouteIconButton
              accessibilityLabel="Back"
              disabled={starting}
              onPress={() => backOrReplace(router, APP_YOU_ROUTE)}
            />
            {compactPlan ? (
              <Text
                numberOfLines={2}
                className="ml-3 min-w-0 flex-1 font-mono text-[10.5px] uppercase"
                style={{ color: colors.clayDeep, lineHeight: 13, letterSpacing: 0 }}
              >
                {data?.profileLabel ?? 'BUILDING YOUR ROUTINE'}
              </Text>
            ) : null}
          </View>

          <View className={compactPlan ? 'pt-0' : 'pt-2'}>
            {!compactPlan ? (
              <Text
                variant="label"
                tone="clay"
                className="font-mono text-[11.5px] tracking-[1.15px]"
              >
                {data?.profileLabel ?? 'BUILDING YOUR ROUTINE'}
              </Text>
            ) : null}
            <Text
              variant="title"
              className={compactPlan ? 'mt-1' : 'mt-2'}
              style={{ fontSize: compactPlan ? 30 : 34, lineHeight: compactPlan ? 33 : 37 }}
            >
              Your routine, in order.
            </Text>

            {firstInsight ? (
              <FirstInsightCard
                copy={firstInsight}
                compact={compactPlan}
                onReviewSafety={
                  hasSafetyExclusions
                    ? () => router.push('/settings/skin-profile?returnTo=plan')
                    : undefined
                }
              />
            ) : null}

            {/* Morning card */}
            <View
              className={
                compactPlan
                  ? 'mt-2 rounded-[22px] bg-paper-raised'
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
                    ? 'mb-2 flex-row items-center justify-between'
                    : 'mb-3 flex-row items-center justify-between'
                }
              >
                <View className="flex-row items-center gap-2.5">
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
                {data?.isExample === false && (plan?.am.length ?? 0) > 1 ? (
                  <Pressable
                    accessibilityLabel="Edit morning application order"
                    accessibilityRole="button"
                    className="min-h-[48px] min-w-[48px] items-center justify-center px-1"
                    onPress={() => router.push('/routine/reorder?phase=am')}
                  >
                    <Text
                      className="font-sans-semibold text-[12.5px]"
                      style={{ color: colors.clayDeep }}
                    >
                      Edit
                    </Text>
                  </Pressable>
                ) : null}
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
            {compactPlan && hasSafetyExclusions ? <View style={{ height: 34 }} /> : null}
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
                    ? 'mb-2 flex-row items-center justify-between'
                    : 'mb-3 flex-row items-center justify-between'
                }
              >
                <View className="flex-row items-center gap-2.5">
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
                    {hasCycle ? 'Evening skin cycling' : 'Evening'}
                  </Text>
                </View>
                {data?.isExample === false && (plan?.pm.length ?? 0) > 1 ? (
                  <Pressable
                    accessibilityLabel="Edit evening application order"
                    accessibilityRole="button"
                    className="min-h-[48px] min-w-[48px] items-center justify-center px-1"
                    onPress={() => router.push('/routine/reorder?phase=pm')}
                  >
                    <Text
                      className="font-sans-semibold text-[12.5px]"
                      style={{ color: colors.clayBright }}
                    >
                      Edit
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              {hasCycle ? (
                data?.isExample ? (
                  <>
                    {exampleExfoliant ? (
                      <EveningRow
                        compact={compactPlan}
                        nightLabel="Night 1"
                        name={exampleExfoliant.name.replace(/\s*Toner$/i, '')}
                        suffix="exfoliate"
                        accent={false}
                      />
                    ) : null}
                    {exampleRetinoid ? (
                      <EveningRow
                        compact={compactPlan}
                        nightLabel="Night 2"
                        name={exampleRetinoid.name}
                        suffix={
                          exampleRetinoidRamp
                            ? `${exampleRetinoidRamp.state.freqPerWeek} times/week to start`
                            : 'tonight'
                        }
                        accent
                      />
                    ) : null}
                    <EveningRow
                      compact={compactPlan}
                      nightLabel="Nights 3-4"
                      name="Recover"
                      suffix={hasBarrierStep ? 'moisturiser only' : 'keep it simple'}
                      accent={false}
                    />
                  </>
                ) : (
                  <>
                    {cycleSummaries.map((summary) => (
                      <EveningRow
                        key={summary.productId}
                        compact={compactPlan}
                        nightLabel={`Night ${summary.nightNumbers[0]}`}
                        name={summary.name}
                        suffix={`${classLabel(summary.className)}${additionalNightSuffix(
                          summary.nightNumbers,
                        )}`}
                        accent={summary.className === 'retinoid'}
                      />
                    ))}
                    {recoveryNightNumbers.length > 0 ? (
                      <EveningRow
                        compact={compactPlan}
                        nightLabel={`Night ${recoveryNightNumbers[0]}`}
                        name="Recover"
                        suffix={`${
                          hasBarrierStep ? 'moisturiser only' : 'keep it simple'
                        }${additionalNightSuffix(recoveryNightNumbers)}`}
                        accent={false}
                      />
                    ) : null}
                  </>
                )
              ) : awaitingCanonicalCycle ? (
                <View className={compactPlan ? 'py-1' : 'py-1.5'}>
                  <Text className="font-sans-medium text-[14px]" style={{ color: colors.cream }}>
                    Preparing your cycle.
                  </Text>
                </View>
              ) : plan?.pm.length ? (
                plan.pm.map((s, i) => (
                  <EveningRow
                    key={s.productId}
                    compact={compactPlan}
                    nightLabel={`${i + 1}`}
                    name={s.name}
                    suffix={s.instruction}
                    accent={i === 0}
                  />
                ))
              ) : (
                <View className={compactPlan ? 'py-1' : 'py-1.5'}>
                  <Text className="font-sans-medium text-[14px]" style={{ color: colors.cream }}>
                    No night steps yet.
                  </Text>
                  <Text className="mt-1 text-[12px]" style={{ color: 'rgba(244,239,231,0.5)' }}>
                    {(plan?.sequencingWithheld.length ?? 0) > 0 ||
                    (plan?.cadenceWithheld.length ?? 0) > 0
                      ? 'Products awaiting reviewed order or timing stay on your shelf and out of this routine for now.'
                      : 'Add a cleanser, moisturiser, or night product to build this out.'}
                  </Text>
                </View>
              )}
            </View>

            {/* Honest gap note. Only when a category is missing */}
            {planNote ? (
              <View
                className={
                  compactPlan
                    ? 'mt-3.5 flex-row gap-2.5 rounded-2xl bg-greige-chip px-4 py-3'
                    : 'mt-3.5 flex-row gap-2.5 rounded-2xl bg-greige-chip px-4 py-3'
                }
              >
                <View
                  className="mt-1.5 h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: colors.muted }}
                />
                <Text variant="bodySm" tone="muted" className="flex-1 text-[12.5px]">
                  {planNote}
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
        {startFailed ? <CycleMutationError className="mb-2 mt-0" /> : null}
        <Button
          disabled={starting || !cycleCurrent()}
          label={starting ? 'Starting...' : startFailed ? 'Try again' : 'Start today'}
          variant="accent"
          onPress={() => void startToday()}
        />
      </View>
    </Screen>
  );
}
