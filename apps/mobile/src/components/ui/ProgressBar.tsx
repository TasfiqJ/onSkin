import { View } from 'react-native';

import { cn } from '@/lib/cn';

export type ProgressBarProps = {
  total: number;
  current: number;
  tone?: 'light' | 'night';
  className?: string;
};

export function ProgressBar({ total, current, tone = 'light', className }: ProgressBarProps) {
  const safeTotal = Math.max(total, 1);
  const progress = Math.max(0, Math.min(current / safeTotal, 1));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: current }}
      className={cn(
        'h-1.5 w-full overflow-hidden rounded-pill',
        tone === 'night' ? 'bg-cream/15' : 'bg-greige-deep',
        className,
      )}
    >
      <View className="h-full rounded-pill bg-clay" style={{ width: `${progress * 100}%` }} />
    </View>
  );
}
