import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { cn } from '@/lib/cn';

// Editorial-clinical type scale (design spec). `variant` sets family/size/leading;
// `tone` sets colour (so dark "night" screens just pass tone="inverse"); `italic`
// swaps to Instrument Serif italic for the clay accent words ("your", "quietly
// resilient"). Layouts must reflow with Dynamic Type. No fixed text heights.
type Variant =
  | 'display' // big serif welcome headline
  | 'title' // serif screen header
  | 'titleSm' // smaller serif header
  | 'body' // sans body
  | 'bodySm' // smaller sans body
  | 'eyebrow' // mono, uppercase, tracked label (e.g. "YOUR SKIN PROFILE")
  | 'label'; // mono small (e.g. "2 of 4", "NEXT", "01 · Welcome")

type Tone = 'ink' | 'muted' | 'clay' | 'inverse' | 'inverseMuted';

const VARIANT: Record<Variant, string> = {
  display: 'font-serif text-[44px] leading-[46px]',
  title: 'font-serif text-[30px] leading-[34px]',
  titleSm: 'font-serif text-[22px] leading-[26px]',
  body: 'font-sans text-base leading-6',
  bodySm: 'font-sans text-sm leading-5',
  eyebrow: 'font-mono text-[11px] uppercase tracking-[2px]',
  label: 'font-mono text-xs tracking-[1px]',
};

const TONE: Record<Tone, string> = {
  ink: 'text-ink',
  muted: 'text-muted',
  clay: 'text-clay',
  inverse: 'text-cream',
  inverseMuted: 'text-cream/60',
};

export type TextProps = RNTextProps & {
  variant?: Variant;
  tone?: Tone;
  italic?: boolean;
  className?: string;
};

export function Text({
  variant = 'body',
  tone = 'ink',
  italic = false,
  className,
  ...rest
}: TextProps) {
  const family = italic && (variant === 'display' || variant === 'title' || variant === 'titleSm')
    ? 'font-serif-italic'
    : undefined;
  return <RNText className={cn(VARIANT[variant], TONE[tone], family, className)} {...rest} />;
}
