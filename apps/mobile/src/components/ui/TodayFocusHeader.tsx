import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

import { Text } from './Text';

export type TodayFocusHeaderProps = {
  phase: 'AM' | 'PM';
  dateLabel: string;
  clockLabel?: string;
  total: number;
  completed: number;
  hasRoutine: boolean;
  streakDays?: number;
};

function routineSummary({
  completed,
  hasRoutine,
  phase,
  total,
}: Pick<TodayFocusHeaderProps, 'completed' | 'hasRoutine' | 'phase' | 'total'>): string {
  if (!hasRoutine) return 'Add what you use and we’ll turn it into a simple checklist.';
  if (total === 0) return phase === 'AM' ? 'Nothing is scheduled this morning.' : 'Nothing is scheduled tonight.';
  const remaining = Math.max(total - completed, 0);
  if (remaining === 0) return phase === 'AM' ? 'Morning routine complete.' : 'Evening routine complete.';
  return `${remaining} ${remaining === 1 ? 'step' : 'steps'} left in your ${phase === 'AM' ? 'morning' : 'evening'} routine.`;
}

export function TodayFocusHeader({
  phase,
  dateLabel,
  clockLabel,
  total,
  completed,
  hasRoutine,
  streakDays = 0,
}: TodayFocusHeaderProps) {
  const dark = phase === 'PM';
  const progress = total > 0 ? Math.min(Math.max(completed / total, 0), 1) : 0;
  const accent = dark ? colors.clayBright : colors.clay;
  const muted = dark ? 'rgba(244,239,231,0.58)' : colors.muted;
  const greeting = phase === 'AM' ? 'Good morning.' : 'Good evening.';

  return (
    <View className="mt-1">
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="label" style={{ color: muted }}>
          {dateLabel.toUpperCase()}{clockLabel ? ` · ${clockLabel}` : ''}
        </Text>
        {streakDays > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View your streak and adherence"
            onPress={() => {
              haptics.select();
              router.push('/routine/streak');
            }}
            className="min-h-[48px] flex-row items-center gap-2 rounded-pill px-4 py-2.5"
            style={{ backgroundColor: dark ? 'rgba(217,161,131,0.12)' : colors.clayTint }}
          >
            <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
            <Text className="font-sans-bold text-[12.5px]" style={{ color: accent }}>
              {streakDays} {streakDays === 1 ? 'day' : 'days'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Text variant="titleLg" tone={dark ? 'inverse' : 'ink'} className="mt-2">
        {greeting}
      </Text>
      <Text variant="body" className="mt-2" style={{ color: muted }}>
        {routineSummary({ completed, hasRoutine, phase, total })}
      </Text>

      {hasRoutine && total > 0 ? (
        <View
          className="mt-4 h-1.5 overflow-hidden rounded-pill"
          style={{ backgroundColor: dark ? 'rgba(244,239,231,0.12)' : colors.greigeDeep }}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: total, now: completed }}
        >
          <View
            className="h-full rounded-pill"
            style={{ backgroundColor: accent, width: `${progress * 100}%` }}
          />
        </View>
      ) : null}
    </View>
  );
}
