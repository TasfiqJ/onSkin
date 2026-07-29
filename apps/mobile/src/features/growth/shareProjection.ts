export const CONFLICT_SHARE_PROJECTION_KEYS = [
  'schemaVersion',
  'brandName',
  'eyebrow',
  'title',
  'severityLabel',
  'evidenceLabel',
  'claim',
  'actionLabel',
  'attributionLabel',
  'disclaimer',
  'tone',
] as const;

export type ConflictShareProjection = Readonly<{
  schemaVersion: 1;
  brandName: string;
  eyebrow: string;
  title: string;
  severityLabel: string | null;
  evidenceLabel: string;
  claim: string;
  actionLabel: string;
  attributionLabel: string;
  disclaimer: string;
  tone: 'caution' | 'reassuring';
}>;

const STRING_LIMITS = Object.freeze({
  brandName: 80,
  eyebrow: 80,
  title: 160,
  severityLabel: 80,
  evidenceLabel: 80,
  claim: 600,
  actionLabel: 160,
  attributionLabel: 160,
  disclaimer: 240,
} as const);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactProjectionKeys(value: Record<string, unknown>): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...CONFLICT_SHARE_PROJECTION_KEYS].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function parseRequiredString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) return null;
  return normalized;
}

/**
 * Copies only the complete public-card allowlist and rejects every extra key.
 * It deliberately does not accept a DetectedConflict, Shelf product, profile,
 * rule object, reviewer metadata, account identifier, or public URL.
 */
export function parseConflictShareProjection(value: unknown): ConflictShareProjection | null {
  try {
    if (!isRecord(value) || !hasExactProjectionKeys(value)) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const fields = Object.fromEntries(
      CONFLICT_SHARE_PROJECTION_KEYS.map((key) => {
        const descriptor = descriptors[key];
        if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
          throw new Error('Projection fields must be enumerable own data properties.');
        }
        return [key, descriptor.value];
      }),
    ) as Record<(typeof CONFLICT_SHARE_PROJECTION_KEYS)[number], unknown>;

    if (fields.schemaVersion !== 1) return null;
    if (fields.tone !== 'caution' && fields.tone !== 'reassuring') return null;

    const brandName = parseRequiredString(fields.brandName, STRING_LIMITS.brandName);
    const eyebrow = parseRequiredString(fields.eyebrow, STRING_LIMITS.eyebrow);
    const title = parseRequiredString(fields.title, STRING_LIMITS.title);
    const evidenceLabel = parseRequiredString(fields.evidenceLabel, STRING_LIMITS.evidenceLabel);
    const claim = parseRequiredString(fields.claim, STRING_LIMITS.claim);
    const actionLabel = parseRequiredString(fields.actionLabel, STRING_LIMITS.actionLabel);
    const attributionLabel = parseRequiredString(
      fields.attributionLabel,
      STRING_LIMITS.attributionLabel,
    );
    const disclaimer = parseRequiredString(fields.disclaimer, STRING_LIMITS.disclaimer);
    const severityLabel =
      fields.severityLabel === null
        ? null
        : parseRequiredString(fields.severityLabel, STRING_LIMITS.severityLabel);

    if (
      !brandName ||
      !eyebrow ||
      !title ||
      !evidenceLabel ||
      !claim ||
      !actionLabel ||
      !attributionLabel ||
      !disclaimer ||
      (fields.severityLabel !== null && !severityLabel)
    ) {
      return null;
    }

    return Object.freeze({
      schemaVersion: 1,
      brandName,
      eyebrow,
      title,
      severityLabel,
      evidenceLabel,
      claim,
      actionLabel,
      attributionLabel,
      disclaimer,
      tone: fields.tone,
    });
  } catch {
    return null;
  }
}
