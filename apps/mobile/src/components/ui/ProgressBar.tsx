import { View } from 'react-native';

import { cn } from '@/lib/cn';

// Stepped-segment progress (design spec: segments, not dots, for the multi-step
// quiz). Filled = clay, remaining = greige (or cream-alpha on dark screens).
export type ProgressBarProps = {
  total: number;
  current: number; // number of completed/active segments
  tone?: 'light' | 'night';
  className?: string;
};

export function ProgressBar({ total, current, tone = 'light', className }: ProgressBarProps) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: current }}
      className={cn('flex-row gap-1.5', className)}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className={cn(
            'h-1 flex-1 rounded-pill',
            i < current ? 'bg-clay' : tone === 'night' ? 'bg-cream/20' : 'bg-greige-deep',
          )}
        />
      ))}
    </View>
  );
}
