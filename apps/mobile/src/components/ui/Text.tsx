import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { cn } from '@/lib/cn';
import { pseudoLocalizeNode } from '@/lib/accessibility/pseudoLocalization';

type Variant =
  | 'display'
  | 'title'
  | 'titleLg'
  | 'titleSm'
  | 'body'
  | 'bodySm'
  | 'eyebrow'
  | 'label';

type Tone = 'ink' | 'muted' | 'clay' | 'inverse' | 'inverseMuted';

const VARIANT: Record<Variant, string> = {
  display: 'font-serif text-[46px] leading-[48px] tracking-[-0.5px]',
  title: 'font-serif text-[31px] leading-[35px] tracking-[-0.25px]',
  titleLg: 'font-serif text-[40px] leading-[42px] tracking-[-0.4px]',
  titleSm: 'font-serif text-[23px] leading-[27px]',
  body: 'font-sans text-base leading-6',
  bodySm: 'font-sans text-sm leading-5',
  eyebrow: 'font-mono text-[11px] uppercase tracking-[1.8px]',
  label: 'font-mono text-xs tracking-[0.8px]',
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
  children,
  ...rest
}: TextProps) {
  const family =
    italic &&
    (variant === 'display' || variant === 'title' || variant === 'titleLg' || variant === 'titleSm')
      ? 'font-serif-italic'
      : undefined;
  return (
    <RNText className={cn(VARIANT[variant], TONE[tone], family, className)} {...rest}>
      {pseudoLocalizeNode(children)}
    </RNText>
  );
}
