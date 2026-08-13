import { colors } from './tokens';

export type InterfaceStateKind =
  | 'loading'
  | 'empty'
  | 'offline'
  | 'error'
  | 'unavailable'
  | 'corrupt'
  | 'locked'
  | 'destructive';

export type InterfaceStateTone = 'paper' | 'night';

export type InterfaceStateVisualTokens = Readonly<{
  label: string;
  background: string;
  border: string;
  accent: string;
  title: string;
  body: string;
}>;

const LABELS: Record<InterfaceStateKind, string> = {
  loading: 'Loading',
  empty: 'Nothing here yet',
  offline: 'Offline',
  error: 'Needs attention',
  unavailable: 'Unavailable',
  corrupt: 'Data needs recovery',
  locked: 'Locked',
  destructive: 'Confirm carefully',
};

const PAPER: Record<InterfaceStateKind, Omit<InterfaceStateVisualTokens, 'label'>> = {
  loading: {
    background: colors.greigeChip,
    border: colors.hairline,
    accent: colors.clay,
    title: colors.ink,
    body: colors.mutedStrong,
  },
  empty: {
    background: colors.paperRaised,
    border: colors.hairline,
    accent: colors.mutedStrong,
    title: colors.ink,
    body: colors.muted,
  },
  offline: {
    background: '#F7EFDF',
    border: 'rgba(176,122,60,0.28)',
    accent: '#805325',
    title: colors.ink,
    body: colors.mutedStrong,
  },
  error: {
    background: colors.clayTint,
    border: 'rgba(165,105,75,0.26)',
    accent: colors.clayDeep,
    title: colors.ink,
    body: colors.mutedStrong,
  },
  unavailable: {
    background: '#F5E8E0',
    border: 'rgba(138,82,57,0.24)',
    accent: colors.clayDeep,
    title: colors.ink,
    body: colors.mutedStrong,
  },
  corrupt: {
    background: '#F5DEDA',
    border: 'rgba(138,74,51,0.32)',
    accent: colors.severityHigh,
    title: colors.ink,
    body: colors.mutedStrong,
  },
  locked: {
    background: colors.greigeDeep,
    border: colors.hairlineStrong,
    accent: colors.inkSoft,
    title: colors.ink,
    body: colors.mutedStrong,
  },
  destructive: {
    background: '#F4DDD7',
    border: 'rgba(138,74,51,0.38)',
    accent: colors.severityHigh,
    title: colors.ink,
    body: colors.mutedStrong,
  },
};

const NIGHT: Record<InterfaceStateKind, Omit<InterfaceStateVisualTokens, 'label'>> = {
  loading: {
    background: 'rgba(244,239,231,0.07)',
    border: colors.hairlineDark,
    accent: colors.clayBright,
    title: colors.cream,
    body: 'rgba(244,239,231,0.68)',
  },
  empty: {
    background: 'rgba(244,239,231,0.06)',
    border: colors.hairlineDark,
    accent: 'rgba(244,239,231,0.66)',
    title: colors.cream,
    body: 'rgba(244,239,231,0.62)',
  },
  offline: {
    background: 'rgba(176,122,60,0.18)',
    border: 'rgba(228,185,122,0.34)',
    accent: '#E4B97A',
    title: colors.cream,
    body: 'rgba(244,239,231,0.72)',
  },
  error: {
    background: 'rgba(217,161,131,0.14)',
    border: 'rgba(217,161,131,0.38)',
    accent: colors.clayBright,
    title: colors.cream,
    body: 'rgba(244,239,231,0.72)',
  },
  unavailable: {
    background: 'rgba(217,161,131,0.11)',
    border: 'rgba(217,161,131,0.3)',
    accent: colors.clayBright,
    title: colors.cream,
    body: 'rgba(244,239,231,0.68)',
  },
  corrupt: {
    background: 'rgba(138,74,51,0.24)',
    border: 'rgba(232,167,143,0.42)',
    accent: '#E8A78F',
    title: colors.cream,
    body: 'rgba(244,239,231,0.72)',
  },
  locked: {
    background: 'rgba(244,239,231,0.08)',
    border: 'rgba(244,239,231,0.16)',
    accent: colors.sageMuted,
    title: colors.cream,
    body: 'rgba(244,239,231,0.64)',
  },
  destructive: {
    background: 'rgba(138,74,51,0.3)',
    border: 'rgba(232,167,143,0.46)',
    accent: '#E8A78F',
    title: colors.cream,
    body: 'rgba(244,239,231,0.74)',
  },
};

export function interfaceStateTokens(
  kind: InterfaceStateKind,
  tone: InterfaceStateTone = 'paper',
): InterfaceStateVisualTokens {
  return { label: LABELS[kind], ...(tone === 'night' ? NIGHT[kind] : PAPER[kind]) };
}

export function interfaceStateIsAlert(kind: InterfaceStateKind): boolean {
  return kind !== 'loading' && kind !== 'empty';
}
