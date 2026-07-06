import { router } from 'expo-router';
import { Pressable, View, useWindowDimensions } from 'react-native';

import { Button, Sheet, Text } from '@/components/ui';
import { useCycle, useCycleMutations } from '@/features/scheduler/useCycle';
import { cn } from '@/lib/cn';
import { APP_HOME_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';

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
  compact,
}: {
  state: 'done' | 'next' | 'pending';
  title: string;
  sub: string;
  last?: boolean;
  compact?: boolean;
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
                : {
                    backgroundColor: '#FFFFFF',
                    borderWidth: 1.5,
                    borderColor: 'rgba(32,27,21,0.18)',
                  }
          }
        >
          {state === 'done' ? <Text className="text-[11px] text-paper">✓</Text> : null}
          {state === 'next' ? <View className="h-[7px] w-[7px] rounded-full bg-clay" /> : null}
        </View>
        {!last ? (
          <View
            className="my-1 w-[2px] flex-1 bg-greige-deep"
            style={{ minHeight: compact ? 14 : 24 }}
          />
        ) : null}
      </View>
      <View className={compact ? 'pb-2.5' : 'pb-4'}>
        <Text
          variant="body"
          className="font-sans-bold"
          tone={state === 'pending' ? 'muted' : 'ink'}
        >
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
  const { height } = useWindowDimensions();
  const { data } = useCycle();
  const { overrideStaging } = useCycleMutations();
  const compactSheet = height < 640;
  // The staged active's name comes from the orchestration note when present.
  const note = data?.notes.find((n) => /add your/i.test(n));
  const newName = note?.match(/add your (.+?) next week/i)?.[1] ?? 'new active';
  const stagedIds = data?.stagedActiveIds ?? [];

  // "Add it now anyway" (docs/05 §6.2): opt the staged active(s) out of phasing
  // so the next orchestration brings them straight into the cycle.
  async function addNow() {
    await Promise.all(stagedIds.map((id) => overrideStaging(id)));
    backOrReplace(router);
  }

  return (
    <Sheet
      fallbackRoute={APP_HOME_ROUTE}
      scroll
      backdropAccessible={!compactSheet}
      className={compactSheet ? 'pb-6' : undefined}
    >
      <Text variant="label" tone="clay" className="mb-2.5">
        ONE AT A TIME
      </Text>
      <Text
        variant="title"
        className={compactSheet ? 'text-[28px] leading-[31px]' : 'text-[30px] leading-[34px]'}
        accessibilityRole="header"
      >
        Let&apos;s not start everything at once.
      </Text>
      <Text variant="body" tone="muted" className={compactSheet ? 'mt-2' : 'mt-3'}>
        You added {newName}. We&apos;ll bring it in{' '}
        <Text variant="body" className="font-sans-semibold">
          next week
        </Text>
        , once your routine settles. So if anything reacts, you&apos;ll know what caused it.
      </Text>

      <View className={compactSheet ? 'mt-4' : 'mt-6'}>
        <Step
          compact={compactSheet}
          state="done"
          title="This week. Your current actives"
          sub="Settling in"
        />
        <Step
          compact={compactSheet}
          state="next"
          title={`Next week. Add ${newName}`}
          sub="On its own night"
        />
        <Step
          compact={compactSheet}
          state="pending"
          title="Then. Your full cycle"
          sub="Both, safely alternated"
          last
        />
      </View>

      <Button
        className={compactSheet ? 'min-h-[48px] py-3' : undefined}
        label="Sounds good"
        onPress={() => backOrReplace(router)}
      />
      <Pressable
        accessibilityRole="button"
        className={cn('min-h-[48px] items-center justify-center', compactSheet ? 'pt-1' : null)}
        onPress={() => void addNow()}
      >
        <Text variant="bodySm" tone="muted" className="font-sans-semibold">
          Add it now anyway
        </Text>
      </Pressable>
    </Sheet>
  );
}
