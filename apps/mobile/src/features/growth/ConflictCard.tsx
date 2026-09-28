import { forwardRef } from 'react';
import { Text, View } from 'react-native';

import { colors } from '@/theme/tokens';

import type { ConflictShareProjection } from './shareProjection';

// This renderer accepts only the complete sanitized public projection. It has
// no access to DetectedConflict, Shelf products, profile/rule/reviewer metadata,
// account identifiers, or public-link state.
const SERIF = 'InstrumentSerif-Regular';
const SANS = 'HankenGrotesk-Regular';
const SANS_SEMI = 'HankenGrotesk-SemiBold';
const MONO = 'IBMPlexMono-Medium';

export const CONFLICT_CARD_SIZE = { width: 320, height: 480 };

export const ConflictCard = forwardRef<View, { projection: ConflictShareProjection }>(
  function ConflictCard({ projection }, ref) {
    const reassure = projection.tone === 'reassuring';
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
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Text style={{ fontFamily: SERIF, fontSize: 26, color: colors.ink }}>
            {projection.brandName}
          </Text>
          <Text style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.5, color: colors.muted }}>
            {projection.eyebrow}
          </Text>
        </View>

        <View>
          <Text style={{ fontFamily: SERIF, fontSize: 36, lineHeight: 40, color: colors.ink }}>
            {projection.title}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            {projection.severityLabel ? (
              <View
                style={{
                  backgroundColor: accentTint,
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ fontFamily: SANS_SEMI, fontSize: 11, color: chipText }}>
                  {projection.severityLabel}
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
                {projection.evidenceLabel}
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
            {projection.claim}
          </Text>
        </View>

        <View>
          <View style={{ height: 1, backgroundColor: 'rgba(32,27,21,0.10)', marginBottom: 16 }} />
          <Text style={{ fontFamily: SANS_SEMI, fontSize: 15, color: accent }}>
            {projection.actionLabel}
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
              {projection.attributionLabel}
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
              {projection.disclaimer}
            </Text>
          </View>
        </View>
      </View>
    );
  },
);
