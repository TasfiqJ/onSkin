import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';

import type { ConflictShareProjection } from './shareProjection';

export const CONFLICT_SHARE_CARD_ASPECT_RATIO = 9 / 16;

type ConflictShareCardProps = Readonly<{
  projection: ConflictShareProjection;
}>;

/**
 * A renderer for an already-sanitized public projection. It accepts no Shelf,
 * product, profile, account, rule, citation, reviewer, receipt, URL, or photo
 * object, so private fields cannot become visible through component spreading.
 * The zero-admission share route does not mount this component yet.
 */
export function ConflictShareCard({ projection }: ConflictShareCardProps) {
  return (
    <View
      accessible
      accessibilityLabel={`${projection.eyebrow}. ${projection.title}. ${projection.claim}. ${projection.actionLabel}. ${projection.disclaimer}`}
      style={[styles.card, projection.tone === 'reassuring' ? styles.reassuring : styles.caution]}
      testID="conflict-share-card"
    >
      <View style={styles.header}>
        <Text style={styles.brand}>{projection.brandName}</Text>
        <Text style={styles.eyebrow}>{projection.eyebrow}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.badges}>
          {projection.severityLabel ? (
            <Text style={styles.badge}>{projection.severityLabel}</Text>
          ) : null}
          <Text style={styles.badge}>{projection.evidenceLabel}</Text>
        </View>
        <Text style={styles.title}>{projection.title}</Text>
        <Text style={styles.claim}>{projection.claim}</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.action}>{projection.actionLabel}</Text>
        <Text style={styles.watermark}>{projection.attributionLabel}</Text>
        <Text style={styles.disclaimer}>{projection.disclaimer}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: CONFLICT_SHARE_CARD_ASPECT_RATIO,
    backgroundColor: '#F7F2EA',
    borderRadius: 32,
    justifyContent: 'space-between',
    overflow: 'hidden',
    paddingHorizontal: 40,
    paddingVertical: 44,
    width: '100%',
  },
  caution: {
    borderColor: '#8F5E4A',
    borderWidth: 4,
  },
  reassuring: {
    borderColor: '#416B5A',
    borderWidth: 4,
  },
  header: {
    gap: 8,
  },
  brand: {
    color: '#2A211D',
    fontSize: 30,
    fontWeight: '700',
  },
  eyebrow: {
    color: '#72594E',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
  },
  content: {
    gap: 24,
  },
  badges: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  badge: {
    backgroundColor: '#E8DDD2',
    borderRadius: 999,
    color: '#523D34',
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  title: {
    color: '#2A211D',
    fontSize: 46,
    fontWeight: '700',
    lineHeight: 54,
  },
  claim: {
    color: '#483A34',
    fontSize: 25,
    lineHeight: 36,
  },
  footer: {
    gap: 10,
  },
  action: {
    color: '#2A211D',
    fontSize: 22,
    fontWeight: '700',
  },
  watermark: {
    color: '#72594E',
    fontSize: 18,
    fontWeight: '700',
  },
  disclaimer: {
    color: '#72594E',
    fontSize: 14,
    lineHeight: 20,
  },
});
