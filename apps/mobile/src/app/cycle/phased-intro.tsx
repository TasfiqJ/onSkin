import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Sheet, Text } from '@/components/ui';
import { useCycle } from '@/features/scheduler/useCycle';

// Phased introduction (design screen 07, docs/05 §4). Don't start every active at
// once. A new active is staged in next, on its own night, so any reaction is
// attributable (the dermatologist "one at a time" rule made into product
// behaviour). Staging is automatic (orchestrate marks recently-added actives);
// this surface explains it.
function Step({
  state,
  title,
  sub,
  last,
}: {
  state: 'done' | 'next' | 'pending';
  title: string;
  sub: string;
  last?: boolean;
}) {
  return (
    <View className="flex-row gap-3.5">
      <View className="items-center">
        <View
          className="h-6 w-6 items-center justify-center rounded-full"
          style={
            state === 'done'
              ? { backgroundColor: '#A5694B' }
              : state === 'next'
                ? { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#A5694B' }
                : { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: 'rgba(32,27,21,0.18)' }
          }>
          {state === 'done' ? <Text className="text-[11px] text-paper">✓</Text> : null}
          {state === 'next' ? <View className="h-[7px] w-[7px] rounded-full bg-clay" /> : null}
        </View>
        {!last ? <View className="my-1 w-[2px] flex-1 bg-greige-deep" style={{ minHeight: 24 }} /> : null}
      </View>
      <View className="pb-4">
        <Text variant="body" className="font-sans-bold" tone={state === 'pending' ? 'muted' : 'ink'}>
          {title}
        </Text>
        <Text variant="bodySm" tone="muted">
          {sub}
        </Text>
      </View>
    </View>
  );
}

export default function PhasedIntroScreen() {
  const { data } = useCycle();
  // The staged active's name comes from the orchestration note when present.
  const note = data?.notes.find((n) => /add your/i.test(n));
  const newName = note?.match(/add your (.+?) next week/i)?.[1] ?? 'new active';

  return (
    <Sheet>
      <Text variant="label" tone="clay" className="mb-2.5">
        ONE AT A TIME
      </Text>
      <Text variant="title" className="text-[30px] leading-[34px]" accessibilityRole="header">
        Let&apos;s not start everything at once.
      </Text>
      <Text variant="body" tone="muted" className="mt-3">
        You added {newName}. We&apos;ll bring it in <Text variant="body" className="font-sans-semibold">next week</Text>,
        once your routine settles. So if anything reacts, you&apos;ll know what caused it.
      </Text>

      <View className="mt-6">
        <Step state="done" title="This week. Your current actives" sub="Settling in" />
        <Step state="next" title={`Next week. Add ${newName}`} sub="On its own night" />
        <Step state="pending" title="Then. Your full cycle" sub="Both, safely alternated" last />
      </View>

      <Button label="Sounds good" onPress={() => router.back()} />
      <View className="items-center">
        <Text variant="bodySm" tone="muted" className="py-3 font-sans-semibold" onPress={() => router.back()}>
          Add it now anyway
        </Text>
      </View>
    </Sheet>
  );
}
