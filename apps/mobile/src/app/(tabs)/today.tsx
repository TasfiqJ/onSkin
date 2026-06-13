import { ScrollView, View } from 'react-native';

import { Card, Screen, Text } from '@/components/ui';
import { StepRow } from '@/features/today/StepRow';
import { useToday, useToggleStep } from '@/features/today/useToday';
import { useAuth } from '@/lib/auth/AuthProvider';

// Today — the habit loop (design spec p.8/9). AM light, PM dark. Check-off is the
// activation metric (docs/01 §7). Routine CONTENT comes from the routine builder
// (Document 3, missing) — until then this shows the user's routine if one exists,
// else an honest empty state.
export default function TodayScreen() {
  const { user } = useAuth();
  const { data, isLoading } = useToday();
  const toggle = useToggleStep();

  const type = data?.type ?? 'AM';
  const dark = type === 'PM';
  const steps = data?.steps ?? [];
  const doneCount = steps.filter((s) => s.done).length;
  const nextIndex = steps.findIndex((s) => !s.done);

  const firstName =
    (user?.user_metadata?.display_name as string | undefined)?.split(' ')[0] ??
    (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] ??
    null;
  const greeting = dark ? 'Good evening' : 'Good morning';
  const dateLabel = new Date()
    .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    .toUpperCase();

  return (
    <Screen tone={dark ? 'night' : 'paper'} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-6">
        <View className="mt-2 flex-row items-center justify-between">
          <Text variant="label" tone={dark ? 'inverseMuted' : 'muted'}>
            {dateLabel}
          </Text>
          {data && data.streak > 0 ? (
            <View className="rounded-pill bg-clay/10 px-3 py-1">
              <Text variant="label" tone="clay">
                {data.streak} days
              </Text>
            </View>
          ) : null}
        </View>

        <Text variant="title" tone={dark ? 'inverse' : 'ink'} className="mt-3">
          {greeting}
          {firstName ? `, ${firstName}.` : '.'}
        </Text>

        {isLoading ? null : steps.length === 0 ? (
          <Card tone={dark ? 'night' : 'paper'} className="mt-8">
            <Text variant="titleSm" tone={dark ? 'inverse' : 'ink'}>
              Your routine is on its way.
            </Text>
            <Text variant="bodySm" tone={dark ? 'inverseMuted' : 'muted'} className="mt-2">
              The routine builder — order, timing and skin cycling tuned to your profile — is the
              next build slice. Once it&apos;s in, your AM and PM steps appear here to check off.
            </Text>
          </Card>
        ) : (
          <Card tone={dark ? 'night' : 'paper'} className="mt-7">
            <View className="mb-2 flex-row items-baseline justify-between">
              <Text variant="titleSm" tone={dark ? 'inverse' : 'ink'}>
                {dark ? 'Evening routine' : 'Morning routine'}
              </Text>
              <Text variant="label" tone={dark ? 'inverseMuted' : 'muted'}>
                {doneCount} of {steps.length}
              </Text>
            </View>
            {steps.map((step, i) => (
              <StepRow
                key={step.id}
                name={step.name}
                instruction={step.instruction}
                done={step.done}
                isNext={i === nextIndex}
                dark={dark}
                onPress={() => {
                  if (!step.done && data?.routineId) {
                    toggle.mutate({ routineId: data.routineId, stepId: step.id });
                  }
                }}
              />
            ))}
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}
