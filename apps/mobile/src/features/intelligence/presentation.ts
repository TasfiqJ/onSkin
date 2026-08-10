import type { FunctionalTag } from '@layerwell/types';

import { isAdmittedDetectedConflict, type DetectedConflict } from './engine';

// Conflict claims are presentation bytes from the exact rule corpus. Consumers
// must not rebuild medical meaning from enum values or product names.
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

/** Non-claim taxonomy label for ingredient parsing and catalog UI only. */
export const tagLabel = (tag: FunctionalTag) => TAG_LABEL[tag] ?? tag;

const pendingTitle = 'Interaction guidance is unavailable';
const pendingBody =
  "We won't show a compatibility result until the exact rules and copy complete required independent professional review.";

export const severityLabel = (conflict: DetectedConflict): string =>
  isAdmittedDetectedConflict(conflict) ? conflict.rule.copy.severityLabel : 'Review pending';

export const evidenceChip = (conflict: DetectedConflict): string =>
  isAdmittedDetectedConflict(conflict) ? conflict.rule.copy.evidenceLabel : 'Review pending';

export const interactionClassLabel = (conflict: DetectedConflict): string =>
  isAdmittedDetectedConflict(conflict) ? conflict.rule.copy.interactionLabel : 'Review pending';

export const pairTitle = (conflict: DetectedConflict): string =>
  isAdmittedDetectedConflict(conflict) ? conflict.rule.copy.detailTitle : pendingTitle;

export const familyTitle = pairTitle;

export const bannerSubhead = (conflict: DetectedConflict): string =>
  isAdmittedDetectedConflict(conflict) ? conflict.rule.copy.bannerSubhead : pendingBody;

export const bannerTitle = (conflict: DetectedConflict): string =>
  isAdmittedDetectedConflict(conflict) ? conflict.rule.copy.bannerTitle : pendingTitle;
