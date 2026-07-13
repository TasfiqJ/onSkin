import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Card, RouteIconButton, Screen, Text } from '@/components/ui';
import { useProgress, type DayState, type HeatCell } from '@/features/routine/useProgress';
import { useCycle } from '@/features/scheduler/useCycle';
import { currentMilestone } from '@/features/streak/milestones';
import { markMilestoneSeen } from '@/features/streak/milestoneStore';
import { CompletionHistoryState } from '@/features/today/CompletionHistoryState';
import { track } from '@/lib/analytics/track';
import { backOrReplace } from '@/lib/navigation/safeBack';
import { colors } from '@/theme/tokens';

// Streak & adherence. The calm, forgiving streak (docs/03 §6/§9.5, D-025).
// Relocated here from the Progress tab in Slice 20: docs/06 makes the Progress tab
// the photo timeline, so this routine-domain surface lives in the routine stack
// and is reached from the You tab + Today's streak pill. No all-or-nothing counter,
// no shame copy; a grace-day "Streak protected" reassurance. Photos are a slower,
// separate cadence (docs/06 §5). Deliberately decoupled from this daily streak.

const HEAT = ['#EFEAE1', '#EDE5D8', '#E0C3AC', colors.clay] as const;

function weekDaySquare(state: DayState): {
  bg: string;
  dot?: string;
  ring?: boolean;
  labelClay?: boolean;
} {
  switch (state) {
    case 'done':
      return { bg: colors.clay };
    case 'frozen':
      // a missed day a grace freeze absorbed. Soft sage, not a shameful gap
      return { bg: colors.sageTint, dot: colors.sage };
    case 'missed':
      return { bg: '#EDE5D8', dot: '#D6C9B5' };
    case 'today':
      return { bg: colors.greige, ring: true, labelClay: true };
    default:
      return { bg: colors.greige };
  }
}

