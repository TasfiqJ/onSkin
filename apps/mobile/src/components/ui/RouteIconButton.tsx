import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme/tokens';

import { Text } from './Text';

type RouteIconButtonTone = 'paper' | 'night' | 'muted';
type PressableStyle =
  | StyleProp<ViewStyle>
  | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);

const BASE_STYLE = {
  width: 48,
  height: 48,
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 24,
  borderWidth: 1,
} satisfies ViewStyle;

const TONE_STYLE: Record<RouteIconButtonTone, ViewStyle> = {
  paper: {
    backgroundColor: colors.paperRaised,
    borderColor: colors.hairline,
  },
  night: {
    backgroundColor: 'transparent',
    borderColor: colors.hairlineDark,
  },
  muted: {
    backgroundColor: 'rgba(32,27,21,0.06)',
    borderColor: 'transparent',
  },
};

const GLYPH_COLOR: Record<RouteIconButtonTone, string> = {
  paper: colors.ink,
  night: colors.cream,
  muted: colors.muted,
};

export type RouteIconButtonProps = Omit<
  PressableProps,
  'accessibilityLabel' | 'accessibilityRole' | 'children' | 'style'
> & {
  accessibilityLabel: string;
  glyph?: string;
  style?: PressableStyle;
  tone?: RouteIconButtonTone;
};

export function RouteIconButton({
  accessibilityLabel,
  disabled,
  glyph = '<',
  style,
  tone = 'paper',
  ...rest
}: RouteIconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={(state) => [
        BASE_STYLE,
        TONE_STYLE[tone],
        disabled ? { opacity: 0.45 } : null,
        state.pressed ? { opacity: 0.82 } : null,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      <Text style={{ color: GLYPH_COLOR[tone], fontSize: 18, lineHeight: 22 }}>{glyph}</Text>
    </Pressable>
  );
}
