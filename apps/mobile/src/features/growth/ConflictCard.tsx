import { forwardRef } from 'react';
import { View, Text } from 'react-native';

import {
  isAdmittedDetectedConflict,
  isReassuring,
  type DetectedConflict,
} from '@/features/intelligence/engine';
import { colors } from '@/theme/tokens';

import { CARD_COPY } from './cardCopy';

// The shareable Shelf Conflict Card (docs/14 §3): a fixed-size, branded, watermarked,
// claim-safe artifact rendered from a detected conflict. The pairing, severity, and
// resolution all come from the engine's presentation helpers (already guard-scanned),
// so the card can never assert a claim the engine didn't. forwardRef + collapsable
// false so the share screen can captureRef() it to a PNG (docs/14 one-tap export).
const SERIF = 'InstrumentSerif-Regular';
const SANS = 'HankenGrotesk-Regular';
const SANS_SEMI = 'HankenGrotesk-SemiBold';
const MONO = 'IBMPlexMono-Medium';

export const CONFLICT_CARD_SIZE = { width: 320, height: 480 };

function publicLinkLabel(url?: string | null): string {
  if (!url) return CARD_COPY.handle;
  return url.replace(/^https?:\/\//i, '').replace(/[?#].*$/, '');
}

export const ConflictCard = forwardRef<
  View,
  { conflict: DetectedConflict; shareUrl?: string | null }
>(function ConflictCard({ conflict, shareUrl }, ref) {
  if (!isAdmittedDetectedConflict(conflict)) return null;
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
      }}
    >
      {/* Brand wordmark + eyebrow */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontFamily: SERIF, fontSize: 26, color: colors.ink }}>
          {CARD_COPY.brand}
        </Text>
        <Text style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.5, color: colors.muted }}>
          {CARD_COPY.eyebrow}
        </Text>
      </View>

      {/* The pairing (the focus) + chips + the calm resolution */}
      <View>
        <Text style={{ fontFamily: SERIF, fontSize: 36, lineHeight: 40, color: colors.ink }}>
          {conflict.rule.copy.shareTitle}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          {!reassure ? (
            <View
              style={{
                backgroundColor: accentTint,
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              <Text style={{ fontFamily: SANS_SEMI, fontSize: 11, color: chipText }}>
                {conflict.rule.copy.severityLabel}
              </Text>
            </View>
          ) : null}
          <View
            style={{
              backgroundColor: accentTint,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Text style={{ fontFamily: SANS_SEMI, fontSize: 11, color: chipText }}>
              {conflict.rule.copy.evidenceLabel}
            </Text>
          </View>
        </View>
        <Text
          style={{
            fontFamily: SANS,
            fontSize: 16,
            lineHeight: 23,
            color: colors.inkSoft,
            marginTop: 18,
          }}
        >
          {conflict.rule.copy.shareClaim}
        </Text>
      </View>

      {/* Footer: CTA + watermark + the standing disclaimer */}
      <View>
        <View style={{ height: 1, backgroundColor: 'rgba(32,27,21,0.10)', marginBottom: 16 }} />
        <Text style={{ fontFamily: SANS_SEMI, fontSize: 15, color: accent }}>
          {conflict.rule.copy.shareActionLabel}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginTop: 12,
          }}
        >
          <Text style={{ fontFamily: MONO, fontSize: 10, color: colors.muted, maxWidth: 118 }}>
            {publicLinkLabel(shareUrl)}
          </Text>
          <Text
            style={{
              fontFamily: MONO,
              fontSize: 8,
              color: colors.mutedLight,
              maxWidth: 165,
              textAlign: 'right',
            }}
          >
            {CARD_COPY.footnote}
          </Text>
        </View>
      </View>
    </View>
  );
});
