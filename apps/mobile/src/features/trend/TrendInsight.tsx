import { useEffect } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { track } from '@/lib/analytics/track';
import { colors } from '@/theme/tokens';

import { TREND_COPY } from './copy';
import { isCelebratedState } from './trend';
import { useTrendInsight } from './useTrend';

// 03/04 · The calm output line (docs/12 §6, design 03/04). One descriptive line,
// surfaced ONLY above the Minimal-Detectable-Change floor and ONLY when opted in.
// Cosmetic verbs, observation not grade, no number. "Consistent / no detectable change"
// is a CELEBRATED first-class output (adherence win), never a flat line to feel bad
// about; "lighting varied" / "no clear change yet" are honest, never invented trends.
export function TrendInsight() {
  const { consented, insight } = useTrendInsight();

  useEffect(() => {
    if (!consented || !insight) return;
    track('trend_shown');
  }, [consented, insight]);

  if (!consented || !insight) return null;

  const celebrated = isCelebratedState(insight.changeState);

  return (
    <View
      className="rounded-card bg-paper-raised p-5"
      style={{ borderWidth: 1, borderColor: celebrated ? 'rgba(79,122,74,0.25)' : colors.hairline }}
    >
      <Text variant="label" tone="muted" className="mb-2.5">
        {TREND_COPY.output.computedNote}
      </Text>

      {celebrated ? (
        <View
          className="mb-3 flex-row items-center gap-2 self-start rounded-pill"
          style={{ backgroundColor: colors.sageTint, paddingHorizontal: 12, paddingVertical: 5 }}
        >
          <View className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: colors.sage }} />
          <Text className="font-sans-bold text-[11px]" style={{ color: colors.sageDeep }}>
            {TREND_COPY.output.consistentChip}
          </Text>
        </View>
      ) : null}

      <Text variant="titleSm" className="text-[18px] leading-[24px]" accessibilityRole="text">
        {insight.narrative}
      </Text>

      {celebrated || insight.changeState === 'change_observed' ? (
        <Text
          variant="bodySm"
          tone="muted"
          className="mt-2 text-[12.5px]"
          style={{ lineHeight: 18 }}
        >
          {TREND_COPY.output.yourEyes}
        </Text>
      ) : null}
    </View>
  );
}
