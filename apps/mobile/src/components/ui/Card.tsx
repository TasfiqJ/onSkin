import { View, type ViewProps } from 'react-native';

import { cn } from '@/lib/cn';

// Rounded surface card. tone="night" for the dark PM/capture screens.
export type CardProps = ViewProps & {
  tone?: 'paper' | 'night';
  className?: string;
};

export function Card({ tone = 'paper', className, ...rest }: CardProps) {
  return (
    <View
      className={cn(
        'rounded-card p-5',
        tone === 'night' ? 'bg-night-surface' : 'bg-paper-raised',
        className,
      )}
      {...rest}
    />
  );
}
