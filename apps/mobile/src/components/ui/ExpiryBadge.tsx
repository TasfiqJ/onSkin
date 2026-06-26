import { View, type ViewStyle } from 'react-native';

import type { ExpiryBadge as ExpiryBadgeData, ExpiryBadgeKind } from '@/features/intelligence/pao';
import { colors } from '@/theme/tokens';

import { Text } from './Text';

// The five-state PAO/expiry badge (docs/04 §5.3) with the exact colours from the
// OnSkin Smart Shelf design. Text always reads its meaning. Colour is never the
// only signal (accessibility, §5.9). Never red.
const AMBER_TINT = 'rgba(176,122,60,0.14)'; // countdown / firmer eye-SPF pill
const EXPIRED_BG = '#EFE7E0'; // calm "Replace" pill
const EXPIRED_FG = '#9A6A4B';

type Style = { bg: string; fg: string; pill: boolean; mono: boolean };
const KIND_STYLE: Record<ExpiryBadgeKind, Style> = {
  date: { bg: colors.greige, fg: colors.muted, pill: false, mono: true },
  unknown: { bg: colors.greigeChip, fg: colors.mutedLight, pill: false, mono: true },
  countdown: { bg: AMBER_TINT, fg: colors.amber, pill: true, mono: false },
  paired: { bg: colors.clayTint, fg: colors.clayDeep, pill: true, mono: false },
  expired: { bg: EXPIRED_BG, fg: EXPIRED_FG, pill: true, mono: false },
  // The calm positive pill for a surfaced synergy/myth pairing (design frame 03).
  synergy: { bg: colors.sageTint, fg: colors.sage, pill: true, mono: false },
};

export function ExpiryBadge({ badge }: { badge: ExpiryBadgeData }) {
  // The firmer eye/SPF expired treatment reuses the amber countdown tint so it
  // reads as "act on this" while still never red (docs/04 §3/§5.3).
  const s = badge.safety ? KIND_STYLE.countdown : KIND_STYLE[badge.kind];
  const container: ViewStyle = {
    backgroundColor: s.bg,
    borderRadius: s.pill ? 999 : 8,
    paddingHorizontal: s.pill ? 12 : 10,
    paddingVertical: 6,
    maxWidth: badge.safety ? 72 : 96,
  };
  // The firmer eye/SPF state ships its label as two lowercase lines ("replace /
  // for safety", design screen 05). The newline reads as a pause, so give
  // VoiceOver a clean single-line accessibilityLabel.
  const a11yLabel = badge.label.replace(/\n/g, ' ');
  return (
    <View style={container} accessible accessibilityLabel={a11yLabel}>
      <Text
        className={s.mono ? 'font-mono' : 'font-sans-bold'}
        style={{ color: s.fg, fontSize: 11, lineHeight: badge.safety ? 13 : 14, textAlign: 'center' }}>
        {badge.label}
      </Text>
    </View>
  );
}
