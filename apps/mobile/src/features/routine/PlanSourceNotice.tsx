import { View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { colors } from '@/theme/tokens';

import type { RecoverableCycleHookResult } from '@/features/scheduler/useCycle';

import { canUseRoutineCadence } from './reviewGate';
import type { RecoverablePlanHookResult } from './usePlan';

/** Shared real-hook/route boundary: unknown and cached error data are not absence. */
export function planSourceViewState(
  source: RecoverablePlanHookResult,
): 'loading' | 'unavailable' | 'ready' {
  if (source.isLoading || source.isRefreshing) return 'loading';
  if (!source.sourceReady || source.isError || !source.data || !source.isSourceCurrent()) {
    return 'unavailable';
  }
  return 'ready';
}

/** Gate only routines whose real, admitted steps depend on a saved schedule.
 * Do not infer relevance from cycle.data: it may be missing, stale or cap-derived.
 * Example plans and deliberately closed cadence never borrow a saved cycle. */
export function routineCycleViewState(
  plan: RecoverablePlanHookResult,
  cycle: RecoverableCycleHookResult,
  options?: { afterConfigCommit?: boolean },
): 'not-required' | 'loading' | 'unavailable' | 'ready' {
  const data = plan.data;
  if (!canUseRoutineCadence() || !data || data.isExample ||
      (data.plan.cycle === null && data.plan.ramp.length === 0 &&
       ![...data.plan.am, ...data.plan.pm].some((step) => step.cadence === 'cycle'))) {
    return 'not-required';
  }
  if (cycle.isLoading || cycle.isRefreshing) return 'loading';
  if (!cycle.sourceReady || cycle.isError || !cycle.data || !cycle.isSourceCurrent(options)) {
    return 'unavailable';
  }
  return 'ready';
}

export function PlanSourceNotice({
  loading,
  dark = false,
  cycle = false,
  onRetry,
  onBack,
}: {
  loading: boolean;
  dark?: boolean;
  cycle?: boolean;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <View className="flex-1 justify-center gap-4 py-6" accessibilityLiveRegion="polite">
      <Text
        variant="title"
        accessibilityRole={loading ? 'header' : 'alert'}
        style={{ color: dark ? colors.cream : colors.ink }}
      >
        {cycle
          ? loading ? 'Loading your saved cycle…' : 'Your saved cycle is unavailable.'
          : loading ? 'Loading your routine…' : 'Your routine is unavailable.'}
      </Text>
      <Text variant="body" style={{ color: dark ? colors.cream : colors.muted }}>
        {cycle
          ? 'Confirm your saved cycle and ramp settings before starting or checking off this routine.'
          : loading
          ? 'Confirming your saved routine, products and profile.'
          : 'We could not confirm your saved routine, products or profile. Try again to reload them.'}
      </Text>
      {!loading ? (
        <Button label={cycle ? 'Retry cycle' : 'Retry routine'} variant={dark ? 'inverse' : 'primary'} onPress={onRetry} />
      ) : null}
      <Button label="Back" variant={dark ? 'inverse' : 'primary'} onPress={onBack} />
    </View>
  );
}