export default function StreakScreen() {
  const progressQuery = useProgress();
  const { data } = progressQuery;
  const { data: cycleData } = useCycle();
  const week = data?.week ?? [];
  const heat = data?.heat ?? [];

  // Highest calm milestone the current streak has reached (docs/07 §4.5). The
  // "one cycle" marker uses the real cycle length when available.
  const cycleLength = cycleData?.cycle?.lengthNights ?? 4;
  const milestone = currentMilestone(data?.streak ?? 0, cycleLength);

  // Fire the analytics event once per milestone (first crossing only).
  useEffect(() => {
    if (!milestone) return;
    void markMilestoneSeen(milestone.key).then((fresh) => {
      if (fresh)
        track('streak_milestone_reached', { milestone: milestone.key, streak: data?.streak });
    });
  }, [milestone?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (progressQuery.isPending || progressQuery.isError) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View className="flex-row items-center justify-between pt-1">
          <RouteIconButton accessibilityLabel="Back" onPress={() => backOrReplace(router)} />
          <Text variant="label" tone="muted">
            STREAK & ADHERENCE
          </Text>
          <View style={{ width: 44 }} />
        </View>
        <CompletionHistoryState
          failed={progressQuery.isError}
          retrying={progressQuery.isFetching}
          onRetry={() => void progressQuery.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-8">
        <View className="flex-row items-center justify-between pt-1">
          <RouteIconButton accessibilityLabel="Back" onPress={() => backOrReplace(router)} />
          <Text variant="label" tone="muted">
            STREAK & ADHERENCE
          </Text>
          <View style={{ width: 44 }} />
        </View>

        <Text variant="title" className="mt-3">
          Showing up beats being perfect.
        </Text>
        <Text variant="bodySm" tone="muted" className="mt-1">
          {(data?.streak ?? 0) > 0
            ? `${data?.streak}-day streak · best ${data?.longest ?? 0}`
            : 'Your nights, no pressure.'}
        </Text>

        {/* Calm milestone marker (docs/07 §4.5). A gentle acknowledgement, no confetti. */}
        {milestone ? (
          <View
            className="mt-4 flex-row items-center gap-3.5 rounded-card p-4"
            style={{ backgroundColor: colors.sageTint }}
          >
            <View className="h-9 w-9 items-center justify-center rounded-full bg-paper-raised">
              <View className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: colors.sage }} />
            </View>
            <Text variant="bodySm" className="flex-1" style={{ color: colors.sageDeep }}>
              {milestone.copy}
            </Text>
          </View>
        ) : null}

        {/* This week */}
        <Card className="mt-5">
          <View className="mb-4 flex-row items-center justify-between">
            <Text variant="body" className="font-sans-bold">
              This week
            </Text>
            <Text variant="label" tone="clay" className="font-mono-medium">
              {data?.weeklyDone ?? 0} of 7 nights
            </Text>
          </View>
          <View className="flex-row gap-1.5">
            {week.map((d, i) => {
              const s = weekDaySquare(d.state);
              return (
                <View key={i} className="flex-1 items-center">
                  <View
                    className="aspect-square w-full items-center justify-center rounded-[9px]"
                    style={{
                      backgroundColor: s.bg,
                      borderWidth: s.ring ? 1.5 : 0,
                      borderColor: colors.hairline,
                    }}
                  >
                    {s.dot ? (
                      <View
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: s.dot }}
                      />
                    ) : null}
                  </View>
                  <Text
                    variant="label"
                    className="mt-1.5 font-mono text-[10px]"
                    style={{ color: s.labelClay ? colors.clay : colors.muted }}
                  >
                    {d.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Grace-day reassurance. Only when a freeze is absorbing a recent miss. */}
        {data?.graceUsed ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/routine/welcome-back')}
            className="mt-3.5 flex-row items-center gap-3.5 rounded-card bg-sage-tint p-4"
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-paper-raised">
              <View
                className="h-4 w-4 rounded-[5px] border-2"
                style={{ borderColor: colors.sage }}
              />
            </View>
            <View className="flex-1">
              <Text variant="body" className="font-sans-bold" style={{ color: colors.sageDeep }}>
                Streak protected
              </Text>
              <Text variant="bodySm" className="mt-0.5" style={{ color: colors.sageEyebrow }}>
                A grace day absorbed the gap. Your {data.streak} days stand. No reset.
              </Text>
            </View>
          </Pressable>
        ) : null}

        {/* Lapsed. A calm, no-shame earn-back invite. */}
        {data?.lapsed ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/routine/welcome-back')}
            className="mt-3.5 flex-row items-center gap-3.5 rounded-card p-4"
            style={{ backgroundColor: colors.greige }}
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-paper-raised">
              <View
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: colors.clayBright }}
              />
            </View>
            <View className="flex-1">
              <Text variant="body" className="font-sans-bold">
                Welcome back
              </Text>
              <Text variant="bodySm" tone="muted" className="mt-0.5">
                It&apos;s been a few days. That&apos;s okay. Pick up tonight; consistency over time
                is what counts.
              </Text>
            </View>
          </Pressable>
        ) : null}

        {/* Month heat-map */}
        <Card className="mt-3.5">
          <View className="mb-3.5 flex-row items-center justify-between">
            <Text variant="body" className="font-sans-bold">
              {data?.monthLabel ?? ''}
            </Text>
            <View className="flex-row items-center gap-1.5">
              <Text variant="label" tone="muted" className="font-mono text-[10px]">
                less
              </Text>
              {[HEAT[1], HEAT[2], HEAT[3]].map((c, i) => (
                <View
                  key={i}
                  className="h-2.5 w-2.5 rounded-[3px]"
                  style={{ backgroundColor: c }}
                />
              ))}
              <Text variant="label" tone="muted" className="font-mono text-[10px]">
                more
              </Text>
            </View>
          </View>
          <View className="flex-row flex-wrap gap-1.5">
            {heat.map((cell: HeatCell, i) => (
              <View
                key={i}
                className="aspect-square rounded-[5px]"
                style={{ width: '12.4%', backgroundColor: HEAT[cell.intensity] }}
              />
            ))}
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}
