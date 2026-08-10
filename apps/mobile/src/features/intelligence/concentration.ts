import type { FunctionalTag } from '@layerwell/types';

// Coarse concentration band (docs/02 §4.2). The engine escalates irritation/stability
// severity by +1 for a high-dose product, and gates the high-dose-salicylic x
// pregnancy SAFETY rule on it. Until the curated catalog carries
// `product_ingredients.concentration_band` (B-CATALOG-SEED), we derive a band by
// parsing tag-associated percentages from the product name / INCI text and comparing
// them to per-class thresholds. Unknown associations remain unknown instead of letting
// an unrelated percentage drive a safety decision. Pure + unit-tested.
const PCT = /(\d+(?:\.\d+)?|\.\d+)\s*%/g;

// Per-active-class "high-dose" thresholds (percent). Conservative starting positions;
// a B-DERM-REVIEW item like the rest of the matrix.
const HIGH_THRESHOLD = {
  retinoid: 0.5, // 0.3% reads low; >= 0.5% reads high
  aha: 8, // glycolic / lactic: >= 8% high
  bha: 2, // salicylic: >= 2% is the high-dose pregnancy-caution line
  vitamin_c: 15, // L-ascorbic acid: >= 15% high
  benzoyl_peroxide: 5,
} as const satisfies Partial<Record<FunctionalTag, number>>;

type ThresholdTag = keyof typeof HIGH_THRESHOLD;
type AssociationTag = ThresholdTag | 'other';

const ASSOCIATION_LABELS: readonly { tag: AssociationTag; source: string }[] = [
  {
    tag: 'retinoid',
    source: String.raw`hydroxypinacolone\s+retinoate|granactive\s+retinoids?|retinyl\s+palmitate|retinaldehyde|retinoic\s+acid|retinoids?|retinol|retinal|tretinoin|adapalene`,
  },
  {
    tag: 'aha',
    source: String.raw`alpha[\s-]+hydroxy\s+acids?|glycolic(?:\s+acid)?|lactic(?:\s+acid)?|mandelic(?:\s+acid)?|citric(?:\s+acid)?|ahas?`,
  },
  {
    tag: 'bha',
    source: String.raw`beta[\s-]+hydroxy\s+acids?|betaine\s+salicylate|salicylic(?:\s+acid)?|bhas?`,
  },
  {
    tag: 'vitamin_c',
    source: String.raw`3-o-ethyl\s+ascorbic\s+acid|l[\s-]*ascorbic\s+acid|sodium\s+ascorbyl\s+phosphate|magnesium\s+ascorbyl\s+phosphate|ascorbyl\s+glucoside|ascorbic\s+acid|vit(?:amin)?[\s-]*c`,
  },
  {
    tag: 'benzoyl_peroxide',
    source: String.raw`benzoyl\s+peroxide|bpo`,
  },
  {
    // These common percentage-bearing ingredients prevent a percentage between two
    // labels (for example, "Niacinamide 1% BHA") from being assigned to both.
    tag: 'other',
    source: String.raw`niacinamide|nicotinamide|azelaic(?:\s+acid)?|tranexamic(?:\s+acid)?|hydroquinone|copper\s+(?:tripeptide-1|peptides?)|peptides?|hyaluronic(?:\s+acid)?|sodium\s+hyaluronate|ceramides?(?:\s+np)?|zinc(?:\s+oxide|\s+pca)?|titanium\s+dioxide|urea|sulfur`,
  },
];

type Span = { start: number; end: number };
type LabelOccurrence = Span & { tag: AssociationTag };
type PercentageOccurrence = Span & { value: number };

function isThresholdTag(tag: FunctionalTag): tag is ThresholdTag {
  return Object.prototype.hasOwnProperty.call(HIGH_THRESHOLD, tag);
}

