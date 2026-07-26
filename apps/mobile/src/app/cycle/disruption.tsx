import type { DisruptionReason } from '@onskin/types';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';

import { Sheet, Text } from '@/components/ui';
import { canUseRoutineCadence, canUseRoutineRecovery } from '@/features/routine/reviewGate';
import { CycleMutationError } from '@/features/scheduler/CycleMutationError';
import { useCycle, useCycleMutations } from '@/features/scheduler/useCycle';
import { cn } from '@/lib/cn';
import { APP_HOME_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';

// Disruption hub (design screen 04, docs/05 §6.4/§7). Breaks are managed, not
// punished. Skip / pause / travel / procedure; resume re-anchors where you left
// off. Nothing breaks the streak (docs/03 §6).
function Option({
  glyph,
  title,
  sub,
  firm,
  compact,
  short,
  disabled,
  onPress,
}: {
  glyph: string;
  title: string;
  sub: string;
  firm?: boolean;
  compact?: boolean;
  short?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        haptics.select();
        onPress();
      }}
      accessibilityLabel={`${title}. ${sub}`}
      className={cn(
        'flex-row items-center rounded-[18px] bg-paper-raised',
        short
          ? 'min-h-[56px] gap-2.5 px-3 py-2'
          : compact
            ? 'min-h-[72px] gap-3 px-3.5 py-3'
            : 'gap-3.5 p-4',
        firm ? 'border border-amber/40' : 'border border-hairline',
      )}
      style={{ opacity: disabled ? 0.55 : 1 }}
    >
      <View
        className={cn(
          'items-center justify-center rounded-xl',
          short ? 'h-[30px] w-[30px]' : compact ? 'h-[34px] w-[34px]' : 'h-[38px] w-[38px]',
        )}
        style={{ backgroundColor: firm ? 'rgba(176,122,60,0.14)' : '#F1ECE3' }}
      >
        <Text
          className={short ? 'text-[14px]' : 'text-[16px]'}
          style={{ color: firm ? '#B07A3C' : '#8A8071' }}
        >
          {glyph}
        </Text>
      </View>
      <View className="flex-1">
        <Text
          variant="body"
          className={cn('font-sans-bold', short ? 'text-[13.5px] leading-[17px]' : undefined)}
        >
          {title}
        </Text>
        <Text
          variant="bodySm"
          tone="muted"
          numberOfLines={short ? 2 : undefined}
          className={short ? 'text-[12px] leading-[15px]' : undefined}
        >
          {sub}
        </Text>
      </View>
    </Pressable>
  );
}

export default function DisruptionScreen() {
  if (!canUseRoutineCadence()) return <CadenceReviewGate />;
  return <DisruptionScreenContent />;
}

function DisruptionScreenContent() {
  const { height } = useWindowDimensions();
  const { data } = useCycle();
  const m = useCycleMutations();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const compactSheet = height < 640;
  const shortSheet = height < 520;
  const controlsDisabled = pendingAction != null;
  const recoveryReady = canUseRoutineRecovery();

  const act = async (action: string, fn: () => Promise<void>) => {
    if (pendingAction) return;
    setPendingAction(action);
    setSaveFailed(false);
    try {
      await fn();
      backOrReplace(router);
    } catch {
      setSaveFailed(true);
    } finally {
      setPendingAction(null);
    }
  };

  const pause = (reason: DisruptionReason) => void act(reason, () => m.pause(reason));

  return (
    <Sheet
      fallbackRoute={APP_HOME_ROUTE}
      scroll
      backdropAccessible={!compactSheet}
      dismissDisabled={controlsDisabled}
      className={shortSheet ? 'px-5 pb-3 pt-3' : compactSheet ? 'pb-6' : undefined}
    >
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
        Life happens.
      </Text>
      <Text
        variant={shortSheet ? 'bodySm' : 'body'}
        tone="muted"
        className={
          shortSheet ? 'mt-1 text-[13px] leading-[17px]' : compactSheet ? 'mt-1.5' : 'mt-2'
        }
      >
        Take a break whenever you need. Nothing breaks, and we&apos;ll pick up right where you left
        off.
      </Text>

      <View className={shortSheet ? 'mt-3 gap-1.5' : compactSheet ? 'mt-4 gap-2' : 'mt-6 gap-2.5'}>
        {data?.paused ? (
          <Option
            glyph="→"
            compact={compactSheet}
            short={shortSheet}
            disabled={controlsDisabled}
            title={pendingAction === 'resume' ? 'Resuming routine...' : 'Resume my routine'}
            sub="Continue from the night where you paused"
            onPress={() => void act('resume', m.resume)}
          />
        ) : (
          <>
            <Option
              glyph="‖"
              compact={compactSheet}
              short={shortSheet}
              disabled={controlsDisabled}
              title="Skip tonight"
              sub="Just this once. The cycle continues"
              onPress={() => void act('skip', m.skip)}
            />
            <Option
              glyph="◴"
              compact={compactSheet}
              short={shortSheet}
              disabled={controlsDisabled}
              title="Pause my routine"
              sub="Vacation, illness, a break"
              onPress={() => pause('break')}
            />
            <Option
              glyph="→"
              compact={compactSheet}
              short={shortSheet}
              disabled={controlsDisabled}
              title="Travel mode"
              sub="Trim to essentials while away"
              onPress={() => pause('travel')}
            />
          </>
        )}
        {recoveryReady ? (
          <Option
            glyph="◇"
            compact={compactSheet}
            short={shortSheet}
            disabled={controlsDisabled}
            title="I had a facial or peel"
            sub="Pause actives, let skin recover"
            firm
            onPress={() => {
              setSaveFailed(false);
              router.replace('/cycle/procedure');
            }}
          />
        ) : null}
      </View>
      {saveFailed ? <CycleMutationError /> : null}
    </Sheet>
  );
}

function CadenceReviewGate() {
  return (
    <Sheet fallbackRoute={APP_HOME_ROUTE} scroll>
      <Text variant="title" className="text-[30px] leading-[34px]" accessibilityRole="header">
        Cycle controls are unavailable.
      </Text>
      <Text variant="body" tone="muted" className="mt-2">
        Pause, skip, travel, and recovery controls stay unavailable until their exact rules and copy
        complete required professional review.
      </Text>
    </Sheet>
  );
}
