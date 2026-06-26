import { forwardRef } from 'react';
import { View, Text } from 'react-native';

import { isReassuring, type DetectedConflict } from '@/features/intelligence/engine';
import { bannerSubhead, evidenceChip, pairTitle, severityLabel } from '@/features/intelligence/presentation';
import { colors } from '@/theme/tokens';

import { CARD_COPY } from './cardCopy';

// The shareable Shelf Conflict Card (docs/14 §3): a fixed-size, branded, watermarked,
// claim-safe artifact rendered from a detected conflict. The pairing, severity, and
// resolution all come from the engine's presentation helpers (already guard-scanned),
// so the card can never assert a claim the engine didn't. forwardRef + collapsable
// false so the share screen can captureRef() it to a PNG (docs/14 one-tap export).
const SERIF = 'InstrumentSerif_400Regular';
const SANS = 'HankenGrotesk_400Regular';
const SANS_SEMI = 'HankenGrotesk_600SemiBold';
const MONO = 'IBMPlexMono_500Medium';

export const CONFLICT_CARD_SIZE = { width: 320, height: 480 };

export const ConflictCard = forwardRef<View, { conflict: DetectedConflict }>(
  function ConflictCard({ conflict }, ref) {
    const reassure = isReassuring(conflict);
    const accent = reassure ? colors.sage : colors.clay;
    const accentTint = reassure ? colors.sageTint : colors.clayTint;
    const chipText = reassure ? colors.sageDeep : colors.clayDeep;

    return (
      <View
        ref={ref}
        collapsable={false}
        style={{
          width: CONFLICT_CARD_SIZE.width,
          height: CONFLICT_CARD_SIZE.height,
          backgroundColor: colors.paper,
          borderRadius: 28,
          paddingHorizontal: 28,
          paddingVertical: 30,
          justifyContent: 'space-between',
          borderWidth: 1,
          borderColor: 'rgba(32,27,21,0.06)',
        }}>
        {/* Brand wordmark + eyebrow */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontFamily: SERIF, fontSize: 26, color: colors.ink }}>{CARD_COPY.brand}</Text>
          <Text style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.5, color: colors.muted }}>
            {CARD_COPY.eyebrow}
          </Text>
        </View>

        {/* The pairing (the focus) + chips + the calm resolution */}
        <View>
          <Text style={{ fontFamily: SERIF, fontSize: 36, lineHeight: 40, color: colors.ink }}>
            {pairTitle(conflict)}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            {!reassure ? (
              <View style={{ backgroundColor: accentTint, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ fontFamily: SANS_SEMI, fontSize: 11, color: chipText }}>
                  {severityLabel(conflict.computedSeverity)}
                </Text>
              </View>
            ) : null}
            <View style={{ backgroundColor: accentTint, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ fontFamily: SANS_SEMI, fontSize: 11, color: chipText }}>
                {evidenceChip(conflict.rule.evidenceLabel)}
              </Text>
            </View>
          </View>
          <Text style={{ fontFamily: SANS, fontSize: 16, lineHeight: 23, color: colors.inkSoft, marginTop: 18 }}>
            {bannerSubhead(conflict)}
          </Text>
        </View>

        {/* Footer: CTA + watermark + the standing disclaimer */}
        <View>
          <View style={{ height: 1, backgroundColor: 'rgba(32,27,21,0.10)', marginBottom: 16 }} />
          <Text style={{ fontFamily: SANS_SEMI, fontSize: 15, color: accent }}>{CARD_COPY.cta}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12 }}>
            <Text style={{ fontFamily: MONO, fontSize: 11, color: colors.muted }}>{CARD_COPY.handle}</Text>
            <Text style={{ fontFamily: MONO, fontSize: 8, color: colors.mutedLight, maxWidth: 165, textAlign: 'right' }}>
              {CARD_COPY.footnote}
            </Text>
          </View>
        </View>
      </View>
    );
  },
);