function findLabelOccurrences(text: string): LabelOccurrence[] {
  const occurrences: LabelOccurrence[] = [];
  for (const label of ASSOCIATION_LABELS) {
    const pattern = new RegExp(String.raw`\b(?:${label.source})\b`, 'gi');
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      occurrences.push({
        tag: label.tag,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }
  return occurrences;
}

function isExactPercentage(text: string, occurrence: PercentageOccurrence): boolean {
  const before = text.slice(0, occurrence.start);
  const after = text.slice(occurrence.end);
  const number = String.raw`(?:\d+(?:\.\d+)?|\.\d+)`;
  const rangeBefore = new RegExp(String.raw`${number}\s*(?:-|\u2013|\u2014|to)\s*$`, 'i');
  const rangeAfter = new RegExp(String.raw`^\s*(?:-|\u2013|\u2014|to)\s*${number}\s*%`, 'i');

  if (rangeBefore.test(before) || rangeAfter.test(after)) return false;
  if (/(?:[<>]=?|[\u2264\u2265~\u2248])\s*$/.test(before)) return false;
  return !/\b(?:up to|less than|more than|about|approximately?)\s*$/i.test(before);
}

function findPercentageOccurrences(text: string): PercentageOccurrence[] {
  const occurrences: PercentageOccurrence[] = [];
  const pattern = new RegExp(PCT.source, PCT.flags);
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const raw = match[1];
    if (raw == null) continue;
    const value = Number.parseFloat(raw);
    const occurrence = { start: match.index, end: match.index + match[0].length, value };
    if (Number.isFinite(value) && isExactPercentage(text, occurrence)) {
      occurrences.push(occurrence);
    }
  }
  return occurrences;
}

function isAssociationGap(gap: string): boolean {
  const connector = gap
    .replace(/[\s()[\]{}:@-]+/g, ' ')
    .trim()
    .toLowerCase();
  return connector === '' || connector === 'at' || connector === 'w/w';
}

function candidateTagsForPercentage(
  text: string,
  percentage: PercentageOccurrence,
  labels: LabelOccurrence[],
): Set<AssociationTag> {
  const candidates = new Set<AssociationTag>();
  for (const label of labels) {
    const followsLabel =
      label.end <= percentage.start && isAssociationGap(text.slice(label.end, percentage.start));
    const precedesLabel =
      label.start >= percentage.end && isAssociationGap(text.slice(percentage.end, label.start));
    if (followsLabel || precedesLabel) candidates.add(label.tag);
  }
  return candidates;
}

/**
 * 'high' when any confirmed tag-associated percentage reaches its threshold. 'low'
 * only when every threshold-bearing tag has one unambiguous below-threshold value.
 * Missing or ambiguous associations remain undefined.
 */
export function deriveConcentration(
  text: string,
  tags: FunctionalTag[],
): 'low' | 'high' | undefined {
  const relevantTags = [...new Set(tags.filter(isThresholdTag))];
  if (relevantTags.length === 0) return undefined;

  const relevant = new Set<ThresholdTag>(relevantTags);
  const labels = findLabelOccurrences(text);
  const associated = new Map<ThresholdTag, Set<number>>();
  const ambiguous = new Set<ThresholdTag>();

  for (const percentage of findPercentageOccurrences(text)) {
    const candidates = candidateTagsForPercentage(text, percentage, labels);
    const relevantCandidates = [...candidates].filter(
      (tag): tag is ThresholdTag => tag !== 'other' && relevant.has(tag),
    );

    if (candidates.size !== 1) {
      for (const tag of relevantCandidates) ambiguous.add(tag);
      continue;
    }

    const [candidate] = candidates;
    if (candidate == null || candidate === 'other' || !relevant.has(candidate)) continue;
    const values = associated.get(candidate) ?? new Set<number>();
    values.add(percentage.value);
    associated.set(candidate, values);
  }

  for (const tag of relevantTags) {
    for (const percentage of associated.get(tag) ?? []) {
      if (percentage >= HIGH_THRESHOLD[tag]) return 'high';
    }
  }

  for (const tag of relevantTags) {
    if (ambiguous.has(tag) || associated.get(tag)?.size !== 1) return undefined;
  }
  return 'low';
}
