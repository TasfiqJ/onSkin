import { ActivityIndicator, View, type ViewProps } from 'react-native';

import { cn } from '@/lib/cn';
import {
  interfaceStateIsAlert,
  interfaceStateTokens,
  type InterfaceStateKind,
  type InterfaceStateTone,
} from '@/theme/stateTokens';

import { Text } from './Text';

export type StateNoticeProps = Omit<ViewProps, 'children'> & {
  kind: InterfaceStateKind;
  title?: string;
  body?: string;
  detail?: string | null;
  tone?: InterfaceStateTone;
  presentation?: 'card' | 'plain';
  align?: 'left' | 'center';
  compact?: boolean;
  showIndicator?: boolean;
  children?: React.ReactNode;
  className?: string;
};

export function StateNotice({
  kind,
  title,
  body,
  detail,
  tone = 'paper',
  presentation = 'card',
  align = 'left',
  compact = false,
  showIndicator = kind === 'loading',
  children,
  className,
  style,
  ...rest
}: StateNoticeProps) {
  const tokens = interfaceStateTokens(kind, tone);
  const centered = align === 'center';
  const alert = interfaceStateIsAlert(kind);

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole={
        kind === 'loading' && !showIndicator ? 'progressbar' : alert ? 'alert' : undefined
      }
      accessibilityState={kind === 'loading' ? { busy: true } : undefined}
      className={cn(
        presentation === 'card' && (compact ? 'rounded-[14px] px-4 py-3' : 'rounded-[18px] p-5'),
        centered && 'items-center',
        className,
      )}
      style={[
        presentation === 'card'
          ? { backgroundColor: tokens.background, borderColor: tokens.border, borderWidth: 1 }
          : undefined,
        style,
      ]}
      {...rest}
    >
      {showIndicator ? (
        <ActivityIndicator
          accessibilityLabel={title ?? tokens.label}
          accessibilityRole="progressbar"
          color={tokens.accent}
          size="small"
        />
      ) : null}
      <Text
        variant="label"
        className={cn(showIndicator && 'mt-3', centered && 'text-center')}
        style={{ color: tokens.accent }}
      >
        {tokens.label}
      </Text>
      {title ? (
        <Text
          variant={compact ? 'body' : 'titleSm'}
          className={cn('font-sans-semibold', compact ? 'mt-1' : 'mt-2', centered && 'text-center')}
          style={{ color: tokens.title }}
        >
          {title}
        </Text>
      ) : null}
      {body ? (
        <Text
          variant="bodySm"
          className={cn(title ? 'mt-1.5' : 'mt-2', centered && 'text-center')}
          style={{ color: tokens.body, lineHeight: compact ? 19 : 21 }}
        >
          {body}
        </Text>
      ) : null}
      {detail ? (
        <Text
          variant="bodySm"
          className={cn('mt-2', centered && 'text-center')}
          style={{ color: tokens.title, lineHeight: compact ? 19 : 21 }}
        >
          {detail}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export function StateLoading({
  label,
  tone = 'paper',
  className,
}: {
  label: string;
  tone?: InterfaceStateTone;
  className?: string;
}) {
  return (
    <StateNotice
      kind="loading"
      title={label}
      tone={tone}
      presentation="plain"
      align="center"
      className={className}
    />
  );
}
