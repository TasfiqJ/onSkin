import { Platform, View, type ViewProps, type ViewStyle } from 'react-native';

import { cn } from '@/lib/cn';
import { colors } from '@/theme/tokens';

export type CardProps = ViewProps & {
  tone?: 'paper' | 'night';
  className?: string;
};

const PAPER_SHADOW = Platform.select({
  ios: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.045,
    shadowRadius: 16,
  },
  android: { elevation: 1 },
  web: { boxShadow: '0 8px 28px rgba(32,27,21,0.045)' } as ViewStyle,
  default: {},
}) as ViewStyle;

export function Card({ tone = 'paper', className, style, ...rest }: CardProps) {
  const dark = tone === 'night';
  return (
    <View
      className={cn(
        'rounded-card border p-5',
        dark ? 'border-hairline-dark bg-night-surface' : 'border-hairline bg-paper-raised',
        className,
      )}
      style={[dark ? undefined : PAPER_SHADOW, style]}
      {...rest}
    />
  );
}
