import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';

import { Button, Sheet, Text } from '@/components/ui';
import { CycleMutationError } from '@/features/scheduler/CycleMutationError';
import { useCycle, useCycleMutations } from '@/features/scheduler/useCycle';
import { cn } from '@/lib/cn';
import { APP_HOME_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';

// Phased introduction (design screen 07, docs/05 section 4). Don't start every
// active at once. A new active is staged next, on its own night, so any reaction
// is attributable. Staging is automatic; this surface explains it.
function Step({
  state,
  title,
  sub,
  last,
  compact,
  short,
}: {
  state: 'done' | 'next' | 'pending';
  title: string;
  sub: string;
  last?: boolean;
  compact?: boolean;
  short?: boolean;
}) {
  return (
    <View className={cn('flex-row', short ? 'gap-2.5' : 'gap-3.5')}>
      <View className="items-center">
        <View
          className={cn('items-center justify-center rounded-full', short ? 'h-5 w-5' : 'h-6 w-6')}
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
          {state === 'done' ? (
            <Text className={cn('text-paper', short ? 'text-[10px]' : 'text-[11px]')}>
              {'\u2713'}
            </Text>
          ) : null}
          {state === 'next' ? (
            <View
              className={cn('rounded-full bg-clay', short ? 'h-1.5 w-1.5' : 'h-[7px] w-[7px]')}
            />
          ) : null}
        </View>
        {!last ? (
          <View
            className={cn('w-[2px] flex-1 bg-greige-deep', short ? 'my-0.5' : 'my-1')}
            style={{ minHeight: short ? 8 : compact ? 14 : 24 }}
          />
        ) : null}
      </View>
      <View className={short ? 'pb-1.5' : compact ? 'pb-2.5' : 'pb-4'}>
        <Text
          variant="body"
          className={cn('font-sans-bold', short ? 'text-[13.5px] leading-[17px]' : undefined)}
          tone={state === 'pending' ? 'muted' : 'ink'}
        >
          {title}
        </Text>
        <Text
          variant="bodySm"
          tone="muted"
          className={short ? 'text-[12px] leading-[15px]' : undefined}
        >
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
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const compactSheet = height < 640;
  const shortSheet = height < 520;
  const note = data?.notes.find((n) => /add your/i.test(n));
  const newName = note?.match(/add your (.+?) next week/i)?.[1] ?? 'new active';
  const stagedIds = data?.stagedActiveIds ?? [];

  async function addNow() {
    if (saving) return;
    if (stagedIds.length === 0) {
      backOrReplace(router);
      return;
    }
    setSaving(true);
    setSaveFailed(false);
    try {
      await overrideStaging(stagedIds);
      backOrReplace(router);
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      fallbackRoute={APP_HOME_ROUTE}
      scroll
      backdropAccessible={!compactSheet}
      dismissDisabled={saving}
      className={shortSheet ? 'px-5 pb-3 pt-3' : compactSheet ? 'pb-6' : undefined}
    >
      <Text variant="label" tone="clay" className={shortSheet ? 'mb-1.5' : 'mb-2.5'}>
        ONE AT A TIME
      </Text>
      <Text
        variant="title"
        className={
          shortSheet
            ? 'text-[25px] leading-[27px]'
            : compactSheet
              ? 'text-[28px] leading-[31px]'
              : 'text-[30px] leading-[34px]'
        }
        accessibilityRole="header"
      >
        Let&apos;s not start everything at once.
      </Text>
      <Text
        variant={shortSheet ? 'bodySm' : 'body'}
        tone="muted"
        className={shortSheet ? 'mt-1 text-[13px] leading-[17px]' : compactSheet ? 'mt-2' : 'mt-3'}
      >
        You added {newName}. We&apos;ll bring it in{' '}
        <Text variant={shortSheet ? 'bodySm' : 'body'} className="font-sans-semibold">
          next week
        </Text>
        , once your routine settles. So if anything reacts, you&apos;ll know what caused it.
      </Text>

      <View className={shortSheet ? 'mt-3' : compactSheet ? 'mt-4' : 'mt-6'}>
        <Step
          compact={compactSheet}
          short={shortSheet}
          state="done"
          title="This week. Your current actives"
          sub="Settling in"
        />
        <Step
          compact={compactSheet}
          short={shortSheet}
          state="next"
          title={`Next week. Add ${newName}`}
          sub="On its own night"
        />
        <Step
          compact={compactSheet}
          short={shortSheet}
          state="pending"
          title="Then. Your full cycle"
          sub="Both, safely alternated"
          last
        />
      </View>

      {saveFailed ? <CycleMutationError className={shortSheet ? 'mt-2' : undefined} /> : null}

      <Button
        className={shortSheet ? 'mt-1 py-0' : compactSheet ? 'min-h-[48px] py-3' : undefined}
        label="Sounds good"
        disabled={saving}
        onPress={() => backOrReplace(router)}
        style={shortSheet ? { height: 48, minHeight: 48, paddingVertical: 0 } : undefined}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: saving }}
        disabled={saving}
        className={cn(
          'items-center justify-center',
          'min-h-[48px]',
          compactSheet && !shortSheet ? 'pt-1' : null,
        )}
        onPress={() => void addNow()}
        style={{ opacity: saving ? 0.55 : 1 }}
      >
        <Text variant="bodySm" tone="muted" className="font-sans-semibold">
          {saving
            ? 'Saving change...'
            : saveFailed
              ? 'Try adding it now again'
              : 'Add it now anyway'}
        </Text>
      </Pressable>
    </Sheet>
  );
}
