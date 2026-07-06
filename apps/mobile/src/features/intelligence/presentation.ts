import type {
  ConflictSeverity,
  EvidenceLabel,
  FunctionalTag,
  InteractionType,
  ResolutionType,
} from '@onskin/types';

import type { DetectedConflict } from './engine';

// Consumer-facing presentation of engine output (docs/02 §7.2/§7.3). Calm,
// claim-safe, evidence-honest, resolution-first.

const SEVERITY_LABEL: Record<ConflictSeverity, string> = {
  none: 'Compatible',
  mild: 'Mild',
  moderate: 'Moderate',
  high: 'High',
};
export const severityLabel = (s: ConflictSeverity) => SEVERITY_LABEL[s];

const EVIDENCE_CHIP: Record<EvidenceLabel, string> = {
  established: 'Evidence: established',
  plausible: 'Evidence: plausible',
  contested: 'Evidence: contested',
  refuted: 'Evidence: myth',
};
export const evidenceChip = (l: EvidenceLabel) => EVIDENCE_CHIP[l];

const TAG_LABEL: Partial<Record<FunctionalTag, string>> = {
  retinoid: 'Retinoid',
  aha: 'AHA',
  bha: 'BHA',
  benzoyl_peroxide: 'Benzoyl peroxide',
  vitamin_c: 'Vitamin C',
  niacinamide: 'Niacinamide',
  copper_peptide: 'Copper peptides',
  hydroquinone: 'Hydroquinone',
  sunscreen: 'Sunscreen',
  pregnancy: 'Pregnancy',
};
export const tagLabel = (t: FunctionalTag) => TAG_LABEL[t] ?? t;

/** The interaction-class chip label for the conflict-detail sheet (design frame
 *  04, the third greige chip). Sentence-case; the chip styles it. */
const INTERACTION_CLASS_LABEL: Record<InteractionType, string> = {
  irritation: 'Irritation',
  stability: 'Stability',
  efficacy: 'Efficacy',
  synergy: 'Synergy',
  safety: 'Safety',
  myth: 'Myth',
};
export const interactionClassLabel = (t: InteractionType) => INTERACTION_CLASS_LABEL[t];

/** "Retinol × Glycolic 7%". Falls back to family labels when a product is absent. */
export function pairTitle(c: DetectedConflict): string {
  const a = c.productAName ?? tagLabel(c.rule.tagA);
  const b = c.productBName ?? tagLabel(c.rule.tagB);
  return `${a} × ${b}`;
}

/** Family-level title for the conflict-detail / myth / safety headers (design
 *  frames 04-06): "Retinol × glycolic acid", not the full product names. Uses the
 *  ingredient-family labels, lowercased after the first word so the second family
 *  reads as a phrase ("glycolic acid"). */
export function familyTitle(c: DetectedConflict): string {
  const a = tagLabel(c.rule.tagA);
  const b = tagLabel(c.rule.tagB).toLowerCase();
  return `${a} × ${b}`;
}

const SUBHEAD: Record<ResolutionType, string> = {
  alternate_nights: 'Use them on alternate nights.',
  separate_am_pm: 'Use one in the morning, the other at night.',
  buffer: 'Leave a little time between them.',
  lower_frequency: 'Ease off the frequency a little.',
  no_change: 'These work well together.',
  reassure: 'Good news. These are fine together.',
  avoid_refer: 'Set this aside until you can ask your doctor.',
};
export const bannerSubhead = (c: DetectedConflict) => SUBHEAD[c.rule.resolutionType];

/** Short banner title for the shelf (docs/02 §7.1). The two-active PM-share case
 *  (an alternate-nights irritation conflict) reads the design's "2 actives share
 *  your PM" (frame 03); otherwise the product-name join. */
export function bannerTitle(c: DetectedConflict): string {
  if (c.rule.resolutionType === 'alternate_nights' && c.productAName && c.productBName) {
    return '2 actives share your PM';
  }
  if (c.productAName && c.productBName) return `${c.productAName} + ${c.productBName}`;
  return pairTitle(c);
}
