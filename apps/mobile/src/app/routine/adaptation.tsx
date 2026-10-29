import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { routineFirstInsightCopy } from '@/features/routine/firstInsight';
import { planSourceViewState, PlanSourceNotice } from '@/features/routine/PlanSourceNotice';
import { usePlan } from '@/features/routine/usePlan';
import { backOrReplace } from '@/lib/navigation/safeBack';

// This route has no stored before/after diff or undo operation. Summarize the
// current confirmed source and its genuine review status, without inventing one.
export default function AdaptationScreen() {
  const source = usePlan();
  const state = planSourceViewState(source);
  if (state !== 'ready' || !source.data) {
    return (
      <Screen edges={['top', 'bottom']}>
        <PlanSourceNotice
          loading={state === 'loading'}
          onRetry={() => void source.retry().catch(() => undefined)}
          onBack={() => backOrReplace(router)}
        />
      </Screen>
    );
  }
  const { data } = source;
  const insight = routineFirstInsightCopy(data.plan, data.isExample);
  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-6 pt-4"
      >
        <Text variant="label" tone="clay" className="font-mono">
          {data.isExample ? 'EXAMPLE ROUTINE' : 'CURRENT ROUTINE'}
        </Text>
        <Text variant="title" className="mt-2.5">
          Current routine
        </Text>
        <Text variant="bodySm" tone="muted" className="mt-2">
          {data.isExample
            ? 'Add products to your Shelf to see your own routine status.'
            : 'This is your current saved-source summary. A before-and-after change history is not available.'}
        </Text>
        <Card className="mt-6">
          <Text variant="label" tone="clay">
            {insight.eyebrow}
          </Text>
          <Text variant="titleSm" className="mt-2">
            {insight.title}
          </Text>
          <Text variant="bodySm" tone="muted" className="mt-2">
            {insight.body}
          </Text>
        </Card>
        <Text variant="bodySm" tone="muted" className="mt-4">
          Products awaiting reviewed guidance stay on your Shelf. No new use instructions or
          completed changes are inferred here.
        </Text>
      </ScrollView>
      <View className="pb-2">
        <Button
          label="Back to routine"
          onPress={() => {
            if (source.isSourceCurrent()) backOrReplace(router);
          }}
        />
      </View>
    </Screen>
  );
}
