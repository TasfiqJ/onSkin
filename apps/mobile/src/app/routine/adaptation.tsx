import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import type { GeneratedPlan } from '@/features/routine/generate';
import { usePlan } from '@/features/routine/usePlan';
import { backOrReplace } from '@/lib/navigation/safeBack';
import { colors } from '@/theme/tokens';

// 09 · Adaptation. "Here's what changed" (design 09, docs/03 §7/§8). After a
// product is added, the deterministic pipeline re-runs and explains exactly what
// changed and why. And that prior overrides were preserved. Everything is undoable.
// Uses the same generated plan as the reveal/routine screens; until server-side
// recompute diffs ship, it summarizes the current generated plan honestly instead
// of presenting a hard-coded product as if it came from the user's shelf.
type Change = { kind: 'added' | 'neutral' | 'kept'; title: string; body: string };

function listNames(names: string[]): string {
  if (names.length === 0) return 'your current products';
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function adaptationChanges(plan: GeneratedPlan | undefined, isExample: boolean): Change[] {
  if (!plan) {
    return [
      {
        kind: 'neutral',
        title: 'Checking your routine',
        body: 'We are loading the latest shelf and profile signals before showing a change summary.',
      },
    ];
  }

  const morning = plan.am.map((step) => step.name);
  const eveningActives = plan.pm
    .filter((step) => step.role === 'exfoliant' || step.role === 'treatment')
    .map((step) => step.name);
  const changes: Change[] = [
    {
      kind: 'added',
      title: isExample ? 'Example order refreshed' : 'Routine order refreshed',
      body: morning.length
        ? `${listNames(morning)} stay in a calm morning sequence.`
        : 'No morning products are on this plan yet, so we keep the routine open-ended.',
    },
  ];

  if (eveningActives.length > 0) {
    changes.push({
      kind: 'neutral',
      title: 'Active nights stay separated',
      body: `${listNames(eveningActives)} stay scheduled away from recovery nights where needed.`,
    });
  } else {
    changes.push({
      kind: 'neutral',
      title: 'No active-night changes',
      body: 'There are no retinoid or exfoliant steps to reschedule right now.',
    });
  }

  changes.push({
    kind: 'kept',
    title: 'Your choices stay in control',
    body: isExample
      ? 'This is an example preview. Add products to your shelf to see live adaptation notes.'
      : 'Any saved conflict choices stay respected when the routine is recalculated.',
  });

  return changes;
}

function ChangeCard({ change }: { change: Change }) {
  const sage = change.kind === 'added';
  return (
    <View
      className="flex-row gap-3.5 rounded-[18px] p-4"
      style={
        sage
          ? { backgroundColor: colors.sageTint }
          : { backgroundColor: colors.paperRaised, borderWidth: 1, borderColor: colors.hairline }
      }
    >
      <View
        className="h-[26px] w-[26px] items-center justify-center rounded-full"
        style={{
          backgroundColor:
            change.kind === 'added'
              ? colors.paperRaised
              : change.kind === 'kept'
                ? colors.clayTint
                : colors.greige,
        }}
      >
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
        <Text
          className="font-sans-bold text-[14.5px]"
          style={{ color: sage ? colors.sageDeep : colors.ink }}
        >
          {change.title}
        </Text>
        <Text
          className="mt-0.5 text-[13px]"
          style={{ color: sage ? colors.sageEyebrow : colors.mutedStrong }}
        >
          {change.body}
        </Text>
      </View>
    </View>
  );
}

export default function AdaptationScreen() {
  const { data, isLoading } = usePlan();
  const changes = adaptationChanges(data?.plan, Boolean(data?.isExample));

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-6 pt-4"
      >
        <View>
          <Text variant="label" tone="clay" className="font-mono">
            {data?.isExample ? 'EXAMPLE ROUTINE' : 'ROUTINE UPDATED'}
          </Text>
          <Text variant="title" className="mt-2.5 text-[32px]">
            Here&apos;s what changed.
          </Text>
          <Text variant="bodySm" tone="muted" className="mt-2 text-[14px]">
            {isLoading
              ? 'Checking your shelf before we summarize the update.'
              : data?.isExample
                ? 'This preview shows the explanation style until your shelf has products.'
                : 'We rechecked your shelf and routine rules. Nothing is locked.'}
          </Text>

          <View className="mt-6 gap-3">
            {changes.map((c) => (
              <ChangeCard key={c.title} change={c} />
            ))}
          </View>
        </View>
      </ScrollView>

      <View className="flex-row items-center gap-2.5 pb-2">
        <View className="flex-1">
          <Button label="Looks good" onPress={() => backOrReplace(router)} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Undo"
          className="h-[54px] w-[54px] items-center justify-center rounded-pill bg-paper-raised"
          style={{ borderWidth: 1, borderColor: 'rgba(32,27,21,0.12)' }}
          onPress={() => backOrReplace(router)}
        >
          <Text style={{ color: colors.muted, fontSize: 18 }}>↺</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
