import type { ConflictSeverity, EvidenceLabel, FunctionalTag, ResolutionType } from '@onskin/types';

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

/** "Retinol × Glycolic 7%". Falls back to family labels when a product is absent. */
export function pairTitle(c: DetectedConflict): string {
  const a = c.productAName ?? tagLabel(c.rule.tagA);
  const b = c.productBName ?? tagLabel(c.rule.tagB);
  return `${a} × ${b}`;
}

const SUBHEAD: Record<ResolutionType, string> = {
  alternate_nights: "We've placed them on alternate nights.",
  separate_am_pm: 'Use one in the morning, the other at night.',
  buffer: 'Leave a little time between them.',
  lower_frequency: 'Ease off the frequency a little.',
  no_change: 'These work well together.',
  reassure: 'Good news. These are fine together.',
  avoid_refer: "We've set this aside. Worth a word with your doctor.",
};
export const bannerSubhead = (c: DetectedConflict) => SUBHEAD[c.rule.resolutionType];

/** Short banner title for the shelf (docs/02 §7.1). */
export function bannerTitle(c: DetectedConflict): string {
  if (c.productAName && c.productBName) return `${c.productAName} + ${c.productBName}`;
  return pairTitle(c);
}
